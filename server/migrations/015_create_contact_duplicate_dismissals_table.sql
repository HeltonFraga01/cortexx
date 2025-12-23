-- Migration: Create contact_duplicate_dismissals table
-- Requirements: 5.6

-- Create table for tracking dismissed duplicate pairs
CREATE TABLE IF NOT EXISTS contact_duplicate_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id_1 UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  contact_id_2 UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  dismissed_by UUID,
  
  -- Ensure we don't have duplicate dismissals for the same pair
  CONSTRAINT unique_dismissal UNIQUE(account_id, contact_id_1, contact_id_2),
  
  -- Ensure contact_id_1 is always less than contact_id_2 for consistency
  CONSTRAINT ordered_contact_ids CHECK (contact_id_1 < contact_id_2)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dismissals_account ON contact_duplicate_dismissals(account_id);
CREATE INDEX IF NOT EXISTS idx_dismissals_contact_pair ON contact_duplicate_dismissals(contact_id_1, contact_id_2);

-- Add comments for documentation
COMMENT ON TABLE contact_duplicate_dismissals IS 'Tracks pairs of contacts that have been dismissed as false positive duplicates';
COMMENT ON COLUMN contact_duplicate_dismissals.contact_id_1 IS 'First contact ID (always smaller UUID for consistency)';
COMMENT ON COLUMN contact_duplicate_dismissals.contact_id_2 IS 'Second contact ID (always larger UUID for consistency)';
COMMENT ON COLUMN contact_duplicate_dismissals.dismissed_by IS 'User ID who dismissed this duplicate pair';