-- Migration: 020_add_provider_columns_to_inboxes
-- Description: Add provider-agnostic columns to inboxes table for multi-provider support
-- Requirements: 1.1, 1.2, 4.1, 4.2 (wuzapi-status-source-of-truth spec)

-- Add provider_type column (identifies the provider: wuzapi, evolution, wattsmill)
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS provider_type VARCHAR(50) DEFAULT 'wuzapi';

-- Add provider_config column (JSONB for provider-specific configuration)
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS provider_config JSONB DEFAULT '{}'::jsonb;

-- Add status_cached_at column (timestamp of last status cache update)
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS status_cached_at TIMESTAMPTZ;

-- Create index for provider_type queries
CREATE INDEX IF NOT EXISTS idx_inboxes_provider_type ON inboxes(provider_type);

-- Comments for documentation
COMMENT ON COLUMN inboxes.provider_type IS 'Tipo do provedor: wuzapi, evolution, wattsmill';
COMMENT ON COLUMN inboxes.provider_config IS 'Configurações específicas do provedor (token, instance, baseUrl, etc)';
COMMENT ON COLUMN inboxes.status_cached_at IS 'Timestamp da última atualização do cache de status';
COMMENT ON COLUMN inboxes.wuzapi_connected IS 'Cache do status de conexão (fonte: Provider API)';

-- Migrate existing WUZAPI tokens to provider_config for existing inboxes
-- This preserves backward compatibility while enabling the new architecture
UPDATE inboxes 
SET provider_config = jsonb_build_object(
  'token', wuzapi_token,
  'userId', wuzapi_user_id
)
WHERE wuzapi_token IS NOT NULL 
  AND (provider_config IS NULL OR provider_config = '{}'::jsonb);

-- Example provider_config structures:
-- WUZAPI:
-- {
--   "token": "ABC123...",
--   "userId": "user-id",
--   "baseUrl": "https://custom-wuzapi.example.com" (optional)
-- }
--
-- Evolution (future):
-- {
--   "apiKey": "...",
--   "instanceName": "...",
--   "serverUrl": "..."
-- }
--
-- WattsMill (future):
-- {
--   "apiToken": "...",
--   "accountId": "..."
-- }
