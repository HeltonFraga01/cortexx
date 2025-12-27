-- Migration: Create contact_segments and contact_segment_members tables for CRM
-- Requirements: 7.1 (Contact CRM Evolution)

-- Contact Segments table
CREATE TABLE IF NOT EXISTS contact_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    is_template BOOLEAN DEFAULT false,
    template_key VARCHAR(100),
    member_count INTEGER DEFAULT 0,
    last_evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for contact_segments
CREATE INDEX IF NOT EXISTS idx_contact_segments_account ON contact_segments(account_id);
CREATE INDEX IF NOT EXISTS idx_contact_segments_tenant ON contact_segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contact_segments_template ON contact_segments(is_template);
CREATE INDEX IF NOT EXISTS idx_contact_segments_template_key ON contact_segments(template_key);

-- Enable RLS for contact_segments
ALTER TABLE contact_segments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contact_segments
CREATE POLICY contact_segments_account_access ON contact_segments
    FOR ALL
    USING (account_id = current_setting('app.account_id', true)::uuid);

CREATE POLICY contact_segments_tenant_isolation ON contact_segments
    FOR ALL
    USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Contact Segment Members table
CREATE TABLE IF NOT EXISTS contact_segment_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES contact_segments(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(segment_id, contact_id)
);

-- Create indexes for contact_segment_members
CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON contact_segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_contact ON contact_segment_members(contact_id);

-- Enable RLS for contact_segment_members
ALTER TABLE contact_segment_members ENABLE ROW LEVEL SECURITY;

-- RLS Policy for contact_segment_members (through segment)
CREATE POLICY segment_members_access ON contact_segment_members
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM contact_segments cs 
            WHERE cs.id = segment_id 
            AND cs.account_id = current_setting('app.account_id', true)::uuid
        )
    );

-- Add comments
COMMENT ON TABLE contact_segments IS 'Defines dynamic segments for grouping contacts';
COMMENT ON COLUMN contact_segments.conditions IS 'JSON structure defining segment filter conditions';
COMMENT ON COLUMN contact_segments.is_template IS 'Whether this is a pre-built template segment';
COMMENT ON COLUMN contact_segments.template_key IS 'Key for template segments: inactive, high_value, new_leads';
COMMENT ON COLUMN contact_segments.member_count IS 'Cached count of contacts in segment';
COMMENT ON TABLE contact_segment_members IS 'Junction table for segment membership';
