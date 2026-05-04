/**
 * server.js — Express application entry point
 *
 * Sets up middleware, session handling, CORS, and mounts all API routes.
 * Credentials are stored only in server-side sessions and never logged.
 */

import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import cors from 'cors';
import { router } from './api/routes.js';
import { authRouter } from './api/authRoutes.js';
import { aiRouter } from './api/aiRoutes.js';
import { designerRouter } from './api/designerRoutes.js';
import { initInternalDb } from './services/internalDb.js';

const app = express();
const PORT = process.env.PORT;

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CLIENT_ORIGIN,
  credentials: true,          // Allow cookies / session
}));

app.use(express.json({ limit: '1mb' }));

// Session middleware — stores DB credentials server-side only
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
}));

// ── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth', authRouter);
app.use('/api/ai', aiRouter);
app.use('/api/designer', designerRouter);
app.use('/api', router);

// Health check (no credentials required)
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Global error handler ─────────────────────────────────────────────────────

app.use((err, _req, res, _next) => {
  // Never expose credential-related fields in error messages
  const message = err.message || 'Internal server error';
  const status = err.status || 500;
  console.error(`[ERROR ${status}]`, message);
  res.status(status).json({ error: message });
});

// Initialize internal database before listening
initInternalDb().then(() => {
  app.listen(PORT, () => {
    console.log(`QueryFlow server running on http://localhost:${PORT}`);
  });
});

export default app;
