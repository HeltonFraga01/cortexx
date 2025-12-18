-- Migration: Create tenant_branding table
-- Task 1.3: Create tenant_branding table migration
-- Requirements: 5.3, 8.1
-- Description: Creates the tenant_branding table for tenant-specific visual customization

CREATE TABLE IF NOT EXISTS tenant_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  app_name TEXT DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  primary_foreground TEXT,
  secondary_foreground TEXT,
  custom_home_html TEXT,
  support_phone TEXT,
  og_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create unique index on tenant_id (one branding per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_branding_tenant ON tenant_branding(tenant_id);

-- Add comments to table and columns
COMMENT ON TABLE tenant_branding IS 'Visual branding configuration for each tenant';
COMMENT ON COLUMN tenant_branding.tenant_id IS 'Reference to the tenant (one-to-one relationship)';
COMMENT ON COLUMN tenant_branding.app_name IS 'Custom application name displayed to users';
COMMENT ON COLUMN tenant_branding.logo_url IS 'URL to tenant logo image';
COMMENT ON COLUMN tenant_branding.primary_color IS 'Primary brand color (hex format)';
COMMENT ON COLUMN tenant_branding.secondary_color IS 'Secondary brand color (hex format)';
COMMENT ON COLUMN tenant_branding.primary_foreground IS 'Text color for primary background';
COMMENT ON COLUMN tenant_branding.secondary_foreground IS 'Text color for secondary background';
COMMENT ON COLUMN tenant_branding.custom_home_html IS 'Custom HTML for landing page';
COMMENT ON COLUMN tenant_branding.support_phone IS 'Support phone number';
COMMENT ON COLUMN tenant_branding.og_image_url IS 'Open Graph image for social sharing';
