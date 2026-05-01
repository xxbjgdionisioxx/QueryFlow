/**
 * schemaService.js — MySQL schema introspection via INFORMATION_SCHEMA
 *
 * Queries INFORMATION_SCHEMA.TABLES and INFORMATION_SCHEMA.COLUMNS to build
 * a structured schema representation used by the frontend sidebar.
 *
 * Designed to work consistently across MySQL 5.6, 5.7, and 8.0+.
 */

import { query } from './connectionService.js';

/**
 * Fetch all user tables and their columns from the connected database.
 *
 * Returns an array of table objects, each with its columns and metadata.
 * Only BASE TABLE types are returned (no VIEWs by default).
 *
 * @param {string} sessionId
 * @param {object} [options]
 * @param {boolean} [options.includeViews=false]
 * @returns {Promise<TableSchema[]>}
 *
 * @typedef {Object} TableSchema
 * @property {string}   tableName
 * @property {string}   tableType   — 'BASE TABLE' | 'VIEW'
 * @property {Column[]} columns
 *
 * @typedef {Object} Column
 * @property {string}  columnName
 * @property {string}  dataType
 * @property {string}  columnType    — full type e.g. "varchar(255)"
 * @property {string}  isNullable    — 'YES' | 'NO'
 * @property {string}  columnKey     — 'PRI' | 'UNI' | 'MUL' | ''
 * @property {string|null} columnDefault
 * @property {string}  extra         — e.g. 'auto_increment'
 * @property {number}  ordinalPosition
 */
export async function getSchema(sessionId, { includeViews = false } = {}) {
  // Get the current database name from the session pool's config
  const [[dbRow]] = await query(sessionId, 'SELECT DATABASE() AS db');
  const database = dbRow.db;

  if (!database) {
    throw Object.assign(new Error('No database selected.'), { status: 400 });
  }

  // ── Fetch tables ──────────────────────────────────────────────────────────
  const tableTypes = includeViews ? `('BASE TABLE','VIEW')` : `('BASE TABLE')`;
  const [tables] = await query(sessionId, `
    SELECT
      TABLE_NAME    AS tableName,
      TABLE_TYPE    AS tableType,
      TABLE_ROWS    AS estimatedRows,
      TABLE_COMMENT AS tableComment
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = ?
      AND TABLE_TYPE IN ${tableTypes}
    ORDER BY TABLE_NAME
  `, [database]);

  if (tables.length === 0) {
    return [];
  }

  // ── Fetch all columns in one query (more efficient than N per-table calls) ─
  const [columns] = await query(sessionId, `
    SELECT
      TABLE_NAME       AS tableName,
      COLUMN_NAME      AS columnName,
      DATA_TYPE        AS dataType,
      COLUMN_TYPE      AS columnType,
      IS_NULLABLE      AS isNullable,
      COLUMN_KEY       AS columnKey,
      COLUMN_DEFAULT   AS columnDefault,
      EXTRA            AS extra,
      ORDINAL_POSITION AS ordinalPosition
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_NAME, ORDINAL_POSITION
  `, [database]);

  // ── Group columns by table ────────────────────────────────────────────────
  const columnsByTable = {};
  for (const col of columns) {
    if (!columnsByTable[col.tableName]) {
      columnsByTable[col.tableName] = [];
    }
    columnsByTable[col.tableName].push({
      columnName:      col.columnName,
      dataType:        col.dataType,
      columnType:      col.columnType,
      isNullable:      col.isNullable,
      columnKey:       col.columnKey,
      columnDefault:   col.columnDefault,
      extra:           col.extra,
      ordinalPosition: col.ordinalPosition,
    });
  }

  // ── Assemble final schema ─────────────────────────────────────────────────
  return tables.map((t) => ({
    tableName:     t.tableName,
    tableType:     t.tableType,
    estimatedRows: t.estimatedRows,
    tableComment:  t.tableComment,
    columns:       columnsByTable[t.tableName] ?? [],
  }));
}
