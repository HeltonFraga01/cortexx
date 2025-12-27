/**
 * CRM Worker - Background jobs for Contact CRM Evolution
 * 
 * Handles:
 * - Lead score decay (daily)
 * - Inactivity detection (daily)
 * - Segment re-evaluation (periodic)
 * 
 * Requirements: 2.4, 1.5, 7.2 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
const LeadScoringService = require('../services/LeadScoringService');
const ContactInteractionService = require('../services/ContactInteractionService');
const ContactSegmentService = require('../services/ContactSegmentService');

// Job intervals (in milliseconds)
const LEAD_DECAY_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const INACTIVITY_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const SEGMENT_EVAL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Track running state
let isRunning = false;
let intervals = {
  leadDecay: null,
  inactivityCheck: null,
  segmentEval: null
};

/**
 * Apply lead score decay for all accounts
 * Reduces score for contacts without recent interactions
 * Requirements: 2.4
 */
async function runLeadScoreDecay() {
  logger.info('Starting lead score decay job');
  
  try {
    // Get all accounts
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id');

    if (error) throw error;

    let totalDecayed = 0;
    let accountsProcessed = 0;

    for (const account of accounts || []) {
      try {
        const result = await LeadScoringService.applyDecay(account.id);
        totalDecayed += result.decayedCount || 0;
        accountsProcessed++;
      } catch (accountError) {
        logger.warn('Lead decay failed for account', {
          accountId: account.id,
          error: accountError.message
        });
      }
    }

    logger.info('Lead score decay job completed', {
      accountsProcessed,
      totalDecayed
    });

    return { accountsProcessed, totalDecayed };
  } catch (error) {
    logger.error('Lead score decay job failed', { error: error.message });
    throw error;
  }
}

/**
 * Check and update inactivity status for all accounts
 * Marks contacts as inactive after 30 days without interaction
 * Requirements: 1.5
 */
async function runInactivityCheck() {
  logger.info('Starting inactivity check job');
  
  try {
    // Get all accounts
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id');

    if (error) throw error;

    let totalMarkedInactive = 0;
    let accountsProcessed = 0;

    for (const account of accounts || []) {
      try {
        const result = await ContactInteractionService.checkInactivity(account.id);
        totalMarkedInactive += result.markedInactive || 0;
        accountsProcessed++;
      } catch (accountError) {
        logger.warn('Inactivity check failed for account', {
          accountId: account.id,
          error: accountError.message
        });
      }
    }

    logger.info('Inactivity check job completed', {
      accountsProcessed,
      totalMarkedInactive
    });

    return { accountsProcessed, totalMarkedInactive };
  } catch (error) {
    logger.error('Inactivity check job failed', { error: error.message });
    throw error;
  }
}

/**
 * Re-evaluate all dynamic segments
 * Updates membership based on current contact attributes
 * Requirements: 7.2
 */
async function runSegmentEvaluation() {
  logger.debug('Starting segment evaluation job');
  
  try {
    // Get all segments that need evaluation
    // Only evaluate segments not evaluated in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: segments, error } = await SupabaseService.adminClient
      .from('contact_segments')
      .select('id, name, account_id')
      .or(`last_evaluated_at.is.null,last_evaluated_at.lt.${fiveMinutesAgo}`)
      .limit(50); // Process in batches

    if (error) throw error;

    let segmentsEvaluated = 0;
    let totalMembersUpdated = 0;

    for (const segment of segments || []) {
      try {
        const result = await ContactSegmentService.evaluateSegment(segment.id);
        segmentsEvaluated++;
        totalMembersUpdated += result.memberCount || 0;
      } catch (segmentError) {
        logger.warn('Segment evaluation failed', {
          segmentId: segment.id,
          error: segmentError.message
        });
      }
    }

    if (segmentsEvaluated > 0) {
      logger.info('Segment evaluation job completed', {
        segmentsEvaluated,
        totalMembersUpdated
      });
    }

    return { segmentsEvaluated, totalMembersUpdated };
  } catch (error) {
    logger.error('Segment evaluation job failed', { error: error.message });
    throw error;
  }
}

/**
 * Create and start the CRM worker
 * @param {Object} options - Worker options
 * @returns {Object} Worker control object
 */
function createCRMWorker(options = {}) {
  const {
    enableLeadDecay = true,
    enableInactivityCheck = true,
    enableSegmentEval = true,
    leadDecayInterval = LEAD_DECAY_INTERVAL,
    inactivityCheckInterval = INACTIVITY_CHECK_INTERVAL,
    segmentEvalInterval = SEGMENT_EVAL_INTERVAL
  } = options;

  const worker = {
    isRunning: () => isRunning,

    start: () => {
      if (isRunning) {
        logger.warn('CRM worker already running');
        return;
      }

      isRunning = true;
      logger.info('Starting CRM worker', {
        enableLeadDecay,
        enableInactivityCheck,
        enableSegmentEval
      });

      // Schedule lead decay (daily)
      if (enableLeadDecay) {
        // Run immediately on start, then on interval
        runLeadScoreDecay().catch(err => 
          logger.error('Initial lead decay failed', { error: err.message })
        );
        
        intervals.leadDecay = setInterval(() => {
          runLeadScoreDecay().catch(err => 
            logger.error('Lead decay job error', { error: err.message })
          );
        }, leadDecayInterval);
      }

      // Schedule inactivity check (daily)
      if (enableInactivityCheck) {
        // Run immediately on start, then on interval
        runInactivityCheck().catch(err => 
          logger.error('Initial inactivity check failed', { error: err.message })
        );
        
        intervals.inactivityCheck = setInterval(() => {
          runInactivityCheck().catch(err => 
            logger.error('Inactivity check job error', { error: err.message })
          );
        }, inactivityCheckInterval);
      }

      // Schedule segment evaluation (every 5 minutes)
      if (enableSegmentEval) {
        intervals.segmentEval = setInterval(() => {
          runSegmentEvaluation().catch(err => 
            logger.error('Segment evaluation job error', { error: err.message })
          );
        }, segmentEvalInterval);
      }
    },

    stop: () => {
      if (!isRunning) {
        return;
      }

      logger.info('Stopping CRM worker');

      if (intervals.leadDecay) {
        clearInterval(intervals.leadDecay);
        intervals.leadDecay = null;
      }

      if (intervals.inactivityCheck) {
        clearInterval(intervals.inactivityCheck);
        intervals.inactivityCheck = null;
      }

      if (intervals.segmentEval) {
        clearInterval(intervals.segmentEval);
        intervals.segmentEval = null;
      }

      isRunning = false;
      logger.info('CRM worker stopped');
    },

    close: async () => {
      worker.stop();
      return Promise.resolve();
    },

    pause: async () => {
      worker.stop();
      return Promise.resolve();
    },

    resume: async () => {
      worker.start();
      return Promise.resolve();
    },

    // Manual job triggers
    runLeadDecay: runLeadScoreDecay,
    runInactivityCheck: runInactivityCheck,
    runSegmentEvaluation: runSegmentEvaluation
  };

  return worker;
}

module.exports = {
  createCRMWorker,
  runLeadScoreDecay,
  runInactivityCheck,
  runSegmentEvaluation
};
