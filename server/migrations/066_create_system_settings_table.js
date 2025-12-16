/**
 * Migration: Create system_settings table for global configuration
 * Version: 066
 * Date: 2025-12-09
 * 
 * This migration creates the system_settings table to store global system configuration.
 * Settings are key-value pairs with audit tracking.
 * 
 * Requirements: 11.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 066: Criar tabela system_settings');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='system_settings'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela system_settings já existe');
      return;
    }
    
    // Create system_settings table
    const createTableSql = `
      CREATE TABLE system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_by TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela system_settings criada');
    
    // Insert default settings
    const defaultSettings = [
      { key: 'default_plan_id', value: '', description: 'ID do plano padrão para novos usuários' },
      { key: 'trial_duration_days', value: '14', description: 'Duração do período de trial em dias' },
      { key: 'grace_period_days', value: '7', description: 'Período de carência após vencimento em dias' },
      { key: 'password_min_length', value: '8', description: 'Tamanho mínimo da senha' },
      { key: 'password_require_uppercase', value: 'true', description: 'Exigir letra maiúscula na senha' },
      { key: 'password_require_number', value: 'true', description: 'Exigir número na senha' },
      { key: 'global_rate_limit_per_minute', value: '60', description: 'Limite global de requisições por minuto' }
    ];
    
    for (const setting of defaultSettings) {
      await db.query(
        'INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)',
        [setting.key, setting.value, setting.description]
      );
    }
    logger.info('✅ Configurações padrão inseridas');
    
    logger.info('✅ Migration 066 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 066:', error.message);
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
    logger.info('🔄 Revertendo migration 066: Remover tabela system_settings');
    
    await db.query('DROP TABLE IF EXISTS system_settings');
    logger.info('✅ Tabela system_settings removida');
    
    logger.info('✅ Migration 066 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 066:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 66,
  description: 'Create system_settings table for global configuration'
};
