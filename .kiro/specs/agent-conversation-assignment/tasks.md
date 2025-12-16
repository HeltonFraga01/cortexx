# Implementation Plan

## 1. Database Schema Updates

- [x] 1.1 Create migration to add auto-assignment fields to inboxes table
  - Add `max_conversations_per_agent INTEGER DEFAULT NULL`
  - Add `last_assigned_agent_id TEXT` for round-robin tracking
  - _Requirements: 7.3, 7.4_

## 2. ConversationAssignmentService Implementation

- [x] 2.1 Create ConversationAssignmentService with core methods
  - Implement `getNextAvailableAgent(inboxId)` with round-robin logic
  - Implement `getAgentConversationCount(agentId)` for max conversations check
  - Implement `autoAssign(inboxId, conversationId)` for new conversations
  - Use database transactions for assignment operations
  - _Requirements: 1.1, 1.2, 1.3, 7.4_

- [ ]* 2.2 Write property test for auto-assignment targets online agents only
  - **Property 1: Auto-assignment targets online agents only**
  - **Validates: Requirements 1.1, 4.1, 4.2**

- [ ]* 2.3 Write property test for round-robin distribution balance
  - **Property 2: Round-robin distribution balance**
  - **Validates: Requirements 1.2**

- [ ]* 2.4 Write property test for no assignment when no agents online
  - **Property 3: No assignment when no agents online**
  - **Validates: Requirements 1.3**

- [x] 2.5 Implement pickup, transfer, and release methods
  - Implement `pickupConversation(conversationId, agentId)` with optimistic locking
  - Implement `transferConversation(conversationId, targetAgentId, sourceAgentId)`
  - Implement `releaseConversation(conversationId, agentId)`
  - Add audit logging for all assignment actions
  - _Requirements: 2.3, 5.1, 5.2, 5.3, 5.5, 6.1, 6.2, 6.3, 6.4_

- [ ]* 2.6 Write property test for pickup assigns to requesting agent
  - **Property 5: Pickup assigns to requesting agent**
  - **Validates: Requirements 2.3**

- [ ]* 2.7 Write property test for transfer updates assignment
  - **Property 7: Transfer updates assignment**
  - **Validates: Requirements 5.1, 5.2, 5.3**

- [ ]* 2.8 Write property test for release clears assignment
  - **Property 8: Release clears assignment**
  - **Validates: Requirements 6.1, 6.2**

- [ ]* 2.9 Write property test for release does not trigger auto-assignment
  - **Property 9: Release does not trigger auto-assignment**
  - **Validates: Requirements 6.3**

- [ ]* 2.10 Write property test for disabled auto-assignment
  - **Property 10: Disabled auto-assignment leaves conversations unassigned**
  - **Validates: Requirements 7.2**

- [ ]* 2.11 Write property test for max conversations limit
  - **Property 11: Max conversations limit respected**
  - **Validates: Requirements 7.4**

## 3. Agent Chat Routes Updates

- [x] 3.1 Update GET /api/agent/chat/conversations to filter by assignment
  - Add `assignedToMe` and `unassigned` filter options
  - Return only conversations where assigned_agent_id equals agent's ID OR is NULL
  - Ensure conversations are in agent's inbox membership
  - _Requirements: 2.1, 2.4, 2.5_

- [ ]* 3.2 Write property test for agent visibility filter
  - **Property 4: Agent visibility filter**
  - **Validates: Requirements 2.1, 2.4**

- [x] 3.3 Add POST /api/agent/chat/conversations/:id/pickup endpoint
  - Validate conversation is unassigned and in agent's inbox
  - Use optimistic locking to prevent race conditions
  - Return 409 conflict if already assigned
  - _Requirements: 2.3_

- [x] 3.4 Add POST /api/agent/chat/conversations/:id/transfer endpoint
  - Validate target agent is member of inbox
  - Display warning if target agent is offline but allow transfer
  - Log transfer action with both agent IDs
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 3.5 Add POST /api/agent/chat/conversations/:id/release endpoint
  - Set assigned_agent_id to NULL
  - Do NOT trigger auto-assignment after release
  - Log release action
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

## 4. Checkpoint - Backend Tests

- [x] 4. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

## 5. User/Owner Routes for Full Visibility

- [x] 5.1 Update user chat routes to show all conversations
  - Ensure user/owner sees all conversations regardless of assignment
  - Display assigned agent information in conversation response
  - _Requirements: 3.1, 3.2, 3.4_

- [ ]* 5.2 Write property test for owner sees all conversations
  - **Property 6: Owner sees all conversations**
  - **Validates: Requirements 3.1, 3.4**

- [x] 5.3 Add manual assignment endpoint for user/owner
  - POST /api/user/chat/conversations/:id/assign
  - Allow owner to assign any conversation to any agent in inbox
  - _Requirements: 3.3_

## 6. Agent Availability Integration

- [x] 6.1 Update agent availability to affect assignment pool
  - Ensure online agents are included in auto-assignment pool
  - Ensure offline/busy agents are excluded from pool
  - Keep existing assignments when agent goes busy
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 6.2 Add logout handler to set availability to offline
  - Update agent session invalidation to set availability to offline
  - _Requirements: 4.5_

- [ ]* 6.3 Write property test for logout sets offline
  - **Property 12: Logout sets offline**
  - **Validates: Requirements 4.5**

## 7. Auto-Assignment Integration

- [x] 7.1 Integrate auto-assignment into new conversation creation
  - Call ConversationAssignmentService.autoAssign when new conversation is created
  - Respect inbox's enable_auto_assignment setting
  - Log assignment action for audit
  - _Requirements: 1.1, 1.5, 7.2_

## 8. Checkpoint - Backend Integration Tests

- [x] 8. Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.

## 9. Frontend Service Updates

- [x] 9.1 Add assignment-related API functions to agent-chat.ts
  - Add `pickupAgentConversation(conversationId)` function
  - Add `transferAgentConversation(conversationId, targetAgentId)` function
  - Add `releaseAgentConversation(conversationId)` function
  - Add `getAgentConversations` filter options for assignment
  - _Requirements: 2.3, 5.1, 6.1_

- [x] 9.2 Add types for assignment-related data
  - Add assignment filter types to ConversationFilters
  - Add transfer/release response types
  - _Requirements: 2.5_

## 10. Frontend UI Components

- [x] 10.1 Update conversation list to show assignment status
  - Add visual indicator for unassigned conversations (available badge)
  - Show assigned agent name/avatar for assigned conversations
  - _Requirements: 2.2, 3.2_

- [x] 10.2 Add assignment filter tabs to conversation list
  - Add "Minhas conversas" (assigned to me) filter tab
  - Add "Disponíveis" (unassigned) filter tab
  - Add "Todas" (all accessible) filter tab
  - _Requirements: 2.5_

- [x] 10.3 Implement auto-pickup on conversation click
  - When agent clicks unassigned conversation, auto-assign to them
  - Show confirmation or toast on successful pickup
  - Handle 409 conflict gracefully (conversation already taken)
  - _Requirements: 2.3_

- [x] 10.4 Add transfer conversation dialog
  - Show list of agents in same inbox
  - Display agent availability status
  - Show warning for offline agents
  - _Requirements: 5.1, 5.4_

- [x] 10.5 Add release conversation button
  - Add "Liberar conversa" button in conversation actions
  - Show confirmation dialog before release
  - _Requirements: 6.1_

## 11. Inbox Configuration UI

- [x] 11.1 Add auto-assignment settings to inbox configuration
  - Add toggle for enable/disable auto-assignment
  - Add input for max conversations per agent
  - _Requirements: 7.1, 7.3_

## 12. Final Checkpoint

- [x] 12. Final Checkpoint - Make sure all tests are passing
  - Ensure all tests pass, ask the user if questions arise.
