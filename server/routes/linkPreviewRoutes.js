/**
 * Link Preview Routes
 * 
 * Endpoint for fetching link preview metadata
 * 
 * Requirements: 1.1, 3.1, 3.2
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const linkPreviewCache = require('../utils/linkPreviewCache');
const LinkPreviewService = require('../services/LinkPreviewService');

/**
 * GET /api/link-preview
 * 
 * Fetch OpenGraph metadata for a URL
 * 
 * Query params:
 * - url: The URL to fetch metadata for (required, URL-encoded)
 * 
 * Response:
 * - success: boolean
 * - data: LinkPreviewData object
 */
router.get('/', async (req, res) => {
  const { url } = req.query;

  // Validate URL parameter
  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'URL parameter is required'
    });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Invalid URL format'
    });
  }

  try {
    // Check cache first
    const cachedData = linkPreviewCache.get(url);
    if (cachedData) {
      logger.debug('Link preview cache hit', { url });
      return res.json({
        success: true,
        data: cachedData,
        cached: true
      });
    }

    // Fetch metadata
    logger.debug('Fetching link preview', { url });
    const metadata = await LinkPreviewService.fetchMetadata(url);

    // Store in cache
    linkPreviewCache.set(url, metadata);

    return res.json({
      success: true,
      data: metadata,
      cached: false
    });
  } catch (error) {
    logger.error('Link preview error', {
      url,
      error: error.message,
      endpoint: '/api/link-preview'
    });

    // Return fallback response instead of error
    const domain = LinkPreviewService.extractDomain(url);
    const platform = LinkPreviewService.detectPlatform(url);
    
    return res.json({
      success: true,
      data: {
        url,
        domain,
        title: platform?.name || domain,
        description: null,
        image: null,
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        platform
      },
      cached: false
    });
  }
});

module.exports = router;
