/**
 * Migration: Create contact_notes table
 * Version: 036
 * Date: 2025-12-05
 * 
 * This migration creates the contact_notes table for storing
 * notes associated with contacts.
 * 
 * Requirements: 2.1, 2.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 036: Criar tabela contact_notes');
    
    // Check if contact_notes table already exists
    const tableCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='contact_notes'"
    );
    
    if (tableCheck.rows.length === 0) {
      // Create contact_notes table
      const createTableSql = `
        CREATE TABLE contact_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          contact_jid TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `;
      
      await db.query(createTableSql);
      logger.info('✅ Tabela contact_notes criada');
      
      // Create indexes
      await db.query('CREATE INDEX idx_contact_notes_user_jid ON contact_notes(user_id, contact_jid)');
      logger.info('✅ Índice idx_contact_notes_user_jid criado');
      
      await db.query('CREATE INDEX idx_contact_notes_user ON contact_notes(user_id)');
      logger.info('✅ Índice idx_contact_notes_user criado');
      
      await db.query('CREATE INDEX idx_contact_notes_created ON contact_notes(created_at DESC)');
      logger.info('✅ Índice idx_contact_notes_created criado');
    } else {
      logger.info('ℹ️ Tabela contact_notes já existe');
    }
    
    logger.info('✅ Migration 036 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 036:', error.message);
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
    logger.info('🔄 Revertendo migration 036: Remover tabela contact_notes');
    
    await db.query('DROP TABLE IF EXISTS contact_notes');
    logger.info('✅ Tabela contact_notes removida');
    
    logger.info('✅ Migration 036 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 036:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 36,
  description: 'Create contact_notes table for contact notes'
};
