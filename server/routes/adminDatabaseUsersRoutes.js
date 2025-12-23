const express = require('express');
const errorHandler = require('../middleware/errorHandler');
const { adminLimiter } = require('../middleware/rateLimiter');
const { requireAdminToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

// Aplicar rate limiter a todas as rotas admin
router.use(adminLimiter);

// Aplicar autenticação via token (para APIs externas como n8n)
router.use(requireAdminToken);

/**
 * Admin Database Users Routes
 * 
 * Rotas para gerenciamento de usuários atribuídos a conexões de banco de dados
 * Todas as rotas requerem token administrativo válido
 */

/**
 * POST /api/admin/database-connections/:connectionId/users
 * Atribui um ou mais usuários a uma conexão de banco de dados
 * 
 * Headers:
 * - Authorization: {admin_token}
 * 
 * Params:
 * - connectionId: number - ID da conexão
 * 
 * Body:
 * - user_ids: string[] (required) - Array de IDs/tokens de usuários
 * - create_permissions: boolean (optional) - Se true, cria permissões de tabela automaticamente
 * - permissions: object (optional) - Permissões padrão { can_read, can_write, can_delete }
 */
router.post('/:connectionId/users',
  async (req, res) => {
    try {
      const { connectionId } = req.params;
      const { user_ids, create_permissions = false, permissions = {} } = req.body;
      
      // Validar campos obrigatórios
      if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
        logger.warn('⚠️ user_ids inválido:', { user_ids });
        
        return res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'user_ids deve ser um array não vazio',
          code: 'INVALID_USER_IDS',
          timestamp: new Date().toISOString()
        });
      }
      
      // Buscar conexão usando SupabaseService
      const { data: connection, error: connError } = await SupabaseService.getById('database_connections', connectionId);
      
      if (connError || !connection) {
        logger.warn('⚠️ Conexão não encontrada:', { connectionId });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Conexão com ID ${connectionId} não encontrada`,
          code: 'CONNECTION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter usuários atualmente atribuídos
      let assignedUsers = [];
      try {
        assignedUsers = JSON.parse(connection.assigned_users || '[]');
      } catch (e) {
        logger.warn('⚠️ Erro ao parsear assigned_users, usando array vazio');
        assignedUsers = [];
      }
      
      // Adicionar novos usuários (evitar duplicatas)
      const newUsers = user_ids.filter(userId => !assignedUsers.includes(userId));
      const updatedUsers = [...assignedUsers, ...newUsers];
      
      // Atualizar conexão com novos usuários usando SupabaseService
      await SupabaseService.update('database_connections', connectionId, {
        assigned_users: JSON.stringify(updatedUsers),
        updated_at: new Date().toISOString()
      });
      
      logger.info('✅ Usuários atribuídos à conexão:', {
        connectionId,
        connection_name: connection.name,
        new_users: newUsers,
        total_users: updatedUsers.length
      });
      
      // Criar permissões de tabela se solicitado
      const createdPermissions = [];
      if (create_permissions && connection.table_name) {
        const defaultPermissions = {
          can_read: permissions.can_read !== undefined ? permissions.can_read : true,
          can_write: permissions.can_write !== undefined ? permissions.can_write : false,
          can_delete: permissions.can_delete !== undefined ? permissions.can_delete : false
        };
        
        for (const userId of newUsers) {
          try {
            // Create table permission using SupabaseService
            const { data: permission, error: permError } = await SupabaseService.insert('table_permissions', {
              user_id: userId,
              table_name: connection.table_name,
              can_read: defaultPermissions.can_read,
              can_write: defaultPermissions.can_write,
              can_delete: defaultPermissions.can_delete,
              created_at: new Date().toISOString()
            });
            
            if (permError) throw permError;
            
            createdPermissions.push({
              user_id: userId,
              table_name: connection.table_name,
              ...defaultPermissions
            });
            
            logger.info('✅ Permissão de tabela criada:', {
              user_id: userId,
              table_name: connection.table_name,
              permission_id: permission?.id
            });
          } catch (error) {
            // Se a permissão já existe, apenas logar e continuar
            if (error.message && error.message.includes('already exists')) {
              logger.info('ℹ️ Permissão já existe para usuário:', {
                user_id: userId,
                table_name: connection.table_name
              });
            } else {
              logger.error('❌ Erro ao criar permissão:', {
                user_id: userId,
                error: error.message
              });
            }
          }
        }
      }
      
      res.status(201).json({
        success: true,
        message: `${newUsers.length} usuário(s) atribuído(s) com sucesso`,
        data: {
          connection_id: connectionId,
          connection_name: connection.name,
          added_users: newUsers,
          total_users: updatedUsers.length,
          permissions_created: createdPermissions.length,
          permissions: createdPermissions
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao atribuir usuários:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao atribuir usuários',
        code: 'ASSIGN_USERS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * DELETE /api/admin/database-connections/:connectionId/users/:userId
 * Remove um usuário de uma conexão de banco de dados
 * 
 * Headers:
 * - Authorization: {admin_token}
 * 
 * Params:
 * - connectionId: number - ID da conexão
 * - userId: string - ID/token do usuário
 * 
 * Query params:
 * - delete_permissions: boolean (optional) - Se true, deleta também as permissões de tabela
 */
router.delete('/:connectionId/users/:userId',
  async (req, res) => {
    try {
      const { connectionId, userId } = req.params;
      const { delete_permissions = false } = req.query;
      
      // Buscar conexão usando SupabaseService
      const { data: connection, error: connError } = await SupabaseService.getById('database_connections', connectionId);
      
      if (connError || !connection) {
        logger.warn('⚠️ Conexão não encontrada:', { connectionId });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Conexão com ID ${connectionId} não encontrada`,
          code: 'CONNECTION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter usuários atualmente atribuídos
      let assignedUsers = [];
      try {
        assignedUsers = JSON.parse(connection.assigned_users || '[]');
      } catch (e) {
        logger.warn('⚠️ Erro ao parsear assigned_users');
        assignedUsers = [];
      }
      
      // Verificar se usuário está atribuído
      if (!assignedUsers.includes(userId)) {
        logger.warn('⚠️ Usuário não está atribuído a esta conexão:', {
          connectionId,
          userId
        });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Usuário não está atribuído a esta conexão',
          code: 'USER_NOT_ASSIGNED',
          timestamp: new Date().toISOString()
        });
      }
      
      // Remover usuário
      const updatedUsers = assignedUsers.filter(id => id !== userId);
      
      // Atualizar conexão usando SupabaseService
      await SupabaseService.update('database_connections', connectionId, {
        assigned_users: JSON.stringify(updatedUsers),
        updated_at: new Date().toISOString()
      });
      
      logger.info('✅ Usuário removido da conexão:', {
        connectionId,
        connection_name: connection.name,
        userId,
        remaining_users: updatedUsers.length
      });
      
      // Deletar permissões se solicitado
      let deletedPermissions = 0;
      if (delete_permissions && connection.table_name) {
        try {
          // Get user's table permissions using SupabaseService
          const { data: permissions, error: permError } = await SupabaseService.getMany('table_permissions', {
            user_id: userId,
            table_name: connection.table_name
          });
          
          if (!permError && permissions && permissions.length > 0) {
            const tablePermission = permissions[0];
            await SupabaseService.delete('table_permissions', tablePermission.id);
            deletedPermissions = 1;
            
            logger.info('✅ Permissão de tabela deletada:', {
              user_id: userId,
              table_name: connection.table_name,
              permission_id: tablePermission.id
            });
          }
        } catch (error) {
          logger.error('❌ Erro ao deletar permissão:', {
            user_id: userId,
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        message: 'Usuário removido com sucesso',
        data: {
          connection_id: connectionId,
          connection_name: connection.name,
          removed_user: userId,
          remaining_users: updatedUsers.length,
          permissions_deleted: deletedPermissions
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao remover usuário:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao remover usuário',
        code: 'REMOVE_USER_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

/**
 * GET /api/admin/database-connections/:connectionId/users
 * Lista todos os usuários atribuídos a uma conexão
 * 
 * Headers:
 * - Authorization: {admin_token}
 * 
 * Params:
 * - connectionId: number - ID da conexão
 */
router.get('/:connectionId/users',
  async (req, res) => {
    try {
      const { connectionId } = req.params;
      
      // Buscar conexão usando SupabaseService
      const { data: connection, error: connError } = await SupabaseService.getById('database_connections', connectionId);
      
      if (connError || !connection) {
        logger.warn('⚠️ Conexão não encontrada:', { connectionId });
        
        return res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Conexão com ID ${connectionId} não encontrada`,
          code: 'CONNECTION_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
      }
      
      // Obter usuários atribuídos
      let assignedUsers = [];
      try {
        assignedUsers = JSON.parse(connection.assigned_users || '[]');
      } catch (e) {
        logger.warn('⚠️ Erro ao parsear assigned_users');
        assignedUsers = [];
      }
      
      logger.info('✅ Usuários da conexão listados:', {
        connectionId,
        connection_name: connection.name,
        user_count: assignedUsers.length
      });
      
      res.json({
        success: true,
        data: {
          connection_id: connectionId,
          connection_name: connection.name,
          table_name: connection.table_name,
          users: assignedUsers,
          count: assignedUsers.length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('❌ Erro ao listar usuários:', {
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Erro ao listar usuários',
        code: 'LIST_USERS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
