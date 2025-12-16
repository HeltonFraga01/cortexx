/**
 * Migration: Create agent_campaign_contacts table
 * 
 * Stores contacts for each agent campaign with their send status.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '074_create_agent_campaign_contacts_table',
  
  async up(db) {
    logger.info('Running migration: 074_create_agent_campaign_contacts_table');
    
    try {
      // Check if table already exists
      const { rows: tables } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agent_campaign_contacts'
      `);
      
      if (tables.length === 0) {
        await db.query(`
          CREATE TABLE agent_campaign_contacts (
            id TEXT PRIMARY KEY,
            campaign_id TEXT NOT NULL,
            phone TEXT NOT NULL,
            name TEXT,
            variables TEXT,
            status TEXT DEFAULT 'pending',
            sent_at TEXT,
            error_message TEXT,
            message_id TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES agent_campaigns(id) ON DELETE CASCADE
          )
        `);
        
        // Create indexes for common queries
        await db.query(`
          CREATE INDEX idx_agent_campaign_contacts_campaign_id ON agent_campaign_contacts(campaign_id)
        `);
        await db.query(`
          CREATE INDEX idx_agent_campaign_contacts_status ON agent_campaign_contacts(status)
        `);
        await db.query(`
          CREATE INDEX idx_agent_campaign_contacts_phone ON agent_campaign_contacts(phone)
        `);
        
        logger.info('Created agent_campaign_contacts table with indexes');
      } else {
        logger.info('Table agent_campaign_contacts already exists');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 074_create_agent_campaign_contacts_table failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 074_create_agent_campaign_contacts_table');
    
    try {
      await db.query('DROP TABLE IF EXISTS agent_campaign_contacts');
      logger.info('Dropped agent_campaign_contacts table');
      return true;
    } catch (error) {
      logger.error('Rollback failed:', error.message);
      throw error;
    }
  }
};
