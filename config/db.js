import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  ssl: { rejectUnauthorized: false } // Required for Neon
});

// Test connection on startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ PostgreSQL connected'))
  .catch((err) => console.error('❌ PostgreSQL connection error:', err.message));

export default pool;
