import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

/**
 * Generate a short-lived access token (15 min default).
 */
export function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, type: user.type },
    process.env.ACCESS_TOKEN_SECRET || 'fallback_access_secret_123',
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || '15m' }
  );
}

/**
 * Generate a long-lived refresh token, store it in the DB.
 */
export async function generateRefreshToken(user) {
  const token = jwt.sign(
    { id: user.id, type: user.type },
    process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret_123',
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY || '7d' }
  );

  // Calculate expiry date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Store in database
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, user_type, token, expires_at) VALUES ($1, $2, $3, $4)',
    [user.id, user.type, token, expiresAt]
  );

  return token;
}

/**
 * Verify and decode a refresh token.
 */
export function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
}

/**
 * Delete a refresh token from the DB (logout).
 */
export async function revokeRefreshToken(token) {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}

/**
 * Delete all refresh tokens for a user (logout everywhere).
 */
export async function revokeAllUserTokens(userId, userType) {
  await pool.query(
    'DELETE FROM refresh_tokens WHERE user_id = $1 AND user_type = $2',
    [userId, userType]
  );
}
