# Implementation Plan

## Phase 1: Database Foundation

- [x] 1. Create database migrations for multi-user system
  - [x] 1.1 Create migration for accounts table
    - Add accounts table with id, name, owner_user_id, wuzapi_token, timezone, locale, status, settings
    - Add indexes for performance
    - _Requirements: 1.1, 1.2_
  - [x] 1.2 Create migration for agents table
    - Add agents table with id, account_id, email, password_hash, name, role, availability, status
    - Add unique constraint on (account_id, email)
    - Add indexes for account_id, email, status
    - _Requirements: 2.4, 2.5_
  - [x] 1.3 Create migration for agent_invitations table
    - Add agent_invitations table with id, account_id, token, role, expires_at, used_at
    - Add unique constraint on token
    - _Requirements: 2.1_
  - [x] 1.4 Create migration for agent_sessions table
    - Add agent_sessions table with id, agent_id, account_id, token, expires_at
    - Add indexes for token, agent_id
    - _Requirements: 2.10, 6.1_
  - [x] 1.5 Create migration for custom_roles table
    - Add custom_roles table with id, account_id, name, permissions (JSON)
    - Add unique constraint on (account_id, name)
    - _Requirements: 3.2_
  - [x] 1.6 Create migration for teams and team_members tables
    - Add teams table with id, account_id, name, description, allow_auto_assign
    - Add team_members table with team_id, agent_id
    - Add unique constraints and indexes
    - _Requirements: 5.1, 5.2_
  - [x] 1.7 Create migration for inboxes and inbox_members tables
    - Add inboxes table with id, account_id, name, channel_type, auto_assignment settings
    - Add inbox_members table with inbox_id, agent_id
    - Add unique constraints and indexes
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 1.8 Create migration for audit_log table
    - Add audit_log table with id, account_id, agent_id, action, resource_type, resource_id, details
    - Add indexes for account_id, agent_id, created_at
    - _Requirements: 6.2_

## Phase 2: Backend Services - Core

- [x] 2. Implement AccountService
  - [x] 2.1 Create AccountService class with CRUD operations
    - Implement createAccount, getAccountById, updateAccount, deactivateAccount
    - Use database.js abstraction for all queries
    - _Requirements: 1.1, 1.2, 1.4_
  - [x] 2.2 Write property test for account creation
    - **Property 1: Account Creation Generates Unique Identifiers**
    - **Validates: Requirements 1.1**
  - [x] 2.3 Write property test for default settings
    - **Property 2: Account Default Settings Initialization**
    - **Validates: Requirements 1.2**

- [x] 3. Implement AgentService
  - [x] 3.1 Create AgentService class with agent management
    - Implement createInvitation, completeRegistration, createAgentDirect
    - Implement listAgents, updateAgent, deactivateAgent
    - Use crypto.scrypt for password hashing
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 2.8_
  - [x] 3.2 Implement invitation link generation and validation
    - Generate unique tokens with crypto.randomUUID()
    - Validate expiration (48 hours)
    - Mark as used after registration
    - _Requirements: 2.1, 2.3, 2.4_
  - [x] 3.3 Write property test for invitation uniqueness
    - **Property 5: Invitation Link Uniqueness and Expiration**
    - **Validates: Requirements 2.1**
  - [x] 3.4 Write property test for agent registration
    - **Property 6: Agent Registration Association**
    - **Validates: Requirements 2.4, 2.5**

- [x] 4. Checkpoint - Ensure all tests pass
  - All property tests passing (AccountService, AgentService)

## Phase 3: Authentication System

- [x] 5. Implement Agent Authentication
  - [x] 5.1 Create agent authentication middleware
    - Validate session token from cookie or header
    - Load agent and account data into request
    - Handle expired sessions
    - _Requirements: 6.1, 6.3_
  - [x] 5.2 Implement AgentSessionService
    - Create session in agent_sessions table
    - Session validation and expiration
    - _Requirements: 6.1, 6.5_
  - [x] 5.3 Implement session management
    - Session expiration check
    - Last activity update
    - Session invalidation on deactivation
    - _Requirements: 6.3, 2.8_
  - [x] 5.4 Write property test for deactivation session invalidation
    - **Property 8: Agent Deactivation Session Invalidation**
    - **Validates: Requirements 2.8, 2.9**
  - [x] 5.5 Write property test for failed login lockout
    - **Property 15: Failed Login Lockout**
    - **Validates: Requirements 6.5**

## Phase 4: Permission System

- [x] 6. Implement PermissionService
  - [x] 6.1 Create PermissionService class
    - Implement checkPermission, getAgentPermissions
    - Define default role permissions
    - Handle custom role permissions
    - _Requirements: 3.1, 3.3_
  - [x] 6.2 Create permission middleware (in agentAuth.js)
    - Check agent permissions before route handlers
    - Return 403 for unauthorized actions
    - _Requirements: 3.3, 3.5_
  - [x] 6.3 Implement custom role management
    - Create, update, delete custom roles
    - Assign custom roles to agents
    - _Requirements: 3.2, 3.4_
  - [x] 6.4 Write property test for permission enforcement
    - **Property 10: Permission Check Enforcement**
    - **Validates: Requirements 3.3, 3.5**
  - [x] 6.5 Write property test for permission propagation
    - **Property 7: Permission Propagation Consistency**
    - **Validates: Requirements 2.7, 3.4, 3.6**

- [x] 7. Checkpoint - Ensure all tests pass
  - All property tests passing (PermissionService)

## Phase 5: Teams and Inboxes

- [x] 8. Implement TeamService
  - [x] 8.1 Create TeamService class
    - Implement createTeam, addMember, removeMember, listTeams
    - Handle team statistics
    - _Requirements: 5.1, 5.2, 5.4, 5.5_
  - [x] 8.2 Write property test for team visibility
    - **Property 12: Team Visibility**
    - **Validates: Requirements 5.3**

- [x] 9. Implement InboxService
  - [x] 9.1 Create InboxService class
    - Implement createInbox, assignAgents, removeAgent, listAgentInboxes
    - Implement checkAccess for inbox membership validation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 9.2 Write property test for inbox access control
    - **Property 11: Inbox Access Control**
    - **Validates: Requirements 4.4, 4.5, 7.1, 7.3**

## Phase 6: Audit System

- [x] 10. Implement AuditService
  - [x] 10.1 Create MultiUserAuditService class
    - Implement logAction method
    - Store agent_id, action, resource_type, resource_id, details
    - _Requirements: 6.2_
  - [x] 10.2 Integrate audit logging into all services
    - Add audit calls to AccountService, AgentService, TeamService, InboxService
    - Log all create, update, delete operations
    - _Requirements: 6.2, 7.4_
  - [x] 10.3 Write property test for audit completeness
    - **Property 13: Audit Log Completeness**
    - **Validates: Requirements 6.2**
  - [x] 10.4 Write property test for message sender attribution
    - **Property 17: Message Sender Attribution**
    - **Validates: Requirements 7.4**

- [x] 11. Checkpoint - Ensure all tests pass
  - All property tests passing (TeamService, InboxService, MultiUserAuditService)

## Phase 7: API Routes

- [x] 12. Create Agent Authentication Routes
  - [x] 12.1 Create agentAuthRoutes.js
    - POST /api/auth/agent/login
    - POST /api/auth/agent/logout
    - POST /api/auth/agent/register/:token
    - GET /api/auth/agent/me
    - _Requirements: 2.3, 2.4, 6.1_

- [x] 13. Create Account Management Routes
  - [x] 13.1 Create accountAgentRoutes.js
    - GET /api/account/agents - List agents
    - POST /api/account/agents - Create agent direct
    - POST /api/account/agents/invite - Create invitation
    - PUT /api/account/agents/:id - Update agent
    - DELETE /api/account/agents/:id - Deactivate agent
    - PUT /api/account/agents/:id/role - Assign role
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8_

- [x] 14. Create Team Routes
  - [x] 14.1 Create accountTeamRoutes.js
    - GET /api/account/teams
    - POST /api/account/teams
    - PUT /api/account/teams/:id
    - DELETE /api/account/teams/:id
    - POST /api/account/teams/:id/members
    - DELETE /api/account/teams/:id/members/:agentId
    - _Requirements: 5.1, 5.2, 5.4, 5.5_

- [x] 15. Create Inbox Routes
  - [x] 15.1 Create accountInboxRoutes.js
    - GET /api/account/inboxes
    - POST /api/account/inboxes
    - PUT /api/account/inboxes/:id
    - DELETE /api/account/inboxes/:id
    - POST /api/account/inboxes/:id/agents
    - DELETE /api/account/inboxes/:id/agents/:agentId
    - _Requirements: 4.1, 4.2, 4.3, 4.6_

- [x] 16. Create Role Routes
  - [x] 16.1 Create accountRoleRoutes.js
    - GET /api/account/roles
    - POST /api/account/roles
    - PUT /api/account/roles/:id
    - DELETE /api/account/roles/:id
    - _Requirements: 3.1, 3.2, 3.6_

- [x] 17. Create Audit Routes
  - [x] 17.1 Create accountAuditRoutes.js
    - GET /api/account/audit - List audit logs with filters
    - _Requirements: 6.4_

## Phase 8: Frontend - Types and Services

- [x] 18. Create TypeScript types
  - [x] 18.1 Create src/types/multi-user.ts
    - Define Account, Agent, Team, Inbox, CustomRole interfaces
    - Define Permission type with all 22 permissions
    - Define DTOs for create/update operations
    - _Requirements: All_

- [x] 19. Create Frontend Services
  - [x] 19.1 Create src/services/agent-auth.ts
    - Implement login, logout, register, getCurrentAgent
    - Handle session token storage
    - _Requirements: 6.1_
  - [x] 19.2 Create src/services/account-agents.ts
    - Implement CRUD operations for agents
    - Implement invitation management
    - _Requirements: 2.1, 2.5, 2.6, 2.7, 2.8_
  - [x] 19.3 Create src/services/account-teams.ts
    - Implement CRUD operations for teams
    - Implement member management
    - _Requirements: 5.1, 5.2, 5.5_
  - [x] 19.4 Create src/services/account-inboxes.ts
    - Implement CRUD operations for inboxes
    - Implement agent assignment
    - _Requirements: 4.1, 4.2, 4.3_

## Phase 9: Frontend - Contexts

- [x] 20. Create AgentContext
  - [x] 20.1 Create src/contexts/AgentContext.tsx
    - Manage current agent state
    - Provide permissions checking
    - Handle availability status
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 20.2 Write property test for availability routing
    - **Property 18: Availability-Based Routing**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 21. Create InboxContext
  - [x] 21.1 Create src/contexts/InboxContext.tsx
    - Manage inbox list for current agent
    - Handle current inbox selection
    - _Requirements: 4.4_

- [x] 22. Checkpoint - Ensure all tests pass
  - All property tests passing (frontend contexts)

## Phase 10: Frontend - Components

- [x] 23. Create Agent Management Components
  - [x] 23.1 Create src/components/admin/AgentList.tsx
    - Display list of agents with status, role, last activity
    - Actions: edit, deactivate, change role
    - _Requirements: 2.6_
  - [x] 23.2 Create src/components/admin/AgentInviteDialog.tsx
    - Form to create invitation
    - Display generated link with copy/share buttons
    - _Requirements: 2.1, 2.2_
  - [x] 23.3 Create src/components/admin/AgentCreateDialog.tsx
    - Form to create agent directly with credentials
    - _Requirements: 2.5_

- [-] 24. Create Team Management Components
  - [x] 24.1 Create src/components/admin/TeamList.tsx
    - Display list of teams with member count
    - _Requirements: 5.4_
  - [x] 24.2 Create src/components/admin/TeamDialog.tsx
    - Create/edit team form
    - Member management
    - _Requirements: 5.1, 5.2, 5.5_

- [x] 25. Create Inbox Management Components
  - [x] 25.1 Create src/components/admin/InboxList.tsx
    - Display list of inboxes
    - _Requirements: 4.1_
  - [x] 25.2 Create src/components/admin/InboxDialog.tsx
    - Create/edit inbox form
    - Agent assignment
    - _Requirements: 4.2, 4.3_

- [x] 26. Create Role Management Components
  - [x] 26.1 Create src/components/admin/RoleList.tsx
    - Display default and custom roles
    - _Requirements: 3.1_
  - [x] 26.2 Create src/components/admin/CustomRoleDialog.tsx
    - Create/edit custom role with permission selection
    - _Requirements: 3.2_

- [x] 27. Create Agent Login Components
  - [x] 27.1 Create src/components/auth/AgentLogin.tsx
    - Login form for agents
    - _Requirements: 6.1_
  - [x] 27.2 Create src/components/auth/AgentRegister.tsx
    - Registration form for invitation links
    - _Requirements: 2.3, 2.4_

- [x] 28. Create Audit Log Components
  - [x] 28.1 Create src/components/admin/AuditLog.tsx
    - Display audit log with filters
    - _Requirements: 6.4_

## Phase 11: Integration

- [x] 29. Integrate with existing conversation system
  - [x] 29.1 Update conversation queries to filter by inbox membership
    - Modify getConversations to check inbox_members
    - Add agent_id to message records
    - _Requirements: 4.4, 7.1, 7.4_
  - [x] 29.2 Write property test for WUZAPI credential isolation
    - **Property 20: WUZAPI Credential Isolation**
    - **Validates: Requirements 10.1**

- [x] 30. Integrate with existing webhook system
  - [x] 30.1 Update webhook handling to route by account
    - Add account_id to webhook configuration
    - Route incoming webhooks to correct account
    - _Requirements: 10.2, 10.4_

## Phase 12: Data Integrity

- [x] 31. Implement cascade deletion
  - [x] 31.1 Add cascade delete triggers/logic
    - Account deletion cascades to agents, teams, inboxes
    - Agent deletion cascades to sessions, team_members, inbox_members
    - _Requirements: 1.5_
  - [x] 31.2 Write property test for cascade deletion
    - **Property 4: Account Deletion Cascade**
    - **Validates: Requirements 1.5**

- [x] 32. Implement data serialization
  - [x] 32.1 Create serialization utilities
    - JSON serialization for agent data
    - Schema validation on deserialization
    - _Requirements: 9.1, 9.2, 9.3_
  - [x] 32.2 Write property test for serialization round-trip
    - **Property 19: Agent Data Serialization Round-Trip**
    - **Validates: Requirements 9.1, 9.2**

- [x] 33. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
