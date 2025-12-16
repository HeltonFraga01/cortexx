# Requirements Document

## Introduction

This document specifies the requirements for fixing authentication issues on admin pages that are causing "Token inválido ou erro de conexão" (Invalid token or connection error) and 401 Unauthorized errors. The system currently has session-based authentication implemented, but admin routes are failing to properly validate the session and retrieve user data from WUZAPI.

## Glossary

- **Admin_System**: The administrative interface of the WUZAPI Manager application
- **Session_Manager**: The Express session middleware that manages user authentication state
- **WUZAPI_Service**: The external WhatsApp Business API service
- **Auth_Middleware**: The authentication middleware that validates user sessions
- **Admin_Routes**: Backend routes that handle administrative operations
- **Frontend_Client**: The React-based user interface that makes API requests

## Requirements

### Requirement 1: Session-Based Authentication

**User Story:** As an administrator, I want to authenticate using session-based cookies so that I don't need to manually provide tokens in every request

#### Acceptance Criteria

1. WHEN an administrator logs in with valid credentials, THE Admin_System SHALL create a secure HTTP-only session cookie
2. WHEN the session cookie is present and valid, THE Auth_Middleware SHALL authenticate subsequent requests without requiring additional tokens
3. WHEN the session cookie expires or is invalid, THE Admin_System SHALL return a 401 status code with error message "Authentication required"
4. WHERE the administrator accesses protected admin routes, THE Admin_System SHALL validate the session before processing the request
5. WHILE the administrator has an active session, THE Session_Manager SHALL maintain the userToken, userId, and role in the session data

### Requirement 2: Admin Routes Authentication

**User Story:** As an administrator, I want all admin routes to properly validate my session so that I can access administrative features without authentication errors

#### Acceptance Criteria

1. WHEN an administrator accesses any route under /api/admin, THE Auth_Middleware SHALL verify the session contains a valid userId and role of "admin"
2. IF the session is missing or the role is not "admin", THEN THE Admin_System SHALL return a 403 status code with error message "Admin access required"
3. WHEN the Auth_Middleware validates the session, THE Admin_System SHALL extract the userToken from the session for WUZAPI requests
4. WHEN making requests to WUZAPI_Service, THE Admin_Routes SHALL use the token from the session rather than requiring it in request headers
5. IF the WUZAPI_Service returns a 401 error, THEN THE Admin_System SHALL return a 401 status code with error message "Token inválido ou erro de conexão"

### Requirement 3: Dashboard Statistics Retrieval

**User Story:** As an administrator, I want to view dashboard statistics so that I can monitor system health and user activity

#### Acceptance Criteria

1. WHEN an administrator accesses /api/admin/dashboard-stats, THE Admin_System SHALL retrieve statistics from WUZAPI_Service using the session token
2. WHEN WUZAPI_Service returns user data, THE Admin_System SHALL calculate totalUsers, connectedUsers, and loggedInUsers statistics
3. IF WUZAPI_Service is unavailable, THEN THE Admin_System SHALL return default statistics with systemStatus set to "error"
4. WHEN statistics are successfully retrieved, THE Admin_System SHALL return a 200 status code with the statistics data
5. WHILE retrieving statistics, THE Admin_System SHALL include system memory usage and uptime information

### Requirement 4: Settings Page Functionality

**User Story:** As an administrator, I want to test the WUZAPI connection from the settings page so that I can verify the system is properly configured

#### Acceptance Criteria

1. WHEN an administrator clicks "Testar Conexão" on the settings page, THE Frontend_Client SHALL send a GET request to /api/admin/users
2. WHEN the connection test succeeds, THE Admin_System SHALL return the count of connected users with a 200 status code
3. IF the connection test fails with a 401 error, THEN THE Frontend_Client SHALL display "Token de administrador inválido"
4. IF the connection test fails with a 504 error, THEN THE Frontend_Client SHALL display "Timeout: A API WUZAPI não respondeu a tempo"
5. WHEN the connection test completes, THE Frontend_Client SHALL display the result with appropriate success or error styling

### Requirement 5: Error Handling and Logging

**User Story:** As a system administrator, I want detailed error logs so that I can troubleshoot authentication issues

#### Acceptance Criteria

1. WHEN an authentication error occurs, THE Admin_System SHALL log the error with userId, IP address, and error reason
2. WHEN a WUZAPI_Service request fails, THE Admin_System SHALL log the response status, error message, and request details
3. IF a session validation fails, THEN THE Admin_System SHALL log the failure reason and session state
4. WHEN an administrator successfully authenticates, THE Admin_System SHALL log the login event with timestamp and IP address
5. WHILE processing admin requests, THE Admin_System SHALL log request method, URL, and response time

### Requirement 6: CSRF Token Management

**User Story:** As an administrator, I want CSRF protection on all state-changing requests so that the system is protected from cross-site request forgery attacks

#### Acceptance Criteria

1. WHEN the Frontend_Client initializes, THE Admin_System SHALL provide a CSRF token via /api/auth/csrf-token endpoint
2. WHEN the Frontend_Client makes POST, PUT, DELETE, or PATCH requests, THE Frontend_Client SHALL include the CSRF token in the request headers
3. IF a CSRF token is missing or invalid, THEN THE Admin_System SHALL return a 403 status code with error code "CSRF_VALIDATION_FAILED"
4. WHEN a CSRF token expires, THE Frontend_Client SHALL automatically request a new token and retry the request
5. WHEN an administrator logs out, THE Frontend_Client SHALL clear the cached CSRF token

### Requirement 7: Public Branding and Landing Page Access

**User Story:** As a visitor, I want to view the branded landing page without authentication so that I can see the customized interface before logging in

#### Acceptance Criteria

1. WHEN any user accesses GET /api/branding, THE Admin_System SHALL return the branding configuration without requiring authentication
2. WHEN any user accesses GET /api/landing-page, THE Admin_System SHALL return the custom landing page HTML without requiring authentication
3. WHEN any user accesses GET /api/custom-links, THE Admin_System SHALL return the custom navigation links without requiring authentication
4. WHEN an administrator accesses PUT /api/admin/branding, THE Admin_System SHALL require admin authentication
5. WHEN an administrator accesses PUT /api/admin/landing-page, THE Admin_System SHALL require admin authentication
