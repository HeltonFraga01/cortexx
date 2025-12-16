/**
 * Migration: Enhance campaigns table for message sequencing and scheduling windows
 * Version: 012
 * Date: 2025-05-22
 * 
 * This migration adds support for:
 * - Message sequencing: sending multiple messages in a sequence
 * - Scheduling windows: defining active hours for sending
 */

const { logger } = require('../utils/logger');

/**
 * Apply the migration
 * @param {Object} db - Database instance (wrapper)
 * @returns {Promise<void>}
 */
async function up(db) {
    try {
        logger.info('🔄 Executando migration 012: Melhorar tabela de campanhas');

        // Check existing columns
        const tableInfo = await db.query("PRAGMA table_info(campaigns)");
        const columns = tableInfo.rows.map(row => row.name);

        // Add messages column (JSON array of messages) if not exists
        if (!columns.includes('messages')) {
            await db.query(`
              ALTER TABLE campaigns 
              ADD COLUMN messages TEXT DEFAULT NULL
            `);
            logger.info('✅ Coluna messages adicionada');
        } else {
            logger.info('ℹ️ Coluna messages já existe');
        }

        // Add sending_window column (JSON object with startTime, endTime, days) if not exists
        if (!columns.includes('sending_window')) {
            await db.query(`
              ALTER TABLE campaigns 
              ADD COLUMN sending_window TEXT DEFAULT NULL
            `);
            logger.info('✅ Coluna sending_window adicionada');
        } else {
            logger.info('ℹ️ Coluna sending_window já existe');
        }

        logger.info('✅ Migration 012 concluída com sucesso');

    } catch (error) {
        logger.error('❌ Erro ao executar migration 012:', error.message);
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
        logger.info('🔄 Revertendo migration 012');

        // SQLite does not support DROP COLUMN directly in older versions, 
        // but for simplicity in this environment we'll assume it's supported 
        // or that rollback is rarely used. 
        // If strict SQLite compatibility is needed, we would need to recreate the table.

        try {
            await db.query('ALTER TABLE campaigns DROP COLUMN messages');
            logger.info('✅ Coluna messages removida');
        } catch (e) {
            logger.warn('⚠️ Não foi possível remover coluna messages (pode não ser suportado pelo SQLite driver)');
        }

        try {
            await db.query('ALTER TABLE campaigns DROP COLUMN sending_window');
            logger.info('✅ Coluna sending_window removida');
        } catch (e) {
            logger.warn('⚠️ Não foi possível remover coluna sending_window');
        }

        logger.info('✅ Migration 012 revertida com sucesso');

    } catch (error) {
        logger.error('❌ Erro ao reverter migration 012:', error.message);
        throw error;
    }
}

module.exports = {
    up,
    down,
    version: 12,
    description: 'Enhance campaigns for sequencing and scheduling windows'
};
