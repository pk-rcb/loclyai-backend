import { Router } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// All routes in this file require authentication
router.use(authenticateToken);

// ─── GET PROFILE ─────────────────────────────────────────
router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email, phone, created_at FROM citizens WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const citizen = result.rows[0];
    res.json({
      user: {
        id: citizen.id,
        fullName: citizen.full_name,
        email: citizen.email,
        phone: citizen.phone,
        createdAt: citizen.created_at,
        type: 'citizen',
      },
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── UPDATE PROFILE ──────────────────────────────────────
router.put('/profile', async (req, res) => {
  try {
    const { fullName, phone } = req.body;

    if (!fullName?.trim() || !phone?.trim()) {
      return res.status(400).json({ error: 'Full name and phone are required.' });
    }

    const result = await pool.query(
      `UPDATE citizens SET full_name = $1, phone = $2
       WHERE id = $3
       RETURNING id, full_name, email, phone, created_at`,
      [fullName.trim(), phone.trim(), req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const citizen = result.rows[0];
    res.json({
      message: 'Profile updated successfully!',
      user: {
        id: citizen.id,
        fullName: citizen.full_name,
        email: citizen.email,
        phone: citizen.phone,
        createdAt: citizen.created_at,
        type: 'citizen',
      },
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── CHANGE PASSWORD ─────────────────────────────────────
router.put('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    // Get current password hash
    const result = await pool.query(
      'SELECT password_hash FROM citizens WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE citizens SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    res.json({ message: 'Password changed successfully!' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// ─── DELETE ACCOUNT ──────────────────────────────────────
router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required to delete account.' });
    }

    // Verify password
    const result = await pool.query(
      'SELECT password_hash FROM citizens WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = await bcrypt.compare(password, result.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    // Delete refresh tokens then delete user
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1 AND user_type = $2', [req.user.id, 'citizen']);
    await pool.query('DELETE FROM citizens WHERE id = $1', [req.user.id]);

    res.clearCookie('refreshToken');
    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
