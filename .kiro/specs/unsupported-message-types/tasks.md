# Implementation Plan

- [x] 1. Add database schema support for new message fields
  - [x] 1.1 Create migration to add is_edited, is_deleted, poll_data, and interactive_data columns to chat_messages table
    - Add is_edited BOOLEAN DEFAULT 0
    - Add is_deleted BOOLEAN DEFAULT 0
    - Add poll_data TEXT for JSON storage
    - Add interactive_data TEXT for JSON storage
    - _Requirements: 2.2, 3.2, 4.1, 6.1_

- [x] 2. Implement system message filtering in backend
  - [x] 2.1 Add shouldIgnoreMessage helper function to chatMessageHandler.js
    - Check for senderKeyDistributionMessage
    - Check for messageContextInfo-only messages
    - Return true for messages that should be silently ignored
    - _Requirements: 1.1, 1.2_
  - [ ]* 2.2 Write property test for system message filtering
    - **Property 1: System messages are silently ignored**
    - **Validates: Requirements 1.1, 1.2**

- [x] 3. Implement protocol message handling (edit/delete)
  - [x] 3.1 Add handleProtocolMessage function to chatMessageHandler.js
    - Parse protocolMessage type (0 = REVOKE, 14 = MESSAGE_EDIT)
    - Extract target message ID from key
    - For edits: extract new content from editedMessage
    - For deletes: return delete action
    - _Requirements: 2.1, 3.1_
  - [x] 3.2 Implement message edit logic in ChatService.js
    - Find original message by ID
    - Update content and set is_edited = true
    - Handle case when original not found
    - _Requirements: 2.1, 2.2, 2.4_
  - [x] 3.3 Implement message delete logic in ChatService.js
    - Find original message by ID
    - Set is_deleted = true and update content to placeholder
    - Handle case when original not found
    - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 3.4 Write property test for edit message handling
    - **Property 2: Edit messages update original content**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [ ]* 3.5 Write property test for delete message handling
    - **Property 3: Delete messages mark original as deleted**
    - **Validates: Requirements 3.1, 3.2**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement poll message parsing
  - [x] 5.1 Add parsePollMessage function to chatMessageHandler.js
    - Extract question from pollCreationMessage.name
    - Extract options from pollCreationMessage.options array
    - Handle pollUpdateMessage as vote notification
    - Return type 'poll' with pollData object
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ]* 5.2 Write property test for poll message parsing
    - **Property 4: Poll messages are parsed correctly**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [x] 6. Implement view-once message parsing
  - [x] 6.1 Add parseViewOnceMessage function to chatMessageHandler.js
    - Detect viewOnceMessage and viewOnceMessageV2 wrappers
    - Extract inner message type (image or video)
    - Return type 'view_once' with media type indicator
    - _Requirements: 5.1, 5.2_
  - [ ]* 6.2 Write property test for view-once message parsing
    - **Property 5: View-once messages are identified**
    - **Validates: Requirements 5.1, 5.2**

- [x] 7. Implement interactive message parsing (buttons/lists)
  - [x] 7.1 Add parseInteractiveMessage function to chatMessageHandler.js
    - Parse buttonsMessage: extract text and button labels
    - Parse buttonsResponseMessage: extract selected button
    - Parse listMessage: extract text and section/row data
    - Parse listResponseMessage: extract selected item
    - Return type 'interactive' with interactiveData object
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 7.2 Write property test for interactive message parsing
    - **Property 6: Interactive messages are parsed correctly**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**

- [x] 8. Implement template message parsing
  - [x] 8.1 Add parseTemplateMessage function to chatMessageHandler.js
    - Extract hydratedFourRowTemplate content (title, body, footer)
    - Extract button labels if present
    - Return type 'template' with formatted content
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 8.2 Write property test for template message parsing
    - **Property 7: Template messages are parsed correctly**
    - **Validates: Requirements 7.1, 7.2, 7.3**

- [x] 9. Implement encrypted comment handling
  - [x] 9.1 Add parseEncCommentMessage function to chatMessageHandler.js
    - Detect encCommentMessage type
    - Return type 'channel_comment' with placeholder content
    - Ensure no errors are thrown
    - _Requirements: 8.1, 8.2_
  - [ ]* 9.2 Write property test for encrypted comment handling
    - **Property 8: Encrypted comments return placeholder**
    - **Validates: Requirements 8.1, 8.2**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update parseMessageContent to integrate all parsers
  - [x] 11.1 Refactor parseMessageContent in chatMessageHandler.js
    - Add shouldIgnoreMessage check at the beginning
    - Add protocol message handling before other types
    - Integrate poll, view-once, interactive, template, and encComment parsers
    - Update fallback to return type name instead of generic message
    - _Requirements: 1.1, 1.2, 9.3_
  - [ ]* 11.2 Write property test for unknown type fallback
    - **Property 9: Unknown types return identifiable fallback**
    - **Validates: Requirements 9.3**

- [x] 12. Update frontend MessageBubble component
  - [x] 12.1 Add new message type cases to MessageContent component
    - Add 'poll' case with PollContent component
    - Add 'view_once' case with ViewOnceIndicator component
    - Add 'interactive' case with InteractiveContent component
    - Add 'channel_comment' case with ChannelComment component
    - Add 'deleted' case with DeletedMessage component
    - Update default case to show type name
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  - [x] 12.2 Create PollContent component
    - Display poll icon (📊) before question
    - Render numbered list of options
    - _Requirements: 4.2, 10.3_
  - [x] 12.3 Create ViewOnceIndicator component
    - Display timer icon (⏱️)
    - Show appropriate text based on media type
    - _Requirements: 5.2, 10.4_
  - [x] 12.4 Create InteractiveContent component
    - Display interactive icon (🔘)
    - Show message text and button/list labels
    - _Requirements: 6.1, 6.3, 10.5_
  - [x] 12.5 Create DeletedMessage component
    - Display "🚫 Esta mensagem foi apagada"
    - Apply italic style with reduced opacity
    - _Requirements: 3.2, 10.2_
  - [x] 12.6 Add edit indicator to message footer
    - Show pencil icon (✏️) when message.isEdited is true
    - Display "(editada)" text next to timestamp
    - _Requirements: 2.2, 10.1_

- [x] 13. Update ChatMessage type definitions
  - [x] 13.1 Update chat.ts types to include new fields
    - Add isEdited?: boolean
    - Add isDeleted?: boolean
    - Add pollData?: PollData interface
    - Add interactiveData?: InteractiveData interface
    - Extend MessageType union with new types
    - _Requirements: 2.2, 3.2, 4.1, 6.1_

- [x] 14. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

