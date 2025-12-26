# Design Document: Toast API Compatibility Fix

## Overview

This design addresses the API incompatibility between the legacy `shadcn/ui toast` format (`toast({ title, description })`) and the current `sonner` library format (`toast.success(message)`). The solution creates a compatibility wrapper that intercepts legacy API calls and translates them to sonner's expected format while preserving native sonner functionality.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Component Layer                          │
│  toast({ title, description, variant })  OR  toast.error() │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Compatibility Wrapper (toast)                  │
│  - Detects call format (object vs string)                  │
│  - Translates legacy format to sonner calls                │
│  - Passes through native sonner calls unchanged            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sonner Library                           │
│  toast.success() | toast.error() | toast.info() | etc.     │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Toast Options Interface (Legacy Format)

```typescript
interface LegacyToastOptions {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}
```

### Compatibility Wrapper Function

```typescript
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
};
```

### Implementation Strategy

The wrapper function uses runtime type checking to determine the call format:

```typescript
function createCompatibleToast(): ToastFunction {
  const wrapper = (input: LegacyToastOptions | string) => {
    // String input: pass through to sonner
    if (typeof input === 'string') {
      return sonnerToast(input);
    }
    
    // Object input: translate legacy format
    if (typeof input === 'object' && input !== null) {
      const { title, description, variant, duration } = input;
      const message = formatMessage(title, description);
      const options = { duration: duration ?? getDefaultDuration(variant) };
      
      if (variant === 'destructive') {
        return sonnerToast.error(message, options);
      }
      return sonnerToast.success(message, options);
    }
    
    // Fallback for invalid input
    console.warn('Invalid toast input:', input);
    return sonnerToast('Notification');
  };
  
  // Attach all sonner methods for native API support
  wrapper.success = sonnerToast.success;
  wrapper.error = sonnerToast.error;
  wrapper.warning = sonnerToast.warning;
  wrapper.info = sonnerToast.info;
  wrapper.loading = sonnerToast.loading;
  wrapper.promise = sonnerToast.promise;
  wrapper.dismiss = sonnerToast.dismiss;
  wrapper.custom = sonnerToast.custom;
  
  return wrapper as ToastFunction;
}
```

### Message Formatting Logic

```typescript
function formatMessage(title?: string, description?: string): string {
  if (title && description) {
    return `${title}: ${description}`;
  }
  return title || description || 'Notification';
}
```

### Duration Defaults

```typescript
function getDefaultDuration(variant?: string): number | undefined {
  // Error toasts stay longer for visibility
  if (variant === 'destructive') {
    return 5000;
  }
  // Let sonner use its default for success toasts
  return undefined;
}
```

## Data Models

No database changes required. This is a frontend-only change.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Message Formatting Consistency

*For any* legacy toast call with title and/or description, the wrapper SHALL produce a non-empty string message that contains all provided text content.

**Validates: Requirements 1.1, 1.4, 1.5**

### Property 2: Variant Mapping Correctness

*For any* legacy toast call with a variant, the wrapper SHALL call `toast.error()` for 'destructive' variant and `toast.success()` for 'default' or undefined variant.

**Validates: Requirements 1.2, 1.3**

### Property 3: Native API Passthrough

*For any* direct sonner method call (success, error, warning, info, loading, promise, dismiss, custom), the wrapper SHALL pass the call through to sonner unchanged.

**Validates: Requirements 1.6, 2.2**

### Property 4: Duration Configuration

*For any* legacy toast call with a duration option, the wrapper SHALL pass that duration to sonner. For destructive variant without explicit duration, the wrapper SHALL use 5000ms.

**Validates: Requirements 3.1, 3.3**

## Error Handling

| Scenario | Handling |
|----------|----------|
| `toast(null)` | Log warning, show "Notification" |
| `toast(undefined)` | Log warning, show "Notification" |
| `toast({})` | Show "Notification" (empty title/description) |
| `toast({ title: '' })` | Show "Notification" (empty string treated as falsy) |

## Testing Strategy

### Unit Tests
- Test message formatting with various title/description combinations
- Test variant mapping (destructive → error, default → success)
- Test duration passthrough
- Test edge cases (null, undefined, empty objects)

### Property-Based Tests
- Use `fast-check` for property-based testing
- Generate random title/description strings
- Verify message formatting invariants
- Verify variant mapping correctness

### Test Configuration
- Minimum 100 iterations per property test
- Mock sonner functions to verify call patterns
- Tag format: **Feature: toast-api-compatibility-fix, Property N: [property text]**

## File Changes

| File | Change |
|------|--------|
| `src/hooks/use-toast.ts` | Replace with compatibility wrapper |
| `src/components/ui/use-toast.ts` | Replace with compatibility wrapper (or remove, consolidate to hooks) |
| `src/hooks/use-toast.test.ts` | Add unit and property tests |
