# Implementation Plan

- [x] 1. Create SQLite database layer
  - Implement new SQLite database class replacing PostgreSQL implementation
  - Create SQLite-compatible schema with proper data type mappings
  - Implement connection management and query execution methods
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 1.1 Refactor database.js for SQLite compatibility
  - Replace pg driver imports with sqlite3
  - Update constructor to use file-based connection instead of connection pool
  - Modify query method to work with SQLite prepared statements
  - _Requirements: 1.1, 1.2_

- [x] 1.2 Convert PostgreSQL schema to SQLite format
  - Transform SERIAL PRIMARY KEY to INTEGER PRIMARY KEY AUTOINCREMENT
  - Convert JSONB columns to TEXT with JSON string handling
  - Update TIMESTAMPTZ to DATETIME with proper default values
  - Replace PostgreSQL-specific CHECK constraints with SQLite equivalents
  - _Requirements: 1.4, 6.2_

- [x] 1.3 Implement JSON data handling for SQLite
  - Add JSON.stringify for storing complex data in TEXT columns
  - Add JSON.parse for retrieving and parsing stored JSON data
  - Update all methods that handle assigned_users and field_mappings
  - _Requirements: 1.4, 6.2_

- [x] 1.4 Update database initialization and table creation
  - Modify initTables method to use SQLite-compatible SQL
  - Remove PostgreSQL retry logic and replace with SQLite file access checks
  - Update insertDefaultData method for SQLite syntax
  - _Requirements: 1.1, 1.4_

- [x] 1.5 Write unit tests for SQLite database layer
  - Create tests for database connection and initialization
  - Test CRUD operations with SQLite
  - Verify JSON data serialization/deserialization
  - Test error handling for SQLite-specific errors
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create data migration utilities
  - Build PostgreSQL data export utility to extract existing data
  - Implement data transformation logic for PostgreSQL to SQLite conversion
  - Create SQLite data import utility with validation
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 2.1 Implement PostgreSQL data export script
  - Create script to connect to existing PostgreSQL database
  - Export all database_connections table data to JSON format
  - Include data validation and integrity checks during export
  - _Requirements: 6.1, 6.4_

- [x] 2.2 Build data transformation utility
  - Transform PostgreSQL data types to SQLite-compatible formats
  - Convert JSONB data to JSON strings for SQLite TEXT storage
  - Handle timestamp format conversion from PostgreSQL to SQLite
  - _Requirements: 6.2, 6.3_

- [x] 2.3 Create SQLite data import script
  - Implement script to create new SQLite database with proper schema
  - Import transformed data into SQLite database
  - Verify data integrity after import with validation queries
  - _Requirements: 6.3, 6.5_

- [x] 2.4 Write migration validation tests
  - Test data export functionality with sample data
  - Verify data transformation accuracy
  - Test complete migration process end-to-end
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 3. Update application configuration and environment
  - Remove PostgreSQL environment variables and dependencies
  - Add SQLite configuration variables
  - Update package.json to remove pg dependency and ensure sqlite3 is included
  - _Requirements: 1.1, 1.2, 4.4_

- [x] 3.1 Clean up PostgreSQL dependencies
  - Remove pg package from server/package.json dependencies
  - Remove PostgreSQL environment variables from .env files
  - Update any remaining PostgreSQL-specific configuration
  - _Requirements: 1.1, 1.2_

- [x] 3.2 Add SQLite configuration
  - Add SQLITE_DB_PATH environment variable configuration
  - Set default SQLite database path to /app/data/wuzapi.db
  - Add SQLite-specific configuration options (WAL mode, timeout)
  - _Requirements: 4.4, 2.3_

- [x] 3.3 Update application startup and database initialization
  - Modify server startup to use SQLite database path from environment
  - Ensure database directory creation if it doesn't exist
  - Update error handling for SQLite file access issues
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 4. Update Docker Swarm configuration
  - Remove PostgreSQL service from docker-swarm-stack-completa.yml
  - Add volume configuration for SQLite data persistence
  - Implement node placement constraints for manager node deployment
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 4.3_

- [x] 4.1 Remove PostgreSQL service configuration
  - Delete wuzapi-manager-db service from docker-swarm-stack-completa.yml
  - Remove PostgreSQL-related environment variables from wuzapi-manager service
  - Remove wuzapi-manager-internal network if no longer needed
  - Remove wuzapi-manager-db-data volume definition
  - _Requirements: 4.1, 1.1_

- [x] 4.2 Add SQLite volume configuration
  - Define wuzapi-data volume in volumes section
  - Mount volume to /app/data path in wuzapi-manager service
  - Configure volume driver as local for node-specific storage
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 4.3 Implement Docker Swarm placement constraints
  - Add deployment.placement.constraints to wuzapi-manager service
  - Set constraint to node.role == manager for volume persistence
  - Update service configuration to ensure single replica for SQLite
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4.4 Update service dependencies and health checks
  - Remove depends_on reference to wuzapi-manager-db
  - Update health check to verify SQLite database file accessibility
  - Modify service labels and configuration for single-container architecture
  - _Requirements: 2.1, 2.2, 4.3_

- [x] 5. Update documentation and deployment guides
  - Update README.md with new SQLite + Docker Swarm architecture section
  - Create deployment instructions for the new standardized pattern
  - Document troubleshooting steps for common SQLite and volume issues
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5.1 Add architecture documentation to README.md
  - Create "Arquitetura de Deploy" section explaining Docker Swarm + SQLite
  - Document the volume persistence strategy and node constraints
  - Explain the benefits of the new simplified architecture
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 5.2 Create deployment instructions
  - Write step-by-step deployment guide for Docker Swarm
  - Include volume creation and node constraint setup instructions
  - Document environment variable configuration for SQLite
  - _Requirements: 5.4, 5.5_

- [x] 5.3 Add troubleshooting documentation
  - Document common SQLite file permission issues and solutions
  - Add Docker volume troubleshooting steps
  - Include node constraint debugging information
  - _Requirements: 5.5_

- [x] 5.4 Create migration runbook
  - Document complete migration process from PostgreSQL to SQLite
  - Include rollback procedures in case of migration issues
  - Add data validation steps for post-migration verification
  - _Requirements: 6.1, 6.5_

- [x] 6. Integration testing and validation
  - Test complete application functionality with SQLite database
  - Validate Docker Swarm deployment with volume persistence
  - Verify data integrity and application performance
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 6.3_

- [x] 6.1 Test SQLite database operations
  - Verify all CRUD operations work correctly with SQLite
  - Test JSON data handling for complex fields
  - Validate database initialization and schema creation
  - _Requirements: 1.1, 1.4, 6.2, 6.3_

- [x] 6.2 Test Docker Swarm deployment
  - Deploy updated stack configuration to test environment
  - Verify volume persistence across container restarts
  - Test node constraint functionality and service placement
  - _Requirements: 2.1, 2.2, 3.1, 3.2_

- [x] 6.3 Validate application functionality end-to-end
  - Test all application features with SQLite backend
  - Verify API endpoints respond correctly
  - Test database connection management and error handling
  - _Requirements: 1.1, 1.2, 1.3, 4.1_

- [x] 6.4 Performance testing and optimization
  - Compare SQLite performance with previous PostgreSQL setup
  - Test concurrent access and database locking behavior
  - Monitor memory usage and optimize if necessary
  - _Requirements: 1.1, 6.3_