/**
 * Admin Settings Routes
 * 
 * Endpoints for managing global system settings.
 * All routes require admin authentication.
 * 
 * Requirements: 11.1, 11.5
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const AdminAuditService = require('../services/AdminAuditService');

const router = express.Router();

// Default settings with descriptions
const DEFAULT_SETTINGS = {
  default_plan: {
    value: 'free',
    description: 'Default plan assigned to new users',
    type: 'string'
  },
  trial_duration_days: {
    value: '14',
    description: 'Number of days for trial period',
    type: 'number'
  },
  grace_period_days: {
    value: '7',
    description: 'Grace period after payment failure before suspension',
    type: 'number'
  },
  password_min_length: {
    value: '8',
    description: 'Minimum password length',
    type: 'number'
  },
  password_require_uppercase: {
    value: 'true',
    description: 'Require uppercase letters in password',
    type: 'boolean'
  },
  password_require_numbers: {
    value: 'true',
    description: 'Require numbers in password',
    type: 'boolean'
  },
  password_require_special: {
    value: 'false',
    description: 'Require special characters in password',
    type: 'boolean'
  },
  rate_limit_api_requests: {
    value: '100',
    description: 'Maximum API requests per minute per user',
    type: 'number'
  },
  rate_limit_messages: {
    value: '60',
    description: 'Maximum messages per minute per user',
    type: 'number'
  },
  session_timeout_minutes: {
    value: '60',
    description: 'Session timeout in minutes',
    type: 'number'
  },
  enable_user_registration: {
    value: 'true',
    description: 'Allow new user registrations',
    type: 'boolean'
  },
  maintenance_mode: {
    value: 'false',
    description: 'Enable maintenance mode (blocks user access)',
    type: 'boolean'
  },
  support_email: {
    value: '',
    description: 'Support email address',
    type: 'string'
  },
  support_phone: {
    value: '',
    description: 'Support phone number',
    type: 'string'
  }
};

let auditService = null;

function getAuditService(req) {
  const db = req.app.locals.db;
  if (!db) return null;
  if (!auditService) auditService = new AdminAuditService(db);
  return auditService;
}

/**
 * GET /api/admin/settings
 * Get all system settings
 */
router.get('/', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // Get all settings from database
    const result = await db.query(`
      SELECT key, value, description, updated_by, updated_at
      FROM system_settings
      ORDER BY key
    `);

    // Merge with defaults
    const settings = {};
    
    // Start with defaults
    for (const [key, config] of Object.entries(DEFAULT_SETTINGS)) {
      settings[key] = {
        key,
        value: config.value,
        description: config.description,
        type: config.type,
        updatedBy: null,
        updatedAt: null,
        isDefault: true
      };
    }

    // Override with database values
    for (const row of result.rows) {
      const defaultConfig = DEFAULT_SETTINGS[row.key] || {};
      settings[row.key] = {
        key: row.key,
        value: row.value,
        description: row.description || defaultConfig.description || '',
        type: defaultConfig.type || 'string',
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
        isDefault: false
      };
    }

    logger.info('Settings retrieved', {
      adminId: req.session.userId,
      settingsCount: Object.keys(settings).length,
      endpoint: '/api/admin/settings'
    });

    res.json({ 
      success: true, 
      data: Object.values(settings)
    });
  } catch (error) {
    logger.error('Failed to get settings', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/settings'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/settings/:key
 * Get a specific setting
 */
router.get('/:key', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { key } = req.params;

    const result = await db.query(`
      SELECT key, value, description, updated_by, updated_at
      FROM system_settings
      WHERE key = ?
    `, [key]);

    if (result.rows.length === 0) {
      // Check if it's a default setting
      if (DEFAULT_SETTINGS[key]) {
        return res.json({
          success: true,
          data: {
            key,
            value: DEFAULT_SETTINGS[key].value,
            description: DEFAULT_SETTINGS[key].description,
            type: DEFAULT_SETTINGS[key].type,
            updatedBy: null,
            updatedAt: null,
            isDefault: true
          }
        });
      }
      return res.status(404).json({ error: 'Setting not found' });
    }

    const row = result.rows[0];
    const defaultConfig = DEFAULT_SETTINGS[key] || {};

    res.json({
      success: true,
      data: {
        key: row.key,
        value: row.value,
        description: row.description || defaultConfig.description || '',
        type: defaultConfig.type || 'string',
        updatedBy: row.updated_by,
        updatedAt: row.updated_at,
        isDefault: false
      }
    });
  } catch (error) {
    logger.error('Failed to get setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/settings/:key
 * Update a setting
 */
router.put('/:key', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const audit = getAuditService(req);
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { key } = req.params;
    const { value, description } = req.body;

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    // Validate value type if it's a known setting
    const defaultConfig = DEFAULT_SETTINGS[key];
    if (defaultConfig) {
      if (defaultConfig.type === 'number' && isNaN(Number(value))) {
        return res.status(400).json({ error: `Value must be a number for setting: ${key}` });
      }
      if (defaultConfig.type === 'boolean' && !['true', 'false'].includes(String(value).toLowerCase())) {
        return res.status(400).json({ error: `Value must be true or false for setting: ${key}` });
      }
    }

    const now = new Date().toISOString();
    const adminId = req.session.userId;

    // Get old value for audit
    const oldResult = await db.query('SELECT value FROM system_settings WHERE key = ?', [key]);
    const oldValue = oldResult.rows[0]?.value || (defaultConfig?.value || null);

    // Upsert setting
    await db.query(`
      INSERT INTO system_settings (key, value, description, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        description = COALESCE(excluded.description, system_settings.description),
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
    `, [key, String(value), description || defaultConfig?.description || '', adminId, now]);

    // Log audit
    if (audit) {
      await audit.logAction(
        adminId,
        AdminAuditService.ACTION_TYPES.SETTING_CHANGED,
        null,
        { key, oldValue, newValue: String(value) },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Setting updated', {
      adminId,
      key,
      oldValue,
      newValue: value,
      endpoint: `/api/admin/settings/${key}`
    });

    res.json({
      success: true,
      data: {
        key,
        value: String(value),
        description: description || defaultConfig?.description || '',
        type: defaultConfig?.type || 'string',
        updatedBy: adminId,
        updatedAt: now,
        isDefault: false
      },
      message: 'Setting updated successfully'
    });
  } catch (error) {
    logger.error('Failed to update setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/settings/:key
 * Reset a setting to default
 */
router.delete('/:key', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    const audit = getAuditService(req);
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { key } = req.params;

    // Check if it's a known setting
    if (!DEFAULT_SETTINGS[key]) {
      return res.status(400).json({ error: 'Cannot reset unknown setting' });
    }

    // Get old value for audit
    const oldResult = await db.query('SELECT value FROM system_settings WHERE key = ?', [key]);
    const oldValue = oldResult.rows[0]?.value;

    if (!oldValue) {
      return res.status(404).json({ error: 'Setting not found or already at default' });
    }

    // Delete the custom setting (reverts to default)
    await db.query('DELETE FROM system_settings WHERE key = ?', [key]);

    // Log audit
    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.SETTING_CHANGED,
        null,
        { key, oldValue, newValue: DEFAULT_SETTINGS[key].value, action: 'reset_to_default' },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Setting reset to default', {
      adminId: req.session.userId,
      key,
      oldValue,
      defaultValue: DEFAULT_SETTINGS[key].value,
      endpoint: `/api/admin/settings/${key}`
    });

    res.json({
      success: true,
      data: {
        key,
        value: DEFAULT_SETTINGS[key].value,
        description: DEFAULT_SETTINGS[key].description,
        type: DEFAULT_SETTINGS[key].type,
        updatedBy: null,
        updatedAt: null,
        isDefault: true
      },
      message: 'Setting reset to default'
    });
  } catch (error) {
    logger.error('Failed to reset setting', {
      error: error.message,
      key: req.params.key,
      adminId: req.session.userId,
      endpoint: `/api/admin/settings/${req.params.key}`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
