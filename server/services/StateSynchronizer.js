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
const SupabaseService = require('./SupabaseService');

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
      const { error } = await SupabaseService.adminClient
        .from('bulk_campaigns')
        .update({
          current_index: progress?.currentIndex || 0,
          sent_count: progress?.stats?.sent || 0,
          failed_count: progress?.stats?.failed || 0,
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (error) throw error;

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
      const { data: rows, error } = await SupabaseService.adminClient
        .from('bulk_campaigns')
        .select('*')
        .or('status.eq.running,and(processing_lock.not.is.null,status.not.in.(completed,cancelled,failed))');

      if (error) throw error;

      if (!rows || rows.length === 0) {
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
          const { error: updateError } = await SupabaseService.adminClient
            .from('bulk_campaigns')
            .update({
              status: 'paused',
              processing_lock: null,
              lock_acquired_at: null,
              updated_at: new Date().toISOString()
            })
            .eq('id', campaign.id);

          if (updateError) throw updateError;

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
      const { data: runningInDb, error: runningError } = await SupabaseService.adminClient
        .from('bulk_campaigns')
        .select('id, name, status')
        .eq('status', 'running');

      if (runningError) throw runningError;

      for (const campaign of (runningInDb || [])) {
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
        const { data: rows, error: checkError } = await SupabaseService.adminClient
          .from('bulk_campaigns')
          .select('id, name, status')
          .eq('id', campaignId);

        if (checkError) throw checkError;

        if (rows && rows.length > 0 && rows[0].status !== status) {
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
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: staleLocks, error: staleError } = await SupabaseService.adminClient
        .from('bulk_campaigns')
        .select('id, name, processing_lock, lock_acquired_at')
        .not('processing_lock', 'is', null)
        .lt('lock_acquired_at', tenMinutesAgo);

      if (staleError) throw staleError;

      for (const campaign of (staleLocks || [])) {
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
              await SupabaseService.adminClient
                .from('bulk_campaigns')
                .update({ status: 'paused', updated_at: new Date().toISOString() })
                .eq('id', inconsistency.campaignId);
              logger.info('Corrected RUNNING_NOT_IN_MEMORY', {
                campaignId: inconsistency.campaignId
              });
              corrected++;
              break;

            case 'STATUS_MISMATCH':
              // Update DB to match memory status
              await SupabaseService.adminClient
                .from('bulk_campaigns')
                .update({ status: inconsistency.memoryStatus, updated_at: new Date().toISOString() })
                .eq('id', inconsistency.campaignId);
              logger.info('Corrected STATUS_MISMATCH', {
                campaignId: inconsistency.campaignId,
                newStatus: inconsistency.memoryStatus
              });
              corrected++;
              break;

            case 'STALE_LOCK':
              // Clear stale lock
              await SupabaseService.adminClient
                .from('bulk_campaigns')
                .update({ 
                  processing_lock: null, 
                  lock_acquired_at: null, 
                  updated_at: new Date().toISOString() 
                })
                .eq('id', inconsistency.campaignId);
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
