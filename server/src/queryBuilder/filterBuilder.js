/**
 * filterBuilder.js — WHERE clause generation
 *
 * Builds a WHERE clause from a tree of filter groups and conditions.
 * Supports:
 *   - AND / OR logical grouping (arbitrarily nested)
 *   - Operators: =, !=, >, <, >=, <=, LIKE, IN, IS NULL, IS NOT NULL
 *   - Parameterized output to prevent SQL injection
 *
 * Returns both the SQL fragment and a flat params array for use with
 * mysql2's parameterized query execution.
 */

import { escapeIdentifier } from './selectBuilder.js';

/**
 * @typedef {Object} FilterCondition
 * @property {'condition'} type
 * @property {string}  table      - Table name or alias
 * @property {string}  column     - Column name
 * @property {string}  operator   - One of the allowed operators
 * @property {*}       [value]    - Value to compare (not needed for IS NULL)
 * @property {Array}   [values]   - Array of values for IN operator
 */

/**
 * @typedef {Object} FilterGroup
 * @property {'group'} type
 * @property {'AND'|'OR'} logic    - How children are combined
 * @property {Array<FilterCondition|FilterGroup>} children
 */

const ALLOWED_OPERATORS = new Set([
  '=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL',
]);

/**
 * Build the WHERE clause from a filter tree.
 *
 * @param {FilterGroup|FilterCondition|null} filterTree
 * @returns {{ sql: string, params: Array }}
 *   sql    — the WHERE clause fragment (without the "WHERE" keyword)
 *   params — flat array of bound parameter values
 */
export function buildFilter(filterTree) {
  if (!filterTree) return { sql: '', params: [] };

  const params = [];
  const sql = buildNode(filterTree, params);

  return { sql, params };
}

/**
 * Recursively build SQL for a node in the filter tree.
 *
 * @param {FilterGroup|FilterCondition} node
 * @param {Array} params — accumulator for bound parameters
 * @returns {string}
 */
function buildNode(node, params) {
  if (node.type === 'group') {
    if (!node.children || node.children.length === 0) return '';

    const logic = node.logic === 'OR' ? ' OR ' : ' AND ';
    const parts = node.children
      .map((child) => buildNode(child, params))
      .filter(Boolean);

    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];

    // Wrap multi-child groups in parentheses to ensure correct precedence
    return `(${parts.join(logic)})`;
  }

  if (node.type === 'condition') {
    return buildCondition(node, params);
  }

  return '';
}

/**
 * Build SQL for a single filter condition.
 *
 * @param {FilterCondition} condition
 * @param {Array} params
 * @returns {string}
 */
function buildCondition(condition, params) {
  const { table, column, operator, value, values } = condition;

  // Validate operator to prevent injection via operator field
  const op = operator?.toUpperCase();
  if (!ALLOWED_OPERATORS.has(op)) {
    throw Object.assign(
      new Error(`Unsupported filter operator: "${operator}"`),
      { status: 400 }
    );
  }

  const tablePrefix = table ? `${escapeIdentifier(table)}.` : '';
  const colRef = `${tablePrefix}${escapeIdentifier(column)}`;

  switch (op) {
    case 'IS NULL':
      return `${colRef} IS NULL`;

    case 'IS NOT NULL':
      return `${colRef} IS NOT NULL`;

    case 'IN': {
      // values must be a non-empty array
      const arr = Array.isArray(values) ? values : [value];
      if (arr.length === 0) {
        throw Object.assign(new Error('IN operator requires at least one value'), { status: 400 });
      }
      const placeholders = arr.map(() => '?').join(', ');
      params.push(...arr);
      return `${colRef} IN (${placeholders})`;
    }

    default:
      // =, !=, >, <, >=, <=, LIKE — all take a single value
      params.push(value ?? null);
      return `${colRef} ${op} ?`;
  }
}
