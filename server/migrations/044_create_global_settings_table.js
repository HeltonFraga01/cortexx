/**
 * Migration: Create global_settings table for admin automation
 * Version: 044
 * Date: 2025-12-08
 * 
 * This migration creates the global_settings table to store
 * platform-wide automation configuration as key-value pairs.
 * 
 * Requirements: 4.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 044: Criar tabela global_settings');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='global_settings'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela global_settings já existe');
      return;
    }
    
    // Create global_settings table
    const createTableSql = `
      CREATE TABLE global_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela global_settings criada');
    
    // Create index for fast key lookups
    await db.query('CREATE INDEX idx_global_settings_key ON global_settings(key)');
    logger.info('✅ Índice idx_global_settings_key criado');
    
    // Insert default settings
    const defaultSettings = [
      { key: 'automation.bot.enabled', value: 'false' },
      { key: 'automation.bot.defaultTemplateId', value: 'null' },
      { key: 'automation.labels.enabled', value: 'false' },
      { key: 'automation.cannedResponses.enabled', value: 'false' },
      { key: 'automation.webhooks.enabled', value: 'false' },
      { key: 'automation.webhooks.defaultEvents', value: '[]' },
      { key: 'automation.auditLog.retentionDays', value: '90' }
    ];
    
    for (const setting of defaultSettings) {
      await db.query(
        'INSERT INTO global_settings (key, value) VALUES (?, ?)',
        [setting.key, setting.value]
      );
    }
    logger.info('✅ Configurações padrão inseridas');
    
    logger.info('✅ Migration 044 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 044:', error.message);
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
    logger.info('🔄 Revertendo migration 044: Remover tabela global_settings');
    
    await db.query('DROP TABLE IF EXISTS global_settings');
    logger.info('✅ Tabela global_settings removida');
    
    logger.info('✅ Migration 044 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 044:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 44,
  description: 'Create global_settings table for admin automation'
};
