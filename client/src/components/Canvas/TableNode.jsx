/**
 * TableNode.jsx — Custom React Flow node representing a database table
 *
 * Features:
 *   - Table name header (draggable via React Flow)
 *   - Column list with checkboxes to include in SELECT
 *   - Optional alias editing
 *   - Connection handles on left/right for JOIN edges
 */

import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Table2, X, Edit3, Check, CheckSquare, Square } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import './TableNode.css';

export default function TableNode({ id, data, selected }) {
  const { tableName, columns, alias } = data;
  const {
    selectedColumns, toggleColumn, selectAllColumns,
    clearColumnSelection, removeTableNode, setTableAlias,
  } = useQueryStore();

  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState(alias || '');

  const nodeSelected = selectedColumns[id] ?? [];
  const allSelected = nodeSelected.length === columns.length;
  const someSelected = nodeSelected.length > 0 && !allSelected;

  const saveAlias = () => {
    setTableAlias(id, aliasInput.trim() || null);
    setEditingAlias(false);
  };

  const displayName = alias || tableName;

  return (
    <div className={`table-node ${selected ? 'table-node--selected' : ''}`}>
      {/* Left handle — source for JOIN edges */}
      <Handle type="source" position={Position.Left}  id="left"  className="table-handle" />
      <Handle type="target" position={Position.Left}  id="left-t" className="table-handle" />

      {/* Header */}
      <div className="table-node-header">
        <Table2 size={13} />
        {editingAlias ? (
          <input
            className="alias-input"
            value={aliasInput}
            onChange={(e) => setAliasInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveAlias()}
            autoFocus
            placeholder={tableName}
          />
        ) : (
          <span className="table-node-name" title={tableName}>
            {displayName}
            {alias && <span className="table-node-original">({tableName})</span>}
          </span>
        )}
        <div className="table-node-actions">
          {editingAlias ? (
            <button className="node-action-btn" onClick={saveAlias}>
              <Check size={11} />
            </button>
          ) : (
            <button className="node-action-btn" onClick={() => setEditingAlias(true)} title="Set alias">
              <Edit3 size={11} />
            </button>
          )}
          <button className="node-action-btn node-action-remove" onClick={() => removeTableNode(id)} title="Remove table">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Select all toggle */}
      <div className="table-node-select-all" onClick={() => allSelected ? clearColumnSelection(id) : selectAllColumns(id)}>
        {allSelected
          ? <CheckSquare size={11} className="check-icon check-all" />
          : someSelected
            ? <CheckSquare size={11} className="check-icon check-some" />
            : <Square size={11} className="check-icon" />
        }
        <span>{allSelected ? 'Deselect all' : 'Select all'}</span>
        <span className="col-sel-count">{nodeSelected.length}/{columns.length}</span>
      </div>

      {/* Column list */}
      <div className="table-node-columns">
        {columns.map((col) => {
          const isChecked = nodeSelected.includes(col.columnName);
          return (
            <div
              key={col.columnName}
              className={`table-node-col ${isChecked ? 'col-checked' : ''}`}
              onClick={() => toggleColumn(id, col.columnName)}
            >
              <span className={`col-key-badge ${col.columnKey === 'PRI' ? 'pk' : ''}`}>
                {col.columnKey === 'PRI' ? 'PK' : ''}
              </span>
              <span className="col-name">{col.columnName}</span>
              <span className="col-type">{col.dataType}</span>
              {isChecked
                ? <CheckSquare size={12} className="col-check checked" />
                : <Square size={12} className="col-check" />
              }
            </div>
          );
        })}
      </div>

      {/* Right handle */}
      <Handle type="source" position={Position.Right} id="right"   className="table-handle" />
      <Handle type="target" position={Position.Right} id="right-t" className="table-handle" />
    </div>
  );
}
