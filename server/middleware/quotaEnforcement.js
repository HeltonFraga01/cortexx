/**
 * Quota Enforcement Middleware
 * 
 * Middleware to check and enforce user quotas before operations.
 * Returns 429 with quota info when exceeded.
 * 
 * Migrated to use module-level service initialization (Task 14.1)
 * 
 * Requirements: 3.1, 3.2
 */

const { logger } = require('../utils/logger');
const QuotaService = require('../services/QuotaService');
const { resolveUserId: resolveUserIdFromRequest, getUserToken } = require('../utils/userIdResolver');

// Module-level service instance (QuotaService now uses SupabaseService internally)
const quotaService = new QuotaService();

/**
 * Get the QuotaService instance
 * @returns {QuotaService} QuotaService instance
 */
function getQuotaService() {
  return quotaService;
}

/**
 * Resolve user ID from request based on authentication context
 * Uses centralized userIdResolver for consistency across all routes
 * 
 * @param {Object} req - Express request
 * @returns {string|null} User ID or null
 */
function resolveUserId(req) {
  return resolveUserIdFromRequest(req);
}

/**
 * Create quota enforcement middleware for a specific quota type
 * @param {string} quotaType - Type of quota to check
 * @param {number} [amount=1] - Amount to check/consume
 * @returns {Function} Express middleware
 */
function enforceQuota(quotaType, amount = 1) {
  return async (req, res, next) => {
    try {
      // FIXED: Get user ID from multiple sources based on auth context
      const userId = resolveUserId(req);
      
      if (!userId) {
        logger.warn('Quota check skipped - no user ID', { 
          quotaType,
          hasAccount: !!req.account,
          hasSession: !!req.session,
          hasUser: !!req.user,
          path: req.path
        });
        return next();
      }

      // Get userToken for resource counting (some resources use token as identifier)
      const userToken = getUserToken(req);
      
      // Check quota (pass userToken for resources that need it)
      const result = await quotaService.checkQuota(userId, quotaType, amount, userToken);

      // Log quota check for audit purposes
      logger.info('Quota check performed', {
        userId,
        quotaType,
        limit: result.limit,
        currentUsage: result.usage,
        remaining: result.remaining,
        requested: amount,
        allowed: result.allowed,
        path: req.path,
        method: req.method
      });

      if (!result.allowed) {
        logger.warn('Quota exceeded - access denied', {
          userId,
          quotaType,
          limit: result.limit,
          usage: result.usage,
          requested: amount,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        return res.status(429).json({
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: {
            quotaType,
            limit: result.limit,
            currentUsage: result.usage,
            remaining: result.remaining,
            requested: amount
          },
          message: `Você atingiu o limite de ${formatQuotaName(quotaType)}. Faça upgrade do seu plano para continuar.`
        });
      }

      // Store quota info for potential increment after successful operation
      req.quotaInfo = {
        quotaType,
        amount,
        userId
      };

      next();
    } catch (error) {
      logger.error('Quota enforcement error - check failed', {
        error: error.message,
        stack: error.stack,
        quotaType,
        userId: resolveUserId(req),
        path: req.path,
        method: req.method
      });
      
      // Don't block on quota check errors, but log them
      next();
    }
  };
}

/**
 * Middleware to increment quota usage after successful operation
 * Should be called after the main operation succeeds
 */
async function incrementQuotaUsage(req, res, next) {
  try {
    if (req.quotaInfo && res.statusCode >= 200 && res.statusCode < 300) {
      const { quotaType, amount, userId } = req.quotaInfo;
      await quotaService.incrementUsage(userId, quotaType, amount);
      
      logger.debug('Quota usage incremented', { userId, quotaType, amount });
    }
  } catch (error) {
    logger.error('Failed to increment quota usage', {
      error: error.message,
      quotaInfo: req.quotaInfo
    });
  }
  
  // Don't call next() - this is meant to be called after response
}

/**
 * Middleware to check multiple quotas at once
 * @param {Array<{quotaType: string, amount?: number}>} quotas - Quotas to check
 * @returns {Function} Express middleware
 */
function enforceMultipleQuotas(quotas) {
  return async (req, res, next) => {
    try {
      // FIXED: Use resolveUserId for consistent user identification
      const userId = resolveUserId(req);
      
      if (!userId) {
        return next();
      }

      const failures = [];
      
      for (const { quotaType, amount = 1 } of quotas) {
        const result = await quotaService.checkQuota(userId, quotaType, amount);
        
        if (!result.allowed) {
          failures.push({
            quotaType,
            limit: result.limit,
            currentUsage: result.usage,
            remaining: result.remaining,
            requested: amount
          });
        }
      }

      if (failures.length > 0) {
        logger.warn('Multiple quotas exceeded', { userId, failures });

        return res.status(429).json({
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          details: failures,
          message: 'One or more quotas have been exceeded. Please upgrade your plan.'
        });
      }

      // Store for potential increment
      req.quotaInfo = { quotas, userId };
      
      next();
    } catch (error) {
      logger.error('Multiple quota enforcement error', { error: error.message });
      next();
    }
  };
}

/**
 * Format quota type name for user-friendly display
 * @param {string} quotaType - Quota type
 * @returns {string} Formatted name
 */
function formatQuotaName(quotaType) {
  const names = {
    'max_agents': 'agentes',
    'max_connections': 'conexões',
    'max_messages_per_day': 'mensagens diárias',
    'max_messages_per_month': 'mensagens mensais',
    'max_inboxes': 'caixas de entrada',
    'max_teams': 'equipes',
    'max_webhooks': 'webhooks',
    'max_campaigns': 'campanhas',
    'max_storage_mb': 'armazenamento',
    'max_bots': 'bots'
  };
  
  return names[quotaType] || quotaType;
}

// Pre-configured middleware for common quota types
const quotaMiddleware = {
  messages: enforceQuota(QuotaService.QUOTA_TYPES.MAX_MESSAGES_PER_DAY),
  monthlyMessages: enforceQuota(QuotaService.QUOTA_TYPES.MAX_MESSAGES_PER_MONTH),
  agents: enforceQuota(QuotaService.QUOTA_TYPES.MAX_AGENTS),
  connections: enforceQuota(QuotaService.QUOTA_TYPES.MAX_CONNECTIONS),
  webhooks: enforceQuota(QuotaService.QUOTA_TYPES.MAX_WEBHOOKS),
  campaigns: enforceQuota(QuotaService.QUOTA_TYPES.MAX_CAMPAIGNS),
  inboxes: enforceQuota(QuotaService.QUOTA_TYPES.MAX_INBOXES),
  teams: enforceQuota(QuotaService.QUOTA_TYPES.MAX_TEAMS),
  bots: enforceQuota(QuotaService.QUOTA_TYPES.MAX_BOTS),
  storage: enforceQuota(QuotaService.QUOTA_TYPES.MAX_STORAGE_MB)
};

module.exports = {
  enforceQuota,
  enforceMultipleQuotas,
  incrementQuotaUsage,
  quotaMiddleware,
  getQuotaService,
  resolveUserId
};
