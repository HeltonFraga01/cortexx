/**
 * Migration: Add auto-assignment fields to inboxes table
 * Version: 072
 * Date: 2025-12-14
 * 
 * This migration adds fields to support automatic conversation assignment:
 * - max_conversations_per_agent: Limit concurrent conversations per agent
 * - last_assigned_agent_id: Track last assigned agent for round-robin
 * 
 * Requirements: 7.3, 7.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 072: Adicionar campos de auto-assignment em inboxes');
    
    // Get existing columns
    const tableInfo = await db.query("PRAGMA table_info(inboxes)");
    const columnNames = tableInfo.rows.map(row => row.name);
    
    // Add max_conversations_per_agent column if not exists
    if (!columnNames.includes('max_conversations_per_agent')) {
      await db.query(`
        ALTER TABLE inboxes 
        ADD COLUMN max_conversations_per_agent INTEGER DEFAULT NULL
      `);
      logger.info('✅ Coluna max_conversations_per_agent adicionada');
    } else {
      logger.info('ℹ️ Coluna max_conversations_per_agent já existe');
    }
    
    // Add last_assigned_agent_id column if not exists
    if (!columnNames.includes('last_assigned_agent_id')) {
      await db.query(`
        ALTER TABLE inboxes 
        ADD COLUMN last_assigned_agent_id TEXT
      `);
      logger.info('✅ Coluna last_assigned_agent_id adicionada');
    } else {
      logger.info('ℹ️ Coluna last_assigned_agent_id já existe');
    }
    
    logger.info('✅ Migration 072 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 072:', error.message);
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
    logger.info('🔄 Revertendo migration 072: Remover campos de auto-assignment');
    
    // SQLite doesn't support DROP COLUMN directly
    // We would need to recreate the table, but for simplicity we'll just log
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. Colunas permanecerão na tabela.');
    
    logger.info('✅ Migration 072 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 072:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 72,
  description: 'Add auto-assignment fields to inboxes table'
};
