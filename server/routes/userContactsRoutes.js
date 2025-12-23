/**
 * User Contacts Routes
 * 
 * Handles contact management for users including CRUD, tags, groups,
 * import from WhatsApp, and migration from localStorage.
 * 
 * UPDATED: Now uses inboxContextMiddleware to get wuzapiToken from the active inbox
 * instead of the accounts table. This ensures the correct token is used when
 * users have multiple inboxes.
 * 
 * Requirements: 1.1-1.5, 3.1-3.4, 4.1-4.4, 5.4, 6.1-6.4, 9.1-9.4, 11.2-11.5, 8.2 (InboxContext)
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { logger } = require('../utils/logger');
const ContactsService = require('../services/ContactsService');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { inboxContextMiddleware } = require('../middleware/inboxContextMiddleware');
const { 
  requireContactsRead, 
  requireContactsWrite, 
  requireContactsDelete,
  getContactsActor,
  getAccountIdFromRequest,
  getTenantIdFromRequest
} = require('../middleware/contactsPermission');
const { z } = require('zod');

/**
 * Middleware para verificar token do usuário usando InboxContext
 * Usa o token da inbox ativa em vez do token da account
 */
const verifyUserTokenWithInbox = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      await new Promise((resolve, reject) => {
        validateSupabaseToken(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      await new Promise((resolve, reject) => {
        inboxContextMiddleware({ required: false, useCache: true })(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      if (req.context?.wuzapiToken) {
        req.userToken = req.context.wuzapiToken;
        req.userId = req.user?.id;
        req.inboxId = req.context.inboxId;
        
        logger.debug('WUZAPI token obtained from inbox context for contacts', {
          userId: req.userId?.substring(0, 8) + '...',
          inboxId: req.inboxId?.substring(0, 8) + '...',
          hasToken: true
        });
        
        return next();
      }
      
      if (req.user?.id) {
        req.userId = req.user.id;
        logger.warn('No inbox context available for contacts user', {
          userId: req.user.id.substring(0, 8) + '...',
          path: req.path
        });
        return next();
      }
    } catch (error) {
      logger.debug('JWT/InboxContext validation failed for contacts, trying other methods', { 
        error: error.message,
        path: req.path
      });
    }
  }
  
  const tokenHeader = req.headers.token;
  if (tokenHeader) {
    req.userToken = tokenHeader;
    return next();
  }
  
  if (req.session?.userToken) {
    req.userToken = req.session.userToken;
    return next();
  }
  
  return res.status(401).json({
    success: false,
    error: {
      code: 'NO_TOKEN',
      message: 'Token não fornecido. Use Authorization Bearer, header token ou sessão ativa.'
    }
  });
};

const verifyUserToken = verifyUserTokenWithInbox;

// ==================== VALIDATION SCHEMAS ====================

const createContactSchema = z.object({
  phone: z.string().min(8).max(20),
  name: z.string().max(255).optional(),
  avatarUrl: z.string().url().optional(),
  whatsappJid: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

const updateContactSchema = z.object({
  phone: z.string().min(8).max(20).optional(),
  name: z.string().max(255).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
  whatsappJid: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional()
});

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional()
});

const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable()
});

const assignTagsSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
  tagIds: z.array(z.string().uuid()).min(1)
});

const groupMembersSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1)
});

const deleteContactsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1)
});

const migrateSchema = z.object({
  contacts: z.array(z.object({
    phone: z.string(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    whatsappJid: z.string().optional(),
    source: z.string().optional(),
    metadata: z.record(z.any()).optional(),
    tagIds: z.array(z.string()).optional(),
    groupIds: z.array(z.string()).optional()
  })).optional(),
  tags: z.array(z.object({
    id: z.string(),
    name: z.string(),
    color: z.string().optional()
  })).optional(),
  groups: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional()
  })).optional()
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get account ID and tenant ID from request
 */
async function getAccountContext(req) {
  // Try to get from session first
  if (req.session?.accountId) {
    const SupabaseService = require('../services/SupabaseService');
    const { data: account } = await SupabaseService.getById('accounts', req.session.accountId);
    if (account) {
      return { accountId: account.id, tenantId: account.tenant_id };
    }
  }

  // Try to get from user ID (for JWT auth)
  if (req.userId) {
    const SupabaseService = require('../services/SupabaseService');
    
    // First try to find account by owner_user_id
    const queryFn = (query) => query
      .select('id, tenant_id')
      .eq('owner_user_id', req.userId)
      .single();

    const { data: account } = await SupabaseService.queryAsAdmin('accounts', queryFn);
    if (account) {
      return { accountId: account.id, tenantId: account.tenant_id };
    }
  }

  return null;
}

/**
 * Get creator info from request
 */
function getCreatorInfo(req) {
  // Check if agent
  if (req.session?.agentId) {
    return { id: req.session.agentId, type: 'agent' };
  }
  
  // Default to account
  return { id: req.session?.accountId || req.userId, type: 'account' };
}

// ==================== CONTACTS ROUTES ====================

/**
 * GET /api/user/contacts
 * List contacts with pagination and filters
 * Requirements: 11.2 - Read permission required
 */
router.get('/', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const options = {
      page: parseInt(req.query.page) || 1,
      pageSize: parseInt(req.query.pageSize) || 50,
      search: req.query.search || '',
      tagIds: req.query.tagIds ? req.query.tagIds.split(',') : [],
      groupId: req.query.groupId || null,
      hasName: req.query.hasName === 'true' ? true : req.query.hasName === 'false' ? false : null,
      sourceInboxId: req.query.sourceInboxId || null,
      sortBy: req.query.sortBy || 'created_at',
      sortOrder: req.query.sortOrder || 'desc'
    };

    const result = await ContactsService.getContacts(context.accountId, options);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error fetching contacts', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// NOTE: GET /:id route moved to end of file to avoid catching /import/wuzapi, /tags, /groups

/**
 * POST /api/user/contacts
 * Create a new contact
 * Requirements: 11.3 - Write permission required
 */
router.post('/', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createContactSchema.parse(req.body);
    const createdBy = getCreatorInfo(req);

    const contact = await ContactsService.createContact(
      context.accountId,
      context.tenantId,
      validated,
      createdBy
    );

    res.status(201).json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'CONTACT_PHONE_EXISTS') {
      return res.status(409).json({ success: false, error: 'Contact with this phone already exists' });
    }
    logger.error('Error creating contact', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/contacts/:id
 * Update a contact
 * Requirements: 11.3 - Write permission required
 */
router.put('/:id', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = updateContactSchema.parse(req.body);
    const updatedBy = getCreatorInfo(req);

    const contact = await ContactsService.updateContact(
      context.accountId,
      req.params.id,
      validated,
      updatedBy
    );

    res.json({ success: true, data: contact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'CONTACT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    if (error.message === 'CONTACT_PHONE_EXISTS') {
      return res.status(409).json({ success: false, error: 'Contact with this phone already exists' });
    }
    logger.error('Error updating contact', { 
      error: error.message, 
      contactId: req.params.id,
      endpoint: '/api/user/contacts/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/contacts
 * Delete multiple contacts
 * Requirements: 11.4 - Delete permission required
 */
router.delete('/', verifyUserToken, requireContactsDelete, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = deleteContactsSchema.parse(req.body);

    const result = await ContactsService.deleteContacts(context.accountId, validated.ids);

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error deleting contacts', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});


// ==================== STATS ROUTE ====================

/**
 * GET /api/user/contacts/stats
 * Get contact statistics
 * Requirements: 11.2 - Read permission required
 */
router.get('/stats', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const stats = await ContactsService.getStats(context.accountId);

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching contact stats', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/stats'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== IMPORT & MIGRATION ROUTES ====================

/**
 * GET /api/user/contacts/import/wuzapi
 * Import contacts from WUZAPI agenda
 * Requirements: 9.1 - Import from WhatsApp
 * 
 * Busca o token WUZAPI da inbox vinculada à conta do usuário
 */
router.get('/import/wuzapi', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const SupabaseService = require('../services/SupabaseService');

    // Buscar inbox vinculada à conta com wuzapi_token
    const inboxQueryFn = (query) => query
      .select('id, name, wuzapi_token, wuzapi_connected, phone_number')
      .eq('account_id', context.accountId)
      .not('wuzapi_token', 'is', null)
      .eq('status', 'active')
      .limit(1)
      .single();

    const { data: inbox, error: inboxError } = await SupabaseService.queryAsAdmin('inboxes', inboxQueryFn);

    if (inboxError || !inbox) {
      logger.warn('No inbox found for contact import', { 
        accountId: context.accountId,
        error: inboxError?.message 
      });
      return res.status(404).json({
        success: false,
        error: 'Nenhuma caixa de entrada configurada. Configure uma caixa de entrada com WhatsApp primeiro.'
      });
    }

    if (!inbox.wuzapi_token) {
      return res.status(400).json({
        success: false,
        error: 'Caixa de entrada sem token WUZAPI configurado'
      });
    }

    const wuzapiToken = inbox.wuzapi_token;
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    logger.info('Importing contacts from WUZAPI', {
      accountId: context.accountId,
      inboxId: inbox.id,
      inboxName: inbox.name,
      wuzapiToken: wuzapiToken.substring(0, 8) + '...'
    });

    // Fetch contacts from WUZAPI
    const response = await axios.get(
      `${wuzapiBaseUrl}/user/contacts`,
      {
        headers: {
          'token': wuzapiToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const wuzapiResponse = response.data;

    if (!wuzapiResponse || !wuzapiResponse.data) {
      logger.error('Invalid WUZAPI response', { wuzapiResponse });
      throw new Error('Invalid WUZAPI response');
    }

    const wuzapiContacts = wuzapiResponse.data;
    logger.info('Raw WUZAPI contacts received', {
      totalEntries: Object.keys(wuzapiContacts).length
    });

    // Transform contacts object to array
    const contacts = Object.entries(wuzapiContacts)
      .filter(([jid, contact]) => jid && jid.includes('@') && contact.Found)
      .map(([jid, contact]) => {
        const phone = jid.split('@')[0];
        // Basic phone normalization
        const normalizedPhone = phone.replace(/\D/g, '');
        
        // Map WUZAPI fields to standard variables
        const name = contact.FullName || contact.PushName || contact.BusinessName || null;
        const variables = {
          nome: name || '',
          telefone: normalizedPhone,
          phone: normalizedPhone
        };

        return {
          phone: normalizedPhone,
          name: name,
          variables: variables,
          valid: normalizedPhone.length >= 8
        };
      })
      .filter(contact => contact.valid);

    logger.info('Contacts processed and validated', {
      total: contacts.length
    });

    res.json({
      success: true,
      contacts: contacts.map(c => ({
        phone: c.phone,
        name: c.name,
        variables: c.variables
      })),
      total: contacts.length
    });

  } catch (error) {
    logger.error('Error importing contacts from WUZAPI:', {
      error: error.message,
      status: error.response?.status,
      endpoint: '/api/user/contacts/import/wuzapi'
    });

    let statusCode = 500;
    let errorMessage = error.message;

    if (error.response?.status === 401) {
      statusCode = 401;
      errorMessage = 'Token WUZAPI inválido ou expirado. Reconecte sua caixa de entrada.';
    } else if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = 'Instância WhatsApp não encontrada';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Serviço WUZAPI indisponível';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      statusCode = 408;
      errorMessage = 'Tempo limite excedido ao conectar com WUZAPI';
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

/**
 * POST /api/user/contacts/import
 * Import contacts from WhatsApp
 * Requirements: 11.3 - Write permission required
 */
router.post('/import', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({ success: false, error: 'contacts array is required' });
    }

    const createdBy = getCreatorInfo(req);

    const result = await ContactsService.importFromWhatsApp(
      context.accountId,
      context.tenantId,
      contacts,
      createdBy
    );

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Error importing contacts', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/import'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/migrate
 * Migrate contacts from localStorage
 * Requirements: 11.3 - Write permission required
 */
router.post('/migrate', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = migrateSchema.parse(req.body);

    const result = await ContactsService.migrateFromLocalStorage(
      context.accountId,
      context.tenantId,
      validated
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error migrating contacts', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/migrate'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== TAGS ROUTES ====================

/**
 * GET /api/user/contacts/tags
 * List all tags
 * Requirements: 11.2 - Read permission required
 */
router.get('/tags', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const tags = await ContactsService.getTags(context.accountId);

    res.json({ success: true, data: tags });
  } catch (error) {
    logger.error('Error fetching tags', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/tags'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/tags
 * Create a new tag
 * Requirements: 11.3 - Write permission required
 */
router.post('/tags', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createTagSchema.parse(req.body);

    const tag = await ContactsService.createTag(
      context.accountId,
      context.tenantId,
      validated
    );

    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'TAG_NAME_EXISTS') {
      return res.status(409).json({ success: false, error: 'Tag with this name already exists' });
    }
    logger.error('Error creating tag', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/tags'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/contacts/tags/:id
 * Delete a tag
 * Requirements: 11.4 - Delete permission required
 */
router.delete('/tags/:id', verifyUserToken, requireContactsDelete, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    await ContactsService.deleteTag(context.accountId, req.params.id);

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    logger.error('Error deleting tag', { 
      error: error.message, 
      tagId: req.params.id,
      endpoint: '/api/user/contacts/tags/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/tags/assign
 * Assign tags to contacts
 * Requirements: 11.3 - Write permission required
 */
router.post('/tags/assign', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = assignTagsSchema.parse(req.body);

    const result = await ContactsService.addTagsToContacts(
      context.accountId,
      validated.contactIds,
      validated.tagIds
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error assigning tags', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/tags/assign'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/tags/remove
 * Remove tags from contacts
 * Requirements: 11.3 - Write permission required
 */
router.post('/tags/remove', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = assignTagsSchema.parse(req.body);

    const result = await ContactsService.removeTagsFromContacts(
      context.accountId,
      validated.contactIds,
      validated.tagIds
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error removing tags', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/tags/remove'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GROUPS ROUTES ====================

/**
 * GET /api/user/contacts/groups
 * List all groups
 * Requirements: 11.2 - Read permission required
 */
router.get('/groups', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const groups = await ContactsService.getGroups(context.accountId);

    res.json({ success: true, data: groups });
  } catch (error) {
    logger.error('Error fetching groups', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/groups'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/groups
 * Create a new group
 * Requirements: 11.3 - Write permission required
 */
router.post('/groups', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = createGroupSchema.parse(req.body);

    const group = await ContactsService.createGroup(
      context.accountId,
      context.tenantId,
      validated
    );

    res.status(201).json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'GROUP_NAME_EXISTS') {
      return res.status(409).json({ success: false, error: 'Group with this name already exists' });
    }
    logger.error('Error creating group', { 
      error: error.message, 
      userId: req.userId,
      endpoint: '/api/user/contacts/groups'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/contacts/groups/:id
 * Update a group
 * Requirements: 11.3 - Write permission required
 */
router.put('/groups/:id', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = updateGroupSchema.parse(req.body);

    const group = await ContactsService.updateGroup(
      context.accountId,
      req.params.id,
      validated
    );

    res.json({ success: true, data: group });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    if (error.message === 'GROUP_NAME_EXISTS') {
      return res.status(409).json({ success: false, error: 'Group with this name already exists' });
    }
    logger.error('Error updating group', { 
      error: error.message, 
      groupId: req.params.id,
      endpoint: '/api/user/contacts/groups/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/contacts/groups/:id
 * Delete a group
 * Requirements: 11.4 - Delete permission required
 */
router.delete('/groups/:id', verifyUserToken, requireContactsDelete, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    await ContactsService.deleteGroup(context.accountId, req.params.id);

    res.json({ success: true, message: 'Group deleted' });
  } catch (error) {
    logger.error('Error deleting group', { 
      error: error.message, 
      groupId: req.params.id,
      endpoint: '/api/user/contacts/groups/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/contacts/groups/:id/members
 * Add contacts to a group
 * Requirements: 11.3 - Write permission required
 */
router.post('/groups/:id/members', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = groupMembersSchema.parse(req.body);

    const result = await ContactsService.addContactsToGroup(
      context.accountId,
      req.params.id,
      validated.contactIds
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    if (error.message === 'GROUP_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    logger.error('Error adding contacts to group', { 
      error: error.message, 
      groupId: req.params.id,
      endpoint: '/api/user/contacts/groups/:id/members'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/contacts/groups/:id/members
 * Remove contacts from a group
 * Requirements: 11.3 - Write permission required (removing from group is not deleting)
 */
router.delete('/groups/:id/members', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = groupMembersSchema.parse(req.body);

    const result = await ContactsService.removeContactsFromGroup(
      context.accountId,
      req.params.id,
      validated.contactIds
    );

    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error removing contacts from group', { 
      error: error.message, 
      groupId: req.params.id,
      endpoint: '/api/user/contacts/groups/:id/members'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== USER CREATION ROUTE ====================

/**
 * POST /api/user/contacts/:id/create-user
 * Create a user from a contact
 * Requirements: 11.3 - Write permission required
 */
router.post('/:id/create-user', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }

    const user = await ContactsService.createUserFromContact(
      context.accountId,
      req.params.id,
      { email, password, name }
    );

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    if (error.message === 'CONTACT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, error: 'User with this email already exists' });
    }
    logger.error('Error creating user from contact', { 
      error: error.message, 
      contactId: req.params.id,
      endpoint: '/api/user/contacts/:id/create-user'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PARAMETERIZED ROUTES (MUST BE LAST) ====================
// These routes use :id parameter and must be defined AFTER all specific paths
// like /import/wuzapi, /tags, /groups to avoid catching them as :id

/**
 * POST /import/:inboxId - Import contacts from specific inbox
 */
router.post('/import/:inboxId', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    const tenantId = getTenantIdFromRequest(req);
    const { inboxId } = req.params;
    const actor = getContactsActor(req);

    // Validate inboxId is UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inboxId)) {
      return res.status(400).json({ error: 'Invalid inbox ID format' });
    }

    const result = await ContactsService.importFromInbox(accountId, tenantId, inboxId, actor);
    
    logger.info('Inbox import completed', { 
      accountId, 
      inboxId,
      result,
      userId: req.user?.id 
    });

    res.json({ 
      success: true, 
      data: result,
      message: `Import completed: ${result.added} added, ${result.updated} updated, ${result.unchanged} unchanged`
    });
  } catch (error) {
    logger.error('Failed to import from inbox', { 
      error: error.message, 
      userId: req.user?.id,
      inboxId: req.params.inboxId,
      endpoint: '/import/:inboxId'
    });

    // Handle specific errors
    if (error.message === 'INBOX_NOT_FOUND') {
      return res.status(404).json({ error: 'Caixa de entrada não encontrada' });
    }
    if (error.message === 'INBOX_ACCESS_DENIED') {
      return res.status(403).json({ error: 'Acesso negado à caixa de entrada' });
    }
    if (error.message === 'INBOX_NOT_CONNECTED') {
      return res.status(400).json({ error: 'Caixa de entrada não conectada ao WhatsApp' });
    }

    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /merge - Merge duplicate contacts
 */
router.post('/merge', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    const actor = getContactsActor(req);
    
    const { contactIds, mergeData } = req.body;
    
    // Validate input
    if (!contactIds || !Array.isArray(contactIds) || contactIds.length < 2) {
      return res.status(400).json({ error: 'At least 2 contact IDs required for merge' });
    }

    if (!mergeData || typeof mergeData !== 'object') {
      return res.status(400).json({ error: 'Merge data is required' });
    }

    // Validate all contact IDs are UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    for (const id of contactIds) {
      if (!uuidRegex.test(id)) {
        return res.status(400).json({ error: `Invalid contact ID format: ${id}` });
      }
    }

    const mergedContact = await ContactsService.mergeContactsForDuplicates(
      accountId, 
      contactIds, 
      mergeData, 
      actor
    );
    
    res.json({ 
      success: true, 
      data: mergedContact,
      message: `Successfully merged ${contactIds.length} contacts`
    });
  } catch (error) {
    logger.error('Failed to merge contacts', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/merge'
    });

    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ error: 'Um ou mais contatos não encontrados' });
    }

    res.status(500).json({ error: 'Erro ao mesclar contatos. Nenhuma alteração foi feita.' });
  }
});

// ==================== DUPLICATES ROUTES ====================

/**
 * GET /duplicates - Get duplicate contact sets
 */
router.get('/duplicates', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    
    const duplicates = await ContactsService.getDuplicates(accountId);
    
    res.json({ success: true, data: duplicates });
  } catch (error) {
    logger.error('Failed to get duplicates', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/duplicates'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /duplicates/dismiss - Dismiss a duplicate pair as false positive
 */
router.post('/duplicates/dismiss', verifyUserToken, requireContactsWrite, async (req, res) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    const actor = getContactsActor(req);
    
    const { contactId1, contactId2 } = req.body;
    
    if (!contactId1 || !contactId2) {
      return res.status(400).json({ error: 'Both contactId1 and contactId2 are required' });
    }

    if (contactId1 === contactId2) {
      return res.status(400).json({ error: 'Cannot dismiss duplicate of same contact' });
    }

    await ContactsService.dismissDuplicate(accountId, contactId1, contactId2, actor);
    
    res.json({ 
      success: true, 
      message: 'Duplicate pair dismissed successfully' 
    });
  } catch (error) {
    logger.error('Failed to dismiss duplicate', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/duplicates/dismiss'
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== INBOX SELECTION ROUTES ====================

/**
 * GET /inboxes - List available inboxes for import
 */
router.get('/inboxes', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const accountId = getAccountIdFromRequest(req);
    
    const inboxes = await ContactsService.getAccountInboxes(accountId);
    
    res.json({ success: true, data: inboxes });
  } catch (error) {
    logger.error('Failed to get account inboxes', { 
      error: error.message, 
      userId: req.user?.id,
      endpoint: '/inboxes'
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== PARAMETERIZED ROUTES (MUST BE LAST) ====================
// These routes use :id parameter and must be defined AFTER all specific paths
// like /duplicates, /inboxes, /stats to avoid catching them as :id

/**
 * GET /api/user/contacts/:id
 * Get a single contact by ID
 * Requirements: 11.2 - Read permission required
 * 
 * NOTE: This route MUST be defined after all other GET routes to avoid
 * catching paths like /duplicates, /inboxes, /stats as :id parameter
 */
router.get('/:id', verifyUserToken, requireContactsRead, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const contact = await ContactsService.getContactById(context.accountId, req.params.id);

    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    logger.error('Error fetching contact', { 
      error: error.message, 
      contactId: req.params.id,
      endpoint: '/api/user/contacts/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
