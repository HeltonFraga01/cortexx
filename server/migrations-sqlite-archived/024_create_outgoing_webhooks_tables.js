/**
 * Migration: Create outgoing_webhooks and webhook_deliveries tables for chat interface
 * Version: 024
 * Date: 2025-12-04
 * 
 * This migration creates tables for configuring outgoing webhooks and logging
 * delivery attempts for external system integration.
 * 
 * Requirements: 16.1-16.6
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 024: Criar tabelas outgoing_webhooks e webhook_deliveries');
    
    // Check if outgoing_webhooks table already exists
    const webhooksCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='outgoing_webhooks'"
    );
    
    if (webhooksCheck.rows.length === 0) {
      // Create outgoing_webhooks table
      const createWebhooksSql = `
        CREATE TABLE outgoing_webhooks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL UNIQUE,
          url TEXT NOT NULL,
          events TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          last_delivery_at DATETIME,
          last_error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      await db.query(createWebhooksSql);
      logger.info('✅ Tabela outgoing_webhooks criada');
      
      // Create index for outgoing_webhooks
      await db.query('CREATE INDEX idx_outgoing_webhooks_user_id ON outgoing_webhooks(user_id)');
      logger.info('✅ Índice idx_outgoing_webhooks_user_id criado');
    } else {
      logger.info('ℹ️ Tabela outgoing_webhooks já existe');
    }
    
    // Check if webhook_deliveries table already exists
    const deliveriesCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='webhook_deliveries'"
    );
    
    if (deliveriesCheck.rows.length === 0) {
      // Create webhook_deliveries table
      const createDeliveriesSql = `
        CREATE TABLE webhook_deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          webhook_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          payload TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending')),
          response_code INTEGER,
          response_body TEXT,
          attempts INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivered_at DATETIME,
          FOREIGN KEY (webhook_id) REFERENCES outgoing_webhooks(id) ON DELETE CASCADE
        )
      `;
      
      await db.query(createDeliveriesSql);
      logger.info('✅ Tabela webhook_deliveries criada');
      
      // Create indexes for webhook_deliveries
      await db.query('CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id)');
      logger.info('✅ Índice idx_webhook_deliveries_webhook_id criado');
      
      await db.query('CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status)');
      logger.info('✅ Índice idx_webhook_deliveries_status criado');
      
      await db.query('CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC)');
      logger.info('✅ Índice idx_webhook_deliveries_created_at criado');
    } else {
      logger.info('ℹ️ Tabela webhook_deliveries já existe');
    }
    
    logger.info('✅ Migration 024 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 024:', error.message);
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
    logger.info('🔄 Revertendo migration 024: Remover tabelas outgoing_webhooks e webhook_deliveries');
    
    // Drop deliveries table first (due to foreign key)
    await db.query('DROP TABLE IF EXISTS webhook_deliveries');
    logger.info('✅ Tabela webhook_deliveries removida');
    
    await db.query('DROP TABLE IF EXISTS outgoing_webhooks');
    logger.info('✅ Tabela outgoing_webhooks removida');
    
    logger.info('✅ Migration 024 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 024:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 24,
  description: 'Create outgoing_webhooks and webhook_deliveries tables for chat interface'
};
