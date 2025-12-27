# Requirements Document - Audit Técnica v2 (26/12/2025)

## Introduction

Este documento define os requisitos para correção de problemas identificados na auditoria técnica de 26/12/2025 da plataforma Cortexx (User Dashboard). O objetivo é eliminar vulnerabilidades de segurança (RLS desabilitado, funções com search_path mutável), corrigir requisições duplicadas, resolver problemas de API, e melhorar performance.

**Auditoria Base:** http://cortexx.localhost:8080/user/dashboard  
**Estado Atual:** OK com ajustes necessários  
**Métricas Atuais:** LCP 1,167ms ⚠️, CLS 0.01 ✅, TTFB 18ms ✅

## Glossary

- **RLS**: Row Level Security - Política de segurança do PostgreSQL que restringe acesso a linhas
- **search_path**: Variável do PostgreSQL que define ordem de busca de schemas
- **Request_Deduplication**: Técnica de evitar múltiplas requisições idênticas simultâneas
- **LCP**: Largest Contentful Paint - Métrica de performance do Google
- **WUZAPI**: API externa de WhatsApp Business usada pela plataforma
- **TanStack_Query**: Biblioteca de gerenciamento de estado assíncrono com cache

## Requirements

### Requirement 1: Enable RLS on Exposed Tables (CRITICAL)

**User Story:** As a security engineer, I want all public tables to have RLS enabled, so that data cannot be accessed without proper authorization.

#### Acceptance Criteria

1. THE System SHALL enable RLS on `contact_duplicate_dismissals` table
2. THE System SHALL enable RLS on `contact_merge_audit` table
3. THE System SHALL enable RLS on `campaign_error_logs` table
4. THE System SHALL enable RLS on `express_sessions` table
5. THE System SHALL enable RLS on `page_builder_themes` table
6. EACH table SHALL have appropriate RLS policies based on `account_id` or `tenant_id`
7. THE System SHALL verify RLS is working by running Supabase security advisors

### Requirement 2: Fix Function Search Path Security

**User Story:** As a security engineer, I want all database functions to have immutable search_path, so that SQL injection via search_path manipulation is prevented.

#### Acceptance Criteria

1. THE Function `update_user_preferences_updated_at` SHALL have `SET search_path = public`
2. THE Function `calculate_total_mrr` SHALL have `SET search_path = public`
3. THE Function `update_updated_at_column` SHALL have `SET search_path = public`
4. THE System SHALL verify no functions have mutable search_path by running Supabase security advisors

### Requirement 3: API Request Deduplication

**User Story:** As a user, I want the application to make efficient API calls, so that pages load faster and server resources are conserved.

#### Acceptance Criteria

1. WHEN User Dashboard loads, THE System SHALL NOT make duplicate calls to `/user/account-summary` (currently 6+ calls)
2. WHEN User Dashboard loads, THE System SHALL NOT make duplicate calls to `/user/database-connections` (currently 4+ calls)
3. WHEN User Dashboard loads, THE System SHALL NOT make duplicate calls to `/api/custom-links` (currently 2 calls)
4. THE TanStack_Query SHALL configure `staleTime: 5 * 60 * 1000` (5 minutes) for dashboard queries
5. THE TanStack_Query SHALL configure `refetchOnMount: false` for dashboard queries
6. THE TanStack_Query SHALL configure `refetchOnWindowFocus: false` for dashboard queries
7. THE System SHALL reduce total API calls on user dashboard load by at least 50%

### Requirement 4: Add processing_lock Column to bulk_campaigns

**User Story:** As a developer, I want the bulk_campaigns table to have the processing_lock column, so that campaign processing errors are eliminated.

#### Acceptance Criteria

1. THE `bulk_campaigns` table SHALL have a `processing_lock` column of type TEXT (nullable)
2. THE `bulk_campaigns` table SHALL have a `lock_acquired_at` column of type TIMESTAMPTZ (nullable)
3. THE System SHALL NOT log errors about missing `processing_lock` column on startup
4. THE migration SHALL be idempotent (safe to run multiple times)

### Requirement 5: Enable Leaked Password Protection

**User Story:** As a security engineer, I want leaked password protection enabled, so that users cannot use compromised passwords.

#### Acceptance Criteria

1. THE Supabase Auth SHALL have leaked password protection enabled
2. WHEN a user attempts to set a compromised password, THE System SHALL reject it
3. THE System SHALL verify protection is enabled by running Supabase security advisors

### Requirement 6: LCP Performance Optimization

**User Story:** As a user, I want the dashboard to load faster, so that I can start working immediately.

#### Acceptance Criteria

1. THE LCP SHALL be reduced from 1,167ms to under 800ms
2. THE Element render delay SHALL be reduced from 1,149ms (98.5% of LCP) to under 500ms
3. THE Critical path latency SHALL be reduced from 5,293ms to under 3,000ms
4. THE System SHALL implement lazy loading for non-critical dashboard components
5. THE System SHALL preload critical API data during initial page load

### Requirement 7: Web Vitals Initialization Fix

**User Story:** As a developer, I want performance metrics to be collected reliably, so that I can monitor application health.

#### Acceptance Criteria

1. WHEN the application initializes, THE Console SHALL NOT display `[Performance] Failed to initialize web-vitals` error
2. WHEN web-vitals library fails to load, THE System SHALL gracefully degrade without errors
3. THE System SHALL wrap web-vitals initialization in try-catch with proper error handling

### Requirement 8: Forced Reflow Optimization

**User Story:** As a user, I want smooth UI interactions, so that the dashboard feels responsive.

#### Acceptance Criteria

1. THE Recharts library forced reflow SHALL be reduced from 31ms to under 10ms
2. THE System SHALL use CSS containment for chart components
3. THE System SHALL batch DOM reads and writes to prevent layout thrashing

## Priority Order

1. **CRITICAL** - Requirement 1: Enable RLS on Exposed Tables
2. **CRITICAL** - Requirement 4: Add processing_lock Column
3. **HIGH** - Requirement 2: Fix Function Search Path Security
4. **HIGH** - Requirement 3: API Request Deduplication
5. **MEDIUM** - Requirement 5: Enable Leaked Password Protection
6. **MEDIUM** - Requirement 6: LCP Performance Optimization
7. **LOW** - Requirement 7: Web Vitals Initialization Fix
8. **LOW** - Requirement 8: Forced Reflow Optimization

## Technical Notes

### Tables Without RLS (from Supabase Advisors)
- `contact_duplicate_dismissals` - Needs RLS with account_id filter
- `contact_merge_audit` - Needs RLS with account_id filter
- `campaign_error_logs` - Needs RLS with campaign_id -> account_id filter
- `express_sessions` - Needs RLS (session storage, restrict to service role)
- `page_builder_themes` - Needs RLS with account_id filter

### Functions with Mutable search_path (from Supabase Advisors)
- `update_user_preferences_updated_at`
- `calculate_total_mrr`
- `update_updated_at_column`

### Duplicate API Calls (from Network Analysis)
- `/user/account-summary`: 6+ calls per page load
- `/user/database-connections`: 4+ calls per page load
- `/api/custom-links`: 2 calls per page load

### Performance Metrics (from Chrome DevTools)
- LCP: 1,167ms (target: <800ms)
- Element render delay: 1,149ms (98.5% of LCP)
- Critical path latency: 5,293ms
- Forced reflow: 31ms (Recharts)
