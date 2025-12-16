/**
 * Migration: Create bot_templates table for admin automation
 * Version: 045
 * Date: 2025-12-08
 * 
 * This migration creates the bot_templates table to store
 * reusable bot configurations that can be applied to new users.
 * 
 * Requirements: 2.1, 2.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 045: Criar tabela bot_templates');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='bot_templates'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela bot_templates já existe');
      return;
    }
    
    // Create bot_templates table
    const createTableSql = `
      CREATE TABLE bot_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        outgoing_url TEXT NOT NULL,
        include_history INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela bot_templates criada');
    
    // Create index for default template lookup
    await db.query('CREATE INDEX idx_bot_templates_default ON bot_templates(is_default)');
    logger.info('✅ Índice idx_bot_templates_default criado');
    
    logger.info('✅ Migration 045 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 045:', error.message);
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
    logger.info('🔄 Revertendo migration 045: Remover tabela bot_templates');
    
    await db.query('DROP TABLE IF EXISTS bot_templates');
    logger.info('✅ Tabela bot_templates removida');
    
    logger.info('✅ Migration 045 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 045:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 45,
  description: 'Create bot_templates table for admin automation'
};
