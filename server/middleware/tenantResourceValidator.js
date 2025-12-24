/**
 * Tenant Resource Validator Middleware
 * 
 * Provides reusable middleware for validating that resources belong
 * to the requesting admin's tenant before allowing operations.
 * Supports both JWT (Supabase Auth) and session-based authentication.
 * 
 * CRITICAL: This middleware prevents cross-tenant data access.
 * 
 * Requirements: Multi-tenant isolation audit
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
const { normalizeToUUID, isUUID } = require('../utils/userIdHelper');

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
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
      return null;
    }

    const { data: { user }, error } = await SupabaseService.adminClient.auth.admin.getUserById(userId);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    logger.debug('Error fetching Supabase Auth user', { 
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
 * Validate that a user belongs to the specified tenant
 * Falls back to Supabase Auth if no account exists, creating one automatically
 * 
 * @param {string} userId - User ID to validate (Supabase Auth UUID or WUZAPI hash)
 * @param {string} tenantId - Tenant ID to check against
 * @param {object} options - Additional options
 * @param {boolean} options.createIfMissing - If true, create account for Auth users (default: true)
 * @returns {Promise<{valid: boolean, account: object|null}>}
 */
async function validateUserTenant(userId, tenantId, options = { createIfMissing: true }) {
  if (!userId || !tenantId) {
    return { valid: false, account: null };
  }

  try {
    // Normalize to UUID format
    const uuidUserId = normalizeToUUID(userId) || userId;

    // Step 1: Try to find existing account
    const { data: accounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('*')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.eq.${uuidUserId},wuzapi_token.eq.${userId}`)
      .limit(1);

    if (error) {
      logger.error('Failed to validate user tenant', { error: error.message, userId: userId.substring(0, 8) + '...', tenantId });
      return { valid: false, account: null };
    }

    if (accounts && accounts.length > 0) {
      return { valid: true, account: accounts[0] };
    }

    // Step 2: Fallback - Check if user exists in Supabase Auth
    const authUser = await getSupabaseAuthUser(uuidUserId);
    if (!authUser) {
      return { valid: false, account: null };
    }

    // Step 3: Create account for this Supabase Auth user (if enabled)
    if (options.createIfMissing) {
      logger.info('Creating account for Supabase Auth user', { 
        userId: authUser.id.substring(0, 8) + '...', 
        email: authUser.email,
        tenantId 
      });
      
      const newAccount = await createAccountForAuthUser(authUser, tenantId);
      if (newAccount) {
        return { valid: true, account: newAccount };
      }
    }

    // User exists in Auth but we couldn't create account
    return { valid: false, account: null };
  } catch (error) {
    logger.error('Error in validateUserTenant', { error: error.message, userId: userId?.substring(0, 8) + '...', tenantId });
    return { valid: false, account: null };
  }
}

/**
 * Filter userIds to only include users belonging to the specified tenant
 * @param {string[]} userIds - Array of user IDs to filter
 * @param {string} tenantId - Tenant ID to filter by
 * @returns {Promise<{validUserIds: string[], invalidUserIds: string[]}>}
 */
async function filterUsersByTenant(userIds, tenantId) {
  if (!userIds || userIds.length === 0) {
    return { validUserIds: [], invalidUserIds: [] };
  }

  if (!tenantId) {
    logger.warn('filterUsersByTenant called without tenantId');
    return { validUserIds: [], invalidUserIds: userIds };
  }

  try {
    const { data: validAccounts, error } = await SupabaseService.adminClient
      .from('accounts')
      .select('owner_user_id, wuzapi_token')
      .eq('tenant_id', tenantId)
      .or(`owner_user_id.in.(${userIds.join(',')}),wuzapi_token.in.(${userIds.join(',')})`);

    if (error) {
      logger.error('Failed to filter users by tenant', { error: error.message, tenantId });
      return { validUserIds: [], invalidUserIds: userIds };
    }

    const validUserIdSet = new Set();
    (validAccounts || []).forEach(account => {
      if (account.owner_user_id) validUserIdSet.add(account.owner_user_id);
      if (account.wuzapi_token) validUserIdSet.add(account.wuzapi_token);
    });

    const validUserIds = userIds.filter(id => validUserIdSet.has(id));
    const invalidUserIds = userIds.filter(id => !validUserIdSet.has(id));

    return { validUserIds, invalidUserIds };
  } catch (error) {
    logger.error('Error in filterUsersByTenant', { error: error.message, tenantId });
    return { validUserIds: [], invalidUserIds: userIds };
  }
}

/**
 * Middleware factory to validate that a resource belongs to the admin's tenant
 * @param {string} resourceTable - Database table name
 * @param {string} idParam - Request parameter name containing the resource ID (default: 'id')
 * @param {object} options - Additional options
 * @param {boolean} options.checkViaAccount - If true, check tenant via account relationship
 * @returns {Function} Express middleware
 */
function validateTenantResource(resourceTable, idParam = 'id', options = {}) {
  return async (req, res, next) => {
    try {
      const tenantId = req.context?.tenantId;
      const resourceId = req.params[idParam];

      if (!tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      if (!resourceId) {
        return res.status(400).json({ error: `${idParam} is required` });
      }

      const { data: resource, error } = await SupabaseService.getById(resourceTable, resourceId);

      if (error || !resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // Check tenant_id directly on resource
      let resourceTenantId = resource.tenant_id;

      // If resource doesn't have tenant_id, check via account
      if (!resourceTenantId && (resource.account_id || options.checkViaAccount)) {
        const accountId = resource.account_id;
        if (accountId) {
          const { data: account } = await SupabaseService.getById('accounts', accountId);
          resourceTenantId = account?.tenant_id;
        }
      }

      // If resource doesn't have tenant_id or account_id, check via user
      if (!resourceTenantId && resource.user_id) {
        const { valid } = await validateUserTenant(resource.user_id, tenantId);
        if (valid) {
          resourceTenantId = tenantId;
        }
      }

      if (resourceTenantId !== tenantId) {
        logger.warn('Cross-tenant resource access blocked', {
          type: 'security_violation',
          tenantId,
          resourceTenantId,
          resourceId,
          resourceTable,
          userId: getUserId(req),
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        });
        return res.status(403).json({ error: 'Access denied' });
      }

      // Attach resource to request for use in route handler
      req.resource = resource;
      req.resourceTenantId = resourceTenantId;
      next();
    } catch (error) {
      logger.error('Tenant resource validation error', { 
        error: error.message,
        resourceTable,
        idParam,
        tenantId: req.context?.tenantId
      });
      res.status(500).json({ error: 'Validation failed' });
    }
  };
}

/**
 * Middleware to require tenant context
 * Use this at the start of routes that need tenant isolation
 */
function requireTenantContext(req, res, next) {
  const tenantId = req.context?.tenantId;
  
  if (!tenantId) {
    logger.warn('Request without tenant context', {
      endpoint: req.path,
      method: req.method,
      userId: getUserId(req),
      ip: req.ip
    });
    return res.status(403).json({ error: 'Tenant context required' });
  }
  
  next();
}

/**
 * Middleware to validate userId parameter belongs to tenant
 * @param {string} userIdParam - Request parameter name containing the user ID (default: 'userId')
 */
function validateUserIdParam(userIdParam = 'userId') {
  return async (req, res, next) => {
    try {
      const tenantId = req.context?.tenantId;
      const userId = req.params[userIdParam];

      if (!tenantId) {
        return res.status(403).json({ error: 'Tenant context required' });
      }

      if (!userId) {
        return res.status(400).json({ error: `${userIdParam} is required` });
      }

      const { valid, account } = await validateUserTenant(userId, tenantId);
      
      if (!valid) {
        logger.warn('Cross-tenant user access blocked', {
          type: 'security_violation',
          tenantId,
          targetUserId: userId,
          adminId: getUserId(req),
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        });
        return res.status(403).json({ error: 'User not found or access denied' });
      }

      // Attach account to request for use in route handler
      req.targetAccount = account;
      req.targetUserId = userId;
      next();
    } catch (error) {
      logger.error('User tenant validation error', { 
        error: error.message,
        userIdParam,
        tenantId: req.context?.tenantId
      });
      res.status(500).json({ error: 'Validation failed' });
    }
  };
}

module.exports = {
  validateUserTenant,
  filterUsersByTenant,
  validateTenantResource,
  requireTenantContext,
  validateUserIdParam,
  // Helper functions for creating accounts
  getSupabaseAuthUser,
  createAccountForAuthUser
};
