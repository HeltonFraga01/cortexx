/**
 * Migration: Add priority and is_default columns to agent_bots table
 * Version: 039
 * Date: 2025-12-06
 * 
 * This migration adds priority ordering and default bot functionality
 * to enable automatic bot assignment to new conversations.
 * 
 * Requirements: 2.1, 2.3, 3.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 039: Adicionar priority e is_default à tabela agent_bots');
    
    // Check if columns already exist
    const tableInfo = await db.query("PRAGMA table_info(agent_bots)");
    const columns = tableInfo.rows.map(row => row.name);
    
    // Add priority column if not exists
    if (!columns.includes('priority')) {
      await db.query('ALTER TABLE agent_bots ADD COLUMN priority INTEGER DEFAULT 999');
      logger.info('✅ Coluna priority adicionada');
      
      // Set initial priorities based on creation order
      await db.query(`
        UPDATE agent_bots 
        SET priority = (
          SELECT COUNT(*) 
          FROM agent_bots b2 
          WHERE b2.user_id = agent_bots.user_id 
          AND b2.created_at <= agent_bots.created_at
        )
      `);
      logger.info('✅ Prioridades iniciais definidas baseadas na ordem de criação');
    } else {
      logger.info('ℹ️ Coluna priority já existe');
    }
    
    // Add is_default column if not exists
    if (!columns.includes('is_default')) {
      await db.query('ALTER TABLE agent_bots ADD COLUMN is_default INTEGER DEFAULT 0');
      logger.info('✅ Coluna is_default adicionada');
      
      // Set the first bot (lowest priority) as default for each user
      await db.query(`
        UPDATE agent_bots 
        SET is_default = 1 
        WHERE id IN (
          SELECT id FROM (
            SELECT id, user_id, MIN(priority) as min_priority
            FROM agent_bots
            GROUP BY user_id
          )
        )
      `);
      logger.info('✅ Bots padrão definidos para cada usuário');
    } else {
      logger.info('ℹ️ Coluna is_default já existe');
    }
    
    // Create index on priority for performance
    try {
      await db.query('CREATE INDEX IF NOT EXISTS idx_bots_priority ON agent_bots(user_id, priority)');
      logger.info('✅ Índice idx_bots_priority criado');
    } catch (e) {
      logger.info('ℹ️ Índice idx_bots_priority já existe ou erro ao criar:', e.message);
    }
    
    logger.info('✅ Migration 039 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 039:', error.message);
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
    logger.info('🔄 Revertendo migration 039: Remover priority e is_default da tabela agent_bots');
    
    // SQLite doesn't support DROP COLUMN directly, need to recreate table
    // For simplicity, we'll just log that manual intervention is needed
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. Colunas priority e is_default permanecerão na tabela.');
    logger.warn('⚠️ Para remover completamente, recrie a tabela agent_bots manualmente.');
    
    logger.info('✅ Migration 039 revertida (parcialmente)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 039:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 39,
  description: 'Add priority and is_default columns to agent_bots table'
};
