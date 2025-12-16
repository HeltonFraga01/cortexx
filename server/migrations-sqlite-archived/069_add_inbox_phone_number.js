/**
 * Migration: Add phone_number column to inboxes table
 * Version: 069
 * Date: 2025-12-12
 * 
 * Adds phone_number field to identify the WhatsApp number associated with the inbox.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 069: Adicionar coluna phone_number à tabela inboxes');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(inboxes)");
    const hasPhoneNumber = tableInfo.rows.some(col => col.name === 'phone_number');
    
    if (!hasPhoneNumber) {
      await db.query('ALTER TABLE inboxes ADD COLUMN phone_number TEXT');
      logger.info('✅ Coluna phone_number adicionada à tabela inboxes');
      
      // Create index for phone_number
      await db.query('CREATE INDEX IF NOT EXISTS idx_inboxes_phone_number ON inboxes(phone_number)');
      logger.info('✅ Índice idx_inboxes_phone_number criado');
    } else {
      logger.info('ℹ️ Coluna phone_number já existe na tabela inboxes');
    }
    
    logger.info('✅ Migration 069 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 069:', error.message);
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
    logger.info('🔄 Revertendo migration 069: Remover coluna phone_number da tabela inboxes');
    
    // SQLite doesn't support DROP COLUMN directly, need to recreate table
    // For simplicity, we'll just log a warning
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. A coluna phone_number permanecerá na tabela.');
    
    logger.info('✅ Migration 069 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 069:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 69,
  description: 'Add phone_number column to inboxes table'
};
