/**
 * Admin Report Routes
 * 
 * Endpoints for generating administrative reports: usage, revenue, growth.
 * All routes require admin authentication.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/admin/reports/usage
 * Generate usage report with metrics by user, plan, and period
 */
router.get('/usage', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { startDate, endDate, groupBy = 'day', planId } = req.query;
    
    // Default to last 30 days
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get usage metrics aggregated by period
    let dateFormat;
    switch (groupBy) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'week':
        dateFormat = '%Y-W%W';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const usageByPeriodSql = `
      SELECT 
        strftime('${dateFormat}', recorded_at) as period,
        metric_type,
        SUM(amount) as total_amount,
        COUNT(DISTINCT user_id) as unique_users
      FROM usage_metrics
      WHERE recorded_at >= ? AND recorded_at <= ?
      GROUP BY period, metric_type
      ORDER BY period DESC
    `;

    const usageByPeriodResult = await db.query(usageByPeriodSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Get usage by user
    let usageByUserSql = `
      SELECT 
        um.user_id,
        um.metric_type,
        SUM(um.amount) as total_amount,
        us.plan_id
      FROM usage_metrics um
      LEFT JOIN user_subscriptions us ON um.user_id = us.user_id
      WHERE um.recorded_at >= ? AND um.recorded_at <= ?
    `;
    const userParams = [start.toISOString(), end.toISOString()];

    if (planId) {
      usageByUserSql += ' AND us.plan_id = ?';
      userParams.push(planId);
    }

    usageByUserSql += ' GROUP BY um.user_id, um.metric_type ORDER BY total_amount DESC LIMIT 100';

    const usageByUserResult = await db.query(usageByUserSql, userParams);

    // Get usage by plan
    const usageByPlanSql = `
      SELECT 
        us.plan_id,
        p.name as plan_name,
        um.metric_type,
        SUM(um.amount) as total_amount,
        COUNT(DISTINCT um.user_id) as unique_users,
        AVG(um.amount) as avg_per_user
      FROM usage_metrics um
      LEFT JOIN user_subscriptions us ON um.user_id = us.user_id
      LEFT JOIN plans p ON us.plan_id = p.id
      WHERE um.recorded_at >= ? AND um.recorded_at <= ?
      GROUP BY us.plan_id, um.metric_type
      ORDER BY total_amount DESC
    `;

    const usageByPlanResult = await db.query(usageByPlanSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Calculate totals
    const totalsSql = `
      SELECT 
        metric_type,
        SUM(amount) as total,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(amount) as average
      FROM usage_metrics
      WHERE recorded_at >= ? AND recorded_at <= ?
      GROUP BY metric_type
    `;

    const totalsResult = await db.query(totalsSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy
      },
      totals: totalsResult.rows.map(row => ({
        metricType: row.metric_type,
        total: row.total,
        uniqueUsers: row.unique_users,
        average: Math.round(row.average * 100) / 100
      })),
      byPeriod: usageByPeriodResult.rows.map(row => ({
        period: row.period,
        metricType: row.metric_type,
        totalAmount: row.total_amount,
        uniqueUsers: row.unique_users
      })),
      byUser: usageByUserResult.rows.map(row => ({
        userId: row.user_id,
        planId: row.plan_id,
        metricType: row.metric_type,
        totalAmount: row.total_amount
      })),
      byPlan: usageByPlanResult.rows.map(row => ({
        planId: row.plan_id,
        planName: row.plan_name,
        metricType: row.metric_type,
        totalAmount: row.total_amount,
        uniqueUsers: row.unique_users,
        avgPerUser: Math.round(row.avg_per_user * 100) / 100
      })),
      generatedAt: new Date().toISOString()
    };

    logger.info('Usage report generated', {
      adminId: req.session.userId,
      period: { start, end, groupBy },
      endpoint: '/api/admin/reports/usage'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate usage report', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/reports/usage'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/reports/revenue
 * Generate revenue report with MRR, ARR, churn, LTV
 */
router.get('/revenue', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { startDate, endDate } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Get active subscriptions with plan prices
    const activeSubsSql = `
      SELECT 
        us.plan_id,
        p.name as plan_name,
        p.price_cents,
        p.billing_cycle,
        COUNT(*) as subscriber_count
      FROM user_subscriptions us
      JOIN plans p ON us.plan_id = p.id
      WHERE us.status IN ('active', 'trial')
      GROUP BY us.plan_id
    `;

    const activeSubsResult = await db.query(activeSubsSql);

    // Calculate MRR (Monthly Recurring Revenue)
    let mrr = 0;
    const revenueByPlan = activeSubsResult.rows.map(row => {
      let monthlyRevenue = row.price_cents;
      if (row.billing_cycle === 'yearly') {
        monthlyRevenue = Math.round(row.price_cents / 12);
      }
      const planMrr = monthlyRevenue * row.subscriber_count;
      mrr += planMrr;

      return {
        planId: row.plan_id,
        planName: row.plan_name,
        priceCents: row.price_cents,
        billingCycle: row.billing_cycle,
        subscriberCount: row.subscriber_count,
        monthlyRevenue: planMrr
      };
    });

    // Calculate ARR (Annual Recurring Revenue)
    const arr = mrr * 12;

    // Get churn data (canceled subscriptions in period)
    const churnSql = `
      SELECT 
        COUNT(*) as churned_count,
        strftime('%Y-%m', canceled_at) as month
      FROM user_subscriptions
      WHERE status = 'canceled' 
        AND canceled_at >= ? 
        AND canceled_at <= ?
      GROUP BY month
      ORDER BY month DESC
    `;

    const churnResult = await db.query(churnSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Get total active users for churn rate calculation
    const totalActiveSql = `
      SELECT COUNT(*) as total FROM user_subscriptions WHERE status IN ('active', 'trial')
    `;
    const totalActiveResult = await db.query(totalActiveSql);
    const totalActive = totalActiveResult.rows[0]?.total || 0;

    // Calculate churn rate (monthly average)
    const totalChurned = churnResult.rows.reduce((sum, row) => sum + row.churned_count, 0);
    const monthsInPeriod = Math.max(1, Math.ceil((end - start) / (30 * 24 * 60 * 60 * 1000)));
    const avgMonthlyChurn = totalChurned / monthsInPeriod;
    const churnRate = totalActive > 0 ? (avgMonthlyChurn / totalActive) * 100 : 0;

    // Calculate ARPU (Average Revenue Per User)
    const arpu = totalActive > 0 ? Math.round(mrr / totalActive) : 0;

    // Calculate LTV (Lifetime Value) - simplified: ARPU / churn rate
    const ltv = churnRate > 0 ? Math.round((arpu / (churnRate / 100)) * 100) / 100 : 0;

    // Get subscription status distribution
    const statusDistSql = `
      SELECT status, COUNT(*) as count
      FROM user_subscriptions
      GROUP BY status
    `;
    const statusDistResult = await db.query(statusDistSql);

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      metrics: {
        mrr: mrr, // in cents
        arr: arr, // in cents
        churnRate: Math.round(churnRate * 100) / 100, // percentage
        arpu: arpu, // in cents
        ltv: ltv, // in cents
        totalActiveSubscribers: totalActive,
        totalChurnedInPeriod: totalChurned
      },
      revenueByPlan,
      churnByMonth: churnResult.rows.map(row => ({
        month: row.month,
        churnedCount: row.churned_count
      })),
      subscriptionsByStatus: statusDistResult.rows.reduce((acc, row) => {
        acc[row.status] = row.count;
        return acc;
      }, {}),
      generatedAt: new Date().toISOString()
    };

    logger.info('Revenue report generated', {
      adminId: req.session.userId,
      mrr,
      arr,
      endpoint: '/api/admin/reports/revenue'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate revenue report', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/reports/revenue'
    });
    res.status(500).json({ error: error.message });
  }
});


/**
 * GET /api/admin/reports/growth
 * Generate growth report with new users, churned users, upgrades, downgrades
 */
router.get('/growth', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    let dateFormat;
    switch (groupBy) {
      case 'week':
        dateFormat = '%Y-W%W';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    // Get new subscriptions by period
    const newSubsSql = `
      SELECT 
        strftime('${dateFormat}', started_at) as period,
        COUNT(*) as new_users,
        plan_id
      FROM user_subscriptions
      WHERE started_at >= ? AND started_at <= ?
      GROUP BY period, plan_id
      ORDER BY period DESC
    `;

    const newSubsResult = await db.query(newSubsSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Get churned subscriptions by period
    const churnedSubsSql = `
      SELECT 
        strftime('${dateFormat}', canceled_at) as period,
        COUNT(*) as churned_users,
        plan_id
      FROM user_subscriptions
      WHERE canceled_at >= ? AND canceled_at <= ?
        AND status = 'canceled'
      GROUP BY period, plan_id
      ORDER BY period DESC
    `;

    const churnedSubsResult = await db.query(churnedSubsSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Get plan changes from audit log (upgrades/downgrades)
    const planChangesSql = `
      SELECT 
        strftime('${dateFormat}', created_at) as period,
        details,
        COUNT(*) as change_count
      FROM admin_audit_log
      WHERE action_type = 'user_plan_assigned'
        AND created_at >= ? AND created_at <= ?
      GROUP BY period
      ORDER BY period DESC
    `;

    const planChangesResult = await db.query(planChangesSql, [
      start.toISOString(),
      end.toISOString()
    ]);

    // Get total users over time
    const totalUsersSql = `
      SELECT 
        strftime('${dateFormat}', started_at) as period,
        COUNT(*) as cumulative_users
      FROM user_subscriptions
      WHERE started_at <= ?
      GROUP BY period
      ORDER BY period ASC
    `;

    const totalUsersResult = await db.query(totalUsersSql, [end.toISOString()]);

    // Calculate cumulative totals
    let runningTotal = 0;
    const cumulativeGrowth = totalUsersResult.rows.map(row => {
      runningTotal += row.cumulative_users;
      return {
        period: row.period,
        totalUsers: runningTotal
      };
    });

    // Aggregate new users by period
    const newUsersByPeriod = {};
    newSubsResult.rows.forEach(row => {
      if (!newUsersByPeriod[row.period]) {
        newUsersByPeriod[row.period] = { period: row.period, newUsers: 0, byPlan: {} };
      }
      newUsersByPeriod[row.period].newUsers += row.new_users;
      newUsersByPeriod[row.period].byPlan[row.plan_id] = row.new_users;
    });

    // Aggregate churned users by period
    const churnedByPeriod = {};
    churnedSubsResult.rows.forEach(row => {
      if (!churnedByPeriod[row.period]) {
        churnedByPeriod[row.period] = { period: row.period, churnedUsers: 0, byPlan: {} };
      }
      churnedByPeriod[row.period].churnedUsers += row.churned_users;
      churnedByPeriod[row.period].byPlan[row.plan_id] = row.churned_users;
    });

    // Calculate totals
    const totalNewUsers = newSubsResult.rows.reduce((sum, row) => sum + row.new_users, 0);
    const totalChurnedUsers = churnedSubsResult.rows.reduce((sum, row) => sum + row.churned_users, 0);
    const netGrowth = totalNewUsers - totalChurnedUsers;

    // Get current total
    const currentTotalSql = `SELECT COUNT(*) as total FROM user_subscriptions`;
    const currentTotalResult = await db.query(currentTotalSql);
    const currentTotal = currentTotalResult.rows[0]?.total || 0;

    // Calculate growth rate
    const startTotal = currentTotal - netGrowth;
    const growthRate = startTotal > 0 ? ((netGrowth / startTotal) * 100) : 0;

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy
      },
      summary: {
        totalNewUsers,
        totalChurnedUsers,
        netGrowth,
        growthRate: Math.round(growthRate * 100) / 100,
        currentTotalUsers: currentTotal
      },
      newUsersByPeriod: Object.values(newUsersByPeriod),
      churnedByPeriod: Object.values(churnedByPeriod),
      planChanges: planChangesResult.rows.map(row => ({
        period: row.period,
        changeCount: row.change_count
      })),
      cumulativeGrowth,
      generatedAt: new Date().toISOString()
    };

    logger.info('Growth report generated', {
      adminId: req.session.userId,
      period: { start, end, groupBy },
      netGrowth,
      endpoint: '/api/admin/reports/growth'
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error('Failed to generate growth report', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/reports/growth'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/reports/export
 * Export report data in CSV or Excel format
 */
router.get('/export', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { type, format = 'csv', startDate, endDate } = req.query;

    if (!type || !['usage', 'revenue', 'growth'].includes(type)) {
      return res.status(400).json({ error: 'Invalid report type. Use: usage, revenue, or growth' });
    }

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    let data = [];
    let headers = [];
    let filename = '';

    if (type === 'usage') {
      headers = ['User ID', 'Metric Type', 'Amount', 'Recorded At'];
      filename = `usage-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;

      const sql = `
        SELECT user_id, metric_type, amount, recorded_at
        FROM usage_metrics
        WHERE recorded_at >= ? AND recorded_at <= ?
        ORDER BY recorded_at DESC
      `;
      const result = await db.query(sql, [start.toISOString(), end.toISOString()]);
      data = result.rows.map(row => [row.user_id, row.metric_type, row.amount, row.recorded_at]);

    } else if (type === 'revenue') {
      headers = ['Plan ID', 'Plan Name', 'Price (cents)', 'Billing Cycle', 'Subscribers', 'Monthly Revenue'];
      filename = `revenue-report-${new Date().toISOString().split('T')[0]}`;

      const sql = `
        SELECT 
          p.id as plan_id,
          p.name as plan_name,
          p.price_cents,
          p.billing_cycle,
          COUNT(us.id) as subscribers
        FROM plans p
        LEFT JOIN user_subscriptions us ON p.id = us.plan_id AND us.status IN ('active', 'trial')
        GROUP BY p.id
      `;
      const result = await db.query(sql);
      data = result.rows.map(row => {
        const monthlyRevenue = row.billing_cycle === 'yearly' 
          ? Math.round(row.price_cents / 12) * row.subscribers
          : row.price_cents * row.subscribers;
        return [row.plan_id, row.plan_name, row.price_cents, row.billing_cycle, row.subscribers, monthlyRevenue];
      });

    } else if (type === 'growth') {
      headers = ['Period', 'New Users', 'Churned Users', 'Net Growth'];
      filename = `growth-report-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}`;

      const newSql = `
        SELECT strftime('%Y-%m-%d', started_at) as period, COUNT(*) as count
        FROM user_subscriptions
        WHERE started_at >= ? AND started_at <= ?
        GROUP BY period
      `;
      const churnSql = `
        SELECT strftime('%Y-%m-%d', canceled_at) as period, COUNT(*) as count
        FROM user_subscriptions
        WHERE canceled_at >= ? AND canceled_at <= ? AND status = 'canceled'
        GROUP BY period
      `;

      const [newResult, churnResult] = await Promise.all([
        db.query(newSql, [start.toISOString(), end.toISOString()]),
        db.query(churnSql, [start.toISOString(), end.toISOString()])
      ]);

      const periods = new Set([
        ...newResult.rows.map(r => r.period),
        ...churnResult.rows.map(r => r.period)
      ]);

      const newByPeriod = newResult.rows.reduce((acc, r) => { acc[r.period] = r.count; return acc; }, {});
      const churnByPeriod = churnResult.rows.reduce((acc, r) => { acc[r.period] = r.count; return acc; }, {});

      data = Array.from(periods).sort().map(period => {
        const newUsers = newByPeriod[period] || 0;
        const churned = churnByPeriod[period] || 0;
        return [period, newUsers, churned, newUsers - churned];
      });
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
      type,
      format,
      endpoint: '/api/admin/reports/export'
    });
  } catch (error) {
    logger.error('Failed to export report', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/reports/export'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
