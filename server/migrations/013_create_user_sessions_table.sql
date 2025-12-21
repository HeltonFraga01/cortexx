-- Migration: Create user_sessions table for session management
-- Task 1.3: Create user_sessions table migration
-- Requirements: 2.1, 2.4
-- Description: Creates the user_sessions table for tracking user authentication sessions

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) NOT NULL UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_activity_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

-- Add comments for documentation
COMMENT ON TABLE user_sessions IS 'User authentication sessions for independent users';
COMMENT ON COLUMN user_sessions.user_id IS 'Reference to the user who owns this session';
COMMENT ON COLUMN user_sessions.session_token IS 'Unique session token for authentication';
COMMENT ON COLUMN user_sessions.ip_address IS 'IP address from which the session was created';
COMMENT ON COLUMN user_sessions.user_agent IS 'Browser/client user agent string';
COMMENT ON COLUMN user_sessions.expires_at IS 'Timestamp when the session expires';
COMMENT ON COLUMN user_sessions.last_activity_at IS 'Timestamp of last activity in this session';
