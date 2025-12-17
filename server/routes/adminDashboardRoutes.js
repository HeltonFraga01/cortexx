/**
 * Admin Dashboard Routes
 * 
 * Endpoints for dashboard statistics and alerts.
 * All routes require admin authentication.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/admin/management/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    // User statistics
    const userStats = getUserStats(db);
    
    // Usage statistics
    const usageStats = getUsageStats(db);
    
    // Revenue statistics
    const revenueStats = getRevenueStats(db);

    const stats = {
      users: userStats,
      usage: usageStats,
      revenue: revenueStats,
      timestamp: new Date().toISOString()
    };

    logger.info('Dashboard stats retrieved', {
      adminId: req.session.userId,
      endpoint: '/api/admin/management/dashboard/stats'
    });

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get dashboard stats', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/management/dashboard/stats'
    });
    res.status(500).json({ error: error.message });
  }
});


/**
 * GET /api/admin/management/dashboard/alerts
 * Get active alerts
 */
router.get('/alerts', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const alerts = getActiveAlerts(db);

    logger.info('Dashboard alerts retrieved', {
      adminId: req.session.userId,
      alertCount: alerts.length,
      endpoint: '/api/admin/management/dashboard/alerts'
    });

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Failed to get dashboard alerts', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/management/dashboard/alerts'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/management/dashboard/growth
 * Get growth metrics over time
 */
router.get('/growth', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.db;
    if (!db) {
      return res.status(500).json({ error: 'Database not initialized' });
    }

    const { days = 30 } = req.query;
    const growth = getGrowthMetrics(db, parseInt(days));

    res.json({ success: true, data: growth });
  } catch (error) {
    logger.error('Failed to get growth metrics', {
      error: error.message,
      adminId: req.session.userId,
      endpoint: '/api/admin/management/dashboard/growth'
    });
    res.status(500).json({ error: error.message });
  }
});

// Helper functions for dashboard statistics

function getUserStats(db) {
  try {
    // Total users by subscription status
    const statusStmt = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM user_subscriptions 
      GROUP BY status
    `);
    const statusResult = statusStmt.all();

    const byStatus = {};
    let total = 0;
    let active = 0;
    let trial = 0;
    let suspended = 0;

    for (const row of statusResult) {
      byStatus[row.status] = row.count;
      total += row.count;
      if (row.status === 'active') active = row.count;
      if (row.status === 'trial') trial = row.count;
      if (row.status === 'suspended') suspended = row.count;
    }

    // Users by plan
    const planStmt = db.prepare(`
      SELECT p.name, COUNT(s.id) as count
      FROM plans p
      LEFT JOIN user_subscriptions s ON p.id = s.plan_id AND s.status IN ('active', 'trial')
      GROUP BY p.id, p.name
    `);
    const planResult = planStmt.all();

    const byPlan = {};
    for (const row of planResult) {
      byPlan[row.name] = row.count;
    }

    // Growth last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const growthStmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM user_subscriptions 
      WHERE created_at >= ?
    `);
    const growthResult = growthStmt.get(thirtyDaysAgo.toISOString());

    return {
      total,
      active,
      trial,
      suspended,
      byStatus,
      byPlan,
      growthLast30Days: growthResult?.count || 0
    };
  } catch (error) {
    logger.error('Failed to get user stats', { error: error.message });
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

function getUsageStats(db) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Messages today
    const todayStmt = db.prepare(`
      SELECT SUM(current_usage) as total
      FROM user_quota_usage
      WHERE quota_type = 'max_messages_per_day'
      AND period_start >= ?
    `);
    const todayResult = todayStmt.get(todayStart.toISOString());

    // Messages this week
    const weekStmt = db.prepare(`
      SELECT SUM(amount) as total
      FROM usage_metrics
      WHERE metric_type = 'message_sent'
      AND recorded_at >= ?
    `);
    const weekResult = weekStmt.get(weekStart.toISOString());

    // Messages this month
    const monthStmt = db.prepare(`
      SELECT SUM(current_usage) as total
      FROM user_quota_usage
      WHERE quota_type = 'max_messages_per_month'
      AND period_start >= ?
    `);
    const monthResult = monthStmt.get(monthStart.toISOString());

    // Active connections (users with active status)
    const connectionsStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status IN ('active', 'trial')
    `);
    const connectionsResult = connectionsStmt.get();

    // Total storage
    const storageStmt = db.prepare(`
      SELECT SUM(current_usage) as total
      FROM user_quota_usage
      WHERE quota_type = 'max_storage_mb'
    `);
    const storageResult = storageStmt.get();

    return {
      messagesToday: todayResult?.total || 0,
      messagesThisWeek: weekResult?.total || 0,
      messagesThisMonth: monthResult?.total || 0,
      activeConnections: connectionsResult?.count || 0,
      totalStorageMb: storageResult?.total || 0
    };
  } catch (error) {
    logger.error('Failed to get usage stats', { error: error.message });
    return {
      messagesToday: 0,
      messagesThisWeek: 0,
      messagesThisMonth: 0,
      activeConnections: 0,
      totalStorageMb: 0
    };
  }
}

function getRevenueStats(db) {
  try {
    // MRR (Monthly Recurring Revenue)
    const mrrStmt = db.prepare(`
      SELECT SUM(p.price_cents) as total
      FROM user_subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status IN ('active', 'trial')
      AND p.billing_cycle = 'monthly'
    `);
    const mrrResult = mrrStmt.get();

    // ARR from yearly plans
    const arrYearlyStmt = db.prepare(`
      SELECT SUM(p.price_cents) as total
      FROM user_subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.status IN ('active', 'trial')
      AND p.billing_cycle = 'yearly'
    `);
    const arrYearlyResult = arrYearlyStmt.get();

    const monthlyMrr = mrrResult?.total || 0;
    const yearlyMrr = Math.round((arrYearlyResult?.total || 0) / 12);
    const mrr = monthlyMrr + yearlyMrr;
    const arr = mrr * 12;

    // Churn rate (canceled in last 30 days / total at start of period)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const canceledStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status = 'canceled'
      AND canceled_at >= ?
    `);
    const canceledResult = canceledStmt.get(thirtyDaysAgo.toISOString());

    const totalAtStartStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE created_at < ?
    `);
    const totalAtStartResult = totalAtStartStmt.get(thirtyDaysAgo.toISOString());

    const canceled = canceledResult?.count || 0;
    const startCount = totalAtStartResult?.count || 1;
    const churnRate = Math.round((canceled / startCount) * 100 * 100) / 100;

    // ARPU (Average Revenue Per User)
    const activeUsersStmt = db.prepare(`
      SELECT COUNT(*) as count
      FROM user_subscriptions
      WHERE status IN ('active', 'trial')
    `);
    const activeUsersResult = activeUsersStmt.get();

    const activeCount = activeUsersResult?.count || 1;
    const arpu = Math.round(mrr / activeCount);

    return {
      mrr,
      arr,
      churnRate,
      avgRevenuePerUser: arpu
    };
  } catch (error) {
    logger.error('Failed to get revenue stats', { error: error.message });
    return {
      mrr: 0,
      arr: 0,
      churnRate: 0,
      avgRevenuePerUser: 0
    };
  }
}

function getActiveAlerts(db) {
  try {
    const alerts = [];
    const crypto = require('crypto');

    // Check for users near quota limits (>80%)
    const quotaStmt = db.prepare(`
      SELECT u.user_id, u.quota_type, u.current_usage,
             COALESCE(o.limit_value, 100) as limit_value
      FROM user_quota_usage u
      LEFT JOIN user_quota_overrides o ON u.user_id = o.user_id AND u.quota_type = o.quota_type
      WHERE u.current_usage > 0
    `);
    const quotaAlerts = quotaStmt.all();

    for (const row of quotaAlerts) {
      const percentage = row.limit_value > 0 ? (row.current_usage / row.limit_value) : 0;
      if (percentage >= 0.8) {
        alerts.push({
          id: crypto.randomUUID(),
          type: 'quota_warning',
          severity: percentage >= 1 ? 'error' : 'warning',
          userId: row.user_id,
          message: `User ${row.user_id.substring(0, 8)}... is at ${Math.round(percentage * 100)}% of ${row.quota_type}`,
          createdAt: new Date().toISOString()
        });
      }
    }

    // Check for suspended users
    const suspendedStmt = db.prepare(`
      SELECT user_id, suspension_reason, updated_at
      FROM user_subscriptions
      WHERE status = 'suspended'
      ORDER BY updated_at DESC
      LIMIT 10
    `);
    const suspendedResult = suspendedStmt.all();

    for (const row of suspendedResult) {
      alerts.push({
        id: crypto.randomUUID(),
        type: 'user_suspended',
        severity: 'info',
        userId: row.user_id,
        message: `User ${row.user_id.substring(0, 8)}... is suspended: ${row.suspension_reason || 'No reason provided'}`,
        createdAt: row.updated_at
      });
    }

    // Sort by severity and date
    const severityOrder = { error: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => {
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return alerts.slice(0, 50); // Limit to 50 alerts
  } catch (error) {
    logger.error('Failed to get active alerts', { error: error.message });
    return [];
  }
}

function getGrowthMetrics(db, days) {
  try {
    const metrics = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const stmt = db.prepare(`
        SELECT COUNT(*) as count
        FROM user_subscriptions
        WHERE DATE(created_at) <= ?
        AND (status IN ('active', 'trial') OR canceled_at > ?)
      `);
      const result = stmt.get(dateStr, dateStr);

      metrics.push({
        date: dateStr,
        totalUsers: result?.count || 0
      });
    }

    return metrics;
  } catch (error) {
    logger.error('Failed to get growth metrics', { error: error.message });
    return [];
  }
}

module.exports = router;
