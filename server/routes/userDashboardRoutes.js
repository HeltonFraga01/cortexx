/**
 * User Dashboard Routes
 * 
 * Endpoints for fetching dashboard metrics, message activity, and contact growth.
 * All routes require user authentication and scope data to the authenticated user's account.
 * 
 * Requirements: 1.1, 3.1, 7.1
 */

const router = require('express').Router();
const { requireAuth, getUserId } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const DashboardMetricsService = require('../services/DashboardMetricsService');
const SupabaseService = require('../services/SupabaseService');

/**
 * Helper to get account ID from user ID
 * Looks up the accounts table to find the account owned by this user
 * @param {string} userId - Supabase Auth user ID
 * @returns {Promise<string|null>} Account ID or null
 */
async function getAccountIdFromUser(userId) {
  if (!userId) return null;
  
  try {
    // Check if user is owner of an account
    const { data: account, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
      query.select('id').eq('owner_user_id', userId).single()
    );
    
    if (account) {
      return account.id;
    }
    
    // Check if user is an agent
    const { data: agent, error: agentError } = await SupabaseService.queryAsAdmin('agents', (query) =>
      query.select('account_id').eq('user_id', userId).eq('status', 'active').single()
    );
    
    if (agent) {
      return agent.account_id;
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting account ID from user', { userId, error: error.message });
    return null;
  }
}

/**
 * GET /api/user/dashboard-metrics
 * Get all dashboard metrics for the authenticated user's account
 * Query params:
 *   - inboxIds: comma-separated inbox IDs to filter by (optional)
 */
router.get('/dashboard-metrics', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const accountId = await getAccountIdFromUser(userId);
    
    if (!accountId) {
      logger.warn('No account found for user', { userId, endpoint: '/api/user/dashboard-metrics' });
      return res.status(403).json({ error: 'Nenhuma conta vinculada ao usuário' });
    }
    
    // Parse inbox filter from query params
    const inboxIds = req.query.inboxIds ? req.query.inboxIds.split(',').filter(Boolean) : null;
    
    const metrics = await DashboardMetricsService.getDashboardMetrics(accountId, inboxIds);
    
    res.json({ success: true, data: metrics });
  } catch (error) {
    logger.error('Failed to fetch dashboard metrics', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/user/dashboard-metrics'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/messages/activity
 * Get message activity data for charts
 * Query params:
 *   - days: number of days (default: 7)
 *   - inboxId: optional single inbox filter (legacy)
 *   - inboxIds: comma-separated inbox IDs to filter by (optional)
 */
router.get('/messages/activity', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const accountId = await getAccountIdFromUser(userId);
    
    if (!accountId) {
      logger.warn('No account found for user', { userId, endpoint: '/api/user/messages/activity' });
      return res.status(403).json({ error: 'Nenhuma conta vinculada ao usuário' });
    }
    
    const days = parseInt(req.query.days) || 7;
    // Support both single inboxId (legacy) and multiple inboxIds
    const inboxId = req.query.inboxId || null;
    const inboxIds = req.query.inboxIds ? req.query.inboxIds.split(',').filter(Boolean) : (inboxId ? [inboxId] : null);
    
    const activity = await DashboardMetricsService.getMessageActivity(accountId, days, inboxIds);
    
    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error('Failed to fetch message activity', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/user/messages/activity'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/contacts/growth
 * Get contact growth data for charts
 * Query params:
 *   - days: number of days (default: 30)
 *   - inboxIds: comma-separated inbox IDs to filter by (optional)
 */
router.get('/contacts/growth', requireAuth, async (req, res) => {
  try {
    const userId = getUserId(req);
    const accountId = await getAccountIdFromUser(userId);
    
    if (!accountId) {
      logger.warn('No account found for user', { userId, endpoint: '/api/user/contacts/growth' });
      return res.status(403).json({ error: 'Nenhuma conta vinculada ao usuário' });
    }
    
    const days = parseInt(req.query.days) || 30;
    const inboxIds = req.query.inboxIds ? req.query.inboxIds.split(',').filter(Boolean) : null;
    
    const growth = await DashboardMetricsService.getContactGrowth(accountId, days, inboxIds);
    
    res.json({ success: true, data: growth });
  } catch (error) {
    logger.error('Failed to fetch contact growth', {
      error: error.message,
      userId: req.user?.id,
      endpoint: '/api/user/contacts/growth'
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


module.exports = router;
