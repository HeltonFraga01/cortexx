/**
 * Superadmin Authentication Routes
 * 
 * Handles superadmin login, logout, and session management.
 * Requirements: 1.1, 1.3
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin, auditSuperadminAction } = require('../middleware/superadminAuth');
const { skipCsrf } = require('../middleware/csrf');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * POST /api/superadmin/login
 * Authenticate superadmin with email and password
 * Requirements: 1.1 - Superadmin authentication
 * Note: skipCsrf is used because this is a public login endpoint
 */
router.post('/login', skipCsrf, async (req, res) => {
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
          lastLoginAt: superadmin.last_login_at
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

module.exports = router;