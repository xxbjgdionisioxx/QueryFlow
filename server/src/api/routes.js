/**
 * routes.js — All Express API route definitions
 *
 * Endpoints:
 *   POST   /api/connect      — Connect to MySQL, detect version
 *   DELETE /api/disconnect   — End the current session connection
 *   GET    /api/version      — Get version + compatibility map
 *   GET    /api/schema       — Get full schema (tables + columns)
 *   POST   /api/execute      — Build + execute a query from JSON definition
 *   GET    /api/templates    — List saved query templates
 *   POST   /api/templates    — Save a named template
 *   DELETE /api/templates/:id — Delete a template
 *
 * Security:
 *   - Credentials are never echoed back in responses
 *   - All query execution uses parameterized queries
 *   - Session validation on every protected endpoint
 */

import { Router }        from 'express';
import { randomUUID }    from 'crypto';
import * as connSvc      from '../services/connectionService.js';
import { getSchema }     from '../services/schemaService.js';
import { buildQuery, validateQueryDef } from '../queryBuilder/index.js';
import { getInternalPool } from '../services/internalDb.js';
import { encrypt, decrypt } from '../utils/encryption.js';

export const router = Router();

// ── Middleware ───────────────────────────────────────────────────────────────

export function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireConnection(req, res, next) {
  const session = connSvc.getSession(req.session.id);
  if (!session) {
    return res.status(401).json({
      error: 'No active database connection. Please connect first.',
    });
  }
  next();
}

// ── POST /connect ─────────────────────────────────────────────────────────────

router.post('/connect', async (req, res, next) => {
  try {
    const { host, port, user, password, database } = req.body;

    // Basic input validation
    if (!user || !database) {
      return res.status(400).json({ error: 'user and database are required fields.' });
    }

    const result = await connSvc.connect(req.session.id, {
      host:     host     || 'localhost',
      port:     port     || 3306,
      user,
      password: password || '',
      database,
    });

    // Store a minimal connection marker in the session (NOT the password)
    req.session.connected = true;
    req.session.database  = database;

    res.json({
      connected:     true,
      database,
      versionString: result.versionString,
      version:       result.version,
      compat:        result.compat,
    });
  } catch (err) {
    // Sanitize: never leak credential data in error messages
    const message = sanitizeConnectionError(err.message);
    res.status(400).json({ error: message });
  }
});

// ── POST /connect/saved ───────────────────────────────────────────────────────

router.post('/connect/saved', requireAuth, async (req, res, next) => {
  try {
    const { connectionId } = req.body;
    if (!connectionId) return res.status(400).json({ error: 'connectionId required' });

    const pool = getInternalPool();
    const [connections] = await pool.query(
      'SELECT * FROM saved_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.session.userId]
    );

    if (connections.length === 0) {
      return res.status(404).json({ error: 'Saved connection not found.' });
    }

    const conn = connections[0];
    const password = decrypt(conn.password_encrypted);

    const result = await connSvc.connect(req.session.id, {
      host:     conn.host,
      port:     conn.port,
      user:     conn.username,
      password: password,
      database: conn.database_name,
    });

    req.session.connected = true;
    req.session.database  = conn.database_name;

    res.json({
      connected:     true,
      database:      conn.database_name,
      versionString: result.versionString,
      version:       result.version,
      compat:        result.compat,
    });
  } catch (err) {
    const message = sanitizeConnectionError(err.message);
    res.status(400).json({ error: message });
  }
});

// ── Saved Connections CRUD ────────────────────────────────────────────────────

router.get('/connections', requireAuth, async (req, res, next) => {
  try {
    const pool = getInternalPool();
    const [rows] = await pool.query(
      'SELECT id, name, host, port, username, database_name, created_at FROM saved_connections WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.userId]
    );
    res.json({ connections: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/connections', requireAuth, async (req, res, next) => {
  try {
    const { name, host, port, user, password, database } = req.body;
    if (!name || !host || !user || !database) {
      return res.status(400).json({ error: 'Missing required connection fields.' });
    }

    const id = randomUUID();
    const password_encrypted = encrypt(password || '');

    const pool = getInternalPool();
    await pool.query(
      `INSERT INTO saved_connections 
       (id, user_id, name, host, port, username, password_encrypted, database_name) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.session.userId, name, host, port || 3306, user, password_encrypted, database]
    );

    res.status(201).json({ id, name, host, port, user, database });
  } catch (err) {
    next(err);
  }
});

router.delete('/connections/:id', requireAuth, async (req, res, next) => {
  try {
    const pool = getInternalPool();
    await pool.query('DELETE FROM saved_connections WHERE id = ? AND user_id = ?', [req.params.id, req.session.userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── DELETE /disconnect ────────────────────────────────────────────────────────

router.delete('/disconnect', async (req, res) => {
  await connSvc.disconnect(req.session.id);
  req.session.connected = false;
  res.json({ disconnected: true });
});

// ── GET /version ──────────────────────────────────────────────────────────────

router.get('/version', requireConnection, (req, res) => {
  const session = connSvc.getSession(req.session.id);
  res.json({
    versionString: session.versionString,
    version:       session.version,
    compat:        session.compat,
  });
});

// ── GET /schema ───────────────────────────────────────────────────────────────

router.get('/schema', requireConnection, async (req, res, next) => {
  try {
    const includeViews = req.query.views === 'true';
    const schema = await getSchema(req.session.id, { includeViews });
    res.json({ schema });
  } catch (err) {
    next(err);
  }
});

// ── POST /execute ─────────────────────────────────────────────────────────────

router.post('/execute', requireConnection, async (req, res, next) => {
  try {
    const { queryDef, page = 1, pageSize = 100 } = req.body;

    // Validate the query definition structure
    const errors = validateQueryDef(queryDef);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Invalid query definition', details: errors });
    }

    // Pagination: inject LIMIT/OFFSET (override user-specified if needed)
    const safePageSize = Math.min(Math.max(1, parseInt(pageSize, 10)), 1000);
    const safeOffset   = (Math.max(1, parseInt(page, 10)) - 1) * safePageSize;

    const queryDefWithPaging = {
      ...queryDef,
      limit:  safePageSize,
      offset: safeOffset,
    };

    // Get version compat for this session
    const session = connSvc.getSession(req.session.id);

    // Build SQL using the version-appropriate query builder
    const { sql, params, warnings } = buildQuery(queryDefWithPaging, session.compat);

    // Execute the parameterized query
    const startTime = Date.now();
    let rows, fields;
    try {
      [rows, fields] = await connSvc.query(req.session.id, sql, params);
      
      // Log success
      if (req.session.userId) {
        const pool = getInternalPool();
        pool.query(
          'INSERT INTO query_logs (user_id, query_text, execution_time_ms, status) VALUES (?, ?, ?, ?)',
          [req.session.userId, sql, Date.now() - startTime, 'success']
        ).catch(e => console.error('[LOG] Query log failed:', e.message));
      }
    } catch (err) {
      // Log error
      if (req.session.userId) {
        const pool = getInternalPool();
        pool.query(
          'INSERT INTO query_logs (user_id, query_text, execution_time_ms, status, error_message) VALUES (?, ?, ?, ?, ?)',
          [req.session.userId, sql, Date.now() - startTime, 'error', err.message]
        ).catch(e => console.error('[LOG] Query log failed:', e.message));
      }
      throw err;
    }

    // Build column metadata for the results panel
    const columns = fields.map((f) => ({
      name:     f.name,
      orgName:  f.orgName,
      table:    f.table,
      type:     f.type,
    }));

    // Count query for pagination (without LIMIT)
    let totalRows = null;
    try {
      const countDef = { ...queryDefWithPaging, limit: null, offset: null, orderBy: [] };
      const { sql: countSql, params: countParams } = buildQuery(countDef, session.compat);
      const wrappedCount = `SELECT COUNT(*) AS __total FROM (${countSql}) AS __count_query`;
      const [[countRow]] = await connSvc.query(req.session.id, wrappedCount, countParams);
      totalRows = countRow.__total;
    } catch (_) {
      // Count query failure is non-fatal
    }

    res.json({
      sql,
      warnings,
      columns,
      rows,
      pagination: {
        page:       parseInt(page, 10),
        pageSize:   safePageSize,
        totalRows,
        totalPages: totalRows != null ? Math.ceil(totalRows / safePageSize) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Templates (localStorage-backed on client; server stores in-memory) ────────

// In-memory store — replace with a DB or file store for persistence
const templates = new Map();

router.get('/templates', (req, res) => {
  const list = Array.from(templates.values())
    .filter((t) => t.sessionId === req.session.id || t.shared)
    .map(({ id, name, description, queryDef, createdAt }) =>
      ({ id, name, description, queryDef, createdAt })
    );
  res.json({ templates: list });
});

router.post('/templates', requireConnection, (req, res) => {
  const { name, description, queryDef } = req.body;
  if (!name || !queryDef) {
    return res.status(400).json({ error: 'name and queryDef are required.' });
  }
  const id = randomUUID();
  templates.set(id, {
    id,
    name,
    description: description || '',
    queryDef,
    sessionId:   req.session.id,
    shared:      false,
    createdAt:   new Date().toISOString(),
  });
  res.status(201).json({ id, name });
});

router.delete('/templates/:id', (req, res) => {
  const { id } = req.params;
  if (!templates.has(id)) {
    return res.status(404).json({ error: 'Template not found.' });
  }
  templates.delete(id);
  res.json({ deleted: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip sensitive credential details from MySQL error messages
 * before sending them to the client.
 */
function sanitizeConnectionError(message) {
  if (!message) return 'Connection failed.';
  // Remove any credential-like patterns
  return message
    .replace(/password[:\s'"]+[^\s,;'"]+/gi, 'password: [hidden]')
    .replace(/user[:\s'"]+[^\s,;'"]+/gi, 'user: [hidden]')
    .replace(/ER_ACCESS_DENIED_ERROR.*/, 'Access denied. Check your credentials.');
}
