/**
 * TeamService - Service for managing teams in multi-user system
 * 
 * Handles team CRUD operations and member management.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');
const SupabaseService = require('./SupabaseService');

class TeamService {
  constructor(auditService = null) {
    this.auditService = auditService || new MultiUserAuditService();
  }

  /**
   * Generate a unique ID
   * @returns {string} UUID
   */
  generateId() {
    return crypto.randomUUID();
  }

  // ==================== TEAM CRUD ====================

  /**
   * Create a new team
   * @param {string} accountId - Account ID
   * @param {Object} data - Team data
   * @param {string} data.name - Team name
   * @param {string} [data.description] - Team description
   * @param {boolean} [data.allowAutoAssign] - Allow auto assignment (default: true)
   * @returns {Promise<Object>} Created team
   */
  async createTeam(accountId, data) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const { error } = await SupabaseService.insert('teams', {
        id,
        account_id: accountId,
        name: data.name,
        description: data.description || null,
        allow_auto_assign: data.allowAutoAssign !== false,
        created_at: now,
        updated_at: now
      });

      if (error) throw error;

      logger.info('Team created', { teamId: id, accountId, name: data.name });

      // Audit log
      await this.auditService.logAction({
        accountId,
        agentId: data.createdBy || null,
        action: ACTION_TYPES.TEAM_CREATED,
        resourceType: RESOURCE_TYPES.TEAM,
        resourceId: id,
        details: { name: data.name }
      });

      return this.getTeamById(id);
    } catch (error) {
      logger.error('Failed to create team', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get team by ID
   * @param {string} teamId - Team ID
   * @returns {Promise<Object|null>} Team or null
   */
  async getTeamById(teamId) {
    try {
      const { data, error } = await SupabaseService.getById('teams', teamId);

      if (error || !data) {
        return null;
      }

      return this.formatTeam(data);
    } catch (error) {
      logger.error('Failed to get team', { error: error.message, teamId });
      throw error;
    }
  }

  /**
   * List teams for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object[]>} List of teams
   */
  async listTeams(accountId) {
    try {
      const { data, error } = await SupabaseService.getMany('teams', { account_id: accountId }, {
        orderBy: 'name',
        ascending: true
      });

      if (error) throw error;
      return (data || []).map(row => this.formatTeam(row));
    } catch (error) {
      logger.error('Failed to list teams', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * List teams with member count
   * @param {string} accountId - Account ID
   * @returns {Promise<Object[]>} List of teams with member count
   */
  async listTeamsWithStats(accountId) {
    try {
      // Get teams first
      const { data: teams, error: teamsError } = await SupabaseService.getMany('teams', { account_id: accountId }, {
        orderBy: 'name',
        ascending: true
      });

      if (teamsError) throw teamsError;
      if (!teams || teams.length === 0) return [];

      // Get member counts for each team
      const teamsWithStats = await Promise.all(teams.map(async (team) => {
        const { count } = await SupabaseService.count('team_members', { team_id: team.id });
        return {
          ...this.formatTeam(team),
          memberCount: count || 0
        };
      }));

      return teamsWithStats;
    } catch (error) {
      logger.error('Failed to list teams with stats', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a team
   * @param {string} teamId - Team ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>} Updated team
   */
  async updateTeam(teamId, data) {
    try {
      const updateData = { updated_at: new Date().toISOString() };

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        updateData.description = data.description;
      }

      if (data.allowAutoAssign !== undefined) {
        updateData.allow_auto_assign = data.allowAutoAssign;
      }

      if (Object.keys(updateData).length === 1) {
        // Only updated_at, no real changes
        return this.getTeamById(teamId);
      }

      const { error } = await SupabaseService.update('teams', teamId, updateData);
      if (error) throw error;

      logger.info('Team updated', { teamId });

      return this.getTeamById(teamId);
    } catch (error) {
      logger.error('Failed to update team', { error: error.message, teamId });
      throw error;
    }
  }

  /**
   * Delete a team
   * @param {string} teamId - Team ID
   * @returns {Promise<void>}
   */
  async deleteTeam(teamId, deletedBy = null) {
    try {
      const team = await this.getTeamById(teamId);
      // Members will be deleted via CASCADE
      const { error } = await SupabaseService.delete('teams', teamId);
      if (error) throw error;
      
      logger.info('Team deleted', { teamId });

      // Audit log
      if (team) {
        await this.auditService.logAction({
          accountId: team.accountId,
          agentId: deletedBy,
          action: ACTION_TYPES.TEAM_DELETED,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: teamId,
          details: { name: team.name }
        });
      }
    } catch (error) {
      logger.error('Failed to delete team', { error: error.message, teamId });
      throw error;
    }
  }

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * Add a member to a team
   * @param {string} teamId - Team ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} Created membership
   */
  async addMember(teamId, agentId) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      const { error } = await SupabaseService.insert('team_members', {
        id,
        team_id: teamId,
        agent_id: agentId,
        created_at: now
      });

      if (error) {
        // Handle duplicate membership
        if (error.code === 'DUPLICATE_KEY' || error.message?.includes('duplicate')) {
          throw new Error('AGENT_ALREADY_IN_TEAM');
        }
        throw error;
      }

      logger.info('Team member added', { teamId, agentId });

      // Audit log
      const team = await this.getTeamById(teamId);
      if (team) {
        await this.auditService.logAction({
          accountId: team.accountId,
          action: ACTION_TYPES.TEAM_MEMBER_ADDED,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: teamId,
          details: { agentId }
        });
      }

      return { id, teamId, agentId, createdAt: now };
    } catch (error) {
      // Handle duplicate membership
      if (error.message === 'AGENT_ALREADY_IN_TEAM') {
        throw error;
      }
      logger.error('Failed to add team member', { error: error.message, teamId, agentId });
      throw error;
    }
  }

  /**
   * Remove a member from a team
   * @param {string} teamId - Team ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<void>}
   */
  async removeMember(teamId, agentId) {
    try {
      const team = await this.getTeamById(teamId);
      
      const { error } = await SupabaseService.queryAsAdmin('team_members', (query) =>
        query.delete().eq('team_id', teamId).eq('agent_id', agentId)
      );
      
      if (error) throw error;
      logger.info('Team member removed', { teamId, agentId });

      // Audit log
      if (team) {
        await this.auditService.logAction({
          accountId: team.accountId,
          action: ACTION_TYPES.TEAM_MEMBER_REMOVED,
          resourceType: RESOURCE_TYPES.TEAM,
          resourceId: teamId,
          details: { agentId }
        });
      }
    } catch (error) {
      logger.error('Failed to remove team member', { error: error.message, teamId, agentId });
      throw error;
    }
  }

  /**
   * Get team members
   * @param {string} teamId - Team ID
   * @returns {Promise<Object[]>} List of members with agent info
   */
  async getTeamMembers(teamId) {
    try {
      // Get team members first
      const { data: members, error: membersError } = await SupabaseService.getMany('team_members', { team_id: teamId });
      
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];

      // Get agent details for each member
      const agentIds = members.map(m => m.agent_id);
      const { data: agents, error: agentsError } = await SupabaseService.queryAsAdmin('agents', (query) =>
        query.select('id, email, name, avatar_url, role, availability, status')
          .in('id', agentIds)
          .order('name', { ascending: true })
      );

      if (agentsError) throw agentsError;

      // Create a map of agent_id to joined_at
      const memberMap = new Map(members.map(m => [m.agent_id, m.created_at]));

      return (agents || []).map(agent => ({
        id: agent.id,
        email: agent.email,
        name: agent.name,
        avatarUrl: agent.avatar_url,
        role: agent.role,
        availability: agent.availability,
        status: agent.status,
        joinedAt: memberMap.get(agent.id)
      }));
    } catch (error) {
      logger.error('Failed to get team members', { error: error.message, teamId });
      throw error;
    }
  }

  /**
   * Check if an agent is a member of a team
   * @param {string} teamId - Team ID
   * @param {string} agentId - Agent ID
   * @returns {Promise<boolean>} True if member
   */
  async isMember(teamId, agentId) {
    try {
      const { data, error } = await SupabaseService.getMany('team_members', { 
        team_id: teamId, 
        agent_id: agentId 
      }, { limit: 1 });
      
      if (error) throw error;
      return data && data.length > 0;
    } catch (error) {
      logger.error('Failed to check team membership', { error: error.message, teamId, agentId });
      throw error;
    }
  }

  /**
   * Get teams for an agent
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object[]>} List of teams
   */
  async getAgentTeams(agentId) {
    try {
      // Get team memberships for this agent
      const { data: memberships, error: memberError } = await SupabaseService.getMany('team_members', { agent_id: agentId });
      
      if (memberError) throw memberError;
      if (!memberships || memberships.length === 0) return [];

      // Get team details
      const teamIds = memberships.map(m => m.team_id);
      const { data: teams, error: teamsError } = await SupabaseService.queryAsAdmin('teams', (query) =>
        query.select('*').in('id', teamIds).order('name', { ascending: true })
      );

      if (teamsError) throw teamsError;
      return (teams || []).map(row => this.formatTeam(row));
    } catch (error) {
      logger.error('Failed to get agent teams', { error: error.message, agentId });
      throw error;
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Get team statistics
   * @param {string} teamId - Team ID
   * @returns {Promise<Object>} Team statistics
   */
  async getTeamStats(teamId) {
    try {
      // Count total members
      const { count: totalMembers } = await SupabaseService.count('team_members', { team_id: teamId });

      // Get members and count online ones
      const { data: members } = await SupabaseService.getMany('team_members', { team_id: teamId });
      
      let onlineMembers = 0;
      if (members && members.length > 0) {
        const agentIds = members.map(m => m.agent_id);
        const { count } = await SupabaseService.queryAsAdmin('agents', (query) =>
          query.select('*', { count: 'exact', head: true })
            .in('id', agentIds)
            .eq('availability', 'online')
        );
        onlineMembers = count || 0;
      }

      return {
        totalMembers: totalMembers || 0,
        onlineMembers
      };
    } catch (error) {
      logger.error('Failed to get team stats', { error: error.message, teamId });
      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Format team row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted team
   */
  formatTeam(row) {
    return {
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      allowAutoAssign: row.allow_auto_assign === true || row.allow_auto_assign === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  // ==================== COUNT METHODS ====================

  /**
   * Count teams for an account
   * @param {string} accountId - Account ID
   * @returns {Promise<number>} Number of teams
   */
  async countTeams(accountId) {
    try {
      const { count, error } = await SupabaseService.count('teams', { account_id: accountId });
      if (error) throw error;
      return count || 0;
    } catch (error) {
      logger.error('Failed to count teams', { error: error.message, accountId });
      return 0;
    }
  }
}

module.exports = TeamService;
