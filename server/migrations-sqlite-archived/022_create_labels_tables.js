/**
 * Migration: Create labels and conversation_labels tables for chat interface
 * Version: 022
 * Date: 2025-12-04
 * 
 * This migration creates the labels table and conversation_labels junction table
 * for organizing and categorizing conversations with colored tags.
 * 
 * Requirements: 20.1-20.5
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 022: Criar tabelas labels e conversation_labels');
    
    // Check if labels table already exists
    const labelsCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='labels'"
    );
    
    if (labelsCheck.rows.length === 0) {
      // Create labels table
      const createLabelsSql = `
        CREATE TABLE labels (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          color TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        )
      `;
      
      await db.query(createLabelsSql);
      logger.info('✅ Tabela labels criada');
      
      // Create index for labels
      await db.query('CREATE INDEX idx_labels_user_id ON labels(user_id)');
      logger.info('✅ Índice idx_labels_user_id criado');
    } else {
      logger.info('ℹ️ Tabela labels já existe');
    }
    
    // Check if conversation_labels table already exists
    const junctionCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='conversation_labels'"
    );
    
    if (junctionCheck.rows.length === 0) {
      // Create conversation_labels junction table
      const createJunctionSql = `
        CREATE TABLE conversation_labels (
          conversation_id INTEGER NOT NULL,
          label_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (conversation_id, label_id),
          FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
        )
      `;
      
      await db.query(createJunctionSql);
      logger.info('✅ Tabela conversation_labels criada');
      
      // Create indexes for junction table
      await db.query('CREATE INDEX idx_conv_labels_conversation ON conversation_labels(conversation_id)');
      logger.info('✅ Índice idx_conv_labels_conversation criado');
      
      await db.query('CREATE INDEX idx_conv_labels_label ON conversation_labels(label_id)');
      logger.info('✅ Índice idx_conv_labels_label criado');
    } else {
      logger.info('ℹ️ Tabela conversation_labels já existe');
    }
    
    logger.info('✅ Migration 022 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 022:', error.message);
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
    logger.info('🔄 Revertendo migration 022: Remover tabelas labels e conversation_labels');
    
    // Drop junction table first (due to foreign key)
    await db.query('DROP TABLE IF EXISTS conversation_labels');
    logger.info('✅ Tabela conversation_labels removida');
    
    await db.query('DROP TABLE IF EXISTS labels');
    logger.info('✅ Tabela labels removida');
    
    logger.info('✅ Migration 022 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 022:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 22,
  description: 'Create labels and conversation_labels tables for chat interface'
};
