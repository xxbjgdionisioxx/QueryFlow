import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Table2, X, Plus, Trash2, Key, Type, Database, Settings2 } from 'lucide-react';
import { useDesignerStore } from '../../store/designerStore';
import './DesignerTableNode.css';

const DATA_TYPES = [
  'int', 'varchar', 'text', 'datetime', 'timestamp', 'decimal', 'float', 'boolean', 'json', 'blob'
];

export default function DesignerTableNode({ id, data, selected }) {
  const { tableName, columns } = data;
  const { updateTable, removeTable, addColumn, updateColumn, removeColumn } = useDesignerStore();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(tableName);

  const saveTableName = () => {
    updateTable(id, { tableName: nameInput.trim() || tableName });
    setIsEditingName(false);
  };

  return (
    <div className={`designer-table-node ${selected ? 'selected' : ''}`}>
      {/* Header */}
      <div className="table-header">
        <Table2 size={14} className="header-icon" />
        {isEditingName ? (
          <input
            className="table-name-input"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={saveTableName}
            onKeyDown={(e) => e.key === 'Enter' && saveTableName()}
            autoFocus
          />
        ) : (
          <span className="table-name" onDoubleClick={() => setIsEditingName(true)}>
            {tableName}
          </span>
        )}
        <button className="remove-btn" onClick={() => removeTable(id)}>
          <X size={12} />
        </button>
      </div>

      {/* Columns */}
      <div className="columns-list">
        {columns.map((col, idx) => (
          <div key={idx} className="column-row">
            {/* Handles for relationships */}
            <Handle
              type="target"
              position={Position.Left}
              id={`col-${col.columnName}-left`}
              className="col-handle"
              style={{ top: 'auto', bottom: 'auto' }}
            />
            
            <div className="col-controls">
              <input
                className="col-name-input"
                value={col.columnName}
                onChange={(e) => updateColumn(id, idx, { columnName: e.target.value })}
                placeholder="Name"
                title="Column Name"
              />
              
              <div className="col-details">
                <select
                  className="col-type-select"
                  value={col.dataType}
                  onChange={(e) => updateColumn(id, idx, { dataType: e.target.value, columnType: e.target.value })}
                  title="Data Type"
                >
                  {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                <input
                  className="col-length-input"
                  value={col.columnType.match(/\((.*)\)/)?.[1] || ''}
                  onChange={(e) => {
                    const len = e.target.value;
                    const newType = len ? `${col.dataType}(${len})` : col.dataType;
                    updateColumn(id, idx, { columnType: newType });
                  }}
                  placeholder="Len"
                  title="Length/Values"
                />
              </div>

              <div className="col-actions">
                <button 
                  className={`col-attr-btn ${col.columnKey === 'PRI' ? 'active' : ''}`}
                  onClick={() => updateColumn(id, idx, { columnKey: col.columnKey === 'PRI' ? '' : 'PRI' })}
                  title="Primary Key"
                >
                  <Key size={10} />
                </button>

                <button 
                  className={`col-attr-btn ${col.isNullable === 'NO' ? 'active' : ''}`}
                  onClick={() => updateColumn(id, idx, { isNullable: col.isNullable === 'NO' ? 'YES' : 'NO' })}
                  title="Not Null"
                >
                  <Settings2 size={10} />
                </button>

                <button 
                  className={`col-attr-btn ${col.extra === 'auto_increment' ? 'active' : ''}`}
                  onClick={() => updateColumn(id, idx, { extra: col.extra === 'auto_increment' ? '' : 'auto_increment' })}
                  title="Auto Increment"
                >
                  <Plus size={10} />
                </button>

                <button 
                  className="col-remove-btn"
                  onClick={() => removeColumn(id, idx)}
                  title="Remove Column"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>

            <Handle
              type="source"
              position={Position.Right}
              id={`col-${col.columnName}-right`}
              className="col-handle"
              style={{ top: 'auto', bottom: 'auto' }}
            />
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="table-footer">
        <button className="add-col-btn" onClick={() => addColumn(id)}>
          <Plus size={12} /> Add Column
        </button>
      </div>
    </div>
  );
}
