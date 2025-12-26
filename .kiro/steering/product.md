---
inclusion: always
---

# Product Context & Domain Rules

Cortexx is a multi-tenant WhatsApp Business API management platform with messaging, webhooks, AI automation, and external database integration.

## Security Model (CRITICAL)

Three-role authentication - enforce strictly:

| Role | Token | Data Scope | Route Pattern |
|------|-------|------------|---------------|
| Admin | admin token | All tenant data | `server/routes/admin*.js` |
| User | user token | Own data only | `server/routes/user*.js` |
| Public | none | No auth | `server/routes/public*.js` |

**Mandatory Rules:**
- Admin endpoints MUST reject user tokens
- User endpoints MUST filter queries by `userId` or `tenantId`
- NEVER allow cross-user/cross-tenant data access
- Always validate token type before processing requests

## Required Abstractions

| Integration | Backend Module | Frontend Module |
|-------------|----------------|-----------------|
| WhatsApp API | `server/utils/wuzapiClient.js` | `src/services/wuzapi.ts` |
| Payments | `server/services/StripeService.js` | - |
| External DB | - | `src/services/nocodb.ts` |

**Never bypass these layers with direct API calls.**

## Core Features

**Messaging:**
- Variable substitution: `{{name}}`, `{{phone}}`
- Bulk: CSV upload → queue processing → status tracking
- Rate limiting enforced

**Webhooks:**
- User-defined URLs for WUZAPI event forwarding
- 40+ event types: `message.received`, `message.sent`, `qr.code`, `connection.status`

**Branding:**
- Table: `branding` (logo, colors, company name)
- Context: `BrandingContext` - loads on app init, updates immediately

**Payments (Stripe):**
- Tables: `plans`, `user_subscriptions`, `user_quota_usage`
- Webhooks: `checkout.session.completed`, `invoice.paid`, `customer.subscription.*`

**Database Navigation (NocoDB):**
- User-scoped connections
- **All list views MUST implement pagination**

## State Management

| Type | Tool | Usage |
|------|------|-------|
| Global | React Context | `AuthContext`, `BrandingContext`, `WuzAPIContext` |
| Server | TanStack Query | Cache, refetch, optimistic updates |
| Forms | React Hook Form + Zod | Schema validation, type-safe handling |

## UX Patterns

- Success/Error: `useToast` hook for notifications
- Loading: `isLoading` states for async operations
- Destructive actions: Confirmation dialogs required
