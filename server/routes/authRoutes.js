const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const wuzapiClient = require('../utils/wuzapiClient');

/**
 * POST /api/auth/login
 * 
 * Autentica usuário e cria sessão
 * 
 * Body:
 * - token: Token de acesso (admin ou user)
 * - role: 'admin' ou 'user'
 */
router.post('/login', async (req, res) => {
  const { token, role } = req.body;
  
  try {
    // Validar entrada
    if (!token || !role) {
      securityLogger.logLoginAttempt(false, {
        ip: req.ip,
        reason: 'Missing token or role'
      });
      
      return res.status(400).json({ 
        error: 'Token e role são obrigatórios',
        code: 'INVALID_INPUT',
        timestamp: new Date().toISOString()
      });
    }
    
    if (!['admin', 'user'].includes(role)) {
      securityLogger.logLoginAttempt(false, {
        ip: req.ip,
        reason: 'Invalid role'
      });
      
      return res.status(400).json({ 
        error: 'Role deve ser admin ou user',
        code: 'INVALID_ROLE',
        timestamp: new Date().toISOString()
      });
    }
    
    // Multi-tenant: Extract subdomain and resolve tenant context
    // Requirements: 8.2 - Scope login to tenant context
    let tenantContext = null;
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname);
    
    if (subdomain && subdomain !== 'www' && subdomain !== 'api' && subdomain !== 'superadmin') {
      try {
        const TenantService = require('../services/TenantService');
        const tenantService = new TenantService();
        const tenant = await tenantService.getBySubdomain(subdomain);
        
        if (tenant && tenant.status === 'active') {
          tenantContext = {
            tenantId: tenant.id,
            subdomain: tenant.subdomain,
            name: tenant.name
          };
          
          logger.info('Tenant context resolved for login', {
            subdomain,
            tenantId: tenant.id,
            tenantName: tenant.name,
            role
          });
        } else if (tenant && tenant.status !== 'active') {
          logger.warn('Login attempt on inactive tenant', {
            subdomain,
            tenantId: tenant.id,
            tenantStatus: tenant.status,
            ip: req.ip
          });
          
          return res.status(403).json({
            error: 'Tenant is not active',
            code: 'TENANT_INACTIVE',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        logger.warn('Failed to resolve tenant context for login', {
          subdomain,
          hostname,
          error: error.message,
          ip: req.ip
        });
      }
    }
    
    // CRITICAL: Destroy any existing session before creating a new one
    // This prevents stale session data from causing authentication loops
    // when users log out and log in with different credentials
    const oldSessionId = req.sessionID;
    const hadExistingSession = !!req.session?.userId;
    
    if (hadExistingSession) {
      logger.info('Destroying existing session before new login', {
        oldSessionId,
        oldUserId: req.session.userId,
        oldRole: req.session.role,
        newRole: role,
        ip: req.ip
      });
    }
    
    // Validar token com WuzAPI
    let userData;
    
    if (role === 'admin') {
      // Para admin, validar contra token admin do servidor
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      
      if (token !== adminToken) {
        securityLogger.logLoginAttempt(false, {
          ip: req.ip,
          role: 'admin',
          reason: 'Invalid admin token'
        });
        
        return res.status(401).json({ 
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validar que o token funciona com WuzAPI usando endpoint admin correto
      // Endpoint: GET /admin/users com header Authorization (não token)
      const response = await wuzapiClient.getAdmin('/admin/users', adminToken);
      
      // CRÍTICO: Verificar se a resposta foi bem-sucedida
      // wuzapiClient.getAdmin() retorna { success: false } em caso de erro, não lança exceção
      if (!response.success) {
        logger.error('Failed to validate admin token with WuzAPI', {
          error: response.error || 'WuzAPI validation failed',
          status: response.status
        });
        
        securityLogger.logLoginAttempt(false, {
          ip: req.ip,
          role: 'admin',
          reason: 'WuzAPI validation failed'
        });
        
        return res.status(503).json({ 
          error: 'Serviço de autenticação indisponível',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: new Date().toISOString()
        });
      }
      
      // Generate a consistent UUID for admin using hash of admin token
      // This ensures the admin always gets the same userId across sessions
      const { hashToken } = require('../utils/userIdResolver');
      const adminUserId = hashToken(adminToken);
      
      userData = {
        id: adminUserId,
        role: 'admin'
      };
    } else {
      // Para user, validar token com WuzAPI
      const response = await wuzapiClient.get('/session/status', {
        headers: { token }
      });
      
      // CRÍTICO: Verificar se a resposta foi bem-sucedida
      // wuzapiClient.get() retorna { success: false } em caso de erro, não lança exceção
      if (!response.success) {
        logger.error('Failed to validate user token with WuzAPI', {
          error: response.error || 'Token validation failed',
          status: response.status
        });
        
        securityLogger.logLoginAttempt(false, {
          ip: req.ip,
          role: 'user',
          reason: 'Invalid user token - WuzAPI rejected'
        });
        
        return res.status(401).json({ 
          error: 'Credenciais inválidas',
          code: 'INVALID_CREDENTIALS',
          timestamp: new Date().toISOString()
        });
      }
      
      // Token válido - buscar informações do usuário
      let userName = token; // Fallback para o token
      let userJid = null;
      
      // Buscar informações adicionais do usuário do admin endpoint
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      if (adminToken) {
        const usersResponse = await wuzapiClient.getAdmin('/admin/users', adminToken);
        
        if (usersResponse.success && usersResponse.data && usersResponse.data.data) {
          // Procurar o usuário pelo token
          const user = usersResponse.data.data.find(u => u.token === token);
          if (user) {
            if (user.name) {
              userName = user.name;
            }
            if (user.jid) {
              userJid = user.jid;
            }
          }
        }
      }
      
      // IMPORTANT: Use hashed token as userId for consistency with quota/subscription system
      // The hash ensures consistent user identification across all services
      const { hashToken } = require('../utils/userIdResolver');
      const userId = hashToken(token);
      
      userData = {
        id: userId,
        name: userName,
        role: 'user',
        jid: userJid
      };
    }
    
    // CRITICAL: Destroy existing session completely and create fresh one
    // This is more aggressive than regenerate() to ensure no stale data persists
    const destroyAndCreateSession = () => {
      return new Promise((resolve, reject) => {
        // First, completely destroy the old session
        const oldData = {
          userId: req.session?.userId,
          role: req.session?.role,
          userToken: req.session?.userToken
        };
        
        // Log if there's a mismatch (user trying to login as different role)
        if (oldData.userId && oldData.role !== role) {
          logger.warn('Role change detected during login', {
            oldUserId: oldData.userId,
            oldRole: oldData.role,
            newRole: role,
            newUserId: userData.id,
            ip: req.ip
          });
        }
        
        // Destroy the session first
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            logger.warn('Session destroy before login failed', {
              error: destroyErr.message,
              ip: req.ip
            });
          }
          
          // Now regenerate to get a completely fresh session
          // Note: After destroy, req.session is null, so we need to use regenerate
          // which will create a new session
          req.session = null; // Ensure it's cleared
          
          // Use the session middleware to create a new session
          // by calling regenerate on the request
          req.sessionStore.generate(req);
          
          // Set new session data
          req.session.userId = userData.id;
          req.session.userToken = token;
          req.session.userName = userData.name || userData.id;
          req.session.userJid = userData.jid || null;
          req.session.role = role;
          req.session.createdAt = new Date().toISOString();
          req.session.lastActivity = new Date().toISOString();
          
          // Multi-tenant: Set tenant context in session
          // Requirements: 8.2 - Validate credentials within tenant only
          if (tenantContext) {
            req.session.tenantId = tenantContext.tenantId;
            req.session.tenantSubdomain = tenantContext.subdomain;
            req.session.tenantName = tenantContext.name;
            
            logger.info('Tenant context added to session', {
              userId: userData.id,
              tenantId: tenantContext.tenantId,
              subdomain: tenantContext.subdomain
            });
          }
          
          // Log the new session state
          logger.info('New session created after destroy', {
            newSessionId: req.sessionID,
            userId: userData.id,
            role: role,
            ip: req.ip
          });
          
          // Save session explicitly to ensure it's persisted
          req.session.save((saveErr) => {
            if (saveErr) {
              logger.error('Session save failed after destroy', {
                error: saveErr.message,
                userId: userData.id,
                ip: req.ip
              });
              reject(saveErr);
            } else {
              logger.info('Session saved successfully', {
                sessionId: req.sessionID,
                userId: userData.id,
                role: role
              });
              resolve();
            }
          });
        });
      });
    };
    
    await destroyAndCreateSession();
    
    // Log sucesso
    securityLogger.logLoginAttempt(true, {
      ip: req.ip,
      userId: userData.id,
      role: role
    });
    
    securityLogger.logSessionChange('created', {
      userId: userData.id,
      sessionId: req.sessionID,
      ip: req.ip,
      regenerated: true
    });
    
    logger.info('User logged in with regenerated session', {
      userId: userData.id,
      role: role,
      ip: req.ip,
      newSessionId: req.sessionID,
      hadExistingSession
    });
    
    res.json({
      success: true,
      user: {
        id: userData.id,
        role: role,
        token: token,
        name: userData.name || userData.id,
        jid: userData.jid || null
      }
    });
    
  } catch (error) {
    logger.error('Login error', {
      error: error.message,
      ip: req.ip
    });
    
    securityLogger.logLoginAttempt(false, {
      ip: req.ip,
      reason: error.message
    });
    
    res.status(500).json({ 
      error: 'Falha na autenticação',
      code: 'AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/auth/logout
 * 
 * Destrói sessão do usuário
 */
router.post('/logout', (req, res) => {
  const userId = req.session?.userId;
  const sessionId = req.sessionID;
  const role = req.session?.role;
  
  // Helper to clear cookie with consistent options
  const clearSessionCookie = () => {
    // Use same cookie options as session config for proper clearing
    const cookieSecure = process.env.COOKIE_SECURE === 'true' || false;
    const cookieSameSite = process.env.COOKIE_SAMESITE || 'lax';
    
    res.clearCookie('wuzapi.sid', {
      path: '/',
      httpOnly: true,
      secure: cookieSecure,
      sameSite: cookieSameSite
    });
  };
  
  if (!userId) {
    // Even without session data, destroy the session and clear cookie
    // This handles edge cases where session exists but userId is missing
    logger.info('Logout requested without active session', {
      sessionId,
      ip: req.ip
    });
    
    if (req.session) {
      req.session.destroy(() => {
        clearSessionCookie();
        res.json({ success: true });
      });
    } else {
      clearSessionCookie();
      res.json({ success: true });
    }
    return;
  }
  
  // Clear all session data first (belt and suspenders approach)
  req.session.userId = null;
  req.session.userToken = null;
  req.session.userName = null;
  req.session.userJid = null;
  req.session.role = null;
  req.session.createdAt = null;
  req.session.lastActivity = null;
  
  req.session.destroy((err) => {
    // Always clear the cookie, regardless of destroy result
    clearSessionCookie();
    
    if (err) {
      logger.error('Logout session destroy error', { 
        error: err.message,
        userId,
        sessionId,
        ip: req.ip
      });
      
      // Still return success since we cleared the cookie
      // The session will expire naturally
      securityLogger.logSessionChange('destroyed_with_error', {
        userId,
        sessionId,
        ip: req.ip,
        error: err.message
      });
      
      return res.json({ success: true, warning: 'Session cleared with minor error' });
    }
    
    securityLogger.logSessionChange('destroyed', {
      userId,
      sessionId,
      role,
      ip: req.ip
    });
    
    logger.info('User logged out successfully', { 
      userId, 
      role,
      sessionId,
      ip: req.ip
    });
    
    res.json({ success: true });
  });
});

/**
 * GET /api/auth/status
 * 
 * Verifica status da autenticação
 */
router.get('/status', async (req, res) => {
  if (!req.session?.userId) {
    return res.json({ 
      authenticated: false 
    });
  }
  
  // Handle superadmin authentication status
  if (req.session.role === 'superadmin') {
    const superadminData = req.session.superadminData || {};
    return res.json({
      authenticated: true,
      user: {
        id: req.session.userId,
        role: 'superadmin',
        token: req.session.sessionToken || '',
        name: superadminData.name || superadminData.email || 'Superadmin',
        jid: null
      }
    });
  }
  
  // Buscar nome do usuário se for role user e não estiver em cache
  let userName = req.session.userName || req.session.userId;
  let userJid = req.session.userJid || null;
  
  if (req.session.role === 'user' && (!req.session.userName || !req.session.userJid)) {
    try {
      const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
      const usersResponse = await wuzapiClient.getAdmin('/admin/users', adminToken);
      
      if (usersResponse.success && usersResponse.data && usersResponse.data.data) {
        const user = usersResponse.data.data.find(u => u.token === req.session.userToken);
        if (user) {
          if (user.name) {
            userName = user.name;
            req.session.userName = userName; // Cache na sessão
          }
          if (user.jid) {
            userJid = user.jid;
            req.session.userJid = userJid; // Cache na sessão
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to fetch user info in status check', {
        error: error.message
      });
    }
  }
  
  res.json({
    authenticated: true,
    user: {
      id: req.session.userId,
      role: req.session.role,
      token: req.session.userToken, // Incluir token para chamadas à API
      name: userName,
      jid: userJid // Incluir JID do WhatsApp
    }
  });
});

/**
 * Helper function to extract subdomain from hostname
 * @param {string} hostname - Full hostname
 * @returns {string|null} Subdomain or null
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;

  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // If less than 3 parts, no subdomain (e.g., localhost, example.com)
  if (parts.length < 3) return null;
  
  // Return the first part as subdomain
  return parts[0].toLowerCase();
}

module.exports = router;
