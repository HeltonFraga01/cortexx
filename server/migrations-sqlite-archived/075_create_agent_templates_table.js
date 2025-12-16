/**
 * Migration: Create agent_templates table
 * 
 * Stores message templates created by agents for reuse.
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '075_create_agent_templates_table',
  
  async up(db) {
    logger.info('Running migration: 075_create_agent_templates_table');
    
    try {
      // Check if table already exists
      const { rows: tables } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agent_templates'
      `);
      
      if (tables.length === 0) {
        await db.query(`
          CREATE TABLE agent_templates (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            account_id TEXT NOT NULL,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            config TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
          )
        `);
        
        // Create indexes for common queries
        await db.query(`
          CREATE INDEX idx_agent_templates_agent_id ON agent_templates(agent_id)
        `);
        await db.query(`
          CREATE INDEX idx_agent_templates_account_id ON agent_templates(account_id)
        `);
        await db.query(`
          CREATE INDEX idx_agent_templates_name ON agent_templates(name)
        `);
        
        logger.info('Created agent_templates table with indexes');
      } else {
        logger.info('Table agent_templates already exists');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 075_create_agent_templates_table failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 075_create_agent_templates_table');
    
    try {
      await db.query('DROP TABLE IF EXISTS agent_templates');
      logger.info('Dropped agent_templates table');
      return true;
    } catch (error) {
      logger.error('Rollback failed:', error.message);
      throw error;
    }
  }
};
