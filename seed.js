import bcrypt from 'bcrypt';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME
});

async function run() {
  try {
    const passwordHash = await bcrypt.hash('superadmin123', 10);
    const res = await pool.query('SELECT id FROM super_admins WHERE email = $1', ['admin@locly.ai']);
    if (res.rows.length === 0) {
      await pool.query('INSERT INTO super_admins (email, password_hash) VALUES ($1, $2)', ['admin@locly.ai', passwordHash]);
      console.log('Mock super admin created: admin@locly.ai / superadmin123');
    } else {
      console.log('Super admin already exists.');
    }
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
