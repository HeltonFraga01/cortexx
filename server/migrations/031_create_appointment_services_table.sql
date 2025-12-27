-- Migration: Create appointment_services table for CRM Calendar
-- Requirements: 3.1 (CRM Contact Calendar)

CREATE TABLE IF NOT EXISTS appointment_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (default_duration_minutes > 0),
    default_price_cents INTEGER DEFAULT 0 CHECK (default_price_cents >= 0),
    color VARCHAR(7) DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointment_services_account ON appointment_services(account_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_tenant ON appointment_services(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointment_services_active ON appointment_services(account_id, is_active);

-- Enable RLS
ALTER TABLE appointment_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY appointment_services_account_access ON appointment_services
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY appointment_services_tenant_isolation ON appointment_services
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE appointment_services IS 'Stores service types for appointments (e.g., consultation, meeting)';
COMMENT ON COLUMN appointment_services.default_duration_minutes IS 'Default duration in minutes for this service type';
COMMENT ON COLUMN appointment_services.default_price_cents IS 'Default price in cents for this service type';
COMMENT ON COLUMN appointment_services.color IS 'Hex color code for calendar display';
