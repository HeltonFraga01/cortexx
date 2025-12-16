/**
 * Migration: Create agent_drafts table
 * 
 * Stores draft campaign data for agents.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '076_create_agent_drafts_table',
  
  async up(db) {
    logger.info('Running migration: 076_create_agent_drafts_table');
    
    try {
      // Check if table already exists
      const { rows: tables } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agent_drafts'
      `);
      
      if (tables.length === 0) {
        await db.query(`
          CREATE TABLE agent_drafts (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            UNIQUE(agent_id, account_id)
          )
        `);
        
        await db.query(`
          CREATE INDEX idx_agent_drafts_agent_id ON agent_drafts(agent_id)
        `);
        
        logger.info('Created agent_drafts table');
      } else {
        logger.info('Table agent_drafts already exists');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 076_create_agent_drafts_table failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 076_create_agent_drafts_table');
    
    try {
      await db.query('DROP TABLE IF EXISTS agent_drafts');
      logger.info('Dropped agent_drafts table');
      return true;
    } catch (error) {
      logger.error('Rollback failed:', error.message);
      throw error;
    }
  }
};
