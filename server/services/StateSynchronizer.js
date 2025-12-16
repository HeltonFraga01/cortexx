/**
 * StateSynchronizer Service
 * 
 * Synchronizes campaign state between memory and database:
 * - Periodic sync every 30 seconds
 * - Restores campaigns after server restart
 * - Detects and corrects state inconsistencies
 * 
 * Requirements: 2.1, 4.1, 4.3, 4.4
 * 
 * @module server/services/StateSynchronizer
 */

const { logger } = require('../utils/logger');

class StateSynchronizer {
  /**
   * @param {Object} db - Database instance
   * @param {Object} scheduler - CampaignScheduler instance
   */
  constructor(db, scheduler) {
    this.db = db;
    this.scheduler = scheduler;
    this.syncInterval = 30000; // 30 seconds
    this.intervalId = null;
    this.isRunning = false;

    logger.info('StateSynchronizer created', {
      syncInterval: this.syncInterval
    });
  }

  /**
   * Starts the periodic state synchronization
   */
  startSync() {
    if (this.isRunning) {
      logger.warn('StateSynchronizer already running');
      return;
    }

    logger.info('Starting StateSynchronizer');
    this.isRunning = true;

    // Run sync immediately
    this.syncState();

    // Set up periodic sync
    this.intervalId = setInterval(() => {
      this.syncState();
    }, this.syncInterval);
  }

  /**
   * Stops the periodic state synchronization
   */
  stopSync() {
    if (!this.isRunning) {
      logger.warn('StateSynchronizer not running');
      return;
    }

    logger.info('Stopping StateSynchronizer');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }


  /**
   * Synchronizes in-memory state with database
   */
  async syncState() {
    try {
      logger.debug('Syncing campaign state');

      const activeQueues = this.scheduler.getActiveQueues();

      for (const { campaignId, status, progress } of activeQueues) {
        await this.syncCampaignState(campaignId, status, progress);
      }

      logger.debug('State sync completed', {
        syncedCampaigns: activeQueues.length
      });

    } catch (error) {
      logger.error('Error during state sync', {
        error: error.message
      });
    }
  }

  /**
   * Syncs a single campaign's state to database
   * @param {string} campaignId - Campaign ID
   * @param {string} status - Current status
   * @param {Object} progress - Progress data
   */
  async syncCampaignState(campaignId, status, progress) {
    try {
      const sql = `
        UPDATE campaigns 
        SET current_index = ?,
            sent_count = ?,
            failed_count = ?,
            status = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.query(sql, [
        progress?.currentIndex || 0,
        progress?.stats?.sent || 0,
        progress?.stats?.failed || 0,
        status,
        campaignId
      ]);

      logger.debug('Campaign state synced', {
        campaignId,
        status,
        currentIndex: progress?.currentIndex,
        sent: progress?.stats?.sent,
        failed: progress?.stats?.failed
      });

    } catch (error) {
      logger.error('Error syncing campaign state', {
        campaignId,
        error: error.message
      });
    }
  }

  /**
   * Restores campaigns that were running when server stopped
   * Marks them as paused so they can be manually resumed
   * @returns {Promise<Array>} List of restored campaigns
   */
  async restoreRunningCampaigns() {
    try {
      logger.info('Restoring running campaigns after restart');

      // Find campaigns that were running or had active locks
      const sql = `
        SELECT * FROM campaigns 
        WHERE status = 'running' 
           OR (processing_lock IS NOT NULL AND status != 'completed' AND status != 'cancelled' AND status != 'failed')
      `;

      const { rows } = await this.db.query(sql);

      if (rows.length === 0) {
        logger.info('No campaigns to restore');
        return [];
      }

      logger.info('Found campaigns to restore', {
        count: rows.length,
        campaigns: rows.map(c => ({ id: c.id, name: c.name, status: c.status }))
      });

      const restoredCampaigns = [];

      for (const campaign of rows) {
        try {
          // Mark as paused and clear lock
          const updateSql = `
            UPDATE campaigns 
            SET status = 'paused',
                processing_lock = NULL,
                lock_acquired_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `;

          await this.db.query(updateSql, [campaign.id]);

          logger.info('Campaign restored as paused', {
            campaignId: campaign.id,
            name: campaign.name,
            previousStatus: campaign.status
          });

          restoredCampaigns.push({
            id: campaign.id,
            name: campaign.name,
            previousStatus: campaign.status,
            newStatus: 'paused'
          });

        } catch (error) {
          logger.error('Error restoring campaign', {
            campaignId: campaign.id,
            error: error.message
          });
        }
      }

      logger.info('Campaign restoration completed', {
        restored: restoredCampaigns.length
      });

      return restoredCampaigns;

    } catch (error) {
      logger.error('Error restoring running campaigns', {
        error: error.message
      });
      return [];
    }
  }


  /**
   * Detects inconsistencies between memory and database state
   * @returns {Promise<Array>} List of detected inconsistencies
   */
  async detectInconsistencies() {
    try {
      logger.debug('Detecting state inconsistencies');

      const inconsistencies = [];

      // 1. Check for campaigns marked as running in DB but not in memory
      const runningInDbSql = `
        SELECT id, name, status FROM campaigns 
        WHERE status = 'running'
      `;
      const { rows: runningInDb } = await this.db.query(runningInDbSql);

      for (const campaign of runningInDb) {
        const queue = this.scheduler.getActiveQueue(campaign.id);
        if (!queue) {
          inconsistencies.push({
            type: 'RUNNING_NOT_IN_MEMORY',
            campaignId: campaign.id,
            name: campaign.name,
            dbStatus: campaign.status,
            memoryStatus: null,
            suggestion: 'Mark as paused in database'
          });
        }
      }

      // 2. Check for campaigns in memory but with wrong status in DB
      const activeQueues = this.scheduler.getActiveQueues();
      for (const { campaignId, status } of activeQueues) {
        const checkSql = 'SELECT id, name, status FROM campaigns WHERE id = ?';
        const { rows } = await this.db.query(checkSql, [campaignId]);

        if (rows.length > 0 && rows[0].status !== status) {
          inconsistencies.push({
            type: 'STATUS_MISMATCH',
            campaignId,
            name: rows[0].name,
            dbStatus: rows[0].status,
            memoryStatus: status,
            suggestion: 'Update database to match memory status'
          });
        }
      }

      // 3. Check for stale locks (older than 10 minutes)
      const staleLocksSql = `
        SELECT id, name, processing_lock, lock_acquired_at FROM campaigns 
        WHERE processing_lock IS NOT NULL 
          AND lock_acquired_at < datetime('now', '-10 minutes')
      `;
      const { rows: staleLocks } = await this.db.query(staleLocksSql);

      for (const campaign of staleLocks) {
        inconsistencies.push({
          type: 'STALE_LOCK',
          campaignId: campaign.id,
          name: campaign.name,
          lockAcquiredAt: campaign.lock_acquired_at,
          suggestion: 'Clear stale lock'
        });
      }

      if (inconsistencies.length > 0) {
        logger.warn('State inconsistencies detected', {
          count: inconsistencies.length,
          types: [...new Set(inconsistencies.map(i => i.type))]
        });
      } else {
        logger.debug('No inconsistencies detected');
      }

      return inconsistencies;

    } catch (error) {
      logger.error('Error detecting inconsistencies', {
        error: error.message
      });
      return [];
    }
  }

  /**
   * Auto-corrects detected inconsistencies
   * @param {Array} inconsistencies - List of inconsistencies to correct
   */
  async autoCorrect(inconsistencies) {
    try {
      logger.info('Auto-correcting inconsistencies', {
        count: inconsistencies.length
      });

      let corrected = 0;

      for (const inconsistency of inconsistencies) {
        try {
          switch (inconsistency.type) {
            case 'RUNNING_NOT_IN_MEMORY':
              // Mark as paused since it's not actually running
              await this.db.query(
                'UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                ['paused', inconsistency.campaignId]
              );
              logger.info('Corrected RUNNING_NOT_IN_MEMORY', {
                campaignId: inconsistency.campaignId
              });
              corrected++;
              break;

            case 'STATUS_MISMATCH':
              // Update DB to match memory status
              await this.db.query(
                'UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [inconsistency.memoryStatus, inconsistency.campaignId]
              );
              logger.info('Corrected STATUS_MISMATCH', {
                campaignId: inconsistency.campaignId,
                newStatus: inconsistency.memoryStatus
              });
              corrected++;
              break;

            case 'STALE_LOCK':
              // Clear stale lock
              await this.db.query(
                'UPDATE campaigns SET processing_lock = NULL, lock_acquired_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [inconsistency.campaignId]
              );
              logger.info('Corrected STALE_LOCK', {
                campaignId: inconsistency.campaignId
              });
              corrected++;
              break;

            default:
              logger.warn('Unknown inconsistency type', {
                type: inconsistency.type
              });
          }

        } catch (error) {
          logger.error('Error correcting inconsistency', {
            type: inconsistency.type,
            campaignId: inconsistency.campaignId,
            error: error.message
          });
        }
      }

      logger.info('Auto-correction completed', {
        total: inconsistencies.length,
        corrected
      });

      return corrected;

    } catch (error) {
      logger.error('Error during auto-correction', {
        error: error.message
      });
      return 0;
    }
  }

  /**
   * Returns synchronizer statistics
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval
    };
  }
}

module.exports = StateSynchronizer;
