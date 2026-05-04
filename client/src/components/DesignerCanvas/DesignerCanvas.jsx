import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  addEdge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import DesignerTableNode from './DesignerTableNode';
import DesignerEdge from './DesignerEdge';
import { useDesignerStore } from '../../store/designerStore';

const nodeTypes = {
  designerTable: DesignerTableNode,
};

const edgeTypes = {
  designerEdge: DesignerEdge,
};

export default function DesignerCanvas() {
  const { 
    nodes, 
    edges, 
    onNodesChange, 
    onEdgesChange, 
    addRelationship 
  } = useDesignerStore();

  const onConnect = useCallback((params) => {
    addRelationship(params);
  }, [addRelationship]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.05)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}
