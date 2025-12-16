# Implementation Plan

- [x] 1. Fix Backend API Route Registration
  - Remove duplicate branding route registration in `server/routes/index.js`
  - Ensure `/api/branding` handles both public and admin endpoints based on authentication
  - Verify session middleware is properly applied to admin operations
  - Test all endpoints with curl/Postman to confirm routing works correctly
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 2. Improve HTML Sanitizer Configuration
  - Review and update `server/utils/htmlSanitizer.js` to be less restrictive
  - Allow inline scripts and styles (admin is trusted)
  - Focus blocking on dangerous patterns: external scripts, eval(), Function() constructor
  - Add detailed warnings for removed content
  - Increase size limit to 1MB with warning at 500KB
  - _Requirements: 3.2, 3.5_

- [x] 3. Fix Database NULL Handling for Optional Fields
  - Review `server/database.js` validateBrandingData() method
  - Ensure empty strings for colors are converted to NULL (not empty string)
  - Ensure empty HTML is converted to NULL (not empty string)
  - Add logging to track NULL vs empty string handling
  - Test UPDATE and INSERT operations with NULL values
  - _Requirements: 7.3, 7.4_

- [x] 4. Add Backend Logging for Debugging
  - Add detailed logging in `server/routes/brandingRoutes.js` PUT endpoint
  - Log received payload, validation results, database operations
  - Log HTML sanitization results (what was removed, warnings)
  - Log color validation and NULL conversion
  - Add request/response timing logs
  - _Requirements: 6.2, 6.3, 6.4_

- [x] 5. Fix Frontend API Endpoint URLs
  - Update `src/services/branding.ts` to use correct endpoints
  - Change admin operations from `/admin/branding` to `/branding`
  - Ensure public operations use `/branding/public`
  - Verify authentication headers are sent correctly
  - _Requirements: 4.2, 4.3_

- [x] 6. Implement Proper Form State Tracking
  - Update `src/components/admin/BrandingSettings.tsx` to track last saved state
  - Compare current form values against last saved config (not initial)
  - Update last saved reference after successful save
  - Clear "has changes" flag only after confirmed save
  - Add visual indicator for unsaved changes
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Fix Color Persistence Flow
  - Update `src/contexts/BrandingContext.tsx` to re-apply colors after save
  - Clear preview state after successful save
  - Ensure colors are applied on initial page load
  - Fix color application for both light and dark modes
  - Add logging for color application debugging
  - _Requirements: 2.3, 2.4_

- [x] 8. Improve Error Handling and User Feedback
  - Add field-specific validation error display in `BrandingSettings.tsx`
  - Implement retry logic for failed save operations (max 2 attempts)
  - Add specific error messages for different failure types (network, auth, validation)
  - Show success toast only after confirmed save
  - Display HTML sanitization warnings to user
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 9. Implement Cache Invalidation After Save
  - Update `src/services/branding.ts` to clear cache after successful update
  - Force refresh from server after save operation
  - Update BrandingContext to reload config after save
  - Clear localStorage cache after save
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 10. Add Request Deduplication
  - Update `src/services/branding.ts` to prevent multiple simultaneous save requests
  - Implement promise-based request deduplication
  - Show loading state during save operation
  - Disable save button while request is in progress
  - _Requirements: 1.1, 1.2_

- [x] 11. Fix Color Preview Toggle
  - Update `BrandingSettings.tsx` to properly cleanup preview on toggle off
  - Ensure preview colors are applied with debounce (300ms)
  - Restore saved colors when preview is cancelled
  - Add visual indicator when preview is active
  - _Requirements: 2.2_

- [x] 12. Add Validation for Color Format
  - Implement hex color validation in `src/services/branding.ts`
  - Validate format as #RRGGBB (6 hex digits)
  - Check color brightness for accessibility warnings
  - Validate color contrast between primary and secondary
  - _Requirements: 2.1_

- [x] 13. Implement HTML Preview Modal
  - Verify `HtmlPreviewModal.tsx` renders custom HTML correctly
  - Apply current branding config (colors, logo) to preview
  - Add security sandbox for preview iframe
  - Show preview in modal with close button
  - _Requirements: 3.3_

- [x] 14. Add Database Transaction Support
  - Update `server/database.js` to use transactions for branding updates
  - Ensure atomic updates (all or nothing)
  - Add rollback on error
  - Log transaction start/commit/rollback
  - _Requirements: 7.2_

- [x] 15. Fix Public Endpoint Caching
  - Update `server/routes/brandingRoutes.js` public endpoints
  - Set Cache-Control headers (5 minutes)
  - Invalidate cache after admin updates
  - Test cache behavior with browser dev tools
  - _Requirements: 8.5_

- [x] 16. Add Comprehensive Logging
  - Add structured logging throughout save/load flow
  - Log form submission, validation, API calls, database operations
  - Log color application, HTML sanitization, cache operations
  - Use consistent log format with timestamps and context
  - _Requirements: 1.2, 1.3, 2.3, 3.2_

- [ ] 17. Test Complete Save/Load Flow
  - Manually test: fill form → save → reload page → verify persistence
  - Test with valid data for all fields
  - Test with NULL values (empty colors, no HTML)
  - Test with only some fields filled
  - Verify database contains correct data after save
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 18. Test Color Persistence
  - Manually test: set colors → preview → save → reload → verify colors applied
  - Test primary color only
  - Test secondary color only
  - Test both colors
  - Test reset to default
  - Verify colors work in both light and dark modes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 19. Test Custom HTML Flow
  - Manually test: enter HTML → preview → save → access public page → verify HTML
  - Test with simple HTML
  - Test with inline styles
  - Test with inline scripts
  - Test with large HTML (near 1MB limit)
  - Verify HTML sanitization warnings are shown
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 20. Test Error Scenarios
  - Test save with invalid app name (too short, too long, invalid chars)
  - Test save with invalid logo URL
  - Test save with invalid color format
  - Test save with HTML containing security threats
  - Test save without authentication
  - Test save with network error (disconnect during save)
  - Verify appropriate error messages are shown
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 21. Verify Form State Tracking
  - Test that "has changes" indicator appears when form is modified
  - Test that save button is disabled when no changes
  - Test that save button is enabled when changes exist
  - Test that "has changes" clears after successful save
  - Test that refresh reloads data and clears changes
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 22. Test Authentication and Authorization
  - Test admin endpoints with valid admin session
  - Test admin endpoints with no session (should fail with 401)
  - Test admin endpoints with user session (should fail with 403)
  - Test public endpoints without authentication (should work)
  - Verify error messages are clear
  - _Requirements: 4.4, 4.5_

- [ ] 23. Performance Testing
  - Measure save operation time (should be < 500ms)
  - Measure page load time with branding config
  - Test with large HTML (near 1MB)
  - Test with many rapid saves (should deduplicate)
  - Verify no memory leaks in color preview
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 24. Browser Compatibility Testing
  - Test in Chrome (latest)
  - Test in Firefox (latest)
  - Test in Safari (latest)
  - Test in Edge (latest)
  - Verify color picker works in all browsers
  - Verify HTML preview works in all browsers
  - _Requirements: 1.3, 2.3, 3.3_

- [ ] 25. Final Integration Testing
  - Run complete user flow: login → settings → configure → save → logout → verify public page
  - Test with multiple admin users (concurrent edits)
  - Test with user accessing public page while admin is editing
  - Verify no console errors or warnings
  - Verify all success/error toasts appear correctly
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
