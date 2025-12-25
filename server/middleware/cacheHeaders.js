/**
 * Cache Headers Middleware (Task 5.3)
 * Configures appropriate cache headers for static assets
 */
const logger = require('../utils/logger');

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';

// Cache durations
const ONE_YEAR = 365 * 24 * 60 * 60; // 1 year in seconds
const ONE_HOUR = 60 * 60; // 1 hour in seconds
const NO_CACHE = 0;

/**
 * Determines cache duration based on file type and hash presence
 * @param {string} path - Request path
 * @returns {number} Cache duration in seconds
 */
function getCacheDuration(path) {
  // HTML files should never be cached (SPA entry point)
  if (path.endsWith('.html') || path === '/') {
    return NO_CACHE;
  }
  
  // Hashed assets (contain hash in filename) - cache for 1 year
  // Pattern: filename.abc123.ext or filename-abc123.ext
  const hashedPattern = /\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i;
  const hashedDashPattern = /-[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i;
  
  if (hashedPattern.test(path) || hashedDashPattern.test(path)) {
    return ONE_YEAR;
  }
  
  // Static assets without hash - cache for 1 hour
  const staticExtensions = /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico|json)$/i;
  if (staticExtensions.test(path)) {
    return ONE_HOUR;
  }
  
  // Default: no cache
  return NO_CACHE;
}

/**
 * Express middleware to set cache headers
 * @returns {Function} Express middleware
 */
function cacheHeadersMiddleware() {
  return (req, res, next) => {
    // Only apply to GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Skip API routes
    if (req.path.startsWith('/api') || req.path.startsWith('/health') || req.path.startsWith('/metrics')) {
      return next();
    }
    
    const cacheDuration = getCacheDuration(req.path);
    
    if (cacheDuration === NO_CACHE) {
      // No caching for HTML and dynamic content
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (cacheDuration === ONE_YEAR) {
      // Immutable caching for hashed assets
      res.setHeader('Cache-Control', `public, max-age=${cacheDuration}, immutable`);
    } else {
      // Standard caching with revalidation
      res.setHeader('Cache-Control', `public, max-age=${cacheDuration}, must-revalidate`);
    }
    
    // Add Vary header for proper caching with compression
    res.setHeader('Vary', 'Accept-Encoding');
    
    next();
  };
}

/**
 * Express middleware for API response caching
 * @param {number} maxAge - Cache duration in seconds
 * @returns {Function} Express middleware
 */
function apiCacheMiddleware(maxAge = 60) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }
    
    // Set cache headers for API responses
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}`);
    res.setHeader('Vary', 'Accept-Encoding, Authorization');
    
    next();
  };
}

/**
 * Middleware to add security headers alongside cache headers
 * @returns {Function} Express middleware
 */
function securityHeadersMiddleware() {
  return (req, res, next) => {
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Enable XSS filter
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions policy (disable unnecessary features)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    next();
  };
}

module.exports = {
  cacheHeadersMiddleware,
  apiCacheMiddleware,
  securityHeadersMiddleware,
  getCacheDuration,
  ONE_YEAR,
  ONE_HOUR,
  NO_CACHE
};
