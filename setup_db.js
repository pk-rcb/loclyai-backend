import pool from './config/db.js';
import bcrypt from 'bcrypt';

async function setup() {
  try {
    console.log('Creating extensions...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await pool.query('CREATE EXTENSION IF NOT EXISTS "postgis";');

    console.log('Creating citizens table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS citizens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating authorities table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS authorities (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        full_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        employee_id VARCHAR(50) UNIQUE,
        pincode VARCHAR(10),
        state VARCHAR(100),
        district VARCHAR(100),
        municipality VARCHAR(100),
        ward VARCHAR(100),
        password_hash VARCHAR(255) NOT NULL,
        access_code VARCHAR(255),
        is_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating super_admins table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admins (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating refresh_tokens table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        user_type VARCHAR(50) NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    // Hotfix: Ensure expires_at exists if the table was already created without it
    await pool.query('ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;');

    console.log('Creating reports table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        citizen_id UUID REFERENCES citizens(id) ON DELETE CASCADE,
        description TEXT NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        latitude DECIMAL(10, 7) NOT NULL,
        longitude DECIMAL(10, 7) NOT NULL,
        state VARCHAR(100),
        district VARCHAR(100),
        municipality VARCHAR(100),
        ward VARCHAR(100),
        status VARCHAR(50) DEFAULT 'Pending',
        address_display TEXT,
        assigned_authority_id UUID REFERENCES authorities(id) ON DELETE SET NULL,
        authority_notes TEXT,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating password_reset_tokens table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('citizen', 'authority')),
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id, user_type);
    `);

    console.log('Seeding initial super admin...');
    const passwordHash = await bcrypt.hash('superadmin123', 10);
    const res = await pool.query('SELECT id FROM super_admins WHERE email = $1', ['admin@locly.ai']);
    if (res.rows.length === 0) {
      await pool.query('INSERT INTO super_admins (email, password_hash) VALUES ($1, $2)', ['admin@locly.ai', passwordHash]);
      console.log('Mock super admin created: admin@locly.ai / superadmin123');
    } else {
      console.log('Super admin already exists.');
    }

    console.log('✅ Database setup complete! All tables created.');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
  } finally {
    pool.end();
  }
}

setup();
