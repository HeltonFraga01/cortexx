/**
 * Account Inbox Management Routes
 * 
 * Handles inbox CRUD operations and agent assignment.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.6
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const InboxService = require('../services/InboxService');
const { requireAgentAuth, requirePermission } = require('../middleware/agentAuth');
const { quotaMiddleware } = require('../middleware/quotaEnforcement');

// Service initialized at module level (uses SupabaseService internally)
const inboxService = new InboxService();

/**
 * GET /api/account/inboxes
 * List all inboxes
 */
router.get('/', requireAgentAuth(null), requirePermission('inboxes:view'), async (req, res) => {
  try {
    const inboxes = await inboxService.listInboxesWithStats(req.account.id);
    
    res.json({ success: true, data: inboxes });
  } catch (error) {
    logger.error('List inboxes failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/inboxes/my
 * List inboxes for current agent
 */
router.get('/my', requireAgentAuth(null), async (req, res) => {
  try {
    
    
    const inboxes = await inboxService.listAgentInboxes(req.agent.id);
    
    res.json({ success: true, data: inboxes });
  } catch (error) {
    logger.error('List my inboxes failed', { error: error.message, agentId: req.agent?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/inboxes/:id
 * Get inbox by ID
 */
router.get('/:id', requireAgentAuth(null), requirePermission('inboxes:view'), async (req, res) => {
  try {
    
    
    const inbox = await inboxService.getInboxById(req.params.id);
    
    if (!inbox || inbox.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Inbox não encontrado', code: 'INBOX_NOT_FOUND' });
    }
    
    const members = await inboxService.getInboxMembers(req.params.id);
    
    res.json({ success: true, data: { ...inbox, members } });
  } catch (error) {
    logger.error('Get inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/inboxes
 * Create inbox
 */
router.post('/', requireAgentAuth(null), requirePermission('inboxes:manage'), quotaMiddleware.inboxes, async (req, res) => {
  try {
    
    
    const { name, description, channelType, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name é obrigatório', code: 'MISSING_FIELDS' });
    }
    
    const inbox = await inboxService.createInbox(req.account.id, {
      name, description, channelType, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage
    });
    
    logger.info('Inbox created', { inboxId: inbox.id, accountId: req.account.id });
    
    res.status(201).json({ success: true, data: inbox });
  } catch (error) {
    logger.error('Create inbox failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/account/inboxes/:id
 * Update inbox
 */
router.put('/:id', requireAgentAuth(null), requirePermission('inboxes:manage'), async (req, res) => {
  try {
    
    
    const inbox = await inboxService.getInboxById(req.params.id);
    if (!inbox || inbox.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Inbox não encontrado', code: 'INBOX_NOT_FOUND' });
    }
    
    const { name, description, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage } = req.body;
    const updated = await inboxService.updateInbox(req.params.id, {
      name, description, enableAutoAssignment, autoAssignmentConfig, greetingEnabled, greetingMessage
    });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/inboxes/:id
 * Delete inbox
 */
router.delete('/:id', requireAgentAuth(null), requirePermission('inboxes:manage'), async (req, res) => {
  try {
    
    
    const inbox = await inboxService.getInboxById(req.params.id);
    if (!inbox || inbox.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Inbox não encontrado', code: 'INBOX_NOT_FOUND' });
    }
    
    await inboxService.deleteInbox(req.params.id);
    
    logger.info('Inbox deleted', { inboxId: req.params.id });
    
    res.json({ success: true, message: 'Inbox excluído com sucesso' });
  } catch (error) {
    logger.error('Delete inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/inboxes/:id/agents
 * Assign agents to inbox
 */
router.post('/:id/agents', requireAgentAuth(null), requirePermission('inboxes:manage'), async (req, res) => {
  try {
    
    
    const inbox = await inboxService.getInboxById(req.params.id);
    if (!inbox || inbox.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Inbox não encontrado', code: 'INBOX_NOT_FOUND' });
    }
    
    const { agentIds } = req.body;
    if (!agentIds || !Array.isArray(agentIds)) {
      return res.status(400).json({ error: 'agentIds é obrigatório e deve ser um array', code: 'MISSING_FIELDS' });
    }
    
    await inboxService.assignAgents(req.params.id, agentIds);
    
    res.status(201).json({ success: true, message: 'Agentes atribuídos com sucesso' });
  } catch (error) {
    logger.error('Assign agents to inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/inboxes/:id/agents/:agentId
 * Remove agent from inbox
 */
router.delete('/:id/agents/:agentId', requireAgentAuth(null), requirePermission('inboxes:manage'), async (req, res) => {
  try {
    
    
    const inbox = await inboxService.getInboxById(req.params.id);
    if (!inbox || inbox.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Inbox não encontrado', code: 'INBOX_NOT_FOUND' });
    }
    
    await inboxService.removeAgent(req.params.id, req.params.agentId);
    
    res.json({ success: true, message: 'Agente removido com sucesso' });
  } catch (error) {
    logger.error('Remove agent from inbox failed', { error: error.message, inboxId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
