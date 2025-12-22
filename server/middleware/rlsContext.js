/**
 * RLS Context Middleware
 * Sets PostgreSQL session variables for Row Level Security policies
 * 
 * This middleware sets the following PostgreSQL settings:
 * - app.tenant_id: The tenant ID of the authenticated user
 * - app.user_role: The role of the authenticated user (superadmin, tenant_admin, user, etc.)
 * - app.user_id: The user ID of the authenticated user
 * 
 * These settings are used by RLS policies to filter data automatically.
 * 
 * Requirements: US-001, US-002, US-005
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

/**
 * Helper to get user ID from request (JWT or session)
 */
function getUserId(req) {
  return req.user?.id || req.session?.userId;
}

/**
 * Helper to get user role from request (JWT or session)
 */
function getUserRole(req) {
  return req.user?.user_metadata?.role || req.user?.role || req.session?.role;
}

/**
 * Helper to get tenant ID from request (JWT metadata, session, or context)
 */
function getTenantId(req) {
  return req.user?.user_metadata?.tenant_id || 
         req.user?.app_metadata?.tenant_id ||
         req.user?.tenantId || 
         req.tenantId || 
         req.session?.tenantId || 
         req.context?.tenantId;
}

/**
 * Middleware to set RLS context for database queries
 * Must be called after authentication middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function setRlsContext(req, res, next) {
  try {
    const userId = getUserId(req);
    const userRole = getUserRole(req);
    let tenantId = getTenantId(req);
    
    // If no tenant ID in JWT/session, try to fetch from database
    if (!tenantId && userId) {
      tenantId = await fetchTenantIdFromDatabase(userId);
    }
    
    // Store context in request for use by other middleware/routes
    req.rlsContext = {
      userId,
      userRole,
      tenantId
    };
    
    // Set PostgreSQL session variables for RLS
    if (tenantId || userRole) {
      await setPostgresContext(tenantId, userRole, userId);
    }
    
    logger.debug('RLS context set', {
      userId: userId?.substring(0, 8) + '...',
      userRole,
      tenantId: tenantId?.substring(0, 8) + '...',
      path: req.path
    });
    
    next();
  } catch (error) {
    logger.error('Failed to set RLS context', {
      error: error.message,
      path: req.path
    });
    
    // Don't block the request, just log the error
    // RLS will still work with service_role if context is not set
    next();
  }
}

/**
 * Fetch tenant ID from database based on user ID
 * Tries multiple tables: users, accounts (owner), agents
 * 
 * @param {string} userId - User ID
 * @returns {Promise<string|null>} Tenant ID or null
 */
async function fetchTenantIdFromDatabase(userId) {
  try {
    // Try users table first
    const { data: user } = await SupabaseService.adminClient
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single();
    
    if (user?.tenant_id) {
      return user.tenant_id;
    }
    
    // Try accounts table (owner)
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('tenant_id')
      .eq('owner_user_id', userId)
      .single();
    
    if (account?.tenant_id) {
      return account.tenant_id;
    }
    
    // Try agents table
    const { data: agent } = await SupabaseService.adminClient
      .from('agents')
      .select('accounts(tenant_id)')
      .eq('user_id', userId)
      .single();
    
    if (agent?.accounts?.tenant_id) {
      return agent.accounts.tenant_id;
    }
    
    return null;
  } catch (error) {
    logger.debug('Could not fetch tenant ID from database', {
      userId: userId?.substring(0, 8) + '...',
      error: error.message
    });
    return null;
  }
}

/**
 * Set PostgreSQL session variables for RLS
 * 
 * @param {string} tenantId - Tenant ID
 * @param {string} userRole - User role
 * @param {string} userId - User ID
 */
async function setPostgresContext(tenantId, userRole, userId) {
  try {
    const settings = [];
    
    if (tenantId) {
      settings.push(`SET LOCAL app.tenant_id = '${tenantId}'`);
    }
    
    if (userRole) {
      settings.push(`SET LOCAL app.user_role = '${userRole}'`);
    }
    
    if (userId) {
      settings.push(`SET LOCAL app.user_id = '${userId}'`);
    }
    
    if (settings.length > 0) {
      // Execute settings in a single query
      const sql = settings.join('; ');
      await SupabaseService.adminClient.rpc('exec_sql', { sql_query: sql });
    }
  } catch (error) {
    // Log but don't throw - RLS will still work with service_role
    logger.debug('Could not set PostgreSQL context', {
      error: error.message
    });
  }
}

/**
 * Middleware for superadmin routes
 * Sets user_role to 'superadmin' for RLS bypass
 */
async function setSuperadminContext(req, res, next) {
  try {
    req.rlsContext = {
      userId: req.superadmin?.id,
      userRole: 'superadmin',
      tenantId: null // Superadmins can access all tenants
    };
    
    await setPostgresContext(null, 'superadmin', req.superadmin?.id);
    
    next();
  } catch (error) {
    logger.error('Failed to set superadmin RLS context', {
      error: error.message,
      path: req.path
    });
    next();
  }
}

/**
 * Create a Supabase client with RLS context
 * Uses the user's JWT token if available, otherwise uses admin client with context
 * 
 * @param {Object} req - Express request object
 * @returns {Object} Supabase client
 */
function getClientWithRlsContext(req) {
  const authHeader = req.headers.authorization;
  
  // If user has a JWT token, create a user client (RLS will be applied automatically)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    return SupabaseService.createUserClient(token);
  }
  
  // Otherwise, use admin client (RLS bypass, but we've set context variables)
  return SupabaseService.adminClient;
}

module.exports = {
  setRlsContext,
  setSuperadminContext,
  getClientWithRlsContext,
  fetchTenantIdFromDatabase
};
