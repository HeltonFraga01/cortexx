const assert = require('assert');
const { describe, it, beforeEach, afterEach } = require('node:test');
const securityLogger = require('../utils/securityLogger');
const { logger } = require('../utils/logger');

describe('Security Logger', () => {
  let loggedMessages = [];
  let originalLog;
  let originalWarn;
  let originalError;

  beforeEach(() => {
    // Capturar logs
    loggedMessages = [];
    
    originalLog = logger.info;
    originalWarn = logger.warn;
    originalError = logger.error;
    
    logger.info = (message, data) => {
      loggedMessages.push({ level: 'info', message, data });
    };
    
    logger.warn = (message, data) => {
      loggedMessages.push({ level: 'warn', message, data });
    };
    
    logger.error = (message, data) => {
      loggedMessages.push({ level: 'error', message, data });
    };
  });

  afterEach(() => {
    // Restaurar logs originais
    logger.info = originalLog;
    logger.warn = originalWarn;
    logger.error = originalError;
  });

  describe('logLoginAttempt', () => {
    it('deve logar login bem-sucedido com nível info', () => {
      securityLogger.logLoginAttempt(true, {
        ip: '192.168.1.1',
        userId: 'user123',
        role: 'admin'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'info');
      assert.strictEqual(loggedMessages[0].message, 'Login successful');
      assert.strictEqual(loggedMessages[0].data.success, true);
      assert.strictEqual(loggedMessages[0].data.userId, 'user123');
      assert.strictEqual(loggedMessages[0].data.role, 'admin');
      assert.strictEqual(loggedMessages[0].data.event, 'login_attempt');
    });

    it('deve logar login falhado com nível warn', () => {
      securityLogger.logLoginAttempt(false, {
        ip: '192.168.1.1',
        reason: 'Invalid credentials'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'warn');
      assert.strictEqual(loggedMessages[0].message, 'Login failed');
      assert.strictEqual(loggedMessages[0].data.success, false);
      assert.strictEqual(loggedMessages[0].data.reason, 'Invalid credentials');
    });
  });

  describe('logAdminAccess', () => {
    it('deve logar acesso a endpoint admin', () => {
      securityLogger.logAdminAccess({
        userId: 'admin123',
        ip: '192.168.1.1',
        path: '/api/admin/users',
        method: 'GET'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'info');
      assert.strictEqual(loggedMessages[0].message, 'Admin endpoint access');
      assert.strictEqual(loggedMessages[0].data.userId, 'admin123');
      assert.strictEqual(loggedMessages[0].data.path, '/api/admin/users');
      assert.strictEqual(loggedMessages[0].data.method, 'GET');
      assert.strictEqual(loggedMessages[0].data.event, 'admin_access');
    });
  });

  describe('logUnauthorizedAccess', () => {
    it('deve logar tentativa de acesso não autorizado', () => {
      securityLogger.logUnauthorizedAccess({
        userId: 'user123',
        ip: '192.168.1.1',
        path: '/api/admin/users',
        reason: 'Insufficient permissions'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'warn');
      assert.strictEqual(loggedMessages[0].message, 'Unauthorized access attempt');
      assert.strictEqual(loggedMessages[0].data.reason, 'Insufficient permissions');
      assert.strictEqual(loggedMessages[0].data.event, 'unauthorized_access');
    });

    it('deve logar tentativa sem userId', () => {
      securityLogger.logUnauthorizedAccess({
        ip: '192.168.1.1',
        path: '/api/admin/users',
        reason: 'Not authenticated'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].data.userId, null);
    });
  });

  describe('logSuspiciousActivity', () => {
    it('deve logar atividade suspeita', () => {
      securityLogger.logSuspiciousActivity({
        type: 'multiple_failed_logins',
        userId: 'user123',
        ip: '192.168.1.1',
        details: { attempts: 10, timeWindow: '5 minutes' }
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'error');
      assert.strictEqual(loggedMessages[0].message, 'Suspicious activity detected');
      assert.strictEqual(loggedMessages[0].data.type, 'multiple_failed_logins');
      assert.deepStrictEqual(loggedMessages[0].data.details, { 
        attempts: 10, 
        timeWindow: '5 minutes' 
      });
      assert.strictEqual(loggedMessages[0].data.event, 'suspicious_activity');
    });
  });

  describe('logSessionChange', () => {
    it('deve logar criação de sessão', () => {
      securityLogger.logSessionChange('created', {
        userId: 'user123',
        sessionId: 'sess_abc123',
        ip: '192.168.1.1'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'info');
      assert.strictEqual(loggedMessages[0].message, 'Session created');
      assert.strictEqual(loggedMessages[0].data.action, 'created');
      assert.strictEqual(loggedMessages[0].data.sessionId, 'sess_abc123');
      assert.strictEqual(loggedMessages[0].data.event, 'session_change');
    });

    it('deve logar destruição de sessão', () => {
      securityLogger.logSessionChange('destroyed', {
        userId: 'user123',
        sessionId: 'sess_abc123',
        ip: '192.168.1.1'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].message, 'Session destroyed');
    });
  });

  describe('logTokenValidationFailure', () => {
    it('deve logar falha de validação de token', () => {
      securityLogger.logTokenValidationFailure({
        ip: '192.168.1.1',
        path: '/api/user/profile',
        reason: 'Token expired'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'warn');
      assert.strictEqual(loggedMessages[0].message, 'Token validation failed');
      assert.strictEqual(loggedMessages[0].data.reason, 'Token expired');
      assert.strictEqual(loggedMessages[0].data.event, 'token_validation_failure');
    });
  });

  describe('logRateLimitExceeded', () => {
    it('deve logar rate limit excedido', () => {
      securityLogger.logRateLimitExceeded({
        ip: '192.168.1.1',
        path: '/api/auth/login',
        limit: '5 requests per 15 minutes'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'warn');
      assert.strictEqual(loggedMessages[0].message, 'Rate limit exceeded');
      assert.strictEqual(loggedMessages[0].data.limit, '5 requests per 15 minutes');
      assert.strictEqual(loggedMessages[0].data.event, 'rate_limit_exceeded');
    });
  });

  describe('logPermissionChange', () => {
    it('deve logar mudança de permissões', () => {
      securityLogger.logPermissionChange({
        adminId: 'admin123',
        targetUserId: 'user456',
        action: 'grant_admin',
        changes: { role: 'admin', permissions: ['read', 'write'] }
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'info');
      assert.strictEqual(loggedMessages[0].message, 'Permission change');
      assert.strictEqual(loggedMessages[0].data.adminId, 'admin123');
      assert.strictEqual(loggedMessages[0].data.targetUserId, 'user456');
      assert.strictEqual(loggedMessages[0].data.action, 'grant_admin');
      assert.strictEqual(loggedMessages[0].data.event, 'permission_change');
    });
  });

  describe('logSensitiveDataAccess', () => {
    it('deve logar acesso a dados sensíveis', () => {
      securityLogger.logSensitiveDataAccess({
        userId: 'user123',
        ip: '192.168.1.1',
        resource: 'user_credentials',
        action: 'read'
      });

      assert.strictEqual(loggedMessages.length, 1);
      assert.strictEqual(loggedMessages[0].level, 'info');
      assert.strictEqual(loggedMessages[0].message, 'Sensitive data access');
      assert.strictEqual(loggedMessages[0].data.resource, 'user_credentials');
      assert.strictEqual(loggedMessages[0].data.action, 'read');
      assert.strictEqual(loggedMessages[0].data.event, 'sensitive_data_access');
    });
  });

  describe('Timestamp', () => {
    it('deve incluir timestamp em todos os logs', () => {
      securityLogger.logLoginAttempt(true, {
        ip: '192.168.1.1',
        userId: 'user123',
        role: 'admin'
      });

      assert.ok(loggedMessages[0].data.timestamp);
      assert.ok(new Date(loggedMessages[0].data.timestamp).getTime() > 0);
    });
  });
});
