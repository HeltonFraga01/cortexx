/**
 * Migration: Add special message type fields
 * 
 * Adds support for edited messages, deleted messages, polls, and interactive messages.
 * 
 * Requirements: 2.2, 3.2, 4.1, 6.1 (unsupported-message-types)
 */

const { logger } = require('../utils/logger')

async function up(db) {
  try {
    logger.info('🔄 Executando migration 041: Adicionar campos de tipos especiais de mensagem')
    
    // Check existing columns
    const { rows } = await db.query("PRAGMA table_info(chat_messages)")
    const existingColumns = rows.map(col => col.name)
    
    // Add is_edited column
    if (!existingColumns.includes('is_edited')) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN is_edited INTEGER DEFAULT 0
      `)
      logger.info('✅ Coluna is_edited adicionada')
    } else {
      logger.info('ℹ️ Coluna is_edited já existe')
    }
    
    // Add is_deleted column
    if (!existingColumns.includes('is_deleted')) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN is_deleted INTEGER DEFAULT 0
      `)
      logger.info('✅ Coluna is_deleted adicionada')
    } else {
      logger.info('ℹ️ Coluna is_deleted já existe')
    }
    
    // Add poll_data column (JSON storage for poll question and options)
    if (!existingColumns.includes('poll_data')) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN poll_data TEXT
      `)
      logger.info('✅ Coluna poll_data adicionada')
    } else {
      logger.info('ℹ️ Coluna poll_data já existe')
    }
    
    // Add interactive_data column (JSON storage for buttons/lists)
    if (!existingColumns.includes('interactive_data')) {
      await db.query(`
        ALTER TABLE chat_messages 
        ADD COLUMN interactive_data TEXT
      `)
      logger.info('✅ Coluna interactive_data adicionada')
    } else {
      logger.info('ℹ️ Coluna interactive_data já existe')
    }
    
    logger.info('✅ Migration 041 concluída com sucesso')
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 041:', error.message)
    throw error
  }
}

async function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions
  // For rollback, we would need to recreate the table
  logger.warn('⚠️ Rollback não suportado para esta migration')
}

module.exports = { up, down }
