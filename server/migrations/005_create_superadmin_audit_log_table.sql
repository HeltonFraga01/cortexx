-- Migration: Create superadmin_audit_log table
-- Task 1.5: Create superadmin_audit_log table migration
-- Requirements: 4.2
-- Description: Creates the superadmin_audit_log table for tracking superadmin actions

CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  superadmin_id UUID REFERENCES superadmins(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  tenant_id UUID REFERENCES tenants(id),
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on tenant_id for tenant-specific audit queries
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_tenant ON superadmin_audit_log(tenant_id);

-- Create index on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_created ON superadmin_audit_log(created_at);

-- Create index on superadmin_id for user-specific audit queries
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_superadmin ON superadmin_audit_log(superadmin_id);

-- Create index on action for filtering by action type
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_action ON superadmin_audit_log(action);

-- Create composite index for common queries (superadmin + time range)
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_superadmin_time ON superadmin_audit_log(superadmin_id, created_at);

-- Create composite index for tenant audit queries (tenant + time range)
CREATE INDEX IF NOT EXISTS idx_superadmin_audit_tenant_time ON superadmin_audit_log(tenant_id, created_at);

-- Add comments to table and columns
COMMENT ON TABLE superadmin_audit_log IS 'Audit trail for all superadmin actions';
COMMENT ON COLUMN superadmin_audit_log.superadmin_id IS 'Superadmin who performed the action';
COMMENT ON COLUMN superadmin_audit_log.action IS 'Action performed (e.g., create_tenant, impersonate, delete_tenant)';
COMMENT ON COLUMN superadmin_audit_log.resource_type IS 'Type of resource affected (e.g., tenant, account, plan)';
COMMENT ON COLUMN superadmin_audit_log.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN superadmin_audit_log.tenant_id IS 'Tenant affected by the action (if applicable)';
COMMENT ON COLUMN superadmin_audit_log.details IS 'Additional action details and metadata';
COMMENT ON COLUMN superadmin_audit_log.ip_address IS 'IP address of the superadmin';
COMMENT ON COLUMN superadmin_audit_log.user_agent IS 'User agent string of the request';