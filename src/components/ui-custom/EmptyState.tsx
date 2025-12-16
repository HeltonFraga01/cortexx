import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { ComponentType, HTMLAttributes } from 'react'

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  /** Icon component to render */
  icon: ComponentType<{ className?: string }>
  /** Title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action button */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * EmptyState Component
 * 
 * Displays a centered empty state with icon, title, description and optional action.
 * Used when no data is available in a list or section.
 * 
 * @example
 * ```tsx
 * <EmptyState
 *   icon={Inbox}
 *   title="No messages"
 *   description="You don't have any messages yet"
 *   action={{
 *     label: "Send a message",
 *     onClick: () => handleSendMessage()
 *   }}
 * />
 * ```
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-8 text-center',
        className
      )}
      {...props}
    >
      <Icon className="w-10 h-10 mb-2 opacity-20 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
