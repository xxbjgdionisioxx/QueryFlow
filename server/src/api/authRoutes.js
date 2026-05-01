import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getInternalPool } from '../services/internalDb.js';

export const authRouter = Router();

// ── POST /signup ─────────────────────────────────────────────────────────────
authRouter.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const pool = getInternalPool();
    
    // Check if user exists
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already exists.' });
    }

    const id = randomUUID();
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
      [id, email, hash]
    );

    req.session.userId = id;
    req.session.email = email;

    res.status(201).json({ id, email });
  } catch (err) {
    next(err);
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const pool = getInternalPool();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;

    res.json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

// ── POST /logout ─────────────────────────────────────────────────────────────
authRouter.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Failed to logout' });
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// ── GET /me ──────────────────────────────────────────────────────────────────
authRouter.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  res.json({
    user: {
      id: req.session.userId,
      email: req.session.email,
    },
    activeConnection: req.session.connected ? {
      database: req.session.database,
    } : null
  });
});
