/**
 * Link Preview Service
 * 
 * Frontend service for fetching link preview metadata
 * 
 * Requirements: 1.1, 2.3
 */

import apiClient from '@/services/api-client'
import type { PlatformInfo } from '@/lib/platform-detector'

export interface LinkPreviewResponse {
  url: string
  domain: string
  title: string | null
  description: string | null
  image: string | null
  favicon: string | null
  platform: PlatformInfo | null
}

/**
 * Fetch link preview metadata from backend
 * @param url - URL to fetch preview for
 * @returns Link preview data
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewResponse> {
  try {
    const response = await apiClient.get('/link-preview', {
      params: { url },
      timeout: 6000 // Slightly longer than backend timeout
    })
    
    return response.data.data
  } catch (error) {
    // Return fallback response on error
    const domain = extractDomain(url)
    return {
      url,
      domain,
      title: domain.charAt(0).toUpperCase() + domain.slice(1),
      description: null,
      image: null,
      favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
      platform: null
    }
  }
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

export default {
  fetchLinkPreview
}
