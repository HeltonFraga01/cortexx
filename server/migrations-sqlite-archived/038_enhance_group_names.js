/**
 * Migration: Enhance group name tracking
 * 
 * Adds fields to track the source and timestamp of group names.
 * This allows the system to:
 * - Know where a group name came from (webhook, API, or fallback)
 * - Track when the name was last updated
 * - Make intelligent decisions about when to refresh names
 */

const { logger } = require('../utils/logger');

async function up(db) {
  try {
    logger.info('🔄 Executando migration 038: Adicionar campos de rastreamento de nome de grupo');
    
    // Check existing columns
    const { rows } = await db.query("PRAGMA table_info(conversations)");
    const hasNameSource = rows.some(col => col.name === 'name_source');
    const hasNameUpdatedAt = rows.some(col => col.name === 'name_updated_at');
    
    // Add name_source column if not exists
    if (!hasNameSource) {
      await db.query(`
        ALTER TABLE conversations 
        ADD COLUMN name_source TEXT DEFAULT NULL
      `);
      logger.info('✅ Coluna name_source adicionada');
    } else {
      logger.info('ℹ️ Coluna name_source já existe');
    }

    // Add name_updated_at column if not exists
    if (!hasNameUpdatedAt) {
      await db.query(`
        ALTER TABLE conversations 
        ADD COLUMN name_updated_at TEXT DEFAULT NULL
      `);
      logger.info('✅ Coluna name_updated_at adicionada');
    } else {
      logger.info('ℹ️ Coluna name_updated_at já existe');
    }

    // Create index for efficient queries on name_source
    try {
      await db.query(`
        CREATE INDEX IF NOT EXISTS idx_conversations_name_source 
        ON conversations(name_source)
      `);
      logger.info('✅ Índice idx_conversations_name_source criado');
    } catch (e) {
      logger.info('ℹ️ Índice idx_conversations_name_source já existe');
    }

    logger.info('✅ Migration 038 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 038:', error.message);
    throw error;
  }
}

async function down(db) {
  // SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
  // For simplicity in development, we'll just note that this would require table recreation
  console.log('⚠️  Note: SQLite does not support DROP COLUMN. To rollback, recreate the conversations table without these columns.');
  
  // In production, you would:
  // 1. Create new table without these columns
  // 2. Copy data from old table
  // 3. Drop old table
  // 4. Rename new table
}

module.exports = { up, down };

