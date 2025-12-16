/**
 * Migration: Create automation_audit_log table for admin automation
 * Version: 048
 * Date: 2025-12-08
 * 
 * This migration creates the automation_audit_log table to track
 * all automation actions applied to users.
 * 
 * Requirements: 9.1, 9.2
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 048: Criar tabela automation_audit_log');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='automation_audit_log'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela automation_audit_log já existe');
      return;
    }
    
    // Create automation_audit_log table
    const createTableSql = `
      CREATE TABLE automation_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        automation_type TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL CHECK(status IN ('success', 'failed')),
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela automation_audit_log criada');
    
    // Create indexes for efficient querying
    await db.query('CREATE INDEX idx_audit_log_user ON automation_audit_log(user_id)');
    logger.info('✅ Índice idx_audit_log_user criado');
    
    await db.query('CREATE INDEX idx_audit_log_type ON automation_audit_log(automation_type)');
    logger.info('✅ Índice idx_audit_log_type criado');
    
    await db.query('CREATE INDEX idx_audit_log_created ON automation_audit_log(created_at DESC)');
    logger.info('✅ Índice idx_audit_log_created criado');
    
    await db.query('CREATE INDEX idx_audit_log_status ON automation_audit_log(status)');
    logger.info('✅ Índice idx_audit_log_status criado');
    
    logger.info('✅ Migration 048 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 048:', error.message);
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
    logger.info('🔄 Revertendo migration 048: Remover tabela automation_audit_log');
    
    await db.query('DROP TABLE IF EXISTS automation_audit_log');
    logger.info('✅ Tabela automation_audit_log removida');
    
    logger.info('✅ Migration 048 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 048:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 48,
  description: 'Create automation_audit_log table for admin automation'
};
