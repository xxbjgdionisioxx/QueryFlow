/**
 * joinBuilder.js — JOIN clause generation
 *
 * Builds JOIN clauses from an array of join definitions.
 * Supports INNER JOIN, LEFT JOIN, and RIGHT JOIN.
 *
 * Each join connects two tables on a matching column pair.
 * Tables can carry optional aliases to handle self-joins.
 */

import { escapeIdentifier } from './selectBuilder.js';

/**
 * @typedef {Object} JoinDefinition
 * @property {'INNER'|'LEFT'|'RIGHT'} type       - Join type
 * @property {string} fromTable                   - Left-hand table name
 * @property {string} [fromAlias]                 - Left-hand alias
 * @property {string} fromColumn                  - Left-hand join column
 * @property {string} toTable                     - Right-hand (joined) table name
 * @property {string} [toAlias]                   - Right-hand alias
 * @property {string} toColumn                    - Right-hand join column
 */

const ALLOWED_JOIN_TYPES = new Set(['INNER', 'LEFT', 'RIGHT']);

/**
 * Build all JOIN clauses from a join definition array.
 *
 * @param {JoinDefinition[]} joins
 * @returns {string}  — multi-line JOIN clause string, or '' if no joins
 */
export function buildJoins(joins) {
  if (!joins || joins.length === 0) return '';

  return joins.map((join) => {
    // Validate join type — default to INNER if unrecognized
    const type = ALLOWED_JOIN_TYPES.has(join.type?.toUpperCase())
      ? join.type.toUpperCase()
      : 'INNER';

    const toTable = escapeIdentifier(join.toTable);
    const toAlias = join.toAlias ? ` AS ${escapeIdentifier(join.toAlias)}` : '';

    // Resolve column references (use alias if provided)
    const fromRef = join.fromAlias || join.fromTable;
    const toRef   = join.toAlias   || join.toTable;

    const onLeft  = `${escapeIdentifier(fromRef)}.${escapeIdentifier(join.fromColumn)}`;
    const onRight = `${escapeIdentifier(toRef)}.${escapeIdentifier(join.toColumn)}`;

    return `${type} JOIN ${toTable}${toAlias} ON ${onLeft} = ${onRight}`;
  }).join('\n');
}
