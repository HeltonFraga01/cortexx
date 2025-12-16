const { logger } = require('../utils/logger');

/**
 * Migration 004: Add messages tracking table
 * Adds a table to track sent messages for statistics
 */
async function up(db) {
  try {
    logger.info('🔄 Running migration 004: Add messages table');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='sent_messages'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('✅ Table sent_messages already exists, skipping migration');
      return;
    }
    
    // Create table if not exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS sent_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_token TEXT NOT NULL,
        phone TEXT NOT NULL,
        message TEXT,
        message_type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        wuzapi_response TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    logger.info('✅ Table sent_messages created successfully');
    
    // Create index for better query performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_sent_messages_user_token 
      ON sent_messages(user_token, created_at DESC)
    `);
    logger.info('✅ Index created successfully');
    
    logger.info('✅ Migration 004 completed successfully');
    
  } catch (error) {
    logger.error('❌ Error in migration 004:', error.message);
    throw error;
  }
}

async function down(db) {
  try {
    logger.info('🔄 Rolling back migration 004');
    
    await db.query('DROP TABLE IF EXISTS sent_messages');
    logger.info('✅ Table sent_messages dropped successfully');
    
  } catch (error) {
    logger.error('❌ Error dropping sent_messages table:', error.message);
    throw error;
  }
}

module.exports = { up, down };
