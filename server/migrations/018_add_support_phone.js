/**
 * Migration: Add support_phone column to branding_config
 * Version: 018
 * Date: 2025-12-03
 * 
 * This migration adds support for:
 * - WhatsApp support button phone number configuration
 * - Stored in branding_config table for consistency with other branding settings
 * 
 * Requirements: 3.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 018: Adicionar coluna support_phone à tabela branding_config');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(branding_config)");
    const columns = tableInfo.rows.map(row => row.name);
    
    if (columns.includes('support_phone')) {
      logger.info('ℹ️ Coluna support_phone já existe na tabela branding_config');
      return;
    }
    
    // Add support_phone column
    const alterTableSql = `
      ALTER TABLE branding_config ADD COLUMN support_phone TEXT DEFAULT NULL
    `;
    
    await db.query(alterTableSql);
    logger.info('✅ Coluna support_phone adicionada à tabela branding_config');
    
    logger.info('✅ Migration 018 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 018:', error.message);
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
    logger.info('🔄 Revertendo migration 018: Remover coluna support_phone');
    
    // Note: SQLite doesn't support DROP COLUMN directly
    // The column will remain but be unused if rollback is needed
    // For a full rollback, would need to recreate the table
    
    logger.warn('⚠️ SQLite não suporta DROP COLUMN diretamente. A coluna support_phone permanecerá mas não será utilizada.');
    
    logger.info('✅ Migration 018 revertida (coluna mantida mas não utilizada)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 018:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 18,
  description: 'Add support_phone column to branding_config table'
};
