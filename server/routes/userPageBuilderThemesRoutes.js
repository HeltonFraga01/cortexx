/**
 * User Page Builder Themes Routes
 * 
 * Read-only endpoints for page builder themes.
 * Users can view themes from their account.
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getPageBuilderThemeService } = require('../services/PageBuilderThemeService');
const { logger } = require('../utils/logger');
const { featureMiddleware } = require('../middleware/featureEnforcement');

// Apply user authentication and page builder feature check to all routes
router.use(requireAuth);
router.use(featureMiddleware.pageBuilder);

// Get service instance
const pageBuilderThemeService = getPageBuilderThemeService();

/**
 * GET /user/page-builder-themes
 * List page builder themes for the user's account
 */
router.get('/', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { connection_id, limit, offset } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      });
    }

    // Users can only see active themes
    const themes = await pageBuilderThemeService.list({
      accountId,
      connectionId: connection_id || undefined,
      isActive: true,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await pageBuilderThemeService.count({
      accountId,
      connectionId: connection_id || undefined,
      isActive: true,
    });

    res.json({
      success: true,
      data: {
        themes,
        total,
      },
    });
  } catch (error) {
    logger.error('Failed to list page builder themes', {
      error: error.message,
      userId: req.session?.userId || req.user?.id,
      endpoint: '/user/page-builder-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /user/page-builder-themes/:id
 * Get a single page builder theme
 */
router.get('/:id', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { id } = req.params;

    const theme = await pageBuilderThemeService.getById(id, accountId);

    if (!theme || !theme.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Theme not found',
      });
    }

    res.json({
      success: true,
      data: theme,
    });
  } catch (error) {
    logger.error('Failed to get page builder theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId || req.user?.id,
      endpoint: '/user/page-builder-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
