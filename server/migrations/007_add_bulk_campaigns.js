/**
 * Migration: Add bulk campaign tables for advanced message dispatcher
 * Version: 007
 * Date: 2025-11-12
 * 
 * This migration adds support for advanced bulk message campaigns with:
 * - Campaign management (scheduling, humanization, progress tracking)
 * - Contact management per campaign
 * - Detailed reporting and analytics
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
  try {
    logger.info('🔄 Executando migration 007: Criar tabelas de campanhas em massa');
    
    // 1. Create campaigns table
    const createCampaignsTableSql = `
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        instance TEXT NOT NULL,
        user_token TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed')),
        message_type TEXT NOT NULL CHECK(message_type IN ('text', 'media')),
        message_content TEXT NOT NULL,
        media_url TEXT,
        media_type TEXT CHECK(media_type IN ('image', 'video', 'document')),
        media_file_name TEXT,
        delay_min INTEGER NOT NULL CHECK(delay_min >= 5 AND delay_min <= 300),
        delay_max INTEGER NOT NULL CHECK(delay_max >= 5 AND delay_max <= 300),
        randomize_order BOOLEAN NOT NULL DEFAULT 1,
        is_scheduled BOOLEAN NOT NULL DEFAULT 0,
        scheduled_at DATETIME,
        started_at DATETIME,
        completed_at DATETIME,
        total_contacts INTEGER NOT NULL,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        current_index INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        CHECK(delay_min <= delay_max)
      )
    `;
    
    await db.query(createCampaignsTableSql);
    logger.info('✅ Tabela campaigns criada com sucesso');
    
    // 2. Create campaign_contacts table
    const createCampaignContactsTableSql = `
      CREATE TABLE IF NOT EXISTS campaign_contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL,
        phone TEXT NOT NULL,
        name TEXT,
        variables TEXT,
        status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed')),
        error_type TEXT CHECK(error_type IN ('invalid_number', 'disconnected', 'timeout', 'api_error')),
        error_message TEXT,
        sent_at DATETIME,
        processing_order INTEGER,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createCampaignContactsTableSql);
    logger.info('✅ Tabela campaign_contacts criada com sucesso');
    
    // 3. Create campaign_reports table
    const createCampaignReportsTableSql = `
      CREATE TABLE IF NOT EXISTS campaign_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL UNIQUE,
        total_contacts INTEGER NOT NULL,
        sent_count INTEGER NOT NULL,
        failed_count INTEGER NOT NULL,
        success_rate REAL NOT NULL,
        duration_seconds INTEGER NOT NULL,
        errors_by_type TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
      )
    `;
    
    await db.query(createCampaignReportsTableSql);
    logger.info('✅ Tabela campaign_reports criada com sucesso');
    
    // 4. Create indexes for campaigns table
    const campaignIndexes = [
      {
        name: 'idx_campaigns_instance',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_instance ON campaigns(instance)'
      },
      {
        name: 'idx_campaigns_user_token',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_user_token ON campaigns(user_token)'
      },
      {
        name: 'idx_campaigns_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status)'
      },
      {
        name: 'idx_campaigns_scheduled',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON campaigns(scheduled_at) WHERE is_scheduled = 1'
      },
      {
        name: 'idx_campaigns_created_at',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC)'
      }
    ];
    
    for (const index of campaignIndexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    // 5. Create indexes for campaign_contacts table
    const contactIndexes = [
      {
        name: 'idx_campaign_contacts_campaign',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_campaign ON campaign_contacts(campaign_id)'
      },
      {
        name: 'idx_campaign_contacts_status',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_status ON campaign_contacts(campaign_id, status)'
      },
      {
        name: 'idx_campaign_contacts_processing_order',
        sql: 'CREATE INDEX IF NOT EXISTS idx_campaign_contacts_processing_order ON campaign_contacts(campaign_id, processing_order)'
      }
    ];
    
    for (const index of contactIndexes) {
      await db.query(index.sql);
      logger.info(`✅ Índice ${index.name} criado`);
    }
    
    // 6. Create index for campaign_reports table
    const reportIndexSql = 'CREATE INDEX IF NOT EXISTS idx_campaign_reports_campaign ON campaign_reports(campaign_id)';
    await db.query(reportIndexSql);
    logger.info('✅ Índice idx_campaign_reports_campaign criado');
    
    logger.info('✅ Migration 007 concluída com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao executar migration 007:', error.message);
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
    logger.info('🔄 Revertendo migration 007: Remover tabelas de campanhas em massa');
    
    // Drop indexes first
    const indexes = [
      'idx_campaign_reports_campaign',
      'idx_campaign_contacts_processing_order',
      'idx_campaign_contacts_status',
      'idx_campaign_contacts_campaign',
      'idx_campaigns_created_at',
      'idx_campaigns_scheduled',
      'idx_campaigns_status',
      'idx_campaigns_user_token',
      'idx_campaigns_instance'
    ];
    
    for (const index of indexes) {
      await db.query(`DROP INDEX IF EXISTS ${index}`);
      logger.info(`✅ Índice ${index} removido`);
    }
    
    // Drop tables in reverse order (respecting foreign keys)
    await db.query('DROP TABLE IF EXISTS campaign_reports');
    logger.info('✅ Tabela campaign_reports removida');
    
    await db.query('DROP TABLE IF EXISTS campaign_contacts');
    logger.info('✅ Tabela campaign_contacts removida');
    
    await db.query('DROP TABLE IF EXISTS campaigns');
    logger.info('✅ Tabela campaigns removida');
    
    logger.info('✅ Migration 007 revertida com sucesso');
    
  } catch (error) {
    logger.error('❌ Erro ao reverter migration 007:', error.message);
    throw error;
  }
}

module.exports = {
  up,
  down,
  version: 7,
  description: 'Add bulk campaign tables for advanced message dispatcher'
};
