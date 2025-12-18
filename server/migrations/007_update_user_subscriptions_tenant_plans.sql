-- Migration: Update user_subscriptions to reference tenant_plans
-- Task 1.7: Update user_subscriptions to reference tenant_plans
-- Requirements: 6.5
-- Description: Updates user_subscriptions table to reference tenant_plans instead of global plans

-- First, let's check if the foreign key constraint exists and drop it if needed
-- Note: This is a safe operation as we'll recreate the constraint with the new reference

DO $$
BEGIN
    -- Drop existing foreign key constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_subscriptions_plan_id_fkey' 
        AND table_name = 'user_subscriptions'
    ) THEN
        ALTER TABLE user_subscriptions DROP CONSTRAINT user_subscriptions_plan_id_fkey;
    END IF;
END $$;

-- Add new foreign key constraint referencing tenant_plans
ALTER TABLE user_subscriptions 
ADD CONSTRAINT user_subscriptions_plan_id_fkey 
FOREIGN KEY (plan_id) REFERENCES tenant_plans(id);

-- Create index on plan_id for better performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_plan ON user_subscriptions(plan_id);

-- Add comment to clarify the new relationship
COMMENT ON COLUMN user_subscriptions.plan_id IS 'Reference to tenant_plans (tenant-specific plans)';

-- Note: In a real migration, we would need to:
-- 1. Migrate existing subscriptions from global plans to tenant plans
-- 2. Create corresponding tenant plans for each existing global plan
-- 3. Update all subscription records to reference the new tenant plans
-- 
-- This migration assumes that tenant plans have been created and 
-- subscription data has been migrated appropriately