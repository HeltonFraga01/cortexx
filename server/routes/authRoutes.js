const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const securityLogger = require('../utils/securityLogger');
const wuzapiClient = require('../utils/wuzapiClient');
const AgentService = require('../services/AgentService');
const AccountService = require('../services/AccountService');
const { regenerateSession } = require('../utils/sessionHelper');

// Initialize services at module level (uses SupabaseService internally)
const agentService = new AgentService();
const accountService = new AccountService();

/**
 * POST /api/auth/admin-login
 * 
 * Login de administrador via email/senha (Agent com role owner/administrator)
 * Cria sessão HTTP-only para acesso às rotas /admin
 * 
 * FIXED: Now uses regenerateSession() helper for proper session persistence.
 */
router.post('/admin-login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    if (!email || !password) {
      return res.status(400).json({
        error: 'Email e senha são obrigatórios',
        code: 'INVALID_INPUT'
      });
    }
    
    // Get tenant context from subdomain (set by subdomainRouter middleware)
    const tenantId = req.context?.tenantId || null;
    
    // Find agent by email (filtered by tenant if available)
    const agent = await agentService.getAgentByEmailOnly(email, tenantId);
    
    if (!agent) {
      securityLogger.logLoginAttempt(false, {
        ip: req.ip,
        reason: 'Agent not found',
        email
      });
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Check if agent has admin role (owner or administrator)
    if (agent.role !== 'owner' && agent.role !== 'administrator') {
      securityLogger.logLoginAttempt(false, {
        ip: req.ip,
        reason: 'Not an admin role',
        email,
        role: agent.role
      });
      return res.status(403).json({
        error: 'Acesso negado. Apenas administradores podem acessar.',
        code: 'NOT_ADMIN'
      });
    }
    
    // Check agent status
    if (agent.status !== 'active') {
      return res.status(403).json({
        error: 'Conta desativada',
        code: 'AGENT_INACTIVE'
      });
    }
    
    // Verify password
    const isValidPassword = await agentService.verifyPassword(password, agent.passwordHash);
    
    if (!isValidPassword) {
      await agentService.recordFailedLogin(agent.id);
      securityLogger.logLoginAttempt(false, {
        ip: req.ip,
        reason: 'Invalid password',
        email
      });
      return res.status(401).json({
        error: 'Credenciais inválidas',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // Reset failed login attempts
    await agentService.resetFailedLogins(agent.id);
    
    // Get account info
    const account = await accountService.getAccountById(agent.accountId);
    
    if (!account || account.status !== 'active') {
      return res.status(403).json({
        error: 'Conta desativada',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Log existing session if any
    if (req.session?.userId) {
      logger.info('Destroying existing session before admin login', {
        oldUserId: req.session.userId,
        oldRole: req.session.role,
        ip: req.ip
      });
    }
    
    // Use regenerateSession helper for proper session persistence
    await regenerateSession(req, {
      userId: agent.id,
      role: 'admin',
      userToken: account.wuzapiToken || '', // WUZAPI token from account
      userName: agent.name,
      userEmail: agent.email,
      agentRole: agent.role, // Store original agent role
      accountId: account.id,
      accountName: account.name,
      tenantId: account.tenantId
    });
    
    securityLogger.logLoginAttempt(true, {
      ip: req.ip,
      userId: agent.id,
      role: 'admin',
      email
    });
    
    logger.info('Admin logged in via agent credentials', {
      agentId: agent.id,
      accountId: account.id,
      role: agent.role,
      sessionId: req.sessionID,
      ip: req.ip
    });
    
    res.json({
      success: true,
      user: {
        id: agent.id,
        role: 'admin',
        token: account.wuzapiToken,
        name: agent.name,
        email: agent.email,
        accountId: account.id,
        accountName: account.name
      }
    });
    
  } catch (error) {
    logger.error('Admin login error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'SERVER_ERROR'
    });
  }
});

/**
 * POST /api/auth/login
 * 
 * Autentica usuário e cria sessão
 * 
 * Body:
 * - token: Token de acesso (admin ou user)
 * - role: 'admin' ou 'user'
 * 
 * FIXED: Now uses regenerateSession() helper for proper session persistence.
 * This fixes the bug where session data (userId, role) was not being persisted.
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
    
    // Log existing session if any
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
      const response = await wuzapiClient.getAdmin('/admin/users', adminToken);
      
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
      
      // Use hashed token as userId for consistency with quota/subscription system
      const { hashToken } = require('../utils/userIdResolver');
      const userId = hashToken(token);
      
      userData = {
        id: userId,
        name: userName,
        role: 'user',
        jid: userJid
      };
    }
    
    // Use regenerateSession helper for proper session persistence
    // This is the FIX for the session persistence bug
    await regenerateSession(req, {
      userId: userData.id,
      role: role,
      userToken: token,
      userName: userData.name || userData.id,
      userJid: userData.jid || null,
      tenantContext: tenantContext
    });
    
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
      stack: error.stack,
      ip: req.ip
    });
    
    securityLogger.logLoginAttempt(false, {
      ip: req.ip,
      reason: error.message
    });
    
    // Check if it's a session error
    if (error.message.includes('Session')) {
      return res.status(500).json({ 
        error: 'Falha ao criar sessão',
        code: 'SESSION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
    
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
