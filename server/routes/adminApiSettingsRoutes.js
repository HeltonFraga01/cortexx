/**
 * Admin API Settings Routes
 * Endpoints for managing WUZAPI configuration settings
 */

const router = require('express').Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const ApiSettingsService = require('../services/ApiSettingsService');
const { validateApiSettingsUpdate } = require('../validators/apiSettingsValidator');

/**
 * GET /api/admin/api-settings
 * Get current API settings with source indicators
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await ApiSettingsService.getApiSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to get API settings', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/admin/api-settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/api-settings
 * Update API settings
 */
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    // Validate input
    const validation = validateApiSettingsUpdate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.errors
      });
    }

    const settings = await ApiSettingsService.updateApiSettings(validation.data);
    
    logger.info('API settings updated by admin', {
      userId: req.user?.id,
      updatedFields: Object.keys(req.body)
    });

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to update API settings', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/admin/api-settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/api-settings/test
 * Test connection to WUZAPI with current settings
 */
router.post('/test', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await ApiSettingsService.testConnection();
    
    logger.info('API connection test performed', {
      userId: req.user?.id,
      success: result.success,
      responseTime: result.responseTime
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to test API connection', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/admin/api-settings/test'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/api-settings/:key
 * Delete a specific setting (reverts to env fallback)
 */
router.delete('/:key', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    
    // Map friendly key names to internal keys
    const keyMap = {
      'baseUrl': ApiSettingsService.constructor.KEYS.WUZAPI_BASE_URL,
      'adminToken': ApiSettingsService.constructor.KEYS.WUZAPI_ADMIN_TOKEN,
      'timeout': ApiSettingsService.constructor.KEYS.WUZAPI_TIMEOUT
    };

    const internalKey = keyMap[key];
    if (!internalKey) {
      return res.status(400).json({ error: 'Chave de configuração inválida' });
    }

    await ApiSettingsService.deleteSetting(internalKey);
    
    logger.info('API setting deleted by admin', {
      userId: req.user?.id,
      key: internalKey
    });

    const settings = await ApiSettingsService.getApiSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error('Failed to delete API setting', {
      error: error.message,
      userId: req.user?.id,
      key: req.params.key,
      endpoint: '/api/admin/api-settings/:key'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
