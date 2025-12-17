const { logger } = require('../utils/logger');
const axios = require('axios');

/**
 * UserRecordService - Serviço para buscar registros únicos de usuários em diferentes tipos de banco de dados
 * 
 * Este serviço abstrai a lógica de busca de registros de usuários em:
 * - NocoDB
 * - Bancos relacionais (MySQL, PostgreSQL)
 */
class UserRecordService {
  constructor(database) {
    this.db = database;
  }

  /**
   * Busca o registro único do usuário baseado no token e conexão
   * @param {number} connectionId - ID da conexão de banco de dados
   * @param {string} userToken - Token do usuário autenticado
   * @returns {Promise<Object|null>} Registro do usuário ou null se não encontrado
   */
  async getUserRecord(connectionId, userToken) {
    try {
      logger.info('🔍 UserRecordService: Buscando registro do usuário:', { 
        connectionId, 
        token: userToken.substring(0, 8) + '...' 
      });

      // 1. Buscar configuração da conexão
      const connection = await this.db.getConnectionById(connectionId);
      
      if (!connection) {
        const error = new Error('Connection not found');
        error.code = 'CONNECTION_NOT_FOUND';
        throw error;
      }

      // 2. Verificar se o usuário tem acesso à conexão
      if (!this.hasAccess(connection, userToken)) {
        const error = new Error('Access denied to this connection');
        error.code = 'UNAUTHORIZED';
        throw error;
      }

      // 3. Obter o campo de vínculo do usuário
      const userLinkField = connection.user_link_field || connection.userLinkField;
      
      if (!userLinkField) {
        const error = new Error('User link field not configured for this connection');
        error.code = 'INVALID_CONFIGURATION';
        throw error;
      }

      // 4. Buscar registro baseado no tipo de conexão
      let record = null;
      
      switch (connection.type) {
        case 'NOCODB':
          record = await this.fetchNocoDBRecord(connection, userLinkField, userToken);
          break;
        case 'POSTGRES':
        case 'POSTGRESQL':
        case 'MYSQL':
          record = await this.fetchSQLRecord(connection, userLinkField, userToken);
          break;
        default:
          const error = new Error(`Unsupported database type: ${connection.type}`);
          error.code = 'UNSUPPORTED_TYPE';
          throw error;
      }

      if (!record) {
        logger.info('ℹ️ UserRecordService: Nenhum registro encontrado para o usuário:', { 
          connectionId, 
          token: userToken.substring(0, 8) + '...',
          userLinkField
        });
        return null;
      }

      logger.info('✅ UserRecordService: Registro encontrado:', { 
        connectionId, 
        token: userToken.substring(0, 8) + '...',
        recordId: record.id || record.Id
      });

      return record;

    } catch (error) {
      logger.error('❌ UserRecordService: Erro ao buscar registro:', { 
        connectionId, 
        token: userToken.substring(0, 8) + '...', 
        error: error.message,
        code: error.code
      });
      throw error;
    }
  }

  /**
   * Verifica se o usuário tem acesso à conexão
   * @param {Object} connection - Objeto de conexão
   * @param {string} userToken - Token do usuário
   * @returns {boolean} True se o usuário tem acesso
   */
  hasAccess(connection, userToken) {
    try {
      // Se não há usuários atribuídos, negar acesso
      if (!connection.assignedUsers || !Array.isArray(connection.assignedUsers)) {
        logger.warn('⚠️ UserRecordService: Conexão sem usuários atribuídos:', { 
          connectionId: connection.id 
        });
        return false;
      }

      // Verificar se o token está na lista de usuários atribuídos
      const hasAccess = connection.assignedUsers.includes(userToken);

      logger.info('🔐 UserRecordService: Verificação de acesso:', { 
        connectionId: connection.id,
        token: userToken.substring(0, 8) + '...',
        assignedUsersCount: connection.assignedUsers.length,
        hasAccess
      });

      return hasAccess;

    } catch (error) {
      logger.error('❌ UserRecordService: Erro ao verificar acesso:', { 
        connectionId: connection.id,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Busca registro no NocoDB
   * @param {Object} connection - Configuração da conexão NocoDB
   * @param {string} userLinkField - Campo que vincula ao usuário
   * @param {string} userToken - Token do usuário
   * @returns {Promise<Object|null>} Registro encontrado ou null
   */
  async fetchNocoDBRecord(connection, userLinkField, userToken) {
    try {
      // Validar parâmetros obrigatórios
      if (!connection.host) {
        throw new Error('NocoDB host not configured');
      }

      if (!connection.nocodb_token && !connection.password) {
        throw new Error('NocoDB authentication token not configured');
      }

      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;
      
      if (!projectId) {
        throw new Error('NocoDB project ID not configured');
      }

      if (!tableId) {
        throw new Error('NocoDB table ID not configured');
      }

      logger.info('🔍 UserRecordService: Buscando no NocoDB:', { 
        host: connection.host,
        projectId, 
        tableId,
        userLinkField,
        token: userToken.substring(0, 8) + '...'
      });

      // Criar cliente axios para NocoDB
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json',
        },
        timeout: parseInt(process.env.NOCODB_TIMEOUT) || 15000,
      });

      // Buscar registro único filtrado pelo token do usuário
      const response = await nocoApi.get(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        {
          params: { 
            limit: 1,
            where: `(${userLinkField},eq,${userToken})`
          },
        }
      );

      const data = response.data?.list || response.data || [];
      
      // Validar estrutura da resposta
      if (!Array.isArray(data)) {
        logger.warn('⚠️ UserRecordService: Resposta NocoDB não é um array:', typeof data);
        throw new Error('Invalid response format from NocoDB');
      }
      
      const record = data.length > 0 ? data[0] : null;
      
      if (record) {
        logger.info('✅ UserRecordService: Registro encontrado no NocoDB:', { 
          projectId, 
          tableId, 
          token: userToken.substring(0, 8) + '...',
          recordId: record.id || record.Id
        });
      }

      return record;

    } catch (error) {
      // Tratamento específico de erros NocoDB
      if (error.response) {
        const status = error.response.status;
        
        if (status === 401) {
          const authError = new Error('Invalid NocoDB authentication token');
          authError.code = 'NOCODB_AUTH_ERROR';
          throw authError;
        } else if (status === 403) {
          const permError = new Error('No permission to access NocoDB data');
          permError.code = 'NOCODB_PERMISSION_ERROR';
          throw permError;
        } else if (status === 404) {
          const notFoundError = new Error('NocoDB project or table not found');
          notFoundError.code = 'NOCODB_NOT_FOUND';
          throw notFoundError;
        }
      }
      
      logger.error('❌ UserRecordService: Erro ao buscar no NocoDB:', { 
        message: error.message,
        host: connection.host,
        projectId: connection.nocodb_project_id,
        tableId: connection.nocodb_table_id
      });
      
      throw error;
    }
  }

  /**
   * Busca registro em bancos SQL (MySQL/PostgreSQL)
   * @param {Object} connection - Configuração da conexão SQL
   * @param {string} userLinkField - Campo que vincula ao usuário
   * @param {string} userToken - Token do usuário
   * @returns {Promise<Object|null>} Registro encontrado ou null
   */
  async fetchSQLRecord(connection, userLinkField, userToken) {
    try {
      // Validar configurações obrigatórias
      if (!connection.host) {
        throw new Error(`${connection.type} host not configured`);
      }

      if (!connection.username) {
        throw new Error(`${connection.type} username not configured`);
      }

      if (!connection.password) {
        throw new Error(`${connection.type} password not configured`);
      }

      if (!connection.database) {
        throw new Error(`${connection.type} database name not configured`);
      }

      const tableName = connection.table_name;
      
      if (!tableName) {
        throw new Error(`${connection.type} table name not configured`);
      }

      logger.info('🔍 UserRecordService: Buscando em banco SQL:', { 
        type: connection.type,
        host: connection.host,
        database: connection.database,
        tableName,
        userLinkField,
        token: userToken.substring(0, 8) + '...'
      });

      // TODO: Implementar conexões reais para MySQL/PostgreSQL
      // Por enquanto, simular um registro único
      logger.warn(`⚠️ UserRecordService: Conexão ${connection.type} ainda não implementada, simulando registro único`);
      
      // Simular registro único baseado na configuração real
      const simulatedRecord = {
        id: 1,
        [userLinkField]: userToken,
        database_type: connection.type,
        host: connection.host,
        database: connection.database,
        table: tableName,
        message: `Registro único simulado de ${connection.type}`,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      logger.info('✅ UserRecordService: Registro simulado gerado para banco SQL:', { 
        type: connection.type,
        token: userToken.substring(0, 8) + '...',
        tableName,
        userLinkField
      });

      return simulatedRecord;

      /* TODO: Implementação real para MySQL/PostgreSQL
      
      // Para MySQL
      if (connection.type === 'MYSQL') {
        const mysql = require('mysql2/promise');
        
        const pool = mysql.createPool({
          host: connection.host,
          port: connection.port || 3306,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          timeout: 60000
        });

        const sql = `SELECT * FROM ?? WHERE ?? = ? LIMIT 1`;
        const [rows] = await pool.execute(sql, [tableName, userLinkField, userToken]);
        
        await pool.end();
        return rows.length > 0 ? rows[0] : null;
      }

      // Para PostgreSQL
      if (connection.type === 'POSTGRESQL' || connection.type === 'POSTGRES') {
        const { Pool } = require('pg');
        
        const pool = new Pool({
          host: connection.host,
          port: connection.port || 5432,
          user: connection.username,
          password: connection.password,
          database: connection.database,
          max: 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 2000,
        });

        const sql = `SELECT * FROM $1 WHERE $2 = $3 LIMIT 1`;
        const result = await pool.query(sql, [tableName, userLinkField, userToken]);
        
        await pool.end();
        return result.rows.length > 0 ? result.rows[0] : null;
      }
      */

    } catch (error) {
      // Tratamento específico de erros de banco externo
      if (error.code === 'ECONNREFUSED') {
        const connError = new Error(`${connection.type} server unavailable`);
        connError.code = 'DB_CONNECTION_REFUSED';
        throw connError;
      } else if (error.code === 'ETIMEDOUT') {
        const timeoutError = new Error(`Timeout connecting to ${connection.type}`);
        timeoutError.code = 'DB_TIMEOUT';
        throw timeoutError;
      } else if (error.code === 'ER_ACCESS_DENIED_ERROR' || error.code === '28P01') {
        const authError = new Error(`Invalid credentials for ${connection.type}`);
        authError.code = 'DB_AUTH_ERROR';
        throw authError;
      } else if (error.code === 'ER_BAD_DB_ERROR' || error.code === '3D000') {
        const dbError = new Error(`Database '${connection.database}' not found`);
        dbError.code = 'DB_NOT_FOUND';
        throw dbError;
      }
      
      logger.error('❌ UserRecordService: Erro ao buscar em banco SQL:', { 
        message: error.message,
        code: error.code,
        type: connection.type,
        host: connection.host,
        database: connection.database
      });
      
      throw error;
    }
  }
}

module.exports = UserRecordService;
