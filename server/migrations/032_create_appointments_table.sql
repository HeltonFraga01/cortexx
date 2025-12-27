-- Migration: Create appointments table for CRM Calendar
-- Requirements: 2.1, 2.5, 6.1 (CRM Contact Calendar)

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    service_id UUID REFERENCES appointment_services(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    price_cents INTEGER DEFAULT 0 CHECK (price_cents >= 0),
    notes TEXT,
    cancellation_reason TEXT,
    recurring_parent_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    recurring_pattern JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT appointments_valid_status CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show')),
    CONSTRAINT appointments_valid_time_range CHECK (end_time > start_time)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_appointments_account ON appointments(account_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_contact ON appointments(contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_account_contact ON appointments(account_id, contact_id);
CREATE INDEX IF NOT EXISTS idx_appointments_account_time ON appointments(account_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_service ON appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_recurring_parent ON appointments(recurring_parent_id);

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY appointments_account_access ON appointments
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY appointments_tenant_isolation ON appointments
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE appointments IS 'Stores appointments/bookings for contacts';
COMMENT ON COLUMN appointments.status IS 'Appointment status: scheduled, confirmed, completed, cancelled, no_show';
COMMENT ON COLUMN appointments.price_cents IS 'Price in cents for this appointment';
COMMENT ON COLUMN appointments.recurring_pattern IS 'JSON pattern for recurring appointments: {type, interval, endDate}';
