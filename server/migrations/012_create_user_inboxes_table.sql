-- Migration: Create user_inboxes table for linking users to inboxes
-- Task 1.2: Create user_inboxes table migration
-- Requirements: 3.1, 3.2
-- Description: Creates the user_inboxes junction table for optional inbox linking

CREATE TABLE IF NOT EXISTS user_inboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  inbox_id UUID NOT NULL REFERENCES inboxes(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT user_inboxes_unique UNIQUE(user_id, inbox_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_inboxes_user_id ON user_inboxes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inboxes_inbox_id ON user_inboxes(inbox_id);
CREATE INDEX IF NOT EXISTS idx_user_inboxes_is_primary ON user_inboxes(is_primary) WHERE is_primary = true;

-- Add comments for documentation
COMMENT ON TABLE user_inboxes IS 'Junction table linking independent users to inboxes';
COMMENT ON COLUMN user_inboxes.user_id IS 'Reference to the user';
COMMENT ON COLUMN user_inboxes.inbox_id IS 'Reference to the inbox';
COMMENT ON COLUMN user_inboxes.is_primary IS 'Whether this is the primary inbox for the user';
