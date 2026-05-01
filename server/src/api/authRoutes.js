import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID, randomInt } from 'crypto';
import { getInternalPool } from '../services/internalDb.js';
import { authRateLimiter, otpRateLimiter } from '../utils/rateLimiter.js';
import { sendOtpEmail } from '../services/emailService.js';

export const authRouter = Router();

// ── POST /signup ─────────────────────────────────────────────────────────────
authRouter.post('/signup', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }

    const pool = getInternalPool();
    
    // Check if user exists
    const [existing] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);
    if (existing.length > 0 && existing[0].is_verified) {
      return res.status(400).json({ error: 'Email already exists and is verified.' });
    }

    const otp = randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
    const hash = await bcrypt.hash(password, 10);

    if (existing.length > 0) {
      // Update unverified user with new OTP and password
      await pool.query(
        'UPDATE users SET password_hash = ?, full_name = ?, otp_code = ?, otp_expires_at = ? WHERE email = ?',
        [hash, name, otp, otpExpires, email]
      );
    } else {
      // Create new unverified user
      const id = randomUUID();
      await pool.query(
        'INSERT INTO users (id, email, password_hash, full_name, otp_code, otp_expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, email, hash, name, otp, otpExpires]
      );
    }

    // Send OTP email
    await sendOtpEmail(email, otp);

    res.status(200).json({ message: 'OTP sent to your email.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /verify-otp ──────────────────────────────────────────────────────────
authRouter.post('/verify-otp', otpRateLimiter, async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const pool = getInternalPool();
    const [users] = await pool.query(
      'SELECT id, otp_code, otp_expires_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(400).json({ error: 'User not found.' });
    }

    const user = users[0];
    if (user.otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP.' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP has expired.' });
    }

    // Verify user
    await pool.query(
      'UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expires_at = NULL WHERE id = ?',
      [user.id]
    );

    // Auto login
    req.session.userId = user.id;
    req.session.email = email;

    res.json({ id: user.id, email, message: 'Account verified successfully.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /resend-otp ──────────────────────────────────────────────────────────
authRouter.post('/resend-otp', otpRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const pool = getInternalPool();
    const [users] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);

    if (users.length === 0 || users[0].is_verified) {
      return res.status(400).json({ error: 'Cannot resend OTP for this email.' });
    }

    const otp = randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE email = ?',
      [otp, otpExpires, email]
    );

    await sendOtpEmail(email, otp);
    res.json({ message: 'New OTP sent.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /login ──────────────────────────────────────────────────────────────
authRouter.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const pool = getInternalPool();
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0 || !users[0].is_verified) {
      return res.status(401).json({ error: 'Invalid email, password, or account not verified.' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    req.session.email = user.email;
    req.session.fullName = user.full_name;

    // Log sign-in
    try {
      await pool.query(
        'INSERT INTO signin_logs (user_id, ip_address, user_agent) VALUES (?, ?, ?)',
        [user.id, req.ip, req.get('User-Agent')]
      );
    } catch (logErr) {
      console.error('[AUTH] Failed to log sign-in:', logErr.message);
    }

    res.json({ id: user.id, email: user.email, name: user.full_name });
  } catch (err) {
    next(err);
  }
});

// ── POST /forgot-password ───────────────────────────────────────────────────
authRouter.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const pool = getInternalPool();
    const [users] = await pool.query('SELECT id, is_verified FROM users WHERE email = ?', [email]);

    if (users.length === 0 || !users[0].is_verified) {
      // For security, don't reveal if user exists. Just say "If exists, OTP sent"
      return res.json({ message: 'If an account exists with this email, a reset code has been sent.' });
    }

    const otp = randomInt(100000, 999999).toString();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await pool.query(
      'UPDATE users SET otp_code = ?, otp_expires_at = ? WHERE id = ?',
      [otp, otpExpires, users[0].id]
    );

    await sendOtpEmail(email, otp, 'Password Reset');
    res.json({ message: 'If an account exists with this email, a reset code has been sent.' });
  } catch (err) {
    next(err);
  }
});

// ── POST /reset-password ────────────────────────────────────────────────────
authRouter.post('/reset-password', authRateLimiter, async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    const pool = getInternalPool();
    const [users] = await pool.query(
      'SELECT id, otp_code, otp_expires_at FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) return res.status(400).json({ error: 'Invalid request.' });

    const user = users[0];
    if (user.otp_code !== otp || new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash = ?, otp_code = NULL, otp_expires_at = NULL WHERE id = ?',
      [hash, user.id]
    );

    res.json({ success: true, message: 'Password reset successfully.' });
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
      name: req.session.fullName,
    },
    activeConnection: req.session.connected ? {
      database: req.session.database,
    } : null
  });
});
