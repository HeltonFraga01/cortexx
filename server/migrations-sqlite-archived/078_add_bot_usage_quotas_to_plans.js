/**
 * Migration: Add bot usage quota columns to plans table
 * Version: 078
 * Date: 2025-12-15
 * 
 * This migration adds 6 new quota columns for controlling bot usage:
 * - max_bot_calls_per_day/month: Webhook calls to bots
 * - max_bot_messages_per_day/month: Messages sent by bots
 * - max_bot_tokens_per_day/month: AI tokens consumed by bots
 * 
 * Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 8.1-8.7
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 078: Adicionar quotas de uso de bot à tabela plans');
    
    // Check which columns already exist
    const tableInfo = await db.query("PRAGMA table_info(plans)");
    const existingColumns = tableInfo.rows.map(col => col.name);
    
    const columnsToAdd = [
      { name: 'max_bot_calls_per_day', default: 100 },
      { name: 'max_bot_calls_per_month', default: 3000 },
      { name: 'max_bot_messages_per_day', default: 50 },
      { name: 'max_bot_messages_per_month', default: 1500 },
      { name: 'max_bot_tokens_per_day', default: 10000 },
      { name: 'max_bot_tokens_per_month', default: 300000 }
    ];
    
    // Add each column if it doesn't exist
    for (const col of columnsToAdd) {
      if (existingColumns.includes(col.name)) {
        logger.info(`ℹ️ Coluna ${col.name} já existe na tabela plans`);
        continue;
      }
      
      await db.query(`ALTER TABLE plans ADD COLUMN ${col.name} INTEGER DEFAULT ${col.default}`);
      logger.info(`✅ Coluna ${col.name} adicionada à tabela plans`);
    }
    
    // Update existing plans with appropriate bot quota limits
    // Free plan: Lower limits
    await db.query(`
      UPDATE plans SET 
        max_bot_calls_per_day = 50,
        max_bot_calls_per_month = 1500,
        max_bot_messages_per_day = 25,
        max_bot_messages_per_month = 750,
        max_bot_tokens_per_day = 5000,
        max_bot_tokens_per_month = 150000
      WHERE name = 'Free'
    `);
    logger.info('✅ Quotas de bot atualizadas para plano Free');
    
    // Basic plan: Default limits
    await db.query(`
      UPDATE plans SET 
        max_bot_calls_per_day = 100,
        max_bot_calls_per_month = 3000,
        max_bot_messages_per_day = 50,
        max_bot_messages_per_month = 1500,
        max_bot_tokens_per_day = 10000,
        max_bot_tokens_per_month = 300000
      WHERE name = 'Basic'
    `);
    logger.info('✅ Quotas de bot atualizadas para plano Basic');
    
    // Pro plan: Higher limits
    await db.query(`
      UPDATE plans SET 
        max_bot_calls_per_day = 500,
        max_bot_calls_per_month = 15000,
        max_bot_messages_per_day = 250,
        max_bot_messages_per_month = 7500,
        max_bot_tokens_per_day = 50000,
        max_bot_tokens_per_month = 1500000
      WHERE name = 'Pro'
    `);
    logger.info('✅ Quotas de bot atualizadas para plano Pro');
    
    // Enterprise plan: Much higher limits
    await db.query(`
      UPDATE plans SET 
        max_bot_calls_per_day = 2000,
        max_bot_calls_per_month = 60000,
        max_bot_messages_per_day = 1000,
        max_bot_messages_per_month = 30000,
        max_bot_tokens_per_day = 200000,
        max_bot_tokens_per_month = 6000000
      WHERE name = 'Enterprise'
    `);
    logger.info('✅ Quotas de bot atualizadas para plano Enterprise');
    
    logger.info('✅ Migration 078 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 078:', error.message);
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
    logger.info('🔄 Revertendo migration 078: Remover quotas de uso de bot da tabela plans');
    
    // SQLite doesn't support DROP COLUMN directly
    // For simplicity, we'll just log a warning since this is rarely needed
    logger.warn('⚠️ SQLite não suporta DROP COLUMN. As colunas de quota de bot permanecerão na tabela.');
    
    logger.info('✅ Migration 078 revertida (parcialmente)');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 078:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 78,
  description: 'Add bot usage quota columns to plans table'
};
