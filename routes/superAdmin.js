import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { generateAccessToken, generateRefreshToken } from '../utils/tokens.js';
// Add authentication middleware in a real app, assuming simple verify token or omitted here for demo, but let's assume we have something or we just do it inline
import jwt from 'jsonwebtoken';

const router = Router();

// Middleware to verify Super Admin
const verifySuperAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    if (decoded.type !== 'superadmin') {
      return res.status(403).json({ error: 'Forbidden. Super Admin only.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ─── LOGIN ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM super_admins WHERE email = $1', [email]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const admin = result.rows[0];

    const isMatch = await bcrypt.compare(password, admin.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = { id: admin.id, email: admin.email, type: 'superadmin' };

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
        id: admin.id,
        email: admin.email,
        type: 'superadmin',
      },
    });
  } catch (err) {
    console.error('Super Admin login error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── GET PENDING AUTHORITIES ─────────────────────────────
router.get('/pending-authorities', verifySuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, email, phone, employee_id, pincode, state, district, municipality, ward, created_at
       FROM authorities
       WHERE is_approved = false
       ORDER BY created_at DESC`
    );
    res.json({ authorities: result.rows });
  } catch (err) {
    console.error('Error fetching pending authorities:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── APPROVE AUTHORITY ───────────────────────────────────
router.post('/approve-authority/:id', verifySuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE authorities SET is_approved = true WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Authority not found.' });
    }

    res.json({ message: 'Authority approved successfully.', authority: result.rows[0] });
  } catch (err) {
    console.error('Error approving authority:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── REJECT AUTHORITY ────────────────────────────────────
router.post('/reject-authority/:id', verifySuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM authorities WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Authority not found.' });
    }

    res.json({ message: 'Authority rejected and removed successfully.' });
  } catch (err) {
    console.error('Error rejecting authority:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
