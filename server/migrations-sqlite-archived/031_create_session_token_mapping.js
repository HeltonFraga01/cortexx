/**
 * Migration: Create session_token_mapping table
 * 
 * Maps WUZAPI session IDs to user tokens for webhook processing.
 * When WUZAPI sends webhooks, it includes userID (session ID) but not the token.
 * This table allows us to look up the token from the session ID.
 */

async function up(db) {
  // Create session_token_mapping table
  await db.query(`
    CREATE TABLE IF NOT EXISTS session_token_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL UNIQUE,
      user_token TEXT NOT NULL,
      instance_name TEXT,
      jid TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create index for fast lookups
  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_session_token_mapping_session_id 
    ON session_token_mapping(session_id)
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS idx_session_token_mapping_user_token 
    ON session_token_mapping(user_token)
  `);

  console.log('✅ Created session_token_mapping table');
}

async function down(db) {
  await db.query('DROP TABLE IF EXISTS session_token_mapping');
  console.log('✅ Dropped session_token_mapping table');
}

module.exports = { up, down };
