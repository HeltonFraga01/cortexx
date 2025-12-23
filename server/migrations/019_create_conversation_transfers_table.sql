-- Migration: 019_create_conversation_transfers_table
-- Description: Create table to track conversation transfers between inboxes
-- Requirements: REQ-4.1, REQ-4.2 (Transfer History/Audit)

-- Create conversation_transfers table
CREATE TABLE IF NOT EXISTS conversation_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  from_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE SET NULL,
  to_inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE SET NULL,
  transferred_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_conversation_transfers_conversation_id 
  ON conversation_transfers(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_transfers_transferred_at 
  ON conversation_transfers(transferred_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_transfers_from_inbox 
  ON conversation_transfers(from_inbox_id);

CREATE INDEX IF NOT EXISTS idx_conversation_transfers_to_inbox 
  ON conversation_transfers(to_inbox_id);

-- Enable Row Level Security
ALTER TABLE conversation_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view transfers for conversations in their account
CREATE POLICY "Users can view transfers for their account conversations"
  ON conversation_transfers FOR SELECT
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN inboxes i ON c.inbox_id = i.id
      WHERE i.account_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert transfers for conversations in their account
CREATE POLICY "Users can insert transfers for their account conversations"
  ON conversation_transfers FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT c.id FROM conversations c
      JOIN inboxes i ON c.inbox_id = i.id
      WHERE i.account_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE conversation_transfers IS 'Audit log of conversation transfers between inboxes';
COMMENT ON COLUMN conversation_transfers.conversation_id IS 'The conversation that was transferred';
COMMENT ON COLUMN conversation_transfers.from_inbox_id IS 'Source inbox before transfer';
COMMENT ON COLUMN conversation_transfers.to_inbox_id IS 'Destination inbox after transfer';
COMMENT ON COLUMN conversation_transfers.transferred_by IS 'Agent who performed the transfer (nullable for system transfers)';
COMMENT ON COLUMN conversation_transfers.transferred_at IS 'Timestamp when transfer occurred';
COMMENT ON COLUMN conversation_transfers.reason IS 'Optional reason for the transfer';
