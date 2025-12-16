import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { getIconClasses, type GradientVariant } from './GradientCard'
import type { ComponentType, HTMLAttributes } from 'react'

export type ValueVariant = 'positive' | 'negative' | 'neutral'

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>
  /** Color variant for icon container */
  iconVariant: GradientVariant
  /** Main title text */
  title: string
  /** Optional subtitle text */
  subtitle?: string
  /** Optional badge text */
  badge?: string
  /** Optional value to display on the right */
  value?: string
  /** Value color variant for semantic coloring */
  valueVariant?: ValueVariant
  /** Click handler */
  onClick?: () => void
}

const VALUE_CLASSES: Record<ValueVariant, string> = {
  positive: 'text-green-500',
  negative: 'text-red-500',
  neutral: 'text-foreground',
}

/**
 * ListItem Component
 * 
 * A standardized list item with icon, content area, optional badge and value.
 * Includes hover state with smooth transition.
 * 
 * @example
 * ```tsx
 * <ListItem
 *   icon={DollarSign}
 *   iconVariant="green"
 *   title="Payment Received"
 *   subtitle="From John Doe"
 *   badge="Income"
 *   value="+R$ 1.000,00"
 *   valueVariant="positive"
 *   onClick={() => handleClick()}
 * />
 * ```
 */
export function ListItem({
  icon: Icon,
  iconVariant,
  title,
  subtitle,
  badge,
  value,
  valueVariant = 'neutral',
  onClick,
  className,
  ...props
}: ListItemProps) {
  const iconClasses = getIconClasses(iconVariant)
  const valueClasses = VALUE_CLASSES[valueVariant]

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2.5 rounded-xl',
        'hover:bg-muted/50 transition-colors cursor-pointer',
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
      {...props}
    >
      {/* Icon Container */}
      <div className={cn('p-2 rounded-lg', iconClasses)}>
        <Icon className="w-4 h-4" />
      </div>

      {/* Content Area */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {(badge || subtitle) && (
          <div className="flex items-center gap-2 mt-0.5">
            {badge && (
              <Badge variant="secondary" className="text-xs font-normal px-1.5 py-0">
                {badge}
              </Badge>
            )}
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </div>

      {/* Value */}
      {value && (
        <span className={cn('text-sm font-semibold whitespace-nowrap', valueClasses)}>
          {value}
        </span>
      )}
    </div>
  )
}

export default ListItem
