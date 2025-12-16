/**
 * Migration: Add campaign audit and error logs tables
 * Version: 016
 * Date: 2025-11-29
 * 
 * This migration adds support for:
 * - Campaign audit logs (create, pause, resume, cancel, delete operations)
 * - Campaign error logs (detailed error tracking per contact)
 * - Processing lock columns for distributed safety
 * - Performance indexes
 * 
 * Requirements: 2.2, 3.4, 8.1, 8.2, 8.4
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 016: Criar tabelas de auditoria e logs de erro');
    
    // 1. Create campaign_audit_logs table
    const createAuditLogsTableSql = `
      CREATE TABLE IF NOT EXISTS campaign_audit_logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('create', 'pause', 'resume', 'cancel', 'delete', 'update', 'start', 'complete', 'fail')),
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL
      )
    `;
    
    await db.query(createAuditLogsTableSql);
    logger.info('✅ Tabela campaign_audit_logs criada com sucesso');
    
    // 2. Create campaign_error_logs table
    const createErrorLogsTableSql = `
      CREATE TABLE IF NOT EXISTS campaign_error_logs (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        contact_id INTEGER,
        contact_phone TEXT,
        error_type TEXT NOT NULL,
        error_message TEXT,
        error_code TEXT,
        stack_trace TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES campaign_contacts(id) ON DELETE SET NULL
      )
    `;
    
    await db.query(createErrorLogsTableSql);
    logger.info('✅ Tabela campaign_error_logs criada com sucesso');
    
    // 3. Add processing lock columns to campaigns table
    // Check if columns already exist before adding
    const tableInfo = await db.query("PRAGMA table_info(campaigns)");
    const columns = tableInfo.rows.map(row => row.name);
    
    if (!columns.includes('processing_lock')) {
      await db.query('ALTER TABLE campaigns ADD COLUMN processing_lock TEXT');
      logger.info('✅ Coluna processing_lock adicionada à tabela campaigns');
    }
    
    if (!columns.includes('lock_acquired_at')) {
      await db.query('ALTER TABLE campaigns ADD COLUMN lock_acquired_at DATETIME');
      logger.info('✅ Coluna lock_acquired_at adicionada à tabela campaigns');
    }
    
    if (!columns.includes('paused_at')) {
      await db.query('ALTER TABLE campaigns ADD COLUMN paused_at DATETIME');
      logger.info('✅ Coluna paused_at adicionada à tabela campaigns');
    }
    
    // 4. Create indexes for campaign_audit_logs table
    const auditIndexes = [
      {
        name: 'idx_audit_campaign_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_audit_campaign_id ON campaign_audit_logs(campaign_id)'
      },
      {
        name: 'idx_audit_user_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_audit_user_id ON campaign_audit_logs(user_id)'
      },
      {
        name: 'idx_audit_action',
        sql: 'CREATE INDEX IF NOT EXISTS idx_audit_action ON campaign_audit_logs(action)'
      },
      {
        name: 'idx_audit_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_audit_created_at ON campaign_audit_logs(created_at DESC)'
      }
    ];
    
    for (const index of auditIndexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    // 5. Create indexes for campaign_error_logs table
    const errorIndexes = [
      {
        name: 'idx_error_campaign_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_error_campaign_id ON campaign_error_logs(campaign_id)'
      },
      {
        name: 'idx_error_contact_id',
        sql: 'CREATE INDEX IF NOT EXISTS idx_error_contact_id ON campaign_error_logs(contact_id)'
      },
      {
        name: 'idx_error_type',
        sql: 'CREATE INDEX IF NOT EXISTS idx_error_type ON campaign_error_logs(error_type)'
      },
      {
        name: 'idx_error_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_error_created_at ON campaign_error_logs(created_at DESC)'
      }
    ];
    
    for (const index of errorIndexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    // 6. Create additional performance indexes on existing tables
    const performanceIndexes = [
      {
        name: 'idx_campaigns_status_scheduled',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_status_scheduled ON campaigns(status, scheduled_at)'
      },
      {
        name: 'idx_campaigns_processing_lock',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_processing_lock ON campaigns(processing_lock)'
      },
      {
        name: 'idx_contacts_campaign_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_contacts_campaign_status ON campaign_contacts(campaign_id, status)'
      }
    ];
    
    for (const index of performanceIndexes) {
      try {
        await db.query(index.sql);
        logger.info(`✅ Índice ${index.name} criado`);
      } catch (err) {
        // Index may already exist
        logger.debug(`Índice ${index.name} já existe ou não pôde ser criado: ${err.message}`);
      }
    }
    
    logger.info('✅ Migration 016 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 016:', error.message);
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
    logger.info('🔄 Revertendo migration 016: Remover tabelas de auditoria e logs de erro');
    
    // Drop indexes first
    const indexes = [
      'idx_contacts_campaign_status',
      'idx_campaigns_processing_lock',
      'idx_campaigns_status_scheduled',
      'idx_error_created_at',
      'idx_error_type',
      'idx_error_contact_id',
      'idx_error_campaign_id',
      'idx_audit_created_at',
      'idx_audit_action',
      'idx_audit_user_id',
      'idx_audit_campaign_id'
    ];
    
    for (const index of indexes) {
      try {
        await db.query(`DROP INDEX IF EXISTS ${index}`);
        logger.info(`✅ Índice ${index} removido`);
      } catch (err) {
        logger.debug(`Índice ${index} não existe: ${err.message}`);
      }
    }
    
    // Drop tables
    await db.query('DROP TABLE IF EXISTS campaign_error_logs');
    logger.info('✅ Tabela campaign_error_logs removida');
    
    await db.query('DROP TABLE IF EXISTS campaign_audit_logs');
    logger.info('✅ Tabela campaign_audit_logs removida');
    
    // Note: We don't remove the columns from campaigns table
    // as SQLite doesn't support DROP COLUMN easily
    // The columns will remain but be unused
    
    logger.info('✅ Migration 016 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 016:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 16,
  description: 'Add campaign audit and error logs tables'
};
