/**
 * Canvas.jsx — React Flow canvas for the visual query builder
 *
 * Accepts table drops from the sidebar, manages nodes and edges,
 * and delegates JOIN edge configuration to JoinEdge.
 */

import React, { useCallback, useRef } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TableNode from './TableNode';
import JoinEdge  from './JoinEdge';
import { useQueryStore } from '../../store/queryStore';
import { randomUUID } from '../../utils/id';
import './Canvas.css';

// Register custom node and edge types
const nodeTypes = { tableNode: TableNode };
const edgeTypes = { joinEdge: JoinEdge };

export default function Canvas() {
  const {
    nodes, edges, onNodesChange, onEdgesChange,
    setEdges, addTableNode, updateEdgeJoin,
  } = useQueryStore();

  const reactFlowWrapper = useRef(null);

  // Create a new JOIN edge when user connects two handles
  const onConnect = useCallback((params) => {
    const newEdge = {
      ...params,
      id: randomUUID(),
      type: 'joinEdge',
      animated: true,
      data: {
        joinType:     'INNER',
        fromColumn:   '',
        toColumn:     '',
        sourceNodeId: params.source,
        targetNodeId: params.target,
      },
    };
    setEdges(addEdge(newEdge, edges));
  }, [edges, setEdges]);

  // Handle drop from sidebar
  const onDrop = useCallback((event) => {
    event.preventDefault();
    const raw = event.dataTransfer.getData('application/queryflow-table');
    if (!raw) return;

    const tableSchema = JSON.parse(raw);
    const bounds = reactFlowWrapper.current.getBoundingClientRect();

    // Calculate drop position in React Flow coordinate space
    const position = {
      x: event.clientX - bounds.left - 110,
      y: event.clientY - bounds.top  - 80,
    };

    const id = randomUUID();
    const newNode = {
      id,
      type: 'tableNode',
      position,
      data: {
        tableName: tableSchema.tableName,
        columns:   tableSchema.columns,
        alias:     null,
      },
    };

    addTableNode(tableSchema, position);
  }, [addTableNode]);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <div className="canvas-wrapper" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="rgba(124,106,247,0.15)"
          gap={24}
          size={1}
          variant="dots"
        />
        <Controls
          className="rf-controls"
          showInteractive={false}
        />
        <MiniMap
          nodeColor={() => 'rgba(124,106,247,0.4)'}
          maskColor="rgba(13,17,23,0.7)"
          className="rf-minimap"
        />

        {/* Drop hint */}
        {nodes.length === 0 && (
          <Panel position="top-center">
            <div className="canvas-hint">
              Drag tables from the sidebar to start building your query
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}


