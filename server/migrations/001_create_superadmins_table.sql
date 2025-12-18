-- Migration: Create superadmins table
-- Task 1.1: Create superadmins table migration
-- Requirements: 1.1
-- Description: Creates the superadmins table for platform-wide administrators

CREATE TABLE IF NOT EXISTS superadmins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_superadmins_email ON superadmins(email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_superadmins_status ON superadmins(status);

-- Add comment to table
COMMENT ON TABLE superadmins IS 'Platform-wide administrators with access to all tenants';
COMMENT ON COLUMN superadmins.email IS 'Unique email address for superadmin login';
COMMENT ON COLUMN superadmins.password_hash IS 'Hashed password using crypto.scrypt';
COMMENT ON COLUMN superadmins.status IS 'Account status: active or inactive';
