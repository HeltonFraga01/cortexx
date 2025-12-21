-- Migration: Create users table for independent user accounts
-- Task 1.1: Create users table migration
-- Requirements: 1.1, 1.5, 1.6
-- Description: Creates the users table for independent user accounts that don't require WUZAPI token

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  permissions JSONB DEFAULT '[]'::jsonb,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT users_tenant_email_unique UNIQUE(tenant_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Independent user accounts that can operate without WUZAPI token';
COMMENT ON COLUMN users.tenant_id IS 'Reference to the tenant this user belongs to';
COMMENT ON COLUMN users.email IS 'User email address, unique within tenant';
COMMENT ON COLUMN users.password_hash IS 'Hashed password using crypto.scrypt';
COMMENT ON COLUMN users.status IS 'Account status: active, inactive, or pending';
COMMENT ON COLUMN users.permissions IS 'JSON array of permission strings';
COMMENT ON COLUMN users.failed_login_attempts IS 'Counter for failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Timestamp until which the account is locked';
