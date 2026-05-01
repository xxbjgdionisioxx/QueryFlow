import mysql from 'mysql2/promise';

let pool = null;

export async function initInternalDb() {
  const host = process.env.INTERNAL_DB_HOST || 'localhost';
  const port = process.env.INTERNAL_DB_PORT || 3306;
  const user = process.env.INTERNAL_DB_USER || 'root';
  const password = process.env.INTERNAL_DB_PASSWORD || '';
  const database = process.env.INTERNAL_DB_NAME || 'queryflow_system';

  try {
    // Connect without database first to ensure it exists
    const tempPool = mysql.createPool({ host, port, user, password });
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await tempPool.end();

    // Re-connect with database
    pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Run migrations
    await runMigrations();
    console.log(`[Internal DB] Connected to ${database} successfully.`);
  } catch (err) {
    console.error(`[Internal DB] Failed to initialize: ${err.message}`);
    process.exit(1);
  }
}

export function getInternalPool() {
  if (!pool) throw new Error('Internal database not initialized.');
  return pool;
}

async function runMigrations() {
  const usersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const connectionsTable = `
    CREATE TABLE IF NOT EXISTS saved_connections (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      host VARCHAR(255) NOT NULL,
      port INT DEFAULT 3306,
      username VARCHAR(255) NOT NULL,
      password_encrypted TEXT,
      database_name VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  await pool.query(usersTable);
  await pool.query(connectionsTable);
}
