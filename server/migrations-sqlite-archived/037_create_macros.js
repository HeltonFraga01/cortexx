/**
 * Migration: Create macros and macro_actions tables
 * Version: 037
 * Date: 2025-12-05
 * 
 * This migration creates the macros and macro_actions tables for storing
 * automated action sequences that can be executed on conversations.
 * 
 * Requirements: 5.5, 5.6
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 037: Criar tabelas macros e macro_actions');
    
    // Check if macros table already exists
    const macrosCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='macros'"
    );
    
    if (macrosCheck.rows.length === 0) {
      // Create macros table
      const createMacrosSql = `
        CREATE TABLE macros (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          UNIQUE(user_id, name)
        )
      `;
      
      await db.query(createMacrosSql);
      logger.info('✅ Tabela macros criada');
      
      // Create index for macros
      await db.query('CREATE INDEX idx_macros_user ON macros(user_id)');
      logger.info('✅ Índice idx_macros_user criado');
    } else {
      logger.info('ℹ️ Tabela macros já existe');
    }
    
    // Check if macro_actions table already exists
    const actionsCheck = await db.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='macro_actions'"
    );
    
    if (actionsCheck.rows.length === 0) {
      // Create macro_actions table
      const createActionsSql = `
        CREATE TABLE macro_actions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          macro_id INTEGER NOT NULL,
          action_type TEXT NOT NULL,
          params TEXT NOT NULL,
          action_order INTEGER NOT NULL,
          FOREIGN KEY (macro_id) REFERENCES macros(id) ON DELETE CASCADE
        )
      `;
      
      await db.query(createActionsSql);
      logger.info('✅ Tabela macro_actions criada');
      
      // Create indexes for macro_actions
      await db.query('CREATE INDEX idx_macro_actions_macro ON macro_actions(macro_id)');
      logger.info('✅ Índice idx_macro_actions_macro criado');
      
      await db.query('CREATE INDEX idx_macro_actions_order ON macro_actions(macro_id, action_order)');
      logger.info('✅ Índice idx_macro_actions_order criado');
    } else {
      logger.info('ℹ️ Tabela macro_actions já existe');
    }
    
    logger.info('✅ Migration 037 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 037:', error.message);
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
    logger.info('🔄 Revertendo migration 037: Remover tabelas macros e macro_actions');
    
    // Drop macro_actions first (due to foreign key)
    await db.query('DROP TABLE IF EXISTS macro_actions');
    logger.info('✅ Tabela macro_actions removida');
    
    await db.query('DROP TABLE IF EXISTS macros');
    logger.info('✅ Tabela macros removida');
    
    logger.info('✅ Migration 037 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 037:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 37,
  description: 'Create macros and macro_actions tables for automated actions'
};
