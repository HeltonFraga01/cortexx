-- Migration: 018_add_webhook_config_to_inboxes
-- Description: Add webhook_config JSONB column to inboxes table for per-inbox webhook configuration
-- Requirements: 2.3 (Tenant Webhook Configuration)

-- Add webhook_config column to inboxes table
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS webhook_config JSONB DEFAULT '{}'::jsonb;

-- Create index for webhook_config queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_inboxes_webhook_config ON inboxes USING GIN (webhook_config);

-- Create index for webhook status queries
CREATE INDEX IF NOT EXISTS idx_inboxes_webhook_status ON inboxes ((webhook_config->>'status'));

-- Comment on column
COMMENT ON COLUMN inboxes.webhook_config IS 'JSONB object containing webhook configuration: url, events, configured_at, status';

-- Example webhook_config structure:
-- {
--   "url": "https://main-domain.com/api/webhook/events",
--   "events": ["Message", "ReadReceipt", "ChatPresence", "MessageStatus"],
--   "configured_at": "2025-12-23T10:00:00Z",
--   "status": "active"  -- active, pending, error
-- }
