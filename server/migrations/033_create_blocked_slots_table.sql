-- Migration: Create blocked_slots table for CRM Calendar
-- Requirements: 4.1 (CRM Contact Calendar)

CREATE TABLE IF NOT EXISTS blocked_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255),
    is_recurring BOOLEAN DEFAULT false,
    recurring_pattern JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT blocked_slots_valid_range CHECK (end_time > start_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocked_slots_account ON blocked_slots(account_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_tenant ON blocked_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_blocked_slots_account_time ON blocked_slots(account_id, start_time, end_time);

-- Enable RLS
ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY blocked_slots_account_access ON blocked_slots
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY blocked_slots_tenant_isolation ON blocked_slots
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE blocked_slots IS 'Stores blocked time slots that prevent appointments';
COMMENT ON COLUMN blocked_slots.recurring_pattern IS 'JSON pattern for recurring blocks: {type: daily|weekly, days: [0-6]}';
