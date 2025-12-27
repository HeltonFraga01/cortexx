-- Migration: Create atomic credit management functions
-- Date: 2024-12-26
-- Purpose: Prevent race conditions in credit operations
-- 
-- These functions ensure credits are updated atomically using PostgreSQL's
-- built-in row-level locking, preventing race conditions when multiple
-- concurrent requests try to modify the same account's credits.

-- ============================================================================
-- Function: get_credit_balance
-- Returns the current credit balance for an account by summing all transactions
-- ============================================================================
CREATE OR REPLACE FUNCTION get_credit_balance(p_account_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(
    (SELECT balance_after 
     FROM credit_transactions 
     WHERE account_id = p_account_id 
     ORDER BY created_at DESC 
     LIMIT 1),
    0
  ) INTO v_balance;
  
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- Function: grant_credits_atomic
-- Atomically grants credits to an account
-- Returns the new balance after the operation
-- ============================================================================
CREATE OR REPLACE FUNCTION grant_credits_atomic(
  p_account_id UUID,
  p_amount INTEGER,
  p_category TEXT DEFAULT 'grant',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  transaction_id UUID,
  new_balance INTEGER,
  success BOOLEAN
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Lock the account row to prevent concurrent modifications
  PERFORM id FROM accounts WHERE id = p_account_id FOR UPDATE;
  
  -- Get current balance
  v_current_balance := get_credit_balance(p_account_id);
  v_new_balance := v_current_balance + p_amount;
  
  -- Insert transaction record
  INSERT INTO credit_transactions (
    account_id,
    type,
    amount,
    balance_after,
    description,
    metadata,
    created_at
  ) VALUES (
    p_account_id,
    p_category,
    p_amount,
    v_new_balance,
    COALESCE(p_description, 'Credit ' || p_category || ': ' || p_amount || ' credits'),
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN QUERY SELECT v_transaction_id, v_new_balance, TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: consume_credits_atomic
-- Atomically consumes credits from an account
-- Returns success=false if insufficient balance
-- ============================================================================
CREATE OR REPLACE FUNCTION consume_credits_atomic(
  p_account_id UUID,
  p_amount INTEGER,
  p_meter_id TEXT DEFAULT 'unknown',
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE(
  transaction_id UUID,
  new_balance INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Lock the account row to prevent concurrent modifications
  PERFORM id FROM accounts WHERE id = p_account_id FOR UPDATE;
  
  -- Get current balance
  v_current_balance := get_credit_balance(p_account_id);
  
  -- Check if sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT 
      NULL::UUID, 
      v_current_balance, 
      FALSE, 
      'Insufficient credits. Available: ' || v_current_balance || ', Required: ' || p_amount;
    RETURN;
  END IF;
  
  v_new_balance := v_current_balance - p_amount;
  
  -- Insert consumption transaction (negative amount)
  INSERT INTO credit_transactions (
    account_id,
    type,
    amount,
    balance_after,
    description,
    metadata,
    created_at
  ) VALUES (
    p_account_id,
    'consumption',
    -p_amount,
    v_new_balance,
    COALESCE(p_description, 'Usage: ' || p_meter_id || ' x ' || p_amount),
    jsonb_build_object('meter_id', p_meter_id) || p_metadata,
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN QUERY SELECT v_transaction_id, v_new_balance, TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Function: transfer_credits_atomic
-- Atomically transfers credits between accounts
-- ============================================================================
CREATE OR REPLACE FUNCTION transfer_credits_atomic(
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  from_transaction_id UUID,
  to_transaction_id UUID,
  from_new_balance INTEGER,
  to_new_balance INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  v_from_balance INTEGER;
  v_to_balance INTEGER;
  v_from_new_balance INTEGER;
  v_to_new_balance INTEGER;
  v_from_tx_id UUID;
  v_to_tx_id UUID;
BEGIN
  -- Lock both account rows in consistent order to prevent deadlocks
  IF p_from_account_id < p_to_account_id THEN
    PERFORM id FROM accounts WHERE id = p_from_account_id FOR UPDATE;
    PERFORM id FROM accounts WHERE id = p_to_account_id FOR UPDATE;
  ELSE
    PERFORM id FROM accounts WHERE id = p_to_account_id FOR UPDATE;
    PERFORM id FROM accounts WHERE id = p_from_account_id FOR UPDATE;
  END IF;
  
  -- Get current balances
  v_from_balance := get_credit_balance(p_from_account_id);
  v_to_balance := get_credit_balance(p_to_account_id);
  
  -- Check if sufficient balance
  IF v_from_balance < p_amount THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::UUID, 
      v_from_balance, v_to_balance, 
      FALSE, 
      'Insufficient credits for transfer. Available: ' || v_from_balance;
    RETURN;
  END IF;
  
  v_from_new_balance := v_from_balance - p_amount;
  v_to_new_balance := v_to_balance + p_amount;
  
  -- Deduct from source
  INSERT INTO credit_transactions (
    account_id, type, amount, balance_after, description, metadata, created_at
  ) VALUES (
    p_from_account_id, 'transfer', -p_amount, v_from_new_balance,
    COALESCE(p_description, 'Transfer to account ' || p_to_account_id),
    jsonb_build_object('to_account_id', p_to_account_id),
    NOW()
  ) RETURNING id INTO v_from_tx_id;
  
  -- Add to destination
  INSERT INTO credit_transactions (
    account_id, type, amount, balance_after, description, metadata, created_at
  ) VALUES (
    p_to_account_id, 'transfer', p_amount, v_to_new_balance,
    COALESCE(p_description, 'Transfer from account ' || p_from_account_id),
    jsonb_build_object('from_account_id', p_from_account_id),
    NOW()
  ) RETURNING id INTO v_to_tx_id;
  
  RETURN QUERY SELECT 
    v_from_tx_id, v_to_tx_id, 
    v_from_new_balance, v_to_new_balance, 
    TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION get_credit_balance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_credit_balance(UUID) TO service_role;

GRANT EXECUTE ON FUNCTION grant_credits_atomic(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION grant_credits_atomic(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION consume_credits_atomic(UUID, INTEGER, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_credits_atomic(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;

GRANT EXECUTE ON FUNCTION transfer_credits_atomic(UUID, UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_credits_atomic(UUID, UUID, INTEGER, TEXT) TO service_role;

-- ============================================================================
-- Add indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_credit_transactions_account_created 
ON credit_transactions(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_type 
ON credit_transactions(type);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON FUNCTION get_credit_balance IS 'Returns the current credit balance for an account';
COMMENT ON FUNCTION grant_credits_atomic IS 'Atomically grants credits to an account with row-level locking';
COMMENT ON FUNCTION consume_credits_atomic IS 'Atomically consumes credits with balance check and row-level locking';
COMMENT ON FUNCTION transfer_credits_atomic IS 'Atomically transfers credits between accounts with deadlock prevention';
