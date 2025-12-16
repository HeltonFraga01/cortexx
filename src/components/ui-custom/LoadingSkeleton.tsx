import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { HTMLAttributes } from 'react'

export type SkeletonVariant = 'card' | 'listItem' | 'stats'

export interface LoadingSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Type of skeleton to render */
  variant: SkeletonVariant
  /** Number of items to render (for list variants) */
  count?: number
}

/**
 * Card skeleton - matches StatsCard layout
 */
function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('p-5 rounded-lg border bg-card animate-pulse', className)}>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * List item skeleton - matches ListItem layout
 */
function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 p-2.5 animate-pulse', className)}>
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-5 w-20" />
    </div>
  )
}

/**
 * Stats skeleton - matches stats grid layout
 */
function StatsSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {[...Array(4)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

/**
 * LoadingSkeleton Component
 * 
 * Displays skeleton placeholders matching expected content layout.
 * Uses animate-pulse for loading animation.
 * 
 * @example
 * ```tsx
 * // Single card skeleton
 * <LoadingSkeleton variant="card" />
 * 
 * // Multiple list item skeletons
 * <LoadingSkeleton variant="listItem" count={5} />
 * 
 * // Stats grid skeleton
 * <LoadingSkeleton variant="stats" />
 * ```
 */
export function LoadingSkeleton({
  variant,
  count = 1,
  className,
  ...props
}: LoadingSkeletonProps) {
  if (variant === 'stats') {
    return <StatsSkeleton className={className} {...props} />
  }

  if (variant === 'card') {
    if (count === 1) {
      return <CardSkeleton className={className} {...props} />
    }
    return (
      <div className={cn('space-y-4', className)} {...props}>
        {[...Array(count)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (variant === 'listItem') {
    return (
      <div className={cn('space-y-1', className)} {...props}>
        {[...Array(count)].map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    )
  }

  return null
}

export default LoadingSkeleton
