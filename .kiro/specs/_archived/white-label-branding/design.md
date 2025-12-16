# White Label Branding System Design

## Overview

The white label branding system will allow administrators to customize the application name and branding elements through a centralized configuration interface. The system will replace hardcoded "WUZAPI" references with dynamic, configurable values that can be managed through the admin settings page at `/admin/settings`.

## Architecture

### Frontend Architecture
- **Branding Context Provider**: React context that provides branding configuration to all components
- **Branding Service**: Service layer for fetching and caching branding configuration
- **Admin Settings Component**: UI component for managing branding configuration
- **Branding Hook**: Custom React hook for consuming branding data in components

### Backend Architecture
- **Branding Configuration API**: REST endpoints for managing branding settings
- **Configuration Storage**: Database table for persisting branding configuration
- **Configuration Service**: Business logic for branding configuration management

### Data Flow
1. Admin updates branding through settings page
2. Frontend sends configuration to backend API
3. Backend validates and stores configuration
4. Frontend refetches configuration and updates context
5. All components consuming branding context re-render with new values

## Components and Interfaces

### Frontend Components

#### BrandingProvider Component
```typescript
interface BrandingConfig {
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface BrandingContextType {
  config: BrandingConfig;
  loading: boolean;
  updateConfig: (config: Partial<BrandingConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
}
```

#### Admin Settings Branding Section
```typescript
interface BrandingSettingsProps {
  onSave: (config: BrandingConfig) => Promise<void>;
  initialConfig: BrandingConfig;
  loading: boolean;
}
```

#### useBranding Hook
```typescript
const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
};
```

### Backend API Endpoints

#### GET /api/admin/branding
- **Purpose**: Retrieve current branding configuration
- **Response**: BrandingConfig object
- **Authentication**: Admin token required

#### PUT /api/admin/branding
- **Purpose**: Update branding configuration
- **Request Body**: Partial BrandingConfig object
- **Response**: Updated BrandingConfig object
- **Authentication**: Admin token required
- **Validation**: App name length (1-50 chars), valid URL format for logo

### Database Schema

#### branding_config Table
```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Data Models

### BrandingConfig Model
```typescript
interface BrandingConfig {
  id?: number;
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### Validation Rules
- **appName**: Required, 1-50 characters, alphanumeric and spaces allowed
- **logoUrl**: Optional, valid URL format
- **primaryColor**: Optional, valid hex color format (#RRGGBB)
- **secondaryColor**: Optional, valid hex color format (#RRGGBB)

## Error Handling

### Frontend Error Handling
- **Network Errors**: Display toast notification with retry option
- **Validation Errors**: Show inline form validation messages
- **Loading States**: Show skeleton loaders during configuration fetch
- **Fallback Values**: Use default "WUZAPI" if configuration fails to load

### Backend Error Handling
- **Invalid Input**: Return 400 with detailed validation errors
- **Authentication**: Return 401 for missing/invalid admin token
- **Database Errors**: Return 500 with generic error message
- **Not Found**: Return 404 if configuration doesn't exist

## Testing Strategy

### Frontend Testing
- **Unit Tests**: Test branding context provider and hook functionality
- **Component Tests**: Test admin settings form validation and submission
- **Integration Tests**: Test branding updates across multiple components
- **E2E Tests**: Test complete branding configuration workflow

### Backend Testing
- **Unit Tests**: Test branding service validation and business logic
- **API Tests**: Test branding endpoints with various input scenarios
- **Database Tests**: Test configuration persistence and retrieval
- **Authentication Tests**: Verify admin token validation

## Implementation Phases

### Phase 1: Backend Foundation
1. Create branding configuration database table
2. Implement branding configuration API endpoints
3. Add validation and error handling
4. Create branding service layer

### Phase 2: Frontend Infrastructure
1. Create branding context provider
2. Implement branding service for API communication
3. Create useBranding hook
4. Add branding provider to app root

### Phase 3: Admin Interface
1. Add branding section to admin settings page
2. Implement form validation and submission
3. Add loading states and error handling
4. Test admin branding configuration workflow

### Phase 4: Frontend Integration
1. Replace hardcoded "WUZAPI" references with branding context
2. Update page titles and navigation elements
3. Update notifications and error messages
4. Test branding consistency across all pages

### Phase 5: Polish and Testing
1. Add comprehensive test coverage
2. Implement proper loading states
3. Add configuration validation feedback
4. Performance optimization and caching

## Security Considerations

- **Admin Authentication**: Ensure only authenticated admins can modify branding
- **Input Validation**: Sanitize all branding inputs to prevent XSS
- **URL Validation**: Validate logo URLs to prevent malicious redirects
- **Rate Limiting**: Implement rate limiting on branding update endpoints
- **Audit Logging**: Log all branding configuration changes for audit trail