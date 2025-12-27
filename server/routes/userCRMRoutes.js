/**
 * User CRM Routes
 * 
 * Handles CRM-specific operations for contacts including lead scoring,
 * timeline, and communication preferences.
 * 
 * Requirements: 8.2, 8.3 (Contact CRM Evolution)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const LeadScoringService = require('../services/LeadScoringService');
const ContactInteractionService = require('../services/ContactInteractionService');
const CommunicationPreferenceService = require('../services/CommunicationPreferenceService');
const SupabaseService = require('../services/SupabaseService');

// ==================== VALIDATION SCHEMAS ====================

const updateLeadScoreSchema = z.object({
  score: z.number().min(0).max(100)
});

const updatePreferencesSchema = z.object({
  bulkMessagingOptIn: z.boolean()
});

const timelineQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  types: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  includeRelated: z.coerce.boolean().default(false)
});

const addNoteSchema = z.object({
  note: z.string().min(1).max(5000)
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

// ==================== CRM DATA ROUTES ====================

/**
 * GET /api/user/crm/contacts/:id
 * Get full CRM data for a contact
 */
router.get('/contacts/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.id;

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Get full contact with CRM fields
    const queryFn = (query) => query
      .select('*')
      .eq('id', contactId)
      .single();

    const { data: contact, error } = await SupabaseService.queryAsAdmin('contacts', queryFn);

    if (error || !contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    // Get interaction stats
    const interactionStats = await ContactInteractionService.getInteractionStats(contactId);

    // Format response
    const crmData = {
      id: contact.id,
      phone: contact.phone,
      name: contact.name,
      avatarUrl: contact.avatar_url,
      // CRM fields
      leadScore: contact.lead_score,
      leadTier: contact.lead_tier,
      lifetimeValueCents: contact.lifetime_value_cents,
      purchaseCount: contact.purchase_count,
      creditBalance: contact.credit_balance,
      lastInteractionAt: contact.last_interaction_at,
      lastPurchaseAt: contact.last_purchase_at,
      isActive: contact.is_active,
      bulkMessagingOptIn: contact.bulk_messaging_opt_in,
      optOutAt: contact.opt_out_at,
      optOutMethod: contact.opt_out_method,
      customFields: contact.custom_fields,
      // Stats
      interactionStats,
      // Metadata
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    };

    res.json({ success: true, data: crmData });
  } catch (error) {
    logger.error('Error fetching CRM data', {
      error: error.message,
      contactId: req.params.id,
      endpoint: '/api/user/crm/contacts/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/crm/contacts/:id/lead-score
 * Manually update lead score
 */
router.put('/contacts/:id/lead-score', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.id;
    const validated = updateLeadScoreSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await LeadScoringService.setScore(contactId, validated.score);

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INVALID_SCORE') {
      return res.status(400).json({ success: false, error: 'Score must be between 0 and 100' });
    }
    logger.error('Error updating lead score', {
      error: error.message,
      contactId: req.params.id,
      endpoint: '/api/user/crm/contacts/:id/lead-score'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/contacts/:id/timeline
 * Get activity timeline for a contact
 */
router.get('/contacts/:id/timeline', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.id;
    const query = timelineQuerySchema.parse(req.query);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const options = {
      page: query.page,
      pageSize: query.pageSize,
      types: query.types ? query.types.split(',') : null,
      startDate: query.startDate,
      endDate: query.endDate,
      includeRelated: query.includeRelated
    };

    const result = await ContactInteractionService.getTimeline(contactId, options);

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching timeline', {
      error: error.message,
      contactId: req.params.id,
      endpoint: '/api/user/crm/contacts/:id/timeline'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/crm/contacts/:id/notes
 * Add a note to contact timeline
 */
router.post('/contacts/:id/notes', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.id;
    const validated = addNoteSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const createdBy = { id: req.user.id, type: 'account' };
    const interaction = await ContactInteractionService.addNote(contactId, validated.note, createdBy);

    res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error adding note', {
      error: error.message,
      contactId: req.params.id,
      endpoint: '/api/user/crm/contacts/:id/notes'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/crm/contacts/:id/preferences
 * Update communication preferences
 */
router.put('/contacts/:id/preferences', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.id;
    const validated = updatePreferencesSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const result = await CommunicationPreferenceService.setOptIn(
      contactId,
      validated.bulkMessagingOptIn,
      'manual'
    );

    res.json({ success: true, data: { bulkMessagingOptIn: validated.bulkMessagingOptIn } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error updating preferences', {
      error: error.message,
      contactId: req.params.id,
      endpoint: '/api/user/crm/contacts/:id/preferences'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ACCOUNT-LEVEL CRM ROUTES ====================

/**
 * GET /api/user/crm/lead-scoring/config
 * Get lead scoring configuration
 */
router.get('/lead-scoring/config', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const config = await LeadScoringService.getConfig(context.accountId);

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error fetching lead scoring config', {
      error: error.message,
      endpoint: '/api/user/crm/lead-scoring/config'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/crm/lead-scoring/config
 * Update lead scoring configuration
 */
router.put('/lead-scoring/config', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const config = await LeadScoringService.saveConfig(
      context.accountId,
      context.tenantId,
      req.body
    );

    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Error updating lead scoring config', {
      error: error.message,
      endpoint: '/api/user/crm/lead-scoring/config'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/lead-scoring/distribution
 * Get lead score distribution
 */
router.get('/lead-scoring/distribution', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const distribution = await LeadScoringService.getScoreDistribution(context.accountId);

    res.json({ success: true, data: distribution });
  } catch (error) {
    logger.error('Error fetching score distribution', {
      error: error.message,
      endpoint: '/api/user/crm/lead-scoring/distribution'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/contacts/by-tier/:tier
 * Get contacts by lead tier
 */
router.get('/contacts/by-tier/:tier', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const tier = req.params.tier;
    const validTiers = ['cold', 'warm', 'hot', 'vip'];
    
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ success: false, error: 'Invalid tier' });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 50
    };

    const result = await LeadScoringService.getContactsByTier(context.accountId, tier, options);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error fetching contacts by tier', {
      error: error.message,
      tier: req.params.tier,
      endpoint: '/api/user/crm/contacts/by-tier/:tier'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/preferences/stats
 * Get opt-in/opt-out statistics
 */
router.get('/preferences/stats', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const stats = await CommunicationPreferenceService.getOptInStats(context.accountId);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching preference stats', {
      error: error.message,
      endpoint: '/api/user/crm/preferences/stats'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/preferences/opted-out
 * Get opted-out contacts
 */
router.get('/preferences/opted-out', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 50
    };

    const result = await CommunicationPreferenceService.getOptedOutContacts(context.accountId, options);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error fetching opted-out contacts', {
      error: error.message,
      endpoint: '/api/user/crm/preferences/opted-out'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/interactions/recent
 * Get recent interactions across all contacts
 */
router.get('/interactions/recent', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const interactions = await ContactInteractionService.getRecentInteractions(context.accountId, limit);

    res.json({ success: true, data: interactions });
  } catch (error) {
    logger.error('Error fetching recent interactions', {
      error: error.message,
      endpoint: '/api/user/crm/interactions/recent'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/crm/contacts/inactive
 * Get inactive contacts
 */
router.get('/contacts/inactive', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 50
    };

    const result = await ContactInteractionService.getInactiveContacts(context.accountId, options);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error fetching inactive contacts', {
      error: error.message,
      endpoint: '/api/user/crm/contacts/inactive'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
