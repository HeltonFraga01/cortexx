/**
 * Platform Detector
 * 
 * Detects social media platforms from URLs and provides branding info
 * 
 * Requirements: 3.1
 */

export type PlatformType = 
  | 'instagram' 
  | 'youtube' 
  | 'tiktok' 
  | 'twitter' 
  | 'facebook' 
  | 'linkedin'
  | 'whatsapp'
  | 'spotify'
  | 'github'
  | 'generic'

export interface PlatformInfo {
  platform: PlatformType
  name: string
  color: string
  icon: string
  title: string
}

interface PlatformConfig {
  platform: PlatformType
  name: string
  color: string
  icon: string
  getTitle: (url: URL) => string
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  'instagram.com': {
    platform: 'instagram',
    name: 'Instagram',
    color: '#E4405F',
    icon: 'Instagram',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/p/')) return 'Post do Instagram'
      if (path.includes('/reel/')) return 'Reel do Instagram'
      if (path.includes('/stories/')) return 'Story do Instagram'
      if (path.includes('/tv/')) return 'IGTV'
      return 'Instagram'
    }
  },
  'youtube.com': {
    platform: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    icon: 'Youtube',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/shorts/')) return 'YouTube Shorts'
      if (path.includes('/playlist')) return 'Playlist do YouTube'
      if (path.includes('/channel/') || path.includes('/@')) return 'Canal do YouTube'
      return 'Vídeo do YouTube'
    }
  },
  'youtu.be': {
    platform: 'youtube',
    name: 'YouTube',
    color: '#FF0000',
    icon: 'Youtube',
    getTitle: () => 'Vídeo do YouTube'
  },
  'tiktok.com': {
    platform: 'tiktok',
    name: 'TikTok',
    color: '#000000',
    icon: 'Music2',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/@')) return 'Perfil do TikTok'
      return 'Vídeo do TikTok'
    }
  },
  'twitter.com': {
    platform: 'twitter',
    name: 'X (Twitter)',
    color: '#000000',
    icon: 'Twitter',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/status/')) return 'Post do X'
      return 'X (Twitter)'
    }
  },
  'x.com': {
    platform: 'twitter',
    name: 'X',
    color: '#000000',
    icon: 'Twitter',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/status/')) return 'Post do X'
      return 'X'
    }
  },
  'facebook.com': {
    platform: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: 'Facebook',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/watch/')) return 'Vídeo do Facebook'
      if (path.includes('/reel/')) return 'Reel do Facebook'
      if (path.includes('/groups/')) return 'Grupo do Facebook'
      if (path.includes('/events/')) return 'Evento do Facebook'
      return 'Post do Facebook'
    }
  },
  'fb.watch': {
    platform: 'facebook',
    name: 'Facebook',
    color: '#1877F2',
    icon: 'Facebook',
    getTitle: () => 'Vídeo do Facebook'
  },
  'linkedin.com': {
    platform: 'linkedin',
    name: 'LinkedIn',
    color: '#0A66C2',
    icon: 'Linkedin',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/posts/')) return 'Post do LinkedIn'
      if (path.includes('/jobs/')) return 'Vaga no LinkedIn'
      if (path.includes('/company/')) return 'Empresa no LinkedIn'
      if (path.includes('/in/')) return 'Perfil do LinkedIn'
      return 'LinkedIn'
    }
  },
  'whatsapp.com': {
    platform: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    icon: 'MessageCircle',
    getTitle: () => 'Link do WhatsApp'
  },
  'wa.me': {
    platform: 'whatsapp',
    name: 'WhatsApp',
    color: '#25D366',
    icon: 'MessageCircle',
    getTitle: () => 'Link do WhatsApp'
  },
  'spotify.com': {
    platform: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    icon: 'Music',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/track/')) return 'Música no Spotify'
      if (path.includes('/album/')) return 'Álbum no Spotify'
      if (path.includes('/playlist/')) return 'Playlist do Spotify'
      if (path.includes('/artist/')) return 'Artista no Spotify'
      if (path.includes('/episode/')) return 'Episódio no Spotify'
      if (path.includes('/show/')) return 'Podcast no Spotify'
      return 'Spotify'
    }
  },
  'open.spotify.com': {
    platform: 'spotify',
    name: 'Spotify',
    color: '#1DB954',
    icon: 'Music',
    getTitle: (url) => {
      const path = url.pathname
      if (path.includes('/track/')) return 'Música no Spotify'
      if (path.includes('/album/')) return 'Álbum no Spotify'
      if (path.includes('/playlist/')) return 'Playlist do Spotify'
      if (path.includes('/artist/')) return 'Artista no Spotify'
      if (path.includes('/episode/')) return 'Episódio no Spotify'
      if (path.includes('/show/')) return 'Podcast no Spotify'
      return 'Spotify'
    }
  },
  'github.com': {
    platform: 'github',
    name: 'GitHub',
    color: '#181717',
    icon: 'Github',
    getTitle: (url) => {
      const path = url.pathname
      const parts = path.split('/').filter(Boolean)
      if (parts.length === 1) return 'Perfil do GitHub'
      if (parts.length === 2) return 'Repositório do GitHub'
      if (path.includes('/issues/')) return 'Issue do GitHub'
      if (path.includes('/pull/')) return 'Pull Request do GitHub'
      if (path.includes('/discussions/')) return 'Discussão do GitHub'
      return 'GitHub'
    }
  },
}

/**
 * Detects the platform from a URL
 * 
 * @param urlString - The URL to analyze
 * @returns Platform information or null if not a known platform
 */
export function detectPlatform(urlString: string): PlatformInfo | null {
  try {
    const url = new URL(urlString)
    const hostname = url.hostname.replace('www.', '').toLowerCase()

    // Check for exact match first
    const config = PLATFORM_CONFIGS[hostname]
    if (config) {
      return {
        platform: config.platform,
        name: config.name,
        color: config.color,
        icon: config.icon,
        title: config.getTitle(url),
      }
    }

    // Check for subdomain matches (e.g., m.facebook.com)
    for (const [domain, platformConfig] of Object.entries(PLATFORM_CONFIGS)) {
      if (hostname.endsWith(`.${domain}`) || hostname === domain) {
        return {
          platform: platformConfig.platform,
          name: platformConfig.name,
          color: platformConfig.color,
          icon: platformConfig.icon,
          title: platformConfig.getTitle(url),
        }
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Gets a generic preview title based on URL
 * 
 * @param urlString - The URL to analyze
 * @returns A title for the preview
 */
export function getGenericTitle(urlString: string): string {
  try {
    const url = new URL(urlString)
    const domain = url.hostname.replace('www.', '')
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    return 'Link'
  }
}

/**
 * Checks if a URL is from a known social media platform
 * 
 * @param urlString - The URL to check
 * @returns True if the URL is from a known platform
 */
export function isSocialMediaUrl(urlString: string): boolean {
  return detectPlatform(urlString) !== null
}

export default {
  detectPlatform,
  getGenericTitle,
  isSocialMediaUrl,
}
