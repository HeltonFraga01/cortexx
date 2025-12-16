/**
 * Migration: Add inboxes column to campaigns table
 * 
 * Adds support for multiple inboxes per campaign
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '071_add_campaign_inboxes',
  
  async up(db) {
    logger.info('Running migration: 071_add_campaign_inboxes');
    
    try {
      // Check if column already exists
      const { rows: columns } = await db.query(`
        PRAGMA table_info(campaigns)
      `);
      
      const hasInboxesColumn = columns.some(col => col.name === 'inboxes');
      
      if (!hasInboxesColumn) {
        await db.query(`
          ALTER TABLE campaigns ADD COLUMN inboxes TEXT
        `);
        logger.info('Added inboxes column to campaigns table');
      } else {
        logger.info('Column inboxes already exists in campaigns table');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 071_add_campaign_inboxes failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 071_add_campaign_inboxes');
    
    // SQLite doesn't support DROP COLUMN directly
    // Would need to recreate the table without the column
    logger.warn('Rollback not implemented for SQLite - column will remain');
    
    return true;
  }
};
