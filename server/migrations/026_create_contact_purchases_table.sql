-- Migration: Create contact_purchases table for CRM
-- Requirements: 3.1 (Contact CRM Evolution)

CREATE TABLE IF NOT EXISTS contact_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    currency VARCHAR(3) DEFAULT 'BRL',
    description TEXT,
    product_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
    source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'stripe', 'webhook', 'import')),
    metadata JSONB DEFAULT '{}',
    purchased_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_purchases_contact ON contact_purchases(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_purchases_date ON contact_purchases(purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_purchases_external ON contact_purchases(external_id);
CREATE INDEX IF NOT EXISTS idx_contact_purchases_account ON contact_purchases(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_purchases_tenant ON contact_purchases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_purchases_status ON contact_purchases(status);

-- Enable RLS
ALTER TABLE contact_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY contact_purchases_account_access ON contact_purchases
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY contact_purchases_tenant_isolation ON contact_purchases
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE contact_purchases IS 'Stores purchase history for contacts';
COMMENT ON COLUMN contact_purchases.external_id IS 'External ID from payment system (Stripe, etc)';
COMMENT ON COLUMN contact_purchases.amount_cents IS 'Purchase amount in cents';
COMMENT ON COLUMN contact_purchases.source IS 'Source of purchase: manual, stripe, webhook, import';
