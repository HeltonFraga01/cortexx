-- Migration: Create contact_interactions table for CRM
-- Requirements: 1.1, 1.2 (Contact CRM Evolution)

CREATE TABLE IF NOT EXISTS contact_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('message', 'call', 'email', 'note', 'status_change')),
    direction VARCHAR(20) CHECK (direction IN ('incoming', 'outgoing')),
    content TEXT,
    content_preview VARCHAR(200),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    created_by_type VARCHAR(20) CHECK (created_by_type IN ('account', 'agent', 'system'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_created ON contact_interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_type ON contact_interactions(type);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_account ON contact_interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_tenant ON contact_interactions(tenant_id);

-- Enable RLS
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY contact_interactions_account_access ON contact_interactions
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY contact_interactions_tenant_isolation ON contact_interactions
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE contact_interactions IS 'Stores all interactions (messages, calls, notes) with contacts';
COMMENT ON COLUMN contact_interactions.type IS 'Type of interaction: message, call, email, note, status_change';
COMMENT ON COLUMN contact_interactions.direction IS 'Direction of interaction: incoming or outgoing';
COMMENT ON COLUMN contact_interactions.content_preview IS 'First 200 characters of content for display';
