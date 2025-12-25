-- Migration: Add inbox_id to outgoing_webhooks table
-- Purpose: Allow webhooks to be associated with specific inboxes instead of being global per user
-- Requirements: 1.1, 1.2, 1.3, 1.6

-- 1. Add inbox_id column (nullable for backward compatibility with legacy webhooks)
ALTER TABLE outgoing_webhooks 
ADD COLUMN IF NOT EXISTS inbox_id uuid REFERENCES inboxes(id) ON DELETE CASCADE;

-- 2. Create index for performance on inbox_id lookups
CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_inbox_id 
ON outgoing_webhooks(inbox_id);

-- 3. Create composite index for common query pattern (user + inbox filtering)
CREATE INDEX IF NOT EXISTS idx_outgoing_webhooks_user_inbox 
ON outgoing_webhooks(user_id, inbox_id);

-- 4. Add unique constraint to prevent duplicate webhooks per user/inbox/url combination
-- Note: This allows same URL for different inboxes of the same user
ALTER TABLE outgoing_webhooks 
ADD CONSTRAINT unique_user_inbox_url UNIQUE (user_id, inbox_id, url);

-- Note: Existing webhooks will have inbox_id = NULL (legacy mode)
-- These will continue to work and receive events from all inboxes
-- A separate data migration script will associate them with primary inbox
