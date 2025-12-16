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

class TeamService {
  constructor(db, auditService = null) {
    this.db = db;
    this.auditService = auditService || new MultiUserAuditService(db);
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

      const sql = `
        INSERT INTO teams (id, account_id, name, description, allow_auto_assign, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      await this.db.query(sql, [
        id,
        accountId,
        data.name,
        data.description || null,
        data.allowAutoAssign !== false ? 1 : 0,
        now,
        now
      ]);

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
      const sql = 'SELECT * FROM teams WHERE id = ?';
      const result = await this.db.query(sql, [teamId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.formatTeam(result.rows[0]);
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
      const sql = 'SELECT * FROM teams WHERE account_id = ? ORDER BY name';
      const result = await this.db.query(sql, [accountId]);
      return result.rows.map(row => this.formatTeam(row));
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
      const sql = `
        SELECT t.*, COUNT(tm.agent_id) as member_count
        FROM teams t
        LEFT JOIN team_members tm ON t.id = tm.team_id
        WHERE t.account_id = ?
        GROUP BY t.id
        ORDER BY t.name
      `;
      const result = await this.db.query(sql, [accountId]);
      return result.rows.map(row => ({
        ...this.formatTeam(row),
        memberCount: row.member_count || 0
      }));
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
      const updates = [];
      const params = [];

      if (data.name !== undefined) {
        updates.push('name = ?');
        params.push(data.name);
      }

      if (data.description !== undefined) {
        updates.push('description = ?');
        params.push(data.description);
      }

      if (data.allowAutoAssign !== undefined) {
        updates.push('allow_auto_assign = ?');
        params.push(data.allowAutoAssign ? 1 : 0);
      }

      if (updates.length === 0) {
        return this.getTeamById(teamId);
      }

      updates.push('updated_at = ?');
      params.push(new Date().toISOString());
      params.push(teamId);

      const sql = `UPDATE teams SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.query(sql, params);

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
      await this.db.query('DELETE FROM teams WHERE id = ?', [teamId]);
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

      const sql = `
        INSERT INTO team_members (id, team_id, agent_id, created_at)
        VALUES (?, ?, ?, ?)
      `;

      await this.db.query(sql, [id, teamId, agentId, now]);

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
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('AGENT_ALREADY_IN_TEAM');
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
      const sql = 'DELETE FROM team_members WHERE team_id = ? AND agent_id = ?';
      await this.db.query(sql, [teamId, agentId]);
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
      const sql = `
        SELECT a.id, a.email, a.name, a.avatar_url, a.role, a.availability, a.status, tm.created_at as joined_at
        FROM team_members tm
        JOIN agents a ON tm.agent_id = a.id
        WHERE tm.team_id = ?
        ORDER BY a.name
      `;
      const result = await this.db.query(sql, [teamId]);
      return result.rows.map(row => ({
        id: row.id,
        email: row.email,
        name: row.name,
        avatarUrl: row.avatar_url,
        role: row.role,
        availability: row.availability,
        status: row.status,
        joinedAt: row.joined_at
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
      const sql = 'SELECT 1 FROM team_members WHERE team_id = ? AND agent_id = ?';
      const result = await this.db.query(sql, [teamId, agentId]);
      return result.rows.length > 0;
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
      const sql = `
        SELECT t.*
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.agent_id = ?
        ORDER BY t.name
      `;
      const result = await this.db.query(sql, [agentId]);
      return result.rows.map(row => this.formatTeam(row));
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
      const memberResult = await this.db.query(
        'SELECT COUNT(*) as count FROM team_members WHERE team_id = ?',
        [teamId]
      );

      const onlineResult = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM team_members tm
        JOIN agents a ON tm.agent_id = a.id
        WHERE tm.team_id = ? AND a.availability = 'online'
      `, [teamId]);

      return {
        totalMembers: memberResult.rows[0]?.count || 0,
        onlineMembers: onlineResult.rows[0]?.count || 0
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
      allowAutoAssign: row.allow_auto_assign === 1,
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
      const result = await this.db.query(
        'SELECT COUNT(*) as count FROM teams WHERE account_id = ?',
        [accountId]
      );
      return result.rows[0]?.count || 0;
    } catch (error) {
      logger.error('Failed to count teams', { error: error.message, accountId });
      return 0;
    }
  }
}

module.exports = TeamService;
