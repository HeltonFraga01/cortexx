-- Migration: Add requires_password_change column to superadmins table
-- Task 1.1: Add requires_password_change column
-- Requirements: 5.3
-- Description: Adds a flag to require password change on first login for new superadmin accounts

ALTER TABLE superadmins 
ADD COLUMN IF NOT EXISTS requires_password_change BOOLEAN DEFAULT false;

-- Add comment to column
COMMENT ON COLUMN superadmins.requires_password_change IS 'Flag to require password change on first login';

-- Create index for filtering accounts that need password change
CREATE INDEX IF NOT EXISTS idx_superadmins_requires_password_change 
ON superadmins(requires_password_change) 
WHERE requires_password_change = true;
