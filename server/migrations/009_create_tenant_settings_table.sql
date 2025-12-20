-- Migration: 009_create_tenant_settings_table
-- Description: Create tenant_settings table for tenant-scoped system settings
-- Requirements: REQ-3 (Multi-Tenant Isolation Audit)

-- Create tenant_settings table
CREATE TABLE IF NOT EXISTS tenant_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for tenant_id lookups
CREATE INDEX IF NOT EXISTS idx_tenant_settings_tenant_id ON tenant_settings(tenant_id);

-- Add RLS policies
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant admins can only access their own tenant's settings
CREATE POLICY tenant_settings_tenant_isolation ON tenant_settings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Comment on table
COMMENT ON TABLE tenant_settings IS 'Tenant-scoped system settings. Each tenant has their own settings configuration.';
COMMENT ON COLUMN tenant_settings.tenant_id IS 'Reference to the tenant that owns these settings';
COMMENT ON COLUMN tenant_settings.settings IS 'JSONB object containing all tenant settings';
