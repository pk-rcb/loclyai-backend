import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeRefreshToken,
} from '../utils/tokens.js';

const router = Router();

// ─── SIGNUP ──────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { fullName, email, phone, password } = req.body;

    // Check if email already exists
    const existing = await pool.query(
      'SELECT id FROM citizens WHERE email = $1', [email]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert citizen
    const result = await pool.query(
      `INSERT INTO citizens (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, full_name, email, phone, created_at`,
      [fullName, email, phone, passwordHash]
    );

    const citizen = result.rows[0];
    const user = { id: citizen.id, email: citizen.email, type: 'citizen' };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      message: 'Account created successfully!',
      accessToken,
      user: {
        id: citizen.id,
        fullName: citizen.full_name,
        email: citizen.email,
        phone: citizen.phone,
        type: 'citizen',
      },
    });
  } catch (err) {
    console.error('Citizen signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Find citizen by email
    const result = await pool.query(
      'SELECT * FROM citizens WHERE email = $1', [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const citizen = result.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, citizen.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = { id: citizen.id, email: citizen.email, type: 'citizen' };

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful!',
      accessToken,
      user: {
        id: citizen.id,
        fullName: citizen.full_name,
        email: citizen.email,
        phone: citizen.phone,
        type: 'citizen',
      },
    });
  } catch (err) {
    console.error('Citizen login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── REFRESH TOKEN ───────────────────────────────────────
router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Refresh token required.' });
    }

    // Verify token is valid JWT
    const decoded = verifyRefreshToken(token);

    // Check it exists in DB (not revoked)
    const dbToken = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (dbToken.rows.length === 0) {
      return res.status(403).json({ error: 'Refresh token revoked or expired.' });
    }

    // Issue new access token
    const user = { id: decoded.id, email: decoded.email, type: 'citizen' };
    const accessToken = generateAccessToken(user);

    res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ error: 'Invalid refresh token.' });
  }
});

// ─── LOGOUT ──────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (token) {
      await revokeRefreshToken(token);
    }
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
