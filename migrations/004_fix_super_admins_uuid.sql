-- Fix super_admins to use UUID instead of SERIAL for consistency
-- The refresh_tokens table expects user_id to be UUID, so super_admins.id must also be UUID.

-- Step 1: Drop existing super_admins table and recreate with UUID
-- (Safe since this is early in development; in production, use ALTER instead)
DROP TABLE IF EXISTS super_admins CASCADE;

CREATE TABLE super_admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
