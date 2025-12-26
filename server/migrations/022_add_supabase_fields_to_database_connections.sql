-- Migration: Add Supabase fields to database_connections table
-- Description: Adds support for Supabase as a database connection type
-- Requirements: 1.1, 1.6

-- Add Supabase-specific columns
ALTER TABLE database_connections
ADD COLUMN IF NOT EXISTS supabase_url TEXT,
ADD COLUMN IF NOT EXISTS supabase_key TEXT,
ADD COLUMN IF NOT EXISTS supabase_key_type TEXT CHECK (supabase_key_type IS NULL OR supabase_key_type IN ('service_role', 'anon')),
ADD COLUMN IF NOT EXISTS supabase_table TEXT;

-- Update the type constraint to include SUPABASE
-- First, drop the existing constraint
ALTER TABLE database_connections DROP CONSTRAINT IF EXISTS database_connections_type_check;

-- Add the new constraint with SUPABASE included
ALTER TABLE database_connections ADD CONSTRAINT database_connections_type_check 
CHECK (type = ANY (ARRAY['POSTGRES'::text, 'MYSQL'::text, 'NOCODB'::text, 'API'::text, 'SQLITE'::text, 'SUPABASE'::text]));

-- Add comments for documentation
COMMENT ON COLUMN database_connections.supabase_url IS 'Supabase project URL (e.g., https://project.supabase.co)';
COMMENT ON COLUMN database_connections.supabase_key IS 'Supabase API key (service_role or anon key) - stored encrypted';
COMMENT ON COLUMN database_connections.supabase_key_type IS 'Type of Supabase API key: service_role (bypasses RLS) or anon (respects RLS)';
COMMENT ON COLUMN database_connections.supabase_table IS 'Selected table name from the Supabase project';

-- Create index for faster lookups by type
CREATE INDEX IF NOT EXISTS idx_database_connections_type ON database_connections(type);
