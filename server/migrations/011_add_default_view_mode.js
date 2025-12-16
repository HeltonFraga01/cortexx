const { logger } = require('../utils/logger');

module.exports = {
    up: async (db) => {
        try {
            logger.info('🔄 Iniciando migration: Adicionar default_view_mode em database_connections');

            // Verificar se a coluna já existe
            const tableInfo = await db.query("PRAGMA table_info(database_connections)");
            const columnExists = tableInfo.rows.some(col => col.name === 'default_view_mode');

            if (!columnExists) {
                await db.query(`
          ALTER TABLE database_connections
          ADD COLUMN default_view_mode TEXT DEFAULT 'list' CHECK(default_view_mode IN ('list', 'single'))
        `);
                logger.info('✅ Coluna default_view_mode adicionada com sucesso');
            } else {
                logger.info('ℹ️ Coluna default_view_mode já existe, pulando');
            }

        } catch (error) {
            // Se o erro for de coluna duplicada, apenas logar e continuar
            if (error.message && error.message.includes('duplicate column')) {
                logger.info('ℹ️ Coluna default_view_mode já existe (detectado via erro), pulando');
                return;
            }
            logger.error('❌ Erro na migration 011:', error.message);
            throw error;
        }
    },

    down: async (db) => {
        logger.info('ℹ️ Reversão da migration 011 não implementada (SQLite limitation)');
    }
};
