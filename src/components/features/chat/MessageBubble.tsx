/**
 * MessageBubble Component
 * 
 * Displays a single message with status, reactions, and reply preview
 * 
 * Requirements: 2.1, 3.5, 4.1, 4.2, 5.4, 12.4
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import type { ChatMessage, MessageStatus } from '@/types/chat'
import { useChatApi } from '@/hooks/useChatApi'
import { 
  Check, 
  CheckCheck, 
  Clock, 
  AlertCircle, 
  Reply, 
  Copy, 
  MoreVertical,
  Smile,
  Download,
  MapPin,
  User,
  FileText,
  Play,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Instagram,
  Youtube,
  Twitter,
  Facebook,
  Linkedin,
  MessageCircle,
  Music,
  Github,
  Music2,
  Globe,
  Trash2
} from 'lucide-react'
import { formatWhatsAppText, hasWhatsAppFormatting } from '@/lib/whatsapp-formatter'
import { detectPlatform, getGenericTitle, type PlatformInfo } from '@/lib/platform-detector'
import { fetchLinkPreview as fetchLinkPreviewFromApi } from '@/services/link-preview'
import { truncateDescription } from '@/lib/utils'

interface MessageBubbleProps {
  message: ChatMessage
  onReply: (message: ChatMessage) => void
  onDelete?: (message: ChatMessage) => void
  searchQuery?: string
  showParticipant?: boolean // Show participant name for group messages
}

export function MessageBubble({ message, onReply, onDelete, searchQuery, showParticipant = false }: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false)
  const chatApi = useChatApi()
  const isOutgoing = message.direction === 'outgoing'
  const isPrivateNote = Boolean(message.isPrivateNote)
  const isGroupMessage = message.isGroupMessage || Boolean(message.participantJid)

  const handleCopy = useCallback(async () => {
    if (message.content) {
      try {
        await navigator.clipboard.writeText(message.content)
      } catch {
        // Silently fail - clipboard may not be available
      }
    }
  }, [message.content])

  const formattedTime = new Date(message.timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  })

  // Highlight search query in content
  const highlightedContent = searchQuery && message.content
    ? highlightText(message.content, searchQuery)
    : message.content

  return (
    <div
      className={cn(
        'flex group',
        isOutgoing ? 'justify-end' : 'justify-start'
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div
        className={cn(
          'relative max-w-[70%] rounded-lg px-3 py-2',
          isPrivateNote
            ? 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700'
            : isOutgoing
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
        )}
      >
        {/* Private note indicator */}
        {isPrivateNote && (
          <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1 font-medium">
            📝 Nota privada
          </div>
        )}

        {/* Group message participant name */}
        {showParticipant && isGroupMessage && !isOutgoing && message.participantName && (
          <div className="text-xs font-semibold text-primary mb-1 truncate max-w-[200px]">
            {message.participantName}
          </div>
        )}

        {/* Reply preview */}
        {message.replyToMessage && (
          <div
            className={cn(
              'mb-2 p-2 rounded border-l-2 text-sm',
              isOutgoing
                ? 'bg-primary-foreground/10 border-primary-foreground/50'
                : 'bg-background/50 border-muted-foreground/50'
            )}
          >
            <p className="text-xs opacity-70 mb-1">
              {message.replyToMessage.direction === 'incoming' 
                ? (message.replyToMessage.participantName || 'Contato')
                : 'Você'}
            </p>
            <p className="truncate opacity-80">
              {message.replyToMessage.content || '[Mídia]'}
            </p>
          </div>
        )}

        {/* Message content */}
        <MessageContent message={message} highlightedContent={highlightedContent} />

        {/* Footer with time, edit indicator, and status */}
        <div className={cn(
          'flex items-center justify-end gap-1 mt-1',
          isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
        )}>
          {message.isEdited && (
            <span className="text-xs opacity-70 flex items-center gap-0.5">
              ✏️ editada
            </span>
          )}
          <span className="text-xs">{formattedTime}</span>
          {isOutgoing && !isPrivateNote && (
            <MessageStatusIcon status={message.status} />
          )}
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="absolute -bottom-3 left-2 flex gap-1">
            {message.reactions.map((reaction, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 text-xs bg-background border rounded-full shadow-sm"
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}

        {/* Actions - compact inline menu */}
        <div
          className={cn(
            'absolute top-0 transition-all duration-150',
            isOutgoing ? '-left-[72px]' : '-right-[72px]',
            showActions && !isPrivateNote ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
          )}
        >
          <div className="flex items-center bg-card border border-border/50 rounded-md shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-r-none hover:bg-accent/80"
              onClick={() => onReply(message)}
              title="Responder"
            >
              <Reply className="h-3 w-3 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-none border-x border-border/30 hover:bg-accent/80"
              onClick={handleCopy}
              title="Copiar"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 rounded-l-none hover:bg-accent/80"
                  title="Mais opções"
                >
                  <MoreVertical className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isOutgoing ? 'start' : 'end'} className="min-w-[120px]">
                <DropdownMenuItem onClick={() => onReply(message)} className="text-xs py-1.5">
                  <Reply className="h-3 w-3 mr-2" />
                  Responder
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopy} className="text-xs py-1.5">
                  <Copy className="h-3 w-3 mr-2" />
                  Copiar
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(message)} 
                    className="text-xs py-1.5 text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}

interface MessageContentProps {
  message: ChatMessage
  highlightedContent: React.ReactNode
}

function MessageContent({ message, highlightedContent }: MessageContentProps) {
  switch (message.messageType) {
    case 'text':
      return (
        <TextMessageContent content={message.content} highlightedContent={highlightedContent} />
      )

    case 'image':
      return (
        <MediaImage message={message} highlightedContent={highlightedContent} />
      )

    case 'video':
      return (
        <MediaVideo message={message} highlightedContent={highlightedContent} />
      )

    case 'audio':
      return (
        <MediaAudio message={message} />
      )

    case 'document':
      return (
        <MediaDocument message={message} />
      )

    case 'location':
      const location = message.content ? JSON.parse(message.content) : null
      return (
        <div className="flex items-center gap-2 p-2 bg-background/20 rounded">
          <MapPin className="h-6 w-6 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">
              {location?.name || 'Localização'}
            </p>
            {location && (
              <p className="text-xs opacity-70">
                {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </p>
            )}
          </div>
        </div>
      )

    case 'contact':
      return (
        <div className="flex items-center gap-2 p-2 bg-background/20 rounded">
          <User className="h-6 w-6 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Contato compartilhado</p>
          </div>
        </div>
      )

    case 'sticker':
      return (
        <MediaSticker message={message} />
      )

    case 'poll':
    case 'poll_vote':
      return (
        <PollContent content={message.content} pollData={message.pollData} />
      )

    case 'view_once':
      return (
        <ViewOnceIndicator content={message.content} />
      )

    case 'interactive':
      return (
        <InteractiveContent content={message.content} interactiveData={message.interactiveData} />
      )

    case 'template':
      return (
        <TemplateContent content={message.content} />
      )

    case 'channel_comment':
      return (
        <ChannelCommentIndicator />
      )

    case 'deleted':
      return (
        <DeletedMessage />
      )

    case 'reaction':
      return (
        <p className="text-sm">{message.content || '👍'}</p>
      )

    case 'system':
      return null // System messages should not be displayed

    case 'unknown':
      return (
        <UnknownTypeMessage content={message.content} />
      )

    default:
      // For any unhandled type, show the content if available
      return (
        <p className="text-sm">{highlightedContent || message.content || `[${message.messageType}]`}</p>
      )
  }
}

// ==================== Text Message with Link Preview ====================

interface TextMessageContentProps {
  content: string | null
  highlightedContent: React.ReactNode
}

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi

function TextMessageContent({ content, highlightedContent }: TextMessageContentProps) {
  const [linkPreviews, setLinkPreviews] = useState<Map<string, LinkPreviewData | null>>(new Map())
  const [loadingUrls, setLoadingUrls] = useState<Set<string>>(new Set())

  // Extract URLs from content
  const urls = content ? Array.from(new Set(content.match(URL_REGEX) || [])) : []

  // Fetch link preview for URLs
  useEffect(() => {
    urls.forEach(url => {
      if (!linkPreviews.has(url) && !loadingUrls.has(url)) {
        fetchLinkPreviewData(url)
      }
    })
  }, [content])

  const fetchLinkPreviewData = async (url: string) => {
    setLoadingUrls(prev => new Set(prev).add(url))
    try {
      // Fetch from backend API for real OpenGraph metadata
      const apiResponse = await fetchLinkPreviewFromApi(url)
      
      // Use local platform detector for better fallback titles
      const platformInfo = detectPlatform(url) || apiResponse.platform
      
      const preview: LinkPreviewData = {
        url: apiResponse.url,
        domain: apiResponse.domain,
        title: apiResponse.title || platformInfo?.title || getGenericTitle(url),
        description: apiResponse.description || undefined,
        image: apiResponse.image || undefined,
        favicon: apiResponse.favicon || `https://www.google.com/s2/favicons?domain=${apiResponse.domain}&sz=32`,
        platform: platformInfo || undefined
      }
      
      setLinkPreviews(prev => new Map(prev).set(url, preview))
    } catch {
      // Fallback to local detection on error
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      const platformInfo = detectPlatform(url)
      
      const preview: LinkPreviewData = {
        url,
        domain,
        title: platformInfo?.title || getGenericTitle(url),
        favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
        platform: platformInfo || undefined
      }
      
      setLinkPreviews(prev => new Map(prev).set(url, preview))
    } finally {
      setLoadingUrls(prev => {
        const next = new Set(prev)
        next.delete(url)
        return next
      })
    }
  }

  // Render content with WhatsApp formatting and clickable links
  const renderFormattedContent = () => {
    if (!content) return highlightedContent

    // If highlightedContent is already processed (has search highlighting), use it
    if (typeof highlightedContent !== 'string' && highlightedContent !== content) {
      return highlightedContent
    }

    // Check if content has WhatsApp formatting
    if (hasWhatsAppFormatting(content)) {
      // Split by URLs first, then format non-URL parts
      const parts = content.split(URL_REGEX)
      
      return parts.map((part, index) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          )
        }
        // Apply WhatsApp formatting to non-URL parts
        return <span key={index}>{formatWhatsAppText(part)}</span>
      })
    }

    // No WhatsApp formatting, just handle links
    const parts = content.split(URL_REGEX)
    
    return parts.map((part, index) => {
      if (URL_REGEX.test(part)) {
        URL_REGEX.lastIndex = 0
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        )
      }
      return part
    })
  }

  // Get first URL for preview (only show one preview)
  const firstUrl = urls[0]
  const preview = firstUrl ? linkPreviews.get(firstUrl) : null
  const isLoading = firstUrl ? loadingUrls.has(firstUrl) : false

  return (
    <div className="space-y-2">
      <div className="text-sm whitespace-pre-wrap break-words">
        {renderFormattedContent()}
      </div>
      
      {/* Link Preview Card */}
      {firstUrl && (preview || isLoading) && (
        <LinkPreviewCard 
          url={firstUrl} 
          preview={preview} 
          isLoading={isLoading} 
        />
      )}
    </div>
  )
}

interface LinkPreviewData {
  url: string
  domain: string
  title: string
  description?: string
  image?: string
  favicon?: string
  platform?: PlatformInfo
}

// Platform icon mapping
const PlatformIcon = ({ platform, className, style }: { platform?: string; className?: string; style?: React.CSSProperties }) => {
  const props = { className, style }
  switch (platform) {
    case 'instagram':
      return <Instagram {...props} />
    case 'youtube':
      return <Youtube {...props} />
    case 'twitter':
      return <Twitter {...props} />
    case 'facebook':
      return <Facebook {...props} />
    case 'linkedin':
      return <Linkedin {...props} />
    case 'whatsapp':
      return <MessageCircle {...props} />
    case 'spotify':
      return <Music {...props} />
    case 'github':
      return <Github {...props} />
    case 'tiktok':
      return <Music2 {...props} />
    default:
      return <Globe {...props} />
  }
}

interface LinkPreviewCardProps {
  url: string
  preview: LinkPreviewData | null
  isLoading: boolean
}

function LinkPreviewCard({ url, preview, isLoading }: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false)

  if (isLoading) {
    return (
      <div className="rounded-lg bg-background/20 border border-border/30 overflow-hidden">
        {/* Loading skeleton */}
        <div className="animate-pulse">
          <div className="h-24 bg-muted/30" />
          <div className="p-2.5 space-y-2">
            <div className="h-3 bg-muted/30 rounded w-3/4" />
            <div className="h-2 bg-muted/30 rounded w-1/2" />
          </div>
        </div>
      </div>
    )
  }

  if (!preview) return null

  const hasPlatform = preview.platform?.platform && preview.platform.platform !== 'generic'
  const hasImage = preview.image && !imageError
  
  // Check if description is duplicate or redundant (common with Instagram/social media)
  // Instagram descriptions often follow pattern: "X likes, Y comments - user on Date: 'title excerpt...'"
  const isRedundantDescription = (() => {
    if (!preview.description || !preview.title) return false
    
    // Exact match
    if (preview.description === preview.title) return true
    
    // Instagram pattern: description contains likes/comments count (e.g., "2,936 likes, 170 comments")
    const isInstagramPattern = /^[\d,]+\s*likes?,?\s*[\d,]+\s*comments?/i.test(preview.description)
    if (isInstagramPattern) return true
    
    // Generic social media: description repeats significant part of title
    const normalizeForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
    const titleNorm = normalizeForCompare(preview.title)
    const descNorm = normalizeForCompare(preview.description)
    
    // If description contains first 30 chars of title (normalized), it's redundant
    if (titleNorm.length >= 30 && descNorm.includes(titleNorm.slice(0, 30))) return true
    
    return false
  })()
  
  const truncatedDescription = isRedundantDescription ? null : truncateDescription(preview.description, 100)

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-lg bg-background/20 border border-border/30 hover:bg-background/30 transition-colors overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Preview image */}
      {hasImage && (
        <div className="relative w-full max-h-32 overflow-hidden bg-muted/20">
          <img 
            src={preview.image} 
            alt="" 
            className="w-full h-full object-cover max-h-32"
            onError={() => setImageError(true)}
          />
          {/* Platform badge on image */}
          {hasPlatform && (
            <div 
              className="absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center"
              style={{ backgroundColor: preview.platform!.color }}
            >
              <PlatformIcon 
                platform={preview.platform!.platform} 
                className="w-3.5 h-3.5 text-white"
              />
            </div>
          )}
        </div>
      )}
      
      <div className="p-2.5">
        <div className="flex items-start gap-2.5">
          {/* Platform icon or favicon (only if no image) */}
          {!hasImage && (
            hasPlatform ? (
              <div 
                className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${preview.platform!.color}20` }}
              >
                <PlatformIcon 
                  platform={preview.platform!.platform} 
                  className="w-4 h-4"
                  style={{ color: preview.platform!.color }}
                />
              </div>
            ) : preview.favicon && (
              <img 
                src={preview.favicon} 
                alt="" 
                className="w-5 h-5 mt-0.5 rounded-sm flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium line-clamp-2">{preview.title}</p>
            {truncatedDescription && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{truncatedDescription}</p>
            )}
            <p className="text-xs text-muted-foreground/70 mt-1">{preview.domain}</p>
          </div>
          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        </div>
      </div>
    </a>
  )
}

// ==================== Media Components ====================

interface MediaComponentProps {
  message: ChatMessage
  highlightedContent?: React.ReactNode
}

function MediaImage({ message, highlightedContent }: MediaComponentProps) {
  const chatApi = useChatApi()
  const [mediaData, setMediaData] = useState<{ url?: string; base64?: string; thumbnail?: string; mimeType?: string; isThumbnail?: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // Check if we have a valid S3 URL (permanent) or other direct URL
  const hasDirectUrl = message.mediaUrl && message.mediaUrl.startsWith('http')
  const isS3Url = message.mediaUrl && (
    message.mediaUrl.includes('s3.') || 
    message.mediaUrl.includes('.s3.') ||
    message.mediaUrl.includes('/media/')
  )

  const handleLoadMedia = async () => {
    if (mediaData || isLoading || hasAttemptedLoad) return
    
    setIsLoading(true)
    setError(null)
    setHasAttemptedLoad(true)
    try {
      const data = await chatApi.downloadMedia(message.id)
      // Check if we got any useful data
      if (data.url || data.base64 || data.thumbnail) {
        setMediaData(data)
      } else if (data.error) {
        // API returned an error
        setError('Mídia não disponível')
        setMediaData({ error: data.error })
      } else {
        setError('Mídia não disponível')
      }
    } catch (err) {
      setError('Não foi possível carregar')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load media when component mounts (if no direct URL)
  useEffect(() => {
    if (!hasDirectUrl && !mediaData && !isLoading && !hasAttemptedLoad) {
      handleLoadMedia()
    }
  }, [hasDirectUrl, mediaData, isLoading, hasAttemptedLoad])

  // Handle base64 data - it may already include the data: prefix or not
  const getBase64Url = (base64: string, mimeType: string) => {
    if (base64.startsWith('data:')) return base64
    return `data:${mimeType};base64,${base64}`
  }

  const imageUrl = hasDirectUrl 
    ? message.mediaUrl 
    : mediaData?.url 
    || (mediaData?.base64 ? getBase64Url(mediaData.base64, mediaData.mimeType || 'image/jpeg') : null)
    || (mediaData?.thumbnail ? getBase64Url(mediaData.thumbnail, 'image/jpeg') : null)

  return (
    <div className="space-y-2">
      <div className="relative rounded overflow-hidden">
        {isLoading ? (
          <div className="w-48 h-32 bg-muted/50 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt="Imagem"
              className="max-w-full max-h-64 object-contain cursor-pointer"
              onClick={() => setShowLightbox(true)}
            />
            {showLightbox && (
              <Lightbox
                imageUrl={imageUrl}
                onClose={() => setShowLightbox(false)}
              />
            )}
          </>
        ) : (
          <div 
            className="w-48 h-32 bg-muted/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/70 transition-colors"
            onClick={handleLoadMedia}
          >
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            {error ? (
              <span className="text-xs text-muted-foreground">{error}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Clique para carregar</span>
            )}
          </div>
        )}
        {mediaData?.isThumbnail && (
          <div className="absolute bottom-1 right-1 bg-black/50 text-white text-xs px-1 rounded">
            Preview
          </div>
        )}
      </div>
      {message.content && (
        <div className="text-sm whitespace-pre-wrap break-words">
          {hasWhatsAppFormatting(message.content) 
            ? formatWhatsAppText(message.content)
            : highlightedContent
          }
        </div>
      )}
    </div>
  )
}

function MediaVideo({ message, highlightedContent }: MediaComponentProps) {
  const chatApi = useChatApi()
  const [mediaData, setMediaData] = useState<{ url?: string; base64?: string; mimeType?: string; error?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  const hasDirectUrl = message.mediaUrl && message.mediaUrl.startsWith('http')

  const handleLoadVideo = async () => {
    if (mediaData || isLoading || hasAttemptedLoad) return
    
    setIsLoading(true)
    setError(null)
    setHasAttemptedLoad(true)
    try {
      const data = await chatApi.downloadMedia(message.id)
      if (data.url || data.base64) {
        setMediaData(data)
      } else if (data.error) {
        setError('Vídeo não disponível')
        setMediaData({ error: data.error })
      } else {
        setError('Vídeo não disponível')
      }
    } catch (err) {
      setError('Não foi possível carregar')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load video when component mounts
  useEffect(() => {
    if (!hasDirectUrl && !mediaData && !isLoading && !hasAttemptedLoad) {
      handleLoadVideo()
    }
  }, [hasDirectUrl, mediaData, isLoading, hasAttemptedLoad])

  // Handle base64 data - it may already include the data: prefix or not
  const getBase64Url = (base64: string, mimeType: string) => {
    if (base64.startsWith('data:')) return base64
    return `data:${mimeType};base64,${base64}`
  }

  const videoUrl = hasDirectUrl 
    ? message.mediaUrl 
    : mediaData?.url || (mediaData?.base64 ? getBase64Url(mediaData.base64, mediaData.mimeType || message.mediaMimeType || 'video/mp4') : null)

  return (
    <div className="space-y-2">
      <div className="relative rounded overflow-hidden bg-muted/50 w-48 h-32 flex items-center justify-center">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : videoUrl ? (
          <>
            <video
              src={videoUrl}
              className="max-w-full max-h-64 cursor-pointer object-cover"
              onClick={() => setShowLightbox(true)}
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer" onClick={() => setShowLightbox(true)}>
              <Play className="h-12 w-12 text-white drop-shadow-lg" />
            </div>
            {showLightbox && (
              <Lightbox
                videoUrl={videoUrl}
                onClose={() => setShowLightbox(false)}
              />
            )}
          </>
        ) : (
          <div 
            className="flex flex-col items-center gap-1 cursor-pointer"
            onClick={handleLoadVideo}
          >
            <Play className="h-8 w-8 text-muted-foreground" />
            {error ? (
              <span className="text-xs text-muted-foreground">{error}</span>
            ) : (
              <span className="text-xs text-muted-foreground">Carregar vídeo</span>
            )}
          </div>
        )}
      </div>
      {message.content && (
        <div className="text-sm whitespace-pre-wrap break-words">
          {hasWhatsAppFormatting(message.content) 
            ? formatWhatsAppText(message.content)
            : highlightedContent
          }
        </div>
      )}
    </div>
  )
}

function MediaAudio({ message }: { message: ChatMessage }) {
  const chatApi = useChatApi()
  const [mediaData, setMediaData] = useState<{ url?: string; base64?: string; mimeType?: string; error?: string } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  const hasDirectUrl = message.mediaUrl && message.mediaUrl.startsWith('http')

  const handleLoadAudio = async () => {
    if (mediaData || isLoading || hasAttemptedLoad) return
    
    setIsLoading(true)
    setError(null)
    setHasAttemptedLoad(true)
    try {
      const data = await chatApi.downloadMedia(message.id)
      if (data.url || data.base64) {
        setMediaData(data)
      } else if (data.error) {
        setError('Áudio não disponível')
        setMediaData({ error: data.error })
      } else {
        setError('Áudio não disponível')
      }
    } catch (err) {
      setError('Não foi possível carregar')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load audio when component mounts
  useEffect(() => {
    if (!hasDirectUrl && !mediaData && !isLoading && !hasAttemptedLoad) {
      handleLoadAudio()
    }
  }, [hasDirectUrl, mediaData, isLoading, hasAttemptedLoad])

  // Handle base64 data - it may already include the data: prefix or not
  const getBase64Url = (base64: string, mimeType: string) => {
    if (base64.startsWith('data:')) return base64
    return `data:${mimeType};base64,${base64}`
  }

  const audioUrl = hasDirectUrl 
    ? message.mediaUrl 
    : mediaData?.url || (mediaData?.base64 ? getBase64Url(mediaData.base64, mediaData.mimeType || message.mediaMimeType || 'audio/ogg') : null)

  const togglePlay = () => {
    if (!audioRef.current) return
    
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(err => {
        console.error('Error playing audio:', err)
        setError('Erro ao reproduzir')
      })
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    audioRef.current.currentTime = percentage * duration
  }

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  if (audioUrl) {
    return (
      <div className="min-w-[240px] max-w-[300px] p-3 rounded-lg bg-background/20">
        <audio 
          ref={audioRef}
          src={audioUrl} 
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          onError={(e) => {
            const audio = e.currentTarget as HTMLAudioElement
            const errorCode = audio.error?.code
            const errorMessage = audio.error?.message
            console.error('Audio load error:', { errorCode, errorMessage, src: audioUrl?.substring(0, 100) })
            setError('Erro ao carregar áudio')
          }}
          preload="metadata"
        />
        
        <div className="flex items-center gap-3">
          {/* Play/Pause Button - Larger touch target */}
          <button
            onClick={togglePlay}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors"
            aria-label={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </button>
          
          <div className="flex-1 min-w-0">
            {/* Progress bar - Larger click area */}
            <div 
              className="h-6 flex items-center cursor-pointer group"
              onClick={handleSeek}
            >
              <div className="w-full h-1.5 bg-muted-foreground/30 rounded-full overflow-hidden group-hover:h-2 transition-all">
                <div 
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            
            {/* Time display */}
            <div className="flex justify-between text-xs opacity-70 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        
        {error && (
          <p className="text-xs text-destructive mt-2">{error}</p>
        )}
      </div>
    )
  }

  return (
    <div className="min-w-[240px] max-w-[300px] p-3 rounded-lg bg-background/20">
      <div className="flex items-center gap-3">
        <button
          onClick={handleLoadAudio}
          disabled={isLoading}
          className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center transition-colors disabled:opacity-50"
          aria-label="Carregar áudio"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </button>
        
        <div className="flex-1">
          <div className="h-1.5 bg-muted-foreground/30 rounded-full" />
          <p className="text-xs opacity-70 mt-2">
            {error || 'Clique para carregar'}
          </p>
        </div>
      </div>
    </div>
  )
}

function MediaDocument({ message }: { message: ChatMessage }) {
  const chatApi = useChatApi()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async () => {
    const hasDirectUrl = message.mediaUrl && message.mediaUrl.startsWith('http')
    
    if (hasDirectUrl) {
      window.open(message.mediaUrl, '_blank')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const data = await chatApi.downloadMedia(message.id)
      
      if (data.url) {
        window.open(data.url, '_blank')
      } else if (data.base64) {
        // Create download link from base64
        const link = document.createElement('a')
        link.href = `data:${data.mimeType || 'application/octet-stream'};base64,${data.base64}`
        link.download = message.mediaFilename || 'documento'
        link.click()
      } else if (data.error) {
        setError('Documento não disponível')
      } else {
        setError('Documento não disponível')
      }
    } catch (err) {
      setError('Erro ao baixar')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-2 bg-background/20 rounded">
      <FileText className="h-8 w-8 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {message.mediaFilename || 'Documento'}
        </p>
        {error ? (
          <p className="text-xs text-destructive truncate">{error}</p>
        ) : message.content ? (
          <p className="text-xs opacity-70 truncate">{message.content}</p>
        ) : null}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        className="h-8 w-8"
        onClick={handleDownload}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

function MediaSticker({ message }: { message: ChatMessage }) {
  const chatApi = useChatApi()
  const [mediaData, setMediaData] = useState<{ url?: string; base64?: string; thumbnail?: string; mimeType?: string; isThumbnail?: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false)
  const [showLightbox, setShowLightbox] = useState(false)

  // Check if we have a valid direct URL
  const hasDirectUrl = message.mediaUrl && message.mediaUrl.startsWith('http')

  const handleLoadMedia = async () => {
    if (mediaData || isLoading || hasAttemptedLoad) return
    
    setIsLoading(true)
    setError(null)
    setHasAttemptedLoad(true)
    try {
      const data = await chatApi.downloadMedia(message.id)
      if (data.url || data.base64 || data.thumbnail) {
        setMediaData(data)
      } else if (data.error) {
        setError('Sticker não disponível')
        setMediaData({ error: data.error })
      } else {
        setError('Sticker não disponível')
      }
    } catch (err) {
      setError('Não foi possível carregar')
    } finally {
      setIsLoading(false)
    }
  }

  // Auto-load media when component mounts (if no direct URL)
  useEffect(() => {
    if (!hasDirectUrl && !mediaData && !isLoading && !hasAttemptedLoad) {
      handleLoadMedia()
    }
  }, [hasDirectUrl, mediaData, isLoading, hasAttemptedLoad])

  // Handle base64 data
  const getBase64Url = (base64: string, mimeType: string) => {
    if (base64.startsWith('data:')) return base64
    return `data:${mimeType};base64,${base64}`
  }

  const stickerUrl = hasDirectUrl 
    ? message.mediaUrl 
    : mediaData?.url 
    || (mediaData?.base64 ? getBase64Url(mediaData.base64, mediaData.mimeType || 'image/webp') : null)
    || (mediaData?.thumbnail ? getBase64Url(mediaData.thumbnail, 'image/jpeg') : null)

  return (
    <div className="relative rounded overflow-hidden">
      {isLoading ? (
        <div className="w-32 h-32 bg-muted/50 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stickerUrl ? (
        <>
          <img
            src={stickerUrl}
            alt="Sticker"
            className="max-w-full max-h-64 object-contain cursor-pointer"
            onClick={() => setShowLightbox(true)}
          />
          {showLightbox && (
            <Lightbox
              imageUrl={stickerUrl}
              onClose={() => setShowLightbox(false)}
            />
          )}
        </>
      ) : (
        <div 
          className="w-32 h-32 bg-muted/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/70 transition-colors"
          onClick={handleLoadMedia}
        >
          <Smile className="h-8 w-8 text-muted-foreground" />
          {error ? (
            <span className="text-xs text-muted-foreground text-center">{error}</span>
          ) : (
            <span className="text-xs text-muted-foreground text-center">Clique para carregar</span>
          )}
        </div>
      )}
    </div>
  )
}

interface MessageStatusIconProps {
  status: MessageStatus
}

function MessageStatusIcon({ status }: MessageStatusIconProps) {
  switch (status) {
    case 'pending':
      return <Clock className="h-3 w-3" />
    case 'sent':
      return <Check className="h-3 w-3" />
    case 'delivered':
      return <CheckCheck className="h-3 w-3" />
    case 'read':
      return <CheckCheck className="h-3 w-3 text-blue-400" />
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />
    default:
      return null
  }
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query) return text
  
  const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'))
  
  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ==================== Special Message Type Components ====================

interface PollContentProps {
  content: string | null
  pollData?: { question: string; options: string[]; selectableCount?: number } | null
}

function PollContent({ content, pollData }: PollContentProps) {
  // If we have structured poll data, use it
  if (pollData) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-medium">{pollData.question}</span>
        </div>
        <div className="space-y-1 pl-6">
          {pollData.options.map((option, index) => (
            <div key={index} className="text-sm opacity-80">
              {index + 1}. {option}
            </div>
          ))}
        </div>
      </div>
    )
  }
  
  // Fallback to content string (already formatted by backend)
  return (
    <div className="text-sm whitespace-pre-wrap">
      {content || '📊 Enquete'}
    </div>
  )
}

function ViewOnceIndicator({ content }: { content: string | null }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-background/20 rounded">
      <span className="text-lg">⏱️</span>
      <span className="text-sm opacity-80">
        {content || 'Mídia de visualização única'}
      </span>
    </div>
  )
}

interface InteractiveContentProps {
  content: string | null
  interactiveData?: {
    type: string
    text?: string
    buttons?: { id: string; text: string }[]
    sections?: { title: string; rows: { id: string; title: string }[] }[]
    selectedId?: string
    selectedTitle?: string
  } | null
}

function InteractiveContent({ content, interactiveData }: InteractiveContentProps) {
  // If we have structured data, render it nicely
  if (interactiveData) {
    if (interactiveData.type === 'buttons_response' || interactiveData.type === 'list_response') {
      return (
        <div className="flex items-center gap-2">
          <span>🔘</span>
          <span className="text-sm">{interactiveData.selectedTitle || content}</span>
        </div>
      )
    }
    
    return (
      <div className="space-y-2">
        {interactiveData.text && (
          <p className="text-sm">{interactiveData.text}</p>
        )}
        {interactiveData.buttons && interactiveData.buttons.length > 0 && (
          <div className="space-y-1">
            {interactiveData.buttons.map((btn, index) => (
              <div key={index} className="text-sm opacity-80 flex items-center gap-1">
                <span>🔘</span> {btn.text}
              </div>
            ))}
          </div>
        )}
        {interactiveData.sections && interactiveData.sections.length > 0 && (
          <div className="space-y-1">
            {interactiveData.sections.map((section, index) => (
              <div key={index} className="text-sm opacity-80">
                📋 {section.title}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  
  // Fallback to content string
  return (
    <div className="text-sm whitespace-pre-wrap">
      {content || '🔘 Mensagem interativa'}
    </div>
  )
}

function TemplateContent({ content }: { content: string | null }) {
  return (
    <div className="text-sm whitespace-pre-wrap">
      {content || '📄 Mensagem de template'}
    </div>
  )
}

function ChannelCommentIndicator() {
  return (
    <div className="flex items-center gap-2 p-2 bg-background/20 rounded">
      <span className="text-lg">💬</span>
      <span className="text-sm opacity-80">Comentário em canal</span>
    </div>
  )
}

function DeletedMessage() {
  return (
    <div className="flex items-center gap-2 opacity-60 italic">
      <span>🚫</span>
      <span className="text-sm">Esta mensagem foi apagada</span>
    </div>
  )
}

function UnknownTypeMessage({ content }: { content: string | null }) {
  return (
    <div className="flex items-center gap-2 p-2 bg-background/20 rounded">
      <span className="text-lg">📩</span>
      <span className="text-sm opacity-80">{content || 'Mensagem'}</span>
    </div>
  )
}

export default MessageBubble


// ==================== Lightbox Component ====================

interface LightboxProps {
  imageUrl?: string
  videoUrl?: string
  onClose: () => void
}

function Lightbox({ imageUrl, videoUrl, onClose }: LightboxProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {imageUrl && (
          <img
            src={imageUrl}
            alt="Fullscreen"
            className="max-w-full max-h-[90vh] object-contain"
          />
        )}
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] object-contain"
          />
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          title="Fechar (ESC)"
        >
          <svg
            className="w-8 h-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
