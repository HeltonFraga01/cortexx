import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'

export type GradientVariant = 'green' | 'red' | 'blue' | 'purple' | 'orange'

export interface GradientCardProps extends HTMLAttributes<HTMLDivElement> {
  variant: GradientVariant
  children: ReactNode
  className?: string
}

/**
 * Gradient class mapping for each color variant
 * Used for cards with gradient backgrounds and matching icon containers
 */
export const GRADIENT_CLASSES = {
  green: {
    card: 'from-green-500/10 to-green-500/5',
    icon: 'bg-green-500/20 text-green-500',
  },
  red: {
    card: 'from-red-500/10 to-red-500/5',
    icon: 'bg-red-500/20 text-red-500',
  },
  blue: {
    card: 'from-blue-500/10 to-blue-500/5',
    icon: 'bg-blue-500/20 text-blue-500',
  },
  purple: {
    card: 'from-purple-500/10 to-purple-500/5',
    icon: 'bg-purple-500/20 text-purple-500',
  },
  orange: {
    card: 'from-orange-500/10 to-orange-500/5',
    icon: 'bg-orange-500/20 text-orange-500',
  },
} as const

/**
 * GradientCard Component
 * 
 * A card with a subtle gradient background based on semantic color variants.
 * Used for stats cards and highlighted content areas.
 * 
 * @example
 * ```tsx
 * <GradientCard variant="green">
 *   <CardContent>Success content</CardContent>
 * </GradientCard>
 * ```
 */
export const GradientCard = forwardRef<HTMLDivElement, GradientCardProps>(
  ({ variant, children, className, ...props }, ref) => {
    const gradientClasses = GRADIENT_CLASSES[variant]

    return (
      <Card
        ref={ref}
        className={cn(
          'relative overflow-hidden border-0 bg-gradient-to-br',
          gradientClasses.card,
          className
        )}
        {...props}
      >
        {children}
      </Card>
    )
  }
)

GradientCard.displayName = 'GradientCard'

/**
 * Helper function to get icon container classes for a variant
 * Use this when rendering icons inside GradientCard
 */
export function getIconClasses(variant: GradientVariant): string {
  return GRADIENT_CLASSES[variant].icon
}

export default GradientCard
