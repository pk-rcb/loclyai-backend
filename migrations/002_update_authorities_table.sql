-- Add new fields to authorities table
ALTER TABLE authorities
ADD COLUMN employee_id VARCHAR(50) UNIQUE,
ADD COLUMN pincode VARCHAR(10),
ADD COLUMN state VARCHAR(100),
ADD COLUMN district VARCHAR(100),
ADD COLUMN municipality VARCHAR(100),
ADD COLUMN ward VARCHAR(100),
ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;

-- Create super_admins table
CREATE TABLE IF NOT EXISTS super_admins (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
