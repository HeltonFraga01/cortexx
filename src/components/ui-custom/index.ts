/**
 * UI Custom Components Index
 * 
 * Central export location for all custom UI components.
 * These components extend shadcn/ui primitives with design system patterns.
 */

// Gradient Card - Card with gradient background based on semantic color
export { GradientCard, GRADIENT_CLASSES, getIconClasses } from './GradientCard';
export type { GradientCardProps, GradientVariant } from './GradientCard';

// Stats Card - Statistics card with gradient, icon, title, value and trend
export { StatsCard } from './StatsCard';
export type { StatsCardProps } from './StatsCard';

// List Item - Standardized list item with icon, content, badge and value
export { ListItem } from './ListItem';
export type { ListItemProps, ValueVariant } from './ListItem';

// Empty State - Centered empty state with icon, title, description and action
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

// Card Header With Icon - Card header with icon, title and optional action
export { CardHeaderWithIcon } from './CardHeaderWithIcon';
export type { CardHeaderWithIconProps } from './CardHeaderWithIcon';

// Loading Skeleton - Skeleton placeholders for loading states
export { LoadingSkeleton } from './LoadingSkeleton';
export type { LoadingSkeletonProps, SkeletonVariant } from './LoadingSkeleton';
