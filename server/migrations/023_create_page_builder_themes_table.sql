-- Migration: Create page_builder_themes table
-- Description: Stores Page Builder themes with Puck schema data
-- Requirements: REQ-8 (Salvamento e Carregamento), REQ-10 (Export/Import)

-- Create page_builder_themes table
CREATE TABLE IF NOT EXISTS page_builder_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  connection_id UUID REFERENCES database_connections(id) ON DELETE SET NULL,
  schema JSONB NOT NULL DEFAULT '{}',
  preview_image TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_page_builder_themes_account_id ON page_builder_themes(account_id);
CREATE INDEX IF NOT EXISTS idx_page_builder_themes_connection_id ON page_builder_themes(connection_id);
CREATE INDEX IF NOT EXISTS idx_page_builder_themes_is_active ON page_builder_themes(is_active);
CREATE INDEX IF NOT EXISTS idx_page_builder_themes_updated_at ON page_builder_themes(updated_at DESC);

-- Add comments for documentation
COMMENT ON TABLE page_builder_themes IS 'Stores Page Builder themes with Puck visual editor schema';
COMMENT ON COLUMN page_builder_themes.id IS 'Unique theme identifier (UUID)';
COMMENT ON COLUMN page_builder_themes.account_id IS 'Account that owns this theme';
COMMENT ON COLUMN page_builder_themes.name IS 'Theme display name';
COMMENT ON COLUMN page_builder_themes.description IS 'Optional theme description';
COMMENT ON COLUMN page_builder_themes.connection_id IS 'Associated database connection for field mapping';
COMMENT ON COLUMN page_builder_themes.schema IS 'Puck editor schema (blocks, zones, root)';
COMMENT ON COLUMN page_builder_themes.preview_image IS 'Base64 or URL of theme preview image';
COMMENT ON COLUMN page_builder_themes.is_active IS 'Whether theme is active/visible';
COMMENT ON COLUMN page_builder_themes.created_at IS 'Theme creation timestamp';
COMMENT ON COLUMN page_builder_themes.updated_at IS 'Last update timestamp';

-- Enable RLS
ALTER TABLE page_builder_themes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see themes from their own account
CREATE POLICY page_builder_themes_select_policy ON page_builder_themes
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM accounts WHERE id = auth.uid()
      UNION
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only insert themes for their own account
CREATE POLICY page_builder_themes_insert_policy ON page_builder_themes
  FOR INSERT WITH CHECK (
    account_id IN (
      SELECT id FROM accounts WHERE id = auth.uid()
      UNION
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only update their own themes
CREATE POLICY page_builder_themes_update_policy ON page_builder_themes
  FOR UPDATE USING (
    account_id IN (
      SELECT id FROM accounts WHERE id = auth.uid()
      UNION
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );

-- Users can only delete their own themes
CREATE POLICY page_builder_themes_delete_policy ON page_builder_themes
  FOR DELETE USING (
    account_id IN (
      SELECT id FROM accounts WHERE id = auth.uid()
      UNION
      SELECT account_id FROM users WHERE id = auth.uid()
    )
  );
