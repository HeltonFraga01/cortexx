const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const SupabaseService = require('../services/SupabaseService');

/**
 * Middleware para validar permissões de acesso a tabelas
 * 
 * Verifica se o usuário tem permissão para realizar a operação solicitada
 * na tabela especificada.
 * 
 * Migrated to use SupabaseService directly (Task 14.1)
 * 
 * @param {string} permission - Tipo de permissão ('read', 'write', 'delete')
 * @returns {Function} Middleware Express
 */
function validateTablePermission(permission) {
  return async (req, res, next) => {
    try {
      const { tableName } = req.params;
      const userId = req.session?.userId;
      const userToken = req.session?.userToken;
      
      // Se não houver sessão, rejeitar
      if (!userId || !userToken) {
        securityLogger.logUnauthorizedAccess({
          ip: req.ip,
          path: req.path,
          reason: 'No active session for table access'
        });
        
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }
      
      // Buscar permissões do usuário para a tabela usando SupabaseService
      try {
        const { data: permissions, error } = await SupabaseService.queryAsAdmin('user_table_permissions', (query) =>
          query.select('can_read, can_write, can_delete')
            .eq('user_id', userId)
            .eq('table_name', tableName)
            .limit(1)
        );
        
        if (error) {
          throw error;
        }
        
        const userPermissions = permissions && permissions.length > 0 ? permissions[0] : null;
        
        // Verificar se tem a permissão necessária
        const hasPermission = checkPermission(userPermissions, permission);
        
        if (!hasPermission) {
          securityLogger.logUnauthorizedAccess({
            userId,
            ip: req.ip,
            path: req.path,
            reason: `Missing ${permission} permission for table ${tableName}`
          });
          
          return res.status(403).json({
            error: `You don't have ${permission} permission for this table`,
            code: 'INSUFFICIENT_PERMISSIONS'
          });
        }
        
        // Permissão concedida
        req.tablePermissions = userPermissions;
        next();
        
      } catch (dbError) {
        logger.error('Error checking table permissions', {
          error: dbError.message,
          userId,
          tableName,
          permission
        });
        
        // Em caso de erro, negar acesso por segurança
        return res.status(500).json({
          error: 'Error checking permissions',
          code: 'PERMISSION_CHECK_ERROR'
        });
      }
      
    } catch (error) {
      logger.error('Permission validation error', {
        error: error.message
      });
      
      res.status(500).json({
        error: 'Permission validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
  };
}

/**
 * Verifica se as permissões incluem a permissão solicitada
 * 
 * @param {Object} permissions - Objeto de permissões do usuário
 * @param {string} requiredPermission - Permissão necessária
 * @returns {boolean} True se tem permissão
 */
function checkPermission(permissions, requiredPermission) {
  if (!permissions) return false;
  
  switch (requiredPermission) {
    case 'read':
      return permissions.can_read === 1 || permissions.can_read === true;
    case 'write':
      return permissions.can_write === 1 || permissions.can_write === true;
    case 'delete':
      return permissions.can_delete === 1 || permissions.can_delete === true;
    default:
      return false;
  }
}

module.exports = {
  validateTablePermission
};
