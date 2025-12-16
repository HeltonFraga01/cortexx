/**
 * CollapsibleSection Component
 * 
 * Reusable accordion section for the contact panel
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  id: string
  title: string
  icon?: React.ReactNode
  count?: number
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
}

const STORAGE_KEY = 'contact-panel-sections'

function getSavedState(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : {}
  } catch {
    return {}
  }
}

function saveState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Silently fail if localStorage is not available
  }
}

export function CollapsibleSection({
  id,
  title,
  icon,
  count,
  defaultExpanded = false,
  children,
  className
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = getSavedState()
    return saved[id] !== undefined ? saved[id] : defaultExpanded
  })

  // Save state when it changes
  useEffect(() => {
    const saved = getSavedState()
    saved[id] = isExpanded
    saveState(saved)
  }, [id, isExpanded])

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev)
  }, [])

  return (
    <div className={cn('border-b last:border-b-0', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`section-${id}`}
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-medium">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      
      {isExpanded && (
        <div id={`section-${id}`} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  )
}

export default CollapsibleSection
