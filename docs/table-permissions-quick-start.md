# Table Permissions - Quick Start Guide

## Overview

The Table Permissions system allows administrators to grant granular access control to database tables for different users. Users can then perform CRUD operations on tables based on their assigned permissions.

## Quick Setup

### 1. Grant Permissions (Admin)

As an administrator, grant a user access to a table:

```javascript
// Using the admin UI
1. Navigate to Admin Dashboard > Permissões de Tabela
2. Click "Nova Permissão"
3. Select user and table
4. Check desired permissions (Read, Write, Delete)
5. Click "Criar"
```

Or via API:

```bash
curl -X POST http://localhost:3001/api/admin/table-permissions \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_token_123",
    "table_name": "customers",
    "can_read": true,
    "can_write": true,
    "can_delete": false
  }'
```

### 2. Access Tables (User)

Users can access their permitted tables through:

**Web UI:**
1. Navigate to User Dashboard > Minhas Tabelas
2. Click on a table to view/edit data
3. Use the interface to create, edit, or delete records

**API:**
```bash
# List records
curl -X GET "http://localhost:3001/api/tables/customers?page=1&limit=10" \
  -H "Authorization: Bearer USER_TOKEN"

# Create record
curl -X POST http://localhost:3001/api/tables/customers \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'
```

## Permission Types

| Permission | Allows |
|-----------|--------|
| **Read** | View table data, query records |
| **Write** | Create new records, update existing records |
| **Delete** | Delete records from the table |

## Common Use Cases

### Use Case 1: Read-Only Access

Grant a user view-only access to a table:

```json
{
  "user_id": "analyst_token",
  "table_name": "sales_data",
  "can_read": true,
  "can_write": false,
  "can_delete": false
}
```

### Use Case 2: Full Access

Grant a user complete control over a table:

```json
{
  "user_id": "manager_token",
  "table_name": "employees",
  "can_read": true,
  "can_write": true,
  "can_delete": true
}
```

### Use Case 3: Data Entry Only

Allow a user to add and edit records but not delete:

```json
{
  "user_id": "clerk_token",
  "table_name": "orders",
  "can_read": true,
  "can_write": true,
  "can_delete": false
}
```

## Features

### Pagination

Query large datasets efficiently:

```
GET /api/tables/customers?page=2&limit=50
```

### Filtering

Filter records by column values:

```
GET /api/tables/customers?filter_email=@gmail.com&filter_status=active
```

### Sorting

Sort results by any column:

```
GET /api/tables/customers?sortBy=created_at&sortOrder=DESC
```

### Combined Query

Use all features together:

```
GET /api/tables/customers?page=1&limit=25&sortBy=name&sortOrder=ASC&filter_status=active
```

## Security Features

✅ **Permission Validation** - Every request validates user permissions
✅ **SQL Injection Protection** - All inputs are validated and sanitized
✅ **Rate Limiting** - Prevents abuse with configurable limits
✅ **System Table Protection** - System tables are automatically excluded
✅ **Audit Logging** - All permission checks are logged

## Rate Limits

| Operation | Limit |
|-----------|-------|
| Read operations | 100 requests/minute |
| Write operations | 50 requests/minute |
| Delete operations | 20 requests/minute |
| Admin operations | 200 requests/minute |

## Troubleshooting

### Permission Denied Error

**Problem:** User receives 403 Forbidden error

**Solution:**
1. Verify the user has the required permission (read/write/delete)
2. Check that the permission exists for the specific table
3. Ensure the user token is correct

### Table Not Found Error

**Problem:** User receives 404 Not Found error

**Solution:**
1. Verify the table name is spelled correctly
2. Check that the table exists in the database
3. Ensure the table is not a system table

### Rate Limit Exceeded

**Problem:** User receives 429 Too Many Requests error

**Solution:**
1. Wait for the rate limit window to reset (1 minute)
2. Implement request throttling in your application
3. Contact admin to adjust rate limits if needed

## Best Practices

1. **Principle of Least Privilege**: Grant only the minimum permissions needed
2. **Regular Audits**: Review permissions periodically
3. **Use Pagination**: Always paginate large result sets
4. **Validate Input**: Validate data on the client side before submission
5. **Handle Errors**: Implement proper error handling in your application
6. **Monitor Usage**: Track API usage to identify issues early

## Support

For detailed API documentation, see [table-permissions-api.md](./table-permissions-api.md)

For issues or questions, contact your system administrator.
