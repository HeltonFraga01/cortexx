# Design Document - Docker Authentication Proxy Fix

## Overview

The WUZAPI Manager application implements a security proxy for token authentication that validates tokens before forwarding requests to the WUZAPI external service. When running in Docker, authentication fails due to configuration and communication issues between the containerized application and the external WUZAPI service.

This design addresses:
1. **Diagnosis**: Comprehensive logging and debugging capabilities
2. **Configuration**: Proper environment variable handling in Docker
3. **Testing**: Local validation before Docker deployment
4. **Docker Build**: Optimized multi-stage build with proper configuration
5. **Verification**: Health checks and authentication flow validation

## Architecture

### Current Authentication Flow

```
Client Request
    ↓
[Express Server]
    ↓
[Auth Routes] → Validate token with WUZAPI
    ↓
[Session Middleware] → Create/validate session
    ↓
[Protected Routes] → Check session.userId
    ↓
Response
```

### Issues in Docker Environment

1. **Environment Variables**: Missing or incorrect WUZAPI_BASE_URL, VITE_ADMIN_TOKEN
2. **Network Connectivity**: Docker container cannot reach external WUZAPI service
3. **Session Storage**: SQLite session store path issues in containerized environment
4. **Logging**: Insufficient logging to diagnose authentication failures
5. **Health Checks**: No validation of WUZAPI connectivity before accepting requests

### Proposed Solution Architecture

```
Docker Container
├── [Environment Validation]
│   ├── Check WUZAPI_BASE_URL
│   ├── Check VITE_ADMIN_TOKEN
│   ├── Check CORS_ORIGINS
│   └── Verify WUZAPI connectivity
│
├── [Enhanced Logging]
│   ├── Authentication flow logs
│   ├── Token validation logs
│   ├── Session creation logs
│   └── Error details with context
│
├── [Health Checks]
│   ├── /health endpoint
│   ├── WUZAPI connectivity check
│   ├── Database status check
│   └── Session store status check
│
├── [Session Management]
│   ├── SQLite session store (persistent volume)
│   ├── Session validation
│   └── Session cleanup
│
└── [Authentication Routes]
    ├── POST /api/auth/login
    ├── POST /api/auth/logout
    ├── GET /api/auth/status
    └── GET /api/auth/csrf-token
```

## Components and Interfaces

### 1. Environment Validation Component

**Purpose**: Validate all required environment variables on startup

**Responsibilities**:
- Check presence of WUZAPI_BASE_URL
- Check presence of VITE_ADMIN_TOKEN
- Check presence of CORS_ORIGINS
- Validate URL formats
- Log configuration status

**Implementation Location**: `server/utils/environmentValidator.js` (new)

**Interface**:
```javascript
class EnvironmentValidator {
  validate() // Returns { valid: boolean, errors: string[] }
  getConfigInfo() // Returns configuration details
  logConfiguration() // Logs configuration to logger
}
```

### 2. Enhanced Logging Component

**Purpose**: Provide detailed logging for authentication debugging

**Responsibilities**:
- Log authentication attempts with full context
- Log token validation steps
- Log session creation/destruction
- Log WUZAPI communication
- Include request/response details

**Implementation Location**: Enhance `server/utils/logger.js` and `server/utils/securityLogger.js`

**Key Logging Points**:
- Login attempt (token, role, IP)
- Token validation request to WUZAPI
- Token validation response
- Session creation
- Session validation on protected routes
- Authentication errors with full context

### 3. Health Check Enhancement

**Purpose**: Verify system health including WUZAPI connectivity

**Responsibilities**:
- Check database connectivity
- Check WUZAPI connectivity
- Check session store status
- Return detailed health information
- Provide diagnostic information

**Implementation Location**: Enhance `server/index.js` /health endpoint

**Response Format**:
```json
{
  "status": "ok|degraded|error",
  "timestamp": "ISO8601",
  "environment": "production|development",
  "database": {
    "status": "connected|error",
    "type": "SQLite",
    "path": "/app/data/wuzapi.db"
  },
  "wuzapi": {
    "status": "connected|error",
    "baseUrl": "https://wzapi.wasend.com.br",
    "connectivity": "ok|timeout|refused"
  },
  "session_store": {
    "status": "connected|error",
    "type": "SQLite",
    "path": "/app/data/sessions.db"
  }
}
```

### 4. Docker Configuration

**Purpose**: Ensure proper Docker environment setup

**Key Configurations**:
- Multi-stage build for optimization
- Proper volume mounting for SQLite persistence
- Environment variable passing
- Health check configuration
- User permissions (non-root)

**Dockerfile Improvements**:
- Ensure data directory exists with proper permissions
- Validate environment on startup
- Expose health check endpoint
- Configure proper signal handling

### 5. Authentication Flow Validation

**Purpose**: Verify authentication works end-to-end

**Test Scenarios**:
1. Admin login with valid token
2. User login with valid token
3. Invalid token rejection
4. Session creation and validation
5. Protected route access
6. Session expiration

**Implementation**: Test scripts and Cypress E2E tests

## Data Models

### Session Data Structure

```javascript
{
  userId: string,           // User ID from WUZAPI
  userToken: string,        // Token used for authentication
  role: 'admin' | 'user',   // User role
  userName: string,         // User name (optional)
  createdAt: Date,          // Session creation time
  lastActivity: Date,       // Last activity timestamp
  expiresAt: Date           // Session expiration time
}
```

### Authentication Request

```javascript
{
  token: string,            // Authentication token
  role: 'admin' | 'user'    // Role being authenticated as
}
```

### Authentication Response

```javascript
{
  success: boolean,
  message: string,
  sessionId: string,        // Session ID (cookie)
  user: {
    id: string,
    role: 'admin' | 'user',
    name: string
  }
}
```

## Error Handling

### Authentication Errors

| Error Code | HTTP Status | Meaning | Action |
|-----------|------------|---------|--------|
| NO_TOKEN | 400 | Token not provided | Provide token in header or body |
| INVALID_INPUT | 400 | Missing required fields | Check request format |
| INVALID_ROLE | 400 | Invalid role value | Use 'admin' or 'user' |
| INVALID_CREDENTIALS | 401 | Token validation failed | Verify token is correct |
| SERVICE_UNAVAILABLE | 503 | WUZAPI unreachable | Check WUZAPI connectivity |
| AUTH_REQUIRED | 401 | No active session | Login first |
| FORBIDDEN | 403 | Insufficient permissions | Use appropriate role |

### Logging Strategy

All errors include:
- Error code and message
- Request context (IP, path, method)
- User context (userId, role if available)
- Timestamp
- Stack trace (in development)
- Relevant configuration (in debug mode)

## Testing Strategy

### Unit Tests

1. **Environment Validator Tests**
   - Valid configuration
   - Missing variables
   - Invalid URL formats

2. **Authentication Logic Tests**
   - Token validation
   - Session creation
   - Role checking

### Integration Tests

1. **Local Authentication Flow**
   - Login with admin token
   - Login with user token
   - Invalid token rejection
   - Session persistence

2. **WUZAPI Communication**
   - Token validation with WUZAPI
   - Error handling for WUZAPI failures
   - Timeout handling

### Docker Tests

1. **Container Startup**
   - Environment validation
   - Database initialization
   - Health check response

2. **Authentication in Docker**
   - Login request handling
   - Token validation
   - Session creation
   - Protected route access

3. **Persistence**
   - Session persistence across requests
   - Database persistence with volumes

### E2E Tests (Cypress)

1. **Login Flow**
   - Admin login
   - User login
   - Invalid credentials
   - Session persistence

2. **Protected Routes**
   - Access with valid session
   - Rejection without session
   - Role-based access control

## Deployment Considerations

### Docker Swarm Single-Node

1. **Volume Configuration**
   - Mount `/app/data` for SQLite persistence
   - Mount `/app/logs` for log persistence

2. **Environment Variables**
   - Pass via `.env` file or environment
   - Validate on container startup

3. **Health Checks**
   - Configure Docker health check
   - Monitor via `/health` endpoint

4. **Networking**
   - Ensure container can reach WUZAPI
   - Configure CORS for frontend access

### Configuration Files

**docker-compose.yml**:
```yaml
services:
  wuzapi-manager:
    image: wuzapi-manager:latest
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - WUZAPI_BASE_URL=https://wzapi.wasend.com.br
      - VITE_ADMIN_TOKEN=${ADMIN_TOKEN}
      - CORS_ORIGINS=https://your-domain.com
    volumes:
      - wuzapi_data:/app/data
      - wuzapi_logs:/app/logs
    healthcheck:
      test: ["CMD", "node", "server/healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

## Security Considerations

1. **Token Handling**
   - Tokens validated with WUZAPI on every login
   - Tokens stored in session (server-side)
   - Tokens never exposed in logs (sanitized)

2. **Session Security**
   - HTTPOnly cookies prevent XSS attacks
   - Secure flag in production
   - SameSite=Lax for CSRF protection
   - 24-hour expiration

3. **Environment Variables**
   - Sensitive values not logged
   - Validation without exposing values
   - Proper Docker secret handling

4. **Error Messages**
   - Generic error messages to clients
   - Detailed logs for debugging (server-side only)
   - No sensitive information in responses

## Monitoring and Debugging

### Key Metrics

1. **Authentication Metrics**
   - Login attempts (success/failure)
   - Token validation failures
   - Session creation rate
   - Session expiration rate

2. **Performance Metrics**
   - WUZAPI response time
   - Session store response time
   - Authentication endpoint latency

3. **Error Metrics**
   - Authentication errors by type
   - WUZAPI connectivity issues
   - Session store errors

### Debug Endpoints

1. **GET /health** - System health status
2. **GET /api/auth/status** - Current session status
3. **GET /api/auth/debug** - Debug information (development only)

### Log Analysis

Key log patterns to monitor:
- "Token validation failed" - Authentication issues
- "WUZAPI connection error" - External service issues
- "Session creation failed" - Session store issues
- "Unauthorized access attempt" - Security events

