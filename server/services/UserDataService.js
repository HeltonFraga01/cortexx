/**
 * UserDataService
 * 
 * Encapsulates user-specific data operations that were previously in database.js
 * This service handles:
 * - Message history and statistics
 * - Message templates
 * - Scheduled single messages
 * - User database connections access
 * 
 * All operations use SupabaseService directly instead of the compatibility layer.
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class UserDataService {
  constructor() {
    // Cache for user validation (simple in-memory cache)
    this.userValidationCache = new Map();
    
    // Timer for automatic cache cleanup (every 10 minutes)
    if (process.env.NODE_ENV !== 'test') {
      this.cacheCleanupTimer = setInterval(() => {
        this.clearUserValidationCache();
      }, 600000); // 10 minutes
    }
  }

  /**
   * Clear user validation cache
   */
  clearUserValidationCache() {
    const now = Date.now();
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, value] of this.userValidationCache.entries()) {
      if (now - value.timestamp > CACHE_TTL) {
        this.userValidationCache.delete(key);
      }
    }
    
    logger.debug('User validation cache cleaned', { 
      remainingEntries: this.userValidationCache.size 
    });
  }

  // ==================== ACCOUNT ID RESOLUTION ====================

  /**
   * Get account ID from WUZAPI token (supports both inbox and account tokens)
   * @param {string} userToken - WUZAPI token (can be from inbox or account)
   * @returns {Promise<string|null>} Account UUID or null
   */
  async getAccountIdFromToken(userToken) {
    try {
      // Check if userToken is already a UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(userToken)) {
        return userToken;
      }

      // First, try to look up inbox by wuzapi_token (new multi-inbox system)
      const { data: inboxData, error: inboxError } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('account_id').eq('wuzapi_token', userToken).single()
      );

      if (!inboxError && inboxData?.account_id) {
        return inboxData.account_id;
      }

      // Fallback: Look up account by wuzapi_token (legacy single-account system)
      const { data, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
        query.select('id').eq('wuzapi_token', userToken).single()
      );

      if (error || !data) {
        logger.warn('Account not found for token', { token: userToken?.substring(0, 10) });
        return null;
      }

      return data.id;
    } catch (error) {
      logger.error('Failed to get account ID from token', { error: error.message });
      return null;
    }
  }

  // ==================== MESSAGE HISTORY ====================

  /**
   * Get message history for a user
   * @param {string} userToken - User's WUZAPI token
   * @param {number} limit - Maximum number of messages to return
   * @param {number} offset - Offset for pagination
   * @returns {Promise<Array>} Array of messages
   */
  async getMessageHistory(userToken, limit = 50, offset = 0) {
    try {
      const accountId = await this.getAccountIdFromToken(userToken);

      if (!accountId) {
        logger.warn('Account not found for user token in getMessageHistory', { 
          token: userToken.substring(0, 8) + '...' 
        });
        return [];
      }

      const { data, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
        query
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
      );

      if (error) {
        logger.error('Error fetching message history', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getMessageHistory', { error: error.message });
      return [];
    }
  }

  /**
   * Get message count for a user
   * @param {string} userToken - User's WUZAPI token
   * @param {string} period - Period filter: 'all', 'today', 'week', 'month'
   * @returns {Promise<number>} Message count
   */
  async getMessageCount(userToken, period = 'all') {
    try {
      const accountId = await this.getAccountIdFromToken(userToken);

      if (!accountId) {
        logger.warn('Account not found for user token in getMessageCount', { 
          token: userToken.substring(0, 8) + '...' 
        });
        return 0;
      }

      let dateFilter = null;
      const now = new Date();
      
      switch (period) {
        case 'today':
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          dateFilter = today.toISOString();
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateFilter = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          dateFilter = monthAgo.toISOString();
          break;
        case 'all':
        default:
          dateFilter = null;
      }

      const { count, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) => {
        let q = query
          .select('*', { count: 'exact', head: true })
          .eq('account_id', accountId);
        
        if (dateFilter) {
          q = q.gte('created_at', dateFilter);
        }
        
        return q;
      });

      if (error) {
        logger.error('Error counting messages', { error: error.message, period });
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.error('Error in getMessageCount', { error: error.message });
      return 0;
    }
  }

  /**
   * Delete messages from user's message history
   * @param {string} userToken - User's WUZAPI token
   * @param {Array<string>} messageIds - Array of message IDs to delete (optional)
   * @returns {Promise<number>} Number of deleted messages
   */
  async deleteMessages(userToken, messageIds = null) {
    try {
      const accountId = await this.getAccountIdFromToken(userToken);

      if (!accountId) {
        throw new Error('Account not found for the provided token');
      }

      if (messageIds && messageIds.length > 0) {
        // Delete specific messages
        const { error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
          query
            .delete()
            .eq('account_id', accountId)
            .in('id', messageIds)
        );

        if (error) {
          logger.error('Error deleting specific messages', { 
            error: error.message, 
            accountId,
            messageCount: messageIds.length
          });
          throw new Error(`Failed to delete messages: ${error.message}`);
        }

        logger.info('Specific messages deleted', { 
          deletedCount: messageIds.length,
          accountId
        });
        
        return messageIds.length;
      } else {
        // Get count before deleting all
        const { count: totalCount } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
          query
            .select('*', { count: 'exact', head: true })
            .eq('account_id', accountId)
        );

        // Delete all messages for the user
        const { error } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
          query
            .delete()
            .eq('account_id', accountId)
        );

        if (error) {
          logger.error('Error deleting all messages', { 
            error: error.message, 
            accountId
          });
          throw new Error(`Failed to delete all messages: ${error.message}`);
        }

        logger.info('All messages deleted for user', { 
          deletedCount: totalCount || 0,
          accountId
        });
        
        return totalCount || 0;
      }
    } catch (error) {
      logger.error('Error in deleteMessages', { 
        error: error.message,
        userToken: userToken?.substring(0, 8) + '...'
      });
      throw error;
    }
  }

  /**
   * Get message statistics for a user
   * @param {string} userToken - User's WUZAPI token
   * @param {string} period - Period filter: 'all', 'today', 'week', 'month'
   * @returns {Promise<Object>} Statistics object
   */
  async getMessageStats(userToken, period = 'all') {
    try {
      const accountId = await this.getAccountIdFromToken(userToken);

      if (!accountId) {
        return {
          summary: { total: 0, sent: 0, failed: 0, successRate: 0, textMessages: 0, mediaMessages: 0, scheduled: 0 },
          daily: [],
          period
        };
      }

      // Build date filter
      let dateFilter = null;
      const now = new Date();
      
      switch (period) {
        case 'today':
          const today = new Date(now);
          today.setHours(0, 0, 0, 0);
          dateFilter = today.toISOString();
          break;
        case 'week':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          dateFilter = weekAgo.toISOString();
          break;
        case 'month':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          dateFilter = monthAgo.toISOString();
          break;
      }

      // Get all messages for the period to calculate stats
      const { data: messages, error } = await SupabaseService.queryAsAdmin('sent_messages', (query) => {
        let q = query
          .select('status, message_type, created_at')
          .eq('account_id', accountId);
        
        if (dateFilter) {
          q = q.gte('created_at', dateFilter);
        }
        
        return q;
      });

      if (error) {
        logger.error('Error fetching message stats', { error: error.message });
        throw error;
      }

      // Calculate summary stats
      const total = messages?.length || 0;
      const sent = messages?.filter(m => m.status === 'sent').length || 0;
      const failed = messages?.filter(m => m.status === 'failed').length || 0;
      const textMessages = messages?.filter(m => m.message_type === 'text').length || 0;
      const mediaMessages = messages?.filter(m => m.message_type === 'media').length || 0;

      // Get scheduled messages count
      const { count: scheduledCount } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) =>
        query
          .select('*', { count: 'exact', head: true })
          .eq('user_token', userToken)
          .eq('status', 'pending')
      );

      // Calculate daily stats (last 7 days)
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: recentMessages } = await SupabaseService.queryAsAdmin('sent_messages', (query) =>
        query
          .select('status, created_at')
          .eq('account_id', accountId)
          .gte('created_at', sevenDaysAgo.toISOString())
      );

      // Group by date
      const dailyMap = new Map();
      (recentMessages || []).forEach(msg => {
        const date = msg.created_at.split('T')[0];
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, count: 0, sent: 0, failed: 0 });
        }
        const day = dailyMap.get(date);
        day.count++;
        if (msg.status === 'sent') day.sent++;
        if (msg.status === 'failed') day.failed++;
      });

      const dailyStats = Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date));

      return {
        summary: {
          total,
          sent,
          failed,
          successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : 0,
          textMessages,
          mediaMessages,
          scheduled: scheduledCount || 0
        },
        daily: dailyStats,
        period
      };
    } catch (error) {
      logger.error('Error in getMessageStats', { error: error.message });
      throw error;
    }
  }


  // ==================== MESSAGE TEMPLATES ====================

  /**
   * Get templates for a user
   * @param {string} userToken - User's WUZAPI token
   * @returns {Promise<Array>} Array of templates
   */
  async getTemplates(userToken) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('message_templates', (query) =>
        query
          .select('id, name, content, has_variations, created_at, updated_at')
          .eq('user_token', userToken)
          .order('name', { ascending: true })
      );

      if (error) {
        logger.error('Error fetching templates', { error: error.message });
        return [];
      }

      return (data || []).map(row => ({
        ...row,
        hasVariations: row.has_variations === true || row.has_variations === 1
      }));
    } catch (error) {
      logger.error('Error in getTemplates', { error: error.message });
      return [];
    }
  }

  /**
   * Create a new template
   * @param {string} userToken - User's WUZAPI token
   * @param {string} name - Template name
   * @param {string} content - Template content
   * @param {boolean} hasVariations - Whether template has variations
   * @returns {Promise<number>} Created template ID
   */
  async createTemplate(userToken, name, content, hasVariations = false) {
    try {
      const { data, error } = await SupabaseService.insert('message_templates', {
        user_token: userToken,
        name,
        content,
        has_variations: hasVariations
      });

      if (error) {
        logger.error('Error creating template', { error: error.message });
        throw error;
      }

      logger.info('Template created', { id: data.id, name, hasVariations });
      return data.id;
    } catch (error) {
      logger.error('Error in createTemplate', { error: error.message });
      throw error;
    }
  }

  /**
   * Update a template
   * @param {string} userToken - User's WUZAPI token
   * @param {number} templateId - Template ID
   * @param {string} name - Template name
   * @param {string} content - Template content
   * @param {boolean} hasVariations - Whether template has variations
   * @returns {Promise<boolean>} Success status
   */
  async updateTemplate(userToken, templateId, name, content, hasVariations = false) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('message_templates', (query) =>
        query
          .update({
            name,
            content,
            has_variations: hasVariations,
            updated_at: new Date().toISOString()
          })
          .eq('id', templateId)
          .eq('user_token', userToken)
          .select()
      );

      if (error) {
        logger.error('Error updating template', { error: error.message });
        throw error;
      }

      const success = data && data.length > 0;
      if (success) {
        logger.info('Template updated', { id: templateId, name, hasVariations });
      }
      return success;
    } catch (error) {
      logger.error('Error in updateTemplate', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a template
   * @param {string} userToken - User's WUZAPI token
   * @param {number} templateId - Template ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteTemplate(userToken, templateId) {
    try {
      // First check if template exists and belongs to user
      const { data: existing } = await SupabaseService.queryAsAdmin('message_templates', (query) =>
        query
          .select('id')
          .eq('id', templateId)
          .eq('user_token', userToken)
          .single()
      );

      if (!existing) {
        return false;
      }

      const { error } = await SupabaseService.queryAsAdmin('message_templates', (query) =>
        query
          .delete()
          .eq('id', templateId)
          .eq('user_token', userToken)
      );

      if (error) {
        logger.error('Error deleting template', { error: error.message });
        throw error;
      }

      logger.info('Template deleted', { id: templateId });
      return true;
    } catch (error) {
      logger.error('Error in deleteTemplate', { error: error.message });
      throw error;
    }
  }

  // ==================== SCHEDULED SINGLE MESSAGES ====================

  /**
   * Get scheduled single messages for a user
   * @param {string} userToken - User's WUZAPI token
   * @param {string} instance - Optional instance filter
   * @returns {Promise<Array>} Array of scheduled messages
   */
  async getScheduledSingleMessages(userToken, instance = null) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) => {
        let q = query
          .select('*')
          .eq('user_token', userToken)
          .eq('status', 'pending')
          .order('scheduled_at', { ascending: true });
        
        if (instance) {
          q = q.eq('instance', instance);
        }
        
        return q;
      });

      if (error) {
        logger.error('Error fetching scheduled messages', { error: error.message });
        return [];
      }

      return data || [];
    } catch (error) {
      logger.error('Error in getScheduledSingleMessages', { error: error.message });
      return [];
    }
  }

  /**
   * Cancel a scheduled single message
   * @param {string} messageId - Message ID
   * @param {string} userToken - User's WUZAPI token
   * @returns {Promise<boolean>} Success status
   */
  async cancelScheduledSingleMessage(messageId, userToken) {
    try {
      const { data, error } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) =>
        query
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString()
          })
          .eq('id', messageId)
          .eq('user_token', userToken)
          .eq('status', 'pending')
          .select()
      );

      if (error) {
        logger.error('Error cancelling scheduled message', { error: error.message });
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('Mensagem não encontrada ou já foi processada');
      }

      logger.info('Scheduled message cancelled', { messageId });
      return true;
    } catch (error) {
      logger.error('Error in cancelScheduledSingleMessage', { error: error.message });
      throw error;
    }
  }

  // ==================== DATABASE CONNECTIONS ====================

  /**
   * Get database connections assigned to a user
   * @param {string} userId - User ID (hash)
   * @returns {Promise<Array>} Array of connections
   */
  async getUserConnections(userId) {
    try {
      const { data, error } = await SupabaseService.getMany('database_connections', {});
      
      if (error) {
        logger.error('Error fetching database connections', { error: error.message });
        return [];
      }

      if (!data) return [];

      // Filter connections where userId is in assigned_users array
      return data.filter(conn => {
        if (!conn.assigned_users) return false;
        
        if (Array.isArray(conn.assigned_users)) {
          return conn.assigned_users.includes(userId);
        }
        
        // Handle case where it might be a JSON string
        if (typeof conn.assigned_users === 'string') {
          try {
            const users = JSON.parse(conn.assigned_users);
            return Array.isArray(users) && users.includes(userId);
          } catch (e) {
            return false;
          }
        }

        return false;
      });
    } catch (error) {
      logger.error('Error in getUserConnections', { error: error.message });
      return [];
    }
  }

  /**
   * Get a connection by ID
   * @param {number} id - Connection ID
   * @returns {Promise<Object|null>} Connection object or null
   */
  async getConnectionById(id) {
    const { data, error } = await SupabaseService.getById('database_connections', id);
    if (error) {
      logger.error('Error fetching connection by ID', { error: error.message, id });
      return null;
    }
    return data;
  }

  /**
   * Validate if user has access to a connection
   * @param {string} userId - User ID
   * @param {Object} connection - Connection object
   * @returns {boolean} Whether user has access
   */
  validateUserConnectionAccess(userId, connection) {
    if (!connection || !userId) return false;
    
    const assignedUsers = connection.assigned_users;
    
    if (!assignedUsers) return false;
    
    if (Array.isArray(assignedUsers)) {
      return assignedUsers.includes(userId);
    }
    
    if (typeof assignedUsers === 'string') {
      try {
        const users = JSON.parse(assignedUsers);
        return Array.isArray(users) && users.includes(userId);
      } catch (e) {
        return false;
      }
    }
    
    return false;
  }

  /**
   * Validate user token and get user ID
   * @param {string} userToken - User's WUZAPI token
   * @returns {Promise<string>} User ID
   */
  async validateUserAndGetId(userToken) {
    try {
      // Check cache first
      const cacheKey = `user_${userToken}`;
      const now = Date.now();
      const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

      const cached = this.userValidationCache.get(cacheKey);
      if (cached && (now - cached.timestamp) < CACHE_TTL) {
        logger.debug('User validated via cache', { userId: cached.userId });
        return cached.userId;
      }

      // Try to get account ID from token
      const accountId = await this.getAccountIdFromToken(userToken);
      
      if (accountId) {
        // Cache the result
        this.userValidationCache.set(cacheKey, {
          userId: accountId,
          timestamp: now
        });
        
        // Limit cache size
        if (this.userValidationCache.size > 100) {
          const oldestKey = this.userValidationCache.keys().next().value;
          this.userValidationCache.delete(oldestKey);
        }
        
        return accountId;
      }

      // Fallback: validate via WUZAPI
      const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
      const axios = require('axios');

      const response = await axios.get(`${wuzapiBaseUrl}/session/status`, {
        headers: {
          'token': userToken,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      if (response.data?.success) {
        // Use token as user ID if we can't get account ID
        const userId = userToken;
        
        this.userValidationCache.set(cacheKey, {
          userId,
          timestamp: now
        });
        
        return userId;
      }

      throw new Error('Invalid or expired token');
    } catch (error) {
      logger.error('Error validating user token', { error: error.message });
      throw new Error('Invalid or expired token');
    }
  }
}

// Export singleton instance
module.exports = new UserDataService();
