# Manual Testing Guide - Kanban Card Field Filtering

## Test Environment
- **Server**: Running on http://localhost:8080 (frontend) and http://localhost:3001 (backend)
- **Date**: 2025-11-11
- **Tester**: Development Team

## Pre-Test Setup

### Database Connections Available
1. **Connection #1 (MasterMegga)**: Legacy connection without `showInCard` property
2. **Connection #2 (Teste Final)**: Legacy connection without `showInCard` property
3. **Connection #3 (SeusPuloFlix)**: New connection with `showInCard` property (1 field marked as true)

## Test Cases

### 7.1 Test Basic Functionality

#### Test 7.1.1: Verify Kanban View with showInCard Configuration
**Connection**: #3 (SeusPuloFlix)
**Expected Behavior**:
- ✅ Only fields with `showInCard: true` should be displayed in cards
- ✅ Field `keyRemoteJid` should be visible (it has `showInCard: true`)
- ✅ Field labels should be displayed correctly
- ✅ Field values should be formatted properly

**Steps**:
1. Navigate to User Dashboard
2. Select connection "SeusPuloFlix"
3. Switch to Kanban view
4. Verify that cards show only the configured field(s)

**Result**: ⏳ Pending manual verification

---

#### Test 7.1.2: Verify Fallback Behavior (Legacy Connection)
**Connection**: #1 (MasterMegga)
**Expected Behavior**:
- ✅ Since no fields have `showInCard: true`, should show first 3 visible non-technical fields
- ✅ Should NOT show: id, Id, created_at, updated_at, created_by, updated_by, nc_order
- ✅ Should show first 3 visible fields like: name, fone, site, etc.

**Steps**:
1. Navigate to User Dashboard
2. Select connection "MasterMegga"
3. Switch to Kanban view
4. Verify that cards show first 3 visible non-technical fields

**Result**: ⏳ Pending manual verification

---

#### Test 7.1.3: Verify Field Value Formatting
**Connection**: Any with diverse field types
**Expected Behavior**:
- ✅ Boolean values: Display as "Sim" or "Não"
- ✅ Numbers: Display with locale formatting (e.g., 1.234,56)
- ✅ Dates: Display with locale date formatting (e.g., 11/11/2025)
- ✅ Strings: Display as-is
- ✅ Null/undefined/empty: Field should be skipped (not displayed)
- ✅ Boolean false and number 0: Should be displayed (valid values)

**Steps**:
1. Find records with different field types
2. Verify each type is formatted correctly
3. Verify null/empty fields are skipped
4. Verify false and 0 are displayed

**Result**: ⏳ Pending manual verification

---

### 7.2 Test Consistency Across Views

#### Test 7.2.1: Grid View Consistency
**Expected Behavior**:
- ✅ Grid view should use same field filtering logic as Kanban
- ✅ Should show fields with `showInCard: true` first
- ✅ Should fallback to first 4 visible non-technical fields
- ✅ Should display up to 4 fields per card

**Steps**:
1. Select any connection
2. Switch to Grid view
3. Verify field display matches Kanban logic
4. Count fields displayed (max 4)

**Result**: ⏳ Pending manual verification

---

#### Test 7.2.2: List View Consistency
**Expected Behavior**:
- ✅ List view should use same field filtering logic as Kanban
- ✅ Should show fields with `showInCard: true` first
- ✅ Should fallback to first 4 visible non-technical fields
- ✅ Should display up to 4 fields per row

**Steps**:
1. Select any connection
2. Switch to List view
3. Verify field display matches Kanban logic
4. Count fields displayed (max 4)

**Result**: ⏳ Pending manual verification

---

#### Test 7.2.3: View Switching Consistency
**Expected Behavior**:
- ✅ Switching between views should maintain same field selection
- ✅ No errors or crashes when switching
- ✅ Data should remain consistent

**Steps**:
1. Start in Grid view
2. Note which fields are displayed
3. Switch to List view → verify same fields
4. Switch to Kanban view → verify same fields
5. Switch back to Grid → verify same fields

**Result**: ⏳ Pending manual verification

---

### 7.3 Test Edge Cases

#### Test 7.3.1: No Fields with showInCard: true
**Connection**: #1 or #2 (legacy connections)
**Expected Behavior**:
- ✅ Should show first 3 visible non-technical fields
- ✅ Should NOT crash or show errors
- ✅ Should NOT show only ID (unless no other fields available)

**Steps**:
1. Select legacy connection
2. Switch to Kanban view
3. Verify fallback behavior works
4. Check browser console for errors (should be none)

**Result**: ⏳ Pending manual verification

---

#### Test 7.3.2: Field with visible: false and showInCard: true
**Expected Behavior**:
- ✅ Field should NOT be displayed (visible takes precedence)
- ✅ No errors in console

**Steps**:
1. In Admin panel, configure a field with:
   - visible: false
   - showInCard: true
2. Switch to Kanban view
3. Verify field is NOT displayed

**Result**: ⏳ Pending manual verification

---

#### Test 7.3.3: Empty Field Values
**Expected Behavior**:
- ✅ Fields with null, undefined, or empty string should be skipped
- ✅ Fields with false (boolean) should be displayed as "Não"
- ✅ Fields with 0 (number) should be displayed as "0"

**Steps**:
1. Find or create records with empty values
2. Verify empty fields are not displayed
3. Find records with false and 0 values
4. Verify they ARE displayed

**Result**: ⏳ Pending manual verification

---

#### Test 7.3.4: Very Long Field Values
**Expected Behavior**:
- ✅ Long text should be truncated with `line-clamp-3`
- ✅ Text should wrap properly with `break-words`
- ✅ No horizontal overflow

**Steps**:
1. Find or create record with very long text field
2. Verify text is limited to 3 lines
3. Verify no horizontal scrolling in card

**Result**: ⏳ Pending manual verification

---

### 7.4 Test Backward Compatibility

#### Test 7.4.1: Legacy Connection Without showInCard
**Connection**: #1 (MasterMegga)
**Expected Behavior**:
- ✅ Should work without errors
- ✅ Should show fallback fields (first 3 visible non-technical)
- ✅ No console errors
- ✅ No crashes

**Steps**:
1. Select connection #1
2. Switch to Kanban view
3. Verify cards display correctly
4. Check browser console (should be clean)
5. Try drag-and-drop (should work)

**Result**: ⏳ Pending manual verification

---

#### Test 7.4.2: Connection with Malformed fieldMappings
**Expected Behavior**:
- ✅ Should handle gracefully
- ✅ Should show ID fallback if no valid fields
- ✅ No crashes or errors

**Steps**:
1. If possible, create connection with invalid fieldMappings
2. Switch to Kanban view
3. Verify graceful degradation
4. Check console for errors

**Result**: ⏳ Pending manual verification

---

## Test Results Summary

| Test Case | Status | Notes |
|-----------|--------|-------|
| 7.1.1 - showInCard Configuration | ⏳ Pending | |
| 7.1.2 - Fallback Behavior | ⏳ Pending | |
| 7.1.3 - Field Value Formatting | ⏳ Pending | |
| 7.2.1 - Grid View Consistency | ⏳ Pending | |
| 7.2.2 - List View Consistency | ⏳ Pending | |
| 7.2.3 - View Switching | ⏳ Pending | |
| 7.3.1 - No showInCard Fields | ⏳ Pending | |
| 7.3.2 - visible: false Override | ⏳ Pending | |
| 7.3.3 - Empty Values | ⏳ Pending | |
| 7.3.4 - Long Values | ⏳ Pending | |
| 7.4.1 - Legacy Connection | ⏳ Pending | |
| 7.4.2 - Malformed Data | ⏳ Pending | |

## Browser Console Checks

During all tests, monitor browser console for:
- ❌ No errors should appear
- ❌ No warnings related to our changes
- ✅ Only expected logs (if any)

## Performance Checks

- ✅ Cards should render quickly
- ✅ View switching should be smooth
- ✅ No lag when scrolling through cards
- ✅ Drag-and-drop should be responsive

## Accessibility Checks

- ✅ Drag handle should have proper aria-label
- ✅ Cards should be keyboard accessible
- ✅ Screen readers should announce field labels

## Next Steps

After completing manual tests:
1. Update test results in this document
2. Document any issues found
3. Create bug reports for failures
4. Mark task 7 as complete if all tests pass
