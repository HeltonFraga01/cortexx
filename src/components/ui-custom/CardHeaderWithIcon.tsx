import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronRight } from 'lucide-react'
import type { ComponentType, HTMLAttributes, ReactNode } from 'react'

export interface CardHeaderWithIconProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>
  /** Icon color class (e.g., 'text-orange-500', 'text-green-500') */
  iconColor?: string
  /** Card title */
  title: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
    /** Show chevron icon after label */
    showChevron?: boolean
  }
  /** Optional children to render after title */
  children?: ReactNode
}

/**
 * CardHeaderWithIcon Component
 * 
 * A card header with icon on the left, title in the middle, and optional action button on the right.
 * Action button is styled as ghost variant with primary color.
 * 
 * @example
 * ```tsx
 * <CardHeaderWithIcon
 *   icon={Clock}
 *   iconColor="text-orange-500"
 *   title="Recent Transactions"
 *   action={{
 *     label: "View all",
 *     onClick: () => navigate('/transactions'),
 *     showChevron: true
 *   }}
 * />
 * ```
 */
export function CardHeaderWithIcon({
  icon: Icon,
  iconColor = 'text-primary',
  title,
  action,
  children,
  className,
  ...props
}: CardHeaderWithIconProps) {
  return (
    <CardHeader
      className={cn(
        'flex flex-row items-center justify-between pb-2',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('w-5 h-5', iconColor)} />
        <CardTitle className="text-lg">{title}</CardTitle>
        {children}
      </div>
      {action && (
        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary/80"
          onClick={action.onClick}
        >
          {action.label}
          {action.showChevron && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      )}
    </CardHeader>
  )
}

export default CardHeaderWithIcon
