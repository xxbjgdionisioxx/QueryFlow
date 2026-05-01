/**
 * FilterBuilder.jsx — Visual WHERE clause builder
 *
 * Provides a tree-based UI for constructing AND/OR filter groups.
 * Each condition has: table.column, operator, value.
 */

import React from 'react';
import { Plus, PlusCircle, Trash2, GitBranch } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import './FilterBuilder.css';

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'IS NULL', 'IS NOT NULL'];

export default function FilterBuilder() {
  const { filters, nodes, addFilterCondition, addFilterGroup, clearFilters } = useQueryStore();
  const hasFilters = filters.children?.length > 0;

  // Flatten all table+column options from canvas nodes
  const columnOptions = [];
  nodes.forEach((node) => {
    const alias = node.data.alias || node.data.tableName;
    node.data.columns.forEach((col) => {
      columnOptions.push({ label: `${alias}.${col.columnName}`, table: alias, column: col.columnName });
    });
  });

  return (
    <div className="filter-builder">
      <div className="filter-builder-toolbar">
        <button className="btn btn-secondary btn-sm" onClick={() => addFilterCondition()} id="add-filter-condition-btn">
          <Plus size={12} />
          Add Condition
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => addFilterGroup()} id="add-filter-group-btn">
          <GitBranch size={12} />
          Add Group
        </button>
        {hasFilters && (
          <button className="btn btn-danger btn-sm" onClick={clearFilters} id="clear-filters-btn">
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>

      {!hasFilters && (
        <div className="filter-empty">
          No filters — all rows will be returned
        </div>
      )}

      {hasFilters && (
        <div className="filter-tree">
          <FilterGroup
            group={filters}
            path={[]}
            columnOptions={columnOptions}
            isRoot
          />
        </div>
      )}
    </div>
  );
}

function FilterGroup({ group, path, columnOptions, isRoot }) {
  const { updateFilterNode, addFilterCondition, addFilterGroup, removeFilterNode } = useQueryStore();

  return (
    <div className={`filter-group ${isRoot ? 'filter-group-root' : ''}`}>
      {/* Group logic toggle */}
      <div className="filter-group-header">
        <div className="filter-logic-toggle">
          <button
            className={`logic-btn ${group.logic === 'AND' ? 'active' : ''}`}
            onClick={() => updateFilterNode(path, { logic: 'AND' })}
          >AND</button>
          <button
            className={`logic-btn ${group.logic === 'OR' ? 'active' : ''}`}
            onClick={() => updateFilterNode(path, { logic: 'OR' })}
          >OR</button>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => addFilterCondition(path)}>
          <Plus size={11} /> Condition
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => addFilterGroup(path)}>
          <PlusCircle size={11} /> Group
        </button>
        {!isRoot && (
          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeFilterNode(path)}>
            <Trash2 size={11} />
          </button>
        )}
      </div>

      {/* Children */}
      <div className="filter-group-children">
        {group.children?.map((child, i) => (
          child.type === 'group'
            ? <FilterGroup key={child.id || i} group={child} path={[...path, i]} columnOptions={columnOptions} />
            : <FilterCondition key={child.id || i} condition={child} path={[...path, i]} columnOptions={columnOptions} />
        ))}

        {(!group.children || group.children.length === 0) && (
          <div className="filter-group-empty">Empty group</div>
        )}
      </div>
    </div>
  );
}

function FilterCondition({ condition, path, columnOptions }) {
  const { updateFilterNode, removeFilterNode } = useQueryStore();
  const needsValue = !['IS NULL', 'IS NOT NULL'].includes(condition.operator);
  const isIn = condition.operator === 'IN';

  const handleColChange = (e) => {
    const opt = columnOptions.find((o) => o.label === e.target.value);
    if (opt) updateFilterNode(path, { table: opt.table, column: opt.column });
  };

  return (
    <div className="filter-condition">
      {/* Column selector */}
      <select
        className="filter-select"
        value={condition.table ? `${condition.table}.${condition.column}` : ''}
        onChange={handleColChange}
      >
        <option value="">Column…</option>
        {columnOptions.map((o) => (
          <option key={o.label} value={o.label}>{o.label}</option>
        ))}
      </select>

      {/* Operator */}
      <select
        className="filter-select filter-op"
        value={condition.operator || '='}
        onChange={(e) => updateFilterNode(path, { operator: e.target.value, value: '', values: [] })}
      >
        {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
      </select>

      {/* Value */}
      {needsValue && (
        isIn ? (
          <input
            className="filter-input"
            placeholder="val1, val2, …"
            value={condition.values?.join(', ') || condition.value || ''}
            onChange={(e) => {
              const vals = e.target.value.split(',').map((v) => v.trim()).filter(Boolean);
              updateFilterNode(path, { values: vals });
            }}
            title="Comma-separated values"
          />
        ) : (
          <input
            className="filter-input"
            placeholder="Value"
            value={condition.value || ''}
            onChange={(e) => updateFilterNode(path, { value: e.target.value })}
          />
        )
      )}

      <button
        className="btn btn-ghost btn-icon btn-sm filter-remove"
        onClick={() => removeFilterNode(path)}
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}
