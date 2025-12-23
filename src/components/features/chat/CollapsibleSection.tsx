/**
 * CollapsibleSection Component
 * 
 * Reusable accordion section for the contact panel
 * Task 5.2: Added smooth animations for expand/collapse
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

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
  const contentRef = useRef<HTMLDivElement>(null)

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
        <div className="flex items-center gap-3">
          {icon && <span className="text-muted-foreground">{icon}</span>}
          <span className="text-sm font-medium">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
        </div>
        {/* Task 5.2: Rotating chevron icon */}
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )} 
        />
      </button>
      
      {/* Task 5.2: Animated content with max-height and opacity transition */}
      <div 
        ref={contentRef}
        id={`section-${id}`}
        className={cn(
          "overflow-hidden transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  )
}

export default CollapsibleSection
