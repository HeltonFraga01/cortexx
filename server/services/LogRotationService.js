/**
 * LogRotationService
 * 
 * Handles periodic cleanup of audit logs and error logs.
 * Runs cleanup jobs on a configurable schedule.
 * 
 * Requirements: 8.3, 8.4
 * 
 * @module server/services/LogRotationService
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class LogRotationService {
  /**
   * @param {Object} db - Database instance
   * @param {Object} auditLogger - AuditLogger instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.auditRetentionDays=30] - Days to retain audit logs
   * @param {number} [options.deletedCampaignRetentionDays=90] - Days to retain logs for deleted campaigns
   * @param {number} [options.errorRetentionDays=30] - Days to retain error logs
   * @param {number} [options.cleanupIntervalMs=86400000] - Cleanup interval (default: 24 hours)
   */
  constructor(db, auditLogger, options = {}) {
    this.db = db;
    this.auditLogger = auditLogger;
    
    this.auditRetentionDays = options.auditRetentionDays || 30;
    this.deletedCampaignRetentionDays = options.deletedCampaignRetentionDays || 90;
    this.errorRetentionDays = options.errorRetentionDays || 30;
    this.cleanupIntervalMs = options.cleanupIntervalMs || 24 * 60 * 60 * 1000; // 24 hours
    
    this.intervalId = null;
    this.isRunning = false;
    this.lastCleanup = null;
    this.stats = {
      totalAuditLogsDeleted: 0,
      totalErrorLogsDeleted: 0,
      cleanupCount: 0
    };

    logger.info('LogRotationService created', {
      auditRetentionDays: this.auditRetentionDays,
      deletedCampaignRetentionDays: this.deletedCampaignRetentionDays,
      errorRetentionDays: this.errorRetentionDays,
      cleanupIntervalMs: this.cleanupIntervalMs
    });
  }

  /**
   * Starts the periodic cleanup job
   */
  start() {
    if (this.isRunning) {
      logger.warn('LogRotationService already running');
      return;
    }

    logger.info('Starting LogRotationService');
    this.isRunning = true;

    // Run cleanup immediately on start
    this.runCleanup();

    // Set up periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stops the periodic cleanup job
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('LogRotationService not running');
      return;
    }

    logger.info('Stopping LogRotationService');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }


  /**
   * Runs the cleanup job
   */
  async runCleanup() {
    try {
      logger.info('LogRotationService: Starting cleanup');
      const startTime = Date.now();

      // Cleanup audit logs
      const auditDeleted = await this.cleanupAuditLogs();

      // Cleanup error logs
      const errorDeleted = await this.cleanupErrorLogs();

      const duration = Date.now() - startTime;
      this.lastCleanup = new Date();
      this.stats.cleanupCount++;
      this.stats.totalAuditLogsDeleted += auditDeleted;
      this.stats.totalErrorLogsDeleted += errorDeleted;

      logger.info('LogRotationService: Cleanup completed', {
        auditDeleted,
        errorDeleted,
        durationMs: duration,
        totalCleanups: this.stats.cleanupCount
      });

    } catch (error) {
      logger.error('LogRotationService: Cleanup failed', {
        error: error.message
      });
    }
  }

  /**
   * Cleanup audit logs using AuditLogger
   * @returns {Promise<number>} Number of deleted entries
   */
  async cleanupAuditLogs() {
    try {
      if (this.auditLogger) {
        return await this.auditLogger.cleanup(
          this.auditRetentionDays,
          this.deletedCampaignRetentionDays
        );
      }
      return 0;
    } catch (error) {
      logger.error('LogRotationService: Audit log cleanup failed', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Cleanup error logs from campaign_error_logs table
   * Note: campaign_error_logs table may not exist in Supabase - this is a no-op if table doesn't exist
   * @returns {Promise<number>} Number of deleted entries
   */
  async cleanupErrorLogs() {
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.errorRetentionDays);
      const cutoffIso = cutoffDate.toISOString();

      // Try to delete from campaign_error_logs using Supabase
      // This table may not exist - if so, just return 0
      const { data, error } = await SupabaseService.adminClient
        .from('campaign_error_logs')
        .delete()
        .lt('created_at', cutoffIso)
        .select('id');

      if (error) {
        // Table doesn't exist or other error - log and return 0
        if (error.code === '42P01' || error.message?.includes('does not exist')) {
          logger.debug('LogRotationService: campaign_error_logs table does not exist, skipping cleanup');
          return 0;
        }
        throw error;
      }

      const deletedCount = data?.length || 0;

      logger.debug('LogRotationService: Error logs cleaned', {
        deleted: deletedCount,
        retentionDays: this.errorRetentionDays
      });

      return deletedCount;

    } catch (error) {
      logger.error('LogRotationService: Error log cleanup failed', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Get service statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      config: {
        auditRetentionDays: this.auditRetentionDays,
        deletedCampaignRetentionDays: this.deletedCampaignRetentionDays,
        errorRetentionDays: this.errorRetentionDays,
        cleanupIntervalMs: this.cleanupIntervalMs
      },
      stats: this.stats
    };
  }

  /**
   * Manually trigger cleanup (for testing or admin use)
   * @returns {Promise<Object>} Cleanup results
   */
  async manualCleanup() {
    logger.info('LogRotationService: Manual cleanup triggered');
    
    const auditDeleted = await this.cleanupAuditLogs();
    const errorDeleted = await this.cleanupErrorLogs();

    return {
      auditDeleted,
      errorDeleted,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = LogRotationService;
