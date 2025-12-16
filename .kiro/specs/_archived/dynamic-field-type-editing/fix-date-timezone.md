# Fix: Date Timezone Issue

## Problem

When users select a date (e.g., 20/11/2025), the system was saving it as one day earlier (19/11/2025). This is a classic timezone conversion issue.

### User Experience

1. User selects "20/11/2025" in date picker
2. User clicks "Salvar Alterações"
3. Success message appears
4. BUT: Date is saved as "19/11/2025" in database
5. When user reloads, sees "19/11/2025" instead of "20/11/2025"

## Root Cause

### Issue 1: Parsing Date from Server

When receiving a date from NocoDB as `"2025-11-20"`:

```typescript
// ❌ BEFORE: Interprets as UTC midnight
new Date("2025-11-20")
// In Brazil (UTC-3), this becomes:
// 2025-11-19 21:00:00 (previous day!)
```

JavaScript's `new Date()` with ISO date string interprets it as UTC. When converted to local timezone (Brazil UTC-3), it shifts to the previous day at 21:00.

### Issue 2: Sending Date to Server

When sending a Date object to NocoDB:

```typescript
// ❌ BEFORE: Sends with timezone info
const date = new Date(2025, 10, 20); // Nov 20, 2025 local time
date.toISOString(); // "2025-11-19T03:00:00.000Z" (UTC)
// NocoDB receives and stores as 2025-11-19
```

The `toISOString()` method converts to UTC, which shifts the date back.

## Solution

### Fix 1: Parse Date as Local Date

Modified `TypeAwareFieldInput.tsx` to parse DATE fields as local dates:

```typescript
// ✅ AFTER: Parse as local date
case FieldType.DATE:
  if (val instanceof Date) return val;
  if (!val) return null;
  // Parse date string as local date (YYYY-MM-DD)
  if (typeof val === 'string') {
    const [year, month, day] = val.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day); // Local date, no timezone
  }
  return new Date(val);
```

This creates a Date object in the **local timezone** without any UTC conversion.

### Fix 2: Send Date in YYYY-MM-DD Format

Modified `DirectEditPage.tsx` to format DATE fields correctly:

```typescript
// ✅ AFTER: Format as YYYY-MM-DD (no timezone)
if (column && column.uidt === 'Date' && currentValue instanceof Date) {
  const year = currentValue.getFullYear();
  const month = String(currentValue.getMonth() + 1).padStart(2, '0');
  const day = String(currentValue.getDate()).padStart(2, '0');
  transformedValue = `${year}-${month}-${day}`;
}
```

This sends the date as a simple string `"2025-11-20"` without any timezone information.

## How It Works Now

### Receiving Date from Server

```
Server: "2025-11-20"
  ↓
Parse as local: new Date(2025, 10, 20)
  ↓
Display: "20/11/2025" ✅
```

### Sending Date to Server

```
User selects: 20/11/2025
  ↓
Date object: new Date(2025, 10, 20)
  ↓
Format: "2025-11-20"
  ↓
Server stores: "2025-11-20" ✅
```

## DateTime vs Date

**Important distinction**:

- **DATE fields**: Only date, no time, no timezone
  - Format: `YYYY-MM-DD`
  - Example: `"2025-11-20"`
  
- **DATETIME fields**: Date + time with timezone
  - Format: ISO 8601 with timezone
  - Example: `"2025-11-20T14:30:00.000Z"`

The fix only affects DATE fields. DATETIME fields continue to use `toISOString()` because they need timezone information.

## Testing

### Test Case 1: Save Date

1. Select date: 20/11/2025
2. Save
3. Reload page
4. **Expected**: Shows 20/11/2025 ✅
5. **Before**: Showed 19/11/2025 ❌

### Test Case 2: Edit Date

1. Current date: 15/11/2025
2. Change to: 20/11/2025
3. Save
4. Reload
5. **Expected**: Shows 20/11/2025 ✅

### Test Case 3: Timezone Edge Cases

Test with dates that cross timezone boundaries:

- **Midnight**: 00:00 local time
- **End of day**: 23:59 local time
- **DST transitions**: If applicable

All should maintain the selected date without shifting.

## Files Modified

1. **`src/components/user/TypeAwareFieldInput.tsx`**
   - Modified `parseValue()` to handle DATE fields specially
   - Parse as local date without timezone conversion

2. **`src/components/user/DirectEditPage.tsx`**
   - Added date formatting before sending to server
   - Format DATE as `YYYY-MM-DD`
   - Format DATETIME as ISO string (unchanged)

## Related Issues

This is a common issue in web applications dealing with dates:

- **Moment.js**: Had similar issues, deprecated partly for this reason
- **date-fns**: Handles local dates better but still requires care
- **Temporal API**: Future JavaScript API will handle this better

## Best Practices

### For DATE Fields (No Time)

```typescript
// ✅ DO: Parse as local date
const [y, m, d] = dateString.split('-').map(Number);
const date = new Date(y, m - 1, d);

// ✅ DO: Format without timezone
const formatted = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// ❌ DON'T: Use toISOString() for dates
date.toISOString(); // Converts to UTC!

// ❌ DON'T: Parse with new Date(string)
new Date("2025-11-20"); // Interprets as UTC!
```

### For DATETIME Fields (With Time)

```typescript
// ✅ DO: Use toISOString() for datetime
const datetime = new Date();
datetime.toISOString(); // "2025-11-20T14:30:00.000Z"

// ✅ DO: Parse with new Date(string)
new Date("2025-11-20T14:30:00.000Z"); // Correct with timezone
```

## Lessons Learned

1. **Never use `new Date(string)` for date-only values** - Always parse components
2. **Never use `toISOString()` for date-only values** - Always format manually
3. **Distinguish between DATE and DATETIME** - Different handling required
4. **Test across timezones** - Especially UTC-negative timezones like Brazil
5. **Document timezone handling** - Critical for maintenance

## Future Improvements

Consider using a date library that handles this better:

- **date-fns**: Good for formatting and parsing
- **Temporal API**: When available in browsers
- **Luxon**: Good timezone support

Or create utility functions:

```typescript
// utils/dateUtils.ts
export function parseLocalDate(dateString: string): Date {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

---

**Related**: Dynamic Field Type Editing feature  
**Impact**: Critical - Affects all date fields  
**Version**: Fixed in v1.3.3
