-- Migration: Create appointment_financial_records table for CRM Calendar
-- Requirements: 5.1, 5.2 (CRM Contact Calendar)

CREATE TABLE IF NOT EXISTS appointment_financial_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
    amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_date TIMESTAMPTZ,
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT financial_records_valid_status CHECK (payment_status IN ('pending', 'paid', 'refunded'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_financial_account ON appointment_financial_records(account_id);
CREATE INDEX IF NOT EXISTS idx_appointment_financial_tenant ON appointment_financial_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_financial_appointment ON appointment_financial_records(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_financial_status ON appointment_financial_records(payment_status);

-- Enable RLS
ALTER TABLE appointment_financial_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY appointment_financial_account_access ON appointment_financial_records
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY appointment_financial_tenant_isolation ON appointment_financial_records
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE appointment_financial_records IS 'Stores financial/payment records for appointments';
COMMENT ON COLUMN appointment_financial_records.payment_status IS 'Payment status: pending, paid, refunded';
COMMENT ON COLUMN appointment_financial_records.payment_method IS 'Payment method used (cash, card, pix, etc)';
