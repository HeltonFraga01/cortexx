/**
 * Migration: Add inbox_assignments column to bot_templates table
 * 
 * This migration adds support for multiple inbox assignments per bot template.
 * The inbox_assignments column stores a JSON array of {userId, inboxId} objects.
 */

const { logger } = require('../utils/logger');

async function up(db) {
  logger.info('Running migration 080: Add inbox_assignments to bot_templates');

  try {
    // Check if column already exists
    const { rows: columns } = await db.query("PRAGMA table_info(bot_templates)");
    const hasColumn = columns.some(col => col.name === 'inbox_assignments');

    if (!hasColumn) {
      // Add inbox_assignments column (JSON text)
      await db.query(`
        ALTER TABLE bot_templates 
        ADD COLUMN inbox_assignments TEXT DEFAULT '[]'
      `);
      logger.info('Added inbox_assignments column to bot_templates table');

      // Migrate existing data from chatwoot_user_id and chatwoot_inbox_id
      const { rows: templates } = await db.query(`
        SELECT id, chatwoot_user_id, chatwoot_inbox_id 
        FROM bot_templates 
        WHERE chatwoot_user_id IS NOT NULL AND chatwoot_inbox_id IS NOT NULL
      `);

      for (const template of templates) {
        const assignments = JSON.stringify([{
          userId: template.chatwoot_user_id,
          inboxId: template.chatwoot_inbox_id
        }]);
        
        await db.query(
          'UPDATE bot_templates SET inbox_assignments = ? WHERE id = ?',
          [assignments, template.id]
        );
      }

      if (templates.length > 0) {
        logger.info(`Migrated ${templates.length} existing bot templates to new inbox_assignments format`);
      }
    } else {
      logger.info('inbox_assignments column already exists, skipping');
    }

    logger.info('Migration 080 completed successfully');
  } catch (error) {
    logger.error('Migration 080 failed:', error.message);
    throw error;
  }
}

async function down(db) {
  logger.info('Rolling back migration 080: Remove inbox_assignments from bot_templates');

  try {
    // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
    // For simplicity, we'll just leave the column (it won't cause issues)
    logger.warn('Rollback not implemented for this migration - column will remain');
  } catch (error) {
    logger.error('Migration 080 rollback failed:', error.message);
    throw error;
  }
}

module.exports = { up, down };
