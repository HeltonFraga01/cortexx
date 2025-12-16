/**
 * Migration: Add media_metadata column to chat_messages
 * 
 * Stores WUZAPI media download parameters (MediaKey, FileSHA256, etc.)
 * for on-demand media download.
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '032_add_media_metadata',
  
  async up(db) {
    logger.info('Running migration: 032_add_media_metadata');
    
    // Check if column already exists
    const { rows } = await db.query("PRAGMA table_info(chat_messages)");
    const hasColumn = rows.some(col => col.name === 'media_metadata');
    
    if (!hasColumn) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN media_metadata TEXT
      `);
      logger.info('Added media_metadata column to chat_messages');
    } else {
      logger.info('media_metadata column already exists');
    }
  },
  
  async down(db) {
    // SQLite doesn't support DROP COLUMN easily
    logger.warn('Down migration not supported for this migration');
  }
};
