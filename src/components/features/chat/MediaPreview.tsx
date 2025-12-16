/**
 * MediaPreview Component
 * 
 * Lightbox for viewing images and videos in full screen
 * 
 * Requirements: 3.6
 */

import { useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause
} from 'lucide-react'

interface MediaItem {
  type: 'image' | 'video'
  url: string
  filename?: string
  caption?: string
}

interface MediaPreviewProps {
  media: MediaItem
  isOpen: boolean
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
  hasPrevious?: boolean
  hasNext?: boolean
}

export function MediaPreview({
  media,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext
}: MediaPreviewProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Reset state when media changes
  useEffect(() => {
    setZoom(1)
    setRotation(0)
    setIsPlaying(false)
  }, [media.url])

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          if (hasPrevious && onPrevious) onPrevious()
          break
        case 'ArrowRight':
          if (hasNext && onNext) onNext()
          break
        case '+':
        case '=':
          setZoom((z) => Math.min(z + 0.25, 3))
          break
        case '-':
          setZoom((z) => Math.max(z - 0.25, 0.5))
          break
        case 'r':
          setRotation((r) => (r + 90) % 360)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, onPrevious, onNext, hasPrevious, hasNext])

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 3))
  }, [])

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.5))
  }, [])

  const handleRotate = useCallback(() => {
    setRotation((r) => (r + 90) % 360)
  }, [])

  const handleDownload = useCallback(() => {
    const link = document.createElement('a')
    link.href = media.url
    link.download = media.filename || `media.${media.type === 'image' ? 'jpg' : 'mp4'}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [media])

  const togglePlayPause = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-2">
          {media.filename && (
            <span className="text-white text-sm">{media.filename}</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {media.type === 'image' && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="text-white hover:bg-white/20"
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="text-white hover:bg-white/20"
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="text-white hover:bg-white/20"
              >
                <RotateCw className="h-5 w-5" />
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            className="text-white hover:bg-white/20"
          >
            <Download className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {/* Previous button */}
        {hasPrevious && onPrevious && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onPrevious}
            className="absolute left-4 text-white hover:bg-white/20 z-10"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        {/* Media content */}
        {media.type === 'image' ? (
          <img
            src={media.url}
            alt={media.caption || 'Preview'}
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="relative">
            <video
              src={media.url}
              className="max-w-full max-h-[80vh]"
              controls={isPlaying}
              autoPlay={isPlaying}
              onClick={togglePlayPause}
            />
            {!isPlaying && (
              <button
                onClick={togglePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                  <Play className="h-8 w-8 text-black ml-1" />
                </div>
              </button>
            )}
          </div>
        )}

        {/* Next button */}
        {hasNext && onNext && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="absolute right-4 text-white hover:bg-white/20 z-10"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Caption */}
      {media.caption && (
        <div className="p-4 bg-black/50 text-center">
          <p className="text-white text-sm">{media.caption}</p>
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      <div className="absolute bottom-4 left-4 text-white/50 text-xs">
        <span>Esc para fechar</span>
        {media.type === 'image' && (
          <>
            <span className="mx-2">•</span>
            <span>+/- para zoom</span>
            <span className="mx-2">•</span>
            <span>R para rotacionar</span>
          </>
        )}
        {(hasPrevious || hasNext) && (
          <>
            <span className="mx-2">•</span>
            <span>← → para navegar</span>
          </>
        )}
      </div>
    </div>
  )
}

// Hook for managing media preview state
export function useMediaPreview() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMedia, setCurrentMedia] = useState<MediaItem | null>(null)
  const [mediaList, setMediaList] = useState<MediaItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)

  const openPreview = useCallback((media: MediaItem, list?: MediaItem[]) => {
    setCurrentMedia(media)
    if (list) {
      setMediaList(list)
      const index = list.findIndex((m) => m.url === media.url)
      setCurrentIndex(index >= 0 ? index : 0)
    } else {
      setMediaList([media])
      setCurrentIndex(0)
    }
    setIsOpen(true)
  }, [])

  const closePreview = useCallback(() => {
    setIsOpen(false)
    setCurrentMedia(null)
  }, [])

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      setCurrentMedia(mediaList[newIndex])
    }
  }, [currentIndex, mediaList])

  const goToNext = useCallback(() => {
    if (currentIndex < mediaList.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      setCurrentMedia(mediaList[newIndex])
    }
  }, [currentIndex, mediaList])

  return {
    isOpen,
    currentMedia,
    openPreview,
    closePreview,
    goToPrevious,
    goToNext,
    hasPrevious: currentIndex > 0,
    hasNext: currentIndex < mediaList.length - 1
  }
}

export default MediaPreview
