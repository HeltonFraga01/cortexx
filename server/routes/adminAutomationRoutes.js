/**
 * Admin Automation Routes
 * 
 * Handles all automation-related endpoints for admin users.
 * 
 * Requirements: 1.1-1.5, 2.1-2.5, 4.1-4.5, 5.1-5.5, 6.1-6.5, 8.1-8.5, 9.1-9.5, 13.1-13.5
 */

const express = require('express');
const { logger } = require('../utils/logger');
const { requireAdmin } = require('../middleware/auth');
const AutomationService = require('../services/AutomationService');
const AuditLogService = require('../services/AuditLogService');

const router = express.Router();

// Apply admin authentication to all routes
router.use(requireAdmin);

// Services will be initialized lazily using app.locals.db
let automationService = null;
let auditLogService = null;

// Middleware to ensure services are initialized with the database instance
router.use((req, res, next) => {
  if (!automationService || !auditLogService) {
    const db = req.app.locals.db;
    if (!db) {
      logger.error('Database not initialized in app.locals');
      return res.status(500).json({ success: false, error: 'Database not initialized' });
    }
    automationService = new AutomationService(db);
    auditLogService = new AuditLogService(db);
  }
  next();
});

// ==================== Global Settings ====================

/**
 * GET /api/admin/automation/settings
 * Get all global automation settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings = await automationService.getGlobalSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to get automation settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/automation/settings
 * Update global automation settings
 */
router.put('/settings', async (req, res) => {
  try {
    const settings = await automationService.updateGlobalSettings(req.body);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error('Failed to update automation settings', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Bot Templates ====================

/**
 * GET /api/admin/automation/bot-templates
 * Get all bot templates
 */
router.get('/bot-templates', async (req, res) => {
  try {
    const templates = await automationService.getBotTemplates();
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Failed to get bot templates', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/bot-templates
 * Create a new bot template
 */
router.post('/bot-templates', async (req, res) => {
  try {
    const template = await automationService.createBotTemplate(req.body);
    res.status(201).json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to create bot template', { error: error.message });
    const status = error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/automation/bot-templates/:id
 * Update a bot template
 */
router.put('/bot-templates/:id', async (req, res) => {
  try {
    const template = await automationService.updateBotTemplate(req.params.id, req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to update bot template', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('required') || error.message.includes('Invalid') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/automation/bot-templates/:id
 * Delete a bot template
 */
router.delete('/bot-templates/:id', async (req, res) => {
  try {
    await automationService.deleteBotTemplate(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete bot template', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('Cannot delete') ? 409 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/bot-templates/:id/set-default
 * Set a bot template as default
 */
router.post('/bot-templates/:id/set-default', async (req, res) => {
  try {
    const template = await automationService.setDefaultBotTemplate(req.params.id);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error('Failed to set default bot template', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ==================== Chatwoot Users & Inboxes ====================

const SupabaseService = require('../services/SupabaseService');

/**
 * GET /api/admin/automation/chatwoot-users
 * Get all agents (users) for bot template selection
 */
router.get('/chatwoot-users', async (req, res) => {
  try {
    const { data: agents, error } = await SupabaseService.getMany('agents', { status: 'active' }, {
      orderBy: 'name',
      ascending: true
    });

    if (error) throw error;

    const rows = (agents || []).map(a => ({
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      accountId: a.account_id
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Failed to get chatwoot users', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/automation/chatwoot-inboxes
 * Get all inboxes for bot template selection
 */
router.get('/chatwoot-inboxes', async (req, res) => {
  try {
    const { data: inboxes, error } = await SupabaseService.getMany('inboxes', {}, {
      orderBy: 'name',
      ascending: true
    });

    if (error) throw error;

    const rows = (inboxes || []).map(i => ({
      id: i.id,
      name: i.name,
      channelType: i.channel_type,
      accountId: i.account_id
    }));

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error('Failed to get chatwoot inboxes', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Default Labels ====================

/**
 * GET /api/admin/automation/default-labels
 * Get all default labels
 */
router.get('/default-labels', async (req, res) => {
  try {
    const labels = await automationService.getDefaultLabels();
    res.json({ success: true, data: labels });
  } catch (error) {
    logger.error('Failed to get default labels', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/default-labels
 * Create a new default label
 */
router.post('/default-labels', async (req, res) => {
  try {
    const label = await automationService.createDefaultLabel(req.body);
    res.status(201).json({ success: true, data: label });
  } catch (error) {
    logger.error('Failed to create default label', { error: error.message });
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/automation/default-labels/:id
 * Update a default label
 */
router.put('/default-labels/:id', async (req, res) => {
  try {
    const label = await automationService.updateDefaultLabel(req.params.id, req.body);
    res.json({ success: true, data: label });
  } catch (error) {
    logger.error('Failed to update default label', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/automation/default-labels/:id
 * Delete a default label
 */
router.delete('/default-labels/:id', async (req, res) => {
  try {
    await automationService.deleteDefaultLabel(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete default label', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

// ==================== Default Canned Responses ====================

/**
 * GET /api/admin/automation/default-canned-responses
 * Get all default canned responses
 */
router.get('/default-canned-responses', async (req, res) => {
  try {
    const responses = await automationService.getDefaultCannedResponses();
    res.json({ success: true, data: responses });
  } catch (error) {
    logger.error('Failed to get default canned responses', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/default-canned-responses
 * Create a new default canned response
 */
router.post('/default-canned-responses', async (req, res) => {
  try {
    const response = await automationService.createDefaultCannedResponse(req.body);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    logger.error('Failed to create default canned response', { error: error.message });
    const status = error.message.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/admin/automation/default-canned-responses/:id
 * Update a default canned response
 */
router.put('/default-canned-responses/:id', async (req, res) => {
  try {
    const response = await automationService.updateDefaultCannedResponse(req.params.id, req.body);
    res.json({ success: true, data: response });
  } catch (error) {
    logger.error('Failed to update default canned response', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 
                   error.message.includes('required') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/admin/automation/default-canned-responses/:id
 * Delete a default canned response
 */
router.delete('/default-canned-responses/:id', async (req, res) => {
  try {
    await automationService.deleteDefaultCannedResponse(req.params.id);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete default canned response', { id: req.params.id, error: error.message });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});


// ==================== Audit Log & Statistics ====================

/**
 * GET /api/admin/automation/audit-log
 * Get audit log entries with pagination and filters
 */
router.get('/audit-log', async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId,
      automationType: req.query.automationType,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const pagination = {
      limit: parseInt(req.query.limit, 10) || 20,
      offset: parseInt(req.query.offset, 10) || 0
    };

    const result = await auditLogService.getAuditLog(filters, pagination);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to get audit log', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/automation/statistics
 * Get automation statistics
 */
router.get('/statistics', async (req, res) => {
  try {
    const dateRange = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const statistics = await auditLogService.getStatistics(dateRange);
    res.json({ success: true, data: statistics });
  } catch (error) {
    logger.error('Failed to get statistics', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Bulk Actions ====================

/**
 * POST /api/admin/automation/bulk-apply
 * Apply automations to multiple existing users
 */
router.post('/bulk-apply', async (req, res) => {
  try {
    const { userIds, automationTypes } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, error: 'userIds array is required' });
    }

    const result = await automationService.applyAutomationsToExistingUsers(
      userIds,
      automationTypes || ['bot', 'labels', 'cannedResponses'],
      auditLogService
    );

    const status = result.failureCount > 0 && result.successCount > 0 ? 207 : 
                   result.failureCount > 0 ? 500 : 200;

    res.status(status).json({ success: result.successCount > 0, data: result });
  } catch (error) {
    logger.error('Failed to apply bulk automations', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== Export/Import ====================

/**
 * GET /api/admin/automation/export
 * Export all automation configuration
 */
router.get('/export', async (req, res) => {
  try {
    const config = await automationService.exportConfiguration();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=automation-config-${new Date().toISOString().split('T')[0]}.json`);
    
    res.json(config);
  } catch (error) {
    logger.error('Failed to export configuration', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/validate-import
 * Validate configuration before import
 */
router.post('/validate-import', async (req, res) => {
  try {
    const validation = automationService.validateConfiguration(req.body);
    res.json({ success: true, data: validation });
  } catch (error) {
    logger.error('Failed to validate configuration', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/automation/import
 * Import automation configuration
 */
router.post('/import', async (req, res) => {
  try {
    const result = await automationService.importConfiguration(req.body);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Failed to import configuration', { error: error.message });
    const status = error.message.includes('Invalid configuration') ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

module.exports = router;
