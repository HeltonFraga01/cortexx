-- Migration: Enhance contacts table for import tracking and source identification
-- Requirements: 2.5, 2.6, 6.1

-- Add columns for import tracking and source identification
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source_inbox_id UUID REFERENCES inboxes(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_import_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS import_hash VARCHAR(64);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_source_inbox ON contacts(source_inbox_id);
CREATE INDEX IF NOT EXISTS idx_contacts_import_hash ON contacts(import_hash);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_normalized ON contacts(REGEXP_REPLACE(phone, '[^0-9]', '', 'g'));

-- Add comment for documentation
COMMENT ON COLUMN contacts.source_inbox_id IS 'ID of the inbox from which this contact was imported';
COMMENT ON COLUMN contacts.last_import_at IS 'Timestamp of the last import operation for this contact';
COMMENT ON COLUMN contacts.import_hash IS 'Hash of contact data for change detection during incremental imports';