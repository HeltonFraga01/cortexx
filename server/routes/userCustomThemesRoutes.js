/**
 * User Custom Themes Routes
 * 
 * Read-only endpoints for custom page builder themes.
 * Users can view themes but not create/update/delete.
 */

const express = require('express');
const router = express.Router();
const { requireUser } = require('../middleware/auth');
const { getCustomThemeService } = require('../services/CustomThemeService');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

// Apply user authentication to all routes
router.use(requireUser);

/**
 * GET /user/custom-themes
 * List all custom themes (read-only for users)
 */
router.get('/', async (req, res) => {
  try {
    const service = getCustomThemeService(SupabaseService);
    
    const { connection_id, limit, offset } = req.query;

    const themes = await service.list({
      connectionId: connection_id ? parseInt(connection_id, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await service.count({
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
    logger.error('Failed to list custom themes for user', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/user/custom-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /user/custom-themes/:id
 * Get a single custom theme (read-only for users)
 */
router.get('/:id', async (req, res) => {
  try {
    const service = getCustomThemeService(SupabaseService);
    
    const { id } = req.params;
    const theme = await service.getById(parseInt(id, 10));

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
    logger.error('Failed to get custom theme for user', {
      error: error.message,
      themeId: req.params.id,
      userId: req.session?.userId,
      endpoint: '/user/custom-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
