/**
 * Migration: Create contact_attributes table
 * Version: 035
 * Date: 2025-12-05
 * 
 * This migration creates the contact_attributes table for storing
 * custom attributes associated with contacts.
 * 
 * Requirements: 1.1, 1.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 035: Criar tabela contact_attributes');
    
    // Check if contact_attributes table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='contact_attributes'"
    );
    
    if (tableCheck.rows.length === 0) {
      // Create contact_attributes table
      const createTableSql = `
        CREATE TABLE contact_attributes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          contact_jid TEXT NOT NULL,
          name TEXT NOT NULL,
          value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, contact_jid, name)
        )
      `;
      
      await db.query(createTableSql);
      logger.info('✅ Tabela contact_attributes criada');
      
      // Create indexes
      await db.query('CREATE INDEX idx_contact_attrs_user_jid ON contact_attributes(user_id, contact_jid)');
      logger.info('✅ Índice idx_contact_attrs_user_jid criado');
      
      await db.query('CREATE INDEX idx_contact_attrs_user ON contact_attributes(user_id)');
      logger.info('✅ Índice idx_contact_attrs_user criado');
    } else {
      logger.info('ℹ️ Tabela contact_attributes já existe');
    }
    
    logger.info('✅ Migration 035 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 035:', error.message);
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
    logger.info('🔄 Revertendo migration 035: Remover tabela contact_attributes');
    
    await db.query('DROP TABLE IF EXISTS contact_attributes');
    logger.info('✅ Tabela contact_attributes removida');
    
    logger.info('✅ Migration 035 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 035:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 35,
  description: 'Create contact_attributes table for custom contact attributes'
};
