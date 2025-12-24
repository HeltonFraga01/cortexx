/**
 * Admin User Subscription Routes
 * 
 * Endpoints for managing user subscriptions.
 * All routes require admin authentication and tenant context.
 * 
 * Requirements: 2.1, 2.2, 2.3
 * Multi-Tenant Isolation: REQ-2
 */

const express = require('express');
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const TenantPlanService = require('../services/TenantPlanService');
const AdminAuditService = require('../services/AdminAuditService');
const SupabaseService = require('../services/SupabaseService');
const { normalizeToUUID, isUUID } = require('../utils/userIdHelper');

const router = express.Router();

let subscriptionService = null;
let auditService = null;

function getSubscriptionService() {
  if (!subscriptionService) {
    subscriptionService = new SubscriptionService();
  }
  return subscriptionService;
}

function getAuditService() {
  if (!auditService) {
    auditService = new AdminAuditService();
  }
  return auditService;
}

/**
 * Validate tenant context is present
 * @param {Object} req - Express request
 * @returns {string|null} Tenant ID or null if missing
 */
function getTenantId(req) {
  return req.context?.tenantId || null;
}

/**
 * Get user from Supabase Auth by ID
 * @param {string} userId - Supabase Auth user UUID
 * @returns {Promise<Object|null>} Auth user or null if not found
 */
async function getSupabaseAuthUser(userId) {
  try {
    // Validate UUID format
    if (!isUUID(userId)) {
      logger.debug('Invalid UUID format for Supabase Auth lookup', { 
        userId: userId?.substring(0, 8) + '...' 
      });
      return null;
    }

    const { data: { user }, error } = await SupabaseService.adminClient.auth.admin.getUserById(userId);
    
    if (error) {
      logger.debug('Supabase Auth user lookup failed', { 
        userId: userId.substring(0, 8) + '...', 
        error: error.message 
      });
      return null;
    }
    
    if (!user) {
      return null;
    }

    logger.debug('Supabase Auth user found', { 
      userId: userId.substring(0, 8) + '...', 
      email: user.email 
    });
    
    return user;
  } catch (error) {
    logger.error('Error fetching Supabase Auth user', { 
      userId: userId?.substring(0, 8) + '...', 
      error: error.message 
    });
    return null;
  }
}

/**
 * Create an account for a Supabase Auth user
 * @param {Object} authUser - Supabase Auth user object
 * @param {string} tenantId - Tenant ID to associate with the account
 * @returns {Promise<Object|null>} Created account or null if failed
 */
async function createAccountForAuthUser(authUser, tenantId) {
  try {
    const now = new Date().toISOString();
    const accountId = crypto.randomUUID();
    
    const accountData = {
      id: accountId,
      name: authUser.email || `User ${authUser.id.substring(0, 8)}`,
      owner_user_id: authUser.id,
      tenant_id: tenantId,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      status: 'active',
      settings: {
        maxAgents: 10,
        maxInboxes: 5,
        maxTeams: 5,
        features: ['messaging', 'webhooks', 'contacts']
      },
      created_at: now,
      updated_at: now
    };

    const { data: newAccount, error } = await SupabaseService.insert('accounts', accountData);
    
    if (error) {
      logger.error('Failed to create account for Supabase Auth user', { 
        userId: authUser.id, 
        tenantId, 
        error: error.message 
      });
      return null;
    }
    
    logger.info('Account created automatically for Supabase Auth user', { 
      accountId, 
      userId: authUser.id, 
      tenantId,
      email: authUser.email 
    });
    
    // Return the account data (insert may not return data depending on Supabase config)
    return newAccount || accountData;
  } catch (error) {
    logger.error('Error creating account for Supabase Auth user', { 
      userId: authUser.id, 
      tenantId, 
      error: error.message 
    });
    return null;
  }
}

/**
 * Validate that a user belongs to the admin's tenant
 * Falls back to Supabase Auth if no account exists, creating one automatically
 * 
 * @param {string} userId - User ID to validate (Supabase Auth UUID or WUZAPI hash)
 * @param {string} tenantId - Admin's tenant ID
 * @returns {Promise<Object|null>} Account if valid, null otherwise
 */
async function validateUserTenant(userId, tenantId) {
  try {
    // Use helper to normalize to UUID format
    const uuidUserId = normalizeToUUID(userId) || userId;

    // Step 1: Try to find existing account by owner_user_id or wuzapi_token
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, tenant_id, owner_user_id, wuzapi_token')
      .or(`owner_user_id.eq.${uuidUserId},wuzapi_token.eq.${userId}`)
      .limit(1);

    if (!error && accounts && accounts.length > 0) {
      const account = accounts[0];
      
      // Validate tenant ownership
      if (account.tenant_id !== tenantId) {
        logger.warn('Cross-tenant user access attempt blocked', {
          tenantId,
          userTenantId: account.tenant_id,
          userId: userId.substring(0, 8) + '...'
        });
        return null;
      }

      return account;
    }

    // Step 2: Fallback - Check if user exists in Supabase Auth
    logger.debug('Account not found, checking Supabase Auth', { 
      userId: userId.substring(0, 8) + '...' 
    });
    
    const authUser = await getSupabaseAuthUser(uuidUserId);
    if (!authUser) {
      logger.debug('User not found in Supabase Auth either', { 
        userId: userId.substring(0, 8) + '...' 
      });
      return null;
    }

    // Step 3: Create account for this Supabase Auth user
    logger.info('Creating account for Supabase Auth user', { 
      userId: authUser.id.substring(0, 8) + '...', 
      email: authUser.email,
      tenantId 
    });
    
    const newAccount = await createAccountForAuthUser(authUser, tenantId);
    if (!newAccount) {
      logger.error('Failed to create account for Supabase Auth user', { 
        userId: authUser.id,
        tenantId 
      });
      return null;
    }

    return newAccount;
  } catch (error) {
    logger.error('Error validating user tenant', { 
      error: error.message, 
      userId: userId?.substring(0, 8) + '...', 
      tenantId 
    });
    return null;
  }
}

/**
 * POST /api/admin/users/subscriptions/batch
 * Get subscriptions for multiple users in batch (tenant-scoped)
 * Useful for displaying plan info in user lists
 */
router.post('/subscriptions/batch', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array is required' });
    }

    if (userIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 user IDs per request' });
    }

    const service = getSubscriptionService();
    const subscriptions = await service.getUserSubscriptionsBatch(userIds, tenantId);

    logger.info('Batch subscriptions retrieved', {
      adminId: req.session.userId,
      tenantId,
      userCount: userIds.length,
      subscriptionCount: Object.keys(subscriptions).length,
      endpoint: '/api/admin/users/subscriptions/batch'
    });

    res.json({ success: true, data: subscriptions });
  } catch (error) {
    logger.error('Failed to get batch subscriptions', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      endpoint: '/api/admin/users/subscriptions/batch'
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/subscription
 * Get user subscription details (tenant-scoped)
 * Returns null data if user has no subscription (not 404)
 */
router.get('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const { userId } = req.params;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    const subscription = await service.getUserSubscription(userId);

    // Return success with null data if no subscription exists
    if (!subscription) {
      return res.json({ success: true, data: null });
    }

    logger.info('Subscription retrieved', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to get subscription', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/users/:userId/subscription
 * Update subscription status (tenant-scoped)
 */
router.put('/:userId/subscription', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const audit = getAuditService();
    const { userId } = req.params;
    const { status, reason } = req.body;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const validStatuses = Object.values(SubscriptionService.SUBSCRIPTION_STATUS);
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
      });
    }

    const subscription = await service.updateSubscriptionStatus(userId, status, reason);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        status === 'suspended' ? AdminAuditService.ACTION_TYPES.USER_SUSPENDED : 'subscription_status_updated',
        userId,
        { status, reason, tenantId },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Subscription status updated', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      status,
      endpoint: `/api/admin/users/${userId}/subscription`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to update subscription', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/users/:userId/subscription/assign-plan
 * Assign a plan to a user (tenant-scoped)
 */
router.post('/:userId/subscription/assign-plan', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const subService = getSubscriptionService();
    const audit = getAuditService();
    const { userId } = req.params;
    const { planId } = req.body;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!planId) {
      return res.status(400).json({ error: 'planId is required' });
    }

    // Verify plan exists AND belongs to this tenant
    const plan = await TenantPlanService.getPlanById(planId, tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get current subscription for audit
    const currentSub = await subService.getUserSubscription(userId);

    const subscription = await subService.assignPlan(userId, planId, req.session.userId);

    if (audit) {
      await audit.logAction(
        req.session.userId,
        AdminAuditService.ACTION_TYPES.USER_PLAN_ASSIGNED,
        userId,
        { 
          newPlanId: planId, 
          newPlanName: plan.name,
          previousPlanId: currentSub?.planId,
          previousPlanName: currentSub?.plan?.name,
          tenantId
        },
        req.ip,
        req.get('User-Agent')
      );
    }

    logger.info('Plan assigned to user', {
      adminId: req.session.userId,
      tenantId,
      targetUserId: userId,
      planId,
      planName: plan.name,
      endpoint: `/api/admin/users/${userId}/subscription/assign-plan`
    });

    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to assign plan', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/assign-plan`
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/users/:userId/subscription/proration
 * Calculate proration for plan change (tenant-scoped)
 */
router.get('/:userId/subscription/proration', requireAdmin, async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }

    const service = getSubscriptionService();
    const { userId } = req.params;
    const { newPlanId } = req.query;

    // Validate user belongs to admin's tenant
    const account = await validateUserTenant(userId, tenantId);
    if (!account) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!newPlanId) {
      return res.status(400).json({ error: 'newPlanId query parameter is required' });
    }

    // Verify plan exists AND belongs to this tenant
    const plan = await TenantPlanService.getPlanById(newPlanId, tenantId);
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const proration = await service.calculateProration(userId, newPlanId);

    res.json({ success: true, data: proration });
  } catch (error) {
    logger.error('Failed to calculate proration', {
      error: error.message,
      adminId: req.session.userId,
      tenantId: req.context?.tenantId,
      targetUserId: req.params.userId,
      endpoint: `/api/admin/users/${req.params.userId}/subscription/proration`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
