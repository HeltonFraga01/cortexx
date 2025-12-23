/**
 * Admin Custom Themes Routes
 * 
 * CRUD endpoints for custom page builder themes.
 * All routes require admin authentication.
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { getCustomThemeService } = require('../services/CustomThemeService');
const { logger } = require('../utils/logger');
const { featureMiddleware } = require('../middleware/featureEnforcement');

// Apply admin authentication and page builder feature check to all routes
router.use(requireAdmin);
router.use(featureMiddleware.pageBuilder);

// Get service instance (uses SupabaseService internally)
const customThemeService = getCustomThemeService();

/**
 * GET /admin/custom-themes
 * List all custom themes
 */
router.get('/', async (req, res) => {
  try {
    const { connection_id, limit, offset } = req.query;

    const themes = await customThemeService.list({
      connectionId: connection_id ? parseInt(connection_id, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await customThemeService.count({
      connectionId: connection_id ? parseInt(connection_id, 10) : undefined,
    });

    res.json({
      success: true,
      data: {
        themes,
        total,
      },
    });
  } catch (error) {
    logger.error('Failed to list custom themes', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/admin/custom-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /admin/custom-themes/:id
 * Get a single custom theme
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const theme = await customThemeService.getById(parseInt(id, 10));

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
    logger.error('Failed to get custom theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/admin/custom-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /admin/custom-themes
 * Create a new custom theme
 */
router.post('/', async (req, res) => {
  try {
    const { name, description, connectionId, schema, previewImage } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      });
    }

    if (!schema || !Array.isArray(schema.blocks)) {
      return res.status(400).json({
        success: false,
        error: 'Valid schema with blocks array is required',
      });
    }

    const theme = await customThemeService.create({
      name: name.trim(),
      description: description?.trim() || null,
      connectionId: connectionId || null,
      schema,
      previewImage: previewImage || null,
    });

    logger.info('Custom theme created via API', {
      themeId: theme.id,
      name: theme.name,
      userId: req.session?.userId,
    });

    res.status(201).json({
      success: true,
      data: theme,
    });
  } catch (error) {
    logger.error('Failed to create custom theme', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/admin/custom-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /admin/custom-themes/:id
 * Update a custom theme
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, connectionId, schema, previewImage } = req.body;

    // Validate name if provided
    if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
      return res.status(400).json({
        success: false,
        error: 'Name must be a non-empty string',
      });
    }

    // Validate schema if provided
    if (schema !== undefined && (!schema || !Array.isArray(schema.blocks))) {
      return res.status(400).json({
        success: false,
        error: 'Schema must have a blocks array',
      });
    }

    const theme = await customThemeService.update(parseInt(id, 10), {
      name: name?.trim(),
      description: description !== undefined ? description?.trim() : undefined,
      connectionId,
      schema,
      previewImage,
    });

    logger.info('Custom theme updated via API', {
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

    logger.error('Failed to update custom theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/admin/custom-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /admin/custom-themes/:id
 * Delete a custom theme
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await customThemeService.delete(parseInt(id, 10));

    logger.info('Custom theme deleted via API', {
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

    logger.error('Failed to delete custom theme', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/admin/custom-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
