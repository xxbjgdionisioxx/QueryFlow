/**
 * queryBuilder/index.js — Main query builder orchestrator
 *
 * Accepts a structured JSON query definition and produces a complete,
 * version-appropriate MySQL SELECT statement + bound parameter array.
 *
 * This module is the single integration point for all sub-builders and
 * the version compatibility adapter. It can be used independently of the
 * HTTP layer — just call buildQuery() with a query definition + compat map.
 *
 * ── Query Definition Schema ──────────────────────────────────────────────────
 * {
 *   primaryTable:  { name: string, alias?: string },
 *   columns:       SelectColumn[],        // from selectBuilder
 *   joins:         JoinDefinition[],      // from joinBuilder
 *   filters:       FilterGroup | null,    // from filterBuilder
 *   groupBy:       {table, column}[],     // from aggregationBuilder
 *   orderBy:       {table, column, direction}[],
 *   having:        FilterGroup | null,
 *   limit:         number | null,
 *   offset:        number | null,
 * }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildSelect, escapeIdentifier } from './selectBuilder.js';
import { buildJoins }                    from './joinBuilder.js';
import { buildFilter }                   from './filterBuilder.js';
import { buildGroupBy, buildOrderBy, buildLimit } from './aggregationBuilder.js';

/**
 * Build a complete SQL SELECT statement from a query definition.
 *
 * @param {object} queryDef    - Structured query definition (see schema above)
 * @param {object} [compat]    - Compatibility map from versionAdapter (optional)
 *                               If omitted, all features are treated as available.
 * @returns {{ sql: string, params: Array, warnings: string[] }}
 *   sql      — the complete SQL string (ready to execute)
 *   params   — bound parameter values for parameterized execution
 *   warnings — array of human-readable compatibility warning strings
 */
export function buildQuery(queryDef, compat = null) {
  const warnings = [];

  // ── Validate required fields ──────────────────────────────────────────────
  if (!queryDef.primaryTable?.name) {
    throw Object.assign(
      new Error('Query definition must include a primaryTable.name'),
      { status: 400 }
    );
  }

  // ── Apply version compatibility checks ────────────────────────────────────
  if (compat) {
    applyCompatibilityChecks(queryDef, compat, warnings);
  }

  // ── FROM clause ───────────────────────────────────────────────────────────
  const primaryName  = escapeIdentifier(queryDef.primaryTable.name);
  const primaryAlias = queryDef.primaryTable.alias
    ? ` AS ${escapeIdentifier(queryDef.primaryTable.alias)}`
    : '';
  const fromClause = `FROM ${primaryName}${primaryAlias}`;

  // ── SELECT clause ─────────────────────────────────────────────────────────
  const selectClause = `SELECT ${buildSelect(queryDef.columns || [])}`;

  // ── JOIN clauses ──────────────────────────────────────────────────────────
  const joinClause = buildJoins(queryDef.joins || []);

  // ── WHERE clause ──────────────────────────────────────────────────────────
  const { sql: whereSql, params: whereParams } = buildFilter(queryDef.filters);
  const whereClause = whereSql ? `WHERE ${whereSql}` : '';

  // ── GROUP BY ──────────────────────────────────────────────────────────────
  const groupByClause = buildGroupBy(queryDef.groupBy || []);

  // ── HAVING ────────────────────────────────────────────────────────────────
  const { sql: havingSql, params: havingParams } = buildFilter(queryDef.having);
  const havingClause = havingSql ? `HAVING ${havingSql}` : '';

  // ── ORDER BY ──────────────────────────────────────────────────────────────
  const orderByClause = buildOrderBy(queryDef.orderBy || []);

  // ── LIMIT / OFFSET ────────────────────────────────────────────────────────
  const limitClause = buildLimit(queryDef.limit, queryDef.offset);

  // ── Assemble final SQL ────────────────────────────────────────────────────
  const parts = [
    selectClause,
    fromClause,
    joinClause,
    whereClause,
    groupByClause,
    havingClause,
    orderByClause,
    limitClause,
  ].filter(Boolean);

  const sql = parts.join('\n');
  const params = [...whereParams, ...havingParams];

  return { sql, params, warnings };
}

/**
 * Check the query definition against the compatibility map and:
 *   1. Remove or rewrite unsupported constructs
 *   2. Push human-readable warnings into the warnings array
 *
 * @param {object} queryDef
 * @param {object} compat
 * @param {string[]} warnings
 */
function applyCompatibilityChecks(queryDef, compat, warnings) {
  // Window functions check — filter any window function aggregate columns
  if (!compat.windowFunctions) {
    const windowAggs = ['ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD'];
    const before = queryDef.columns?.length ?? 0;
    if (queryDef.columns) {
      queryDef.columns = queryDef.columns.filter((col) => {
        if (windowAggs.includes(col.aggregate?.toUpperCase())) {
          warnings.push(
            `Window function "${col.aggregate}" is not supported in MySQL ${compat.tier}. Column removed.`
          );
          return false;
        }
        return true;
      });
    }
    // Log if any were removed
    void before; // suppress unused warning
  }

  // JSON functions check
  if (!compat.jsonFunctions && !compat.jsonFunctionsPartial) {
    const jsonAggs = ['JSON_ARRAYAGG', 'JSON_OBJECTAGG'];
    if (queryDef.columns) {
      queryDef.columns = queryDef.columns.filter((col) => {
        if (jsonAggs.includes(col.aggregate?.toUpperCase())) {
          warnings.push(
            `JSON aggregate "${col.aggregate}" is not supported in MySQL ${compat.tier}. Column removed.`
          );
          return false;
        }
        return true;
      });
    }
  }

  // GROUP BY strict mode warning
  if (!compat.onlyFullGroupBy && queryDef.groupBy?.length > 0) {
    warnings.push(
      `MySQL ${compat.tier} uses permissive GROUP BY. Non-aggregated columns in SELECT ` +
      `that are not in GROUP BY may return non-deterministic results. ` +
      `Consider upgrading to MySQL 5.7+ for strict GROUP BY enforcement.`
    );
  }
}

/**
 * Validate a query definition object and return any structural errors.
 * Useful for pre-flight checks before sending to the database.
 *
 * @param {object} queryDef
 * @returns {string[]} Array of error messages (empty if valid)
 */
export function validateQueryDef(queryDef) {
  const errors = [];

  if (!queryDef || typeof queryDef !== 'object') {
    errors.push('Query definition must be an object');
    return errors;
  }

  if (!queryDef.primaryTable?.name) {
    errors.push('primaryTable.name is required');
  }

  if (queryDef.joins) {
    queryDef.joins.forEach((join, i) => {
      if (!join.toTable)     errors.push(`joins[${i}].toTable is required`);
      if (!join.fromColumn)  errors.push(`joins[${i}].fromColumn is required`);
      if (!join.toColumn)    errors.push(`joins[${i}].toColumn is required`);
    });
  }

  return errors;
}
