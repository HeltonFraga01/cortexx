/**
 * Migration: Add secret column to outgoing_webhooks and fix webhook_deliveries
 * Version: 033
 * Date: 2025-12-05
 * 
 * This migration adds the missing 'secret' column to outgoing_webhooks table
 * and adds missing columns to webhook_deliveries table.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 033: Adicionar coluna secret em outgoing_webhooks');
    
    // Check if secret column exists in outgoing_webhooks
    const columnsResult = await db.query("PRAGMA table_info(outgoing_webhooks)");
    const columns = columnsResult.rows || [];
    const hasSecret = columns.some(col => col.name === 'secret');
    
    if (!hasSecret) {
      await db.query('ALTER TABLE outgoing_webhooks ADD COLUMN secret TEXT');
      logger.info('✅ Coluna secret adicionada em outgoing_webhooks');
    } else {
      logger.info('ℹ️ Coluna secret já existe em outgoing_webhooks');
    }
    
    // Check webhook_deliveries columns
    const deliveriesColumnsResult = await db.query("PRAGMA table_info(webhook_deliveries)");
    const deliveriesColumns = deliveriesColumnsResult.rows || [];
    
    // Add missing columns to webhook_deliveries
    const hasDeliveryId = deliveriesColumns.some(col => col.name === 'delivery_id');
    if (!hasDeliveryId) {
      await db.query('ALTER TABLE webhook_deliveries ADD COLUMN delivery_id TEXT');
      logger.info('✅ Coluna delivery_id adicionada em webhook_deliveries');
    }
    
    const hasSuccess = deliveriesColumns.some(col => col.name === 'success');
    if (!hasSuccess) {
      await db.query('ALTER TABLE webhook_deliveries ADD COLUMN success INTEGER DEFAULT 0');
      logger.info('✅ Coluna success adicionada em webhook_deliveries');
    }
    
    const hasResponseStatus = deliveriesColumns.some(col => col.name === 'response_status');
    if (!hasResponseStatus) {
      await db.query('ALTER TABLE webhook_deliveries ADD COLUMN response_status INTEGER');
      logger.info('✅ Coluna response_status adicionada em webhook_deliveries');
    }
    
    const hasError = deliveriesColumns.some(col => col.name === 'error');
    if (!hasError) {
      await db.query('ALTER TABLE webhook_deliveries ADD COLUMN error TEXT');
      logger.info('✅ Coluna error adicionada em webhook_deliveries');
    }
    
    const hasDurationMs = deliveriesColumns.some(col => col.name === 'duration_ms');
    if (!hasDurationMs) {
      await db.query('ALTER TABLE webhook_deliveries ADD COLUMN duration_ms INTEGER');
      logger.info('✅ Coluna duration_ms adicionada em webhook_deliveries');
    }
    
    logger.info('✅ Migration 033 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 033:', error.message);
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
    logger.info('🔄 Revertendo migration 033');
    // SQLite doesn't support DROP COLUMN easily, so we skip rollback
    logger.info('ℹ️ Rollback não implementado para esta migration (SQLite limitation)');
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 033:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 33,
  description: 'Add secret column to outgoing_webhooks and fix webhook_deliveries'
};
