/**
 * AggregationPanel.jsx — GROUP BY, ORDER BY, and aggregate function controls
 */

import React from 'react';
import { Plus, Trash2, ArrowUpDown } from 'lucide-react';
import { useQueryStore } from '../../store/queryStore';
import { useConnectionStore } from '../../store/connectionStore';
import './AggregationPanel.css';

const AGGREGATES = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'];

export default function AggregationPanel() {
  const {
    nodes, groupBy, orderBy, aggregateColumns, limit,
    setGroupBy, setOrderBy, setLimit,
    addAggregateColumn, removeAggregateColumn, updateAggregateColumn,
  } = useQueryStore();

  const { getEffectiveCompat } = useConnectionStore();
  const compat = getEffectiveCompat();

  // Build available column options from canvas nodes
  const columnOptions = [];
  nodes.forEach((node) => {
    const alias = node.data.alias || node.data.tableName;
    node.data.columns.forEach((col) => {
      columnOptions.push({ label: `${alias}.${col.columnName}`, table: alias, column: col.columnName });
    });
  });

  const addGroupBy = () => {
    if (columnOptions.length > 0) {
      setGroupBy([...groupBy, { table: columnOptions[0].table, column: columnOptions[0].column }]);
    }
  };

  const updateGroupBy = (i, label) => {
    const opt = columnOptions.find((o) => o.label === label);
    if (!opt) return;
    const next = [...groupBy];
    next[i] = { table: opt.table, column: opt.column };
    setGroupBy(next);
  };

  const removeGroupBy = (i) => {
    setGroupBy(groupBy.filter((_, idx) => idx !== i));
  };

  const addOrderBy = () => {
    if (columnOptions.length > 0) {
      setOrderBy([...orderBy, { table: columnOptions[0].table, column: columnOptions[0].column, direction: 'ASC' }]);
    }
  };

  const updateOrderBy = (i, updates) => {
    const next = [...orderBy];
    next[i] = { ...next[i], ...updates };
    if (updates.label) {
      const opt = columnOptions.find((o) => o.label === updates.label);
      if (opt) { next[i].table = opt.table; next[i].column = opt.column; }
    }
    setOrderBy(next);
  };

  const removeOrderBy = (i) => {
    setOrderBy(orderBy.filter((_, idx) => idx !== i));
  };

  return (
    <div className="agg-panel">
      {/* ── Aggregate columns ─────────────────────────── */}
      <div className="agg-section">
        <div className="agg-section-header">
          <span>Aggregate Functions</span>
          <button className="btn btn-ghost btn-sm" id="add-agg-btn" onClick={() =>
            addAggregateColumn({ nodeId: nodes[0]?.id, column: columnOptions[0]?.column || '', aggregate: 'COUNT', alias: '', distinct: false })
          }>
            <Plus size={11} /> Add
          </button>
        </div>
        {aggregateColumns.length === 0 && (
          <div className="agg-empty">No aggregate functions</div>
        )}
        {aggregateColumns.map((agg) => (
          <div key={agg.id} className="agg-row">
            <select
              className="agg-select"
              value={agg.aggregate}
              onChange={(e) => updateAggregateColumn(agg.id, { aggregate: e.target.value })}
            >
              {AGGREGATES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <span className="agg-paren">(</span>
            <select
              className="agg-select agg-col"
              value={agg.column ? `${nodes.find((n) => n.id === agg.nodeId)?.data.alias || nodes.find((n) => n.id === agg.nodeId)?.data.tableName}.${agg.column}` : ''}
              onChange={(e) => {
                const opt = columnOptions.find((o) => o.label === e.target.value);
                if (opt) {
                  const node = nodes.find((n) => (n.data.alias || n.data.tableName) === opt.table);
                  updateAggregateColumn(agg.id, { column: opt.column, nodeId: node?.id });
                }
              }}
            >
              <option value="">Column…</option>
              {columnOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
            <span className="agg-paren">)</span>
            <span className="agg-as">AS</span>
            <input
              className="agg-alias"
              placeholder="alias"
              value={agg.alias}
              onChange={(e) => updateAggregateColumn(agg.id, { alias: e.target.value })}
            />
            <label className="agg-distinct-label">
              <input
                type="checkbox"
                checked={agg.distinct}
                onChange={(e) => updateAggregateColumn(agg.id, { distinct: e.target.checked })}
              />
              DISTINCT
            </label>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeAggregateColumn(agg.id)}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* ── GROUP BY ──────────────────────────────────── */}
      <div className="agg-section">
        <div className="agg-section-header">
          <span>GROUP BY</span>
          <button className="btn btn-ghost btn-sm" id="add-groupby-btn" onClick={addGroupBy}>
            <Plus size={11} /> Add
          </button>
        </div>
        {groupBy.map((g, i) => (
          <div key={i} className="agg-row">
            <select
              className="agg-select agg-col"
              value={`${g.table}.${g.column}`}
              onChange={(e) => updateGroupBy(i, e.target.value)}
            >
              {columnOptions.map((o) => <option key={o.label} value={o.label}>{o.label}</option>)}
            </select>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeGroupBy(i)}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {groupBy.length === 0 && <div className="agg-empty">No GROUP BY columns</div>}

        {/* ONLY_FULL_GROUP_BY warning */}
        {compat && !compat.onlyFullGroupBy && groupBy.length > 0 && (
          <div className="warning-chip" style={{ marginTop: 8 }}>
            ⚠️ MySQL {compat.tier} uses permissive GROUP BY — non-aggregated columns may return non-deterministic values
          </div>
        )}
      </div>

      {/* ── ORDER BY ──────────────────────────────────── */}
      <div className="agg-section">
        <div className="agg-section-header">
          <span>ORDER BY</span>
          <button className="btn btn-ghost btn-sm" id="add-orderby-btn" onClick={addOrderBy}>
            <Plus size={11} /> Add
          </button>
        </div>
        {orderBy.map((o, i) => (
          <div key={i} className="agg-row">
            <select
              className="agg-select agg-col"
              value={`${o.table}.${o.column}`}
              onChange={(e) => updateOrderBy(i, { label: e.target.value })}
            >
              {columnOptions.map((opt) => <option key={opt.label} value={opt.label}>{opt.label}</option>)}
            </select>
            <div className="dir-toggle">
              <button
                className={`dir-btn ${o.direction === 'ASC' ? 'active' : ''}`}
                onClick={() => updateOrderBy(i, { direction: 'ASC' })}
              >ASC</button>
              <button
                className={`dir-btn ${o.direction === 'DESC' ? 'active' : ''}`}
                onClick={() => updateOrderBy(i, { direction: 'DESC' })}
              >DESC</button>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeOrderBy(i)}>
              <Trash2 size={11} />
            </button>
          </div>
        ))}
        {orderBy.length === 0 && <div className="agg-empty">No ORDER BY columns</div>}
      </div>

      {/* ── LIMIT ──────────────────────────────────────── */}
      <div className="agg-section">
        <div className="agg-section-header">
          <span><ArrowUpDown size={11} /> Row Limit</span>
        </div>
        <div className="limit-row">
          <input
            type="number"
            min="1"
            max="10000"
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10) || 100)}
            className="limit-input"
            id="limit-input"
          />
          <span className="agg-empty" style={{ padding: 0 }}>rows max</span>
        </div>
      </div>
    </div>
  );
}
