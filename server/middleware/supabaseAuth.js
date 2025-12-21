/**
 * Supabase Authentication Middleware
 * Task 8.3: Create backend auth middleware for Supabase
 * Requirements: 8.1, 10.2, 10.3
 * 
 * Validates JWT tokens and creates user-scoped Supabase clients for RLS
 */

const { createClient } = require('@supabase/supabase-js');
const { logger } = require('../utils/logger');

// Initialize Supabase clients
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Service role client (bypasses RLS)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Extract subdomain from hostname
 * @param {string} hostname - Full hostname
 * @returns {string|null} Subdomain or null
 */
function extractSubdomain(hostname) {
  if (!hostname) return null;
  
  const cleanHostname = hostname.split(':')[0];
  const parts = cleanHostname.split('.');
  
  if (parts.length < 3) return null;
  
  const subdomain = parts[0];
  if (['www', 'api', 'superadmin', 'admin'].includes(subdomain)) {
    return null;
  }
  
  return subdomain;
}

/**
 * Middleware to validate Supabase JWT token
 * Extracts user info and attaches to request
 * Creates user-scoped Supabase client for RLS
 * Requirements: 8.1, 10.2, 10.3
 */
async function validateSupabaseToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Validate token and get user
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      logger.warn('Invalid Supabase token', { 
        error: error?.message,
        endpoint: req.path 
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }
    
    // Extract role from user_metadata - Requirement 8.1
    const userRole = user.user_metadata?.role || 'user';
    const tenantId = user.user_metadata?.tenant_id;
    
    // Attach user to request with role from metadata
    req.user = {
      id: user.id,
      email: user.email,
      role: userRole, // Role from user_metadata - Requirement 8.1
      supabaseRole: user.role, // Original Supabase role
      metadata: user.user_metadata,
      tenantId: tenantId
    };
    
    // Verify tenant access - Requirements: 10.2, 10.3
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname);
    
    if (subdomain && subdomain !== 'localhost') {
      // Resolve tenant from subdomain
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('id')
        .eq('subdomain', subdomain)
        .single();
      
      if (tenant && tenantId && tenant.id !== tenantId) {
        logger.warn('Tenant mismatch', {
          userId: user.id,
          userTenantId: tenantId,
          requestTenantId: tenant.id,
          subdomain,
          endpoint: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied: Tenant mismatch'
        });
      }
      
      req.tenantId = tenant?.id || tenantId;
    } else {
      req.tenantId = tenantId;
    }
    
    // Create user-scoped Supabase client (respects RLS)
    req.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Also attach admin client for service operations
    req.supabaseAdmin = supabaseAdmin;
    
    // Get user's account info
    const { data: accountData } = await req.supabase
      .rpc('get_user_account_id');
    
    if (accountData) {
      req.user.accountId = accountData;
      
      // Get user's role in account
      const { data: roleData } = await req.supabase
        .rpc('get_user_role_in_account', { p_account_id: accountData });
      
      req.user.accountRole = roleData;
    }
    
    logger.debug('Supabase auth successful', {
      userId: user.id,
      email: user.email,
      role: userRole,
      tenantId: req.tenantId,
      accountId: req.user.accountId,
      accountRole: req.user.accountRole,
      endpoint: req.path
    });
    
    next();
  } catch (error) {
    logger.error('Supabase auth middleware error', {
      error: error.message,
      stack: error.stack,
      endpoint: req.path
    });
    return res.status(500).json({
      success: false,
      error: 'Authentication error'
    });
  }
}

/**
 * Middleware to require specific user role from user_metadata
 * Must be used after validateSupabaseToken
 * Requirement: 8.1
 */
function requireUserRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: No user role'
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('User role access denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: `Access denied: Requires ${allowedRoles.join(' or ')} role`
      });
    }
    
    next();
  };
}

/**
 * Middleware to require specific account role
 * Must be used after validateSupabaseToken
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.accountRole) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: No account role'
      });
    }
    
    if (!allowedRoles.includes(req.user.accountRole)) {
      logger.warn('Role access denied', {
        userId: req.user.id,
        userRole: req.user.accountRole,
        requiredRoles: allowedRoles,
        endpoint: req.path
      });
      return res.status(403).json({
        success: false,
        error: `Access denied: Requires ${allowedRoles.join(' or ')} role`
      });
    }
    
    next();
  };
}

/**
 * Middleware to require account ownership
 * Must be used after validateSupabaseToken
 */
function requireOwner(req, res, next) {
  return requireRole('owner')(req, res, next);
}

/**
 * Middleware to require admin access (owner or administrator)
 * Must be used after validateSupabaseToken
 */
function requireAdmin(req, res, next) {
  return requireRole('owner', 'administrator')(req, res, next);
}

/**
 * Optional auth middleware - doesn't fail if no token
 * Useful for public endpoints that behave differently for authenticated users
 */
async function optionalSupabaseAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth, continue without user
    req.user = null;
    req.supabase = null;
    return next();
  }
  
  // Try to validate, but don't fail if invalid
  try {
    await validateSupabaseToken(req, res, () => {
      next();
    });
  } catch (error) {
    req.user = null;
    req.supabase = null;
    next();
  }
}

/**
 * Get the admin Supabase client (bypasses RLS)
 * Use for system operations like audit logging
 */
function getAdminClient() {
  return supabaseAdmin;
}

module.exports = {
  validateSupabaseToken,
  requireRole,
  requireUserRole,
  requireOwner,
  requireAdmin,
  optionalSupabaseAuth,
  getAdminClient,
  extractSubdomain
};
