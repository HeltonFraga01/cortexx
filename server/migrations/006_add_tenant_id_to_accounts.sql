-- Migration: Add tenant_id column to accounts table
-- Task 1.6: Add tenant_id column to accounts table
-- Requirements: 5.2, 7.1
-- Description: Adds tenant_id column to accounts table for multi-tenant support

-- Add tenant_id column to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Create index on tenant_id for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_accounts_tenant ON accounts(tenant_id);

-- Create composite index for common queries (tenant + status)
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_status ON accounts(tenant_id, status);

-- Add comment to the new column
COMMENT ON COLUMN accounts.tenant_id IS 'Reference to the tenant that owns this account';

-- Note: In a real migration, we would need to:
-- 1. Create a default tenant for existing accounts
-- 2. Update all existing accounts to reference the default tenant
-- 3. Make the column NOT NULL after data migration
-- 
-- For now, we'll leave it nullable to allow gradual migration
-- The application code will handle the transition period