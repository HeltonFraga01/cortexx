/**
 * Migration: Add wuzapi_token field to inboxes table
 * Version: 068
 * Date: 2025-12-12
 * 
 * This migration adds the wuzapi_token field to store the WUZAPI user token
 * associated with WhatsApp inboxes.
 * 
 * Requirements: Multi-user inbox system with WUZAPI integration
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 068: Adicionar campo wuzapi_token na tabela inboxes');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(inboxes)");
    const hasWuzapiToken = tableInfo.rows.some(col => col.name === 'wuzapi_token');
    
    if (!hasWuzapiToken) {
      await db.query('ALTER TABLE inboxes ADD COLUMN wuzapi_token TEXT');
      logger.info('✅ Coluna wuzapi_token adicionada à tabela inboxes');
      
      // Create index for wuzapi_token
      await db.query('CREATE INDEX IF NOT EXISTS idx_inboxes_wuzapi_token ON inboxes(wuzapi_token)');
      logger.info('✅ Índice idx_inboxes_wuzapi_token criado');
    } else {
      logger.info('ℹ️ Coluna wuzapi_token já existe na tabela inboxes');
    }
    
    // Check if wuzapi_user_id column exists
    const hasWuzapiUserId = tableInfo.rows.some(col => col.name === 'wuzapi_user_id');
    
    if (!hasWuzapiUserId) {
      await db.query('ALTER TABLE inboxes ADD COLUMN wuzapi_user_id TEXT');
      logger.info('✅ Coluna wuzapi_user_id adicionada à tabela inboxes');
    } else {
      logger.info('ℹ️ Coluna wuzapi_user_id já existe na tabela inboxes');
    }
    
    // Check if wuzapi_connected column exists
    const hasWuzapiConnected = tableInfo.rows.some(col => col.name === 'wuzapi_connected');
    
    if (!hasWuzapiConnected) {
      await db.query('ALTER TABLE inboxes ADD COLUMN wuzapi_connected INTEGER DEFAULT 0');
      logger.info('✅ Coluna wuzapi_connected adicionada à tabela inboxes');
    } else {
      logger.info('ℹ️ Coluna wuzapi_connected já existe na tabela inboxes');
    }
    
    logger.info('✅ Migration 068 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 068:', error.message);
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
    logger.info('🔄 Revertendo migration 068: Remover campos wuzapi da tabela inboxes');
    
    // SQLite doesn't support DROP COLUMN directly, would need to recreate table
    // For simplicity, we'll just log a warning
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. Os campos wuzapi_token, wuzapi_user_id e wuzapi_connected permanecerão na tabela.');
    
    logger.info('✅ Migration 068 revertida (parcialmente)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 068:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 68,
  description: 'Add wuzapi_token, wuzapi_user_id and wuzapi_connected fields to inboxes table'
};
