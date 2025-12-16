const express = require('express');
const errorHandler = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const { logger } = require('../utils/logger');

const router = express.Router();

// Aplicar rate limiter a todas as rotas admin
router.use(adminLimiter);

/**
 * Admin Table Permissions Routes
 * 
 * Rotas para gerenciamento de permissões de tabela (apenas admin)
 * Todas as rotas requerem token administrativo válido
 */

/**
 * POST /api/admin/table-permissions
 * Cria uma nova permissão de tabela para um usuário
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Body:
 * - user_id: string (required) - ID/token do usuário
 * - table_name: string (required) - Nome da tabela
 * - can_read: boolean (optional) - Permissão de leitura
 * - can_write: boolean (optional) - Permissão de escrita
 * - can_delete: boolean (optional) - Permissão de exclusão
 */
router.post('/',
  async (req, res) => {
    try {
      const { user_id, table_name, can_read, can_write, can_delete } = req.body;
      
      // Validar campos obrigatórios
      if (!user_id || !table_name) {
        logger.warn('⚠️ Campos obrigatórios ausentes:', {
          has_user_id: !!user_id,
          has_table_name: !!table_name
        });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Campos obrigatórios: user_id, table_name',
          code: 'MISSING_REQUIRED_FIELDS',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validar formato do nome da tabela
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table_name)) {
        logger.warn('⚠️ Nome de tabela inválido:', { table_name });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Nome de tabela inválido',
          code: 'INVALID_TABLE_NAME',
          timestamp: new Date().toISOString()
        });
      }
      
      const db = req.app.locals.db;
      
      // Criar permissão
      const permission = await db.createTablePermission(user_id, table_name, {
        can_read: can_read || false,
        can_write: can_write || false,
        can_delete: can_delete || false
      });
      
      logger.info('✅ Permissão de tabela criada:', {
        permission_id: permission.id,
        user_id,
        table_name
      });
      
      res.status(201).json({
        success: true,
        data: permission,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      if (error.message && error.message.includes('Permission already exists')) {
        logger.warn('⚠️ Permissão já existe:', { error: error.message });
        
        return res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message,
          code: 'PERMISSION_ALREADY_EXISTS',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.error('❌ Erro ao criar permissão:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao criar permissão',
        code: 'CREATE_PERMISSION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/admin/table-permissions
 * Lista todas as permissões de tabela
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Query params:
 * - user_id: string (optional) - Filtrar por usuário
 */
router.get('/',
  async (req, res) => {
    try {
      const { user_id } = req.query;
      const db = req.app.locals.db;
      
      let permissions;
      
      if (user_id) {
        // Buscar permissões de um usuário específico
        permissions = await db.getUserTablePermissions(user_id);
        
        logger.info('✅ Permissões de usuário listadas:', {
          user_id,
          count: permissions.length
        });
      } else {
        // Buscar todas as permissões
        permissions = await db.getAllTablePermissions();
        
        logger.info('✅ Todas as permissões listadas:', {
          count: permissions.length
        });
      }
      
      res.json({
        success: true,
        data: permissions,
        count: permissions.length,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao listar permissões:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao listar permissões',
        code: 'LIST_PERMISSIONS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/admin/table-permissions/:id
 * Busca uma permissão específica por ID
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Params:
 * - id: number - ID da permissão
 */
router.get('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = req.app.locals.db;
      
      // Buscar permissão por ID usando o método do SupabaseService
      const SupabaseService = require('../services/SupabaseService');
      const { data, error } = await SupabaseService.getById('table_permissions', id);
      
      if (error || !data) {
        logger.warn('⚠️ Permissão não encontrada:', { id });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Permissão não encontrada',
          code: 'PERMISSION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Permissão encontrada:', { id });
      
      res.json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao buscar permissão:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao buscar permissão',
        code: 'GET_PERMISSION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * PUT /api/admin/table-permissions/:id
 * Atualiza uma permissão existente
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Params:
 * - id: number - ID da permissão
 * 
 * Body:
 * - can_read: boolean (optional)
 * - can_write: boolean (optional)
 * - can_delete: boolean (optional)
 */
router.put('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      const { can_read, can_write, can_delete } = req.body;
      
      // Validar que pelo menos um campo foi fornecido
      if (can_read === undefined && can_write === undefined && can_delete === undefined) {
        logger.warn('⚠️ Nenhum campo para atualizar:', { id });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Pelo menos um campo deve ser fornecido para atualização',
          code: 'NO_FIELDS_TO_UPDATE',
          timestamp: new Date().toISOString()
        });
      }
      
      const db = req.app.locals.db;
      
      // Atualizar permissão
      const updated = await db.updateTablePermission(id, {
        can_read: can_read !== undefined ? can_read : undefined,
        can_write: can_write !== undefined ? can_write : undefined,
        can_delete: can_delete !== undefined ? can_delete : undefined
      });
      
      if (!updated) {
        logger.warn('⚠️ Permissão não encontrada para atualização:', { id });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Permissão não encontrada',
          code: 'PERMISSION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Permissão atualizada:', { id });
      
      res.json({
        success: true,
        message: 'Permissão atualizada com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao atualizar permissão:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao atualizar permissão',
        code: 'UPDATE_PERMISSION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * DELETE /api/admin/table-permissions/:id
 * Deleta uma permissão
 * 
 * Autenticação: Sessão admin (via middleware global requireAdmin)
 * 
 * Params:
 * - id: number - ID da permissão
 */
router.delete('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      const db = req.app.locals.db;
      
      // Deletar permissão
      const deleted = await db.deleteTablePermission(id);
      
      if (!deleted) {
        logger.warn('⚠️ Permissão não encontrada para deleção:', { id });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Permissão não encontrada',
          code: 'PERMISSION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      logger.info('✅ Permissão deletada:', { id });
      
      res.json({
        success: true,
        message: 'Permissão deletada com sucesso',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao deletar permissão:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao deletar permissão',
        code: 'DELETE_PERMISSION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
