/**
 * connectionService.js — Session-scoped MySQL connection management
 *
 * Creates and caches a mysql2 connection pool per Express session.
 * Credentials are stored in the session object only — never in logs or
 * response bodies.
 *
 * Sessions are identified by the Express session ID. When the session ends
 * or the user disconnects, the pool is destroyed.
 */

import mysql from 'mysql2/promise';
import { analyzeVersion } from './versionAdapter.js';

// Map of sessionId → { pool, versionInfo }
const sessionPools = new Map();

/**
 * Establish a MySQL connection using the provided credentials.
 * Runs SELECT VERSION() immediately to detect the server version.
 * Stores the pool and version info keyed by session ID.
 *
 * @param {string} sessionId   - Express session ID
 * @param {object} credentials - { host, port, user, password, database }
 * @returns {{ versionString: string, compat: CompatibilityMap }}
 * @throws If the connection fails (credentials problem, network issue, etc.)
 */
export async function connect(sessionId, credentials) {
  // Destroy any existing pool for this session first
  await disconnect(sessionId);

  const { host, port, user, password, database } = credentials;

  // Create a minimal connection pool (1–5 connections)
  const pool = mysql.createPool({
    host:               host || 'localhost',
    port:               parseInt(port, 10) || 3306,
    user,
    password,
    database,
    waitForConnections:  true,
    connectionLimit:     5,
    queueLimit:          0,
    connectTimeout:      10_000,
    // Security: disable multi-statements to prevent SQL injection via query exec
    multipleStatements:  false,
  });

  // Test connection and detect version
  const conn = await pool.getConnection();
  let versionString;
  try {
    const [rows] = await conn.query('SELECT VERSION() AS v');
    versionString = rows[0].v;
  } finally {
    conn.release();
  }

  const { version, compat } = analyzeVersion(versionString);

  // Cache the pool for this session
  sessionPools.set(sessionId, { pool, versionString, version, compat });

  return { versionString, version, compat };
}

/**
 * Retrieve the pool + version info for an active session.
 *
 * @param {string} sessionId
 * @returns {{ pool, versionString, version, compat } | null}
 */
export function getSession(sessionId) {
  return sessionPools.get(sessionId) ?? null;
}

/**
 * Execute a query using the session's connection pool.
 * Uses parameterized queries to prevent SQL injection.
 *
 * @param {string}   sessionId
 * @param {string}   sql
 * @param {Array}    [params=[]]
 * @returns {Promise<[rows, fields]>}
 * @throws If no session exists or query fails
 */
export async function query(sessionId, sql, params = []) {
  const session = getSession(sessionId);
  if (!session) {
    const err = new Error('No active database connection. Please connect first.');
    err.status = 401;
    throw err;
  }
  const [rows, fields] = await session.pool.query(sql, params);
  return [rows, fields];
}

/**
 * Destroy the connection pool for a session (on disconnect or session end).
 *
 * @param {string} sessionId
 */
export async function disconnect(sessionId) {
  const session = sessionPools.get(sessionId);
  if (session) {
    try {
      await session.pool.end();
    } catch (_) {
      // Ignore errors during cleanup
    }
    sessionPools.delete(sessionId);
  }
}
