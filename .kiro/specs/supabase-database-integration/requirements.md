# Requirements Document

## Introduction

This feature adds native Supabase integration to the Database Navigation system, allowing administrators to connect to Supabase projects and enable users to navigate, view, and edit data from Supabase tables. The integration leverages the existing database connection architecture while adding Supabase-specific capabilities like real-time subscriptions, RLS awareness, and native authentication.

## Glossary

- **Database_Navigation_System**: The existing system that allows users to connect to external databases (NocoDB, PostgreSQL, MySQL, API) and navigate their data through a unified interface
- **Supabase_Connection**: A new connection type that connects to a Supabase project using the Supabase URL and service role key or anon key
- **Field_Mapping**: Configuration that defines which columns are visible, editable, and how they are labeled in the UI
- **User_Link_Field**: A column in the external database that links records to specific users in the system
- **View_Configuration**: Settings for calendar, kanban, and edit theme views
- **RLS_Policy**: Row Level Security policies in Supabase that control data access at the database level
- **Service_Role_Key**: A Supabase key with elevated privileges that bypasses RLS (used for admin operations)
- **Anon_Key**: A Supabase key with limited privileges that respects RLS policies

## Requirements

### Requirement 1: Supabase Connection Type

**User Story:** As an administrator, I want to add Supabase as a database connection type, so that I can connect to Supabase projects and allow users to navigate their data.

#### Acceptance Criteria

1. WHEN an administrator selects "Supabase" as the connection type, THE Database_Connection_Form SHALL display Supabase-specific configuration fields (Project URL, API Key type selector, API Key)
2. WHEN the administrator enters a valid Supabase URL and API key, THE System SHALL validate the connection by attempting to list tables from the project
3. WHEN the connection is validated successfully, THE System SHALL display a list of available tables for selection
4. WHEN the administrator selects a table, THE System SHALL automatically fetch and display the table's column metadata
5. IF the Supabase URL or API key is invalid, THEN THE System SHALL display a descriptive error message indicating the specific issue
6. THE System SHALL support both service_role keys (for admin bypass of RLS) and anon keys (for RLS-respecting access)

### Requirement 2: Supabase Table Discovery

**User Story:** As an administrator, I want to browse available tables in a Supabase project, so that I can select which table to expose to users.

#### Acceptance Criteria

1. WHEN the administrator provides valid Supabase credentials, THE System SHALL fetch and display all tables from the public schema
2. WHEN displaying tables, THE System SHALL show table name, row count (if available), and RLS status
3. WHEN the administrator selects a table, THE System SHALL fetch column metadata including name, data type, and constraints
4. THE System SHALL cache table metadata for 10 minutes to improve performance
5. IF the table list cannot be fetched, THEN THE System SHALL display an error with troubleshooting suggestions

### Requirement 3: Supabase Column Metadata

**User Story:** As an administrator, I want to see detailed column information from Supabase tables, so that I can configure field mappings accurately.

#### Acceptance Criteria

1. WHEN a table is selected, THE System SHALL display all columns with their PostgreSQL data types
2. WHEN displaying columns, THE System SHALL identify primary keys, foreign keys, and nullable columns
3. THE System SHALL map Supabase/PostgreSQL data types to appropriate UI input types (text, number, date, boolean, select, etc.)
4. WHEN a column has a foreign key constraint, THE System SHALL indicate the referenced table
5. THE System SHALL support JSONB columns with appropriate JSON editor UI

### Requirement 4: Supabase Data Operations

**User Story:** As a user, I want to view, create, update, and delete records in Supabase tables, so that I can manage my data through the platform.

#### Acceptance Criteria

1. WHEN a user accesses a Supabase connection, THE System SHALL fetch records respecting the user_link_field filter
2. WHEN fetching records, THE System SHALL implement pagination with configurable page size (default 25)
3. WHEN a user creates a new record, THE System SHALL insert the data into Supabase and return the created record
4. WHEN a user updates a record, THE System SHALL update only the modified fields in Supabase
5. WHEN a user deletes a record, THE System SHALL remove the record from Supabase after confirmation
6. IF a data operation fails, THEN THE System SHALL display the Supabase error message with context

### Requirement 5: Supabase Connection Testing

**User Story:** As an administrator, I want to test Supabase connections before saving, so that I can verify the configuration is correct.

#### Acceptance Criteria

1. WHEN the administrator clicks "Test Connection", THE System SHALL attempt to connect to Supabase and verify access
2. WHEN testing, THE System SHALL verify the API key has sufficient permissions for the selected table
3. WHEN the test succeeds, THE System SHALL display a success message with connection details
4. IF the test fails, THEN THE System SHALL display a detailed error message with the failure reason
5. THE System SHALL update the connection status to 'connected', 'disconnected', or 'error' based on test results

### Requirement 6: Supabase Service Integration

**User Story:** As a developer, I want a dedicated Supabase service module, so that all Supabase operations are centralized and maintainable.

#### Acceptance Criteria

1. THE Backend SHALL provide a SupabaseConnectionService module for all Supabase-specific operations
2. THE Service SHALL use the existing SupabaseService for database operations when connecting to the platform's own Supabase
3. THE Service SHALL create isolated Supabase clients for external Supabase connections
4. THE Service SHALL handle connection pooling and client lifecycle management
5. THE Service SHALL log all operations with appropriate context for debugging

### Requirement 7: Frontend Supabase Configuration UI

**User Story:** As an administrator, I want an intuitive UI for configuring Supabase connections, so that I can easily set up integrations.

#### Acceptance Criteria

1. WHEN "Supabase" type is selected, THE Form SHALL display a dedicated configuration section
2. THE Form SHALL provide a dropdown to select API key type (service_role or anon)
3. THE Form SHALL validate the Supabase URL format before attempting connection
4. WHEN credentials are entered, THE Form SHALL enable a "Load Tables" button to fetch available tables
5. THE Form SHALL display loading states during async operations
6. THE Form SHALL preserve existing field mappings when editing a connection

### Requirement 8: Data Type Mapping

**User Story:** As a user, I want appropriate input controls for different Supabase column types, so that I can enter data correctly.

#### Acceptance Criteria

1. THE System SHALL map PostgreSQL 'text', 'varchar', 'char' types to text input
2. THE System SHALL map PostgreSQL 'integer', 'bigint', 'smallint', 'numeric', 'decimal' types to number input
3. THE System SHALL map PostgreSQL 'boolean' type to checkbox/toggle input
4. THE System SHALL map PostgreSQL 'date' type to date picker input
5. THE System SHALL map PostgreSQL 'timestamp', 'timestamptz' types to datetime picker input
6. THE System SHALL map PostgreSQL 'jsonb', 'json' types to JSON editor input
7. THE System SHALL map PostgreSQL 'uuid' type to read-only text display (auto-generated)
8. WHEN a column has enum constraints, THE System SHALL display a select dropdown with valid options

### Requirement 9: Error Handling and Resilience

**User Story:** As a user, I want clear error messages when Supabase operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. WHEN a Supabase API call fails, THE System SHALL capture the error code and message
2. THE System SHALL translate common Supabase error codes to user-friendly messages
3. IF a connection times out, THEN THE System SHALL retry once before displaying an error
4. THE System SHALL implement circuit breaker pattern for repeated failures
5. THE System SHALL log all errors with full context for debugging

### Requirement 10: Security and Credential Management

**User Story:** As an administrator, I want Supabase credentials to be stored securely, so that API keys are protected.

#### Acceptance Criteria

1. THE System SHALL store Supabase API keys encrypted in the database
2. THE System SHALL never expose full API keys in API responses (mask all but last 4 characters)
3. THE System SHALL validate that service_role keys are only used for admin operations
4. WHEN displaying connection details, THE System SHALL mask sensitive credentials
5. THE System SHALL log credential access for security auditing (without logging actual values)
