import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { sendPasswordResetEmail } from '../utils/email.js';

const router = Router();

// ─── REQUEST PASSWORD RESET ──────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email?.trim()) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    // Check if citizen exists
    const result = await pool.query(
      'SELECT id, email FROM citizens WHERE email = $1',
      [email.trim()]
    );

    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    const citizen = result.rows[0];

    // Generate a random reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this user
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND user_type = $2',
      [citizen.id, 'citizen']
    );

    // Store the hashed token
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, user_type, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [citizen.id, 'citizen', resetTokenHash, expiresAt]
    );

    // Build reset link
    const resetLink = `http://localhost:5173/reset-password?token=${resetToken}&email=${encodeURIComponent(citizen.email)}`;

    // Send email
    await sendPasswordResetEmail(citizen.email, resetLink);
    console.log(`📧 Password reset email sent to ${citizen.email}`);

    res.json({
      message: 'Password reset link has been sent to your email!',
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// ─── RESET PASSWORD ──────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: 'Email, token, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Find the citizen
    const userResult = await pool.query(
      'SELECT id FROM citizens WHERE email = $1',
      [email.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    const userId = userResult.rows[0].id;

    // Hash the provided token and look it up
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const tokenResult = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE user_id = $1 AND user_type = $2 AND token_hash = $3 AND expires_at > NOW()',
      [userId, 'citizen', tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE citizens SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    // Delete the used reset token
    await pool.query(
      'DELETE FROM password_reset_tokens WHERE user_id = $1 AND user_type = $2',
      [userId, 'citizen']
    );

    // Also revoke all refresh tokens for security
    await pool.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1 AND user_type = $2',
      [userId, 'citizen']
    );

    res.json({ message: 'Password reset successfully! You can now login with your new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
