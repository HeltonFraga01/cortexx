const { logger } = require('../utils/logger');
const TenantService = require('../services/TenantService');

/**
 * Subdomain Router Middleware
 * Extracts subdomain from request hostname and sets tenant context
 * Requirements: 8.1, 8.4
 */

/**
 * Check if hostname is an IP address
 * @param {string} hostname - Hostname to check
 * @returns {boolean} True if IP address
 */
function isIPAddress(hostname) {
  if (!hostname) return false;
  const cleanHostname = hostname.split(':')[0];
  // IPv4 pattern
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6 pattern (simplified)
  const ipv6Pattern = /^[\da-fA-F:]+$/;
  return ipv4Pattern.test(cleanHostname) || ipv6Pattern.test(cleanHostname);
}

/**
 * Extract subdomain from hostname
 * Supports multiple development and production scenarios:
 * 
 * Development:
 *   - localhost:5173?tenant=xxx → uses query param
 *   - acmecorp.localhost:8080 → extracts 'acmecorp' (most common local dev pattern)
 *   - tenant.cortexx.local:5173 → extracts 'tenant'
 *   - X-Tenant-Subdomain header → uses header value
 * 
 * Production:
 *   - tenant.cortexx.online → extracts 'tenant'
 *   - superadmin.cortexx.online → extracts 'superadmin'
 * 
 * @param {string} hostname - Request hostname
 * @param {Object} req - Express request object (optional, for query/header fallback)
 * @returns {string|null} Extracted subdomain or null
 */
function extractSubdomain(hostname, req = null) {
  if (!hostname) return null;

  // Ignore IP addresses (used by internal health checks like Traefik)
  if (isIPAddress(hostname)) {
    return null;
  }

  // Remove port if present
  const cleanHostname = hostname.split(':')[0];
  
  // Split by dots
  const parts = cleanHostname.split('.');
  
  // ============================================
  // DEVELOPMENT MODE FALLBACKS
  // ============================================
  
  // Check for X-Tenant-Subdomain header (useful for API testing)
  if (req && req.headers && req.headers['x-tenant-subdomain']) {
    const headerSubdomain = req.headers['x-tenant-subdomain'];
    logger.debug('Using subdomain from X-Tenant-Subdomain header', { subdomain: headerSubdomain });
    return headerSubdomain;
  }
  
  // Check for ?tenant= query parameter (useful for localhost development)
  if (req && req.query && req.query.tenant) {
    const querySubdomain = req.query.tenant;
    logger.debug('Using subdomain from query parameter', { subdomain: querySubdomain });
    return querySubdomain;
  }
  
  // For plain localhost without subdomain simulation
  if (cleanHostname === 'localhost' || cleanHostname === '127.0.0.1') {
    // In development, if no tenant specified, return null to allow public routes
    // The frontend should redirect to login or show tenant selection
    logger.debug('Localhost detected without tenant specification');
    return null;
  }
  
  // ============================================
  // LOCAL DEVELOPMENT WITH *.localhost
  // ============================================
  
  // For development with subdomain.localhost (e.g., acmecorp.localhost)
  // This is the most common local development pattern
  if (parts.length === 2 && parts[1] === 'localhost') {
    // Handle: acmecorp.localhost → 'acmecorp'
    const subdomain = parts[0];
    logger.debug('Extracted subdomain from *.localhost pattern', { subdomain, hostname });
    return subdomain;
  }
  
  // ============================================
  // LOCAL DEVELOPMENT WITH /etc/hosts
  // ============================================
  
  // For development with .local domains (e.g., tenant.cortexx.local)
  if (parts.length >= 2 && parts[parts.length - 1] === 'local') {
    // Handle: tenant.cortexx.local → 'tenant'
    // Handle: cortexx.local → null (main domain)
    if (parts.length >= 3) {
      return parts[0];
    }
    return null;
  }
  
  // ============================================
  // PRODUCTION DOMAINS
  // ============================================
  
  // For production domains (e.g., tenant.cortexx.online)
  // Handle: tenant.cortexx.online → 'tenant'
  // Handle: cortexx.online → null (main domain)
  if (parts.length >= 3) {
    return parts[0];
  }
  
  // If no subdomain detected, return null
  return null;
}

/**
 * Subdomain router middleware
 * Sets tenant context based on subdomain
 */
async function subdomainRouter(req, res, next) {
  try {
    const hostname = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(hostname, req);

    // Log the request for debugging
    logger.debug('Processing subdomain request', {
      hostname,
      subdomain,
      path: req.path,
      method: req.method
    });

    // Handle superadmin subdomain specially
    if (subdomain === 'superadmin') {
      req.context = { 
        role: 'superadmin',
        subdomain: 'superadmin'
      };
      logger.debug('Superadmin context set', { hostname });
      return next();
    }

    // If no subdomain detected, allow public routes (landing page, etc.)
    if (!subdomain) {
      logger.debug('No subdomain detected, allowing public access', { hostname });
      req.context = { 
        role: 'public',
        subdomain: null
      };
      return next();
    }

    // Lookup tenant by subdomain
    const tenant = await TenantService.getBySubdomain(subdomain);
    
    if (!tenant) {
      logger.warn('Tenant not found for subdomain', { subdomain, hostname });
      return res.status(404).json({
        error: 'Tenant not found',
        message: 'The requested tenant was not found.',
        subdomain
      });
    }

    // Check if tenant is active
    if (tenant.status !== 'active') {
      logger.warn('Inactive tenant accessed', { 
        subdomain, 
        tenantId: tenant.id, 
        status: tenant.status 
      });
      
      const message = tenant.status === 'suspended' 
        ? 'This tenant has been suspended. Please contact support.'
        : 'This tenant is currently inactive.';
        
      return res.status(403).json({ 
        error: 'Tenant inactive',
        message,
        status: tenant.status
      });
    }

    // Set tenant context in request
    req.context = {
      tenantId: tenant.id,
      tenant: {
        id: tenant.id,
        subdomain: tenant.subdomain,
        name: tenant.name,
        status: tenant.status,
        branding: tenant.tenant_branding?.[0] || null
      },
      subdomain
    };

    logger.debug('Tenant context set successfully', {
      tenantId: tenant.id,
      subdomain: tenant.subdomain,
      tenantName: tenant.name
    });

    next();
  } catch (error) {
    logger.error('Subdomain router error', {
      error: error.message,
      hostname: req.get('host'),
      path: req.path
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process tenant request.'
    });
  }
}

/**
 * Middleware to require tenant context
 * Use this after subdomainRouter to ensure tenant context exists
 */
function requireTenantContext(req, res, next) {
  if (!req.context || (!req.context.tenantId && req.context.role !== 'superadmin')) {
    logger.warn('Missing tenant context', {
      path: req.path,
      method: req.method,
      context: req.context
    });
    
    return res.status(400).json({
      error: 'Missing tenant context',
      message: 'This endpoint requires a valid tenant context.'
    });
  }
  
  next();
}

/**
 * Middleware to set Supabase RLS context
 * Sets the tenant_id and user_role for RLS policies
 */
async function setRLSContext(req, res, next) {
  try {
    if (req.context?.tenantId) {
      // Set tenant_id for RLS policies
      req.supabaseContext = {
        'app.tenant_id': req.context.tenantId,
        'app.user_role': req.context.role || 'tenant_user'
      };
    } else if (req.context?.role === 'superadmin') {
      // Set superadmin role for RLS bypass
      req.supabaseContext = {
        'app.user_role': 'superadmin'
      };
    }
    
    next();
  } catch (error) {
    logger.error('Failed to set RLS context', {
      error: error.message,
      context: req.context
    });
    next();
  }
}

module.exports = {
  subdomainRouter,
  requireTenantContext,
  setRLSContext,
  extractSubdomain
};