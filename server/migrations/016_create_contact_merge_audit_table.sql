-- Migration: Create contact_merge_audit table
-- Requirements: 4.7

-- Create table for auditing contact merge operations
CREATE TABLE IF NOT EXISTS contact_merge_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  merged_contact_id UUID NOT NULL REFERENCES contacts(id),
  source_contact_ids UUID[] NOT NULL,
  merge_data JSONB NOT NULL,
  merged_at TIMESTAMPTZ DEFAULT now(),
  merged_by UUID
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_merge_audit_account ON contact_merge_audit(account_id);
CREATE INDEX IF NOT EXISTS idx_merge_audit_merged_contact ON contact_merge_audit(merged_contact_id);
CREATE INDEX IF NOT EXISTS idx_merge_audit_merged_at ON contact_merge_audit(merged_at);

-- Add comments for documentation
COMMENT ON TABLE contact_merge_audit IS 'Audit log for contact merge operations';
COMMENT ON COLUMN contact_merge_audit.merged_contact_id IS 'ID of the final merged contact';
COMMENT ON COLUMN contact_merge_audit.source_contact_ids IS 'Array of contact IDs that were merged together';
COMMENT ON COLUMN contact_merge_audit.merge_data IS 'JSON data containing the merge configuration and original contact data';
COMMENT ON COLUMN contact_merge_audit.merged_by IS 'User ID who performed the merge operation';