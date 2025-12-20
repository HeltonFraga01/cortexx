-- Migration: 010_create_tenant_credit_packages_table
-- Description: Create tenant_credit_packages table for tenant-scoped credit packages
-- Requirements: REQ-13 (Multi-Tenant Isolation Audit)

-- Create tenant_credit_packages table
CREATE TABLE IF NOT EXISTS tenant_credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  credit_amount INTEGER NOT NULL CHECK (credit_amount > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: each tenant can only have one package with a given name
  UNIQUE(tenant_id, name)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_credit_packages_tenant_id ON tenant_credit_packages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credit_packages_status ON tenant_credit_packages(status);
CREATE INDEX IF NOT EXISTS idx_tenant_credit_packages_tenant_status ON tenant_credit_packages(tenant_id, status);

-- Add RLS policies
ALTER TABLE tenant_credit_packages ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant admins can only access their own tenant's credit packages
CREATE POLICY tenant_credit_packages_tenant_isolation ON tenant_credit_packages
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on table
COMMENT ON TABLE tenant_credit_packages IS 'Tenant-scoped credit packages for one-time token purchases. Each tenant manages their own packages.';
COMMENT ON COLUMN tenant_credit_packages.tenant_id IS 'Reference to the tenant that owns this credit package';
COMMENT ON COLUMN tenant_credit_packages.credit_amount IS 'Number of credits/tokens included in this package';
COMMENT ON COLUMN tenant_credit_packages.price_cents IS 'Price in cents (e.g., 1000 = R$10.00)';
COMMENT ON COLUMN tenant_credit_packages.stripe_product_id IS 'Stripe product ID for this package';
COMMENT ON COLUMN tenant_credit_packages.stripe_price_id IS 'Stripe price ID for this package';
