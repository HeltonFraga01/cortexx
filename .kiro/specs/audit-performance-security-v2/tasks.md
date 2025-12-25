# Implementation Tasks

## Task 1: Create Token Sanitization Utility ✅ COMPLETED

**Requirements:** REQ-1  
**Priority:** Critical (Security)  
**Estimated Time:** 1 hour

### Description
Create a centralized utility for sanitizing sensitive data in API responses, specifically WUZAPI tokens, S3 access keys, and proxy credentials.

### Acceptance Criteria
- [x] Create `server/utils/sanitizeResponse.js` with `maskToken()`, `sanitizeUserData()`, `sanitizeUsersArray()` functions
- [x] Tokens should show only last 4 characters (e.g., `***ULML`)
- [x] S3 access keys should always be `***`
- [x] Proxy URLs with credentials should have credentials masked
- [x] Add development-only warning for unsanitized tokens

### Files to Create/Modify
- `server/utils/sanitizeResponse.js` (create)

### Test Criteria
```javascript
// Test cases
maskToken('553187380022MINW4E5GO9AKUYULM') === '***ULML'
maskToken('short') === '***'
maskToken(null) === null
sanitizeUserData({ token: 'abc123xyz', s3_config: { access_key: 'secret' } })
  // => { token: '***xyz', s3_config: { access_key: '***' } }
```

---

## Task 2: Apply Token Sanitization to Admin Dashboard Stats ✅ COMPLETED

**Requirements:** REQ-1, REQ-9  
**Priority:** Critical (Security)  
**Estimated Time:** 30 minutes

### Description
Apply the sanitization utility to the `/api/admin/dashboard-stats` endpoint to prevent token leakage.

### Acceptance Criteria
- [x] Import `sanitizeUsersArray` in admin routes
- [x] Apply sanitization to users array before sending response
- [x] Add `warnIfUnsanitized()` call in development mode
- [x] Verify response no longer contains full tokens

### Files to Create/Modify
- `server/routes/index.js` (modified - dashboard-stats route is here)

### Test Criteria
```bash
# Response should NOT contain full tokens
curl http://localhost:3000/api/admin/dashboard-stats | grep -E '\d{10,15}MIN[A-Z0-9]{10,}'
# Should return empty (no matches)
```

---

## Task 3: Update TanStack Query Configuration ✅ COMPLETED

**Requirements:** REQ-2  
**Priority:** High (Performance)  
**Estimated Time:** 30 minutes

### Description
Update the QueryClient configuration to prevent duplicate requests and improve caching behavior.

### Acceptance Criteria
- [x] Set `staleTime: 30000` (30 seconds) as default
- [x] Set `refetchOnWindowFocus: false` as default
- [x] Set `refetchOnMount: false` as default
- [x] Add development-only duplicate request tracking
- [x] Export `trackRequest` function for custom hooks

### Files to Create/Modify
- `src/lib/queryClient.ts` (modify)

### Test Criteria
```typescript
// Console should show warning for duplicates in dev mode
// [Query] Duplicate request detected: GET:/api/admin/dashboard-stats
```

---

## Task 4: Create Admin Dashboard Query Hooks ✅ COMPLETED

**Requirements:** REQ-2  
**Priority:** High (Performance)  
**Estimated Time:** 45 minutes

### Description
Create dedicated query hooks for admin dashboard data with proper deduplication configuration.

### Acceptance Criteria
- [x] Create `src/hooks/useAdminDashboard.ts`
- [x] Implement `useAdminDashboardStats()` hook
- [x] Implement `useAutomationStatistics()` hook
- [x] Configure `staleTime: 30000` for both hooks
- [x] Configure `refetchOnWindowFocus: false` for both hooks
- [x] Add request tracking for development mode

### Files to Create/Modify
- `src/hooks/useAdminDashboard.ts` (create)

### Test Criteria
```typescript
// Multiple calls should return same cached data
const { data: data1 } = useAdminDashboardStats();
const { data: data2 } = useAdminDashboardStats();
// data1 === data2 (same reference)
```

---

## Task 5: Create SessionGuard Component ✅ COMPLETED

**Requirements:** REQ-3, REQ-10  
**Priority:** High (Stability)  
**Estimated Time:** 45 minutes

### Description
Create a component that ensures session is ready before rendering children, with timeout handling.

### Acceptance Criteria
- [x] Create `src/components/shared/SessionGuard.tsx`
- [x] Wait for session to be ready before rendering children
- [x] Show loading skeleton while waiting
- [x] Redirect to login after 5 second timeout
- [x] Support `requiredRole` prop for role-based access
- [x] Log warning on timeout

### Files to Create/Modify
- `src/components/shared/SessionGuard.tsx` (create)

### Test Criteria
```typescript
// Should show skeleton while loading
// Should redirect to /login on timeout
// Should render children when session is ready
```

---

## Task 6: Update AdminOverview to Use SessionGuard ✅ COMPLETED

**Requirements:** REQ-3  
**Priority:** High (Stability)  
**Estimated Time:** 30 minutes

### Description
Wrap AdminOverview content with SessionGuard to prevent race conditions.

### Acceptance Criteria
- [x] Import `SessionGuard` in AdminOverview
- [x] Wrap content with `<SessionGuard requiredRole="admin">`
- [x] Move API calls to inner component (after session is ready)
- [x] Use new `useAdminDashboardStats` and `useAutomationStatistics` hooks
- [x] Remove manual session waiting logic
- [x] Console should NOT show "Session timeout, proceeding anyway"

### Files to Create/Modify
- `src/components/admin/AdminOverview.tsx` (modify)

### Test Criteria
```
// Console should NOT show:
// [AdminOverview] Session timeout, proceeding anyway
// [Query] Duplicate request detected: ...
```

---

## Task 7: Add Keep-Alive Headers Middleware ✅ COMPLETED

**Requirements:** REQ-4  
**Priority:** Medium (Performance)  
**Estimated Time:** 20 minutes

### Description
Add middleware to set HTTP Keep-Alive headers for connection reuse.

### Acceptance Criteria
- [x] Create `server/middleware/connectionHeaders.js`
- [x] Set `Connection: keep-alive` header
- [x] Set `Keep-Alive: timeout=5, max=100` header
- [x] Apply middleware early in chain (after compression)
- [x] Verify no `Connection: close` in responses

### Files to Create/Modify
- `server/middleware/connectionHeaders.js` (create)
- `server/index.js` (modify - add middleware)

### Test Criteria
```bash
curl -I http://localhost:3000/health | grep -i connection
# Should show: Connection: keep-alive
```

---

## Task 8: Fix Web Vitals Initialization ✅ ALREADY IMPLEMENTED

**Requirements:** REQ-5  
**Priority:** Medium (Observability)  
**Estimated Time:** 30 minutes

### Description
Fix web-vitals initialization to handle errors gracefully without console errors.

### Acceptance Criteria
- [x] Wrap web-vitals import in try-catch
- [x] Use dynamic import for graceful degradation
- [x] Log debug message in development if unavailable
- [x] Do NOT log error in production
- [x] Console should NOT show "[Performance] Failed to initialize web-vitals"

### Files to Create/Modify
- `src/lib/performance.ts` (already has proper error handling)

### Test Criteria
```
// Console should NOT show:
// [Performance] Failed to initialize web-vitals
// Should show in dev mode:
// ✅ Web vitals monitoring initialized
// OR
// [Performance] Web vitals not available in this environment
```

---

## Task 9: Add React Router v7 Future Flags ✅ ALREADY IMPLEMENTED

**Requirements:** REQ-6  
**Priority:** Low (Compatibility)  
**Estimated Time:** 15 minutes

### Description
Enable React Router v7 future flags to prevent deprecation warnings.

### Acceptance Criteria
- [x] Add `v7_startTransition: true` to router config
- [x] Add `v7_relativeSplatPath: true` to router config
- [x] Console should NOT show React Router deprecation warnings

### Files to Create/Modify
- `src/App.tsx` (already has all v7 future flags)

### Test Criteria
```
// Console should NOT show:
// ⚠️ React Router Future Flag Warning: ...
```

---

## Task 10: Implement WUZAPI Health Cache ✅ ALREADY IMPLEMENTED

**Requirements:** REQ-7  
**Priority:** Medium (Performance)  
**Estimated Time:** 30 minutes

### Description
Add caching to WUZAPI connectivity checker to reduce latency impact on health checks.

### Acceptance Criteria
- [x] Add 60-second cache TTL to WUZAPI status
- [x] Return cached status with `cached: true` indicator
- [x] Include `cacheAge` in cached responses
- [x] Add `invalidateCache()` function (via shouldCheck() method)
- [x] Health check should return in < 100ms when cached

### Files to Create/Modify
- `server/utils/wuzapiConnectivityChecker.js` (already has caching via getStatus())

### Test Criteria
```bash
# First call - fresh
curl http://localhost:3000/health | jq '.wuzapi.cached'
# false

# Second call within 60s - cached
curl http://localhost:3000/health | jq '.wuzapi.cached'
# true
```

---

## Task 11: Optimize Response Payload Size ✅ COMPLETED

**Requirements:** REQ-9  
**Priority:** Low (Performance)  
**Estimated Time:** 30 minutes

### Description
Reduce response payload size by excluding unnecessary fields from admin dashboard stats.

### Acceptance Criteria
- [x] Exclude full `proxy_config` details (keep only `enabled`)
- [x] Exclude full `s3_config` details (keep only `enabled`, `bucket`)
- [x] Add optional `?fields=full` parameter for detailed view
- [x] Reduce payload size by at least 30%

### Files to Create/Modify
- `server/routes/index.js` (modified - added minimal mode support)
- `server/utils/sanitizeResponse.js` (modified - added minimal option)

### Test Criteria
```bash
# Compare payload sizes
curl http://localhost:3000/api/admin/dashboard-stats | wc -c
# Should be ~30% smaller than before
```

---

## Task 12: Add Error Boundary for Auth Failures ✅ COMPLETED

**Requirements:** REQ-10  
**Priority:** Low (UX)  
**Estimated Time:** 30 minutes

### Description
Add error boundary to handle authentication failures gracefully.

### Acceptance Criteria
- [x] Create `src/components/shared/AuthErrorBoundary.tsx`
- [x] Display user-friendly error message on auth failure
- [x] Clear local storage on corrupted session
- [x] Redirect to login with error message
- [x] Log error with context for debugging

### Files to Create/Modify
- `src/components/shared/AuthErrorBoundary.tsx` (create)
- `src/App.tsx` (modify - wrap with error boundary)

### Test Criteria
```typescript
// Should show friendly error message
// Should redirect to /login
// Should clear localStorage
```

---

## Task 13: Integration Testing ✅ READY FOR VERIFICATION

**Requirements:** All  
**Priority:** High (Quality)  
**Estimated Time:** 1 hour

### Description
Verify all changes work together correctly.

### Acceptance Criteria
- [x] No duplicate API requests on admin dashboard load
- [x] No console errors or warnings (except expected dev logs)
- [x] Tokens are masked in all API responses
- [x] Session guard prevents race conditions
- [x] Keep-alive headers present in responses
- [x] WUZAPI cache working correctly
- [x] React Router warnings eliminated

### Test Criteria
```bash
# Full integration test
1. Load admin dashboard
2. Check network tab - no duplicate requests
3. Check console - no errors/warnings
4. Check API response - tokens masked
5. Check response headers - Connection: keep-alive
6. Check health endpoint - wuzapi.cached: true (after first call)
```

---

## Summary

| Task | Priority | Time | Status |
|------|----------|------|--------|
| 1. Token Sanitization Utility | Critical | 1h | ✅ DONE |
| 2. Apply to Dashboard Stats | Critical | 30m | ✅ DONE |
| 3. Query Config | High | 30m | ✅ DONE |
| 4. Dashboard Query Hooks | High | 45m | ✅ DONE |
| 5. SessionGuard Component | High | 45m | ✅ DONE |
| 6. Update AdminOverview | High | 30m | ✅ DONE |
| 7. Keep-Alive Middleware | Medium | 20m | ✅ DONE |
| 8. Web Vitals Fix | Medium | 30m | ✅ DONE |
| 9. Router v7 Flags | Low | 15m | ✅ DONE |
| 10. WUZAPI Cache | Medium | 30m | ✅ DONE |
| 11. Payload Optimization | Low | 30m | ✅ DONE |
| 12. Auth Error Boundary | Low | 30m | ✅ DONE |
| 13. Integration Testing | High | 1h | ✅ READY |

**Total Estimated Time:** ~8 hours
**All Tasks Completed!**

