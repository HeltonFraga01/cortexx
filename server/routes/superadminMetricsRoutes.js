/**
 * Superadmin Metrics Routes
 * 
 * Handles metrics and analytics for superadmin dashboard.
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const SuperadminService = require('../services/SuperadminService');
const { requireSuperadmin } = require('../middleware/superadminAuth');

// Use singleton service instance
const superadminService = SuperadminService;

/**
 * GET /api/superadmin/dashboard
 * Get dashboard metrics (MRR, tenant count, active accounts)
 * Requirements: 3.1, 3.2 - Dashboard metrics
 */
router.get('/dashboard', requireSuperadmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    const metrics = await superadminService.getDashboardMetrics({
      period
    });

    logger.info('Dashboard metrics retrieved by superadmin', {
      superadminId: req.session.userId,
      period,
      totalMRR: metrics.totalMRR,
      totalTenants: metrics.totalTenants
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get dashboard metrics', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/tenants/:id/metrics
 * Get detailed metrics for a specific tenant
 * Requirements: 3.3, 3.4 - Tenant-specific metrics
 */
router.get('/tenants/:id/metrics', requireSuperadmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d', includeUsage = false } = req.query;

    const metrics = await superadminService.getTenantMetrics(id, {
      period,
      includeUsage: includeUsage === 'true'
    });

    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found'
      });
    }

    logger.info('Tenant metrics retrieved by superadmin', {
      superadminId: req.session.userId,
      tenantId: id,
      period,
      includeUsage
    });

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Failed to get tenant metrics', {
      error: error.message,
      superadminId: req.session?.userId,
      tenantId: req.params?.id
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/export
 * Export metrics data as CSV
 * Requirements: 3.5 - Export metrics
 */
router.get('/export', requireSuperadmin, async (req, res) => {
  try {
    const { 
      type = 'tenants', 
      period = '30d', 
      format = 'csv',
      includeInactive = false 
    } = req.query;

    // Validate export type
    const validTypes = ['tenants', 'revenue', 'usage', 'accounts'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid export type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate format
    const validFormats = ['csv', 'json'];
    if (!validFormats.includes(format)) {
      return res.status(400).json({
        success: false,
        error: `Invalid format. Must be one of: ${validFormats.join(', ')}`
      });
    }

    const exportData = await superadminService.exportMetrics({
      type,
      period,
      format,
      includeInactive: includeInactive === 'true'
    });

    logger.info('Metrics exported by superadmin', {
      superadminId: req.session.userId,
      type,
      period,
      format,
      recordCount: exportData.recordCount
    });

    // Set appropriate headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${type}_metrics_${timestamp}.${format}`;
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(exportData.content);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json({
        success: true,
        data: exportData.content,
        metadata: {
          type,
          period,
          recordCount: exportData.recordCount,
          exportedAt: new Date().toISOString()
        }
      });
    }
  } catch (error) {
    logger.error('Failed to export metrics', {
      error: error.message,
      superadminId: req.session?.userId,
      exportType: req.query?.type
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/analytics/revenue
 * Get revenue analytics over time
 * Requirements: 3.1 - Revenue analytics
 */
router.get('/analytics/revenue', requireSuperadmin, async (req, res) => {
  try {
    const { 
      period = '12m', 
      granularity = 'month',
      currency = 'USD' 
    } = req.query;

    // Validate granularity
    const validGranularities = ['day', 'week', 'month', 'quarter'];
    if (!validGranularities.includes(granularity)) {
      return res.status(400).json({
        success: false,
        error: `Invalid granularity. Must be one of: ${validGranularities.join(', ')}`
      });
    }

    const analytics = await superadminService.getRevenueAnalytics({
      period,
      granularity,
      currency
    });

    logger.info('Revenue analytics retrieved by superadmin', {
      superadminId: req.session.userId,
      period,
      granularity,
      currency
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Failed to get revenue analytics', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/analytics/usage
 * Get usage analytics across all tenants
 * Requirements: 3.4 - Usage analytics
 */
router.get('/analytics/usage', requireSuperadmin, async (req, res) => {
  try {
    const { 
      period = '30d',
      metric = 'messages',
      groupBy = 'tenant'
    } = req.query;

    // Validate metric
    const validMetrics = ['messages', 'storage', 'api_calls', 'active_users'];
    if (!validMetrics.includes(metric)) {
      return res.status(400).json({
        success: false,
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`
      });
    }

    // Validate groupBy
    const validGroupBy = ['tenant', 'plan', 'region', 'time'];
    if (!validGroupBy.includes(groupBy)) {
      return res.status(400).json({
        success: false,
        error: `Invalid groupBy. Must be one of: ${validGroupBy.join(', ')}`
      });
    }

    const analytics = await superadminService.getUsageAnalytics({
      period,
      metric,
      groupBy
    });

    logger.info('Usage analytics retrieved by superadmin', {
      superadminId: req.session.userId,
      period,
      metric,
      groupBy
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    logger.error('Failed to get usage analytics', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/superadmin/health
 * Get system health metrics
 * Requirements: 3.2 - System health monitoring
 */
router.get('/health', requireSuperadmin, async (req, res) => {
  try {
    const healthMetrics = await superadminService.getSystemHealth();

    logger.debug('System health metrics retrieved by superadmin', {
      superadminId: req.session.userId,
      systemStatus: healthMetrics.status
    });

    res.json({
      success: true,
      data: healthMetrics
    });
  } catch (error) {
    logger.error('Failed to get system health metrics', {
      error: error.message,
      superadminId: req.session?.userId
    });

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;