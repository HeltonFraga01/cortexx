# GenericTableView Component

## Overview

The `GenericTableView` component provides a complete UI for viewing and managing data in any database table with permission-based access control.

## Features

- **Responsive Design**: Table view for desktop, card view for mobile
- **Pagination**: Configurable page size (10, 25, 50, 100 records)
- **Search**: Filter records across text columns
- **Sorting**: Click column headers to sort ascending/descending
- **CRUD Operations**: Create, read, update, delete based on permissions
- **Permission Handling**: Gracefully handles permission denied errors
- **Loading States**: Shows loading indicators during operations
- **Confirmation Dialogs**: Confirms destructive actions (delete)

## Usage

```tsx
import { GenericTableView } from '@/components/user/GenericTableView';

function MyPage() {
  const userToken = localStorage.getItem('userToken');
  
  return (
    <GenericTableView 
      tableName="customers" 
      userToken={userToken} 
    />
  );
}
```

## Props

- `tableName` (string): Name of the table to display
- `userToken` (string): User authentication token

## Related Components

- `GenericTablePage`: Wrapper with routing and back button
- `UserTablesList`: Lists all accessible tables

## Permissions

The component adapts based on user permissions:
- **Read**: View table data
- **Write**: Create and edit records
- **Delete**: Delete records

## Services Used

- `genericTableService`: CRUD operations
- `tablePermissionsService`: Schema and permissions
