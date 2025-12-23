/**
 * User Authentication Routes
 * 
 * Handles independent user login, logout, and session management.
 * These users authenticate via email/password and don't require WUZAPI token.
 * 
 * Requirements: 2.1, 2.3, 2.4, 6.2
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const UserService = require('../services/UserService');
const UserSessionService = require('../services/UserSessionService');
const { skipCsrf } = require('../middleware/csrf');
const { regenerateSession } = require('../utils/sessionHelper');

/**
 * POST /api/auth/user-login
 * User login via email/password
 * Note: skipCsrf is used because this is a public login endpoint
 * Requirements: 2.1, 2.3, 2.4, 6.2
 */
router.post('/user-login', skipCsrf, async (req, res) => {
  try {
    const { email, password, tenantId } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email e senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }

    // Default tenant for single-tenant setup
    const effectiveTenantId = tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    
    // Authenticate user
    const authResult = await UserService.authenticateUser(email, password, effectiveTenantId);
    
    if (!authResult.success) {
      logger.warn('User login failed', {
        email,
        tenantId: effectiveTenantId,
        error: authResult.error,
        ip: req.ip
      });
      
      const statusCode = authResult.error === 'ACCOUNT_LOCKED' ? 423 : 401;
      const errorMessages = {
        INVALID_CREDENTIALS: 'Credenciais inválidas',
        ACCOUNT_LOCKED: 'Conta bloqueada temporariamente. Tente novamente em 15 minutos.',
        ACCOUNT_INACTIVE: 'Conta desativada'
      };
      
      return res.status(statusCode).json({
        success: false,
        error: errorMessages[authResult.error] || 'Erro de autenticação',
        code: authResult.error
      });
    }
    
    const { user } = authResult;
    
    // Create token-based session (for API calls with Bearer token)
    const tokenSession = await UserSessionService.createSession({
      userId: user.id,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    // CRITICAL FIX: Also configure HTTP session for routes using requireAuth/requireUser
    // This ensures routes like /api/session/inboxes work correctly
    // Get user's WUZAPI token from their primary inbox if available
    let userWuzapiToken = tokenSession.sessionToken; // Default to session token
    try {
      const primaryInbox = await UserService.getPrimaryInbox(user.id);
      // Check both snake_case (from DB) and camelCase (if transformed)
      const inboxToken = primaryInbox?.wuzapi_token || primaryInbox?.wuzapiToken;
      if (inboxToken) {
        userWuzapiToken = inboxToken;
        logger.debug('Using WUZAPI token from primary inbox', { 
          userId: user.id,
          inboxId: primaryInbox.id
        });
      }
    } catch (inboxError) {
      logger.debug('Could not get primary inbox for WUZAPI token', { 
        userId: user.id, 
        error: inboxError.message 
      });
    }
    
    await regenerateSession(req, {
      userId: user.id,
      role: 'user',
      userToken: userWuzapiToken,
      userName: user.name || user.email,
      userEmail: user.email,
      tenantId: user.tenantId
    });
    
    // Update last login
    await UserService.updateLastLogin(user.id);
    
    // Get user inboxes
    const inboxes = await UserService.getUserInboxes(user.id);
    
    logger.info('User logged in', {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      data: {
        token: tokenSession.sessionToken,
        expiresAt: tokenSession.expiresAt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
          permissions: user.permissions
        },
        inboxes,
        role: 'user' // Requirements: 6.2 - Define role as 'user'
      }
    });
  } catch (error) {
    logger.error('User login error', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/user-logout
 * User logout - destroys session
 * Requirements: 2.1
 */
router.post('/user-logout', async (req, res) => {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers['x-user-token']) {
      token = req.headers['x-user-token'];
    } else if (req.cookies && req.cookies.user_session) {
      token = req.cookies.user_session;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Token não fornecido',
        code: 'NO_TOKEN'
      });
    }
    
    // Validate and get session
    const session = await UserSessionService.getSessionByToken(token);
    
    if (!session) {
      return res.status(401).json({
        success: false,
        error: 'Sessão inválida',
        code: 'INVALID_SESSION'
      });
    }
    
    // Delete session
    await UserSessionService.deleteSession(session.id);
    
    logger.info('User logged out', {
      userId: session.userId,
      sessionId: session.id,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Logout realizado com sucesso'
    });
  } catch (error) {
    logger.error('User logout error', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/auth/user/me
 * Get current user info
 * Requirements: 2.1
 */
router.get('/user/me', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers['x-user-token']) {
      token = req.headers['x-user-token'];
    } else if (req.cookies && req.cookies.user_session) {
      token = req.cookies.user_session;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Validate session
    const validation = await UserSessionService.validateSession(token);
    
    if (!validation.valid) {
      const statusCode = validation.error === 'SESSION_EXPIRED' ? 401 : 401;
      return res.status(statusCode).json({
        success: false,
        error: validation.error === 'SESSION_EXPIRED' ? 'Sessão expirada' : 'Sessão inválida',
        code: validation.error
      });
    }
    
    const { session } = validation;
    
    // Get user data
    const user = await UserService.getUserById(session.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Conta desativada',
        code: 'ACCOUNT_INACTIVE'
      });
    }
    
    // Get user inboxes
    const inboxes = await UserService.getUserInboxes(user.id);
    
    // Get primary inbox
    const primaryInbox = await UserService.getPrimaryInbox(user.id);
    
    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          status: user.status,
          permissions: user.permissions,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        },
        inboxes,
        primaryInbox,
        session: {
          id: session.id,
          expiresAt: session.expiresAt
        },
        role: 'user'
      }
    });
  } catch (error) {
    logger.error('Get current user error', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * PUT /api/auth/user/password
 * Change user password
 */
router.put('/user/password', async (req, res) => {
  try {
    // Extract token
    const authHeader = req.headers.authorization;
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers['x-user-token']) {
      token = req.headers['x-user-token'];
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação necessária',
        code: 'AUTH_REQUIRED'
      });
    }
    
    // Validate session
    const validation = await UserSessionService.validateSession(token);
    
    if (!validation.valid) {
      return res.status(401).json({
        success: false,
        error: 'Sessão inválida',
        code: validation.error
      });
    }
    
    const { session } = validation;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Senha atual e nova senha são obrigatórias',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'A nova senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Get user for password verification
    const user = await UserService.getUserForAuth(session.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // Verify current password
    const isValid = await UserService.verifyPassword(currentPassword, user.passwordHash);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Senha atual incorreta',
        code: 'INVALID_PASSWORD'
      });
    }
    
    // Update password and invalidate other sessions
    await UserService.updatePassword(session.userId, newPassword, true, session.id);
    
    logger.info('User password changed', {
      userId: session.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Senha alterada com sucesso'
    });
  } catch (error) {
    logger.error('Change password error', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/auth/user/request-password-reset
 * Request password reset email
 * Note: skipCsrf is used because this is a public endpoint
 */
router.post('/user/request-password-reset', skipCsrf, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email é obrigatório',
        code: 'MISSING_EMAIL'
      });
    }
    
    // Get tenant from context or use default
    const tenantId = req.context?.tenantId || process.env.DEFAULT_TENANT_ID || 'default';
    
    // Try to find user by email
    const user = await UserService.getUserByEmail(email, tenantId);
    
    if (user) {
      // Generate reset token
      const resetToken = await UserService.generatePasswordResetToken(user.id);
      
      // TODO: Send email with reset link
      // For now, just log the token (in production, send email)
      logger.info('Password reset requested', {
        userId: user.id,
        email: user.email,
        resetToken: resetToken, // Remove this in production!
        ip: req.ip
      });
    } else {
      // Log attempt but don't reveal if email exists
      logger.info('Password reset requested for unknown email', {
        email,
        tenantId,
        ip: req.ip
      });
    }
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir sua senha.'
    });
  } catch (error) {
    logger.error('Password reset request error', {
      error: error.message,
      ip: req.ip
    });
    // Still return success to prevent information leakage
    res.json({
      success: true,
      message: 'Se o email existir, você receberá instruções para redefinir sua senha.'
    });
  }
});

/**
 * POST /api/auth/user/reset-password
 * Reset password using token
 * Note: skipCsrf is used because this is a public endpoint
 */
router.post('/user/reset-password', skipCsrf, async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token e nova senha são obrigatórios',
        code: 'MISSING_FIELDS'
      });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'A nova senha deve ter pelo menos 8 caracteres',
        code: 'WEAK_PASSWORD'
      });
    }
    
    // Validate token and reset password
    const result = await UserService.resetPasswordWithToken(token, newPassword);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error === 'INVALID_TOKEN' ? 'Token inválido ou expirado' : 'Erro ao redefinir senha',
        code: result.error
      });
    }
    
    logger.info('Password reset completed', {
      userId: result.userId,
      ip: req.ip
    });
    
    res.json({
      success: true,
      message: 'Senha redefinida com sucesso. Você já pode fazer login.'
    });
  } catch (error) {
    logger.error('Password reset error', {
      error: error.message,
      ip: req.ip
    });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;
