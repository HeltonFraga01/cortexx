/**
 * Migration: Create admin_audit_log table for administrative action tracking
 * Version: 065
 * Date: 2025-12-09
 * 
 * This migration creates the admin_audit_log table to track all administrative actions.
 * Provides complete audit trail for compliance and investigation.
 * 
 * Requirements: 9.1
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 065: Criar tabela admin_audit_log');
    
    // Check if table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_audit_log'"
    );
    
    if (tableCheck.rows.length > 0) {
      logger.info('ℹ️ Tabela admin_audit_log já existe');
      return;
    }
    
    // Create admin_audit_log table
    const createTableSql = `
      CREATE TABLE admin_audit_log (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        target_user_id TEXT,
        target_resource_type TEXT,
        target_resource_id TEXT,
        details TEXT DEFAULT '{}',
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela admin_audit_log criada');
    
    // Create indexes for performance
    await db.query('CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id)');
    logger.info('✅ Índice idx_admin_audit_log_admin_id criado');
    
    await db.query('CREATE INDEX idx_admin_audit_log_target_user ON admin_audit_log(target_user_id)');
    logger.info('✅ Índice idx_admin_audit_log_target_user criado');
    
    await db.query('CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at)');
    logger.info('✅ Índice idx_admin_audit_log_created_at criado');
    
    await db.query('CREATE INDEX idx_admin_audit_log_action_type ON admin_audit_log(action_type)');
    logger.info('✅ Índice idx_admin_audit_log_action_type criado');
    
    logger.info('✅ Migration 065 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 065:', error.message);
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
    logger.info('🔄 Revertendo migration 065: Remover tabela admin_audit_log');
    
    await db.query('DROP TABLE IF EXISTS admin_audit_log');
    logger.info('✅ Tabela admin_audit_log removida');
    
    logger.info('✅ Migration 065 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 065:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 65,
  description: 'Create admin_audit_log table for administrative action tracking'
};
