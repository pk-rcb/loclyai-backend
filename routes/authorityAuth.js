import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
    const { fullName, email, phone, employeeId, pincode, state, district, municipality, ward, password } = req.body;

    // Validate email domain (server side)
    if (email.endsWith('@gmail.com') || email.endsWith('@yahoo.com') || email.endsWith('@hotmail.com')) {
      return res.status(400).json({ error: 'Please use your official municipal email address.' });
    }

    const existingEmail = await pool.query(
      'SELECT id FROM authorities WHERE email = $1', [email]
    );
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const existingEmp = await pool.query(
      'SELECT id FROM authorities WHERE employee_id = $1', [employeeId]
    );
    if (existingEmp.rows.length > 0) {
      return res.status(409).json({ error: 'Employee ID already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8-char alphanumeric code

    const result = await pool.query(
      `INSERT INTO authorities (full_name, email, phone, employee_id, pincode, state, district, municipality, ward, password_hash, access_code, is_approved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
       RETURNING id, full_name, email, phone, employee_id, pincode, state, district, municipality, ward, access_code, is_approved, created_at`,
      [fullName, email, phone, employeeId, pincode, state, district, municipality, ward, passwordHash, accessCode]
    );

    const authority = result.rows[0];

    res.status(201).json({
      message: 'Authority account created! Pending Super Admin approval.',
      user: {
        id: authority.id,
        fullName: authority.full_name,
        email: authority.email,
        phone: authority.phone,
        employeeId: authority.employee_id,
        pincode: authority.pincode,
        state: authority.state,
        district: authority.district,
        municipality: authority.municipality,
        ward: authority.ward,
        isApproved: authority.is_approved,
        type: 'authority',
      },
    });
  } catch (err) {
    console.error('Authority signup error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM authorities WHERE email = $1', [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const authority = result.rows[0];

    const isMatch = await bcrypt.compare(password, authority.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!authority.is_approved) {
      return res.status(403).json({ error: 'Account pending Super Admin approval.' });
    }

    const user = { id: authority.id, email: authority.email, type: 'authority' };

    const accessToken = generateAccessToken(user);
    const refreshToken = await generateRefreshToken(user);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: 'Login successful!',
      accessToken,
      user: {
        id: authority.id,
        fullName: authority.full_name,
        email: authority.email,
        phone: authority.phone,
        employeeId: authority.employee_id,
        pincode: authority.pincode,
        state: authority.state,
        district: authority.district,
        municipality: authority.municipality,
        ward: authority.ward,
        isApproved: authority.is_approved,
        type: 'authority',
      },
    });
  } catch (err) {
    console.error('Authority login error:', err);
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

    const decoded = verifyRefreshToken(token);

    const dbToken = await pool.query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (dbToken.rows.length === 0) {
      return res.status(403).json({ error: 'Refresh token revoked or expired.' });
    }

    const user = { id: decoded.id, email: decoded.email, type: 'authority' };
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
