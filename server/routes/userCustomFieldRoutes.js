/**
 * User Custom Field Routes
 * 
 * Handles custom field definition management including CRUD operations,
 * field value management, and search by custom fields.
 * 
 * Requirements: 6.1, 6.2 (Contact CRM Evolution)
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const CustomFieldService = require('../services/CustomFieldService');
const SupabaseService = require('../services/SupabaseService');

// ==================== VALIDATION SCHEMAS ====================

const createFieldSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]*$/, 'Name must start with lowercase letter and contain only lowercase letters, numbers, and underscores'),
  label: z.string().min(1).max(200),
  fieldType: z.enum(['text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email', 'phone']),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().default(false),
  isSearchable: z.boolean().default(true),
  displayOrder: z.number().optional(),
  defaultValue: z.string().optional(),
  validationRules: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional()
  }).optional()
});

const updateFieldSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  options: z.array(z.string()).optional(),
  isRequired: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  displayOrder: z.number().optional(),
  defaultValue: z.string().optional().nullable(),
  validationRules: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional()
  }).optional().nullable()
});

const setFieldValueSchema = z.object({
  value: z.any()
});

const setMultipleFieldsSchema = z.object({
  fields: z.record(z.any())
});

const reorderFieldsSchema = z.object({
  order: z.array(z.object({
    id: z.string().uuid(),
    displayOrder: z.number()
  }))
});

const searchByFieldSchema = z.object({
  fieldName: z.string(),
  value: z.any(),
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

// ==================== FIELD DEFINITION ROUTES ====================

/**
 * GET /api/user/custom-fields
 * List all custom field definitions
 */
router.get('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const fields = await CustomFieldService.getFieldDefinitions(context.accountId);

    res.json({ success: true, data: fields });
  } catch (error) {
    logger.error('Error fetching custom fields', {
      error: error.message,
      endpoint: '/api/user/custom-fields'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/custom-fields
 * Create a new custom field definition
 */
router.post('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createFieldSchema.parse(req.body);

    // Validate dropdown has options
    if (validated.fieldType === 'dropdown' && (!validated.options || validated.options.length === 0)) {
      return res.status(400).json({ success: false, error: 'Dropdown fields require options' });
    }

    const field = await CustomFieldService.createFieldDefinition(
      context.accountId,
      context.tenantId,
      validated
    );

    res.status(201).json({ success: true, data: field });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'INVALID_FIELD_TYPE') {
      return res.status(400).json({ success: false, error: 'Invalid field type' });
    }
    if (error.message === 'INVALID_FIELD_NAME') {
      return res.status(400).json({ success: false, error: 'Invalid field name format' });
    }
    if (error.message === 'FIELD_NAME_EXISTS') {
      return res.status(409).json({ success: false, error: 'Field with this name already exists' });
    }
    logger.error('Error creating custom field', {
      error: error.message,
      endpoint: '/api/user/custom-fields'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/custom-fields/:id
 * Update a custom field definition
 */
router.put('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const fieldId = req.params.id;
    const validated = updateFieldSchema.parse(req.body);

    const field = await CustomFieldService.updateFieldDefinition(
      fieldId,
      context.accountId,
      validated
    );

    res.json({ success: true, data: field });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'FIELD_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Field not found' });
    }
    logger.error('Error updating custom field', {
      error: error.message,
      fieldId: req.params.id,
      endpoint: '/api/user/custom-fields/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/custom-fields/:id
 * Delete a custom field definition
 */
router.delete('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const fieldId = req.params.id;

    await CustomFieldService.deleteFieldDefinition(fieldId, context.accountId);

    res.json({ success: true, message: 'Field deleted' });
  } catch (error) {
    logger.error('Error deleting custom field', {
      error: error.message,
      fieldId: req.params.id,
      endpoint: '/api/user/custom-fields/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/custom-fields/reorder
 * Reorder custom field definitions
 */
router.put('/reorder', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = reorderFieldsSchema.parse(req.body);

    await CustomFieldService.reorderFields(context.accountId, validated.order);

    res.json({ success: true, message: 'Fields reordered' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error reordering custom fields', {
      error: error.message,
      endpoint: '/api/user/custom-fields/reorder'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== CONTACT FIELD VALUE ROUTES ====================

/**
 * PUT /api/user/custom-fields/contacts/:contactId/:fieldName
 * Set a custom field value for a contact
 */
router.put('/contacts/:contactId/:fieldName', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { contactId, fieldName } = req.params;
    const validated = setFieldValueSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const customFields = await CustomFieldService.setContactCustomField(
      contactId,
      fieldName,
      validated.value
    );

    res.json({ success: true, data: { customFields } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'FIELD_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Field not found' });
    }
    // Validation errors from CustomFieldService
    if (error.message.includes('must be') || error.message.includes('is required')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error setting custom field value', {
      error: error.message,
      contactId: req.params.contactId,
      fieldName: req.params.fieldName,
      endpoint: '/api/user/custom-fields/contacts/:contactId/:fieldName'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/custom-fields/contacts/:contactId
 * Set multiple custom field values for a contact
 */
router.put('/contacts/:contactId', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contactId = req.params.contactId;
    const validated = setMultipleFieldsSchema.parse(req.body);

    // Verify ownership
    if (!await verifyContactOwnership(contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const customFields = await CustomFieldService.setContactCustomFields(
      contactId,
      validated.fields
    );

    res.json({ success: true, data: { customFields } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    // Validation errors from CustomFieldService
    if (error.message.includes('must be') || error.message.includes('is required') || error.message.includes('Unknown field')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error('Error setting custom fields', {
      error: error.message,
      contactId: req.params.contactId,
      endpoint: '/api/user/custom-fields/contacts/:contactId'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SEARCH ROUTES ====================

/**
 * GET /api/user/custom-fields/search
 * Search contacts by custom field value
 */
router.get('/search', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { fieldName, value, page, pageSize } = searchByFieldSchema.parse(req.query);

    const result = await CustomFieldService.searchByCustomField(
      context.accountId,
      fieldName,
      value,
      { page, pageSize }
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error searching by custom field', {
      error: error.message,
      endpoint: '/api/user/custom-fields/search'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
