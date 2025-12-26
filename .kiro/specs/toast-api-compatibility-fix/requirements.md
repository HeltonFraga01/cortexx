# Requirements Document

## Introduction

The application has a toast notification system that was migrated from `shadcn/ui toast` (Radix-based) to `sonner`. However, the migration was incomplete - the toast hook exports `sonner`'s toast function directly, but components throughout the codebase still call `toast({ title, description })` using the old API format. This causes a React rendering error: "Objects are not valid as a React child" because sonner tries to render the object directly instead of extracting the message.

This spec addresses the API incompatibility by creating a compatibility wrapper that translates the old API calls to sonner's expected format.

## Glossary

- **Toast_System**: The notification system that displays temporary messages to users
- **Sonner**: The toast library currently used (`sonner` package)
- **Legacy_API**: The old toast API format using `toast({ title, description, variant })`
- **Sonner_API**: The new toast API format using `toast.success(message)`, `toast.error(message)`, etc.
- **Compatibility_Wrapper**: A function that accepts the legacy API format and translates it to sonner calls

## Requirements

### Requirement 1: Toast Compatibility Wrapper

**User Story:** As a developer, I want the existing toast calls to work without modification, so that the application doesn't crash with React rendering errors.

#### Acceptance Criteria

1. WHEN a component calls `toast({ title, description })` THEN THE Toast_System SHALL display the message using sonner's API
2. WHEN a component calls `toast({ title, description, variant: 'destructive' })` THEN THE Toast_System SHALL display an error toast using `toast.error()`
3. WHEN a component calls `toast({ title, description, variant: 'default' })` THEN THE Toast_System SHALL display a success toast using `toast.success()`
4. WHEN a component calls `toast({ title })` without description THEN THE Toast_System SHALL display only the title as the message
5. WHEN a component calls `toast({ description })` without title THEN THE Toast_System SHALL display only the description as the message
6. WHEN a component calls `toast.success(message)` or `toast.error(message)` directly THEN THE Toast_System SHALL pass through to sonner unchanged
7. IF a component passes an invalid toast configuration THEN THE Toast_System SHALL log a warning and display a fallback message

### Requirement 2: Backward Compatibility

**User Story:** As a developer, I want both the old and new toast APIs to work simultaneously, so that I can gradually migrate components without breaking existing functionality.

#### Acceptance Criteria

1. THE Compatibility_Wrapper SHALL support both `toast({ title, description })` and `toast.success(message)` formats
2. THE Compatibility_Wrapper SHALL preserve all sonner methods (`toast.success`, `toast.error`, `toast.warning`, `toast.info`, `toast.loading`, `toast.promise`, `toast.dismiss`)
3. WHEN using the `useToast` hook THEN THE returned toast function SHALL support both API formats
4. THE Compatibility_Wrapper SHALL maintain TypeScript type safety for both API formats

### Requirement 3: Duration Configuration

**User Story:** As a developer, I want to control how long toasts are displayed, so that important messages stay visible longer.

#### Acceptance Criteria

1. WHEN a component calls `toast({ title, description, duration: 5000 })` THEN THE Toast_System SHALL display the toast for 5 seconds
2. IF no duration is specified THEN THE Toast_System SHALL use sonner's default duration
3. WHEN variant is 'destructive' THEN THE Toast_System SHALL use a longer default duration (5000ms) for error visibility
