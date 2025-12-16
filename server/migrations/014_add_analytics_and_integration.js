/**
 * Migration: Add Analytics and Contact Lists tables
 * Version: 014
 * Date: 2025-11-18
 * 
 * This migration adds support for:
 * - Advanced Analytics (delivered/read status, daily stats)
 * - Contact Lists (reusable lists for campaigns)
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
    try {
        logger.info('🔄 Executando migration 014: Analytics e Listas de Contatos');

        // 1. Create contact_lists table
        const createContactListsSql = `
      CREATE TABLE IF NOT EXISTS contact_lists (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        user_token TEXT NOT NULL,
        total_contacts INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
        await db.query(createContactListsSql);
        logger.info('✅ Tabela contact_lists criada');

        // 2. Create contacts table
        const createContactsSql = `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        list_id INTEGER NOT NULL,
        phone TEXT NOT NULL,
        name TEXT,
        email TEXT,
        variables TEXT, -- JSON string for custom variables
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE
      )
    `;
        await db.query(createContactsSql);
        logger.info('✅ Tabela contacts criada');

        // 3. Create analytics_daily_stats table (aggregated stats per day/campaign)
        const createAnalyticsSql = `
      CREATE TABLE IF NOT EXISTS analytics_daily_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT,
        date DATE NOT NULL,
        total_sent INTEGER DEFAULT 0,
        total_delivered INTEGER DEFAULT 0,
        total_read INTEGER DEFAULT 0,
        total_failed INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(campaign_id, date)
      )
    `;
        await db.query(createAnalyticsSql);
        logger.info('✅ Tabela analytics_daily_stats criada');

        // 4. Update campaign_contacts to support new statuses (if not possible via ALTER, we rely on application logic to use the text field)
        // SQLite's CHECK constraints are immutable. We can't easily change the CHECK constraint on 'status'.
        // However, since 'status' is TEXT, we can just insert 'delivered'/'read' if we drop the check or if we didn't enforce it strictly.
        // The previous migration 007 had: CHECK(status IN ('pending', 'sent', 'failed'))
        // To fix this properly in SQLite, we would need to recreate the table.
        // For now, we will add separate columns for tracking timestamps which is safer.

        try {
            await db.query('ALTER TABLE campaign_contacts ADD COLUMN delivered_at DATETIME');
            logger.info('✅ Coluna delivered_at adicionada em campaign_contacts');
        } catch (e) { logger.warn('⚠️ Coluna delivered_at já deve existir'); }

        try {
            await db.query('ALTER TABLE campaign_contacts ADD COLUMN read_at DATETIME');
            logger.info('✅ Coluna read_at adicionada em campaign_contacts');
        } catch (e) { logger.warn('⚠️ Coluna read_at já deve existir'); }

        // Indexes
        await db.query('CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_contact_lists_user ON contact_lists(user_token)');

        logger.info('✅ Migration 014 concluída com sucesso');

    } catch (error) {
        logger.error('❌ Erro ao executar migration 014:', error.message);
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
        logger.info('🔄 Revertendo migration 014');

        await db.query('DROP TABLE IF EXISTS analytics_daily_stats');
        await db.query('DROP TABLE IF EXISTS contacts');
        await db.query('DROP TABLE IF EXISTS contact_lists');

        // We cannot easily drop columns in SQLite without recreating tables, so we leave delivered_at/read_at

        logger.info('✅ Migration 014 revertida com sucesso');
    } catch (error) {
        logger.error('❌ Erro ao reverter migration 014:', error.message);
        throw error;
    }
}

module.exports = {
    up,
    down,
    version: 14,
    description: 'Add Analytics and Contact Lists tables'
};
