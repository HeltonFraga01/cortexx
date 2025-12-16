const express = require('express');
const { validateTablePermission } = require('../middleware/permissionValidator');
const { tableReadRateLimiter, tableWriteRateLimiter, tableDeleteRateLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * User Table Access Routes
 * 
 * Rotas para acesso a dados de tabelas por usuários
 * Todas as rotas validam permissões específicas antes de executar operações
 */

/**
 * GET /api/tables/:tableName
 * Lista registros de uma tabela com paginação, filtros e ordenação
 * 
 * Headers:
 * - Authorization: Bearer {user_token} ou x-user-token: {user_token}
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * 
 * Query params:
 * - page: number (default: 1) - Página atual
 * - limit: number (default: 50, max: 100) - Registros por página
 * - sortBy: string - Nome da coluna para ordenação
 * - sortOrder: string (ASC|DESC) - Ordem de ordenação
 * - filter_{column}: string - Filtro por coluna (ex: filter_name=John)
 * 
 * Requires: can_read permission
 */
router.get('/:tableName',
  tableReadRateLimiter,
  validateTablePermission('read'),
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const db = req.app.locals.db;
      
      // Extrair parâmetros de query
      let page = parseInt(req.query.page) || 1;
      let limit = parseInt(req.query.limit) || 50;
      const sortBy = req.query.sortBy;
      const sortOrder = req.query.sortOrder;
      
      // Limitar o máximo de registros por página
      if (limit > 100) {
        limit = 100;
      }
      
      if (page < 1) {
        page = 1;
      }
      
      // Extrair filtros (qualquer query param que comece com filter_)
      const filters = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (key.startsWith('filter_')) {
          const columnName = key.substring(7); // Remove 'filter_' prefix
          filters[columnName] = value;
        }
      }
      
      // Consultar tabela
      const result = await db.queryTable(tableName, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      });
      
      logger.info('✅ Registros listados:', {
        userToken: req.userToken.substring(0, 8) + '...',
        tableName,
        page,
        limit,
        returned: result.data.length,
        total: result.pagination.total
      });
      
      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao listar registros:', {
        error: error.message,
        stack: error.stack,
        tableName: req.params.tableName,
        userToken: req.userToken?.substring(0, 8) + '...'
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao listar registros',
        code: 'LIST_RECORDS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/tables/:tableName/:id
 * Busca um registro específico por ID
 * 
 * Headers:
 * - Authorization: Bearer {user_token} ou x-user-token: {user_token}
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * - id: number - ID do registro
 * 
 * Requires: can_read permission
 */
router.get('/:tableName/:id',
  tableReadRateLimiter,
  validateTablePermission('read'),
  async (req, res) => {
    try {
      const { tableName, id } = req.params;
      const db = req.app.locals.db;
      
      // Validar formato do nome da tabela
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nome de tabela inválido',
          code: 'INVALID_TABLE_NAME',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buscar registro
      const result = await db.query(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        [id]
      );
      
      if (result.rows.length === 0) {
        logger.warn('⚠️ Registro não encontrado:', {
          tableName,
          id,
          userToken: req.userToken.substring(0, 8) + '...'
        });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Registro não encontrado',
          code: 'RECORD_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Registro encontrado:', {
        tableName,
        id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.json({
        success: true,
        data: result.rows[0],
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao buscar registro:', {
        error: error.message,
        stack: error.stack,
        tableName: req.params.tableName,
        id: req.params.id,
        userToken: req.userToken?.substring(0, 8) + '...'
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao buscar registro',
        code: 'GET_RECORD_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * POST /api/tables/:tableName
 * Cria um novo registro na tabela
 * 
 * Headers:
 * - Authorization: Bearer {user_token} ou x-user-token: {user_token}
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * 
 * Body:
 * - Objeto com os campos do registro (exceto id, created_at, updated_at)
 * 
 * Requires: can_write permission
 */
router.post('/:tableName',
  tableWriteRateLimiter,
  validateTablePermission('write'),
  async (req, res) => {
    try {
      const { tableName } = req.params;
      const data = req.body;
      const db = req.app.locals.db;
      
      // Validar que há dados para inserir
      if (!data || Object.keys(data).length === 0) {
        logger.warn('⚠️ Nenhum dado fornecido para inserção:', {
          tableName,
          userToken: req.userToken.substring(0, 8) + '...'
        });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nenhum dado fornecido para inserção',
          code: 'NO_DATA_PROVIDED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Remover campos que não devem ser inseridos manualmente
      const sanitizedData = { ...data };
      delete sanitizedData.id;
      delete sanitizedData.created_at;
      delete sanitizedData.updated_at;
      
      // Inserir registro
      const record = await db.insertRecord(tableName, sanitizedData);
      
      logger.info('✅ Registro criado:', {
        tableName,
        id: record.id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.status(201).json({
        success: true,
        data: record,
        message: 'Registro criado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Tratar erros de constraint
      if (error.message && error.message.includes('UNIQUE constraint')) {
        logger.warn('⚠️ Violação de constraint UNIQUE:', {
          error: error.message,
          tableName: req.params.tableName,
          userToken: req.userToken?.substring(0, 8) + '...'
        });
        
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Registro duplicado - violação de constraint UNIQUE',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          timestamp: new Date().toISOString()
        });
      }
      
      if (error.message && error.message.includes('NOT NULL constraint')) {
        logger.warn('⚠️ Violação de constraint NOT NULL:', {
          error: error.message,
          tableName: req.params.tableName,
          userToken: req.userToken?.substring(0, 8) + '...'
        });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Campo obrigatório não fornecido',
          code: 'NOT_NULL_CONSTRAINT_VIOLATION',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('❌ Erro ao criar registro:', {
        error: error.message,
        stack: error.stack,
        tableName: req.params.tableName,
        userToken: req.userToken?.substring(0, 8) + '...'
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao criar registro',
        code: 'CREATE_RECORD_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * PUT /api/tables/:tableName/:id
 * Atualiza um registro existente
 * 
 * Headers:
 * - Authorization: Bearer {user_token} ou x-user-token: {user_token}
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * - id: number - ID do registro
 * 
 * Body:
 * - Objeto com os campos a serem atualizados
 * 
 * Requires: can_write permission
 */
router.put('/:tableName/:id',
  tableWriteRateLimiter,
  validateTablePermission('write'),
  async (req, res) => {
    try {
      const { tableName, id } = req.params;
      const data = req.body;
      const db = req.app.locals.db;
      
      // Validar que há dados para atualizar
      if (!data || Object.keys(data).length === 0) {
        logger.warn('⚠️ Nenhum dado fornecido para atualização:', {
          tableName,
          id,
          userToken: req.userToken.substring(0, 8) + '...'
        });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nenhum dado fornecido para atualização',
          code: 'NO_DATA_PROVIDED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Remover campos que não devem ser atualizados manualmente
      const sanitizedData = { ...data };
      delete sanitizedData.id;
      delete sanitizedData.created_at;
      delete sanitizedData.updated_at;
      
      // Atualizar registro
      const updated = await db.updateRecord(tableName, id, sanitizedData);
      
      if (!updated) {
        logger.warn('⚠️ Registro não encontrado para atualização:', {
          tableName,
          id,
          userToken: req.userToken.substring(0, 8) + '...'
        });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Registro não encontrado',
          code: 'RECORD_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Registro atualizado:', {
        tableName,
        id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.json({
        success: true,
        message: 'Registro atualizado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Tratar erros de constraint
      if (error.message && error.message.includes('UNIQUE constraint')) {
        logger.warn('⚠️ Violação de constraint UNIQUE:', {
          error: error.message,
          tableName: req.params.tableName,
          id: req.params.id,
          userToken: req.userToken?.substring(0, 8) + '...'
        });
        
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Registro duplicado - violação de constraint UNIQUE',
          code: 'UNIQUE_CONSTRAINT_VIOLATION',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('❌ Erro ao atualizar registro:', {
        error: error.message,
        stack: error.stack,
        tableName: req.params.tableName,
        id: req.params.id,
        userToken: req.userToken?.substring(0, 8) + '...'
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao atualizar registro',
        code: 'UPDATE_RECORD_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * DELETE /api/tables/:tableName/:id
 * Deleta um registro
 * 
 * Headers:
 * - Authorization: Bearer {user_token} ou x-user-token: {user_token}
 * 
 * Params:
 * - tableName: string - Nome da tabela
 * - id: number - ID do registro
 * 
 * Requires: can_delete permission
 */
router.delete('/:tableName/:id',
  tableDeleteRateLimiter,
  validateTablePermission('delete'),
  async (req, res) => {
    try {
      const { tableName, id } = req.params;
      const db = req.app.locals.db;
      
      // Deletar registro
      const deleted = await db.deleteRecord(tableName, id);
      
      if (!deleted) {
        logger.warn('⚠️ Registro não encontrado para deleção:', {
          tableName,
          id,
          userToken: req.userToken.substring(0, 8) + '...'
        });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Registro não encontrado',
          code: 'RECORD_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Registro deletado:', {
        tableName,
        id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.json({
        success: true,
        message: 'Registro deletado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Tratar erros de foreign key
      if (error.message && error.message.includes('FOREIGN KEY constraint')) {
        logger.warn('⚠️ Violação de constraint FOREIGN KEY:', {
          error: error.message,
          tableName: req.params.tableName,
          id: req.params.id,
          userToken: req.userToken?.substring(0, 8) + '...'
        });
        
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: 'Não é possível deletar - registro referenciado por outros dados',
          code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('❌ Erro ao deletar registro:', {
        error: error.message,
        stack: error.stack,
        tableName: req.params.tableName,
        id: req.params.id,
        userToken: req.userToken?.substring(0, 8) + '...'
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao deletar registro',
        code: 'DELETE_RECORD_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
