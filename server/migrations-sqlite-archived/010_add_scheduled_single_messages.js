/**
 * Migration: Add scheduled single messages table
 * Version: 010
 * Date: 2025-11-17
 * 
 * This migration adds support for scheduled single messages with:
 * - Message scheduling
 * - Status tracking
 * - Integration with message history
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 010: Criar tabela de mensagens únicas agendadas');
    
    // Create scheduled_single_messages table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS scheduled_single_messages (
        id TEXT PRIMARY KEY,
        user_token TEXT NOT NULL,
        instance TEXT NOT NULL,
        recipient TEXT NOT NULL,
        recipient_name TEXT,
        message_type TEXT NOT NULL CHECK(message_type IN ('text', 'media')),
        message_content TEXT NOT NULL,
        media_data TEXT,
        scheduled_at DATETIME NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
        error_message TEXT,
        sent_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela scheduled_single_messages criada com sucesso');
    
    // Create indexes
    const indexes = [
      {
        name: 'idx_scheduled_single_messages_user_token',
        sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_user_token ON scheduled_single_messages(user_token)'
      },
      {
        name: 'idx_scheduled_single_messages_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_status ON scheduled_single_messages(status)'
      },
      {
        name: 'idx_scheduled_single_messages_scheduled_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_scheduled_at ON scheduled_single_messages(scheduled_at) WHERE status = \'pending\''
      },
      {
        name: 'idx_scheduled_single_messages_instance',
        sql: 'CREATE INDEX IF NOT EXISTS idx_scheduled_single_messages_instance ON scheduled_single_messages(instance)'
      }
    ];
    
    for (const index of indexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    logger.info('✅ Migration 010 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 010:', error.message);
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
    logger.info('🔄 Revertendo migration 010: Remover tabela de mensagens únicas agendadas');
    
    // Drop indexes first
    const indexes = [
      'idx_scheduled_single_messages_instance',
      'idx_scheduled_single_messages_scheduled_at',
      'idx_scheduled_single_messages_status',
      'idx_scheduled_single_messages_user_token'
    ];
    
    for (const index of indexes) {
      await db.query(`DROP INDEX IF EXISTS ${index}`);
      logger.info(`✅ Índice ${index} removido`);
    }
    
    // Drop table
    await db.query('DROP TABLE IF EXISTS scheduled_single_messages');
    logger.info('✅ Tabela scheduled_single_messages removida');
    
    logger.info('✅ Migration 010 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 010:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 10,
  description: 'Add scheduled single messages table'
};
