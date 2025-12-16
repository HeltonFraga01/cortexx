/**
 * Migration: Create agent_campaigns table
 * 
 * Stores campaigns created by agents for bulk message sending.
 * Campaigns consume quota from the account owner.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '073_create_agent_campaigns_table',
  
  async up(db) {
    logger.info('Running migration: 073_create_agent_campaigns_table');
    
    try {
      // Check if table already exists
      const { rows: tables } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agent_campaigns'
      `);
      
      if (tables.length === 0) {
        await db.query(`
          CREATE TABLE agent_campaigns (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            inbox_id TEXT NOT NULL,
            name TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            total_contacts INTEGER DEFAULT 0,
            sent_count INTEGER DEFAULT 0,
            failed_count INTEGER DEFAULT 0,
            current_position INTEGER DEFAULT 0,
            config TEXT,
            scheduled_at TEXT,
            started_at TEXT,
            completed_at TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE CASCADE
          )
        `);
        
        // Create indexes for common queries
        await db.query(`
          CREATE INDEX idx_agent_campaigns_agent_id ON agent_campaigns(agent_id)
        `);
        await db.query(`
          CREATE INDEX idx_agent_campaigns_account_id ON agent_campaigns(account_id)
        `);
        await db.query(`
          CREATE INDEX idx_agent_campaigns_status ON agent_campaigns(status)
        `);
        await db.query(`
          CREATE INDEX idx_agent_campaigns_created_at ON agent_campaigns(created_at)
        `);
        
        logger.info('Created agent_campaigns table with indexes');
      } else {
        logger.info('Table agent_campaigns already exists');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 073_create_agent_campaigns_table failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 073_create_agent_campaigns_table');
    
    try {
      await db.query('DROP TABLE IF EXISTS agent_campaigns');
      logger.info('Dropped agent_campaigns table');
      return true;
    } catch (error) {
      logger.error('Rollback failed:', error.message);
      throw error;
    }
  }
};
