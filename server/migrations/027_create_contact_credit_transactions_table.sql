-- Migration: Create contact_credit_transactions table for CRM
-- Requirements: 4.2, 4.3 (Contact CRM Evolution)

CREATE TABLE IF NOT EXISTS contact_credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('credit', 'debit', 'adjustment', 'expiration')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    source VARCHAR(100),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    created_by_type VARCHAR(20) CHECK (created_by_type IN ('account', 'agent', 'system'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_credits_contact ON contact_credit_transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_created ON contact_credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_credits_account ON contact_credit_transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_tenant ON contact_credit_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_credits_type ON contact_credit_transactions(type);

-- Enable RLS
ALTER TABLE contact_credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY contact_credits_account_access ON contact_credit_transactions
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY contact_credits_tenant_isolation ON contact_credit_transactions
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE contact_credit_transactions IS 'Stores credit/debit transactions for contacts';
COMMENT ON COLUMN contact_credit_transactions.type IS 'Transaction type: credit, debit, adjustment, expiration';
COMMENT ON COLUMN contact_credit_transactions.amount IS 'Transaction amount (positive for credit, negative for debit)';
COMMENT ON COLUMN contact_credit_transactions.balance_after IS 'Balance after this transaction';
COMMENT ON COLUMN contact_credit_transactions.source IS 'Source of transaction: purchase, bonus, message_sent, manual, etc';
