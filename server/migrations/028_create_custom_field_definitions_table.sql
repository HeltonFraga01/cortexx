-- Migration: Create custom_field_definitions table for CRM
-- Requirements: 6.1, 6.2 (Contact CRM Evolution)

CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name VARCHAR(100) NOT NULL,
    label VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email', 'phone')),
    options JSONB,
    is_required BOOLEAN DEFAULT false,
    is_searchable BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    default_value TEXT,
    validation_rules JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(account_id, name)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_fields_account ON custom_field_definitions(account_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_tenant ON custom_field_definitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_order ON custom_field_definitions(account_id, display_order);

-- Enable RLS
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account isolation
CREATE POLICY custom_fields_account_access ON custom_field_definitions
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY custom_fields_tenant_isolation ON custom_field_definitions
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Add comments
COMMENT ON TABLE custom_field_definitions IS 'Defines custom fields available for contacts in an account';
COMMENT ON COLUMN custom_field_definitions.name IS 'Internal field name (unique per account)';
COMMENT ON COLUMN custom_field_definitions.label IS 'Display label for the field';
COMMENT ON COLUMN custom_field_definitions.field_type IS 'Field type: text, number, date, dropdown, checkbox, url, email, phone';
COMMENT ON COLUMN custom_field_definitions.options IS 'Options for dropdown fields: ["option1", "option2"]';
COMMENT ON COLUMN custom_field_definitions.validation_rules IS 'Validation rules: { "min": 0, "max": 100, "pattern": "..." }';
