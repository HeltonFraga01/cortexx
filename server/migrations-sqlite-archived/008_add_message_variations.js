/**
 * Migration: Add message variations system
 * Version: 008
 * Date: 2025-11-13
 * 
 * This migration adds support for message variation humanization:
 * - message_variations table for tracking variation usage
 * - has_variations column in message_templates table
 * - Indexes for performance optimization
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 008: Adicionar sistema de variações de mensagem');
    
    // 1. Create message_variations table
    const createVariationsTableSql = `
      CREATE TABLE IF NOT EXISTS message_variations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT,
        message_id TEXT,
        template TEXT NOT NULL,
        selected_variations TEXT NOT NULL,
        recipient TEXT,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        delivered BOOLEAN DEFAULT 0,
        read BOOLEAN DEFAULT 0,
        user_id INTEGER,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createVariationsTableSql);
    logger.info('✅ Tabela message_variations criada com sucesso');
    
    // 2. Create indexes for message_variations table
    const variationIndexes = [
      {
        name: 'idx_message_variations_campaign',
        sql: 'CREATE INDEX IF NOT EXISTS idx_message_variations_campaign ON message_variations(campaign_id)'
      },
      {
        name: 'idx_message_variations_user',
        sql: 'CREATE INDEX IF NOT EXISTS idx_message_variations_user ON message_variations(user_id)'
      },
      {
        name: 'idx_message_variations_sent_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_message_variations_sent_at ON message_variations(sent_at)'
      },
      {
        name: 'idx_message_variations_campaign_sent',
        sql: 'CREATE INDEX IF NOT EXISTS idx_message_variations_campaign_sent ON message_variations(campaign_id, sent_at DESC)'
      }
    ];
    
    for (const index of variationIndexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    // 3. Check if message_templates table exists
    const checkTableSql = `
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='message_templates'
    `;
    
    const tableResult = await db.query(checkTableSql);
    
    if (tableResult.rows.length > 0) {
      // Table exists, check if has_variations column already exists
      const checkColumnSql = `
        SELECT COUNT(*) as count 
        FROM pragma_table_info('message_templates') 
        WHERE name = 'has_variations'
      `;
      
      const { rows } = await db.query(checkColumnSql);
      
      if (rows[0].count === 0) {
        // Add has_variations column to message_templates table
        const addColumnSql = `
          ALTER TABLE message_templates 
          ADD COLUMN has_variations BOOLEAN DEFAULT 0
        `;
        
        await db.query(addColumnSql);
        logger.info('✅ Coluna has_variations adicionada à tabela message_templates');
        
        // Create index for has_variations
        const indexSql = `
          CREATE INDEX IF NOT EXISTS idx_message_templates_variations 
          ON message_templates(has_variations)
        `;
        
        await db.query(indexSql);
        logger.info('✅ Índice idx_message_templates_variations criado');
      } else {
        logger.info('ℹ️ Coluna has_variations já existe na tabela message_templates');
      }
    } else {
      logger.info('ℹ️ Tabela message_templates não existe ainda, pulando adição da coluna has_variations');
      logger.info('ℹ️ A coluna será adicionada quando a tabela for criada pela migration 005');
    }
    
    logger.info('✅ Migration 008 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 008:', error.message);
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
    logger.info('🔄 Revertendo migration 008: Remover sistema de variações de mensagem');
    
    // Drop indexes for message_variations
    const indexes = [
      'idx_message_variations_campaign_sent',
      'idx_message_variations_sent_at',
      'idx_message_variations_user',
      'idx_message_variations_campaign',
      'idx_message_templates_variations'
    ];
    
    for (const index of indexes) {
      await db.query(`DROP INDEX IF EXISTS ${index}`);
      logger.info(`✅ Índice ${index} removido`);
    }
    
    // Drop message_variations table
    await db.query('DROP TABLE IF EXISTS message_variations');
    logger.info('✅ Tabela message_variations removida');
    
    // Note: SQLite doesn't support DROP COLUMN directly
    logger.warn('⚠️ SQLite não suporta DROP COLUMN diretamente');
    logger.warn('⚠️ A coluna has_variations permanecerá na tabela message_templates');
    logger.warn('⚠️ Para remover completamente, seria necessário recriar a tabela');
    
    logger.info('✅ Migration 008 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 008:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 8,
  description: 'Add message variations system for humanization'
};
