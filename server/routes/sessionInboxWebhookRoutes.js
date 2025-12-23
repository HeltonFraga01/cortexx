/**
 * Session Inbox Webhook Routes
 * 
 * Endpoints for managing webhook configuration per inbox.
 * Uses tenant's WUZAPI credentials for API calls.
 * 
 * Requirements: 5.1, 5.5, 9.1, 9.2 (Tenant Webhook Configuration)
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const InboxWebhookService = require('../services/InboxWebhookService');
const TenantSettingsService = require('../services/TenantSettingsService');
const { z } = require('zod');

// Validation schemas
const configureWebhookSchema = z.object({
  events: z.array(z.string()).optional(),
  customWebhookUrl: z.string().url().optional()
});

/**
 * Middleware to get tenant context from inbox
 */
const withTenantContext = async (req, res, next) => {
  try {
    // First validate Supabase token
    await new Promise((resolve, reject) => {
      validateSupabaseToken(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Then load inbox context
    await new Promise((resolve, reject) => {
      inboxContextMiddleware({ required: true, useCache: true })(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Ensure we have tenant context
    if (!req.context?.tenantId) {
      return res.status(403).json({
        error: 'Contexto de tenant não encontrado',
        code: 'TENANT_CONTEXT_REQUIRED'
      });
    }

    next();
  } catch (error) {
    logger.error('Failed to establish tenant context', {
      error: error.message,
      path: req.path
    });
    return res.status(401).json({
      error: 'Autenticação necessária',
      code: 'AUTH_REQUIRED'
    });
  }
};

/**
 * GET /api/session/inboxes/:id/webhook
 * Get webhook status for an inbox
 * Requirements: 5.1
 */
router.get('/:id/webhook', withTenantContext, async (req, res) => {
  try {
    const { id: inboxId } = req.params;
    const tenantId = req.context.tenantId;

    const status = await InboxWebhookService.getWebhookStatus(tenantId, inboxId);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Failed to get inbox webhook status', {
      error: error.message,
      inboxId: req.params.id,
      tenantId: req.context?.tenantId,
      endpoint: '/api/session/inboxes/:id/webhook'
    });

    if (error.message.includes('not found') || error.message.includes('not belong')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/session/inboxes/:id/webhook/configure
 * Configure webhook for an inbox
 * Requirements: 5.5
 */
router.post('/:id/webhook/configure', withTenantContext, async (req, res) => {
  try {
    const { id: inboxId } = req.params;
    const tenantId = req.context.tenantId;

    // Validate input
    const validation = configureWebhookSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: validation.error.errors
      });
    }

    const { events, customWebhookUrl } = validation.data;

    // Check if tenant has WUZAPI configured
    const hasConfig = await TenantSettingsService.hasWuzapiConfig(tenantId);
    if (!hasConfig) {
      return res.status(400).json({
        error: 'WUZAPI não configurado para este tenant. Configure as configurações de API primeiro.',
        code: 'WUZAPI_NOT_CONFIGURED'
      });
    }

    const result = await InboxWebhookService.configureWebhook(
      tenantId,
      inboxId,
      events,
      customWebhookUrl
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Inbox webhook configured', {
      tenantId,
      inboxId,
      webhookUrl: result.webhookUrl,
      eventsCount: result.events?.length
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Failed to configure inbox webhook', {
      error: error.message,
      inboxId: req.params.id,
      tenantId: req.context?.tenantId,
      endpoint: '/api/session/inboxes/:id/webhook/configure'
    });

    if (error.message.includes('not found') || error.message.includes('not belong')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/session/inboxes/:id/webhook
 * Clear webhook configuration for an inbox
 */
router.delete('/:id/webhook', withTenantContext, async (req, res) => {
  try {
    const { id: inboxId } = req.params;
    const tenantId = req.context.tenantId;

    const result = await InboxWebhookService.clearWebhook(tenantId, inboxId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    logger.info('Inbox webhook cleared', {
      tenantId,
      inboxId
    });

    res.json({
      success: true,
      message: 'Configuração de webhook removida'
    });
  } catch (error) {
    logger.error('Failed to clear inbox webhook', {
      error: error.message,
      inboxId: req.params.id,
      tenantId: req.context?.tenantId,
      endpoint: '/api/session/inboxes/:id/webhook'
    });

    if (error.message.includes('not found') || error.message.includes('not belong')) {
      return res.status(404).json({ error: error.message });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/session/inboxes/webhook-status
 * List all inboxes with their webhook status for current tenant
 */
router.get('/webhook-status', withTenantContext, async (req, res) => {
  try {
    const tenantId = req.context.tenantId;

    const inboxes = await InboxWebhookService.listInboxesWithWebhookStatus(tenantId);

    res.json({
      success: true,
      data: inboxes
    });
  } catch (error) {
    logger.error('Failed to list inboxes webhook status', {
      error: error.message,
      tenantId: req.context?.tenantId,
      endpoint: '/api/session/inboxes/webhook-status'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/session/inboxes/:id/webhook/url
 * Generate webhook URL for an inbox (without configuring)
 */
router.get('/:id/webhook/url', withTenantContext, async (req, res) => {
  try {
    const { id: inboxId } = req.params;
    const tenantId = req.context.tenantId;

    const webhookUrl = await InboxWebhookService.generateWebhookUrl(tenantId, inboxId);

    if (!webhookUrl) {
      return res.status(400).json({
        error: 'Não foi possível gerar URL de webhook. Configure a URL base de webhook.',
        code: 'WEBHOOK_URL_NOT_CONFIGURED'
      });
    }

    res.json({
      success: true,
      data: {
        webhookUrl,
        inboxId,
        tenantId
      }
    });
  } catch (error) {
    logger.error('Failed to generate webhook URL', {
      error: error.message,
      inboxId: req.params.id,
      tenantId: req.context?.tenantId,
      endpoint: '/api/session/inboxes/:id/webhook/url'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
