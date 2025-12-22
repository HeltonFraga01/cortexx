/**
 * Theme Loader
 * 
 * Dynamically loads and renders the appropriate edit theme based on
 * the connection's view configuration. Includes error boundary for
 * graceful fallback to default theme.
 * 
 * Supports both built-in themes and custom themes from Page Builder.
 */

import React, { Component, useMemo, useState, useEffect } from 'react';
import { themeRegistry } from './ThemeRegistry';
import { CustomThemeLoader } from './themes/CustomThemeRenderer';
import type { EditThemeProps } from '@/types/edit-themes';
import type { DatabaseConnection } from '@/lib/types';
import { Loader2 } from 'lucide-react';

// Import themes to ensure registration
import './themes';

interface ThemeErrorBoundaryProps {
  children: React.ReactNode;
  fallback: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ThemeErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary that catches theme rendering errors
 * and falls back to the default theme
 */
class ThemeErrorBoundary extends Component<ThemeErrorBoundaryProps, ThemeErrorBoundaryState> {
  constructor(props: ThemeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ThemeErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Theme render error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

interface ThemeLoaderProps extends Omit<EditThemeProps, 'fieldMetadata'> {
  /** Optional field metadata (will be passed to theme if provided) */
  fieldMetadata?: EditThemeProps['fieldMetadata'];
  /** Whether this is being used in agent context (uses agent API routes) */
  isAgentContext?: boolean;
}

/**
 * Get the theme ID from a connection's view configuration
 */
function getThemeIdFromConnection(connection: DatabaseConnection): string | null {
  const viewConfig = connection.viewConfiguration || connection.view_configuration;
  
  if (!viewConfig?.editTheme?.enabled) {
    return null;
  }
  
  return viewConfig.editTheme.themeId || null;
}

/**
 * Check if a theme ID is a custom theme
 */
function isCustomTheme(themeId: string | null): boolean {
  return themeId?.startsWith('custom-') ?? false;
}

/**
 * Extract custom theme ID from theme string
 */
function getCustomThemeId(themeId: string): number {
  return parseInt(themeId.replace('custom-', ''), 10);
}

/**
 * ThemeLoader Component
 * 
 * Loads the appropriate theme based on connection configuration
 * and renders it with the provided props.
 * 
 * Supports both built-in themes (from registry) and custom themes
 * (loaded from database via Page Builder).
 */
export function ThemeLoader({
  connection,
  record,
  formData,
  fieldMetadata = [],
  onRecordChange,
  onSave,
  onBack,
  saving,
  disabled,
  hasChanges,
  isAgentContext = false,
}: ThemeLoaderProps) {
  // Determine which theme to use
  const themeId = getThemeIdFromConnection(connection);
  
  // Props to pass to theme component
  const themeProps: EditThemeProps = {
    connection,
    record,
    formData,
    fieldMetadata,
    onRecordChange,
    onSave,
    onBack,
    saving,
    disabled,
    hasChanges,
  };

  // Get default theme for fallback
  const defaultTheme = useMemo(() => themeRegistry.getDefault(), []);
  const DefaultThemeComponent = defaultTheme.component;
  const fallbackElement = <DefaultThemeComponent {...themeProps} />;

  // Handle built-in themes (from registry) - must be before early return
  const theme = useMemo(() => {
    if (themeId && !isCustomTheme(themeId)) {
      return themeRegistry.get(themeId);
    }
    return themeRegistry.getDefault();
  }, [themeId]);

  // Handle custom themes (from Page Builder)
  if (isCustomTheme(themeId)) {
    const customThemeId = getCustomThemeId(themeId!);
    
    return (
      <ThemeErrorBoundary
        fallback={fallbackElement}
        onError={(error) => {
          console.error(`Custom theme "${themeId}" failed to render:`, error);
        }}
      >
        <CustomThemeLoader themeId={customThemeId} isAgentContext={isAgentContext} {...themeProps} />
      </ThemeErrorBoundary>
    );
  }

  // Handle built-in themes
  const ThemeComponent = theme.component;
  
  return (
    <ThemeErrorBoundary
      fallback={fallbackElement}
      onError={(error) => {
        console.error(`Theme "${theme.id}" failed to render:`, error);
      }}
    >
      <ThemeComponent {...themeProps} />
    </ThemeErrorBoundary>
  );
}

export default ThemeLoader;
