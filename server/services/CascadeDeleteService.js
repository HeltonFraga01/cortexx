/**
 * CascadeDeleteService
 * 
 * Handles cascade deletion for multi-user system entities.
 * 
 * Requirements: 1.5
 */

const { logger } = require('../utils/logger');

class CascadeDeleteService {
  constructor(db) {
    this.db = db;
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
      const auditResult = await this.db.query(
        'DELETE FROM audit_log WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.auditLogs = auditResult.changes || 0;

      // 2. Delete agent sessions
      const sessionsResult = await this.db.query(
        'DELETE FROM agent_sessions WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.sessions = sessionsResult.changes || 0;

      // 3. Get all agents for this account (needed for inbox/team member cleanup)
      const { rows: agents } = await this.db.query(
        'SELECT id FROM agents WHERE account_id = ?',
        [accountId]
      );
      const agentIds = agents.map(a => a.id);

      // 4. Delete inbox members for account's agents
      if (agentIds.length > 0) {
        const placeholders = agentIds.map(() => '?').join(',');
        const inboxMembersResult = await this.db.query(
          `DELETE FROM inbox_members WHERE agent_id IN (${placeholders})`,
          agentIds
        );
        summary.deletedCounts.inboxMembers = inboxMembersResult.changes || 0;

        // 5. Delete team members for account's agents
        const teamMembersResult = await this.db.query(
          `DELETE FROM team_members WHERE agent_id IN (${placeholders})`,
          agentIds
        );
        summary.deletedCounts.teamMembers = teamMembersResult.changes || 0;
      }

      // 6. Delete inboxes
      const inboxesResult = await this.db.query(
        'DELETE FROM inboxes WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.inboxes = inboxesResult.changes || 0;

      // 7. Delete teams
      const teamsResult = await this.db.query(
        'DELETE FROM teams WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.teams = teamsResult.changes || 0;

      // 8. Delete custom roles
      const rolesResult = await this.db.query(
        'DELETE FROM custom_roles WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.customRoles = rolesResult.changes || 0;

      // 9. Delete agent invitations
      const invitationsResult = await this.db.query(
        'DELETE FROM agent_invitations WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.invitations = invitationsResult.changes || 0;

      // 10. Delete agents
      const agentsResult = await this.db.query(
        'DELETE FROM agents WHERE account_id = ?',
        [accountId]
      );
      summary.deletedCounts.agents = agentsResult.changes || 0;

      // 11. Finally delete the account
      const accountResult = await this.db.query(
        'DELETE FROM accounts WHERE id = ?',
        [accountId]
      );
      summary.deletedCounts.accounts = accountResult.changes || 0;

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
      const sessionsResult = await this.db.query(
        'DELETE FROM agent_sessions WHERE agent_id = ?',
        [agentId]
      );
      summary.deletedCounts.sessions = sessionsResult.changes || 0;

      // 2. Delete inbox memberships
      const inboxMembersResult = await this.db.query(
        'DELETE FROM inbox_members WHERE agent_id = ?',
        [agentId]
      );
      summary.deletedCounts.inboxMembers = inboxMembersResult.changes || 0;

      // 3. Delete team memberships
      const teamMembersResult = await this.db.query(
        'DELETE FROM team_members WHERE agent_id = ?',
        [agentId]
      );
      summary.deletedCounts.teamMembers = teamMembersResult.changes || 0;

      // 4. Update conversations to remove agent assignment
      const conversationsResult = await this.db.query(
        'UPDATE conversations SET assigned_agent_id = NULL WHERE assigned_agent_id = ?',
        [agentId]
      );
      summary.deletedCounts.conversationAssignments = conversationsResult.changes || 0;

      // 5. Delete the agent
      const agentResult = await this.db.query(
        'DELETE FROM agents WHERE id = ?',
        [agentId]
      );
      summary.deletedCounts.agents = agentResult.changes || 0;

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
      const membersResult = await this.db.query(
        'DELETE FROM team_members WHERE team_id = ?',
        [teamId]
      );
      summary.deletedCounts.members = membersResult.changes || 0;

      // 2. Delete the team
      const teamResult = await this.db.query(
        'DELETE FROM teams WHERE id = ?',
        [teamId]
      );
      summary.deletedCounts.teams = teamResult.changes || 0;

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
      const membersResult = await this.db.query(
        'DELETE FROM inbox_members WHERE inbox_id = ?',
        [inboxId]
      );
      summary.deletedCounts.members = membersResult.changes || 0;

      // 2. Update conversations to remove inbox assignment
      const conversationsResult = await this.db.query(
        'UPDATE conversations SET inbox_id = NULL WHERE inbox_id = ?',
        [inboxId]
      );
      summary.deletedCounts.conversationAssignments = conversationsResult.changes || 0;

      // 3. Delete the inbox
      const inboxResult = await this.db.query(
        'DELETE FROM inboxes WHERE id = ?',
        [inboxId]
      );
      summary.deletedCounts.inboxes = inboxResult.changes || 0;

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
      const { rows: agents } = await this.db.query(
        'SELECT COUNT(*) as count FROM agents WHERE account_id = ?',
        [accountId]
      );
      orphans.agents = agents[0]?.count || 0;

      // Check for orphaned teams
      const { rows: teams } = await this.db.query(
        'SELECT COUNT(*) as count FROM teams WHERE account_id = ?',
        [accountId]
      );
      orphans.teams = teams[0]?.count || 0;

      // Check for orphaned inboxes
      const { rows: inboxes } = await this.db.query(
        'SELECT COUNT(*) as count FROM inboxes WHERE account_id = ?',
        [accountId]
      );
      orphans.inboxes = inboxes[0]?.count || 0;

      // Check for orphaned custom roles
      const { rows: roles } = await this.db.query(
        'SELECT COUNT(*) as count FROM custom_roles WHERE account_id = ?',
        [accountId]
      );
      orphans.customRoles = roles[0]?.count || 0;

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
