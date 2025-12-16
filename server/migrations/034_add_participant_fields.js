/**
 * Migration: Add participant fields to chat_messages
 * 
 * Adds participant_jid and participant_name columns to store
 * the sender information for group messages.
 * 
 * Requirements: 3.2 - Store participant JID in database
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '034_add_participant_fields',
  
  async up(db) {
    logger.info('Running migration: 034_add_participant_fields');
    
    // Check existing columns
    const { rows } = await db.query("PRAGMA table_info(chat_messages)");
    const hasParticipantJid = rows.some(col => col.name === 'participant_jid');
    const hasParticipantName = rows.some(col => col.name === 'participant_name');
    
    // Add participant_jid column
    if (!hasParticipantJid) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN participant_jid TEXT
      `);
      logger.info('Added participant_jid column to chat_messages');
    } else {
      logger.info('participant_jid column already exists');
    }
    
    // Add participant_name column
    if (!hasParticipantName) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN participant_name TEXT
      `);
      logger.info('Added participant_name column to chat_messages');
    } else {
      logger.info('participant_name column already exists');
    }
    
    // Create index for participant_jid for query performance
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_messages_participant 
        ON chat_messages(participant_jid)
      `);
      logger.info('Created index idx_messages_participant');
    } catch (error) {
      logger.info('Index idx_messages_participant may already exist');
    }
  },
  
  async down(db) {
    // SQLite doesn't support DROP COLUMN easily
    logger.warn('Down migration not supported for this migration');
  }
};
