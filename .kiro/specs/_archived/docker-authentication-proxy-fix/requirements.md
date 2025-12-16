# Requirements Document - Docker Authentication Proxy Fix

## Introduction

After implementing security improvements with a proxy for token authentication, the WUZAPI Manager application fails to authenticate when running in Docker. The issue appears to be related to how the authentication proxy is handling token validation and session management. This spec addresses the diagnosis and resolution of authentication failures in Docker environments while maintaining the security improvements.

## Glossary

- **WUZAPI**: External WhatsApp Business API service (https://wzapi.wasend.com.br)
- **Proxy**: Security layer that intercepts and validates authentication tokens before forwarding requests
- **Token**: Authentication credential (admin token or user token) used to validate requests
- **Session**: Server-side session object that stores authenticated user information
- **Docker**: Containerization platform used for deployment
- **Docker Swarm**: Single-node Docker deployment configuration
- **SQLite**: Local database used for storing application data
- **WAL Mode**: Write-Ahead Logging mode for SQLite database optimization

## Requirements

### Requirement 1: Diagnose Authentication Failures

**User Story:** As a developer, I want to understand why authentication is failing in Docker, so that I can identify the root cause and implement a fix.

#### Acceptance Criteria

1. WHEN the application starts in Docker, THE system SHALL log detailed authentication flow information including token validation attempts, proxy interactions, and session creation
2. WHEN a login request is made in Docker, THE system SHALL capture and log the complete request/response cycle including headers, body, and error details
3. WHEN authentication fails, THE system SHALL provide specific error codes and messages that indicate whether the failure is due to token validation, proxy configuration, or session management
4. WHILE debugging, THE system SHALL expose health check endpoints that verify connectivity to WUZAPI and validate token handling

### Requirement 2: Verify Docker Environment Configuration

**User Story:** As a DevOps engineer, I want to ensure Docker environment variables are correctly configured, so that the application can properly communicate with WUZAPI.

#### Acceptance Criteria

1. WHEN the Docker container starts, THE system SHALL validate that all required environment variables are present (WUZAPI_BASE_URL, VITE_ADMIN_TOKEN, CORS_ORIGINS, etc.)
2. WHEN environment variables are missing or invalid, THE system SHALL log clear error messages indicating which variables are misconfigured
3. WHILE running in Docker, THE system SHALL verify that the WUZAPI_BASE_URL is accessible and responding to health checks
4. WHEN the container is running, THE system SHALL expose configuration information via the /health endpoint for verification

### Requirement 3: Test Authentication Flow Locally

**User Story:** As a developer, I want to test the authentication flow locally before deploying to Docker, so that I can verify the fix works correctly.

#### Acceptance Criteria

1. WHEN running the application locally with npm run dev:full, THE system SHALL successfully authenticate both admin and user tokens
2. WHEN making login requests locally, THE system SHALL create valid sessions and return appropriate authentication tokens
3. WHEN testing with curl or Postman, THE system SHALL accept tokens in both Authorization header and token header formats
4. WHEN the local test passes, THE system SHALL provide a baseline for comparing Docker behavior

### Requirement 4: Build and Test Docker Image

**User Story:** As a DevOps engineer, I want to build and test the Docker image locally, so that I can verify authentication works in containerized environment.

#### Acceptance Criteria

1. WHEN building the Docker image with docker build, THE system SHALL complete successfully without errors
2. WHEN running the Docker container locally with docker run, THE system SHALL start successfully and respond to health checks
3. WHEN making authentication requests to the Docker container, THE system SHALL validate tokens and create sessions correctly
4. WHEN the Docker container is running, THE system SHALL log all authentication attempts with sufficient detail for debugging

### Requirement 5: Verify Proxy Token Handling

**User Story:** As a security engineer, I want to verify that the authentication proxy correctly handles tokens, so that security improvements are maintained while fixing authentication issues.

#### Acceptance Criteria

1. WHEN a request includes a token in the Authorization header, THE proxy SHALL extract and validate the token before forwarding to WUZAPI
2. WHEN a request includes a token in the token header, THE proxy SHALL accept and validate the token using the same logic
3. WHEN token validation fails, THE proxy SHALL return a 401 Unauthorized response with clear error information
4. WHEN token validation succeeds, THE proxy SHALL create a session and forward the request to the appropriate endpoint

### Requirement 6: Prepare Production Docker Image

**User Story:** As a DevOps engineer, I want to prepare a production-ready Docker image for Docker Swarm deployment, so that the application can be deployed with authentication working correctly.

#### Acceptance Criteria

1. WHEN building the production Docker image, THE system SHALL include all necessary dependencies and optimizations
2. WHEN the Docker image is deployed to Docker Swarm, THE system SHALL maintain persistent storage for SQLite database
3. WHEN the application runs in Docker Swarm, THE system SHALL successfully authenticate users and maintain sessions
4. WHEN the Docker Swarm deployment is running, THE system SHALL expose health checks and metrics for monitoring

