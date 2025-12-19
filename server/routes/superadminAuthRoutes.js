/**
 * Superadmin Authentication Routes
 * 
 * Handles superadmin login, logout, and session management.
 * Requirements: 1.1, 1.3, 4.4
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');
const { skipCsrf } = require('../middleware/csrf');
const { superadminLoginLimiter } = require('../middleware/rateLimiter');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * POST /api/superadmin/login
 * Authenticate superadmin with email and password
 * Requirements: 1.1 - Superadmin authentication
 * Requirements: 4.4 - Rate limiting (5 attempts per 15 minutes)
 * Note: skipCsrf is used because this is a public login endpoint
 */
router.post('/login', skipCsrf, superadminLoginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Authenticate superadmin
    const authResult = await superadminService.authenticate(email, password);

    // Create session
    req.session.userId = authResult.superadmin.id;
    req.session.role = 'superadmin';
    req.session.sessionToken = authResult.sessionToken;
    req.session.superadminData = authResult.superadmin;

    logger.info('Superadmin login successful', {
      superadminId: authResult.superadmin.id,
      email: authResult.superadmin.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      data: {
        superadmin: authResult.superadmin,
        sessionToken: authResult.sessionToken,
        role: authResult.role
      }
    });
  } catch (error) {
    logger.error('Superadmin login failed', {
      error: error.message,
      email: req.body?.email,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/logout
 * Destroy superadmin session
 * Requirements: 1.3 - Session management
 */
router.post('/logout', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const superadminId = req.session.userId;
    const sessionToken = req.session.sessionToken;

    // Invalidate session token if needed
    if (sessionToken) {
      // Note: SuperadminService.invalidateSession could be enhanced to handle specific tokens
      await superadminService.invalidateSessions(superadminId);
    }

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Failed to destroy superadmin session', {
          error: err.message,
          superadminId
        });
        return res.status(500).json({
          success: false,
          error: 'Failed to logout'
        });
      }

      logger.info('Superadmin logout successful', {
        superadminId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  } catch (error) {
    logger.error('Superadmin logout error', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/me
 * Get current superadmin information
 * Requirements: 1.3 - Session management
 */
router.get('/me', requireSuperadmin, async (req, res) => {
  try {
    const superadminId = req.session.userId;

    // Get fresh superadmin data
    const superadmin = await superadminService.getById(superadminId);

    if (!superadmin) {
      logger.warn('Superadmin not found for valid session', { superadminId });
      
      // Clear invalid session
      req.session.destroy();
      
      return res.status(401).json({
        success: false,
        error: 'Session invalid'
      });
    }

    res.json({
      success: true,
      data: {
        superadmin: {
          id: superadmin.id,
          email: superadmin.email,
          name: superadmin.name,
          status: superadmin.status,
          lastLoginAt: superadmin.last_login_at,
          requiresPasswordChange: superadmin.requires_password_change || false
        },
        role: 'superadmin'
      }
    });
  } catch (error) {
    logger.error('Failed to get superadmin info', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/change-password
 * Change superadmin password
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */
router.post('/change-password', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const superadminId = req.session.userId;
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    // Change password
    await superadminService.changePassword(superadminId, currentPassword, newPassword);

    logger.info('Superadmin password changed', {
      superadminId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    logger.error('Failed to change superadmin password', {
      error: error.message,
      superadminId: req.session?.userId,
      ip: req.ip
    });

    // Return appropriate status code based on error type
    const statusCode = error.message === 'Current password is incorrect' ? 400 : 
                       error.message.includes('requirements') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message,
      details: error.details || undefined
    });
  }
});

/**
 * GET /api/superadmin/accounts
 * List all superadmin accounts
 * Requirements: 5.1, 5.4
 */
router.get('/accounts', requireSuperadmin, async (req, res) => {
  try {
    const superadmins = await superadminService.listSuperadmins();

    res.json({
      success: true,
      data: superadmins
    });
  } catch (error) {
    logger.error('Failed to list superadmin accounts', {
      error: error.message,
      requesterId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/superadmin/accounts
 * Create a new superadmin account
 * Requirements: 5.2, 5.3
 */
router.post('/accounts', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const createdBy = req.session.userId;
    const { email, name, password } = req.body;

    // Validate input
    if (!email || !name || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email, name, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Create superadmin
    const superadmin = await superadminService.createSuperadmin({ email, name, password }, createdBy);

    logger.info('Superadmin account created', {
      newSuperadminId: superadmin.id,
      email: superadmin.email,
      createdBy,
      ip: req.ip
    });

    res.status(201).json({
      success: true,
      data: superadmin
    });
  } catch (error) {
    logger.error('Failed to create superadmin account', {
      error: error.message,
      email: req.body?.email,
      createdBy: req.session?.userId,
      ip: req.ip
    });

    const statusCode = error.message === 'Email already exists' ? 409 :
                       error.message.includes('requirements') ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message,
      details: error.details || undefined
    });
  }
});

/**
 * DELETE /api/superadmin/accounts/:id
 * Delete a superadmin account
 * Requirements: 5.5
 */
router.delete('/accounts/:id', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const requesterId = req.session.userId;
    const targetId = req.params.id;

    // Delete superadmin
    await superadminService.deleteSuperadmin(targetId, requesterId);

    logger.info('Superadmin account deleted', {
      targetId,
      deletedBy: requesterId,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Superadmin account deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete superadmin account', {
      error: error.message,
      targetId: req.params?.id,
      requesterId: req.session?.userId,
      ip: req.ip
    });

    const statusCode = error.message === 'Cannot delete your own account' ? 400 :
                       error.message === 'Superadmin not found' ? 404 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PATCH /api/superadmin/accounts/:id/status
 * Update superadmin account status
 * Requirements: 5.5
 */
router.patch('/accounts/:id/status', requireSuperadmin, auditSuperadminAction, async (req, res) => {
  try {
    const updatedBy = req.session.userId;
    const targetId = req.params.id;
    const { status } = req.body;

    // Validate status
    if (!status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Status must be "active" or "inactive"'
      });
    }

    // Update status
    const superadmin = await superadminService.updateSuperadminStatus(targetId, status, updatedBy);

    logger.info('Superadmin account status updated', {
      targetId,
      newStatus: status,
      updatedBy,
      ip: req.ip
    });

    res.json({
      success: true,
      data: superadmin
    });
  } catch (error) {
    logger.error('Failed to update superadmin status', {
      error: error.message,
      targetId: req.params?.id,
      status: req.body?.status,
      updatedBy: req.session?.userId,
      ip: req.ip
    });

    const statusCode = error.message === 'Cannot deactivate your own account' ? 400 : 500;

    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;