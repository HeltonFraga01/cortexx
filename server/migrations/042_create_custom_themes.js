/**
 * Migration: Create custom_themes table
 * Version: 042
 * Date: 2024-12-08
 * 
 * This migration creates the custom_themes table for storing
 * user-created themes from the Page Builder.
 */

const { logger } = require('../utils/logger');

/**
 * Apply migration - Create custom_themes table
 * @param {Object} db - Database instance
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migração 042: Criando tabela custom_themes');
    
    // Check if table already exists
    const checkTableSql = `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name='custom_themes'
    `;
    
    const { rows } = await db.query(checkTableSql);
    
    if (rows[0].count > 0) {
      logger.info('ℹ️ Tabela custom_themes já existe, pulando migração');
      return;
    }
    
    // Create custom_themes table
    const createTableSql = `
      CREATE TABLE custom_themes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        connection_id INTEGER,
        schema TEXT NOT NULL,
        preview_image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (connection_id) REFERENCES database_connections(id) ON DELETE SET NULL
      )
    `;
    
    await db.query(createTableSql);
    
    // Create index for connection_id
    const createIndexSql = `
      CREATE INDEX idx_custom_themes_connection_id ON custom_themes(connection_id)
    `;
    
    await db.query(createIndexSql);
    
    logger.info('✅ Tabela custom_themes criada com sucesso');
    logger.info('✅ Índice idx_custom_themes_connection_id criado');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migração 042:', error);
    throw error;
  }
}

/**
 * Rollback migration - Drop custom_themes table
 * @param {Object} db - Database instance
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migração 042: Removendo tabela custom_themes');
    
    // Drop index first
    await db.query('DROP INDEX IF EXISTS idx_custom_themes_connection_id');
    
    // Drop table
    await db.query('DROP TABLE IF EXISTS custom_themes');
    
    logger.info('✅ Tabela custom_themes removida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migração 042:', error);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 42,
  description: 'Create custom_themes table for Page Builder themes'
};
