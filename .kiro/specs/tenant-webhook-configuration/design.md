# Design Document: Tenant Webhook Configuration

## Overview

Este documento descreve o design para o sistema de configuração de webhooks multi-tenant no WUZAPI Manager. A arquitetura permite que cada tenant configure sua própria instância da API WUZAPI e que cada inbox tenha configuração de webhook independente, garantindo isolamento completo entre tenants.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Multi-Tenant Webhook Architecture                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   Tenant A       │    │   Tenant B       │    │   Tenant C       │       │
│  │   (cortexx)      │    │   (empresa1)     │    │   (empresa2)     │       │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤       │
│  │ WUZAPI Config:   │    │ WUZAPI Config:   │    │ WUZAPI Config:   │       │
│  │ - Base URL       │    │ - Base URL       │    │ - Base URL       │       │
│  │ - Admin Token    │    │ - Admin Token    │    │ - Admin Token    │       │
│  ├──────────────────┤    ├──────────────────┤    ├──────────────────┤       │
│  │ Inboxes:         │    │ Inboxes:         │    │ Inboxes:         │       │
│  │ ├─ Inbox 1       │    │ ├─ Inbox 1       │    │ ├─ Inbox 1       │       │
│  │ │  └─ Webhook    │    │ │  └─ Webhook    │    │ │  └─ Webhook    │       │
│  │ └─ Inbox 2       │    │ └─ Inbox 2       │    │ └─ Inbox 2       │       │
│  │    └─ Webhook    │    │    └─ Webhook    │    │    └─ Webhook    │       │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘       │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Webhook Router                                 │   │
│  │  1. Receive webhook from WUZAPI                                      │   │
│  │  2. Extract wuzapi_token from request                                │   │
│  │  3. Lookup inbox by wuzapi_token                                     │   │
│  │  4. Get tenant_id from inbox → account                               │   │
│  │  5. Validate tenant is active                                        │   │
│  │  6. Set tenant context                                               │   │
│  │  7. Process webhook in tenant context                                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. TenantSettingsService

Serviço para gerenciar configurações de API por tenant.

```javascript
// server/services/TenantSettingsService.js

class TenantSettingsService {
  // Chaves de configuração no JSONB settings
  static KEYS = {
    WUZAPI_BASE_URL: 'wuzapi.baseUrl',
    WUZAPI_ADMIN_TOKEN: 'wuzapi.adminToken',
    WUZAPI_TIMEOUT: 'wuzapi.timeout',
    WEBHOOK_BASE_URL: 'webhook.baseUrl'
  };

  /**
   * Get WUZAPI configuration for a tenant
   * Falls back to environment variables if not configured
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<WuzapiConfig>}
   */
  async getWuzapiConfig(tenantId) {}

  /**
   * Save WUZAPI configuration for a tenant
   * Encrypts admin token before storing
   * @param {string} tenantId - Tenant UUID
   * @param {WuzapiConfigInput} config - Configuration to save
   * @returns {Promise<void>}
   */
  async saveWuzapiConfig(tenantId, config) {}

  /**
   * Test WUZAPI connection with provided credentials
   * @param {string} baseUrl - WUZAPI base URL
   * @param {string} adminToken - Admin token
   * @returns {Promise<ConnectionTestResult>}
   */
  async testConnection(baseUrl, adminToken) {}

  /**
   * Encrypt sensitive data before storage
   * @param {string} plaintext - Data to encrypt
   * @returns {string} - Encrypted data
   */
  encryptToken(plaintext) {}

  /**
   * Decrypt sensitive data after retrieval
   * @param {string} ciphertext - Encrypted data
   * @returns {string} - Decrypted data
   */
  decryptToken(ciphertext) {}
}
```

### 2. InboxWebhookService

Serviço para gerenciar webhooks por inbox.

```javascript
// server/services/InboxWebhookService.js

class InboxWebhookService {
  /**
   * Generate webhook URL for an inbox
   * Uses tenant's main domain (without subdomain)
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<string>} - Webhook URL
   */
  async generateWebhookUrl(tenantId, inboxId) {}

  /**
   * Configure webhook for an inbox using tenant's WUZAPI credentials
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @param {string[]} events - Events to subscribe
   * @returns {Promise<WebhookConfigResult>}
   */
  async configureWebhook(tenantId, inboxId, events) {}

  /**
   * Get current webhook status for an inbox
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<WebhookStatus>}
   */
  async getWebhookStatus(tenantId, inboxId) {}

  /**
   * Update inbox with webhook configuration
   * @param {string} inboxId - Inbox UUID
   * @param {WebhookConfig} config - Webhook configuration
   * @returns {Promise<void>}
   */
  async updateInboxWebhookConfig(inboxId, config) {}
}
```

### 3. WebhookAccountRouter (Enhanced)

Atualização do router existente para suportar configuração por tenant.

```javascript
// server/services/WebhookAccountRouter.js (enhanced)

class WebhookAccountRouter {
  /**
   * Route webhook to correct tenant and inbox
   * @param {string} wuzapiToken - Token from webhook request
   * @param {Object} event - Webhook event data
   * @returns {Promise<RoutingResult>}
   */
  async routeWebhook(wuzapiToken, event) {}

  /**
   * Get tenant's WUZAPI configuration for webhook processing
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<WuzapiConfig>}
   */
  async getTenantWuzapiConfig(tenantId) {}

  /**
   * Log webhook routing decision for audit
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID
   * @param {Object} event - Webhook event
   * @param {RoutingResult} result - Routing result
   */
  async logRoutingDecision(tenantId, inboxId, event, result) {}
}
```

### 4. Frontend Components

#### TenantApiSettings Component

```typescript
// src/components/admin/TenantApiSettings.tsx

interface TenantApiSettingsProps {
  tenantId: string;
}

interface WuzapiConfigForm {
  baseUrl: string;
  adminToken: string;
  timeout: number;
}

export function TenantApiSettings({ tenantId }: TenantApiSettingsProps) {
  // Form state and validation
  // Connection test functionality
  // Save configuration
}
```

#### InboxWebhookConfig Component (Enhanced)

```typescript
// src/components/features/chat/settings/IncomingWebhookConfig.tsx (enhanced)

interface InboxWebhookConfigProps {
  inboxId: string;
  tenantId: string;
}

export function IncomingWebhookConfig({ inboxId, tenantId }: InboxWebhookConfigProps) {
  // Display webhook URL based on tenant domain
  // Configure webhook using tenant's WUZAPI credentials
  // Show webhook status
}
```

## Data Models

### tenant_settings Table (Existing - Enhanced)

```sql
-- Estrutura existente com campos adicionais no JSONB settings
-- settings JSONB contém:
{
  "wuzapi": {
    "baseUrl": "https://wzapi.example.com",
    "adminToken": "encrypted:...",  -- Token criptografado
    "timeout": 30000
  },
  "webhook": {
    "baseUrl": "https://main-domain.com"  -- URL base para webhooks
  }
}
```

### inboxes Table (Enhanced)

```sql
-- Campos adicionais para webhook configuration
ALTER TABLE inboxes ADD COLUMN IF NOT EXISTS webhook_config JSONB DEFAULT '{}'::jsonb;

-- webhook_config JSONB contém:
{
  "url": "https://main-domain.com/api/webhook/events",
  "events": ["Message", "ReadReceipt", "ChatPresence"],
  "configured_at": "2025-12-23T10:00:00Z",
  "status": "active"  -- active, pending, error
}
```

### TypeScript Interfaces

```typescript
// src/types/tenant-webhook.ts

interface WuzapiConfig {
  baseUrl: string;
  adminToken: string;  // Decrypted for use
  timeout: number;
}

interface WuzapiConfigInput {
  baseUrl: string;
  adminToken: string;  // Plain text, will be encrypted
  timeout?: number;
}

interface WebhookConfig {
  url: string;
  events: string[];
  configuredAt: string;
  status: 'active' | 'pending' | 'error';
}

interface WebhookStatus {
  isConfigured: boolean;
  url?: string;
  events?: string[];
  lastError?: string;
}

interface RoutingResult {
  routed: boolean;
  tenantId?: string;
  inboxId?: string;
  accountId?: string;
  reason?: string;
  error?: string;
}

interface ConnectionTestResult {
  success: boolean;
  responseTime?: number;
  error?: string;
  version?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: URL Validation

*For any* input string submitted as WUZAPI base URL, the validation function SHALL accept only valid HTTPS URLs and reject all other formats including empty strings, malformed URLs, HTTP-only URLs, and non-URL strings.

**Validates: Requirements 1.2**

### Property 2: Settings Persistence Round-Trip

*For any* valid WUZAPI configuration saved for a tenant, retrieving the configuration SHALL return the same baseUrl and timeout values, and the adminToken SHALL be decryptable to the original value.

**Validates: Requirements 1.3, 1.4, 2.3**

### Property 3: Tenant Configuration Resolution

*For any* user or inbox operation within a tenant, the system SHALL use that tenant's WUZAPI configuration (baseUrl and adminToken) and never use another tenant's configuration or global defaults when tenant settings exist.

**Validates: Requirements 1.6, 2.2, 5.3**

### Property 4: Webhook URL Uniqueness

*For any* inbox created within a tenant, the generated webhook URL SHALL be unique across all inboxes and SHALL contain the tenant's main domain (without subdomain).

**Validates: Requirements 2.1, 5.2**

### Property 5: Webhook Routing Accuracy

*For any* webhook event received with a valid wuzapi_token, the system SHALL:
1. Identify the correct inbox by token
2. Validate the inbox's tenant is active
3. Set the correct tenant context
4. Route to the correct account
5. Reject webhooks for inactive tenants with appropriate error

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 6: Tenant Isolation

*For any* query or update operation on tenant_settings or inbox webhook configurations, the system SHALL:
1. Only return/modify data for the current tenant
2. Reject cross-tenant access attempts
3. Include tenant_id in all queries

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 7: Fallback Configuration

*For any* tenant without configured WUZAPI settings, the system SHALL fall back to environment variables (WUZAPI_BASE_URL, WUZAPI_ADMIN_TOKEN) and never use another tenant's settings.

**Validates: Requirements 6.4, 6.5**

### Property 8: Migration Preservation

*For any* migration from global settings to tenant settings, all existing webhook configurations SHALL be preserved with identical values.

**Validates: Requirements 6.3**

## Error Handling

### Configuration Errors

| Error | HTTP Status | Response |
|-------|-------------|----------|
| Invalid URL format | 400 | `{ error: 'INVALID_URL', message: 'URL must be a valid HTTPS URL' }` |
| Connection test failed | 200 | `{ success: false, warning: 'Connection failed but settings saved' }` |
| Encryption failed | 500 | `{ error: 'ENCRYPTION_ERROR', message: 'Failed to encrypt token' }` |
| Tenant not found | 404 | `{ error: 'TENANT_NOT_FOUND', message: 'Tenant does not exist' }` |

### Webhook Routing Errors

| Error | Action | Logging |
|-------|--------|---------|
| Token not found | Reject webhook | Log with token prefix |
| Inactive tenant | Reject webhook | Log tenant_id and status |
| Invalid tenant context | Reject webhook | Log expected vs actual tenant |
| Database error | Retry or reject | Log full error details |

### Frontend Error Display

```typescript
// Error messages for user display
const ERROR_MESSAGES = {
  INVALID_URL: 'A URL deve ser uma URL HTTPS válida',
  CONNECTION_FAILED: 'Não foi possível conectar à API. Verifique a URL e o token.',
  SAVE_FAILED: 'Erro ao salvar configurações. Tente novamente.',
  WEBHOOK_CONFIG_FAILED: 'Erro ao configurar webhook. Verifique as credenciais da API.',
  TENANT_NOT_CONFIGURED: 'Configure a API WUZAPI nas configurações do tenant primeiro.'
};
```

## Testing Strategy

### Unit Tests

- TenantSettingsService: encryption/decryption, validation, CRUD operations
- InboxWebhookService: URL generation, configuration, status retrieval
- WebhookAccountRouter: routing logic, tenant validation

### Property-Based Tests

Using Vitest with fast-check for property-based testing:

- **Property 1**: Generate random strings and verify URL validation
- **Property 2**: Generate random configs, save, retrieve, compare
- **Property 3**: Generate tenant/user combinations, verify config resolution
- **Property 4**: Generate multiple inboxes, verify URL uniqueness
- **Property 5**: Generate webhook events, verify routing accuracy
- **Property 6**: Generate cross-tenant access attempts, verify rejection
- **Property 7**: Test with/without tenant settings, verify fallback
- **Property 8**: Generate settings, migrate, verify preservation

### Integration Tests

- End-to-end webhook flow from WUZAPI to chat
- Multi-tenant isolation verification
- Configuration migration scenarios

### Test Configuration

```javascript
// vitest.config.ts
export default {
  test: {
    // Property tests run 100 iterations minimum
    testTimeout: 30000,
    // Tag format for property tests
    // Feature: tenant-webhook-configuration, Property N: description
  }
}
```

## Security Considerations

1. **Token Encryption**: Admin tokens are encrypted using AES-256-GCM before storage
2. **RLS Enforcement**: All queries use tenant_id from session context
3. **Input Validation**: All URLs validated before use
4. **Audit Logging**: All configuration changes and webhook routing logged
5. **No Cross-Tenant Access**: Strict tenant isolation at database level

## Migration Plan

1. Add `webhook_config` column to `inboxes` table
2. Create migration script to populate tenant_settings from env vars
3. Update WebhookAccountRouter to use tenant config
4. Update frontend components to use tenant context
5. Add admin UI for tenant API configuration

