/**
 * Admin Page Builder Themes Routes
 * 
 * CRUD endpoints for page builder themes.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { getPageBuilderThemeService } = require('../services/PageBuilderThemeService');
const { logger } = require('../utils/logger');
const { featureMiddleware } = require('../middleware/featureEnforcement');

// Log when module is loaded
logger.info('adminPageBuilderThemesRoutes module loaded');

// Apply admin authentication and page builder feature check to all routes
router.use(requireAdmin);

// Debug middleware to log request state after requireAdmin
router.use((req, res, next) => {
  logger.debug('Page builder route - after requireAdmin', {
    path: req.path,
    method: req.method,
    hasUser: !!req.user,
    userRole: req.user?.role,
    sessionRole: req.session?.role,
    userId: req.user?.id || req.session?.userId
  });
  next();
});

router.use(featureMiddleware.pageBuilder);

// Get service instance
const pageBuilderThemeService = getPageBuilderThemeService();

/**
 * GET /admin/page-builder-themes
 * List all page builder themes for the account
 */
router.get('/', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { connection_id, is_active, limit, offset } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      });
    }

    const themes = await pageBuilderThemeService.list({
      accountId,
      connectionId: connection_id || undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await pageBuilderThemeService.count({
      accountId,
      connectionId: connection_id || undefined,
      isActive: is_active !== undefined ? is_active === 'true' : undefined,
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
      userId: req.session?.userId,
      endpoint: '/admin/page-builder-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/page-builder-themes/:id
 * Get a single page builder theme
 */
router.get('/:id', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { id } = req.params;

    const theme = await pageBuilderThemeService.getById(id, accountId);

    if (!theme) {
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
      userId: req.session?.userId,
      endpoint: '/admin/page-builder-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});


/**
 * POST /admin/page-builder-themes
 * Create a new page builder theme
 */
router.post('/', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { 
      name, 
      description,
      connectionId,
      schema,
      previewImage,
      isActive
    } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Account ID is required',
      });
    }

    if (!schema || typeof schema !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Schema is required and must be an object',
      });
    }

    const theme = await pageBuilderThemeService.create({
      accountId,
      name: name.trim(),
      description: description || null,
      connectionId: connectionId || null,
      schema,
      previewImage: previewImage || null,
      isActive: isActive !== false,
    });

    logger.info('Page builder theme created via API', {
      themeId: theme.id,
      name: theme.name,
      userId: req.session?.userId,
      accountId,
    });

    res.status(201).json({
      success: true,
      data: theme,
    });
  } catch (error) {
    logger.error('Failed to create page builder theme', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/admin/page-builder-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /admin/page-builder-themes/:id
 * Update a page builder theme
 */
router.put('/:id', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { id } = req.params;
    const { 
      name, 
      description,
      connectionId,
      schema,
      previewImage,
      isActive
    } = req.body;

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({
        success: false,
        error: 'Name must be a non-empty string',
      });
    }

    const theme = await pageBuilderThemeService.update(id, {
      name: name?.trim(),
      description,
      connectionId,
      schema,
      previewImage,
      isActive,
    }, accountId);

    logger.info('Page builder theme updated via API', {
      themeId: theme.id,
      name: theme.name,
      userId: req.session?.userId,
    });

    res.json({
      success: true,
      data: theme,
    });
  } catch (error) {
    if (error.message === 'Theme not found') {
      return res.status(404).json({
        success: false,
        error: 'Theme not found',
      });
    }

    logger.error('Failed to update page builder theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/admin/page-builder-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/page-builder-themes/:id
 * Delete a page builder theme
 */
router.delete('/:id', async (req, res) => {
  try {
    const accountId = req.session?.accountId || req.user?.accountId;
    const { id } = req.params;

    await pageBuilderThemeService.delete(id, accountId);

    logger.info('Page builder theme deleted via API', {
      themeId: id,
      userId: req.session?.userId,
    });

    res.json({
      success: true,
      message: 'Theme deleted successfully',
    });
  } catch (error) {
    if (error.message === 'Theme not found') {
      return res.status(404).json({
        success: false,
        error: 'Theme not found',
      });
    }

    logger.error('Failed to delete page builder theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/admin/page-builder-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
