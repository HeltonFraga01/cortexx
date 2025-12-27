/**
 * User Purchase Routes
 * 
 * Handles contact purchase management including history, manual entry,
 * webhook processing, and CSV import.
 * 
 * Requirements: 3.1, 3.6, 9.1, 9.4 (Contact CRM Evolution)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const ContactPurchaseService = require('../services/ContactPurchaseService');
const SupabaseService = require('../services/SupabaseService');

// ==================== VALIDATION SCHEMAS ====================

const createPurchaseSchema = z.object({
  amountCents: z.number().min(0),
  currency: z.string().length(3).default('BRL'),
  productName: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  externalId: z.string().max(255).optional(),
  status: z.enum(['pending', 'completed', 'refunded', 'cancelled']).default('completed'),
  purchasedAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional()
});

const webhookPurchaseSchema = z.object({
  phone: z.string().optional(),
  email: z.string().email().optional(),
  customerName: z.string().optional(),
  externalId: z.string().optional(),
  amountCents: z.number().min(0),
  currency: z.string().length(3).default('BRL'),
  productName: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional()
}).refine(data => data.phone || data.email, {
  message: 'Either phone or email is required'
});

const updateStatusSchema = z.object({
  status: z.enum(['pending', 'completed', 'refunded', 'cancelled'])
});

const purchaseHistoryQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  status: z.enum(['pending', 'completed', 'refunded', 'cancelled']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get account context from request
 */
async function getAccountContext(req) {
  if (req.user?.id) {
    const queryFn = (query) => query
      .select('id, tenant_id')
      .eq('owner_user_id', req.user.id)
      .single();

    const { data: account } = await SupabaseService.queryAsAdmin('accounts', queryFn);
    if (account) {
      return { accountId: account.id, tenantId: account.tenant_id };
    }
  }
  return null;
}

/**
 * Verify contact belongs to account
 */
async function verifyContactOwnership(contactId, accountId) {
  const queryFn = (query) => query
    .select('id')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const { data, error } = await SupabaseService.queryAsAdmin('contacts', queryFn);
  return !error && !!data;
}

// ==================== CONTACT PURCHASE ROUTES ====================

/**
 * GET /api/user/purchases/contacts/:contactId
 * Get purchase history for a contact
 */
router.get('/contacts/:contactId', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const query = purchaseHistoryQuerySchema.parse(req.query);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await ContactPurchaseService.getPurchaseHistory(contactId, {
      page: query.page,
      pageSize: query.pageSize,
      status: query.status,
      startDate: query.startDate,
      endDate: query.endDate
    });

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching purchase history', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/purchases/contacts/:contactId'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/purchases/contacts/:contactId
 * Add a manual purchase for a contact
 */
router.post('/contacts/:contactId', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const validated = createPurchaseSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const purchase = await ContactPurchaseService.createPurchase(contactId, {
      ...validated,
      source: 'manual'
    });

    res.status(201).json({ success: true, data: purchase });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error creating purchase', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/purchases/contacts/:contactId'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/purchases/:purchaseId/status
 * Update purchase status
 */
router.put('/:purchaseId/status', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const purchaseId = req.params.purchaseId;
    const validated = updateStatusSchema.parse(req.body);

    // Verify purchase belongs to account
    const queryFn = (query) => query
      .select('id')
      .eq('id', purchaseId)
      .eq('account_id', context.accountId)
      .single();

    const { data: purchase, error } = await SupabaseService.queryAsAdmin('contact_purchases', queryFn);

    if (error || !purchase) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    const updated = await ContactPurchaseService.updatePurchaseStatus(purchaseId, validated.status);

    res.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INVALID_STATUS') {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    logger.error('Error updating purchase status', {
      error: error.message,
      purchaseId: req.params.purchaseId,
      endpoint: '/api/user/purchases/:purchaseId/status'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEBHOOK ROUTES ====================

/**
 * POST /api/user/purchases/webhook
 * Process purchase from external webhook
 */
router.post('/webhook', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = webhookPurchaseSchema.parse(req.body);

    const result = await ContactPurchaseService.processWebhookPurchase(
      context.accountId,
      context.tenantId,
      validated
    );

    if (result.duplicate) {
      return res.json({ 
        success: true, 
        data: { duplicate: true, purchaseId: result.purchaseId },
        message: 'Purchase already processed'
      });
    }

    res.status(201).json({ 
      success: true, 
      data: {
        purchase: result.purchase,
        contact: result.contact,
        contactCreated: result.contactCreated
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid webhook payload', details: error.errors });
    }
    logger.error('Error processing purchase webhook', {
      error: error.message,
      endpoint: '/api/user/purchases/webhook'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== IMPORT ROUTES ====================

/**
 * POST /api/user/purchases/import
 * Import purchases from CSV data
 */
router.post('/import', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { purchases } = req.body;

    if (!purchases || !Array.isArray(purchases)) {
      return res.status(400).json({ success: false, error: 'purchases array is required' });
    }

    if (purchases.length > 1000) {
      return res.status(400).json({ success: false, error: 'Maximum 1000 purchases per import' });
    }

    const result = await ContactPurchaseService.importPurchases(
      context.accountId,
      context.tenantId,
      purchases
    );

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error importing purchases', {
      error: error.message,
      endpoint: '/api/user/purchases/import'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== STATS ROUTES ====================

/**
 * GET /api/user/purchases/stats
 * Get purchase statistics for account
 */
router.get('/stats', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const options = {
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };

    const stats = await ContactPurchaseService.getPurchaseStats(context.accountId, options);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching purchase stats', {
      error: error.message,
      endpoint: '/api/user/purchases/stats'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/purchases/top-customers
 * Get top customers by LTV
 */
router.get('/top-customers', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const limit = parseInt(req.query.limit) || 10;
    const customers = await ContactPurchaseService.getTopCustomers(context.accountId, limit);

    res.json({ success: true, data: customers });
  } catch (error) {
    logger.error('Error fetching top customers', {
      error: error.message,
      endpoint: '/api/user/purchases/top-customers'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
