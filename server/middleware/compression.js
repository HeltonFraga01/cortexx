/**
 * Compression Middleware
 * 
 * Task 4: Enhanced compression with Brotli support
 * Uses shrink-ray-current for better compression ratios when available
 * Falls back to standard compression if shrink-ray is not installed
 * 
 * Brotli provides 15-20% better compression than gzip for text content
 */

const { logger } = require('../utils/logger');

// Try to load shrink-ray-current, but don't fail if not available
let shrinkRay = null;
try {
  shrinkRay = require('shrink-ray-current');
} catch (error) {
  // shrink-ray not available, will use fallback
}

/**
 * Create compression middleware with optimal settings
 * 
 * @param {Object} options - Configuration options
 * @param {number} options.brotliLevel - Brotli compression level (0-11, default: 4)
 * @param {number} options.gzipLevel - Gzip compression level (1-9, default: 6)
 * @param {number} options.threshold - Minimum size to compress (default: 1024)
 * @returns {Function} Express middleware
 */
function createCompressionMiddleware(options = {}) {
  if (!shrinkRay) {
    return createFallbackCompression();
  }

  const {
    brotliLevel = 4,  // Task 4.4: Balanced Brotli level
    gzipLevel = 6,    // Task 4.4: Balanced Gzip level
    threshold = 1024, // Only compress responses > 1KB
  } = options;

  return shrinkRay({
    // Compression levels
    brotli: {
      quality: brotliLevel,
    },
    zlib: {
      level: gzipLevel,
    },
    
    // Minimum size to compress
    threshold,
    
    // Cache compressed responses for better performance
    cache: (req, res) => {
      // Cache static assets longer
      if (req.path.match(/\.(js|css|html|json|svg|woff2?)$/)) {
        return true;
      }
      return false;
    },
    
    // Filter function to determine what to compress
    filter: (req, res) => {
      // Don't compress if client doesn't accept it
      if (req.headers['x-no-compression']) {
        return false;
      }
      
      // Don't compress already compressed content
      const contentType = res.getHeader('Content-Type');
      if (contentType && (
        contentType.includes('image/') ||
        contentType.includes('video/') ||
        contentType.includes('audio/') ||
        contentType.includes('application/zip') ||
        contentType.includes('application/gzip')
      )) {
        return false;
      }
      
      // Use default filter for other cases
      return shrinkRay.filter(req, res);
    },
  });
}

/**
 * Fallback compression middleware using standard compression
 * Used when shrink-ray is not available
 */
function createFallbackCompression() {
  const compression = require('compression');
  
  return compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  });
}

/**
 * Get compression middleware with fallback
 * Tries shrink-ray first, falls back to standard compression
 */
function getCompressionMiddleware(options = {}) {
  try {
    // Try to use shrink-ray for Brotli support
    const middleware = createCompressionMiddleware(options);
    logger.info('Using shrink-ray compression with Brotli support');
    return middleware;
  } catch (error) {
    // Fallback to standard compression
    logger.warn('shrink-ray not available, using standard compression', {
      error: error.message,
    });
    return createFallbackCompression();
  }
}

module.exports = {
  createCompressionMiddleware,
  createFallbackCompression,
  getCompressionMiddleware,
};
