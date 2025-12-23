/**
 * Account Team Management Routes
 * 
 * Handles team CRUD operations and member management.
 * 
 * Requirements: 5.1, 5.2, 5.4, 5.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const TeamService = require('../services/TeamService');
const { requireAgentAuth, requirePermission } = require('../middleware/agentAuth');
const { quotaMiddleware } = require('../middleware/quotaEnforcement');

// Service initialized at module level (uses SupabaseService internally)
const teamService = new TeamService();

/**
 * GET /api/account/teams
 * List all teams
 */
router.get('/', requireAgentAuth(null), requirePermission('teams:view'), async (req, res) => {
  try {
    const teams = await teamService.listTeamsWithStats(req.account.id);
    
    res.json({ success: true, data: teams });
  } catch (error) {
    logger.error('List teams failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /api/account/teams/:id
 * Get team by ID
 */
router.get('/:id', requireAgentAuth(null), requirePermission('teams:view'), async (req, res) => {
  try {
    
    
    const team = await teamService.getTeamById(req.params.id);
    
    if (!team || team.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Equipe não encontrada', code: 'TEAM_NOT_FOUND' });
    }
    
    const members = await teamService.getTeamMembers(req.params.id);
    const stats = await teamService.getTeamStats(req.params.id);
    
    res.json({ success: true, data: { ...team, members, stats } });
  } catch (error) {
    logger.error('Get team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/teams
 * Create team
 */
router.post('/', requireAgentAuth(null), requirePermission('teams:manage'), quotaMiddleware.teams, async (req, res) => {
  try {
    
    
    const { name, description, allowAutoAssign } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name é obrigatório', code: 'MISSING_FIELDS' });
    }
    
    const team = await teamService.createTeam(req.account.id, { name, description, allowAutoAssign });
    
    logger.info('Team created', { teamId: team.id, accountId: req.account.id });
    
    res.status(201).json({ success: true, data: team });
  } catch (error) {
    logger.error('Create team failed', { error: error.message, accountId: req.account?.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * PUT /api/account/teams/:id
 * Update team
 */
router.put('/:id', requireAgentAuth(null), requirePermission('teams:manage'), async (req, res) => {
  try {
    
    
    const team = await teamService.getTeamById(req.params.id);
    if (!team || team.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Equipe não encontrada', code: 'TEAM_NOT_FOUND' });
    }
    
    const { name, description, allowAutoAssign } = req.body;
    const updated = await teamService.updateTeam(req.params.id, { name, description, allowAutoAssign });
    
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Update team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/teams/:id
 * Delete team
 */
router.delete('/:id', requireAgentAuth(null), requirePermission('teams:manage'), async (req, res) => {
  try {
    
    
    const team = await teamService.getTeamById(req.params.id);
    if (!team || team.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Equipe não encontrada', code: 'TEAM_NOT_FOUND' });
    }
    
    await teamService.deleteTeam(req.params.id);
    
    logger.info('Team deleted', { teamId: req.params.id });
    
    res.json({ success: true, message: 'Equipe excluída com sucesso' });
  } catch (error) {
    logger.error('Delete team failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * POST /api/account/teams/:id/members
 * Add member to team
 */
router.post('/:id/members', requireAgentAuth(null), requirePermission('teams:manage'), async (req, res) => {
  try {
    
    
    const team = await teamService.getTeamById(req.params.id);
    if (!team || team.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Equipe não encontrada', code: 'TEAM_NOT_FOUND' });
    }
    
    const { agentId } = req.body;
    if (!agentId) {
      return res.status(400).json({ error: 'agentId é obrigatório', code: 'MISSING_FIELDS' });
    }
    
    await teamService.addMember(req.params.id, agentId);
    
    res.status(201).json({ success: true, message: 'Membro adicionado com sucesso' });
  } catch (error) {
    if (error.message === 'AGENT_ALREADY_IN_TEAM') {
      return res.status(409).json({ error: 'Agente já é membro desta equipe', code: 'AGENT_ALREADY_IN_TEAM' });
    }
    logger.error('Add team member failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * DELETE /api/account/teams/:id/members/:agentId
 * Remove member from team
 */
router.delete('/:id/members/:agentId', requireAgentAuth(null), requirePermission('teams:manage'), async (req, res) => {
  try {
    
    
    const team = await teamService.getTeamById(req.params.id);
    if (!team || team.accountId !== req.account.id) {
      return res.status(404).json({ error: 'Equipe não encontrada', code: 'TEAM_NOT_FOUND' });
    }
    
    await teamService.removeMember(req.params.id, req.params.agentId);
    
    res.json({ success: true, message: 'Membro removido com sucesso' });
  } catch (error) {
    logger.error('Remove team member failed', { error: error.message, teamId: req.params.id });
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
