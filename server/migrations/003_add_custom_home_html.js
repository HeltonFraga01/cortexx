/**
 * Migration: Add custom_home_html column to branding_config table
 * Version: 003
 * Date: 2025-11-07
 * 
 * This migration adds support for custom HTML content on the home page
 * by adding a custom_home_html column to the branding_config table.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 003: Adicionar custom_home_html');
    
    // Check if column already exists
    const checkSql = `
      SELECT COUNT(*) as count 
      FROM pragma_table_info('branding_config') 
      WHERE name = 'custom_home_html'
    `;
    
    const { rows } = await db.query(checkSql);
    
    if (rows[0].count > 0) {
      logger.info('ℹ️ Coluna custom_home_html já existe, pulando migration');
      return;
    }
    
    // Add the column
    const addColumnSql = `
      ALTER TABLE branding_config 
      ADD COLUMN custom_home_html TEXT DEFAULT NULL
    `;
    
    await db.query(addColumnSql);
    
    logger.info('✅ Coluna custom_home_html adicionada com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 003:', error.message);
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
    logger.info('🔄 Revertendo migration 003: Remover custom_home_html');
    
    // SQLite doesn't support DROP COLUMN directly
    logger.warn('⚠️ SQLite não suporta DROP COLUMN diretamente');
    logger.warn('⚠️ Para reverter completamente, seria necessário recriar a tabela');
    logger.warn('⚠️ A coluna custom_home_html permanecerá, mas pode ser ignorada');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 003:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 3,
  description: 'Add custom_home_html column for custom landing page'
};
