/**
 * queryStore.js — Zustand store for the visual query builder state
 *
 * This is the central state for everything the user builds on the canvas:
 *   - Tables dropped onto the canvas (React Flow nodes)
 *   - JOIN edges between table nodes
 *   - Selected columns per table
 *   - Filter conditions (WHERE)
 *   - Aggregation settings (GROUP BY, ORDER BY)
 *   - Query execution results
 */

import { create } from 'zustand';
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react';
import { randomUUID } from '../utils/id';
import api from '../services/api';

export const useQueryStore = create((set, get) => ({
  // ── Canvas nodes (tables) ──────────────────────────────────────────────────
  // Each node: { id, type, position, data: { tableName, columns, alias } }
  nodes: [],

  // ── Edges (JOINs) ─────────────────────────────────────────────────────────
  // Each edge: { id, source, target, data: { joinType, fromColumn, toColumn } }
  edges: [],

  // ── Selected columns per tableNode ────────────────────────────────────────
  // Map: nodeId → string[] (column names selected for SELECT)
  selectedColumns: {},

  // ── Aggregate column definitions ──────────────────────────────────────────
  // Array of { nodeId, column, aggregate, alias, distinct }
  aggregateColumns: [],

  // ── Filters ───────────────────────────────────────────────────────────────
  // Root FilterGroup (same schema as backend filterBuilder)
  filters: { type: 'group', logic: 'AND', children: [] },

  // ── Aggregation ───────────────────────────────────────────────────────────
  groupBy:  [],  // [{ nodeId, table, column }]
  orderBy:  [],  // [{ nodeId, table, column, direction }]
  limit:    100,
  offset:   0,

  // ── Execution results ─────────────────────────────────────────────────────
  results:       null,
  resultColumns: [],
  generatedSql:  '',
  sqlWarnings:   [],
  pagination:    { page: 1, pageSize: 100, totalRows: null, totalPages: null },
  isExecuting:   false,
  executeError:  null,

  // ── Schema (fetched from backend) ─────────────────────────────────────────
  schema:         [],
  isLoadingSchema: false,
  schemaError:    null,

  // ────────────────────────────────────────────────────────────────────────────
  // Node / Edge Actions (React Flow callbacks)
  // ────────────────────────────────────────────────────────────────────────────

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  onNodesChange: (changes) => set({
    nodes: applyNodeChanges(changes, get().nodes),
  }),
  onEdgesChange: (changes) => set({
    edges: applyEdgeChanges(changes, get().edges),
  }),

  /**
   * Add a table to the canvas from a schema drop.
   * @param {object} tableSchema  - schema item from GET /api/schema
   * @param {{ x: number, y: number }} position
   */
  addTableNode: (tableSchema, position) => {
    const id = randomUUID();
    const node = {
      id,
      type: 'tableNode',
      position,
      data: {
        tableName: tableSchema.tableName,
        columns:   tableSchema.columns,
        alias:     null,
      },
    };
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedColumns: { ...state.selectedColumns, [id]: [] },
    }));
    return id;
  },

  /** Remove a table node and all its connected edges */
  removeTableNode: (nodeId) => {
    set((state) => {
      const newSelected = { ...state.selectedColumns };
      delete newSelected[nodeId];
      return {
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
        selectedColumns: newSelected,
        groupBy: state.groupBy.filter((g) => g.nodeId !== nodeId),
        orderBy: state.orderBy.filter((o) => o.nodeId !== nodeId),
        aggregateColumns: state.aggregateColumns.filter((a) => a.nodeId !== nodeId),
      };
    });
  },

  /** Set alias for a table node */
  setTableAlias: (nodeId, alias) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, alias } } : n
      ),
    }));
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Column selection
  // ────────────────────────────────────────────────────────────────────────────

  toggleColumn: (nodeId, columnName) => {
    set((state) => {
      const current = state.selectedColumns[nodeId] ?? [];
      const next = current.includes(columnName)
        ? current.filter((c) => c !== columnName)
        : [...current, columnName];
      return { selectedColumns: { ...state.selectedColumns, [nodeId]: next } };
    });
  },

  selectAllColumns: (nodeId) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const all = node.data.columns.map((c) => c.columnName);
    set((state) => ({
      selectedColumns: { ...state.selectedColumns, [nodeId]: all },
    }));
  },

  clearColumnSelection: (nodeId) => {
    set((state) => ({
      selectedColumns: { ...state.selectedColumns, [nodeId]: [] },
    }));
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Aggregate columns
  // ────────────────────────────────────────────────────────────────────────────

  addAggregateColumn: (def) => {
    set((state) => ({
      aggregateColumns: [...state.aggregateColumns, { id: randomUUID(), ...def }],
    }));
  },

  removeAggregateColumn: (id) => {
    set((state) => ({
      aggregateColumns: state.aggregateColumns.filter((a) => a.id !== id),
    }));
  },

  updateAggregateColumn: (id, updates) => {
    set((state) => ({
      aggregateColumns: state.aggregateColumns.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    }));
  },

  // ────────────────────────────────────────────────────────────────────────────
  // JOIN edges
  // ────────────────────────────────────────────────────────────────────────────

  updateEdgeJoin: (edgeId, updates) => {
    set((state) => ({
      edges: state.edges.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, ...updates } } : e
      ),
    }));
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Filters
  // ────────────────────────────────────────────────────────────────────────────

  setFilters: (filters) => set({ filters }),

  addFilterCondition: (parentPath = []) => {
    const newCondition = {
      id: randomUUID(),
      type: 'condition',
      table: '', column: '', operator: '=', value: '',
    };
    set((state) => ({
      filters: addToGroup(state.filters, parentPath, newCondition),
    }));
  },

  addFilterGroup: (parentPath = []) => {
    const newGroup = {
      id: randomUUID(),
      type: 'group', logic: 'AND', children: [],
    };
    set((state) => ({
      filters: addToGroup(state.filters, parentPath, newGroup),
    }));
  },

  updateFilterNode: (path, updates) => {
    set((state) => ({
      filters: updateAtPath(state.filters, path, updates),
    }));
  },

  removeFilterNode: (path) => {
    set((state) => ({
      filters: removeAtPath(state.filters, path),
    }));
  },

  clearFilters: () => set({ filters: { type: 'group', logic: 'AND', children: [] } }),

  // ────────────────────────────────────────────────────────────────────────────
  // Aggregation
  // ────────────────────────────────────────────────────────────────────────────

  setGroupBy: (groupBy) => set({ groupBy }),
  setOrderBy: (orderBy) => set({ orderBy }),
  setLimit:   (limit)   => set({ limit }),

  // ────────────────────────────────────────────────────────────────────────────
  // Schema loading
  // ────────────────────────────────────────────────────────────────────────────

  loadSchema: async () => {
    set({ isLoadingSchema: true, schemaError: null });
    try {
      const { data } = await api.get('/schema');
      set({ schema: data.schema, isLoadingSchema: false });
    } catch (err) {
      set({
        isLoadingSchema: false,
        schemaError: err.response?.data?.error || 'Failed to load schema',
      });
    }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Query execution
  // ────────────────────────────────────────────────────────────────────────────

  executeQuery: async (page = 1, pageSize = 100) => {
    set({ isExecuting: true, executeError: null });
    try {
      const queryDef = get().buildQueryDef();
      const { data } = await api.post('/execute', { queryDef, page, pageSize });

      set({
        isExecuting:   false,
        results:       data.rows,
        resultColumns: data.columns,
        generatedSql:  data.sql,
        sqlWarnings:   data.warnings || [],
        pagination:    { ...data.pagination, page },
      });
    } catch (err) {
      const respData = err.response?.data;
      const errorMsg = respData?.details?.length
        ? `${respData.error}: ${respData.details.join(', ')}`
        : respData?.error || 'Query execution failed';

      set({
        isExecuting:  false,
        executeError: errorMsg,
      });
    }
  },

  /**
   * Build the JSON query definition from current canvas state.
   * This is sent to POST /api/execute and also used for live SQL preview.
   */
  buildQueryDef: () => {
    const { nodes, edges, selectedColumns, aggregateColumns, filters, groupBy, orderBy, limit } = get();

    if (nodes.length === 0) return null;

    const primaryNode = nodes[0];
    const primaryTable = {
      name:  primaryNode.data.tableName,
      alias: primaryNode.data.alias || primaryNode.data.tableName,
    };

    // Build SELECT columns list
    const columns = [];

    nodes.forEach((node) => {
      const alias = node.data.alias || node.data.tableName;
      const selected = selectedColumns[node.id] ?? [];
      selected.forEach((colName) => {
        columns.push({ table: alias, column: colName });
      });
    });

    // Add aggregate columns
    aggregateColumns.forEach((ac) => {
      const node = nodes.find((n) => n.id === ac.nodeId);
      if (!node) return;
      const alias = node.data.alias || node.data.tableName;
      columns.push({
        table:     alias,
        column:    ac.column,
        aggregate: ac.aggregate,
        alias:     ac.alias || null,
        distinct:  ac.distinct || false,
      });
    });

    // Build JOIN definitions using a graph traversal from primaryNode
    const joins = [];
    const joinedNodeIds = new Set([primaryNode.id]);
    const remainingEdges = [...edges];

    let progress = true;
    while (remainingEdges.length > 0 && progress) {
      progress = false;
      for (let i = 0; i < remainingEdges.length; i++) {
        const edge = remainingEdges[i];
        const hasSource = joinedNodeIds.has(edge.source);
        const hasTarget = joinedNodeIds.has(edge.target);

        if (hasSource && !hasTarget) {
          // Traversal direction matches edge direction
          const fromNode = nodes.find((n) => n.id === edge.source);
          const toNode   = nodes.find((n) => n.id === edge.target);
          if (fromNode && toNode) {
            joins.push({
              type:       edge.data?.joinType || 'INNER',
              fromTable:  fromNode.data.tableName,
              fromAlias:  fromNode.data.alias || fromNode.data.tableName,
              fromColumn: edge.data?.fromColumn || '',
              toTable:    toNode.data.tableName,
              toAlias:    toNode.data.alias || toNode.data.tableName,
              toColumn:   edge.data?.toColumn || '',
            });
            joinedNodeIds.add(edge.target);
            progress = true;
          }
          remainingEdges.splice(i, 1);
          i--;
        } else if (!hasSource && hasTarget) {
          // Traversal direction is opposite to edge direction
          const fromNode = nodes.find((n) => n.id === edge.target);
          const toNode   = nodes.find((n) => n.id === edge.source);
          if (fromNode && toNode) {
            // Swap LEFT and RIGHT joins to preserve semantics when traversed backwards
            let reversedType = edge.data?.joinType || 'INNER';
            if (reversedType === 'LEFT') reversedType = 'RIGHT';
            else if (reversedType === 'RIGHT') reversedType = 'LEFT';

            joins.push({
              type:       reversedType,
              fromTable:  fromNode.data.tableName,
              fromAlias:  fromNode.data.alias || fromNode.data.tableName,
              fromColumn: edge.data?.toColumn || '',    // Swap columns!
              toTable:    toNode.data.tableName,
              toAlias:    toNode.data.alias || toNode.data.tableName,
              toColumn:   edge.data?.fromColumn || '',  // Swap columns!
            });
            joinedNodeIds.add(edge.source);
            progress = true;
          }
          remainingEdges.splice(i, 1);
          i--;
        } else if (hasSource && hasTarget) {
          // Both nodes are already in the join tree (creates a cycle/extra condition)
          // For simplicity in this builder, we ignore circular joins. 
          // Advanced builders would add this as an AND to the WHERE clause.
          remainingEdges.splice(i, 1);
          i--;
        }
      }
    }

    return {
      primaryTable,
      columns,
      joins,
      filters: filters.children.length > 0 ? filters : null,
      groupBy: groupBy.map(({ table, column }) => ({ table, column })),
      orderBy: orderBy.map(({ table, column, direction }) => ({ table, column, direction })),
      limit,
      offset: 0,
    };
  },

  // Reset everything
  resetCanvas: () => set({
    nodes: [], edges: [], selectedColumns: {}, aggregateColumns: [],
    filters: { type: 'group', logic: 'AND', children: [] },
    groupBy: [], orderBy: [], limit: 100,
    results: null, resultColumns: [], generatedSql: '', sqlWarnings: [],
    pagination: { page: 1, pageSize: 100, totalRows: null, totalPages: null },
    executeError: null,
  }),
}));

// ── Immutable filter tree helpers ─────────────────────────────────────────────

function addToGroup(root, path, newItem) {
  if (path.length === 0) {
    return { ...root, children: [...(root.children || []), newItem] };
  }
  return {
    ...root,
    children: root.children.map((child, i) =>
      i === path[0] ? addToGroup(child, path.slice(1), newItem) : child
    ),
  };
}

function updateAtPath(root, path, updates) {
  if (path.length === 0) return { ...root, ...updates };
  return {
    ...root,
    children: root.children.map((child, i) =>
      i === path[0] ? updateAtPath(child, path.slice(1), updates) : child
    ),
  };
}

function removeAtPath(root, path) {
  if (path.length === 1) {
    return {
      ...root,
      children: root.children.filter((_, i) => i !== path[0]),
    };
  }
  return {
    ...root,
    children: root.children.map((child, i) =>
      i === path[0] ? removeAtPath(child, path.slice(1)) : child
    ),
  };
}
