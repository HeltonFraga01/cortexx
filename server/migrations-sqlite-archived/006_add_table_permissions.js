/**
 * Migration: Add table_permissions table for user table access control
 * Version: 006
 * Date: 2025-11-11
 * 
 * This migration adds support for granular table-level permissions,
 * allowing administrators to control which users can read, write, or delete
 * records from specific database tables.
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 006: Criar tabela table_permissions');
    
    // Check if table already exists
    const checkTableSql = `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name='table_permissions'
    `;
    
    const { rows } = await db.query(checkTableSql);
    
    if (rows[0].count > 0) {
      logger.info('ℹ️ Tabela table_permissions já existe, pulando migration');
      return;
    }
    
    // Create table_permissions table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS table_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        table_name TEXT NOT NULL,
        can_read BOOLEAN DEFAULT 0,
        can_write BOOLEAN DEFAULT 0,
        can_delete BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, table_name)
      )
    `;
    
    await db.query(createTableSql);
    logger.info('✅ Tabela table_permissions criada com sucesso');
    
    // Create index on user_id for fast permission lookups
    const createUserIdIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_table_permissions_user_id 
      ON table_permissions(user_id)
    `;
    
    await db.query(createUserIdIndexSql);
    logger.info('✅ Índice idx_table_permissions_user_id criado');
    
    // Create index on table_name for fast table-based queries
    const createTableNameIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_table_permissions_table_name 
      ON table_permissions(table_name)
    `;
    
    await db.query(createTableNameIndexSql);
    logger.info('✅ Índice idx_table_permissions_table_name criado');
    
    // Create composite index for optimal permission checks
    const createCompositeIndexSql = `
      CREATE INDEX IF NOT EXISTS idx_table_permissions_composite 
      ON table_permissions(user_id, table_name)
    `;
    
    await db.query(createCompositeIndexSql);
    logger.info('✅ Índice idx_table_permissions_composite criado');
    
    logger.info('✅ Migration 006 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 006:', error.message);
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
    logger.info('🔄 Revertendo migration 006: Remover tabela table_permissions');
    
    // Drop indexes first
    await db.query('DROP INDEX IF EXISTS idx_table_permissions_composite');
    logger.info('✅ Índice idx_table_permissions_composite removido');
    
    await db.query('DROP INDEX IF EXISTS idx_table_permissions_table_name');
    logger.info('✅ Índice idx_table_permissions_table_name removido');
    
    await db.query('DROP INDEX IF EXISTS idx_table_permissions_user_id');
    logger.info('✅ Índice idx_table_permissions_user_id removido');
    
    // Drop table
    await db.query('DROP TABLE IF EXISTS table_permissions');
    logger.info('✅ Tabela table_permissions removida');
    
    logger.info('✅ Migration 006 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 006:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 6,
  description: 'Add table_permissions table for user table access control'
};
