/**
 * Migration: Add inbox and agent assignment fields to conversations
 * 
 * Adds fields to support multi-user inbox system:
 * - inbox_id: Links conversation to an inbox
 * - assigned_agent_id: Links conversation to an assigned agent
 * 
 * Requirements: 4.4, 7.1, 7.4
 */

const { logger } = require('../utils/logger');

async function up(db) {
  logger.info('Running migration: add_conversation_inbox_fields');

  try {
    // Check if columns already exist
    const { rows: columns } = await db.query("PRAGMA table_info(conversations)");
    const columnNames = columns.map(c => c.name);

    // Add inbox_id column if not exists
    if (!columnNames.includes('inbox_id')) {
      await db.query(`
        ALTER TABLE conversations 
        ADD COLUMN inbox_id TEXT REFERENCES inboxes(id) ON DELETE SET NULL
      `);
      logger.info('Added inbox_id column to conversations');
    }

    // Add assigned_agent_id column if not exists
    if (!columnNames.includes('assigned_agent_id')) {
      await db.query(`
        ALTER TABLE conversations 
        ADD COLUMN assigned_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL
      `);
      logger.info('Added assigned_agent_id column to conversations');
    }

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id 
      ON conversations(inbox_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_assigned_agent_id 
      ON conversations(assigned_agent_id)
    `);

    logger.info('Migration completed: add_conversation_inbox_fields');
  } catch (error) {
    logger.error('Migration failed: add_conversation_inbox_fields', { error: error.message });
    throw error;
  }
}

async function down(db) {
  logger.info('Rolling back migration: add_conversation_inbox_fields');

  try {
    // SQLite doesn't support DROP COLUMN directly
    // We would need to recreate the table, but for safety we'll just log
    logger.warn('Rollback not implemented for add_conversation_inbox_fields - columns will remain');
  } catch (error) {
    logger.error('Rollback failed: add_conversation_inbox_fields', { error: error.message });
    throw error;
  }
}

module.exports = { up, down };
