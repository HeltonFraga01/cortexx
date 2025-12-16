/**
 * Migration: Add view_configuration column to database_connections table
 * Version: 002
 * Date: 2025-11-07
 * 
 * This migration adds support for advanced view configurations (Calendar and Kanban views)
 * by adding a view_configuration column to store JSON configuration data.
 */

const { logger } = require('../utils/logger');

/**
 * Apply migration - Add view_configuration column
 * @param {Object} db - Database instance
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migração 002: Adicionando coluna view_configuration');
    
    // Check if column already exists
    const checkColumnSql = `
      SELECT COUNT(*) as count 
      FROM pragma_table_info('database_connections') 
      WHERE name = 'view_configuration'
    `;
    
    const { rows } = await db.query(checkColumnSql);
    
    if (rows[0].count > 0) {
      logger.info('ℹ️ Coluna view_configuration já existe, pulando migração');
      return;
    }
    
    // Add view_configuration column
    const addColumnSql = `
      ALTER TABLE database_connections 
      ADD COLUMN view_configuration TEXT DEFAULT NULL
    `;
    
    await db.query(addColumnSql);
    
    logger.info('✅ Coluna view_configuration adicionada com sucesso');
    logger.info('ℹ️ Valores padrão: NULL (compatibilidade retroativa mantida)');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migração 002:', error.message);
    throw error;
  }
}

/**
 * Rollback migration - Remove view_configuration column
 * @param {Object} db - Database instance
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migração 002: Removendo coluna view_configuration');
    
    // SQLite doesn't support DROP COLUMN directly, need to recreate table
    // For safety, we'll just log a warning
    logger.warn('⚠️ SQLite não suporta DROP COLUMN diretamente');
    logger.warn('⚠️ Para reverter completamente, seria necessário recriar a tabela');
    logger.warn('⚠️ A coluna view_configuration permanecerá, mas pode ser ignorada');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migração 002:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 2,
  description: 'Add view_configuration column for Calendar and Kanban views'
};
