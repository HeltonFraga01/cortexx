import { toast as sonnerToast } from 'sonner';

/**
 * Legacy toast options format (shadcn/ui toast API)
 * This interface maintains backward compatibility with existing toast calls
 */
interface LegacyToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

/**
 * Combined toast function type that supports both legacy and native sonner APIs
 */
type ToastFunction = {
  (options: LegacyToastOptions): string | number;
  (message: string): string | number;
  success: typeof sonnerToast.success;
  error: typeof sonnerToast.error;
  warning: typeof sonnerToast.warning;
  info: typeof sonnerToast.info;
  loading: typeof sonnerToast.loading;
  promise: typeof sonnerToast.promise;
  dismiss: typeof sonnerToast.dismiss;
  custom: typeof sonnerToast.custom;
  message: typeof sonnerToast.message;
};

/**
 * Formats title and description into a single message string
 */
function formatMessage(title?: string, description?: string): string {
  const trimmedTitle = title?.trim();
  const trimmedDescription = description?.trim();
  
  if (trimmedTitle && trimmedDescription) {
    return `${trimmedTitle}: ${trimmedDescription}`;
  }
  return trimmedTitle || trimmedDescription || 'Notification';
}

/**
 * Returns default duration based on variant
 * Error toasts stay longer for better visibility
 */
function getDefaultDuration(variant?: string): number | undefined {
  if (variant === 'destructive') {
    return 5000;
  }
  return undefined;
}

/**
 * Checks if input is a legacy toast options object
 */
function isLegacyToastOptions(input: unknown): input is LegacyToastOptions {
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  const obj = input as Record<string, unknown>;
  return (
    'title' in obj ||
    'description' in obj ||
    'variant' in obj ||
    'duration' in obj
  );
}

/**
 * Creates a toast function that supports both legacy shadcn/ui format
 * and native sonner format for backward compatibility
 */
function createCompatibleToast(): ToastFunction {
  const wrapper = ((input: LegacyToastOptions | string | undefined | null) => {
    // String input: pass through to sonner
    if (typeof input === 'string') {
      return sonnerToast(input);
    }

    // Object input: translate legacy format
    if (isLegacyToastOptions(input)) {
      const { title, description, variant, duration } = input;
      const message = formatMessage(title, description);
      const options = { duration: duration ?? getDefaultDuration(variant) };

      if (variant === 'destructive') {
        return sonnerToast.error(message, options);
      }
      return sonnerToast.success(message, options);
    }

    // Fallback for invalid input
    if (input !== undefined && input !== null) {
      console.warn('Invalid toast input:', input);
    }
    return sonnerToast('Notification');
  }) as ToastFunction;

  // Attach all sonner methods for native API support
  wrapper.success = sonnerToast.success;
  wrapper.error = sonnerToast.error;
  wrapper.warning = sonnerToast.warning;
  wrapper.info = sonnerToast.info;
  wrapper.loading = sonnerToast.loading;
  wrapper.promise = sonnerToast.promise;
  wrapper.dismiss = sonnerToast.dismiss;
  wrapper.custom = sonnerToast.custom;
  wrapper.message = sonnerToast.message;

  return wrapper;
}

// Create the compatible toast instance
export const toast = createCompatibleToast();

// For backward compatibility with useToast hook pattern
export const useToast = () => {
  return {
    toast,
  };
};

// Export helper functions for testing
export { formatMessage, getDefaultDuration, isLegacyToastOptions };
export type { LegacyToastOptions, ToastFunction };
