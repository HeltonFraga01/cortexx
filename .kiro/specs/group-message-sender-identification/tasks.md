# Implementation Plan

- [x] 1. Database migration for participant fields
  - [x] 1.1 Create migration file `034_add_participant_fields.js`
    - Add `participant_jid TEXT` column to `chat_messages` table
    - Add `participant_name TEXT` column to `chat_messages` table
    - Create index on `participant_jid` for query performance
    - _Requirements: 3.2_

- [x] 2. Backend: Extract participant from webhook
  - [x] 2.1 Modify `ChatMessageHandler.handleMessageEvent()` to extract participant data
    - Detect group messages by checking if Chat JID ends in `@g.us`
    - Extract `Participant` field from `messageInfo`
    - Extract `PushName` from participant when available
    - _Requirements: 1.1, 3.1_
  - [ ]* 2.2 Write property test for participant extraction
    - **Property 1: Participant extraction from group messages**
    - **Validates: Requirements 1.1, 3.1, 3.2**
  - [x] 2.3 Create `formatParticipantDisplay()` utility function
    - If PushName exists, use it
    - Otherwise, extract phone from JID and format as readable number
    - Handle edge case of missing participant with "Participante desconhecido"
    - _Requirements: 1.3, 1.4, 1.5, 3.4_
  - [ ]* 2.4 Write property test for participant display name resolution
    - **Property 2: Participant display name resolution**
    - **Validates: Requirements 1.2, 1.3, 1.4, 3.3, 3.4**

- [x] 3. Backend: Store and retrieve participant data
  - [x] 3.1 Modify `ChatService.storeIncomingMessage()` to accept participant data
    - Add `participantJid` and `participantName` parameters
    - Insert values into new database columns
    - _Requirements: 3.2, 3.3_
  - [x] 3.2 Modify `ChatService.getMessages()` to return participant data
    - Include `participant_jid` and `participant_name` in SELECT query
    - Map to camelCase in response object
    - _Requirements: 3.5_
  - [ ]* 3.3 Write property test for participant data round-trip
    - **Property 3: Participant data round-trip**
    - **Validates: Requirements 3.2, 3.3, 3.5**

- [x] 4. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Frontend: Update types and API
  - [x] 5.1 Update `src/types/chat.ts` with participant fields
    - Add `participantJid?: string` to ChatMessage interface
    - Add `participantName?: string` to ChatMessage interface
    - Add `isGroupMessage?: boolean` helper field
    - _Requirements: 3.5_

- [x] 6. Frontend: Display participant in messages
  - [x] 6.1 Modify `MessageBubble` component to show participant name
    - Display participant name above message content for group messages
    - Style participant name with distinct color/weight
    - Only show for incoming messages in groups
    - _Requirements: 1.2, 2.1_
  - [x] 6.2 Implement message grouping by participant
    - Group consecutive messages from same participant
    - Show participant name only on first message of group
    - Add visual separator when participant changes
    - _Requirements: 2.2, 2.3_
  - [ ]* 6.3 Write property test for message grouping logic
    - **Property 4: Message grouping by sender**
    - **Validates: Requirements 2.2, 2.3**

- [x] 7. Handle all message types
  - [x] 7.1 Ensure participant data flows through all message types
    - Verify text, audio, image, video, document messages include participant
    - Update any type-specific rendering to show participant
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [ ]* 7.2 Write property test for sender identification across message types
    - **Property 5: Sender identification across message types**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [x] 8. Handle reply messages
  - [x] 8.1 Display original message sender in quoted replies
    - When rendering quoted message, show original sender name
    - Ensure reply sender is also displayed
    - _Requirements: 4.6_
  - [ ]* 8.2 Write property test for reply message sender attribution
    - **Property 6: Reply message sender attribution**
    - **Validates: Requirements 4.6**

- [x] 9. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
