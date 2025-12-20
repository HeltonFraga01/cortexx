/**
 * Admin Dashboard Routes
 * 
 * Endpoints for dashboard statistics and alerts.
 * All routes require admin authentication.
 * 
 * MULTI-TENANT ISOLATION: All metrics and statistics are filtered
 * by the admin's tenant to prevent cross-tenant data exposure.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

/**
 * GET /api/admin/management/dashboard/stats
 * Get dashboard statistics for the admin's tenant
 * MULTI-TENANT: All stats filtered by req.context.tenantId
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    // User statistics
    const userStats = await getUserStats(tenantId);
    
    // Usage statistics
    const usageStats = await getUsageStats(tenantId);
    
    // Revenue statistics
    const revenueStats = await getRevenueStats(tenantId);

    const stats = {
      users: userStats,
      usage: usageStats,
      revenue: revenueStats,
      tenantId,
      timestamp: new Date().toISOString()
    };

    logger.info('Dashboard stats retrieved', {
      adminId: req.session.userId,
      tenantId,
      endpoint: '/api/admin/management/dashboard/stats'
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get dashboard stats', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/management/dashboard/stats'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/management/dashboard/alerts
 * Get active alerts for the admin's tenant
 * MULTI-TENANT: All alerts filtered by req.context.tenantId
 */
router.get('/alerts', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const alerts = await getActiveAlerts(tenantId);

    logger.info('Dashboard alerts retrieved', {
      adminId: req.session.userId,
      tenantId,
      alertCount: alerts.length,
      endpoint: '/api/admin/management/dashboard/alerts'
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Failed to get dashboard alerts', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/management/dashboard/alerts'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/management/dashboard/growth
 * Get growth metrics over time for the admin's tenant
 * MULTI-TENANT: All metrics filtered by req.context.tenantId
 */
router.get('/growth', requireAdmin, async (req, res) => {
  try {
    const tenantId = req.context?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { days = 30 } = req.query;
    const growth = await getGrowthMetrics(tenantId, parseInt(days));

    logger.info('Growth metrics retrieved', {
      adminId: req.session.userId,
      tenantId,
      days,
      endpoint: '/api/admin/management/dashboard/growth'
    });

    res.json({ success: true, data: growth });
  } catch (error) {
    logger.error('Failed to get growth metrics', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/management/dashboard/growth'
    });
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for dashboard statistics - ALL TENANT-SCOPED

async function getUserStats(tenantId) {
  try {
    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;
    
    const accountIds = (accounts || []).map(a => a.id);
    
    if (accountIds.length === 0) {
      return {
        total: 0,
        active: 0,
        trial: 0,
        suspended: 0,
        byStatus: {},
        byPlan: {},
        growthLast30Days: 0
      };
    }

    // Get subscriptions for tenant accounts
    const { data: subscriptions, error: subError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select(`
        id,
        status,
        plan_id,
        created_at,
        tenant_plans (name)
      `)
      .in('account_id', accountIds);

    if (subError) throw subError;

    const byStatus = {};
    let total = 0;
    let active = 0;
    let trial = 0;
    let suspended = 0;

    for (const sub of (subscriptions || [])) {
      byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;
      total++;
      if (sub.status === 'active') active++;
      if (sub.status === 'trial') trial++;
      if (sub.status === 'suspended') suspended++;
    }

    // Users by plan
    const byPlan = {};
    for (const sub of (subscriptions || [])) {
      if (sub.tenant_plans?.name && ['active', 'trial'].includes(sub.status)) {
        byPlan[sub.tenant_plans.name] = (byPlan[sub.tenant_plans.name] || 0) + 1;
      }
    }

    // Growth last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const growthLast30Days = (subscriptions || []).filter(
      s => new Date(s.created_at) >= thirtyDaysAgo
    ).length;

    return {
      total,
      active,
      trial,
      suspended,
      byStatus,
      byPlan,
      growthLast30Days
    };
  } catch (error) {
    logger.error('Failed to get user stats', { error: error.message, tenantId });
    return {
      total: 0,
      active: 0,
      trial: 0,
      suspended: 0,
      byStatus: {},
      byPlan: {},
      growthLast30Days: 0
    };
  }
}

async function getUsageStats(tenantId) {
  try {
    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;
    
    const accountIds = (accounts || []).map(a => a.id);
    
    if (accountIds.length === 0) {
      return {
        messagesToday: 0,
        messagesThisWeek: 0,
        messagesThisMonth: 0,
        activeConnections: 0,
        totalStorageMb: 0
      };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Get quota usage for tenant accounts
    const { data: quotaUsage, error: quotaError } = await SupabaseService.adminClient
      .from('user_quota_usage')
      .select('*')
      .in('account_id', accountIds);

    if (quotaError) throw quotaError;

    let messagesToday = 0;
    let messagesThisMonth = 0;
    let totalStorageMb = 0;

    for (const usage of (quotaUsage || [])) {
      if (usage.quota_type === 'max_messages_per_day' && new Date(usage.period_start) >= todayStart) {
        messagesToday += usage.current_usage || 0;
      }
      if (usage.quota_type === 'max_messages_per_month' && new Date(usage.period_start) >= monthStart) {
        messagesThisMonth += usage.current_usage || 0;
      }
      if (usage.quota_type === 'max_storage_mb') {
        totalStorageMb += usage.current_usage || 0;
      }
    }

    // Get usage metrics for this week
    const { data: weekMetrics, error: metricsError } = await SupabaseService.adminClient
      .from('usage_metrics')
      .select('amount')
      .in('account_id', accountIds)
      .eq('metric_type', 'message_sent')
      .gte('recorded_at', weekStart.toISOString());

    const messagesThisWeek = (weekMetrics || []).reduce((sum, m) => sum + (m.amount || 0), 0);

    // Active connections
    const { data: activeSubs, error: activeError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('id')
      .in('account_id', accountIds)
      .in('status', ['active', 'trial']);

    const activeConnections = (activeSubs || []).length;

    return {
      messagesToday,
      messagesThisWeek,
      messagesThisMonth,
      activeConnections,
      totalStorageMb
    };
  } catch (error) {
    logger.error('Failed to get usage stats', { error: error.message, tenantId });
    return {
      messagesToday: 0,
      messagesThisWeek: 0,
      messagesThisMonth: 0,
      activeConnections: 0,
      totalStorageMb: 0
    };
  }
}

async function getRevenueStats(tenantId) {
  try {
    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;
    
    const accountIds = (accounts || []).map(a => a.id);
    
    if (accountIds.length === 0) {
      return {
        mrr: 0,
        arr: 0,
        churnRate: 0,
        avgRevenuePerUser: 0
      };
    }

    // Get subscriptions with plan data
    const { data: subscriptions, error: subError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select(`
        id,
        status,
        created_at,
        cancelled_at,
        tenant_plans (
          price_cents,
          billing_cycle
        )
      `)
      .in('account_id', accountIds);

    if (subError) throw subError;

    let monthlyMrr = 0;
    let yearlyMrr = 0;
    let activeCount = 0;

    for (const sub of (subscriptions || [])) {
      if (['active', 'trial'].includes(sub.status) && sub.tenant_plans) {
        activeCount++;
        if (sub.tenant_plans.billing_cycle === 'monthly') {
          monthlyMrr += sub.tenant_plans.price_cents || 0;
        } else if (sub.tenant_plans.billing_cycle === 'yearly') {
          yearlyMrr += Math.round((sub.tenant_plans.price_cents || 0) / 12);
        }
      }
    }

    const mrr = monthlyMrr + yearlyMrr;
    const arr = mrr * 12;

    // Churn rate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceled = (subscriptions || []).filter(
      s => s.status === 'cancelled' && s.cancelled_at && new Date(s.cancelled_at) >= thirtyDaysAgo
    ).length;

    const startCount = (subscriptions || []).filter(
      s => new Date(s.created_at) < thirtyDaysAgo
    ).length || 1;

    const churnRate = Math.round((canceled / startCount) * 100 * 100) / 100;

    // ARPU
    const arpu = activeCount > 0 ? Math.round(mrr / activeCount) : 0;

    return {
      mrr,
      arr,
      churnRate,
      avgRevenuePerUser: arpu
    };
  } catch (error) {
    logger.error('Failed to get revenue stats', { error: error.message, tenantId });
    return {
      mrr: 0,
      arr: 0,
      churnRate: 0,
      avgRevenuePerUser: 0
    };
  }
}

async function getActiveAlerts(tenantId) {
  try {
    const alerts = [];
    const crypto = require('crypto');

    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, owner_user_id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;
    
    const accountIds = (accounts || []).map(a => a.id);
    const accountMap = {};
    (accounts || []).forEach(a => { accountMap[a.id] = a; });
    
    if (accountIds.length === 0) {
      return [];
    }

    // Check for users near quota limits (>80%)
    const { data: quotaUsage, error: quotaError } = await SupabaseService.adminClient
      .from('user_quota_usage')
      .select('account_id, quota_type, current_usage')
      .in('account_id', accountIds)
      .gt('current_usage', 0);

    if (!quotaError) {
      // Get quota overrides
      const { data: overrides } = await SupabaseService.adminClient
        .from('user_quota_overrides')
        .select('account_id, quota_type, limit_value')
        .in('account_id', accountIds);

      const overrideMap = {};
      (overrides || []).forEach(o => {
        overrideMap[`${o.account_id}-${o.quota_type}`] = o.limit_value;
      });

      for (const usage of (quotaUsage || [])) {
        const limitValue = overrideMap[`${usage.account_id}-${usage.quota_type}`] || 100;
        const percentage = limitValue > 0 ? (usage.current_usage / limitValue) : 0;
        
        if (percentage >= 0.8) {
          const account = accountMap[usage.account_id];
          const userId = account?.owner_user_id || usage.account_id;
          
          alerts.push({
            id: crypto.randomUUID(),
            type: 'quota_warning',
            severity: percentage >= 1 ? 'error' : 'warning',
            userId,
            accountId: usage.account_id,
            message: `User ${userId.substring(0, 8)}... is at ${Math.round(percentage * 100)}% of ${usage.quota_type}`,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    // Check for suspended users
    const { data: suspendedSubs, error: suspendedError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('account_id, suspension_reason, updated_at')
      .in('account_id', accountIds)
      .eq('status', 'suspended')
      .order('updated_at', { ascending: false })
      .limit(10);

    if (!suspendedError) {
      for (const sub of (suspendedSubs || [])) {
        const account = accountMap[sub.account_id];
        const userId = account?.owner_user_id || sub.account_id;
        
        alerts.push({
          id: crypto.randomUUID(),
          type: 'user_suspended',
          severity: 'info',
          userId,
          accountId: sub.account_id,
          message: `User ${userId.substring(0, 8)}... is suspended: ${sub.suspension_reason || 'No reason provided'}`,
          createdAt: sub.updated_at
        });
      }
    }

    // Sort by severity and date
    const severityOrder = { error: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return alerts.slice(0, 50);
  } catch (error) {
    logger.error('Failed to get active alerts', { error: error.message, tenantId });
    return [];
  }
}

async function getGrowthMetrics(tenantId, days) {
  try {
    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;
    
    const accountIds = (accounts || []).map(a => a.id);
    
    if (accountIds.length === 0) {
      return [];
    }

    // Get all subscriptions for these accounts
    const { data: subscriptions, error: subError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('created_at, status, cancelled_at')
      .in('account_id', accountIds);

    if (subError) throw subError;

    const metrics = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dateEnd = new Date(dateStr + 'T23:59:59.999Z');

      const totalUsers = (subscriptions || []).filter(s => {
        const createdAt = new Date(s.created_at);
        const cancelledAt = s.cancelled_at ? new Date(s.cancelled_at) : null;
        
        return createdAt <= dateEnd && 
               (['active', 'trial'].includes(s.status) || (cancelledAt && cancelledAt > dateEnd));
      }).length;

      metrics.push({
        date: dateStr,
        totalUsers
      });
    }

    return metrics;
  } catch (error) {
    logger.error('Failed to get growth metrics', { error: error.message, tenantId });
    return [];
  }
}

module.exports = router;
