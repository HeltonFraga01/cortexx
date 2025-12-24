/**
 * DashboardMetricsService
 * 
 * Service for fetching dashboard metrics including inbox status,
 * conversation metrics, agent performance, and campaign status.
 * 
 * Requirements: 1.1, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class DashboardMetricsService {
  /**
   * Get all dashboard metrics for an account
   * @param {string} accountId - Account ID
   * @param {string[]|null} inboxIds - Optional array of inbox IDs to filter by
   * @returns {Promise<Object>} Dashboard metrics
   */
  async getDashboardMetrics(accountId, inboxIds = null) {
    try {
      const [
        inboxes,
        conversations,
        previousConversations,
        agents,
        campaigns,
        quotas,
        subscription,
        contacts
      ] = await Promise.all([
        this.getInboxStatus(accountId),
        this.getConversationMetrics(accountId, null, inboxIds),
        this.getConversationMetrics(accountId, this._getPreviousPeriod(), inboxIds),
        this.getAgentMetrics(accountId, inboxIds),
        this.getCampaignStatus(accountId),
        this.getQuotaUsage(accountId),
        this.getSubscriptionInfo(accountId),
        this.getContactStats(accountId, inboxIds)
      ]);

      return {
        inboxes,
        conversations,
        previousPeriodConversations: previousConversations,
        agents,
        campaigns,
        quotas,
        subscription,
        creditBalance: subscription?.creditBalance || 0,
        contacts,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get dashboard metrics', { accountId, error: error.message });
      throw error;
    }
  }


  /**
   * Get inbox status with unread counts
   * Requirements: 1.1, 1.2, 1.3, 1.5
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>} Inbox status list
   */
  async getInboxStatus(accountId) {
    try {
      // Get inboxes
      const { data: inboxes, error: inboxError } = await SupabaseService.queryAsAdmin(
        'inboxes',
        (query) => query
          .select('id, name, phone_number, wuzapi_connected, status, created_at')
          .eq('account_id', accountId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
      );

      if (inboxError) {
        logger.error('Failed to fetch inboxes', { accountId, error: inboxError.message });
        return [];
      }

      // Get unread counts per inbox
      const { data: unreadCounts, error: unreadError } = await SupabaseService.queryAsAdmin(
        'conversations',
        (query) => query
          .select('inbox_id, unread_count')
          .eq('account_id', accountId)
          .gt('unread_count', 0)
      );

      if (unreadError) {
        logger.warn('Failed to fetch unread counts', { accountId, error: unreadError.message });
      }

      // Aggregate unread counts by inbox
      const unreadByInbox = (unreadCounts || []).reduce((acc, conv) => {
        if (conv.inbox_id) {
          acc[conv.inbox_id] = (acc[conv.inbox_id] || 0) + conv.unread_count;
        }
        return acc;
      }, {});

      // Get last activity per inbox
      const { data: lastActivity, error: activityError } = await SupabaseService.queryAsAdmin(
        'conversations',
        (query) => query
          .select('inbox_id, last_message_at')
          .eq('account_id', accountId)
          .not('last_message_at', 'is', null)
          .order('last_message_at', { ascending: false })
      );

      const lastActivityByInbox = (lastActivity || []).reduce((acc, conv) => {
        if (conv.inbox_id && !acc[conv.inbox_id]) {
          acc[conv.inbox_id] = conv.last_message_at;
        }
        return acc;
      }, {});

      return (inboxes || []).map(inbox => ({
        id: inbox.id,
        name: inbox.name,
        phoneNumber: inbox.phone_number,
        isConnected: inbox.wuzapi_connected || false,
        unreadCount: unreadByInbox[inbox.id] || 0,
        lastActivityAt: lastActivityByInbox[inbox.id] || null
      }));
    } catch (error) {
      logger.error('Error in getInboxStatus', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Get conversation metrics
   * Requirements: 2.1, 2.2, 2.3
   * @param {string} accountId - Account ID
   * @param {Object} dateRange - Optional date range
   * @param {string[]|null} inboxIds - Optional inbox IDs to filter by
   * @returns {Promise<Object>} Conversation metrics
   */
  async getConversationMetrics(accountId, dateRange = null, inboxIds = null) {
    try {
      const { start, end } = dateRange || this._getCurrentPeriod();

      // Build base query
      let queryBuilder = (query) => {
        let q = query
          .select('id, status, created_at, updated_at, inbox_id')
          .eq('account_id', accountId)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString());
        
        // Filter by inbox IDs if provided
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        return q;
      };

      const { data: conversations, error } = await SupabaseService.queryAsAdmin(
        'conversations',
        queryBuilder
      );

      if (error) {
        logger.error('Failed to fetch conversation metrics', { accountId, error: error.message });
        return this._emptyConversationMetrics();
      }

      const convList = conversations || [];
      const openCount = convList.filter(c => c.status === 'open').length;
      const resolvedCount = convList.filter(c => c.status === 'resolved').length;
      const pendingCount = convList.filter(c => c.status === 'pending').length;

      // Calculate average response time (simplified - would need first_response_at field)
      // For now, use time between created_at and updated_at for resolved conversations
      const resolvedConvs = convList.filter(c => c.status === 'resolved' && c.updated_at);
      let avgResponseMinutes = 0;
      
      if (resolvedConvs.length > 0) {
        const totalMinutes = resolvedConvs.reduce((sum, c) => {
          const created = new Date(c.created_at);
          const updated = new Date(c.updated_at);
          return sum + (updated - created) / (1000 * 60);
        }, 0);
        avgResponseMinutes = Math.round(totalMinutes / resolvedConvs.length);
      }

      return {
        openCount,
        resolvedCount,
        pendingCount,
        averageResponseTimeMinutes: avgResponseMinutes
      };
    } catch (error) {
      logger.error('Error in getConversationMetrics', { accountId, error: error.message });
      return this._emptyConversationMetrics();
    }
  }

  /**
   * Get agent metrics
   * Requirements: 4.1, 4.2, 4.3
   * @param {string} accountId - Account ID
   * @param {string[]|null} inboxIds - Optional inbox IDs to filter by
   * @returns {Promise<Array>} Agent metrics list
   */
  async getAgentMetrics(accountId, inboxIds = null) {
    try {
      // Get agents for this account
      const { data: agents, error: agentError } = await SupabaseService.queryAsAdmin(
        'agents',
        (query) => query
          .select('id, name, avatar_url, availability_status')
          .eq('account_id', accountId)
          .eq('status', 'active')
      );

      if (agentError) {
        logger.error('Failed to fetch agents', { accountId, error: agentError.message });
        return [];
      }

      if (!agents || agents.length === 0) return [];

      const agentIds = agents.map(a => a.id);

      // Build query for assigned conversations
      const assignedQueryBuilder = (query) => {
        let q = query
          .select('assigned_agent_id')
          .eq('account_id', accountId)
          .in('assigned_agent_id', agentIds)
          .eq('status', 'open');
        
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        return q;
      };

      // Build query for resolved conversations
      const resolvedQueryBuilder = (query) => {
        let q = query
          .select('assigned_agent_id')
          .eq('account_id', accountId)
          .in('assigned_agent_id', agentIds)
          .eq('status', 'resolved');
        
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        return q;
      };

      // Get assigned conversation counts
      const { data: assignedCounts, error: assignedError } = await SupabaseService.queryAsAdmin(
        'conversations',
        assignedQueryBuilder
      );

      // Get resolved conversation counts
      const { data: resolvedCounts, error: resolvedError } = await SupabaseService.queryAsAdmin(
        'conversations',
        resolvedQueryBuilder
      );

      // Aggregate counts
      const assignedByAgent = (assignedCounts || []).reduce((acc, c) => {
        if (c.assigned_agent_id) {
          acc[c.assigned_agent_id] = (acc[c.assigned_agent_id] || 0) + 1;
        }
        return acc;
      }, {});

      const resolvedByAgent = (resolvedCounts || []).reduce((acc, c) => {
        if (c.assigned_agent_id) {
          acc[c.assigned_agent_id] = (acc[c.assigned_agent_id] || 0) + 1;
        }
        return acc;
      }, {});

      return agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        avatarUrl: agent.avatar_url,
        availability: agent.availability_status || 'offline',
        assignedConversations: assignedByAgent[agent.id] || 0,
        resolvedConversations: resolvedByAgent[agent.id] || 0
      }));
    } catch (error) {
      logger.error('Error in getAgentMetrics', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Get campaign status
   * Requirements: 5.1, 5.2, 5.3
   * @param {string} accountId - Account ID
   * @returns {Promise<Object>} Campaign status
   */
  async getCampaignStatus(accountId) {
    try {
      // Get active campaigns from bulk_campaigns table
      const { data: activeCampaigns, error: activeError } = await SupabaseService.queryAsAdmin(
        'bulk_campaigns',
        (query) => query
          .select('id, name, status, total_contacts, sent_count, failed_count, completed_at')
          .eq('account_id', accountId)
          .in('status', ['running', 'scheduled', 'paused'])
          .order('created_at', { ascending: false })
          .limit(5)
      );

      if (activeError) {
        logger.warn('Failed to fetch active campaigns', { accountId, error: activeError.message });
      }

      // Get most recent completed campaign
      const { data: recentCampaigns, error: recentError } = await SupabaseService.queryAsAdmin(
        'bulk_campaigns',
        (query) => query
          .select('id, name, status, total_contacts, sent_count, failed_count, completed_at')
          .eq('account_id', accountId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
      );

      const formatCampaign = (c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        totalContacts: c.total_contacts || 0,
        sentCount: c.sent_count || 0,
        failedCount: c.failed_count || 0,
        progress: c.total_contacts > 0 ? Math.round((c.sent_count / c.total_contacts) * 100) : 0,
        completedAt: c.completed_at
      });

      return {
        active: (activeCampaigns || []).map(formatCampaign),
        recent: recentCampaigns?.[0] ? formatCampaign(recentCampaigns[0]) : null
      };
    } catch (error) {
      logger.error('Error in getCampaignStatus', { accountId, error: error.message });
      return { active: [], recent: null };
    }
  }

  /**
   * Get quota usage for the account
   * @param {string} accountId - Account ID
   * @returns {Promise<Array>} Quota status list
   */
  async getQuotaUsage(accountId) {
    try {
      const { data: quotas, error } = await SupabaseService.queryAsAdmin(
        'user_quota_usage',
        (query) => query
          .select('quota_key, used, quota_limit')
          .eq('account_id', accountId)
      );

      if (error) {
        logger.warn('Failed to fetch quota usage', { accountId, error: error.message });
        return [];
      }

      const quotaLabels = {
        messages: 'Mensagens',
        inboxes: 'Caixas de Entrada',
        agents: 'Agentes',
        campaigns: 'Campanhas',
        contacts: 'Contatos'
      };

      return (quotas || []).map(q => {
        const percentage = q.quota_limit > 0 ? Math.round((q.used / q.quota_limit) * 100) : 0;
        let status = 'normal';
        if (percentage >= 95) status = 'danger';
        else if (percentage >= 80) status = 'warning';

        return {
          key: q.quota_key,
          label: quotaLabels[q.quota_key] || q.quota_key,
          used: q.used,
          limit: q.quota_limit,
          percentage,
          status
        };
      });
    } catch (error) {
      logger.error('Error in getQuotaUsage', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Get subscription info for the account
   * @param {string} accountId - Account ID
   * @returns {Promise<Object|null>} Subscription info
   */
  async getSubscriptionInfo(accountId) {
    try {
      const { data: subscription, error } = await SupabaseService.queryAsAdmin(
        'user_subscriptions',
        (query) => query
          .select('plan_name, renewal_date, status, credit_balance')
          .eq('account_id', accountId)
          .single()
      );

      if (error || !subscription) {
        return null;
      }

      return {
        planName: subscription.plan_name,
        renewalDate: subscription.renewal_date,
        status: subscription.status,
        creditBalance: subscription.credit_balance || 0
      };
    } catch (error) {
      logger.error('Error in getSubscriptionInfo', { accountId, error: error.message });
      return null;
    }
  }

  /**
   * Get contact statistics
   * @param {string} accountId - Account ID
   * @param {string[]|null} inboxIds - Optional inbox IDs to filter by
   * @returns {Promise<Object>} Contact stats
   */
  async getContactStats(accountId, inboxIds = null) {
    try {
      // Build query builder for contacts
      const buildContactQuery = (query, additionalFilters = {}) => {
        let q = query
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId);
        
        // Filter by inbox IDs if provided
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        
        // Apply additional filters
        if (additionalFilters.gte) {
          q = q.gte('created_at', additionalFilters.gte);
        }
        if (additionalFilters.lt) {
          q = q.lt('created_at', additionalFilters.lt);
        }
        
        return q;
      };

      // Get total contacts
      const { count: totalContacts, error: countError } = await SupabaseService.queryAsAdmin(
        'contacts',
        (query) => buildContactQuery(query)
      );

      if (countError) {
        logger.warn('Failed to count contacts', { accountId, error: countError.message });
      }

      // Get contacts from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentContacts, error: recentError } = await SupabaseService.queryAsAdmin(
        'contacts',
        (query) => buildContactQuery(query, { gte: thirtyDaysAgo.toISOString() })
      );

      // Get contacts from previous 30 days (30-60 days ago)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const { count: previousContacts, error: prevError } = await SupabaseService.queryAsAdmin(
        'contacts',
        (query) => buildContactQuery(query, { 
          gte: sixtyDaysAgo.toISOString(), 
          lt: thirtyDaysAgo.toISOString() 
        })
      );

      const recent = recentContacts || 0;
      const previous = previousContacts || 0;
      const growthPercentage = previous > 0 
        ? Math.round(((recent - previous) / previous) * 100) 
        : (recent > 0 ? 100 : 0);

      return {
        total: totalContacts || 0,
        growthPercentage
      };
    } catch (error) {
      logger.error('Error in getContactStats', { accountId, error: error.message });
      return { total: 0, growthPercentage: 0 };
    }
  }

  /**
   * Get message activity data for charts
   * @param {string} accountId - Account ID
   * @param {number} days - Number of days to fetch
   * @param {string[]|null} inboxIds - Optional inbox IDs to filter by
   * @returns {Promise<Array>} Message activity data
   */
  async getMessageActivity(accountId, days = 7, inboxIds = null) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get all conversation IDs for this account (optionally filtered by inbox)
      const convQueryBuilder = (query) => {
        let q = query
          .select('id')
          .eq('account_id', accountId);
        
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        return q;
      };

      const { data: convs } = await SupabaseService.queryAsAdmin(
        'conversations',
        convQueryBuilder
      );
      
      const validConversationIds = new Set((convs || []).map(c => c.id));

      // Get messages with conversation info
      const { data: messages, error } = await SupabaseService.queryAsAdmin(
        'chat_messages',
        (query) => query
          .select('direction, timestamp, conversation_id')
          .gte('timestamp', startDate.toISOString())
      );

      if (error) {
        logger.error('Failed to fetch message activity', { accountId, error: error.message });
        return [];
      }

      // Initialize all dates
      const activityByDate = {};
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        activityByDate[dateStr] = { date: dateStr, incoming: 0, outgoing: 0 };
      }

      // Filter messages by valid conversations and aggregate by date
      (messages || []).forEach(msg => {
        if (!validConversationIds.has(msg.conversation_id)) return;
        
        const dateStr = new Date(msg.timestamp).toISOString().split('T')[0];
        if (activityByDate[dateStr]) {
          if (msg.direction === 'incoming') {
            activityByDate[dateStr].incoming++;
          } else if (msg.direction === 'outgoing') {
            activityByDate[dateStr].outgoing++;
          }
        }
      });

      return Object.values(activityByDate).sort((a, b) => a.date.localeCompare(b.date));
    } catch (error) {
      logger.error('Error in getMessageActivity', { accountId, error: error.message });
      return [];
    }
  }

  /**
   * Get contact growth data for charts
   * @param {string} accountId - Account ID
   * @param {number} days - Number of days to fetch
   * @param {string[]|null} inboxIds - Optional inbox IDs to filter by
   * @returns {Promise<Array>} Contact growth data
   */
  async getContactGrowth(accountId, days = 30, inboxIds = null) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const queryBuilder = (query) => {
        let q = query
          .select('created_at')
          .eq('account_id', accountId)
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true });
        
        if (inboxIds && inboxIds.length > 0) {
          q = q.in('inbox_id', inboxIds);
        }
        return q;
      };

      const { data: contacts, error } = await SupabaseService.queryAsAdmin(
        'contacts',
        queryBuilder
      );

      if (error) {
        logger.error('Failed to fetch contact growth', { accountId, error: error.message });
        return [];
      }

      // Initialize all dates
      const growthByDate = {};
      for (let i = days; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        growthByDate[dateStr] = { date: dateStr, newContacts: 0, cumulative: 0 };
      }

      // Count new contacts per day
      (contacts || []).forEach(contact => {
        const dateStr = new Date(contact.created_at).toISOString().split('T')[0];
        if (growthByDate[dateStr]) {
          growthByDate[dateStr].newContacts++;
        }
      });

      // Calculate cumulative
      const result = Object.values(growthByDate).sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0;
      result.forEach(day => {
        cumulative += day.newContacts;
        day.cumulative = cumulative;
      });

      return result;
    } catch (error) {
      logger.error('Error in getContactGrowth', { accountId, error: error.message });
      return [];
    }
  }

  // Helper methods

  _getCurrentPeriod() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return { start, end };
  }

  _getPreviousPeriod() {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date();
    start.setDate(start.getDate() - 14);
    return { start, end };
  }

  _emptyConversationMetrics() {
    return {
      openCount: 0,
      resolvedCount: 0,
      pendingCount: 0,
      averageResponseTimeMinutes: 0
    };
  }
}

module.exports = new DashboardMetricsService();
