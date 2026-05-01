/**
 * clientSqlBuilder.js — Client-side SQL preview generation
 *
 * Mirrors the server-side query builder logic for live preview.
 * This runs entirely in the browser — no API call needed for preview.
 * The server's version is authoritative for actual execution.
 */

function escId(id) {
  if (!id || id === '*') return id || '*';
  return '`' + String(id).replace(/`/g, '``') + '`';
}

function buildSelect(columns) {
  if (!columns || columns.length === 0) return '*';
  return columns.map((col) => {
    const tablePrefix = col.table ? `${escId(col.table)}.` : '';
    const colRef = `${tablePrefix}${escId(col.column)}`;
    let expr = col.aggregate
      ? `${col.aggregate.toUpperCase()}(${col.distinct ? 'DISTINCT ' : ''}${colRef})`
      : colRef;
    if (col.alias) expr += ` AS ${escId(col.alias)}`;
    return expr;
  }).join(', ');
}

function buildJoins(joins) {
  if (!joins || joins.length === 0) return '';
  return joins.map((j) => {
    const type = ['INNER', 'LEFT', 'RIGHT'].includes(j.type?.toUpperCase()) ? j.type.toUpperCase() : 'INNER';
    const toAlias = j.toAlias ? ` AS ${escId(j.toAlias)}` : '';
    const from = escId(j.fromAlias || j.fromTable);
    const to   = escId(j.toAlias   || j.toTable);
    return `${type} JOIN ${escId(j.toTable)}${toAlias} ON ${from}.${escId(j.fromColumn)} = ${to}.${escId(j.toColumn)}`;
  }).join('\n');
}

function buildWhere(filters) {
  if (!filters || (filters.children && filters.children.length === 0)) return '';
  return buildFilterNode(filters);
}

function buildFilterNode(node) {
  if (!node) return '';
  if (node.type === 'group') {
    const logic = node.logic === 'OR' ? ' OR ' : ' AND ';
    const parts = (node.children || []).map(buildFilterNode).filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    return `(${parts.join(logic)})`;
  }
  const col = `${node.table ? `${escId(node.table)}.` : ''}${escId(node.column)}`;
  const op = node.operator?.toUpperCase();
  if (op === 'IS NULL') return `${col} IS NULL`;
  if (op === 'IS NOT NULL') return `${col} IS NOT NULL`;
  if (op === 'IN') {
    const vals = (node.values || []).map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
    return `${col} IN (${vals})`;
  }
  const val = typeof node.value === 'string' ? `'${node.value.replace(/'/g, "''")}'` : String(node.value ?? 'NULL');
  return `${col} ${op} ${val}`;
}

function buildGroupBy(groupBy) {
  if (!groupBy || groupBy.length === 0) return '';
  return `GROUP BY ${groupBy.map(({ table, column }) => `${table ? `${escId(table)}.` : ''}${escId(column)}`).join(', ')}`;
}

function buildOrderBy(orderBy) {
  if (!orderBy || orderBy.length === 0) return '';
  return `ORDER BY ${orderBy.map(({ table, column, direction }) =>
    `${table ? `${escId(table)}.` : ''}${escId(column)} ${direction === 'DESC' ? 'DESC' : 'ASC'}`
  ).join(', ')}`;
}

/**
 * Build a SQL string from a query definition object.
 * Used for the live SQL preview panel — not for actual execution.
 *
 * @param {object} queryDef
 * @returns {string}
 */
export function buildClientSQL(queryDef) {
  if (!queryDef?.primaryTable?.name) return '-- No table selected';

  const { primaryTable, columns, joins, filters, groupBy, orderBy, limit, offset } = queryDef;

  const fromAlias = primaryTable.alias && primaryTable.alias !== primaryTable.name
    ? ` AS ${escId(primaryTable.alias)}`
    : '';

  const parts = [
    `SELECT ${buildSelect(columns)}`,
    `FROM ${escId(primaryTable.name)}${fromAlias}`,
    buildJoins(joins),
    (() => { const w = buildWhere(filters); return w ? `WHERE ${w}` : ''; })(),
    buildGroupBy(groupBy),
    buildOrderBy(orderBy),
    limit ? `LIMIT ${limit}${offset ? ` OFFSET ${offset}` : ''}` : '',
  ].filter(Boolean);

  return parts.join('\n');
}
