/**
 * Admin Report Routes
 * 
 * Endpoints for generating administrative reports: usage, revenue, growth.
 * All routes require admin authentication and tenant context.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 * Multi-Tenant Isolation: REQ-11
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

const router = express.Router();

/**
 * Validate tenant context is present
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID or null if missing
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * GET /api/admin/reports/usage
 * Generate usage report with metrics by user, plan, and period (tenant-scoped)
 */
router.get('/usage', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, owner_user_id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;

    const accountIds = accounts?.map(a => a.id) || [];
    const userIds = accounts?.map(a => a.owner_user_id).filter(Boolean) || [];

    if (accountIds.length === 0) {
      return res.json({
        success: true,
        data: {
          period: { start: start.toISOString(), end: end.toISOString(), groupBy },
          totals: [],
          byPeriod: [],
          byUser: [],
          byPlan: [],
          generatedAt: new Date().toISOString()
        }
      });
    }

    // Get usage metrics for tenant users
    const { data: usageMetrics, error: usageError } = await SupabaseService.adminClient
      .from('usage_metrics')
      .select('*')
      .in('user_id', userIds)
      .gte('recorded_at', start.toISOString())
      .lte('recorded_at', end.toISOString())
      .order('recorded_at', { ascending: false });

    if (usageError) throw usageError;

    // Aggregate metrics
    const totals = {};
    const byPeriod = {};
    const byUser = {};

    (usageMetrics || []).forEach(metric => {
      // Totals by metric type
      if (!totals[metric.metric_type]) {
        totals[metric.metric_type] = { total: 0, uniqueUsers: new Set() };
      }
      totals[metric.metric_type].total += metric.amount || 0;
      totals[metric.metric_type].uniqueUsers.add(metric.user_id);

      // By period
      const periodKey = metric.recorded_at.substring(0, 10); // YYYY-MM-DD
      if (!byPeriod[periodKey]) {
        byPeriod[periodKey] = {};
      }
      if (!byPeriod[periodKey][metric.metric_type]) {
        byPeriod[periodKey][metric.metric_type] = { total: 0, uniqueUsers: new Set() };
      }
      byPeriod[periodKey][metric.metric_type].total += metric.amount || 0;
      byPeriod[periodKey][metric.metric_type].uniqueUsers.add(metric.user_id);

      // By user
      if (!byUser[metric.user_id]) {
        byUser[metric.user_id] = {};
      }
      if (!byUser[metric.user_id][metric.metric_type]) {
        byUser[metric.user_id][metric.metric_type] = 0;
      }
      byUser[metric.user_id][metric.metric_type] += metric.amount || 0;
    });

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy
      },
      totals: Object.entries(totals).map(([metricType, data]) => ({
        metricType,
        total: data.total,
        uniqueUsers: data.uniqueUsers.size,
        average: data.uniqueUsers.size > 0 ? Math.round((data.total / data.uniqueUsers.size) * 100) / 100 : 0
      })),
      byPeriod: Object.entries(byPeriod).flatMap(([period, metrics]) =>
        Object.entries(metrics).map(([metricType, data]) => ({
          period,
          metricType,
          totalAmount: data.total,
          uniqueUsers: data.uniqueUsers.size
        }))
      ).sort((a, b) => b.period.localeCompare(a.period)),
      byUser: Object.entries(byUser).flatMap(([userId, metrics]) =>
        Object.entries(metrics).map(([metricType, total]) => ({
          userId,
          metricType,
          totalAmount: total
        }))
      ).sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 100),
      byPlan: [], // Would need subscription join
      generatedAt: new Date().toISOString()
    };

    logger.info('Usage report generated', {
      adminId: req.session.userId,
      tenantId,
      period: { start, end, groupBy },
      endpoint: '/api/admin/reports/usage'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate usage report', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/reports/usage'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/reports/revenue
 * Generate revenue report with MRR, ARR, churn, LTV (tenant-scoped)
 */
router.get('/revenue', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;

    const accountIds = accounts?.map(a => a.id) || [];

    if (accountIds.length === 0) {
      return res.json({
        success: true,
        data: {
          period: { start: start.toISOString(), end: end.toISOString() },
          metrics: { mrr: 0, arr: 0, churnRate: 0, arpu: 0, ltv: 0, totalActiveSubscribers: 0, totalChurnedInPeriod: 0 },
          revenueByPlan: [],
          churnByMonth: [],
          subscriptionsByStatus: {},
          generatedAt: new Date().toISOString()
        }
      });
    }

    // Get active subscriptions with plan prices for this tenant
    const { data: subscriptions, error: subsError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select(`
        *,
        tenant_plans (
          id,
          name,
          price_cents,
          billing_cycle
        )
      `)
      .in('account_id', accountIds);

    if (subsError) throw subsError;

    // Calculate MRR
    let mrr = 0;
    const revenueByPlan = {};
    const statusCounts = {};
    let totalActive = 0;
    let totalChurned = 0;

    (subscriptions || []).forEach(sub => {
      // Count by status
      statusCounts[sub.status] = (statusCounts[sub.status] || 0) + 1;

      if (['active', 'trial'].includes(sub.status) && sub.tenant_plans) {
        totalActive++;
        const plan = sub.tenant_plans;
        let monthlyRevenue = plan.price_cents || 0;
        
        if (plan.billing_cycle === 'yearly') {
          monthlyRevenue = Math.round(monthlyRevenue / 12);
        }

        mrr += monthlyRevenue;

        if (!revenueByPlan[plan.id]) {
          revenueByPlan[plan.id] = {
            planId: plan.id,
            planName: plan.name,
            priceCents: plan.price_cents,
            billingCycle: plan.billing_cycle,
            subscriberCount: 0,
            monthlyRevenue: 0
          };
        }
        revenueByPlan[plan.id].subscriberCount++;
        revenueByPlan[plan.id].monthlyRevenue += monthlyRevenue;
      }

      // Count churned in period
      if (sub.status === 'cancelled' && sub.cancelled_at) {
        const cancelDate = new Date(sub.cancelled_at);
        if (cancelDate >= start && cancelDate <= end) {
          totalChurned++;
        }
      }
    });

    const arr = mrr * 12;
    const arpu = totalActive > 0 ? Math.round(mrr / totalActive) : 0;
    const monthsInPeriod = Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
    const avgMonthlyChurn = totalChurned / monthsInPeriod;
    const churnRate = totalActive > 0 ? (avgMonthlyChurn / totalActive) * 100 : 0;
    const ltv = churnRate > 0 ? Math.round((arpu / (churnRate / 100)) * 100) / 100 : 0;

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      metrics: {
        mrr,
        arr,
        churnRate: Math.round(churnRate * 100) / 100,
        arpu,
        ltv,
        totalActiveSubscribers: totalActive,
        totalChurnedInPeriod: totalChurned
      },
      revenueByPlan: Object.values(revenueByPlan),
      churnByMonth: [],
      subscriptionsByStatus: statusCounts,
      generatedAt: new Date().toISOString()
    };

    logger.info('Revenue report generated', {
      adminId: req.session.userId,
      tenantId,
      mrr,
      arr,
      endpoint: '/api/admin/reports/revenue'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate revenue report', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/reports/revenue'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/reports/growth
 * Generate growth report with new users, churned users (tenant-scoped)
 */
router.get('/growth', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, created_at')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;

    const accountIds = accounts?.map(a => a.id) || [];

    // Get subscriptions for tenant accounts
    const { data: subscriptions, error: subsError } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('*')
      .in('account_id', accountIds);

    if (subsError) throw subsError;

    // Aggregate by period
    const newUsersByPeriod = {};
    const churnedByPeriod = {};
    let totalNew = 0;
    let totalChurned = 0;

    (subscriptions || []).forEach(sub => {
      // New subscriptions
      if (sub.created_at) {
        const createdDate = new Date(sub.created_at);
        if (createdDate >= start && createdDate <= end) {
          const period = sub.created_at.substring(0, 10);
          newUsersByPeriod[period] = (newUsersByPeriod[period] || 0) + 1;
          totalNew++;
        }
      }

      // Churned subscriptions
      if (sub.status === 'cancelled' && sub.cancelled_at) {
        const cancelDate = new Date(sub.cancelled_at);
        if (cancelDate >= start && cancelDate <= end) {
          const period = sub.cancelled_at.substring(0, 10);
          churnedByPeriod[period] = (churnedByPeriod[period] || 0) + 1;
          totalChurned++;
        }
      }
    });

    const netGrowth = totalNew - totalChurned;
    const currentTotal = subscriptions?.length || 0;
    const startTotal = currentTotal - netGrowth;
    const growthRate = startTotal > 0 ? ((netGrowth / startTotal) * 100) : 0;

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy
      },
      summary: {
        totalNewUsers: totalNew,
        totalChurnedUsers: totalChurned,
        netGrowth,
        growthRate: Math.round(growthRate * 100) / 100,
        currentTotalUsers: currentTotal
      },
      newUsersByPeriod: Object.entries(newUsersByPeriod).map(([period, count]) => ({
        period,
        newUsers: count
      })).sort((a, b) => b.period.localeCompare(a.period)),
      churnedByPeriod: Object.entries(churnedByPeriod).map(([period, count]) => ({
        period,
        churnedUsers: count
      })).sort((a, b) => b.period.localeCompare(a.period)),
      planChanges: [],
      cumulativeGrowth: [],
      generatedAt: new Date().toISOString()
    };

    logger.info('Growth report generated', {
      adminId: req.session.userId,
      tenantId,
      period: { start, end, groupBy },
      netGrowth,
      endpoint: '/api/admin/reports/growth'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate growth report', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/reports/growth'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/reports/export
 * Export report data in CSV format (tenant-scoped)
 */
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { type, format = 'csv', startDate, endDate } = req.query;

    if (!type || !['usage', 'revenue', 'growth'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type. Use: usage, revenue, or growth' });
    }

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get accounts for this tenant
    const { data: accounts, error: accountsError } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, owner_user_id')
      .eq('tenant_id', tenantId);

    if (accountsError) throw accountsError;

    const accountIds = accounts?.map(a => a.id) || [];
    const userIds = accounts?.map(a => a.owner_user_id).filter(Boolean) || [];

    let data = [];
    let headers = [];
    let filename = '';

    if (type === 'usage') {
      headers = ['User ID', 'Metric Type', 'Amount', 'Recorded At'];
      filename = `usage-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;

      if (userIds.length > 0) {
        const { data: metrics } = await SupabaseService.adminClient
          .from('usage_metrics')
          .select('user_id, metric_type, amount, recorded_at')
          .in('user_id', userIds)
          .gte('recorded_at', start.toISOString())
          .lte('recorded_at', end.toISOString())
          .order('recorded_at', { ascending: false });

        data = (metrics || []).map(row => [row.user_id, row.metric_type, row.amount, row.recorded_at]);
      }

    } else if (type === 'revenue') {
      headers = ['Plan ID', 'Plan Name', 'Price (cents)', 'Billing Cycle', 'Subscribers', 'Monthly Revenue'];
      filename = `revenue-report-${new Date().toISOString().split('T')[0]}`;

      // Get tenant plans with subscriber counts
      const { data: plans } = await SupabaseService.adminClient
        .from('tenant_plans')
        .select('id, name, price_cents, billing_cycle')
        .eq('tenant_id', tenantId);

      if (plans && accountIds.length > 0) {
        const { data: subs } = await SupabaseService.adminClient
          .from('user_subscriptions')
          .select('plan_id')
          .in('account_id', accountIds)
          .in('status', ['active', 'trial']);

        const subCounts = {};
        (subs || []).forEach(s => {
          subCounts[s.plan_id] = (subCounts[s.plan_id] || 0) + 1;
        });

        data = plans.map(plan => {
          const subscribers = subCounts[plan.id] || 0;
          const monthlyRevenue = plan.billing_cycle === 'yearly'
            ? Math.round(plan.price_cents / 12) * subscribers
            : plan.price_cents * subscribers;
          return [plan.id, plan.name, plan.price_cents, plan.billing_cycle, subscribers, monthlyRevenue];
        });
      }

    } else if (type === 'growth') {
      headers = ['Period', 'New Users', 'Churned Users', 'Net Growth'];
      filename = `growth-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;

      if (accountIds.length > 0) {
        const { data: subs } = await SupabaseService.adminClient
          .from('user_subscriptions')
          .select('created_at, cancelled_at, status')
          .in('account_id', accountIds);

        const newByPeriod = {};
        const churnByPeriod = {};
        const periods = new Set();

        (subs || []).forEach(sub => {
          if (sub.created_at) {
            const createdDate = new Date(sub.created_at);
            if (createdDate >= start && createdDate <= end) {
              const period = sub.created_at.substring(0, 10);
              periods.add(period);
              newByPeriod[period] = (newByPeriod[period] || 0) + 1;
            }
          }
          if (sub.status === 'cancelled' && sub.cancelled_at) {
            const cancelDate = new Date(sub.cancelled_at);
            if (cancelDate >= start && cancelDate <= end) {
              const period = sub.cancelled_at.substring(0, 10);
              periods.add(period);
              churnByPeriod[period] = (churnByPeriod[period] || 0) + 1;
            }
          }
        });

        data = Array.from(periods).sort().map(period => {
          const newUsers = newByPeriod[period] || 0;
          const churned = churnByPeriod[period] || 0;
          return [period, newUsers, churned, newUsers - churned];
        });
      }
    }

    if (format === 'csv') {
      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send('\uFEFF' + csvContent);
    } else {
      res.status(400).json({ error: 'Invalid format. Use: csv' });
    }

    logger.info('Report exported', {
      adminId: req.session.userId,
      tenantId,
      type,
      format,
      endpoint: '/api/admin/reports/export'
    });
  } catch (error) {
    logger.error('Failed to export report', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/reports/export'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
