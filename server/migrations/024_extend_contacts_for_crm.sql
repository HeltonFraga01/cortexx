-- Migration: Extend contacts table for CRM functionality
-- Requirements: 2.1, 3.2, 4.1, 5.1 (Contact CRM Evolution)

-- Add CRM columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_tier VARCHAR(20) DEFAULT 'cold' CHECK (lead_tier IN ('cold', 'warm', 'hot', 'vip'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifetime_value_cents INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bulk_messaging_opt_in BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_method VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create indexes for CRM queries
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_lead_tier ON contacts(lead_tier);
CREATE INDEX IF NOT EXISTS idx_contacts_lifetime_value ON contacts(lifetime_value_cents DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(last_interaction_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_is_active ON contacts(is_active);
CREATE INDEX IF NOT EXISTS idx_contacts_bulk_opt_in ON contacts(bulk_messaging_opt_in);
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON contacts USING GIN(custom_fields);

-- Add comments for documentation
COMMENT ON COLUMN contacts.lead_score IS 'Lead score from 0-100 based on engagement and purchases';
COMMENT ON COLUMN contacts.lead_tier IS 'Lead tier classification: cold, warm, hot, vip';
COMMENT ON COLUMN contacts.lifetime_value_cents IS 'Total lifetime value in cents';
COMMENT ON COLUMN contacts.purchase_count IS 'Total number of completed purchases';
COMMENT ON COLUMN contacts.credit_balance IS 'Current credit balance for the contact';
COMMENT ON COLUMN contacts.last_interaction_at IS 'Timestamp of last message sent or received';
COMMENT ON COLUMN contacts.last_purchase_at IS 'Timestamp of last purchase';
COMMENT ON COLUMN contacts.is_active IS 'Whether contact has interacted in last 30 days';
COMMENT ON COLUMN contacts.bulk_messaging_opt_in IS 'Whether contact has opted in for bulk messaging';
COMMENT ON COLUMN contacts.opt_out_at IS 'Timestamp when contact opted out';
COMMENT ON COLUMN contacts.opt_out_method IS 'Method of opt-out: keyword, manual, etc';
COMMENT ON COLUMN contacts.custom_fields IS 'JSON object storing custom field values';
