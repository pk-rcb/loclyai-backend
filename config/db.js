import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

// Test connection and apply migrations on startup
pool.query('SELECT NOW()')
  .then(async () => {
    console.log('✅ PostgreSQL connected');
    try {
      await pool.query('ALTER TABLE reports ALTER COLUMN image_url TYPE TEXT;');
      console.log('✅ Reports table schema verified (image_url is TEXT)');
    } catch (e) {
      console.error('Migration error (can usually be ignored):', e.message);
    }
  })
  .catch((err) => console.error('❌ PostgreSQL connection error:', err.message));

export default pool;
