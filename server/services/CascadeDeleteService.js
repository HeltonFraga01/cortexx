/**
 * CascadeDeleteService
 * 
 * Handles cascade deletion for multi-user system entities.
 * 
 * Requirements: 1.5
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class CascadeDeleteService {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Delete an account and all associated data
   * 
   * Cascade order:
   * 1. Audit logs
   * 2. Agent sessions
   * 3. Inbox members
   * 4. Team members
   * 5. Inboxes
   * 6. Teams
   * 7. Custom roles
   * 8. Agent invitations
   * 9. Agents
   * 10. Account
   * 
   * @param {string} accountId - Account ID to delete
   * @returns {Promise<Object>} Deletion summary
   * 
   * Requirements: 1.5
   */
  async deleteAccount(accountId) {
    const summary = {
      accountId,
      deletedCounts: {},
      success: false
    };

    try {
      logger.info('Starting cascade delete for account', { accountId });

      // 1. Delete audit logs
      await SupabaseService.queryAsAdmin('audit_log', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.auditLogs = 'deleted';

      // 2. Delete agent sessions
      await SupabaseService.queryAsAdmin('agent_sessions', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.sessions = 'deleted';

      // 3. Get all agents for this account (needed for inbox/team member cleanup)
      const { data: agents } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('id').eq('account_id', accountId)
      );
      const agentIds = (agents || []).map(a => a.id);

      // 4. Delete inbox members for account's agents
      if (agentIds.length > 0) {
        await SupabaseService.queryAsAdmin('inbox_members', (query) =>
          query.delete().in('agent_id', agentIds)
        );
        summary.deletedCounts.inboxMembers = 'deleted';

        // 5. Delete team members for account's agents
        await SupabaseService.queryAsAdmin('team_members', (query) =>
          query.delete().in('agent_id', agentIds)
        );
        summary.deletedCounts.teamMembers = 'deleted';
      }

      // 6. Delete inboxes
      await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.inboxes = 'deleted';

      // 7. Delete teams
      await SupabaseService.queryAsAdmin('teams', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.teams = 'deleted';

      // 8. Delete custom roles
      await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.customRoles = 'deleted';

      // 9. Delete agent invitations
      await SupabaseService.queryAsAdmin('agent_invitations', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.invitations = 'deleted';

      // 10. Delete agents
      await SupabaseService.queryAsAdmin('agents', (query) =>
        query.delete().eq('account_id', accountId)
      );
      summary.deletedCounts.agents = 'deleted';

      // 11. Finally delete the account
      await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.delete().eq('id', accountId)
      );
      summary.deletedCounts.accounts = 'deleted';

      summary.success = true;
      logger.info('Cascade delete completed for account', { accountId, summary });

      return summary;
    } catch (error) {
      logger.error('Cascade delete failed for account', { 
        accountId, 
        error: error.message,
        summary 
      });
      throw error;
    }
  }

  /**
   * Delete an agent and all associated data
   * 
   * @param {string} agentId - Agent ID to delete
   * @returns {Promise<Object>} Deletion summary
   */
  async deleteAgent(agentId) {
    const summary = {
      agentId,
      deletedCounts: {},
      success: false
    };

    try {
      logger.info('Starting cascade delete for agent', { agentId });

      // 1. Delete agent sessions
      await SupabaseService.queryAsAdmin('agent_sessions', (query) =>
        query.delete().eq('agent_id', agentId)
      );
      summary.deletedCounts.sessions = 'deleted';

      // 2. Delete inbox memberships
      await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.delete().eq('agent_id', agentId)
      );
      summary.deletedCounts.inboxMembers = 'deleted';

      // 3. Delete team memberships
      await SupabaseService.queryAsAdmin('team_members', (query) =>
        query.delete().eq('agent_id', agentId)
      );
      summary.deletedCounts.teamMembers = 'deleted';

      // 4. Update conversations to remove agent assignment
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ assigned_agent_id: null }).eq('assigned_agent_id', agentId)
      );
      summary.deletedCounts.conversationAssignments = 'updated';

      // 5. Delete the agent
      await SupabaseService.queryAsAdmin('agents', (query) =>
        query.delete().eq('id', agentId)
      );
      summary.deletedCounts.agents = 'deleted';

      summary.success = true;
      logger.info('Cascade delete completed for agent', { agentId, summary });

      return summary;
    } catch (error) {
      logger.error('Cascade delete failed for agent', { 
        agentId, 
        error: error.message,
        summary 
      });
      throw error;
    }
  }

  /**
   * Delete a team and all associated data
   * 
   * @param {string} teamId - Team ID to delete
   * @returns {Promise<Object>} Deletion summary
   */
  async deleteTeam(teamId) {
    const summary = {
      teamId,
      deletedCounts: {},
      success: false
    };

    try {
      logger.info('Starting cascade delete for team', { teamId });

      // 1. Delete team members
      await SupabaseService.queryAsAdmin('team_members', (query) =>
        query.delete().eq('team_id', teamId)
      );
      summary.deletedCounts.members = 'deleted';

      // 2. Delete the team
      await SupabaseService.queryAsAdmin('teams', (query) =>
        query.delete().eq('id', teamId)
      );
      summary.deletedCounts.teams = 'deleted';

      summary.success = true;
      logger.info('Cascade delete completed for team', { teamId, summary });

      return summary;
    } catch (error) {
      logger.error('Cascade delete failed for team', { 
        teamId, 
        error: error.message,
        summary 
      });
      throw error;
    }
  }

  /**
   * Delete an inbox and all associated data
   * 
   * @param {string} inboxId - Inbox ID to delete
   * @returns {Promise<Object>} Deletion summary
   */
  async deleteInbox(inboxId) {
    const summary = {
      inboxId,
      deletedCounts: {},
      success: false
    };

    try {
      logger.info('Starting cascade delete for inbox', { inboxId });

      // 1. Delete inbox members
      await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.delete().eq('inbox_id', inboxId)
      );
      summary.deletedCounts.members = 'deleted';

      // 2. Update conversations to remove inbox assignment
      await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.update({ inbox_id: null }).eq('inbox_id', inboxId)
      );
      summary.deletedCounts.conversationAssignments = 'updated';

      // 3. Delete the inbox
      await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.delete().eq('id', inboxId)
      );
      summary.deletedCounts.inboxes = 'deleted';

      summary.success = true;
      logger.info('Cascade delete completed for inbox', { inboxId, summary });

      return summary;
    } catch (error) {
      logger.error('Cascade delete failed for inbox', { 
        inboxId, 
        error: error.message,
        summary 
      });
      throw error;
    }
  }

  /**
   * Verify no orphaned records exist after deletion
   * 
   * @param {string} accountId - Account ID to verify
   * @returns {Promise<Object>} Verification result
   */
  async verifyNoOrphans(accountId) {
    const orphans = {};

    try {
      // Check for orphaned agents
      const { count: agentCount } = await SupabaseService.count('agents', { account_id: accountId });
      orphans.agents = agentCount || 0;

      // Check for orphaned teams
      const { count: teamCount } = await SupabaseService.count('teams', { account_id: accountId });
      orphans.teams = teamCount || 0;

      // Check for orphaned inboxes
      const { count: inboxCount } = await SupabaseService.count('inboxes', { account_id: accountId });
      orphans.inboxes = inboxCount || 0;

      // Check for orphaned custom roles
      const { count: roleCount } = await SupabaseService.count('custom_roles', { account_id: accountId });
      orphans.customRoles = roleCount || 0;

      const hasOrphans = Object.values(orphans).some(count => count > 0);

      return {
        accountId,
        hasOrphans,
        orphanCounts: orphans
      };
    } catch (error) {
      logger.error('Failed to verify orphans', { accountId, error: error.message });
      throw error;
    }
  }
}

module.exports = CascadeDeleteService;
