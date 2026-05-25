-- Migration 005: Report workflow enhancements
-- Adds authority assignment, status tracking, and location display

-- Human-readable full address for display
ALTER TABLE reports ADD COLUMN IF NOT EXISTS address_display TEXT;

-- Authority who is handling this report (matched by pincode)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS assigned_authority_id UUID REFERENCES authorities(id) ON DELETE SET NULL;

-- Notes from authority (reason for rejection, follow-up, etc.)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS authority_notes TEXT;

-- When the report was resolved/completed
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP;
