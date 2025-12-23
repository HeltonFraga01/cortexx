/**
 * User Table Access Routes
 * 
 * Rotas para acesso a dados de tabelas por usuários
 * Todas as rotas validam permissões específicas antes de executar operações
 * 
 * Migrated to use SupabaseService directly
 */

const express = require('express');
const { validateTablePermission } = require('../middleware/permissionValidator');
const { tableReadRateLimiter, tableWriteRateLimiter, tableDeleteRateLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

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
      
      const offset = (page - 1) * limit;
      
      // Extrair filtros (qualquer query param que comece com filter_)
      const filters = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (key.startsWith('filter_')) {
          const columnName = key.substring(7); // Remove 'filter_' prefix
          filters[columnName] = value;
        }
      }
      
      // Get total count
      const { count: total, error: countError } = await SupabaseService.count(tableName, filters);
      
      if (countError) {
        throw countError;
      }
      
      // Query table with filters, sorting, and pagination
      const { data, error } = await SupabaseService.queryAsAdmin(
        tableName,
        (query) => {
          let q = query.select('*', { count: 'exact' });
          
          // Apply filters
          Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              q = q.eq(key, value);
            }
          });
          
          // Apply sorting
          if (sortBy) {
            const ascending = !sortOrder || sortOrder.toUpperCase() === 'ASC';
            q = q.order(sortBy, { ascending });
          }
          
          // Apply pagination
          q = q.range(offset, offset + limit - 1);
          
          return q;
        }
      );
      
      if (error) {
        throw error;
      }
      
      const totalPages = Math.ceil((total || 0) / limit);
      
      logger.info('✅ Registros listados:', {
        userToken: req.userToken.substring(0, 8) + '...',
        tableName,
        page,
        limit,
        returned: data?.length || 0,
        total: total || 0
      });
      
      res.json({
        success: true,
        data: data || [],
        pagination: {
          page,
          limit,
          total: total || 0,
          totalPages,
          hasMore: page < totalPages
        },
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
      const { data, error } = await SupabaseService.getById(tableName, id);
      
      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
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
        throw error;
      }
      
      if (!data) {
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
        data: data,
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
      const { data: record, error } = await SupabaseService.insert(tableName, sanitizedData);
      
      if (error) {
        // Tratar erros de constraint
        if (error.code === 'DUPLICATE_KEY' || error.message?.includes('UNIQUE')) {
          logger.warn('⚠️ Violação de constraint UNIQUE:', {
            error: error.message,
            tableName,
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
        
        if (error.code === 'NOT_NULL_VIOLATION' || error.message?.includes('NOT NULL')) {
          logger.warn('⚠️ Violação de constraint NOT NULL:', {
            error: error.message,
            tableName,
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
        
        throw error;
      }
      
      logger.info('✅ Registro criado:', {
        tableName,
        id: record?.id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.status(201).json({
        success: true,
        data: record,
        message: 'Registro criado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
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
      const { data: updated, error } = await SupabaseService.update(tableName, id, sanitizedData);
      
      if (error) {
        if (error.code === 'PGRST116' || error.code === 'ROW_NOT_FOUND') {
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
        
        // Tratar erros de constraint
        if (error.code === 'DUPLICATE_KEY' || error.message?.includes('UNIQUE')) {
          logger.warn('⚠️ Violação de constraint UNIQUE:', {
            error: error.message,
            tableName,
            id,
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
        
        throw error;
      }
      
      logger.info('✅ Registro atualizado:', {
        tableName,
        id,
        userToken: req.userToken.substring(0, 8) + '...'
      });
      
      res.json({
        success: true,
        data: updated,
        message: 'Registro atualizado com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
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
      
      // First check if record exists
      const { data: existing, error: checkError } = await SupabaseService.getById(tableName, id);
      
      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }
      
      if (!existing) {
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
      
      // Deletar registro
      const { error } = await SupabaseService.delete(tableName, id);
      
      if (error) {
        // Tratar erros de foreign key
        if (error.code === 'FOREIGN_KEY_VIOLATION' || error.message?.includes('FOREIGN KEY')) {
          logger.warn('⚠️ Violação de constraint FOREIGN KEY:', {
            error: error.message,
            tableName,
            id,
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
        
        throw error;
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
