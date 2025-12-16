# Test Execution Guide - Dynamic Sidebar Navigation

## Overview

This document provides instructions for running the end-to-end and integration tests for the Dynamic Sidebar Database Navigation feature.

## Test Files Created

### 1. Cypress E2E Tests
**File:** `cypress/e2e/dynamic-sidebar-navigation.cy.ts`

**Coverage:**
- Complete user flow: login → sidebar → edit → save
- Multiple connections handling
- Error scenarios (record not found, unauthorized, network errors)
- Cache functionality
- Accessibility features
- Responsive design
- Admin changes synchronization
- Performance tests

**Run Command:**
```bash
# Run all Cypress tests
npm run cypress:run

# Run specific test file
npx cypress run --spec "cypress/e2e/dynamic-sidebar-navigation.cy.ts"

# Open Cypress UI for interactive testing
npx cypress open
```

### 2. Backend Integration Tests
**File:** `server/tests/integration/dynamic-sidebar-navigation.test.js`

**Coverage:**
- GET /api/user/database-connections endpoint
- GET /api/user/database-connections/:id/record endpoint
- Rate limiting
- Multiple users scenario
- Admin changes synchronization
- Performance tests

**Run Command:**
```bash
# Run backend integration tests
node server/tests/integration/dynamic-sidebar-navigation.test.js

# Or using npm test (if configured)
npm test -- server/tests/integration/dynamic-sidebar-navigation.test.js
```

### 3. Frontend Integration Tests
**File:** `src/components/user/__tests__/DynamicSidebarNavigation.integration.test.tsx`

**Coverage:**
- Complete navigation flow
- DirectEditPage integration
- Error handling
- Loading states
- Empty states
- Accessibility

**Run Command:**
```bash
# Run frontend integration tests
npm run test -- --run src/components/user/__tests__/DynamicSidebarNavigation.integration.test.tsx

# Run with watch mode
npm run test src/components/user/__tests__/DynamicSidebarNavigation.integration.test.tsx

# Run all tests
npm run test -- --run
```

## Test Scenarios Covered

### 1. Complete User Flow
- ✅ User logs in
- ✅ Sidebar loads dynamic database connections
- ✅ Connections are sorted alphabetically
- ✅ User clicks on a connection
- ✅ Loading state is shown
- ✅ User record is fetched
- ✅ Navigation to edit page occurs
- ✅ Form is pre-populated with user data
- ✅ User edits fields
- ✅ User saves changes
- ✅ Success message is displayed

### 2. Multiple Connections
- ✅ User has multiple connections assigned
- ✅ All connections appear in sidebar
- ✅ User can navigate between different connections
- ✅ Each connection loads correct data

### 3. Different Database Types
- ✅ NocoDB connections work correctly
- ✅ SQLite connections work correctly
- ✅ Field mappings are applied correctly for each type

### 4. Error Scenarios
- ✅ Record not found - shows appropriate error message
- ✅ Connection not found - redirects to dashboard
- ✅ Unauthorized - redirects to login
- ✅ Network errors - shows retry option
- ✅ Save errors - shows error toast

### 5. Cache Functionality
- ✅ Connections are cached for 5 minutes
- ✅ Records are cached for 2 minutes
- ✅ Cache is invalidated after updates
- ✅ Subsequent visits use cached data

### 6. Accessibility
- ✅ Keyboard navigation works (Tab, Enter, Space)
- ✅ ARIA labels are present and correct
- ✅ Screen reader announcements work
- ✅ Focus management is correct
- ✅ Loading states are announced

### 7. Responsive Design
- ✅ Works on mobile viewports
- ✅ Long connection names are truncated
- ✅ Forms are responsive
- ✅ Buttons are accessible on small screens

### 8. Admin Changes Synchronization
- ✅ Connection removal is reflected after refresh
- ✅ Connection rename is reflected after refresh
- ✅ Field mapping changes are reflected after refresh
- ✅ User assignment changes are reflected after refresh

### 9. Performance
- ✅ Edit page loads within 2 seconds
- ✅ Rapid clicks are handled gracefully
- ✅ Concurrent requests work correctly
- ✅ 10 concurrent requests complete in < 2 seconds

## Running All Tests

### Full Test Suite
```bash
# Run all frontend tests
npm run test -- --run

# Run all backend tests
npm test

# Run all Cypress E2E tests
npm run cypress:run
```

### Continuous Integration
```bash
# Run tests in CI mode
npm run test:ci

# Generate coverage report
npm run test:coverage
```

## Test Data Setup

### Mock Data Used

**Test User Tokens:**
- `test-user-token-123` - Primary test user
- `test-user-token-456` - Secondary test user
- `test-admin-token-456` - Admin user

**Mock Connections:**
1. **Teste Final** (NocoDB)
   - ID: 1
   - Type: NOCODB
   - Assigned to: test-user-token-123
   - Fields: chatwootInboxName, chatwootBaseUrl, apiToken

2. **MasterMegga** (SQLite)
   - ID: 2
   - Type: SQLITE
   - Assigned to: test-user-token-123, test-user-token-456
   - Fields: name, email

**Mock Records:**
- Record 1: { id: 1, chatwootInboxName: 'HeltonWzapi', ... }
- Record 2: { id: 2, name: 'Test User', email: 'test@example.com' }

## Troubleshooting

### Tests Failing Due to Timing Issues

If tests fail with timeout errors:

1. Increase timeout in test configuration:
```typescript
// In test file
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 5000 }); // Increase from default 1000ms
```

2. Check if API mocks are properly configured:
```typescript
vi.mocked(service.method).mockResolvedValue(data);
```

### Cypress Tests Not Finding Elements

1. Check if selectors are correct
2. Add explicit waits:
```typescript
cy.wait('@apiAlias');
cy.get('element').should('be.visible');
```

### Backend Tests Failing

1. Ensure test database is clean:
```bash
rm test-*.db test-*.db-*
```

2. Check if port is available:
```bash
lsof -i :3006
```

## Test Coverage Goals

- **Unit Tests:** > 80% coverage
- **Integration Tests:** > 70% coverage
- **E2E Tests:** All critical user paths covered

## Next Steps

1. **Fix Timing Issues:** Some integration tests have timing issues that need to be resolved
2. **Add More Edge Cases:** Test with very large datasets, slow networks, etc.
3. **Performance Benchmarks:** Establish baseline performance metrics
4. **Visual Regression Tests:** Add screenshot comparison tests
5. **Load Testing:** Test with many concurrent users

## Manual Testing Checklist

Before deploying to production, manually verify:

- [ ] Login as user with multiple connections
- [ ] Click each connection and verify correct data loads
- [ ] Edit and save data in each connection type
- [ ] Test on mobile device
- [ ] Test with screen reader
- [ ] Test keyboard navigation
- [ ] Test with slow network (throttle in DevTools)
- [ ] Test error scenarios (disconnect network, invalid data)
- [ ] Verify cache works (check Network tab)
- [ ] Test as admin making changes while user is logged in

## Reporting Issues

If you find issues during testing:

1. Document the steps to reproduce
2. Include screenshots/videos if possible
3. Note the browser/device used
4. Check console for errors
5. Create an issue with all details

## Resources

- [Cypress Documentation](https://docs.cypress.io/)
- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- [Node.js Test Runner](https://nodejs.org/api/test.html)
