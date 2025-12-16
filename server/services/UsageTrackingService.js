/**
 * UsageTrackingService - Service for tracking usage metrics
 * 
 * Handles usage tracking, metrics aggregation, and reporting.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');

// Metric types
const METRIC_TYPES = {
  MESSAGES_SENT: 'messages_sent',
  MESSAGES_RECEIVED: 'messages_received',
  API_CALLS: 'api_calls',
  STORAGE_USED: 'storage_used',
  CONNECTIONS_ACTIVE: 'connections_active',
  WEBHOOKS_TRIGGERED: 'webhooks_triggered',
  CAMPAIGNS_EXECUTED: 'campaigns_executed'
};

class UsageTrackingService {
  constructor(db) {
    this.db = db;
  }

  generateId() {
    return crypto.randomUUID();
  }

  /**
   * Track a usage event
   * @param {string} userId - User ID
   * @param {string} metricType - Type of metric
   * @param {number} [amount=1] - Amount to track
   * @param {Object} [metadata] - Additional metadata
   * @returns {Promise<Object>} Created metric entry
   */
  async trackUsage(userId, metricType, amount = 1, metadata = {}) {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();

      await this.db.query(
        `INSERT INTO usage_metrics (id, user_id, metric_type, amount, metadata, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, metricType, amount, JSON.stringify(metadata), now]
      );

      logger.debug('Usage tracked', { userId, metricType, amount });

      return { id, userId, metricType, amount, metadata, recordedAt: now };
    } catch (error) {
      logger.error('Failed to track usage', { error: error.message, userId, metricType });
      throw error;
    }
  }

  /**
   * Get usage metrics for a user
   * @param {string} userId - User ID
   * @param {string} period - Period (day, week, month, year)
   * @returns {Promise<Object>} Usage metrics by type
   */
  async getUsageMetrics(userId, period = 'month') {
    try {
      const startDate = this.getPeriodStart(period);
      
      const result = await this.db.query(
        `SELECT metric_type, SUM(amount) as total
         FROM usage_metrics
         WHERE user_id = ? AND recorded_at >= ?
         GROUP BY metric_type`,
        [userId, startDate.toISOString()]
      );

      const metrics = {};
      for (const row of result.rows) {
        metrics[row.metric_type] = row.total;
      }

      return metrics;
    } catch (error) {
      logger.error('Failed to get usage metrics', { error: error.message, userId, period });
      throw error;
    }
  }

  /**
   * Get aggregated metrics across users
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Aggregated metrics
   */
  async getAggregatedMetrics(filters = {}) {
    try {
      const { planId, startDate, endDate, metricType } = filters;
      
      let sql = `
        SELECT m.metric_type, SUM(m.amount) as total, COUNT(DISTINCT m.user_id) as user_count
        FROM usage_metrics m
      `;
      const params = [];
      const conditions = [];

      if (planId) {
        sql += ' JOIN user_subscriptions s ON m.user_id = s.user_id';
        conditions.push('s.plan_id = ?');
        params.push(planId);
      }

      if (startDate) {
        conditions.push('m.recorded_at >= ?');
        params.push(startDate);
      }

      if (endDate) {
        conditions.push('m.recorded_at <= ?');
        params.push(endDate);
      }

      if (metricType) {
        conditions.push('m.metric_type = ?');
        params.push(metricType);
      }

      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }

      sql += ' GROUP BY m.metric_type';

      const result = await this.db.query(sql, params);

      return result.rows.map(row => ({
        metricType: row.metric_type,
        total: row.total,
        userCount: row.user_count
      }));
    } catch (error) {
      logger.error('Failed to get aggregated metrics', { error: error.message, filters });
      throw error;
    }
  }

  /**
   * Calculate cost per user based on resource consumption
   * @param {string} userId - User ID
   * @param {string} period - Period
   * @returns {Promise<Object>} Cost breakdown
   */
  async calculateCostPerUser(userId, period = 'month') {
    try {
      const metrics = await this.getUsageMetrics(userId, period);
      
      // Cost factors (example values - should be configurable)
      const costFactors = {
        [METRIC_TYPES.MESSAGES_SENT]: 0.001,
        [METRIC_TYPES.MESSAGES_RECEIVED]: 0.0005,
        [METRIC_TYPES.API_CALLS]: 0.0001,
        [METRIC_TYPES.STORAGE_USED]: 0.01,
        [METRIC_TYPES.WEBHOOKS_TRIGGERED]: 0.0002,
        [METRIC_TYPES.CAMPAIGNS_EXECUTED]: 0.05
      };

      let totalCost = 0;
      const breakdown = {};

      for (const [metricType, amount] of Object.entries(metrics)) {
        const cost = (amount || 0) * (costFactors[metricType] || 0);
        breakdown[metricType] = { amount, cost };
        totalCost += cost;
      }

      return {
        userId,
        period,
        totalCost: Math.round(totalCost * 100) / 100,
        breakdown
      };
    } catch (error) {
      logger.error('Failed to calculate cost', { error: error.message, userId, period });
      throw error;
    }
  }

  /**
   * Export usage data
   * @param {string} userId - User ID
   * @param {Object} dateRange - { startDate, endDate }
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<string>} Exported data
   */
  async exportUsageData(userId, dateRange = {}, format = 'csv') {
    try {
      let sql = 'SELECT * FROM usage_metrics WHERE user_id = ?';
      const params = [userId];

      if (dateRange.startDate) {
        sql += ' AND recorded_at >= ?';
        params.push(dateRange.startDate);
      }

      if (dateRange.endDate) {
        sql += ' AND recorded_at <= ?';
        params.push(dateRange.endDate);
      }

      sql += ' ORDER BY recorded_at DESC';

      const result = await this.db.query(sql, params);
      const data = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        metricType: row.metric_type,
        amount: row.amount,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
        recordedAt: row.recorded_at
      }));

      if (format === 'csv') {
        return this.toCSV(data);
      }

      return JSON.stringify(data, null, 2);
    } catch (error) {
      logger.error('Failed to export usage data', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get period start date
   * @param {string} period - Period type
   * @returns {Date} Start date
   */
  getPeriodStart(period) {
    const now = new Date();
    
    switch (period) {
      case 'day':
        now.setHours(0, 0, 0, 0);
        break;
      case 'week':
        now.setDate(now.getDate() - 7);
        break;
      case 'year':
        now.setFullYear(now.getFullYear() - 1);
        break;
      case 'month':
      default:
        now.setMonth(now.getMonth() - 1);
        break;
    }
    
    return now;
  }

  /**
   * Convert data to CSV format
   * @param {Object[]} data - Array of data
   * @returns {string} CSV string
   */
  toCSV(data) {
    const headers = ['id', 'userId', 'metricType', 'amount', 'recordedAt'];
    const rows = data.map(d => [d.id, d.userId, d.metricType, d.amount, d.recordedAt]);
    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}

// Export constants
UsageTrackingService.METRIC_TYPES = METRIC_TYPES;

module.exports = UsageTrackingService;
