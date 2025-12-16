# Requirements Document

## Introduction

This document outlines the requirements for migrating the WUZApi Admin application from an external database architecture to SQLite with Docker Swarm standardization. The migration aims to eliminate connection complexity, improve stability, and establish a standardized deployment pattern for the application.

## Glossary

- **WUZApi_Admin**: The main application system that manages WhatsApp API configurations and mappings
- **SQLite_Database**: An embedded relational database that stores data in a single file
- **Docker_Swarm**: Container orchestration platform for managing distributed applications
- **Portainer**: Web-based management interface for Docker environments
- **Volume_Persistence**: Docker mechanism to maintain data across container restarts
- **Node_Constraint**: Docker Swarm placement rule that restricts service deployment to specific nodes
- **Manager_Node**: Primary node in Docker Swarm cluster responsible for orchestration
- **Database_Migration**: Process of transferring data and schema from one database system to another

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want to eliminate external database connection issues, so that the application deployment is more reliable and stable.

#### Acceptance Criteria

1. WHEN the WUZApi_Admin starts, THE SQLite_Database SHALL be accessible without network dependencies
2. THE WUZApi_Admin SHALL remove all external database drivers and dependencies
3. IF database connection fails, THEN THE WUZApi_Admin SHALL provide clear error messages indicating SQLite file access issues
4. THE SQLite_Database SHALL store all configuration data, mappings, and low-volume operational data
5. WHERE external database services exist in current deployment, THE WUZApi_Admin SHALL no longer depend on them

### Requirement 2

**User Story:** As a DevOps engineer, I want to ensure data persistence in Docker Swarm, so that application data survives container restarts and redeployments.

#### Acceptance Criteria

1. THE Docker_Swarm SHALL mount a persistent volume to store the SQLite database file
2. WHEN containers are restarted, THE SQLite_Database file SHALL remain accessible with all existing data
3. THE Volume_Persistence SHALL map the database file path from container to host filesystem
4. WHERE the database file is stored, THE path SHALL be configurable via environment variables
5. THE SQLite_Database file SHALL be located outside the container's ephemeral filesystem

### Requirement 3

**User Story:** As a system architect, I want to implement node constraints in Docker Swarm, so that the SQLite database remains accessible on the correct node.

#### Acceptance Criteria

1. THE Docker_Swarm service SHALL include placement constraints to bind to Manager_Node
2. WHEN the swarm schedules the service, THE WUZApi_Admin SHALL only run on nodes with the persistent volume
3. THE Node_Constraint SHALL prevent service migration to nodes without database access
4. WHERE multiple manager nodes exist, THE constraint SHALL specify the primary manager node
5. IF the designated node becomes unavailable, THEN THE Docker_Swarm SHALL maintain service availability according to constraint rules

### Requirement 4

**User Story:** As a developer, I want updated deployment configuration files, so that the new SQLite architecture is properly documented and deployable.

#### Acceptance Criteria

1. THE docker-stack.yml file SHALL remove all external database service definitions
2. THE docker-stack.yml file SHALL include volume definitions for SQLite persistence
3. THE docker-stack.yml file SHALL specify deployment constraints for node placement
4. WHERE database connection strings exist, THE WUZApi_Admin SHALL use SQLite file paths
5. THE deployment configuration SHALL be compatible with Portainer management interface

### Requirement 5

**User Story:** As a team member, I want comprehensive documentation of the new architecture, so that I can understand and maintain the standardized deployment pattern.

#### Acceptance Criteria

1. THE README.md file SHALL include an "Arquitetura de Deploy" section
2. THE documentation SHALL explain Docker Swarm + SQLite architecture with volume persistence
3. THE documentation SHALL specify that services run on manager nodes with node.role == manager constraint
4. WHERE deployment instructions exist, THE documentation SHALL provide step-by-step SQLite deployment guidance
5. THE documentation SHALL include troubleshooting guidance for common SQLite and Docker Swarm issues

### Requirement 6

**User Story:** As a database administrator, I want to migrate existing data safely, so that no configuration or operational data is lost during the transition.

#### Acceptance Criteria

1. WHERE existing database data exists, THE migration process SHALL preserve all records
2. THE data migration SHALL maintain referential integrity between related tables
3. WHEN migration completes, THE WUZApi_Admin SHALL verify data consistency
4. THE migration process SHALL create backup copies of existing data before conversion
5. IF migration fails, THEN THE system SHALL provide rollback capabilities to previous database state