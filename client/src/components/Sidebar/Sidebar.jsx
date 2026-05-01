/**
 * Sidebar.jsx — Schema browser with draggable table items
 *
 * Displays the connected database schema as a tree of tables → columns.
 * Users drag table items onto the React Flow canvas to add them.
 */

import React, { useState } from 'react';
import {
  Database, Table2, ChevronRight, ChevronDown,
  Key, Hash, Type, Search, RefreshCw
} from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import { useConnectionStore } from '../../store/connectionStore';
import './Sidebar.css';

export default function Sidebar() {
  const { schema, isLoadingSchema, schemaError, loadSchema } = useQueryStore();
  const { database } = useConnectionStore();
  const [search, setSearch] = useState('');
  const [expandedTables, setExpandedTables] = useState(new Set());

  const filteredSchema = schema.filter((t) =>
    t.tableName.toLowerCase().includes(search.toLowerCase()) ||
    t.columns.some((c) => c.columnName.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleTable = (tableName) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      next.has(tableName) ? next.delete(tableName) : next.add(tableName);
      return next;
    });
  };

  // ── Drag start: carry the table schema as JSON ─────────────────────────────
  const handleDragStart = (e, table) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/queryflow-table', JSON.stringify(table));
  };

  return (
    <aside className="app-sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-db-name">
          <Database size={14} />
          <span>{database || 'No database'}</span>
        </div>
        <button
          id="sidebar-refresh-btn"
          className="btn btn-ghost btn-icon"
          onClick={loadSchema}
          disabled={isLoadingSchema}
          data-tooltip="Refresh schema"
        >
          <RefreshCw size={13} className={isLoadingSchema ? 'spin' : ''} />
        </button>
      </div>

      {/* Search */}
      <div className="sidebar-search">
        <Search size={13} className="sidebar-search-icon" />
        <input
          id="sidebar-search-input"
          type="text"
          placeholder="Search tables & columns…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table count */}
      {!isLoadingSchema && schema.length > 0 && (
        <div className="sidebar-meta">
          {filteredSchema.length} of {schema.length} tables
        </div>
      )}

      {/* Error */}
      {schemaError && (
        <div className="sidebar-error">{schemaError}</div>
      )}

      {/* Loading */}
      {isLoadingSchema && (
        <div className="sidebar-loading">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton sidebar-skeleton" />
          ))}
        </div>
      )}

      {/* Schema tree */}
      <div className="scroll-area sidebar-tree">
        {filteredSchema.map((table) => (
          <TableItem
            key={table.tableName}
            table={table}
            isExpanded={expandedTables.has(table.tableName)}
            onToggle={() => toggleTable(table.tableName)}
            onDragStart={handleDragStart}
            search={search}
          />
        ))}

        {!isLoadingSchema && filteredSchema.length === 0 && schema.length > 0 && (
          <div className="sidebar-empty">No tables match "{search}"</div>
        )}

        {!isLoadingSchema && schema.length === 0 && !schemaError && (
          <div className="sidebar-empty">No tables found</div>
        )}
      </div>
    </aside>
  );
}

function TableItem({ table, isExpanded, onToggle, onDragStart, search }) {
  return (
    <div className="sidebar-table">
      <div
        className="sidebar-table-header"
        draggable
        onDragStart={(e) => onDragStart(e, table)}
        onClick={onToggle}
        title={`Drag to add ${table.tableName} to canvas`}
      >
        <div className="sidebar-table-left">
          {isExpanded
            ? <ChevronDown size={13} className="sidebar-chevron" />
            : <ChevronRight size={13} className="sidebar-chevron" />
          }
          <Table2 size={13} className="sidebar-table-icon" />
          <span className="sidebar-table-name">
            {highlight(table.tableName, search)}
          </span>
        </div>
        <span className="sidebar-col-count">{table.columns.length}</span>
      </div>

      {isExpanded && (
        <div className="sidebar-columns">
          {table.columns.map((col) => (
            <div key={col.columnName} className="sidebar-column">
              <ColumnTypeIcon columnKey={col.columnKey} dataType={col.dataType} />
              <span className="sidebar-col-name">
                {highlight(col.columnName, search)}
              </span>
              <span className="sidebar-col-type">{col.dataType}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnTypeIcon({ columnKey, dataType }) {
  if (columnKey === 'PRI') return <Key size={11} className="col-icon col-pk" />;
  if (dataType?.match(/int|bigint|tinyint|smallint|decimal|float|double/i))
    return <Hash size={11} className="col-icon col-num" />;
  return <Type size={11} className="col-icon col-text" />;
}

function highlight(text, search) {
  if (!search) return text;
  const idx = text.toLowerCase().indexOf(search.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + search.length)}</mark>
      {text.slice(idx + search.length)}
    </>
  );
}
