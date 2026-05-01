/**
 * aggregationBuilder.js — GROUP BY, ORDER BY, HAVING, and LIMIT generation
 *
 * Builds aggregation-related clauses from a structured definition.
 * Aware of MySQL version differences in GROUP BY behavior:
 *   - MySQL 5.6: ONLY_FULL_GROUP_BY is OFF by default (permissive)
 *   - MySQL 5.7+: ONLY_FULL_GROUP_BY is ON by default (strict)
 *   → We always generate standards-compliant GROUP BY to be safe on all versions.
 */

import { escapeIdentifier } from './selectBuilder.js';

/**
 * @typedef {Object} OrderByColumn
 * @property {string}          table
 * @property {string}          column
 * @property {'ASC'|'DESC'}    direction
 */

/**
 * @typedef {Object} AggregationDefinition
 * @property {Array<{table:string, column:string}>} groupBy  - Columns to group by
 * @property {OrderByColumn[]}                      orderBy  - Sort specification
 * @property {object|null}                          having   - HAVING filter (same format as WHERE)
 * @property {number|null}                          limit    - Max rows
 * @property {number|null}                          offset   - Row offset
 */

/**
 * Build GROUP BY clause.
 *
 * @param {Array<{table:string, column:string}>} groupBy
 * @returns {string}
 */
export function buildGroupBy(groupBy) {
  if (!groupBy || groupBy.length === 0) return '';

  const cols = groupBy.map(({ table, column }) => {
    const tablePrefix = table ? `${escapeIdentifier(table)}.` : '';
    return `${tablePrefix}${escapeIdentifier(column)}`;
  });

  return `GROUP BY ${cols.join(', ')}`;
}

/**
 * Build ORDER BY clause.
 * Validates direction to prevent injection.
 *
 * @param {OrderByColumn[]} orderBy
 * @returns {string}
 */
export function buildOrderBy(orderBy) {
  if (!orderBy || orderBy.length === 0) return '';

  const cols = orderBy.map(({ table, column, direction }) => {
    const tablePrefix = table ? `${escapeIdentifier(table)}.` : '';
    const colRef = `${tablePrefix}${escapeIdentifier(column)}`;
    // Only allow ASC or DESC — default to ASC for anything else
    const dir = direction?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    return `${colRef} ${dir}`;
  });

  return `ORDER BY ${cols.join(', ')}`;
}

/**
 * Build LIMIT / OFFSET clause.
 *
 * @param {number|null} limit
 * @param {number|null} offset
 * @returns {string}
 */
export function buildLimit(limit, offset) {
  if (!limit && limit !== 0) return '';

  const l = Math.max(1, Math.floor(Number(limit)));
  const o = offset ? Math.max(0, Math.floor(Number(offset))) : 0;

  return o > 0 ? `LIMIT ${l} OFFSET ${o}` : `LIMIT ${l}`;
}
