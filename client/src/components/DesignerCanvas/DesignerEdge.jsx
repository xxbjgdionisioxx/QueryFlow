import React from 'react';
import { getSmoothStepPath, EdgeText } from '@xyflow/react';

export default function DesignerEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
  selected,
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 12,
  });

  const edgeStyle = {
    ...style,
    strokeWidth: selected ? 3.5 : 2.5,
    transition: 'all 0.2s ease',
    filter: selected 
      ? `drop-shadow(0 0 8px ${style.stroke})` 
      : 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
    cursor: 'pointer',
  };

  return (
    <g className="designer-edge-group">
      {/* Invisible interaction path - makes it much easier to click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      
      {/* Background shadow path for separation */}
      <path
        id={`${id}_bg`}
        style={{ ...edgeStyle, stroke: '#000', strokeWidth: (selected ? 3.5 : 2.5) + 1.5, opacity: 0.2 }}
        className="react-flow__edge-path"
        d={edgePath}
      />
      <path
        id={id}
        style={edgeStyle}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {selected && data?.constraintName && (
        <EdgeText
          x={labelX}
          y={labelY}
          label={data.constraintName}
          labelStyle={{ fill: '#fff', fontWeight: 600, fontSize: 10 }}
          labelShowBg
          labelBgStyle={{ fill: style.stroke, fillOpacity: 0.9 }}
          labelBgPadding={[4, 2]}
          labelBgBorderRadius={4}
        />
      )}
    </g>
  );
}
