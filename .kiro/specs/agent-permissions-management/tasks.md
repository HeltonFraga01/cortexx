# Implementation Plan

## Agent Permissions Management - Inline Editing System

Este plano implementa o sistema de gerenciamento avançado de permissões de agentes com edição inline, conforme especificado nos documentos de requisitos e design.

---

- [x] 1. Create database migration for agent_database_access table
  - Create migration file `server/migrations/077_create_agent_database_access.js`
  - Define table schema with id, agent_id, connection_id, access_level columns
  - Add foreign key constraints and indexes
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [x] 2. Implement AgentDatabaseAccessService backend
  - [x] 2.1 Create `server/services/AgentDatabaseAccessService.js`
    - Implement `getAgentDatabaseAccess(agentId)` method
    - Implement `setAgentDatabaseAccess(agentId, access[])` method
    - Implement `checkDatabaseAccess(agentId, connectionId)` method
    - Implement `getAccessibleDatabases(agentId)` method
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [ ]* 2.2 Write property test for database access level enforcement
    - **Property 5: Database Access Level Enforcement**
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [x] 3. Extend backend routes for agent details and assignments
  - [x] 3.1 Add GET `/api/session/agents/:agentId/details` endpoint
    - Return agent with teams, inboxes, database access, and permissions
    - _Requirements: 1.2, 6.1, 6.2, 6.3_
  - [x] 3.2 Add PUT `/api/session/agents/:agentId/teams` endpoint
    - Update agent team memberships in bulk
    - _Requirements: 2.2, 2.4_
  - [x] 3.3 Add PUT `/api/session/agents/:agentId/inboxes` endpoint
    - Update agent inbox assignments in bulk
    - _Requirements: 3.2, 3.4_
  - [x] 3.4 Add PUT `/api/session/agents/:agentId/database-access` endpoint
    - Update agent database access configurations
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  - [x] 3.5 Add PUT `/api/session/agents/:agentId/permissions` endpoint
    - Update agent role and custom permissions
    - _Requirements: 5.2, 5.3, 5.4_
  - [ ]* 3.6 Write property tests for team membership consistency
    - **Property 3: Team Membership Consistency**
    - **Validates: Requirements 2.2, 2.4**
  - [ ]* 3.7 Write property tests for inbox access consistency
    - **Property 4: Inbox Access Consistency**
    - **Validates: Requirements 3.2, 3.4**

- [x] 4. Implement permission validation and security
  - [x] 4.1 Add permission escalation prevention logic
    - Prevent granting permissions the user doesn't have
    - _Requirements: 8.2_
  - [x] 4.2 Add self-demotion prevention logic
    - Prevent owner from removing their own owner role
    - _Requirements: 8.1_
  - [x] 4.3 Add permission conflict detection
    - Warn on conflicting permission configurations
    - _Requirements: 8.3_
  - [ ]* 4.4 Write property test for permission escalation prevention
    - **Property 7: Permission Escalation Prevention**
    - **Validates: Requirements 8.2**
  - [ ]* 4.5 Write property test for self-demotion prevention
    - **Property 8: Self-Demotion Prevention**
    - **Validates: Requirements 8.1**

- [x] 5. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Create frontend TypeScript types
  - [x] 6.1 Add types to `src/types/multi-user.ts`
    - Add `AgentWithDetails` interface
    - Add `DatabaseAccessConfig` interface
    - Add `AgentUpdates` interface
    - Add `AgentInlineEditorProps` interface
    - _Requirements: 1.2, 4.2_

- [x] 7. Extend frontend account-agents service
  - [x] 7.1 Add `getAgentDetails(agentId)` function
    - Fetch agent with teams, inboxes, database access
    - _Requirements: 1.2_
  - [x] 7.2 Add `updateAgentTeams(agentId, teamIds[])` function
    - Update agent team memberships
    - _Requirements: 2.2_
  - [x] 7.3 Add `updateAgentInboxes(agentId, inboxIds[])` function
    - Update agent inbox assignments
    - _Requirements: 3.2_
  - [x] 7.4 Add `updateAgentDatabaseAccess(agentId, access[])` function
    - Update agent database access configurations
    - _Requirements: 4.2_
  - [x] 7.5 Add `updateAgentPermissions(agentId, role, permissions, customRoleId)` function
    - Update agent permissions
    - _Requirements: 5.2, 5.3_

- [x] 8. Create AgentInlineEditor component
  - [x] 8.1 Create `src/components/user/AgentInlineEditor.tsx`
    - Implement expandable row editor with tabs/sections
    - Handle form state with dirty tracking
    - Implement save and cancel functionality
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [ ]* 8.2 Write property test for inline editor state consistency
    - **Property 1: Inline Editor State Consistency**
    - **Validates: Requirements 1.1, 1.2**
  - [ ]* 8.3 Write property test for dirty state tracking
    - **Property 2: Dirty State Tracking**
    - **Validates: Requirements 1.3, 1.5**

- [x] 9. Create AgentTeamSection component
  - [x] 9.1 Create `src/components/user/AgentTeamSection.tsx`
    - Display available teams with checkboxes
    - Handle team selection changes
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 10. Create AgentInboxSection component
  - [x] 10.1 Create `src/components/user/AgentInboxSection.tsx`
    - Display available inboxes with checkboxes
    - Handle inbox selection changes
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 11. Create AgentDatabaseSection component
  - [x] 11.1 Create `src/components/user/AgentDatabaseSection.tsx`
    - Display database connections with access level selectors
    - Handle access level changes (none, view, full)
    - _Requirements: 4.1, 4.2_

- [x] 12. Create AgentPermissionsSection component
  - [x] 12.1 Create `src/components/user/AgentPermissionsSection.tsx`
    - Display role selector with predefined roles
    - Display permission toggles for custom configuration
    - Handle role and permission changes
    - _Requirements: 5.1, 5.2, 5.3_
  - [ ]* 12.2 Write property test for role-permission mapping
    - **Property 6: Role-Permission Mapping**
    - **Validates: Requirements 5.2, 5.4**

- [x] 13. Create AgentSummaryBadges component
  - [x] 13.1 Create `src/components/user/AgentSummaryBadges.tsx`
    - Display team count badge with tooltip
    - Display inbox count badge with tooltip
    - Display database access indicator with tooltip
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 13.2 Write property test for summary badge accuracy
    - **Property 10: Summary Badge Accuracy**
    - **Validates: Requirements 6.1, 6.2, 6.3**

- [x] 14. Integrate inline editor into AgentListUser
  - [x] 14.1 Update `src/components/user/AgentListUser.tsx`
    - Add expandable row functionality
    - Integrate AgentInlineEditor component
    - Add AgentSummaryBadges to table rows
    - Handle expand/collapse state
    - _Requirements: 1.1, 6.1, 6.2, 6.3_

- [x] 15. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implement bulk operations backend
  - [x] 16.1 Add POST `/api/session/agents/bulk` endpoint
    - Support bulk team assignment
    - Support bulk inbox assignment
    - Support bulk role changes
    - Support bulk database access changes
    - Implement transaction rollback on failure
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [ ]* 16.2 Write property test for bulk operation atomicity
    - **Property 9: Bulk Operation Atomicity**
    - **Validates: Requirements 7.2, 7.3, 7.4**

- [x] 17. Implement bulk operations frontend
  - [x] 17.1 Add bulk selection UI to AgentListUser
    - Add checkbox column for multi-select
    - Add bulk action buttons when agents selected
    - _Requirements: 7.1_
  - [x] 17.2 Add `bulkUpdateAgents(agentIds, action, data)` to account-agents service
    - Support all bulk action types
    - _Requirements: 7.2, 7.3, 7.4_
  - [x] 17.3 Create BulkActionDialog component
    - Dialog for configuring bulk actions
    - Show affected agents count
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 18. Add active session notification
  - [x] 18.1 Implement session impact detection
    - Check if permission changes affect active sessions
    - Show warning dialog before applying
    - _Requirements: 8.4_

- [x] 19. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
