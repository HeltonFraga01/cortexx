# Table Permissions API Documentation

## Overview

The Table Permissions API provides endpoints for managing user access to database tables and performing CRUD operations on table data with permission-based access control.

## Authentication

All endpoints require authentication via token:
- **Admin endpoints**: Use admin token in `Authorization` header
- **User endpoints**: Use user token in `Authorization` header

```
Authorization: Bearer <token>
```

## Rate Limits

| Endpoint Type | Rate Limit |
|--------------|------------|
| Admin endpoints | 200 requests/minute |
| Table read operations | 100 requests/minute |
| Table write operations | 50 requests/minute |
| Table delete operations | 20 requests/minute |

---

## Admin Endpoints

### Permission Management

#### Create Table Permission

Creates a new permission for a user to access a specific table.

**Endpoint:** `POST /api/admin/table-permissions`

**Authentication:** Admin token required

**Request Body:**
```json
{
  "user_id": "user123",
  "table_name": "customers",
  "can_read": true,
  "can_write": true,
  "can_delete": false
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user123",
    "table_name": "customers",
    "can_read": 1,
    "can_write": 1,
    "can_delete": 0,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `401 Unauthorized` - Invalid or missing admin token
- `409 Conflict` - Permission already exists for this user/table


#### List All Permissions

Retrieves all table permissions, optionally filtered by user.

**Endpoint:** `GET /api/admin/table-permissions`

**Authentication:** Admin token required

**Query Parameters:**
- `user_id` (optional) - Filter by specific user ID

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": "user123",
      "table_name": "customers",
      "can_read": 1,
      "can_write": 1,
      "can_delete": 0,
      "created_at": "2024-01-15T10:30:00.000Z",
      "updated_at": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

#### Get Permission by ID

Retrieves a specific permission by its ID.

**Endpoint:** `GET /api/admin/table-permissions/:id`

**Authentication:** Admin token required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "user_id": "user123",
    "table_name": "customers",
    "can_read": 1,
    "can_write": 1,
    "can_delete": 0,
    "created_at": "2024-01-15T10:30:00.000Z",
    "updated_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found` - Permission not found

#### Update Permission

Updates an existing table permission.

**Endpoint:** `PUT /api/admin/table-permissions/:id`

**Authentication:** Admin token required

**Request Body:**
```json
{
  "can_read": true,
  "can_write": false,
  "can_delete": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Permission updated successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid input data
- `404 Not Found` - Permission not found

#### Delete Permission

Deletes a table permission.

**Endpoint:** `DELETE /api/admin/table-permissions/:id`

**Authentication:** Admin token required

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Permission deleted successfully"
}
```

**Error Responses:**
- `404 Not Found` - Permission not found


### Table Management

#### List Available Tables

Lists all non-system tables in the database.

**Endpoint:** `GET /api/admin/tables`

**Authentication:** Admin token required

**Response (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "table_name": "customers",
      "row_count": 150,
      "column_count": 8,
      "index_count": 2
    },
    {
      "table_name": "orders",
      "row_count": 523,
      "column_count": 12,
      "index_count": 3
    }
  ],
  "count": 2
}
```

#### Get Table Schema

Retrieves the schema (column information) for a specific table.

**Endpoint:** `GET /api/admin/tables/:tableName`

**Authentication:** Admin token required

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "table_name": "customers",
    "columns": [
      {
        "name": "id",
        "type": "INTEGER",
        "not_null": true,
        "default_value": null,
        "primary_key": true
      },
      {
        "name": "name",
        "type": "TEXT",
        "not_null": true,
        "default_value": null,
        "primary_key": false
      },
      {
        "name": "email",
        "type": "TEXT",
        "not_null": false,
        "default_value": null,
        "primary_key": false
      }
    ]
  }
}
```

**Error Responses:**
- `404 Not Found` - Table does not exist

---

## User Endpoints

### Table Data Access

All user endpoints validate permissions before allowing operations.

#### Query Table Data

Retrieves records from a table with pagination, filtering, and sorting.

**Endpoint:** `GET /api/tables/:tableName`

**Authentication:** User token required

**Permissions Required:** `can_read`

**Query Parameters:**
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 10, max: 100) - Records per page
- `sortBy` (optional) - Column name to sort by
- `sortOrder` (optional) - `ASC` or `DESC`
- `filter_<columnName>` (optional) - Filter by column value (supports LIKE)

**Example Request:**
```
GET /api/tables/customers?page=1&limit=25&sortBy=name&sortOrder=ASC&filter_email=@example.com
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com",
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 25,
      "total": 150,
      "total_pages": 6
    }
  }
}
```

**Error Responses:**
- `403 Forbidden` - User does not have read permission
- `404 Not Found` - Table does not exist


#### Get Single Record

Retrieves a specific record by ID.

**Endpoint:** `GET /api/tables/:tableName/:id`

**Authentication:** User token required

**Permissions Required:** `can_read`

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "created_at": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `403 Forbidden` - User does not have read permission
- `404 Not Found` - Record or table not found

#### Create Record

Creates a new record in the table.

**Endpoint:** `POST /api/tables/:tableName`

**Authentication:** User token required

**Permissions Required:** `can_write`

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Jane Smith",
    "email": "jane@example.com",
    "created_at": "2024-01-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid data or validation error
- `403 Forbidden` - User does not have write permission
- `404 Not Found` - Table does not exist

#### Update Record

Updates an existing record.

**Endpoint:** `PUT /api/tables/:tableName/:id`

**Authentication:** User token required

**Permissions Required:** `can_write`

**Request Body:**
```json
{
  "email": "jane.smith@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Record updated successfully"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid data or validation error
- `403 Forbidden` - User does not have write permission
- `404 Not Found` - Record or table not found

#### Delete Record

Deletes a record from the table.

**Endpoint:** `DELETE /api/tables/:tableName/:id`

**Authentication:** User token required

**Permissions Required:** `can_delete`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Record deleted successfully"
}
```

**Error Responses:**
- `403 Forbidden` - User does not have delete permission
- `404 Not Found` - Record or table not found

---

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

### Common Error Codes

| Status Code | Description |
|------------|-------------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource does not exist |
| 409 | Conflict - Resource already exists |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error - Server error |

---

## Security Considerations

### SQL Injection Protection

All table and column names are validated against a whitelist pattern:
- Must start with a letter or underscore
- Can only contain letters, numbers, and underscores
- Pattern: `^[a-zA-Z_][a-zA-Z0-9_]*$`

### System Tables Protection

The following system tables are automatically excluded from access:
- `sqlite_*` (SQLite internal tables)
- `table_permissions` (permissions table itself)
- Any table starting with `_` (internal tables)

### Input Validation

- All user inputs are validated and sanitized
- Parameterized queries are used for all database operations
- Maximum limits enforced (e.g., 100 records per page)

---

## Examples

### Example 1: Grant Read-Only Access

```bash
curl -X POST http://localhost:3001/api/admin/table-permissions \
  -H "Authorization: Bearer admin_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user123",
    "table_name": "customers",
    "can_read": true,
    "can_write": false,
    "can_delete": false
  }'
```

### Example 2: Query Table with Filters

```bash
curl -X GET "http://localhost:3001/api/tables/customers?page=1&limit=10&sortBy=name&sortOrder=ASC&filter_email=@gmail.com" \
  -H "Authorization: Bearer user_token_here"
```

### Example 3: Create New Record

```bash
curl -X POST http://localhost:3001/api/tables/customers \
  -H "Authorization: Bearer user_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "phone": "+1234567890"
  }'
```

### Example 4: Update Record

```bash
curl -X PUT http://localhost:3001/api/tables/customers/5 \
  -H "Authorization: Bearer user_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice.johnson@example.com"
  }'
```

### Example 5: Delete Record

```bash
curl -X DELETE http://localhost:3001/api/tables/customers/5 \
  -H "Authorization: Bearer user_token_here"
```

---

## Changelog

### Version 1.0.0 (2024-01-15)
- Initial release of Table Permissions API
- Admin endpoints for permission management
- User endpoints for table data access
- Rate limiting implementation
- SQL injection protection
- Permission-based access control
