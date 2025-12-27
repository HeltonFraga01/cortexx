/**
 * User Segment Routes
 * 
 * Handles dynamic contact segment management including CRUD operations,
 * segment evaluation, membership, and pre-built templates.
 * 
 * Requirements: 7.1, 7.4, 7.5, 7.6 (Contact CRM Evolution)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const ContactSegmentService = require('../services/ContactSegmentService');
const SupabaseService = require('../services/SupabaseService');

// ==================== VALIDATION SCHEMAS ====================

// Recursive condition schema
const conditionSchema = z.lazy(() => z.union([
  // Simple condition
  z.object({
    field: z.string(),
    operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in', 'not_in']),
    value: z.any()
  }),
  // Nested group
  z.object({
    logic: z.enum(['AND', 'OR']),
    conditions: z.array(conditionSchema).min(1)
  })
]));

const conditionsSchema = z.object({
  logic: z.enum(['AND', 'OR']),
  conditions: z.array(conditionSchema).min(1)
});

const createSegmentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  conditions: conditionsSchema
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional().nullable(),
  conditions: conditionsSchema.optional()
});

const previewSegmentSchema = z.object({
  conditions: conditionsSchema
});

const createFromTemplateSchema = z.object({
  templateKey: z.string()
});

const membersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50)
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
 * Verify segment belongs to account
 */
async function verifySegmentOwnership(segmentId, accountId) {
  const queryFn = (query) => query
    .select('id')
    .eq('id', segmentId)
    .eq('account_id', accountId)
    .single();

  const { data, error } = await SupabaseService.queryAsAdmin('contact_segments', queryFn);
  return !error && !!data;
}

// ==================== SEGMENT ROUTES ====================

/**
 * GET /api/user/segments
 * List all segments
 */
router.get('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segments = await ContactSegmentService.getSegments(context.accountId);

    res.json({ success: true, data: segments });
  } catch (error) {
    logger.error('Error fetching segments', {
      error: error.message,
      endpoint: '/api/user/segments'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/segments
 * Create a new segment
 */
router.post('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createSegmentSchema.parse(req.body);

    const segment = await ContactSegmentService.createSegment(
      context.accountId,
      context.tenantId,
      validated.name,
      validated.conditions,
      validated.description
    );

    res.status(201).json({ success: true, data: segment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INVALID_CONDITIONS') {
      return res.status(400).json({ success: false, error: 'Invalid conditions structure' });
    }
    if (error.message === 'INVALID_LOGIC_OPERATOR') {
      return res.status(400).json({ success: false, error: 'Logic operator must be AND or OR' });
    }
    if (error.message === 'EMPTY_CONDITIONS') {
      return res.status(400).json({ success: false, error: 'Conditions cannot be empty' });
    }
    if (error.message === 'INVALID_CONDITION_STRUCTURE') {
      return res.status(400).json({ success: false, error: 'Each condition must have field and operator' });
    }
    if (error.message === 'INVALID_OPERATOR') {
      return res.status(400).json({ success: false, error: 'Invalid operator' });
    }
    logger.error('Error creating segment', {
      error: error.message,
      endpoint: '/api/user/segments'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/segments/templates
 * Get pre-built segment templates
 */
router.get('/templates', validateSupabaseToken, async (req, res) => {
  try {
    const templates = ContactSegmentService.getPrebuiltTemplates();

    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error('Error fetching segment templates', {
      error: error.message,
      endpoint: '/api/user/segments/templates'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/segments/from-template
 * Create segment from template
 */
router.post('/from-template', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createFromTemplateSchema.parse(req.body);

    const segment = await ContactSegmentService.createFromTemplate(
      context.accountId,
      context.tenantId,
      validated.templateKey
    );

    res.status(201).json({ success: true, data: segment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Template not found' });
    }
    logger.error('Error creating segment from template', {
      error: error.message,
      endpoint: '/api/user/segments/from-template'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/segments/preview
 * Preview segment (evaluate without saving)
 */
router.post('/preview', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = previewSegmentSchema.parse(req.body);

    const result = await ContactSegmentService.previewSegment(
      context.accountId,
      validated.conditions
    );

    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message.includes('INVALID_')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error previewing segment', {
      error: error.message,
      endpoint: '/api/user/segments/preview'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/segments/:id
 * Get segment details
 */
router.get('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segmentId = req.params.id;

    // Verify ownership
    if (!await verifySegmentOwnership(segmentId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    // Get segment
    const queryFn = (query) => query
      .select('*')
      .eq('id', segmentId)
      .single();

    const { data: segment, error } = await SupabaseService.queryAsAdmin('contact_segments', queryFn);

    if (error || !segment) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    res.json({ success: true, data: segment });
  } catch (error) {
    logger.error('Error fetching segment', {
      error: error.message,
      segmentId: req.params.id,
      endpoint: '/api/user/segments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/segments/:id
 * Update a segment
 */
router.put('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segmentId = req.params.id;
    const validated = updateSegmentSchema.parse(req.body);

    // Verify ownership
    if (!await verifySegmentOwnership(segmentId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    const segment = await ContactSegmentService.updateSegment(
      segmentId,
      context.accountId,
      validated
    );

    res.json({ success: true, data: segment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'SEGMENT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    if (error.message.includes('INVALID_')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error updating segment', {
      error: error.message,
      segmentId: req.params.id,
      endpoint: '/api/user/segments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/segments/:id
 * Delete a segment
 */
router.delete('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segmentId = req.params.id;

    // Verify ownership
    if (!await verifySegmentOwnership(segmentId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    await ContactSegmentService.deleteSegment(segmentId, context.accountId);

    res.json({ success: true, message: 'Segment deleted' });
  } catch (error) {
    logger.error('Error deleting segment', {
      error: error.message,
      segmentId: req.params.id,
      endpoint: '/api/user/segments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/segments/:id/members
 * Get segment members
 */
router.get('/:id/members', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segmentId = req.params.id;
    const query = membersQuerySchema.parse(req.query);

    // Verify ownership
    if (!await verifySegmentOwnership(segmentId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    const result = await ContactSegmentService.getSegmentMembers(segmentId, {
      page: query.page,
      pageSize: query.pageSize
    });

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching segment members', {
      error: error.message,
      segmentId: req.params.id,
      endpoint: '/api/user/segments/:id/members'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/segments/:id/evaluate
 * Re-evaluate segment membership
 */
router.post('/:id/evaluate', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const segmentId = req.params.id;

    // Verify ownership
    if (!await verifySegmentOwnership(segmentId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }

    const result = await ContactSegmentService.evaluateSegment(segmentId);

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.message === 'SEGMENT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Segment not found' });
    }
    logger.error('Error evaluating segment', {
      error: error.message,
      segmentId: req.params.id,
      endpoint: '/api/user/segments/:id/evaluate'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
