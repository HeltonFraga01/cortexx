const { logger } = require('../utils/logger');

class ContactFetcherService {
    constructor(db) {
        this.db = db; // Database abstraction layer
    }

    /**
     * Busca contatos de uma conexão de banco de dados externa
     * @param {string} connectionId - ID da conexão
     * @param {string} userToken - Token do usuário (para segurança)
     * @param {string} query - Query SQL customizada (opcional)
     * @returns {Promise<Array>} Lista de contatos { phone, name, variables }
     */
    async fetchContacts(connectionId, userToken, query = null) {
        let connection = null;
        let client = null;

        try {
            // 1. Obter detalhes da conexão
            const connSql = 'SELECT * FROM database_connections WHERE id = ? AND user_token = ?';
            const { rows } = await this.db.query(connSql, [connectionId, userToken]);

            if (rows.length === 0) {
                throw new Error('Conexão de banco de dados não encontrada');
            }

            const dbConfig = rows[0];

            // Decodificar senha (assumindo base64 simples por enquanto, ideal seria criptografia)
            // Nota: Em produção real, usar criptografia forte
            let password = dbConfig.password;
            try {
                // Tentar decodificar se parecer base64
                if (password.length > 20 && !password.includes(' ')) {
                    // Implementação simplificada, manter como está se falhar
                }
            } catch (e) { }

            // 2. Conectar ao banco externo
            if (dbConfig.type === 'mysql') {
                const mysql = require('mysql2/promise');
                connection = await mysql.createConnection({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.username,
                    password: password,
                    database: dbConfig.database
                });
            } else if (dbConfig.type === 'postgres') {
                const { Client } = require('pg');
                client = new Client({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.username,
                    password: password,
                    database: dbConfig.database,
                    ssl: { rejectUnauthorized: false } // Comum para bancos em nuvem
                });
                await client.connect();
            } else {
                throw new Error(`Tipo de banco de dados não suportado: ${dbConfig.type}`);
            }

            // 3. Executar Query
            // Se query não for fornecida, usar a query padrão da conexão (se existir) ou erro
            // Por segurança, vamos exigir uma query explícita ou usar uma tabela padrão se implementado

            // Para este MVP, vamos assumir que o usuário fornece a query ou seleciona uma tabela
            // Vamos implementar uma query segura padrão se nada for passado
            const sqlQuery = query || `SELECT * FROM ${dbConfig.table_name || 'contacts'} LIMIT 1000`;

            // Validar query para evitar DROP/DELETE (básico)
            if (/drop|delete|truncate|update|insert|alter/i.test(sqlQuery)) {
                throw new Error('Apenas consultas SELECT são permitidas');
            }

            let results;
            if (dbConfig.type === 'mysql') {
                const [rows] = await connection.execute(sqlQuery);
                results = rows;
            } else {
                const res = await client.query(sqlQuery);
                results = res.rows;
            }

            // 4. Mapear resultados para formato padrão
            // Tentar identificar colunas automaticamente: phone/celular/telefone, name/nome
            const contacts = results.map(row => {
                // Normalizar chaves para lowercase
                const normalizedRow = {};
                Object.keys(row).forEach(key => {
                    normalizedRow[key.toLowerCase()] = row[key];
                });

                // Encontrar telefone
                const phoneKey = Object.keys(normalizedRow).find(k =>
                    k.includes('phone') || k.includes('celular') || k.includes('tel') || k.includes('whatsapp')
                );

                // Encontrar nome
                const nameKey = Object.keys(normalizedRow).find(k =>
                    k.includes('name') || k.includes('nome')
                );

                if (!phoneKey) return null; // Ignorar se não tiver telefone

                // O resto vira variáveis
                const variables = { ...row };

                return {
                    phone: String(normalizedRow[phoneKey]),
                    name: nameKey ? String(normalizedRow[nameKey]) : '',
                    variables
                };
            }).filter(c => c !== null);

            return contacts;

        } catch (error) {
            logger.error('Erro ao buscar contatos externos:', error);
            throw error;
        } finally {
            if (connection) await connection.end();
            if (client) await client.end();
        }
    }
}

module.exports = ContactFetcherService;
