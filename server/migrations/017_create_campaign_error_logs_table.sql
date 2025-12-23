-- Migration: Create campaign_error_logs table
-- Purpose: Store error logs from bulk campaign processing for debugging and monitoring

-- Create table for campaign error logs
CREATE TABLE IF NOT EXISTS campaign_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES bulk_campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_error_logs_campaign_id ON campaign_error_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_error_logs_contact_id ON campaign_error_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_campaign_error_logs_error_type ON campaign_error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_campaign_error_logs_created_at ON campaign_error_logs(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE campaign_error_logs IS 'Error logs from bulk campaign message processing';
COMMENT ON COLUMN campaign_error_logs.campaign_id IS 'Reference to the bulk campaign that generated the error';
COMMENT ON COLUMN campaign_error_logs.contact_id IS 'Reference to the contact that caused the error (if applicable)';
COMMENT ON COLUMN campaign_error_logs.error_type IS 'Type/category of error (e.g., SEND_FAILED, INVALID_PHONE, RATE_LIMITED)';
COMMENT ON COLUMN campaign_error_logs.error_message IS 'Human-readable error message';
COMMENT ON COLUMN campaign_error_logs.stack_trace IS 'Full stack trace for debugging (optional)';
COMMENT ON COLUMN campaign_error_logs.metadata IS 'Additional context data in JSON format';
