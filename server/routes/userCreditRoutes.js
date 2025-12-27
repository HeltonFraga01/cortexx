/**
 * User Credit Routes
 * 
 * Handles contact credit balance management including viewing balance,
 * adding credits, consuming credits, and transaction history.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.7 (Contact CRM Evolution)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const ContactCreditService = require('../services/ContactCreditService');
const SupabaseService = require('../services/SupabaseService');

// ==================== VALIDATION SCHEMAS ====================

const addCreditsSchema = z.object({
  amount: z.number().min(1),
  source: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional()
});

const consumeCreditsSchema = z.object({
  amount: z.number().min(1),
  reason: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  metadata: z.record(z.any()).optional()
});

const adjustCreditsSchema = z.object({
  amount: z.number(), // Can be positive or negative
  reason: z.string().min(1).max(500),
  metadata: z.record(z.any()).optional()
});

const transactionHistoryQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  type: z.enum(['credit', 'debit', 'adjustment', 'expiration']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const bulkAddCreditsSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).max(100),
  amount: z.number().min(1),
  source: z.string().min(1).max(100)
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

// ==================== CONTACT CREDIT ROUTES ====================

/**
 * GET /api/user/credits/contacts/:contactId
 * Get credit balance and last transaction for a contact
 */
router.get('/contacts/:contactId', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await ContactCreditService.getBalance(contactId);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error fetching credit balance', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/credits/contacts/:contactId/history
 * Get credit transaction history for a contact
 */
router.get('/contacts/:contactId/history', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const query = transactionHistoryQuerySchema.parse(req.query);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await ContactCreditService.getTransactionHistory(contactId, {
      page: query.page,
      pageSize: query.pageSize,
      type: query.type,
      startDate: query.startDate,
      endDate: query.endDate
    });

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching transaction history', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId/history'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/credits/contacts/:contactId/add
 * Add credits to a contact
 */
router.post('/contacts/:contactId/add', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const validated = addCreditsSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const createdBy = { id: req.user.id, type: 'account' };
    const result = await ContactCreditService.addCredits(
      contactId,
      validated.amount,
      validated.source,
      { description: validated.description, ...validated.metadata },
      createdBy
    );

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INVALID_AMOUNT') {
      return res.status(400).json({ success: false, error: 'Amount must be positive' });
    }
    logger.error('Error adding credits', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId/add'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/credits/contacts/:contactId/consume
 * Consume credits from a contact
 */
router.post('/contacts/:contactId/consume', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const validated = consumeCreditsSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const createdBy = { id: req.user.id, type: 'account' };
    const result = await ContactCreditService.consumeCredits(
      contactId,
      validated.amount,
      validated.reason,
      { description: validated.description, ...validated.metadata },
      createdBy
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INSUFFICIENT_CREDITS') {
      // Get current balance for error response
      const { balance } = await ContactCreditService.getBalance(req.params.contactId);
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient credits',
        currentBalance: balance,
        requested: req.body.amount
      });
    }
    if (error.message === 'INVALID_AMOUNT') {
      return res.status(400).json({ success: false, error: 'Amount must be positive' });
    }
    logger.error('Error consuming credits', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId/consume'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/credits/contacts/:contactId/adjust
 * Adjust credit balance (positive or negative)
 */
router.post('/contacts/:contactId/adjust', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const validated = adjustCreditsSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const createdBy = { id: req.user.id, type: 'account' };
    const result = await ContactCreditService.adjustCredits(
      contactId,
      validated.amount,
      validated.reason,
      validated.metadata || {},
      createdBy
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'ADJUSTMENT_WOULD_CAUSE_NEGATIVE_BALANCE') {
      return res.status(400).json({ success: false, error: 'Adjustment would cause negative balance' });
    }
    logger.error('Error adjusting credits', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId/adjust'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/credits/contacts/:contactId/check
 * Check if contact has sufficient balance
 */
router.get('/contacts/:contactId/check', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const amount = parseInt(req.query.amount);

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await ContactCreditService.checkSufficientBalance(contactId, amount);

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error checking balance', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/credits/contacts/:contactId/check'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BULK OPERATIONS ====================

/**
 * POST /api/user/credits/bulk/add
 * Add credits to multiple contacts
 */
router.post('/bulk/add', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = bulkAddCreditsSchema.parse(req.body);

    // Verify all contacts belong to account
    const queryFn = (query) => query
      .select('id')
      .eq('account_id', context.accountId)
      .in('id', validated.contactIds);

    const { data: validContacts } = await SupabaseService.queryAsAdmin('contacts', queryFn);
    const validIds = (validContacts || []).map(c => c.id);

    if (validIds.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid contacts found' });
    }

    const createdBy = { id: req.user.id, type: 'account' };
    const result = await ContactCreditService.bulkAddCredits(
      validIds,
      validated.amount,
      validated.source,
      createdBy
    );

    res.json({ 
      success: true, 
      data: {
        ...result,
        invalidContactIds: validated.contactIds.filter(id => !validIds.includes(id))
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error bulk adding credits', {
      error: error.message,
      endpoint: '/api/user/credits/bulk/add'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ACCOUNT-LEVEL ROUTES ====================

/**
 * GET /api/user/credits/summary
 * Get credit summary for account
 */
router.get('/summary', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const summary = await ContactCreditService.getCreditSummary(context.accountId);

    res.json({ success: true, data: summary });
  } catch (error) {
    logger.error('Error fetching credit summary', {
      error: error.message,
      endpoint: '/api/user/credits/summary'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/credits/low-balance
 * Get contacts with low or zero balance
 */
router.get('/low-balance', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const threshold = parseInt(req.query.threshold) || 0;
    const contacts = await ContactCreditService.getContactsWithLowBalance(context.accountId, threshold);

    res.json({ success: true, data: contacts });
  } catch (error) {
    logger.error('Error fetching low balance contacts', {
      error: error.message,
      endpoint: '/api/user/credits/low-balance'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
