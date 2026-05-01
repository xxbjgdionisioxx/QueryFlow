/**
 * selectBuilder.js — SELECT clause generation
 *
 * Builds the SELECT list from a JSON column definition array.
 * Handles:
 *   - Plain columns (with optional alias)
 *   - Aggregate functions: COUNT, SUM, AVG, MIN, MAX
 *   - SELECT * when no columns are specified
 */

/**
 * @typedef {Object} SelectColumn
 * @property {string}  table        - Table alias or name
 * @property {string}  column       - Column name, or '*'
 * @property {string}  [alias]      - Optional output alias
 * @property {string}  [aggregate]  - 'COUNT'|'SUM'|'AVG'|'MIN'|'MAX'|null
 * @property {boolean} [distinct]   - Whether to apply DISTINCT inside aggregate
 */

const ALLOWED_AGGREGATES = new Set(['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']);

/**
 * Escape a MySQL identifier (table or column name) with backticks.
 * Allows `*` to pass through unescaped.
 *
 * @param {string} identifier
 * @returns {string}
 */
export function escapeIdentifier(identifier) {
  if (identifier === '*') return '*';
  // Replace any backtick inside the identifier to prevent injection
  return '`' + identifier.replace(/`/g, '``') + '`';
}

/**
 * Build the SELECT clause string.
 *
 * @param {SelectColumn[]} columns  — array of column definitions
 * @returns {string}                — e.g. "`orders`.`id`, COUNT(`orders`.`id`) AS `order_count`"
 */
export function buildSelect(columns) {
  if (!columns || columns.length === 0) {
    return '*';
  }

  return columns.map((col) => {
    const tablePrefix = col.table ? `${escapeIdentifier(col.table)}.` : '';
    const colRef = `${tablePrefix}${escapeIdentifier(col.column)}`;

    let expr;
    if (col.aggregate && ALLOWED_AGGREGATES.has(col.aggregate.toUpperCase())) {
      const agg = col.aggregate.toUpperCase();
      const distinct = col.distinct ? 'DISTINCT ' : '';
      expr = `${agg}(${distinct}${colRef})`;
    } else {
      expr = colRef;
    }

    // Apply alias if provided
    if (col.alias) {
      expr += ` AS ${escapeIdentifier(col.alias)}`;
    }

    return expr;
  }).join(', ');
}
