-- Migration: Create tenants table
-- Task 1.2: Create tenants table migration
-- Requirements: 2.1, 2.2
-- Description: Creates the tenants table for multi-tenant instances

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  owner_superadmin_id UUID REFERENCES superadmins(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  settings JSONB DEFAULT '{}',
  stripe_connect_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index on subdomain for fast lookups and uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Create index on owner_superadmin_id for queries
CREATE INDEX IF NOT EXISTS idx_tenants_owner_superadmin ON tenants(owner_superadmin_id);

-- Add subdomain format constraint (lowercase alphanumeric with hyphens)
ALTER TABLE tenants ADD CONSTRAINT check_subdomain_format 
  CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length(subdomain) >= 2 AND length(subdomain) <= 63);

-- Add comments to table and columns
COMMENT ON TABLE tenants IS 'Multi-tenant instances with unique subdomains';
COMMENT ON COLUMN tenants.subdomain IS 'Unique subdomain identifier (e.g., chat, futebol)';
COMMENT ON COLUMN tenants.name IS 'Display name for the tenant';
COMMENT ON COLUMN tenants.owner_superadmin_id IS 'Superadmin who owns this tenant';
COMMENT ON COLUMN tenants.status IS 'Tenant status: active, inactive, or suspended';
COMMENT ON COLUMN tenants.settings IS 'Tenant-specific configuration settings';
COMMENT ON COLUMN tenants.stripe_connect_id IS 'Stripe Connect account ID for payments';