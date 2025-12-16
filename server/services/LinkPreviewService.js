/**
 * Link Preview Service
 * 
 * Fetches and parses OpenGraph metadata from URLs
 * 
 * Requirements: 1.1, 4.1, 4.2, 4.4, 4.5
 */

const { logger } = require('../utils/logger');

const TIMEOUT_MS = 5000;
const MAX_REDIRECTS = 3;

// Platform configurations for known social media sites
const PLATFORM_CONFIGS = {
  'instagram.com': { platform: 'instagram', name: 'Instagram', color: '#E4405F', icon: 'Instagram' },
  'youtube.com': { platform: 'youtube', name: 'YouTube', color: '#FF0000', icon: 'Youtube' },
  'youtu.be': { platform: 'youtube', name: 'YouTube', color: '#FF0000', icon: 'Youtube' },
  'tiktok.com': { platform: 'tiktok', name: 'TikTok', color: '#000000', icon: 'Music2' },
  'twitter.com': { platform: 'twitter', name: 'X (Twitter)', color: '#000000', icon: 'Twitter' },
  'x.com': { platform: 'twitter', name: 'X', color: '#000000', icon: 'Twitter' },
  'facebook.com': { platform: 'facebook', name: 'Facebook', color: '#1877F2', icon: 'Facebook' },
  'fb.watch': { platform: 'facebook', name: 'Facebook', color: '#1877F2', icon: 'Facebook' },
  'linkedin.com': { platform: 'linkedin', name: 'LinkedIn', color: '#0A66C2', icon: 'Linkedin' },
  'spotify.com': { platform: 'spotify', name: 'Spotify', color: '#1DB954', icon: 'Music' },
  'open.spotify.com': { platform: 'spotify', name: 'Spotify', color: '#1DB954', icon: 'Music' },
  'github.com': { platform: 'github', name: 'GitHub', color: '#181717', icon: 'Github' },
  'whatsapp.com': { platform: 'whatsapp', name: 'WhatsApp', color: '#25D366', icon: 'MessageCircle' },
  'wa.me': { platform: 'whatsapp', name: 'WhatsApp', color: '#25D366', icon: 'MessageCircle' }
};

/**
 * Detect platform from URL
 * @param {string} urlString - URL to analyze
 * @returns {object|null} - Platform info or null
 */
function detectPlatform(urlString) {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.replace('www.', '').toLowerCase();

    // Check exact match
    if (PLATFORM_CONFIGS[hostname]) {
      return PLATFORM_CONFIGS[hostname];
    }

    // Check subdomain matches
    for (const [domain, config] of Object.entries(PLATFORM_CONFIGS)) {
      if (hostname.endsWith(`.${domain}`) || hostname === domain) {
        return config;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract domain from URL
 * @param {string} urlString - URL to parse
 * @returns {string} - Domain name
 */
function extractDomain(urlString) {
  try {
    const url = new URL(urlString);
    return url.hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

/**
 * Resolve relative URL to absolute
 * @param {string} relativeUrl - Relative or absolute URL
 * @param {string} baseUrl - Base URL for resolution
 * @returns {string|null} - Absolute URL or null
 */
function resolveUrl(relativeUrl, baseUrl) {
  if (!relativeUrl) return null;
  
  try {
    // Already absolute
    if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
      return relativeUrl;
    }
    
    // Protocol-relative
    if (relativeUrl.startsWith('//')) {
      const base = new URL(baseUrl);
      return `${base.protocol}${relativeUrl}`;
    }
    
    // Relative path
    return new URL(relativeUrl, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Parse HTML and extract OpenGraph metadata
 * @param {string} html - HTML content
 * @param {string} baseUrl - Base URL for resolving relative URLs
 * @returns {object} - Extracted metadata
 */
function parseHtmlMetadata(html, baseUrl) {
  const metadata = {
    title: null,
    description: null,
    image: null
  };

  // Extract og:title
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) {
    metadata.title = decodeHtmlEntities(ogTitleMatch[1]);
  }

  // Extract og:description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDescMatch) {
    metadata.description = decodeHtmlEntities(ogDescMatch[1]);
  }

  // Extract og:image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImageMatch) {
    // Decode HTML entities in image URL (e.g., &amp; -> &)
    const decodedImageUrl = decodeHtmlEntities(ogImageMatch[1]);
    metadata.image = resolveUrl(decodedImageUrl, baseUrl);
  }

  // Fallback to <title> tag
  if (!metadata.title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      metadata.title = decodeHtmlEntities(titleMatch[1].trim());
    }
  }

  // Fallback to meta description
  if (!metadata.description) {
    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    if (metaDescMatch) {
      metadata.description = decodeHtmlEntities(metaDescMatch[1]);
    }
  }

  return metadata;
}

/**
 * Decode HTML entities
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  
  // Decode numeric entities (&#xHEX; and &#DEC;)
  let decoded = text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
  
  // Decode named entities
  return decoded
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&copy;/g, '\u00A9')
    .replace(/&reg;/g, '\u00AE')
    .replace(/&trade;/g, '\u2122')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&hellip;/g, '\u2026')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D');
}

/**
 * Truncate description to max length
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateDescription(text, maxLength = 100) {
  if (!text) return null;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Get appropriate User-Agent for a domain
 * Some platforms like Instagram/Facebook only return OpenGraph data for specific crawlers
 * @param {string} domain - Domain name
 * @returns {string} - User-Agent string
 */
function getUserAgentForDomain(domain) {
  // Instagram and Facebook require their crawler User-Agent to return OpenGraph data
  const metaPlatforms = ['instagram.com', 'facebook.com', 'fb.watch', 'fb.com'];
  if (metaPlatforms.some(p => domain.includes(p))) {
    return 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
  }
  
  // Twitter/X also responds better to specific crawlers
  if (domain.includes('twitter.com') || domain.includes('x.com')) {
    return 'Twitterbot/1.0';
  }
  
  // Default User-Agent for other sites
  return 'Mozilla/5.0 (compatible; WUZAPIBot/1.0; +https://wuzapi.com)';
}

/**
 * Fetch metadata from URL
 * @param {string} urlString - URL to fetch
 * @returns {Promise<object>} - Link preview data
 */
async function fetchMetadata(urlString) {
  const domain = extractDomain(urlString);
  const platform = detectPlatform(urlString);
  const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

  // Base fallback response
  const fallbackResponse = {
    url: urlString,
    domain,
    title: platform?.name || domain.charAt(0).toUpperCase() + domain.slice(1),
    description: null,
    image: null,
    favicon,
    platform
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    // Use appropriate User-Agent for the domain
    const userAgent = getUserAgentForDomain(domain);

    const response = await fetch(urlString, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    clearTimeout(timeoutId);

    // Check if response is HTML
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      logger.debug('Non-HTML content type', { url: urlString, contentType });
      return fallbackResponse;
    }

    const html = await response.text();
    const metadata = parseHtmlMetadata(html, urlString);

    return {
      url: urlString,
      domain,
      title: metadata.title || fallbackResponse.title,
      description: truncateDescription(metadata.description),
      image: metadata.image,
      favicon,
      platform
    };
  } catch (error) {
    logger.warn('Failed to fetch link preview', { 
      url: urlString, 
      error: error.message 
    });
    return fallbackResponse;
  }
}

module.exports = {
  fetchMetadata,
  detectPlatform,
  extractDomain,
  resolveUrl,
  parseHtmlMetadata,
  truncateDescription
};
