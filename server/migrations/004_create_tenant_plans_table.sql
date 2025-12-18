-- Migration: Create tenant_plans table
-- Task 1.4: Create tenant_plans table migration
-- Requirements: 6.1, 6.5
-- Description: Creates the tenant_plans table for tenant-specific subscription plans

CREATE TABLE IF NOT EXISTS tenant_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER DEFAULT 0,
  billing_cycle TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly', 'quarterly', 'weekly', 'lifetime')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_default BOOLEAN DEFAULT false,
  trial_days INTEGER DEFAULT 0,
  quotas JSONB DEFAULT '{}',
  features JSONB DEFAULT '{}',
  stripe_product_id TEXT,
  stripe_price_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, name)
);

-- Create index on tenant_id for fast tenant-scoped queries
CREATE INDEX IF NOT EXISTS idx_tenant_plans_tenant ON tenant_plans(tenant_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_tenant_plans_status ON tenant_plans(status);

-- Create index on is_default for finding default plans
CREATE INDEX IF NOT EXISTS idx_tenant_plans_default ON tenant_plans(tenant_id, is_default) WHERE is_default = true;

-- Create index on Stripe product ID for webhook processing
CREATE INDEX IF NOT EXISTS idx_tenant_plans_stripe_product ON tenant_plans(stripe_product_id) WHERE stripe_product_id IS NOT NULL;

-- Create index on Stripe price ID for webhook processing
CREATE INDEX IF NOT EXISTS idx_tenant_plans_stripe_price ON tenant_plans(stripe_price_id) WHERE stripe_price_id IS NOT NULL;

-- Add comments to table and columns
COMMENT ON TABLE tenant_plans IS 'Subscription plans specific to each tenant';
COMMENT ON COLUMN tenant_plans.tenant_id IS 'Reference to the tenant that owns this plan';
COMMENT ON COLUMN tenant_plans.name IS 'Plan name (unique within tenant)';
COMMENT ON COLUMN tenant_plans.description IS 'Plan description for users';
COMMENT ON COLUMN tenant_plans.price_cents IS 'Plan price in cents (e.g., 2999 for $29.99)';
COMMENT ON COLUMN tenant_plans.billing_cycle IS 'Billing frequency: monthly, yearly, etc.';
COMMENT ON COLUMN tenant_plans.status IS 'Plan status: active, inactive, or archived';
COMMENT ON COLUMN tenant_plans.is_default IS 'Whether this is the default plan for new users';
COMMENT ON COLUMN tenant_plans.trial_days IS 'Number of trial days for this plan';
COMMENT ON COLUMN tenant_plans.quotas IS 'Resource limits (max_agents, max_messages, etc.)';
COMMENT ON COLUMN tenant_plans.features IS 'Feature flags (webhooks, api_access, etc.)';
COMMENT ON COLUMN tenant_plans.stripe_product_id IS 'Stripe Product ID for billing';
COMMENT ON COLUMN tenant_plans.stripe_price_id IS 'Stripe Price ID for billing';