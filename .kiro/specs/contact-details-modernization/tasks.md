# Implementation Plan

## 1. Database Schema and Migrations

- [x] 1.1 Create migration for contact_attributes table
  - Create `server/migrations/035_create_contact_attributes.js`
  - Define schema with id, user_id, contact_jid, name, value, timestamps
  - Add unique constraint on (user_id, contact_jid, name)
  - Add foreign key to users table
  - _Requirements: 1.1, 1.4_

- [x] 1.2 Create migration for contact_notes table
  - Create `server/migrations/036_create_contact_notes.js`
  - Define schema with id, user_id, contact_jid, content, created_at
  - Add foreign key to users table
  - Add index on (user_id, contact_jid)
  - _Requirements: 2.1, 2.4_

- [x] 1.3 Create migration for macros tables
  - Create `server/migrations/037_create_macros.js`
  - Define macros table with id, user_id, name, description, timestamps
  - Define macro_actions table with id, macro_id, action_type, params, action_order
  - Add foreign keys and indexes
  - _Requirements: 5.5, 5.6_

## 2. Backend API - Contact Attributes

- [x] 2.1 Create contact attributes routes
  - Create `server/routes/userContactAttributesRoutes.js`
  - Implement GET /chat/inbox/contacts/:jid/attributes
  - Implement POST /chat/inbox/contacts/:jid/attributes
  - Implement PUT /chat/inbox/contacts/:jid/attributes/:id
  - Implement DELETE /chat/inbox/contacts/:jid/attributes/:id
  - Add authentication middleware
  - _Requirements: 1.2, 1.4, 1.5, 1.6_

- [x] 2.2 Create contact attributes validator
  - Create `server/validators/contactAttributeValidator.js`
  - Validate name (non-empty, max 100 chars)
  - Validate value (non-empty, max 1000 chars)
  - _Requirements: 1.4_

- [ ]* 2.3 Write property test for attribute CRUD round-trip
  - **Property 1: Attribute CRUD round-trip**
  - **Validates: Requirements 1.4**

- [ ]* 2.4 Write property test for attribute update persistence
  - **Property 2: Attribute update persistence**
  - **Validates: Requirements 1.5**

- [ ]* 2.5 Write property test for attribute deletion
  - **Property 3: Attribute deletion removes from list**
  - **Validates: Requirements 1.6**

## 3. Backend API - Contact Notes

- [x] 3.1 Create contact notes routes
  - Create `server/routes/userContactNotesRoutes.js`
  - Implement GET /chat/inbox/contacts/:jid/notes
  - Implement POST /chat/inbox/contacts/:jid/notes
  - Implement DELETE /chat/inbox/contacts/:jid/notes/:id
  - Add authentication middleware
  - _Requirements: 2.2, 2.4, 2.6_

- [x] 3.2 Create contact notes validator
  - Create `server/validators/contactNoteValidator.js`
  - Validate content (non-empty after trim, max 5000 chars)
  - _Requirements: 2.4, 2.5_

- [ ]* 3.3 Write property test for notes chronological order
  - **Property 4: Notes display in reverse chronological order**
  - **Validates: Requirements 2.2**

- [ ]* 3.4 Write property test for note creation
  - **Property 5: Note creation with timestamp**
  - **Validates: Requirements 2.4**

- [ ]* 3.5 Write property test for empty note rejection
  - **Property 6: Empty note rejection**
  - **Validates: Requirements 2.5**

## 4. Backend API - Conversation Info and History

- [x] 4.1 Create conversation info routes
  - Add GET /chat/inbox/conversations/:id/info to existing routes
  - Return creation date, last activity, message count, duration
  - Include bot assignment timestamp if applicable
  - Include label assignment timestamps
  - _Requirements: 3.2, 3.3, 3.4_

- [x] 4.2 Create previous conversations route
  - Add GET /chat/inbox/contacts/:jid/conversations
  - Return list of conversations excluding current
  - Include status, message count, last message preview
  - Order by created_at descending
  - _Requirements: 4.2, 4.3_

- [ ]* 4.3 Write property test for conversation info fields
  - **Property 7: Conversation info contains required fields**
  - **Validates: Requirements 3.2**

- [ ]* 4.4 Write property test for previous conversations completeness
  - **Property 8: Previous conversations list completeness**
  - **Validates: Requirements 4.2**

## 5. Backend API - Group Participants

- [x] 5.1 Create participants route
  - Add GET /chat/inbox/conversations/:id/participants
  - Fetch group info from WUZAPI using wuzapiClient
  - Return participant list with names, avatars, admin status
  - Return empty array for non-group conversations
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

- [ ]* 5.2 Write property test for group participants visibility
  - **Property 11: Group participants visibility**
  - **Validates: Requirements 6.1, 6.5**

- [ ]* 5.3 Write property test for admin badge display
  - **Property 12: Admin badge display**
  - **Validates: Requirements 6.3**

## 6. Backend API - Macros

- [x] 6.1 Create macros routes
  - Create `server/routes/userMacrosRoutes.js`
  - Implement GET /chat/inbox/macros
  - Implement POST /chat/inbox/macros/:id/execute
  - Execute actions sequentially (change_status, assign_bot, add_label, send_message)
  - _Requirements: 5.5, 5.6_

- [ ]* 6.2 Write property test for macro sequential execution
  - **Property 10: Macro sequential execution**
  - **Validates: Requirements 5.6**

## 7. Checkpoint - Backend Tests

- [x] 7. Checkpoint - Make sure all backend tests pass
  - Migrations executed successfully (035, 036, 037)
  - All backend routes implemented in chatInboxRoutes.js
  - TypeScript types and services implemented

## 8. Frontend Types and Services

- [x] 8.1 Create contact panel types
  - Add types to `src/types/chat.ts`
  - ContactAttribute, ContactNote, ConversationInfo
  - PreviousConversation, GroupParticipant, Macro, MacroAction
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.5, 6.1_

- [x] 8.2 Create contact panel service functions
  - Add functions to `src/services/chat.ts`
  - getContactAttributes, createContactAttribute, updateContactAttribute, deleteContactAttribute
  - getContactNotes, createContactNote, deleteContactNote
  - getConversationInfo, getPreviousConversations
  - getGroupParticipants, getMacros, executeMacro
  - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.1, 6.2_

## 9. Frontend Components - Collapsible Section

- [x] 9.1 Create CollapsibleSection component
  - Create `src/components/features/chat/CollapsibleSection.tsx`
  - Implement accordion behavior with shadcn/ui Collapsible
  - Support title, icon, count badge, defaultExpanded props
  - Persist state to localStorage
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]* 9.2 Write property test for collapsible state toggle
  - **Property 13: Collapsible state toggle**
  - **Validates: Requirements 7.2**

- [ ]* 9.3 Write property test for collapsible state persistence
  - **Property 14: Collapsible state persistence**
  - **Validates: Requirements 7.4**

## 10. Frontend Components - Contact Attributes Section

- [x] 10.1 Create ContactAttributesSection component
  - Create `src/components/features/chat/ContactAttributesSection.tsx`
  - Display list of attributes with name/value pairs
  - Add form for creating new attributes
  - Inline editing for attribute values
  - Delete with confirmation dialog
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

## 11. Frontend Components - Contact Notes Section

- [x] 11.1 Create ContactNotesSection component
  - Create `src/components/features/chat/ContactNotesSection.tsx`
  - Display notes in reverse chronological order
  - Add textarea for new notes
  - Show timestamp for each note
  - Delete with confirmation dialog
  - _Requirements: 2.2, 2.3, 2.4, 2.6_

## 12. Frontend Components - Conversation Info Section

- [x] 12.1 Create ConversationInfoSection component
  - Create `src/components/features/chat/ConversationInfoSection.tsx`
  - Display creation date, last activity, message count, duration
  - Show bot assignment timestamp if applicable
  - Show label assignment timestamps
  - _Requirements: 3.2, 3.3, 3.4_

## 13. Frontend Components - Previous Conversations Section

- [x] 13.1 Create PreviousConversationsSection component
  - Create `src/components/features/chat/PreviousConversationsSection.tsx`
  - Display list of previous conversations
  - Show date, status badge, message count, preview
  - Click to navigate to conversation
  - Empty state message when no history
  - _Requirements: 4.2, 4.3, 4.4, 4.5_

## 14. Frontend Components - Participants Section

- [x] 14.1 Create ParticipantsSection component
  - Create `src/components/features/chat/ParticipantsSection.tsx`
  - Display participant list with avatars
  - Show admin badge for admins
  - Only render for group conversations
  - _Requirements: 6.2, 6.3, 6.4, 6.5_

## 15. Frontend Components - Actions and Macros Sections

- [x] 15.1 Create ConversationActionsSection component
  - Create `src/components/features/chat/ConversationActionsSection.tsx`
  - "Abrir no WhatsApp Web" button with correct URL generation
  - "Marcar como resolvida" button
  - "Enviar para bot" button with bot selection dialog
  - _Requirements: 5.2, 5.3, 5.4_

- [ ]* 15.2 Write property test for WhatsApp Web URL generation
  - **Property 9: WhatsApp Web URL generation**
  - **Validates: Requirements 5.2**

- [x] 15.3 Create MacrosSection component
  - Create `src/components/features/chat/MacrosSection.tsx`
  - Display list of available macros
  - Execute macro on click
  - Show loading state during execution
  - _Requirements: 5.5, 5.6_

## 16. Frontend Components - Contact Header Enhancement

- [x] 16.1 Enhance ContactHeader in ContactPanel
  - Update `src/components/features/chat/ContactPanel.tsx`
  - Add verified badge for business accounts
  - Display status message if available
  - Improve avatar refresh UX
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ]* 16.2 Write property test for contact info display
  - **Property 15: Contact info display completeness**
  - **Validates: Requirements 8.3**

- [ ]* 16.3 Write property test for verified badge display
  - **Property 16: Verified badge conditional display**
  - **Validates: Requirements 8.4**

## 17. Integration - Refactor ContactPanel

- [x] 17.1 Refactor ContactPanel to use new sections
  - Update `src/components/features/chat/ContactPanel.tsx`
  - Replace existing sections with CollapsibleSection wrapper
  - Add new sections (Attributes, Notes, Info, Previous, Participants, Actions, Macros)
  - Set default expanded sections (Status, Labels, Bot)
  - _Requirements: 7.1, 7.5_

- [x] 17.2 Add data fetching hooks
  - Create custom hooks for each data type
  - useContactAttributes, useContactNotes
  - useConversationInfo, usePreviousConversations
  - useGroupParticipants, useMacros
  - _Requirements: 1.2, 2.2, 3.2, 4.2, 5.5, 6.2_

## 18. Final Checkpoint

- [x] 18. Final Checkpoint - Make sure all tests pass
  - All TypeScript files have no diagnostics errors
  - Migrations executed successfully
  - Backend routes implemented and tested
  - Frontend components implemented with proper types
