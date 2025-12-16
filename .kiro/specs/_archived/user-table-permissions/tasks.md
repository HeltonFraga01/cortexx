# Implementation Plan

- [x] 1. Set up database schema and migrations
  - Create migration file for `table_permissions` table
  - Add indexes for performance (user_id, table_name, composite)
  - Run migration and verify table creation
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement database layer methods
  - [x] 2.1 Add permission management methods to `server/database.js`
    - Implement `createTablePermission(userId, tableName, permissions)`
    - Implement `getTablePermission(userId, tableName)`
    - Implement `getUserTablePermissions(userId)`
    - Implement `updateTablePermission(permissionId, permissions)`
    - Implement `deleteTablePermission(permissionId)`
    - Implement `getAllTablePermissions()`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Add generic table operation methods to `server/database.js`
    - Implement `getAvailableTables()` - list non-system tables
    - Implement `getTableSchema(tableName)` - get column info
    - Implement `queryTable(tableName, options)` - with pagination, filters, sorting
    - Implement `insertRecord(tableName, data)` - with validation
    - Implement `updateRecord(tableName, id, data)` - with validation
    - Implement `deleteRecord(tableName, id)`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_

- [x] 3. Create permission validation middleware
  - Create `server/middleware/permissionValidator.js`
  - Implement `validateTablePermission` middleware
  - Add token validation and userId extraction
  - Add permission lookup and operation checking
  - Add logging for permission checks and denials
  - _Requirements: 3.4, 4.4, 5.2, 7.1, 7.2, 7.4_

- [x] 4. Implement admin routes for permission management
  - [x] 4.1 Create `server/routes/adminTablePermissionsRoutes.js`
    - POST `/api/admin/table-permissions` - create permission
    - GET `/api/admin/table-permissions` - list all permissions
    - GET `/api/admin/table-permissions/:id` - get specific permission
    - PUT `/api/admin/table-permissions/:id` - update permission
    - DELETE `/api/admin/table-permissions/:id` - delete permission
    - Add admin token validation middleware
    - Add request validation
    - Add error handling with Winston logger
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 7.3_

  - [x] 4.2 Create `server/routes/adminTablesRoutes.js`
    - GET `/api/admin/tables` - list available tables
    - GET `/api/admin/tables/:tableName` - get table schema
    - Add admin token validation middleware
    - Add error handling with Winston logger
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Implement user routes for table access
  - Create `server/routes/userTableAccessRoutes.js`
  - GET `/api/tables/:tableName` - list records with pagination/filters
  - GET `/api/tables/:tableName/:id` - get specific record
  - POST `/api/tables/:tableName` - create record
  - PUT `/api/tables/:tableName/:id` - update record
  - DELETE `/api/tables/:tableName/:id` - delete record
  - Apply `validateTablePermission` middleware to all routes
  - Add SQL injection protection
  - Add input validation and sanitization
  - Add error handling with Winston logger
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 7.1, 7.2, 7.4_

- [x] 6. Add rate limiting to table API routes
  - Create rate limiters in `server/middleware/rateLimiter.js`
  - Add `tableReadRateLimiter` (100 req/min)
  - Add `tableWriteRateLimiter` (50 req/min)
  - Add `tableDeleteRateLimiter` (20 req/min)
  - Apply rate limiters to user table routes
  - Apply admin rate limiter (200 req/min) to admin routes
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 7. Register new routes in server
  - Update `server/routes/index.js` to include new routes
  - Mount admin permission routes at `/api/admin/table-permissions`
  - Mount admin tables routes at `/api/admin/tables`
  - Mount user table routes at `/api/tables`
  - Verify route ordering and middleware application
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1_

- [x] 8. Create frontend service for table permissions
  - Create `src/services/table-permissions.ts`
  - Implement `createPermission(data)` function
  - Implement `getPermissions()` function
  - Implement `getPermission(id)` function
  - Implement `updatePermission(id, data)` function
  - Implement `deletePermission(id)` function
  - Implement `getAvailableTables()` function
  - Implement `getTableSchema(tableName)` function
  - Add TypeScript interfaces for all data types
  - Add error handling and toast notifications
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3_

- [x] 9. Create frontend service for generic table operations
  - Create `src/services/generic-table.ts`
  - Implement `queryTable(tableName, options)` function
  - Implement `getRecord(tableName, id)` function
  - Implement `createRecord(tableName, data)` function
  - Implement `updateRecord(tableName, id, data)` function
  - Implement `deleteRecord(tableName, id)` function
  - Add TypeScript interfaces for query options and results
  - Add error handling and toast notifications
  - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 5.1_

- [x] 10. Create admin UI for permission management
  - [x] 10.1 Create `src/components/admin/TablePermissionsManager.tsx`
    - Display list of all configured permissions
    - Show user ID, table name, and permission flags (read/write/delete)
    - Add "Create Permission" button to open form dialog
    - Add edit and delete actions for each permission
    - Implement permission form with user selection, table selection, and permission checkboxes
    - Add form validation
    - Integrate with `table-permissions` service
    - Add loading states and error handling
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 10.2 Create `src/components/admin/AvailableTablesList.tsx`
    - Display list of available tables from database
    - Show table name, row count, and column count
    - Add "View Schema" action to show table structure
    - Add "Configure Permissions" action to open permission form
    - Integrate with `table-permissions` service
    - Add loading states and error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 11. Create user UI for table data access
  - Create `src/components/user/GenericTableView.tsx`
  - Display table data in a responsive table/card layout
  - Implement pagination controls
  - Add filter inputs for searchable columns
  - Add sorting controls for columns
  - Show create/edit/delete actions based on permissions
  - Implement dynamic form for creating/editing records
  - Add confirmation dialog for delete operations
  - Integrate with `generic-table` service
  - Add loading states and error handling
  - Handle permission denied errors gracefully
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3_

- [x] 12. Add table permissions section to admin dashboard
  - Update `src/pages/AdminDashboard.tsx`
  - Add navigation item for "Table Permissions"
  - Add route for table permissions page
  - Render `TablePermissionsManager` component
  - Add route for available tables page
  - Render `AvailableTablesList` component
  - _Requirements: 6.1_

- [x] 13. Add table access section to user dashboard
  - Update `src/pages/UserDashboard.tsx`
  - Add navigation item for "My Tables"
  - Add route for table list page
  - Create component to list user's accessible tables
  - Add route for table view page with table name parameter
  - Render `GenericTableView` component
  - _Requirements: 3.1, 4.1, 5.1_

- [x] 14. Add TypeScript types
  - Create or update `src/lib/types.ts`
  - Add `TablePermission` interface
  - Add `TableInfo` interface
  - Add `ColumnInfo` interface
  - Add `QueryOptions` interface
  - Add `QueryResult` interface
  - Add `CreatePermissionRequest` interface
  - Add `UpdatePermissionRequest` interface
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 15. Update API documentation
  - Document all new endpoints in `docs/api.md` or similar
  - Include request/response examples
  - Document error codes and responses
  - Document rate limits
  - Document authentication requirements
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 8.1_
