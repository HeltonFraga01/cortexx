/**
 * Migration: Create inboxes and inbox_members tables for multi-user system
 * Version: 056
 * Date: 2025-12-09
 * 
 * This migration creates the inboxes and inbox_members tables for organizing conversations.
 * Inboxes represent communication channels and control agent access to conversations.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 056: Criar tabelas inboxes e inbox_members');
    
    // Check if inboxes table already exists
    const inboxesCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='inboxes'"
    );
    
    if (inboxesCheck.rows.length === 0) {
      // Create inboxes table
      const createInboxesSql = `
        CREATE TABLE inboxes (
          id TEXT PRIMARY KEY,
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          channel_type TEXT DEFAULT 'whatsapp',
          enable_auto_assignment INTEGER DEFAULT 1,
          auto_assignment_config TEXT DEFAULT '{}',
          greeting_enabled INTEGER DEFAULT 0,
          greeting_message TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
          UNIQUE(account_id, name)
        )
      `;
      
      await db.query(createInboxesSql);
      logger.info('✅ Tabela inboxes criada');
      
      // Create indexes for inboxes
      await db.query('CREATE INDEX idx_inboxes_account_id ON inboxes(account_id)');
      logger.info('✅ Índice idx_inboxes_account_id criado');
      
      await db.query('CREATE UNIQUE INDEX idx_inboxes_account_name ON inboxes(account_id, name)');
      logger.info('✅ Índice idx_inboxes_account_name criado');
      
      await db.query('CREATE INDEX idx_inboxes_channel_type ON inboxes(channel_type)');
      logger.info('✅ Índice idx_inboxes_channel_type criado');
    } else {
      logger.info('ℹ️ Tabela inboxes já existe');
    }
    
    // Check if inbox_members table already exists
    const membersCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='inbox_members'"
    );
    
    if (membersCheck.rows.length === 0) {
      // Create inbox_members table
      const createMembersSql = `
        CREATE TABLE inbox_members (
          id TEXT PRIMARY KEY,
          inbox_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
          UNIQUE(inbox_id, agent_id)
        )
      `;
      
      await db.query(createMembersSql);
      logger.info('✅ Tabela inbox_members criada');
      
      // Create indexes for inbox_members
      await db.query('CREATE INDEX idx_inbox_members_inbox_id ON inbox_members(inbox_id)');
      logger.info('✅ Índice idx_inbox_members_inbox_id criado');
      
      await db.query('CREATE INDEX idx_inbox_members_agent_id ON inbox_members(agent_id)');
      logger.info('✅ Índice idx_inbox_members_agent_id criado');
      
      await db.query('CREATE UNIQUE INDEX idx_inbox_members_unique ON inbox_members(inbox_id, agent_id)');
      logger.info('✅ Índice idx_inbox_members_unique criado');
    } else {
      logger.info('ℹ️ Tabela inbox_members já existe');
    }
    
    logger.info('✅ Migration 056 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 056:', error.message);
    throw error;
  }
}

/**
 * Rollback the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migration 056: Remover tabelas inboxes e inbox_members');
    
    await db.query('DROP TABLE IF EXISTS inbox_members');
    logger.info('✅ Tabela inbox_members removida');
    
    await db.query('DROP TABLE IF EXISTS inboxes');
    logger.info('✅ Tabela inboxes removida');
    
    logger.info('✅ Migration 056 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 056:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 56,
  description: 'Create inboxes and inbox_members tables for multi-user system'
};
