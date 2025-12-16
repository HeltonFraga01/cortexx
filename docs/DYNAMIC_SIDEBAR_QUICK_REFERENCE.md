# Dynamic Sidebar Navigation - Quick Reference

## Quick Links

- [Technical Documentation](./DYNAMIC_SIDEBAR_NAVIGATION_TECHNICAL.md) - Complete technical details
- [Architecture](./DYNAMIC_SIDEBAR_ARCHITECTURE.md) - System architecture and design
- [User Guide](./USER_DATABASE_NAVIGATION_GUIDE.md) - End-user documentation
- [API Reference](./api/openapi.yaml) - OpenAPI specification

## API Endpoints

### Get User Connections
```bash
GET /api/user/database-connections
Authorization: Bearer {userToken}
```

### Get User Record
```bash
GET /api/user/database-connections/:id/record
Authorization: Bearer {userToken}
```

### Update User Record
```bash
PUT /api/user/database-connections/:id/data/:recordId
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "fieldName": "newValue"
}
```

## Key Components

### Frontend

**DynamicDatabaseItems**
- Location: `src/components/user/DynamicDatabaseItems.tsx`
- Purpose: Renders dynamic sidebar menu items
- Usage: Automatically included in UserLayout

**DirectEditPage**
- Location: `src/pages/user/DirectEditPage.tsx`
- Route: `/database/:connectionId/edit/:recordId`
- Purpose: Edit user's database record

**ConnectionCache**
- Location: `src/services/cache/connectionCache.ts`
- Purpose: Client-side caching with TTL
- TTL: 5 min (connections), 2 min (records)

### Backend

**UserRecordService**
- Location: `server/services/UserRecordService.js`
- Purpose: Fetch user records from various databases
- Methods: `fetchNocoDBRecord()`, `fetchSQLiteRecord()`, `fetchSQLRecord()`

## Common Tasks

### Add New Database Type Support

1. Add type to `DatabaseConnection` interface
2. Implement fetch method in `UserRecordService`
3. Add case in endpoint handler
4. Update tests

### Modify Cache TTL

```typescript
// src/services/cache/connectionCache.ts
const CACHE_TTL = {
  CONNECTIONS: 5 * 60 * 1000,  // Change here
  RECORD: 2 * 60 * 1000,        // Change here
};
```

### Add New Field to Record Form

1. Update `field_mappings` in database connection
2. Form automatically renders based on mappings
3. No code changes needed!

### Debug Cache Issues

```typescript
// Check cache contents
console.log('Cache keys:', Array.from(connectionCache.keys()));

// Force invalidation
connectionCache.clear();

// Disable cache temporarily
const cached = null; // Skip cache.get()
```

### Test API Endpoints

```bash
# Get connections
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/user/database-connections

# Get record
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/user/database-connections/1/record

# Update record
curl -X PUT \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"field":"value"}' \
  http://localhost:3001/api/user/database-connections/1/data/1
```

## Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| `CONNECTION_NOT_FOUND` | Connection doesn't exist | Check connection ID |
| `RECORD_NOT_FOUND` | No record for user | Create record in database |
| `UNAUTHORIZED` | Invalid token | Re-authenticate |
| `FORBIDDEN` | No access to connection | Check assignedUsers array |
| `VALIDATION_ERROR` | Invalid data | Check field requirements |

## Performance Tips

1. **Use caching**: Don't bypass cache unless necessary
2. **Debounce clicks**: Prevent rapid API calls
3. **Lazy load**: Use React.lazy for heavy components
4. **Optimize queries**: Add indexes on user_link_field
5. **Compress responses**: Enable gzip compression

## Security Checklist

- [ ] Always validate user token
- [ ] Check assignedUsers before returning data
- [ ] Use parameterized queries (never string concatenation)
- [ ] Sanitize user inputs
- [ ] Implement rate limiting
- [ ] Log security events
- [ ] Use HTTPS in production

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- DynamicDatabaseItems.test.tsx

# Run with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run backend tests
cd server && npm test
```

## Deployment Checklist

- [ ] Run all tests
- [ ] Update environment variables
- [ ] Build production bundle
- [ ] Test in staging environment
- [ ] Backup database
- [ ] Deploy to production
- [ ] Verify health checks
- [ ] Monitor logs for errors
- [ ] Test with real users

## Troubleshooting Quick Fixes

**Connections not showing**
```bash
# Check database
sqlite3 server/wuzapi.db "SELECT * FROM database_connections;"

# Check API
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/api/user/database-connections

# Clear cache
# In browser console:
localStorage.clear();
location.reload();
```

**Record not found**
```bash
# Check if record exists
sqlite3 server/wuzapi.db "SELECT * FROM table_name WHERE apiToken = 'TOKEN';"

# Check user_link_field
sqlite3 server/wuzapi.db "SELECT user_link_field FROM database_connections WHERE id = 1;"
```

**Slow performance**
```bash
# Check cache hit rate
# Add logging in connectionCache.get()

# Check database query time
# Add timing logs in UserRecordService

# Check network latency
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/user/database-connections
```

## Useful SQL Queries

```sql
-- Find connections for a user
SELECT * FROM database_connections 
WHERE assignedUsers LIKE '%userToken%';

-- Find user's record
SELECT * FROM table_name 
WHERE apiToken = 'userToken';

-- Check connection configuration
SELECT id, name, type, user_link_field, field_mappings 
FROM database_connections 
WHERE id = 1;

-- List all connections
SELECT id, name, type, status, assignedUsers 
FROM database_connections;
```

## Environment Variables

```bash
# Backend
PORT=3001
NODE_ENV=production
WUZAPI_BASE_URL=https://api.wuzapi.com
SQLITE_DB_PATH=./server/wuzapi.db
LOG_LEVEL=info

# Frontend
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_ADMIN_TOKEN=your_admin_token
```

## Monitoring Queries

```bash
# Check server health
curl http://localhost:3001/health

# Check logs
tail -f server/logs/app-$(date +%Y-%m-%d).log

# Check error logs
tail -f server/logs/error-$(date +%Y-%m-%d).log | grep "ERROR"

# Monitor API calls
tail -f server/logs/access-$(date +%Y-%m-%d).log | grep "/api/user/database-connections"
```

## Code Snippets

### Add Custom Field Validation

```typescript
// In RecordForm.tsx
const validateField = (field: string, value: any): string | null => {
  if (field === 'email' && !value.includes('@')) {
    return 'Invalid email format';
  }
  if (field === 'phone' && !/^\d{10}$/.test(value)) {
    return 'Phone must be 10 digits';
  }
  return null;
};
```

### Add Custom Error Handler

```typescript
// In DirectEditPage.tsx
const handleError = (error: any) => {
  if (error.code === 'RECORD_NOT_FOUND') {
    toast.error('Record not found. Contact admin.');
  } else if (error.code === 'FORBIDDEN') {
    toast.error('Access denied.');
    navigate('/dashboard');
  } else {
    toast.error('An error occurred. Please try again.');
  }
};
```

### Add Performance Logging

```typescript
// In DynamicDatabaseItems.tsx
const fetchConnections = async () => {
  const startTime = performance.now();
  try {
    const data = await service.getUserConnections(userToken);
    const duration = performance.now() - startTime;
    console.log(`Fetch took ${duration}ms`);
    if (duration > 1000) {
      logger.warn('Slow fetch detected', { duration });
    }
  } catch (error) {
    // handle error
  }
};
```

## Resources

- [React Documentation](https://react.dev/)
- [Express.js Guide](https://expressjs.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)
- [Cypress Documentation](https://docs.cypress.io/)

---

**Last Updated**: November 7, 2025  
**Version**: 1.0.0
