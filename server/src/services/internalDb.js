import mysql from 'mysql2/promise';

let pool = null;

export async function initInternalDb() {
  const host     = process.env.INTERNAL_DB_HOST;
  const port     = process.env.INTERNAL_DB_PORT;
  const user     = process.env.INTERNAL_DB_USER;
  const password = process.env.INTERNAL_DB_PASSWORD;
  const database = process.env.INTERNAL_DB_NAME;

  if (!host || !user || !database) {
    console.error('[Internal DB] Missing required environment variables: INTERNAL_DB_HOST, INTERNAL_DB_USER, INTERNAL_DB_NAME');
    process.exit(1);
  }

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
      full_name VARCHAR(255),
      is_verified BOOLEAN DEFAULT FALSE,
      otp_code VARCHAR(6),
      otp_expires_at TIMESTAMP NULL,
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

  const signinLogsTable = `
    CREATE TABLE IF NOT EXISTS signin_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  const queryLogsTable = `
    CREATE TABLE IF NOT EXISTS query_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      query_text TEXT NOT NULL,
      execution_time_ms INT,
      status VARCHAR(20),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  await pool.query(usersTable);
  await pool.query(connectionsTable);
  await pool.query(signinLogsTable);
  await pool.query(queryLogsTable);

  // Migration: Add columns if they don't exist
  try {
    const [columns] = await pool.query('SHOW COLUMNS FROM users');
    const columnNames = columns.map(c => c.Field);
    
    if (!columnNames.includes('full_name')) {
      await pool.query('ALTER TABLE users ADD COLUMN full_name VARCHAR(255) AFTER email');
    }
    if (!columnNames.includes('is_verified')) {
      await pool.query('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE');
    }
    if (!columnNames.includes('otp_code')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_code VARCHAR(6)');
    }
    if (!columnNames.includes('otp_expires_at')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_expires_at TIMESTAMP NULL');
    }
  } catch (err) {
    console.warn('[Internal DB] Migration warning:', err.message);
  }
}
