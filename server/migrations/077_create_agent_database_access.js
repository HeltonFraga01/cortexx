/**
 * Migration: Create agent_database_access table
 * 
 * Stores database access configurations for agents.
 * Controls which external database connections each agent can access
 * and at what level (none, view, full).
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

const { logger } = require('../utils/logger');

module.exports = {
  name: '077_create_agent_database_access',
  
  async up(db) {
    logger.info('Running migration: 077_create_agent_database_access');
    
    try {
      // Check if table already exists
      const { rows: tables } = await db.query(`
        SELECT name FROM sqlite_master WHERE type='table' AND name='agent_database_access'
      `);
      
      if (tables.length === 0) {
        await db.query(`
          CREATE TABLE agent_database_access (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            connection_id TEXT NOT NULL,
            access_level TEXT DEFAULT 'none' CHECK(access_level IN ('none', 'view', 'full')),
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
            UNIQUE(agent_id, connection_id)
          )
        `);
        
        await db.query(`
          CREATE INDEX idx_agent_database_access_agent ON agent_database_access(agent_id)
        `);
        
        await db.query(`
          CREATE INDEX idx_agent_database_access_connection ON agent_database_access(connection_id)
        `);
        
        logger.info('Created agent_database_access table with indexes');
      } else {
        logger.info('Table agent_database_access already exists');
      }
      
      return true;
    } catch (error) {
      logger.error('Migration 077_create_agent_database_access failed:', error.message);
      throw error;
    }
  },
  
  async down(db) {
    logger.info('Rolling back migration: 077_create_agent_database_access');
    
    try {
      await db.query('DROP TABLE IF EXISTS agent_database_access');
      logger.info('Dropped agent_database_access table');
      return true;
    } catch (error) {
      logger.error('Rollback failed:', error.message);
      throw error;
    }
  }
};
