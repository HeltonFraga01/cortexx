# Design Document - Audit Técnica v2 (26/12/2025)

## Overview

Este documento descreve a arquitetura e implementação das correções identificadas na auditoria técnica de 26/12/2025.

## Architecture

### 1. Database Security Layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tables with RLS (to be enabled):                           │
│  ├── contact_duplicate_dismissals                           │
│  │   └── Policy: account_id = auth.uid() OR service_role    │
│  ├── contact_merge_audit                                    │
│  │   └── Policy: account_id = auth.uid() OR service_role    │
│  ├── campaign_error_logs                                    │
│  │   └── Policy: via campaign_id -> bulk_campaigns.account_id│
│  ├── express_sessions                                       │
│  │   └── Policy: service_role only (no public access)       │
│  └── page_builder_themes                                    │
│      └── Policy: account_id = auth.uid() OR service_role    │
│                                                             │
│  Functions with search_path fix:                            │
│  ├── update_user_preferences_updated_at                     │
│  ├── calculate_total_mrr                                    │
│  └── update_updated_at_column                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Request Deduplication Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TanStack Query Configuration:                              │
│  ├── staleTime: 5 * 60 * 1000 (5 minutes)                  │
│  ├── gcTime: 10 * 60 * 1000 (10 minutes)                   │
│  ├── refetchOnMount: false                                  │
│  ├── refetchOnWindowFocus: false                            │
│  └── refetchOnReconnect: false                              │
│                                                             │
│  Query Keys (unique per resource):                          │
│  ├── ['user', 'account-summary']                            │
│  ├── ['user', 'database-connections']                       │
│  └── ['custom-links']                                       │
│                                                             │
│  Hooks with deduplication:                                  │
│  ├── useAccountSummary() - single source of truth           │
│  ├── useDatabaseConnections() - single source of truth      │
│  └── useCustomLinks() - single source of truth              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Performance Optimization Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User Dashboard                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Critical Path (load first):                                │
│  ├── Auth context                                           │
│  ├── Inbox context                                          │
│  └── Account summary                                        │
│                                                             │
│  Lazy Loaded (load after LCP):                              │
│  ├── Charts (Recharts)                                      │
│  ├── Database connections list                              │
│  └── Activity feed                                          │
│                                                             │
│  Preloaded Data:                                            │
│  ├── Prefetch account-summary on auth                       │
│  └── Prefetch inbox-context on auth                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Migration 1: Enable RLS on Tables

```sql
-- Enable RLS on contact_duplicate_dismissals
ALTER TABLE contact_duplicate_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dismissals" ON contact_duplicate_dismissals
  FOR SELECT USING (
    account_id IN (
      SELECT id FROM accounts WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access" ON contact_duplicate_dismissals
  FOR ALL USING (auth.role() = 'service_role');

-- Similar for other tables...
```

### Migration 2: Fix Function Search Path

```sql
ALTER FUNCTION update_user_preferences_updated_at()
  SET search_path = public;

ALTER FUNCTION calculate_total_mrr()
  SET search_path = public;

ALTER FUNCTION update_updated_at_column()
  SET search_path = public;
```

### Migration 3: Add processing_lock Column

```sql
-- Idempotent migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bulk_campaigns' AND column_name = 'processing_lock'
  ) THEN
    ALTER TABLE bulk_campaigns ADD COLUMN processing_lock TEXT;
    ALTER TABLE bulk_campaigns ADD COLUMN lock_acquired_at TIMESTAMPTZ;
    COMMENT ON COLUMN bulk_campaigns.processing_lock IS 'Lock ID for campaign processing';
    COMMENT ON COLUMN bulk_campaigns.lock_acquired_at IS 'Timestamp when lock was acquired';
  END IF;
END $$;
```

### Query Client Configuration Update

```typescript
// src/lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // 5 minutes
      gcTime: 10 * 60 * 1000,        // 10 minutes
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      structuralSharing: true,
      retry: (failureCount, error) => {
        if (error instanceof Error && 'status' in error) {
          const status = (error as Error & { status: number }).status
          if (status >= 400 && status < 500 && status !== 408) {
            return false
          }
        }
        return failureCount < 1
      },
      retryDelay: 1000,
    },
  },
})
```

### Lazy Loading Implementation

```typescript
// src/pages/UserDashboard.tsx
const DashboardCharts = lazy(() => import('@/components/user/DashboardCharts'))
const DatabaseConnectionsList = lazy(() => import('@/components/user/DatabaseConnectionsList'))

function UserDashboard() {
  return (
    <div>
      {/* Critical content loads immediately */}
      <DashboardHeader />
      <AccountSummary />
      
      {/* Non-critical content lazy loaded */}
      <Suspense fallback={<ChartSkeleton />}>
        <DashboardCharts />
      </Suspense>
      
      <Suspense fallback={<ListSkeleton />}>
        <DatabaseConnectionsList />
      </Suspense>
    </div>
  )
}
```

## File Changes

### Database Migrations
- `server/migrations/YYYYMMDD_enable_rls_exposed_tables.sql`
- `server/migrations/YYYYMMDD_fix_function_search_path.sql`
- `server/migrations/YYYYMMDD_add_processing_lock_column.sql`

### Frontend Changes
- `src/lib/queryClient.ts` - Already configured correctly ✅
- `src/hooks/useAccountSummary.ts` - Ensure single query key
- `src/hooks/useDatabaseConnections.ts` - Ensure single query key
- `src/pages/UserDashboard.tsx` - Add lazy loading

### Backend Changes
- None required for this audit (routes are correctly implemented)

## Testing Strategy

1. **Security Testing**
   - Run Supabase security advisors after migrations
   - Verify RLS policies block unauthorized access
   - Test function search_path is immutable

2. **Performance Testing**
   - Measure LCP before and after changes
   - Count API calls on dashboard load
   - Verify no duplicate requests in Network tab

3. **Regression Testing**
   - Verify all dashboard features work correctly
   - Test campaign processing with new columns
   - Verify session management works with RLS

## Rollback Plan

Each migration is designed to be reversible:

```sql
-- Rollback RLS
ALTER TABLE contact_duplicate_dismissals DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own dismissals" ON contact_duplicate_dismissals;
DROP POLICY IF EXISTS "Service role full access" ON contact_duplicate_dismissals;

-- Rollback function changes
ALTER FUNCTION update_user_preferences_updated_at() RESET search_path;

-- Rollback column additions
ALTER TABLE bulk_campaigns DROP COLUMN IF EXISTS processing_lock;
ALTER TABLE bulk_campaigns DROP COLUMN IF EXISTS lock_acquired_at;
```
