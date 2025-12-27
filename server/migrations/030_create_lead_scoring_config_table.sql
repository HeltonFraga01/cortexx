-- Migration: Create lead_scoring_config table for CRM
-- Requirements: 2.1 (Contact CRM Evolution)

CREATE TABLE IF NOT EXISTS lead_scoring_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
    config JSONB NOT NULL DEFAULT '{
        "messageReceived": 5,
        "messageSent": 2,
        "purchaseMade": 20,
        "purchaseValueMultiplier": 0.01,
        "inactivityDecayPerDay": 0.5,
        "maxScore": 100,
        "tiers": {
            "cold": {"min": 0, "max": 25},
            "warm": {"min": 26, "max": 50},
            "hot": {"min": 51, "max": 75},
            "vip": {"min": 76, "max": 100}
        }
    }',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_scoring_config_account ON lead_scoring_config(account_id);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_config_tenant ON lead_scoring_config(tenant_id);

-- Enable RLS
ALTER TABLE lead_scoring_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY lead_scoring_config_account_access ON lead_scoring_config
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY lead_scoring_config_tenant_isolation ON lead_scoring_config
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE lead_scoring_config IS 'Stores lead scoring configuration per account';
COMMENT ON COLUMN lead_scoring_config.config IS 'JSON configuration for lead scoring rules and tier thresholds';
