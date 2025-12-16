/**
 * Migration: Add og_image_url column to branding_config
 * Version: 049
 * Date: 2025-12-09
 * 
 * This migration adds support for:
 * - Open Graph image URL for social media sharing
 * - Used when sharing links on WhatsApp, Facebook, LinkedIn, etc.
 * - Recommended size: 1200x630 pixels
 * 
 * Requirements: Social media preview image configuration
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 049: Adicionar coluna og_image_url à tabela branding_config');
    
    // Check if column already exists
    const tableInfo = await db.query("PRAGMA table_info(branding_config)");
    const columns = tableInfo.rows.map(row => row.name);
    
    if (columns.includes('og_image_url')) {
      logger.info('ℹ️ Coluna og_image_url já existe na tabela branding_config');
      return;
    }
    
    // Add og_image_url column
    const alterTableSql = `
      ALTER TABLE branding_config ADD COLUMN og_image_url TEXT DEFAULT NULL
    `;
    
    await db.query(alterTableSql);
    logger.info('✅ Coluna og_image_url adicionada à tabela branding_config');
    
    logger.info('✅ Migration 049 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 049:', error.message);
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
    logger.info('🔄 Revertendo migration 049: Remover coluna og_image_url');
    
    // Note: SQLite doesn't support DROP COLUMN directly
    // The column will remain but be unused if rollback is needed
    
    logger.warn('⚠️ SQLite não suporta DROP COLUMN diretamente. A coluna og_image_url permanecerá mas não será utilizada.');
    
    logger.info('✅ Migration 049 revertida (coluna mantida mas não utilizada)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 049:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 49,
  description: 'Add og_image_url column to branding_config table for social media sharing'
};
