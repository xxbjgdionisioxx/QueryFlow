/**
 * JoinEdge.jsx — Custom React Flow edge for JOIN configuration
 *
 * Renders a styled animated edge between two table nodes.
 * Shows a floating label with a JOIN type selector and column matchers.
 * Users click the edge to configure the JOIN type and joining columns.
 */

import React, { useState } from 'react';
import { getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { useQueryStore } from '../../store/queryStore';
import './JoinEdge.css';

const JOIN_TYPES = ['INNER', 'LEFT', 'RIGHT'];

export default function JoinEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data = {}, selected,
}) {
  const { updateEdgeJoin, nodes } = useQueryStore();
  const [open, setOpen] = useState(false);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const joinType    = data.joinType    || 'INNER';
  const fromColumn  = data.fromColumn  || '';
  const toColumn    = data.toColumn    || '';

  // Find source/target node columns for the dropdowns
  const sourceNode = nodes.find((n) => n.id === data.sourceNodeId);
  const targetNode = nodes.find((n) => n.id === data.targetNodeId);
  const sourceCols = sourceNode?.data?.columns ?? [];
  const targetCols = targetNode?.data?.columns ?? [];

  const joinTypeColor = {
    INNER: '#7c6af7',
    LEFT:  '#58a6ff',
    RIGHT: '#3fb950',
  }[joinType];

  return (
    <>
      <BaseEdge
        path={edgePath}
        style={{
          stroke: selected ? joinTypeColor : 'rgba(124,106,247,0.5)',
          strokeWidth: selected ? 2.5 : 1.5,
          strokeDasharray: joinType !== 'INNER' ? '5,3' : undefined,
        }}
      />

      <EdgeLabelRenderer>
        <div
          className={`join-edge-label ${selected ? 'join-edge-label--selected' : ''}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            '--join-color': joinTypeColor,
          }}
          onClick={() => setOpen(!open)}
        >
          <span className="join-type-badge" style={{ background: `${joinTypeColor}22`, color: joinTypeColor }}>
            {joinType}
          </span>

          {open && (
            <div className="join-popover" onClick={(e) => e.stopPropagation()}>
              <div className="join-popover-header">Configure JOIN</div>

              {/* JOIN type */}
              <div className="join-field">
                <label>Type</label>
                <div className="join-type-btns">
                  {JOIN_TYPES.map((t) => (
                    <button
                      key={t}
                      className={`join-type-btn ${joinType === t ? 'active' : ''}`}
                      onClick={() => updateEdgeJoin(id, { joinType: t })}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column matchers */}
              <div className="join-field">
                <label>On</label>
                <div className="join-cols">
                  <select
                    value={fromColumn}
                    onChange={(e) => updateEdgeJoin(id, { fromColumn: e.target.value })}
                    className="join-col-select"
                  >
                    <option value="">Source column…</option>
                    {sourceCols.map((c) => (
                      <option key={c.columnName} value={c.columnName}>{c.columnName}</option>
                    ))}
                  </select>
                  <span className="join-equals">=</span>
                  <select
                    value={toColumn}
                    onChange={(e) => updateEdgeJoin(id, { toColumn: e.target.value })}
                    className="join-col-select"
                  >
                    <option value="">Target column…</option>
                    {targetCols.map((c) => (
                      <option key={c.columnName} value={c.columnName}>{c.columnName}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                className="join-close-btn"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
