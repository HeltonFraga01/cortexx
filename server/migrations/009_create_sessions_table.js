/**
 * Migration: Create sessions table for express-session
 * Version: 009
 * Date: 2025-11-16
 * 
 * This migration creates the sessions table required by connect-sqlite3
 * for storing HTTP session data securely on the server side.
 */

const { logger } = require('../utils/logger');

/**
 * Apply migration - Create sessions table
 * @param {Object} db - Database instance
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migração 009: Criando tabela sessions');
    
    // Check if table already exists
    const checkTableSql = `
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name='sessions'
    `;
    
    const { rows } = await db.query(checkTableSql);
    
    if (rows[0].count > 0) {
      logger.info('ℹ️ Tabela sessions já existe, pulando migração');
      return;
    }
    
    // Create sessions table
    const createTableSql = `
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired INTEGER NOT NULL
      )
    `;
    
    await db.query(createTableSql);
    
    // Create index on expired column for efficient cleanup
    const createIndexSql = `
      CREATE INDEX IF NOT EXISTS sessions_expired_idx 
      ON sessions(expired)
    `;
    
    await db.query(createIndexSql);
    
    logger.info('✅ Tabela sessions criada com sucesso');
    logger.info('✅ Índice sessions_expired_idx criado com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migração 009:', error.message);
    throw error;
  }
}

/**
 * Rollback migration - Drop sessions table
 * @param {Object} db - Database instance
 */
async function down(db) {
  try {
    logger.info('🔄 Revertendo migração 009: Removendo tabela sessions');
    
    const dropTableSql = 'DROP TABLE IF EXISTS sessions';
    await db.query(dropTableSql);
    
    logger.info('✅ Tabela sessions removida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migração 009:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 9,
  description: 'Create sessions table for express-session storage'
};
