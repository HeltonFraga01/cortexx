/**
 * Account Audit Log Routes
 * 
 * Handles audit log querying.
 * 
 * Requirements: 6.4
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const MultiUserAuditService = require('../services/MultiUserAuditService');
const { requireAgentAuth, requireAgentRole } = require('../middleware/agentAuth');

// Service initialized at module level (uses SupabaseService internally)
const auditService = new MultiUserAuditService();

/**
 * GET /api/account/audit
 * List audit logs with filters
 */
router.get('/', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    const { agentId, action, resourceType, resourceId, startDate, endDate, limit, offset } = req.query;
    
    const result = await auditService.queryLogs(req.account.id, {
      agentId,
      action,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    });
    
    res.json({ success: true, data: result.logs, pagination: result.pagination });
  } catch (error) {
    logger.error('List audit logs failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/audit/:id
 * Get audit log by ID
 */
router.get('/:id', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    const log = await auditService.getLogById(req.params.id);
    
    if (!log || log.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Log não encontrado', code: 'LOG_NOT_FOUND' });
    }
    
    res.json({ success: true, data: log });
  } catch (error) {
    logger.error('Get audit log failed', { error: error.message, logId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/audit/agent/:agentId
 * Get activity for a specific agent
 */
router.get('/agent/:agentId', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    const { limit } = req.query;
    const logs = await auditService.getAgentActivity(req.params.agentId, limit ? parseInt(limit) : 20);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get agent activity failed', { error: error.message, agentId: req.params.agentId });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/audit/resource/:type/:id
 * Get activity for a specific resource
 */
router.get('/resource/:type/:id', requireAgentAuth(null), requireAgentRole('owner', 'administrator'), async (req, res) => {
  try {
    const { limit } = req.query;
    const logs = await auditService.getResourceActivity(req.params.type, req.params.id, limit ? parseInt(limit) : 50);
    
    res.json({ success: true, data: logs });
  } catch (error) {
    logger.error('Get resource activity failed', { error: error.message });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
