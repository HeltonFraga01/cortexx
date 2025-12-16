const { logger } = require('./logger');

/**
 * Security Logger
 * 
 * Fornece métodos especializados para logging de eventos de segurança.
 * Todos os logs incluem timestamp, IP, userId e contexto relevante.
 */
class SecurityLogger {
  /**
   * Log tentativa de login
   * 
   * @param {boolean} success - Se o login foi bem-sucedido
   * @param {Object} data - Dados da tentativa
   * @param {string} data.ip - Endereço IP do cliente
   * @param {string} [data.userId] - ID do usuário (se sucesso)
   * @param {string} [data.role] - Role do usuário (admin/user)
   * @param {string} [data.reason] - Motivo da falha (se falhou)
   * @param {string} [data.userAgent] - User-Agent do cliente
   * @param {string} [data.path] - Path da requisição
   * @param {string} [data.method] - Método HTTP
   */
  logLoginAttempt(success, data) {
    const level = success ? 'info' : 'warn';
    const message = success ? 'Login successful' : 'Login failed';
    
    logger[level](message, {
      success,
      ip: data.ip,
      userId: data.userId || null,
      role: data.role || null,
      reason: data.reason || null,
      userAgent: data.userAgent || null,
      path: data.path || '/api/auth/login',
      method: data.method || 'POST',
      timestamp: new Date().toISOString(),
      event: 'login_attempt'
    });
  }
  
  /**
   * Log acesso a endpoint admin
   * 
   * @param {Object} data - Dados do acesso
   * @param {string} data.userId - ID do usuário
   * @param {string} data.ip - Endereço IP
   * @param {string} data.path - Path do endpoint
   * @param {string} data.method - Método HTTP
   */
  logAdminAccess(data) {
    logger.info('Admin endpoint access', {
      userId: data.userId,
      ip: data.ip,
      path: data.path,
      method: data.method,
      timestamp: new Date().toISOString(),
      event: 'admin_access'
    });
  }
  
  /**
   * Log tentativa de acesso não autorizado
   * 
   * @param {Object} data - Dados da tentativa
   * @param {string} [data.userId] - ID do usuário (se autenticado)
   * @param {string} data.ip - Endereço IP
   * @param {string} data.path - Path tentado
   * @param {string} data.reason - Motivo da negação
   */
  logUnauthorizedAccess(data) {
    logger.warn('Unauthorized access attempt', {
      userId: data.userId || null,
      ip: data.ip,
      path: data.path,
      reason: data.reason,
      timestamp: new Date().toISOString(),
      event: 'unauthorized_access'
    });
  }
  
  /**
   * Log atividade suspeita
   * 
   * @param {Object} data - Dados da atividade
   * @param {string} data.type - Tipo de atividade suspeita
   * @param {string} [data.userId] - ID do usuário (se conhecido)
   * @param {string} data.ip - Endereço IP
   * @param {Object} data.details - Detalhes adicionais
   */
  logSuspiciousActivity(data) {
    logger.error('Suspicious activity detected', {
      type: data.type,
      userId: data.userId || null,
      ip: data.ip,
      details: data.details,
      timestamp: new Date().toISOString(),
      event: 'suspicious_activity'
    });
  }
  
  /**
   * Log mudança de sessão
   * 
   * @param {string} action - Ação realizada (created, destroyed, expired)
   * @param {Object} data - Dados da sessão
   * @param {string} data.userId - ID do usuário
   * @param {string} data.sessionId - ID da sessão
   * @param {string} data.ip - Endereço IP
   */
  logSessionChange(action, data) {
    logger.info(`Session ${action}`, {
      action,
      userId: data.userId,
      sessionId: data.sessionId,
      ip: data.ip,
      timestamp: new Date().toISOString(),
      event: 'session_change'
    });
  }
  
  /**
   * Log falha de validação de token
   * 
   * @param {Object} data - Dados da falha
   * @param {string} data.ip - Endereço IP
   * @param {string} data.path - Path tentado
   * @param {string} data.reason - Motivo da falha
   */
  logTokenValidationFailure(data) {
    logger.warn('Token validation failed', {
      ip: data.ip,
      path: data.path,
      reason: data.reason,
      timestamp: new Date().toISOString(),
      event: 'token_validation_failure'
    });
  }
  
  /**
   * Log rate limit excedido
   * 
   * @param {Object} data - Dados do rate limit
   * @param {string} data.ip - Endereço IP
   * @param {string} data.path - Path tentado
   * @param {string} data.limit - Limite configurado
   */
  logRateLimitExceeded(data) {
    logger.warn('Rate limit exceeded', {
      ip: data.ip,
      path: data.path,
      limit: data.limit,
      timestamp: new Date().toISOString(),
      event: 'rate_limit_exceeded'
    });
  }
  
  /**
   * Log mudança de permissões
   * 
   * @param {Object} data - Dados da mudança
   * @param {string} data.adminId - ID do admin que fez a mudança
   * @param {string} data.targetUserId - ID do usuário afetado
   * @param {string} data.action - Ação realizada
   * @param {Object} data.changes - Mudanças realizadas
   */
  logPermissionChange(data) {
    logger.info('Permission change', {
      adminId: data.adminId,
      targetUserId: data.targetUserId,
      action: data.action,
      changes: data.changes,
      timestamp: new Date().toISOString(),
      event: 'permission_change'
    });
  }
  
  /**
   * Log acesso a dados sensíveis
   * 
   * @param {Object} data - Dados do acesso
   * @param {string} data.userId - ID do usuário
   * @param {string} data.ip - Endereço IP
   * @param {string} data.resource - Recurso acessado
   * @param {string} data.action - Ação realizada
   */
  logSensitiveDataAccess(data) {
    logger.info('Sensitive data access', {
      userId: data.userId,
      ip: data.ip,
      resource: data.resource,
      action: data.action,
      timestamp: new Date().toISOString(),
      event: 'sensitive_data_access'
    });
  }

  /**
   * Log fluxo de autenticação completo com timestamps
   * 
   * @param {Object} data - Dados do fluxo de autenticação
   * @param {string} data.flowId - ID único do fluxo
   * @param {string} data.stage - Estágio atual (start, token_validation, session_creation, complete)
   * @param {string} data.role - Role sendo autenticado
   * @param {string} data.ip - Endereço IP
   * @param {string} [data.userAgent] - User-Agent do cliente
   * @param {number} [data.duration] - Duração do estágio em ms
   * @param {Object} [data.details] - Detalhes adicionais do estágio
   */
  logAuthenticationFlow(data) {
    logger.debug(`Authentication flow - ${data.stage}`, {
      type: 'authentication_flow',
      flowId: data.flowId,
      stage: data.stage,
      role: data.role,
      ip: data.ip,
      userAgent: data.userAgent || null,
      duration: data.duration ? `${data.duration}ms` : null,
      details: data.details || {},
      timestamp: new Date().toISOString(),
      event: 'authentication_flow'
    });
  }

  /**
   * Log comunicação com WUZAPI
   * 
   * @param {Object} data - Dados da comunicação
   * @param {string} data.action - Ação realizada (token_validation, send_message, etc)
   * @param {boolean} data.success - Se a comunicação foi bem-sucedida
   * @param {number} [data.statusCode] - Status code da resposta
   * @param {number} [data.responseTime] - Tempo de resposta em ms
   * @param {string} [data.error] - Mensagem de erro (se falhou)
   * @param {string} [data.endpoint] - Endpoint WUZAPI chamado
   */
  logWuzapiCommunication(data) {
    const level = data.success ? 'debug' : 'error';
    const message = data.success 
      ? `WUZAPI communication successful: ${data.action}`
      : `WUZAPI communication failed: ${data.action}`;

    logger[level](message, {
      type: 'wuzapi_communication',
      action: data.action,
      success: data.success,
      statusCode: data.statusCode || null,
      responseTime: data.responseTime ? `${data.responseTime}ms` : null,
      error: data.error || null,
      endpoint: data.endpoint || null,
      wuzapiBaseUrl: process.env.WUZAPI_BASE_URL,
      timestamp: new Date().toISOString(),
      event: 'wuzapi_communication'
    });
  }

  /**
   * Log validação de sessão em rotas protegidas
   * 
   * @param {Object} data - Dados da validação
   * @param {boolean} data.valid - Se a sessão é válida
   * @param {string} [data.userId] - ID do usuário (se válido)
   * @param {string} [data.role] - Role do usuário (se válido)
   * @param {string} data.path - Path da rota protegida
   * @param {string} data.method - Método HTTP
   * @param {string} data.ip - Endereço IP
   * @param {string} [data.reason] - Motivo da invalidação (se inválido)
   */
  logSessionValidation(data) {
    const level = data.valid ? 'debug' : 'warn';
    const message = data.valid 
      ? 'Session validation successful'
      : 'Session validation failed';

    logger[level](message, {
      type: 'session_validation',
      valid: data.valid,
      userId: data.userId || null,
      role: data.role || null,
      path: data.path,
      method: data.method,
      ip: data.ip,
      reason: data.reason || null,
      timestamp: new Date().toISOString(),
      event: 'session_validation'
    });
  }

  /**
   * Log contexto completo de requisição para debugging
   * 
   * @param {Object} req - Objeto de requisição Express
   * @param {Object} additionalContext - Contexto adicional
   */
  logRequestContext(req, additionalContext = {}) {
    logger.debug('Request context', {
      type: 'request_context',
      request: {
        method: req.method,
        path: req.path,
        url: req.url,
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        contentType: req.get('Content-Type'),
        origin: req.get('Origin'),
        referer: req.get('Referer')
      },
      session: {
        exists: !!req.session,
        userId: req.session?.userId || null,
        role: req.session?.role || null
      },
      headers: {
        hasAuthHeader: !!req.get('Authorization'),
        hasTokenHeader: !!req.get('token'),
        hasCsrfToken: !!req.get('X-CSRF-Token')
      },
      ...additionalContext,
      timestamp: new Date().toISOString(),
      event: 'request_context'
    });
  }
}

module.exports = new SecurityLogger();
