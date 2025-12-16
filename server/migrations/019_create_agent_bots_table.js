/**
 * Migration: Create agent_bots table for chat interface
 * Version: 019
 * Date: 2025-12-04
 * 
 * This migration creates the agent_bots table to store bot configurations
 * for automated message handling and responses.
 * Must be created before conversations and chat_messages tables.
 * 
 * Requirements: 17.1-17.6
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 019: Criar tabela agent_bots');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='agent_bots'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela agent_bots já existe');
      return;
    }
    
    // Create agent_bots table
    const createTableSql = `
      CREATE TABLE agent_bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        avatar_url TEXT,
        outgoing_url TEXT NOT NULL,
        access_token TEXT NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'paused')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela agent_bots criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_bots_user_id ON agent_bots(user_id)');
    logger.info('✅ Índice idx_bots_user_id criado');
    
    await db.query('CREATE INDEX idx_bots_status ON agent_bots(status)');
    logger.info('✅ Índice idx_bots_status criado');
    
    await db.query('CREATE UNIQUE INDEX idx_bots_access_token ON agent_bots(access_token)');
    logger.info('✅ Índice único idx_bots_access_token criado');
    
    logger.info('✅ Migration 019 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 019:', error.message);
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
    logger.info('🔄 Revertendo migration 019: Remover tabela agent_bots');
    
    await db.query('DROP TABLE IF EXISTS agent_bots');
    logger.info('✅ Tabela agent_bots removida');
    
    logger.info('✅ Migration 019 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 019:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 19,
  description: 'Create agent_bots table for chat interface'
};
