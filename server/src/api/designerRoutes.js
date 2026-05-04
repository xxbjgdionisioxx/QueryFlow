/**
 * designerRoutes.js — API endpoints for the Database Designer
 * 
 * Handles layout persistence and DDL execution.
 */

import { Router } from 'express';
import { randomUUID } from 'crypto';
import { getInternalPool } from '../services/internalDb.js';
import * as connSvc from '../services/connectionService.js';
import { requireAuth } from './routes.js';

export const designerRouter = Router();

// ── Middleware: Ensure database connection ───────────────────────────────────
function requireConnection(req, res, next) {
  const session = connSvc.getSession(req.session.id);
  if (!session) {
    return res.status(401).json({ error: 'No active database connection.' });
  }
  next();
}

// ── GET /layout ──────────────────────────────────────────────────────────────
designerRouter.get('/layout', requireAuth, requireConnection, async (req, res, next) => {
  try {
    const session = connSvc.getSession(req.session.id);
    const pool = getInternalPool();

    // Find the connection_id from saved_connections if possible, or use a fallback
    // For now, we'll use the database name as a key if connectionId isn't explicitly known
    const [rows] = await pool.query(
      'SELECT layout_json FROM designer_layouts WHERE user_id = ? AND connection_id = ?',
      [req.session.userId, session.connectionId || session.database]
    );

    if (rows.length === 0) {
      return res.json({ layout: null });
    }

    res.json({ layout: JSON.parse(rows[0].layout_json) });
  } catch (err) {
    next(err);
  }
});

// ── POST /layout ─────────────────────────────────────────────────────────────
designerRouter.post('/layout', requireAuth, requireConnection, async (req, res, next) => {
  try {
    const { layout } = req.body;
    const session = connSvc.getSession(req.session.id);
    const pool = getInternalPool();
    const connectionId = session.connectionId || session.database;

    const [existing] = await pool.query(
      'SELECT id FROM designer_layouts WHERE user_id = ? AND connection_id = ?',
      [req.session.userId, connectionId]
    );

    if (existing.length > 0) {
      await pool.query(
        'UPDATE designer_layouts SET layout_json = ? WHERE id = ?',
        [JSON.stringify(layout), existing[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO designer_layouts (id, user_id, connection_id, layout_json) VALUES (?, ?, ?, ?)',
        [randomUUID(), req.session.userId, connectionId, JSON.stringify(layout)]
      );
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── POST /execute ────────────────────────────────────────────────────────────
designerRouter.post('/execute', requireAuth, requireConnection, async (req, res, next) => {
  try {
    const { sql } = req.body;
    if (!sql) return res.status(400).json({ error: 'SQL query required' });

    // Multi-statement support might be needed for some DDL, but we'll execute one by one
    // or as a single block if the driver supports it.
    // WARNING: Execute with caution. DDL is destructive.
    
    // Split by semicolon and filter empty
    const queries = sql.split(';').map(q => q.trim()).filter(q => q.length > 0);
    
    const results = [];
    for (const query of queries) {
      await connSvc.query(req.session.id, query);
      results.push({ query, status: 'success' });
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
