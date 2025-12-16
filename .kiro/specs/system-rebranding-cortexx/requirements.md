# Requirements Document

## Introduction

This document specifies the requirements for rebranding the system from "wuzapi-manager" to "cortexx". The rebranding involves updating all references to the old name across configuration files, Docker configurations, documentation, and any code references while maintaining full system functionality.

## Glossary

- **Cortexx**: The new brand name for the system, replacing "wuzapi-manager"
- **WUZAPI Manager**: The current/legacy name of the system being replaced
- **Docker Swarm**: Container orchestration platform used for deployment
- **Traefik**: Reverse proxy and load balancer used for routing

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want all Docker configuration files to use the new "cortexx" branding, so that the deployment infrastructure reflects the new system identity.

#### Acceptance Criteria

1. WHEN the docker-compose-swarm.yaml file is processed THEN the system SHALL use "cortexx" as the service name instead of "wuzapi-manager"
2. WHEN Docker volumes are referenced THEN the system SHALL use "cortexx-data" and "cortexx-logs" as volume names
3. WHEN Traefik labels are configured THEN the system SHALL use "cortexx" in all router and service names
4. WHEN the Docker image is referenced THEN the system SHALL use "heltonfraga/cortexx" as the image name
5. WHEN the SQLite database path is configured THEN the system SHALL use "cortexx.db" as the database filename

### Requirement 2

**User Story:** As a system administrator, I want all local development Docker configurations to use the new branding, so that development environments are consistent with production.

#### Acceptance Criteria

1. WHEN docker-compose.yml is used for development THEN the system SHALL use "cortexx-dev" as the container name
2. WHEN docker-compose.local.yml is used for local testing THEN the system SHALL use "cortexx-local" as the container name
3. WHEN service names are defined in compose files THEN the system SHALL use "cortexx" prefix consistently

### Requirement 3

**User Story:** As a developer, I want all documentation to reflect the new "cortexx" branding, so that documentation is accurate and consistent.

#### Acceptance Criteria

1. WHEN documentation references Docker commands THEN the system SHALL use "cortexx" in service and container names
2. WHEN documentation references image names THEN the system SHALL use "heltonfraga/cortexx" as the image reference
3. WHEN CHANGELOG references repository URLs THEN the system SHALL maintain accurate version comparison links

### Requirement 4

**User Story:** As a DevOps engineer, I want GitHub Actions workflows to build and push images with the new branding, so that CI/CD pipelines produce correctly named artifacts.

#### Acceptance Criteria

1. WHEN the docker-multiarch workflow runs THEN the system SHALL build images with "cortexx" as the IMAGE_NAME
2. WHEN images are pushed to Docker Hub THEN the system SHALL use "heltonfraga/cortexx" as the repository name

### Requirement 5

**User Story:** As a system administrator, I want troubleshooting and quick reference documentation to use the new branding, so that operational procedures are accurate.

#### Acceptance Criteria

1. WHEN troubleshooting commands are documented THEN the system SHALL reference "cortexx" service names
2. WHEN diagnostic scripts reference containers THEN the system SHALL use "cortexx" in container name filters
3. WHEN health check commands are documented THEN the system SHALL use "cortexx" service references
