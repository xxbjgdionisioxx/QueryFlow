/**
 * designerStore.js — Zustand store for the Database Designer
 * 
 * Handles state for visual database schema design:
 *   - Tables (nodes)
 *   - Relationships (edges / foreign keys)
 *   - Pending DDL changes
 */

import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { randomUUID } from '../utils/id';
import api from '../services/api';

const EDGE_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#14b8a6'
];

export const useDesignerStore = create((set, get) => ({
  nodes: [],
  edges: [],
  
  isLoading: false,
  error: null,
  
  // ── React Flow Handlers ────────────────────────────────────────────────────
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  
  onNodesChange: (changes) => set({
    nodes: applyNodeChanges(changes, get().nodes),
  }),
  onEdgesChange: (changes) => set({
    edges: applyEdgeChanges(changes, get().edges),
  }),
  
  // ── Designer Actions ───────────────────────────────────────────────────────
  
  /**
   * Reverse Engineer: Load existing schema into nodes and edges
   */
  reverseEngineer: (schema) => {
    const nodes = [];
    const edges = [];
    
    schema.forEach((table, index) => {
      const nodeId = `node-${table.tableName}`;
      nodes.push({
        id: nodeId,
        type: 'designerTable',
        position: { x: 100 + (index % 4) * 450, y: 100 + Math.floor(index / 4) * 600 },
        data: {
          tableName: table.tableName,
          columns: table.columns.map(c => ({ ...c })),
          foreignKeys: table.foreignKeys || []
        }
      });
      
      // Add edges for foreign keys
      (table.foreignKeys || []).forEach((fk, fkIdx) => {
        const color = EDGE_COLORS[(index + fkIdx) % EDGE_COLORS.length];
        edges.push({
          id: `edge-${fk.constraintName}`,
          source: `node-${fk.tableName}`,
          target: `node-${fk.referencedTable}`,
          sourceHandle: `col-${fk.columnName}-right`,
          targetHandle: `col-${fk.referencedColumn}-left`,
          type: 'designerEdge',
          animated: true,
          markerEnd: {
            type: 'arrowclosed',
            width: 20,
            height: 20,
            color,
          },
          style: { stroke: color, strokeWidth: 2 },
          data: {
            constraintName: fk.constraintName,
            columnName: fk.columnName,
            referencedColumn: fk.referencedColumn
          }
        });
      });
    });
    
    set({ nodes, edges });
  },

  addTable: (tableName, position = { x: 100, y: 100 }) => {
    const id = `node-${tableName}-${randomUUID().slice(0, 4)}`;
    const newNode = {
      id,
      type: 'designerTable',
      position,
      data: {
        tableName,
        columns: [
          { columnName: 'id', dataType: 'int', columnType: 'int(11)', isNullable: 'NO', columnKey: 'PRI', columnDefault: null, extra: 'auto_increment' }
        ],
        foreignKeys: []
      }
    };
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    return id;
  },

  updateTable: (nodeId, updates) => {
    set((state) => ({
      nodes: state.nodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)
    }));
  },

  removeTable: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.filter(n => n.id !== nodeId),
      edges: state.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));
  },
  addRelationship: (params) => {
    const { source, target, sourceHandle, targetHandle } = params;
    const sourceNode = get().nodes.find(n => n.id === source);
    const targetNode = get().nodes.find(n => n.id === target);
    
    if (!sourceNode || !targetNode) return;
    
    const sourceCol = sourceHandle.replace('col-', '').replace('-right', '').replace('-left', '');
    const targetCol = targetHandle.replace('col-', '').replace('-right', '').replace('-left', '');
    
    const constraintName = `fk_${sourceNode.data.tableName}_${sourceCol}`;
    const color = EDGE_COLORS[get().edges.length % EDGE_COLORS.length];
    
    const newEdge = {
      id: `edge-${constraintName}`,
      source,
      target,
      sourceHandle,
      targetHandle,
      type: 'designerEdge',
      animated: true,
      markerEnd: {
        type: 'arrowclosed',
        width: 20,
        height: 20,
        color,
      },
      style: { stroke: color, strokeWidth: 2 },
      data: {
        constraintName,
        columnName: sourceCol,
        referencedTable: targetNode.data.tableName,
        referencedColumn: targetCol
      }
    };
    
    set((state) => ({ edges: [...state.edges, newEdge] }));
  },

  addColumn: (nodeId) => {
    set((state) => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const newColName = `column_${n.data.columns.length + 1}`;
        return {
          ...n,
          data: {
            ...n.data,
            columns: [
              ...n.data.columns,
              { columnName: newColName, dataType: 'varchar', columnType: 'varchar(255)', isNullable: 'YES', columnKey: '', columnDefault: null, extra: '' }
            ]
          }
        };
      })
    }));
  },

  updateColumn: (nodeId, columnIndex, updates) => {
    set((state) => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const columns = [...n.data.columns];
        columns[columnIndex] = { ...columns[columnIndex], ...updates };
        return { ...n, data: { ...n.data, columns } };
      })
    }));
  },

  removeColumn: (nodeId, columnIndex) => {
    set((state) => ({
      nodes: state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const columns = n.data.columns.filter((_, i) => i !== columnIndex);
        return { ...n, data: { ...n.data, columns } };
      })
    }));
  },

  // ── Layout Persistence ─────────────────────────────────────────────────────
  
  saveLayout: async () => {
    const { nodes, edges } = get();
    const layout = {
      nodes: nodes.map(n => ({ id: n.id, position: n.position, tableName: n.data.tableName })),
      edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
    };
    
    try {
      await api.post('/designer/layout', { layout });
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  },

  loadLayout: async (schema) => {
    try {
      const { data } = await api.get('/designer/layout');
      if (!data.layout) {
        get().reverseEngineer(schema);
        return;
      }
      
      const { layout } = data;
      const nodes = [];
      const edges = [];
      
      // Map layout to current schema
      schema.forEach((table, index) => {
        const savedNode = layout.nodes.find(n => n.tableName === table.tableName);
        const nodeId = savedNode ? savedNode.id : `node-${table.tableName}`;
        const position = savedNode ? savedNode.position : { x: 100 + (index % 4) * 450, y: 100 + Math.floor(index / 4) * 600 };
        
        nodes.push({
          id: nodeId,
          type: 'designerTable',
          position,
          data: {
            tableName: table.tableName,
            columns: table.columns.map(c => ({ ...c })),
            foreignKeys: table.foreignKeys || []
          }
        });
      });
      
      // Reconstruct edges from schema (since they are the source of truth for FKs)
      schema.forEach((table, index) => {
        (table.foreignKeys || []).forEach((fk, fkIdx) => {
          const color = EDGE_COLORS[(index + fkIdx) % EDGE_COLORS.length];
          edges.push({
            id: `edge-${fk.constraintName}`,
            source: nodes.find(n => n.data.tableName === fk.tableName)?.id,
            target: nodes.find(n => n.data.tableName === fk.referencedTable)?.id,
            sourceHandle: `col-${fk.columnName}-right`,
            targetHandle: `col-${fk.referencedColumn}-left`,
            type: 'designerEdge',
            animated: true,
            markerEnd: {
              type: 'arrowclosed',
              width: 20,
              height: 20,
              color,
            },
            style: { stroke: color, strokeWidth: 2 },
            data: {
              constraintName: fk.constraintName,
              columnName: fk.columnName,
              referencedColumn: fk.referencedColumn
            }
          });
        });
      });
      
      set({ nodes, edges });
    } catch (err) {
      console.error('Failed to load layout:', err);
      get().reverseEngineer(schema);
    }
  },

  // ── SQL Generation ─────────────────────────────────────────────────────────
  
  generateSQL: () => {
    const { nodes } = get();
    let sql = '-- Generated by QueryFlow Designer\n\n';
    
    nodes.forEach(node => {
      const { tableName, columns } = node.data;
      sql += `CREATE TABLE IF NOT EXISTS \`${tableName}\` (\n`;
      
      const colDefs = columns.map(col => {
        let def = `  \`${col.columnName}\` ${col.columnType}`;
        if (col.isNullable === 'NO') def += ' NOT NULL';
        if (col.columnDefault !== null) def += ` DEFAULT ${typeof col.columnDefault === 'string' ? `'${col.columnDefault}'` : col.columnDefault}`;
        if (col.extra === 'auto_increment') def += ' AUTO_INCREMENT';
        return def;
      });
      
      // PK
      const pks = columns.filter(c => c.columnKey === 'PRI').map(c => `\`${c.columnName}\``);
      if (pks.length > 0) {
        colDefs.push(`  PRIMARY KEY (${pks.join(', ')})`);
      }
      
      sql += colDefs.join(',\n');
      sql += `\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n\n`;
    });
    
    return sql;
  },
  
  // ── SQL Import ────────────────────────────────────────────────────────────
  
  importFromSQL: (sqlString, schema) => {
    // Strip backticks and quotes to make parsing easier
    const sql = sqlString.replace(/[`"]/g, '');
    
    // Basic extraction logic
    const tables = new Set();
    const joins = [];
    
    // 1. Extract tables (FROM and JOIN)
    const tableRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+(?:AS\s+)?([a-zA-Z0-9_]+))?/gi;
    let match;
    const aliases = {}; // alias -> tableName
    
    while ((match = tableRegex.exec(sql)) !== null) {
      const tableName = match[1];
      const alias = match[2] || tableName;
      tables.add(tableName);
      aliases[alias] = tableName;
    }
    
    // 2. Extract join conditions (ON col1 = col2)
    // Supports: ON table.col = table.col, ON alias.col = alias.col, etc.
    const joinRegex = /ON\s+([a-zA-Z0-9_.]+)\s*=\s*([a-zA-Z0-9_.]+)/gi;
    while ((match = joinRegex.exec(sql)) !== null) {
      joins.push([match[1], match[2]]);
    }
    
    // 3. Extract subqueries or standalone tables
    const fromRegex = /FROM\s+([a-zA-Z0-9_]+)/gi;
    while ((match = fromRegex.exec(sql)) !== null) {
      tables.add(match[1]);
    }

    if (tables.size === 0) return false;

    // 4. Create nodes for identified tables
    const newNodes = [];
    const tableList = Array.from(tables);
    const existingNodeIds = new Set();
    
    tableList.forEach((tableName, index) => {
      // Find table info in existing schema if possible
      const tableInfo = schema.find(t => t.tableName.toLowerCase() === tableName.toLowerCase());
      if (!tableInfo) return;

      const nodeId = `node-${tableInfo.tableName}`;
      existingNodeIds.add(nodeId);
      newNodes.push({
        id: nodeId,
        type: 'designerTable',
        position: { x: 100 + (index % 4) * 450, y: 100 + Math.floor(index / 4) * 600 },
        data: {
          tableName: tableInfo.tableName,
          columns: tableInfo.columns.map(c => ({ ...c })),
          foreignKeys: tableInfo.foreignKeys || []
        }
      });
    });

    // 5. Create edges for identified joins
    const newEdges = [];
    joins.forEach(([left, right], idx) => {
      // Remove backticks/quotes from column names if captured
      const cleanLeft = left.replace(/[`"]/g, '');
      const cleanRight = right.replace(/[`"]/g, '');

      const leftParts = cleanLeft.split('.');
      const rightParts = cleanRight.split('.');

      const leftTableRef = leftParts.length > 1 ? leftParts[0] : null;
      const leftCol = leftParts.length > 1 ? leftParts[1] : leftParts[0];

      const rightTableRef = rightParts.length > 1 ? rightParts[0] : null;
      const rightCol = rightParts.length > 1 ? rightParts[1] : rightParts[0];
      
      const leftTable = leftTableRef ? (aliases[leftTableRef] || leftTableRef) : null;
      const rightTable = rightTableRef ? (aliases[rightTableRef] || rightTableRef) : null;
      
      if (leftTable && rightTable) {
        const sourceId = `node-${leftTable}`;
        const targetId = `node-${rightTable}`;

        // Verify both nodes exist in our newNodes set
        if (newNodes.some(n => n.data.tableName.toLowerCase() === leftTable.toLowerCase()) && 
            newNodes.some(n => n.data.tableName.toLowerCase() === rightTable.toLowerCase())) {
          
          const color = EDGE_COLORS[idx % EDGE_COLORS.length];
          newEdges.push({
            id: `edge-import-${idx}-${randomUUID().slice(0, 4)}`,
            source: sourceId,
            target: targetId,
            sourceHandle: `col-${leftCol}-right`,
            targetHandle: `col-${rightCol}-left`,
            type: 'designerEdge',
            animated: true,
            markerEnd: { type: 'arrowclosed', width: 20, height: 20, color },
            style: { stroke: color, strokeWidth: 2 },
            data: { columnName: leftCol, referencedColumn: rightCol }
          });
        }
      }
    });

    set({ nodes: newNodes, edges: newEdges });
    return true;
  },
  
  executeSQL: async (sql) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/designer/execute', { sql });
      set({ isLoading: false });
      return true;
    } catch (err) {
      set({ isLoading: false, error: err.response?.data?.error || 'Execution failed' });
      return false;
    }
  }
}));
