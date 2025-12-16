# Requirements Document

## Introduction

Este documento define os requisitos para a implementação de uma interface de chat profissional no WUZAPI Manager, inspirada no Chatwoot. A interface permitirá que usuários visualizem, gerenciem e respondam conversas do WhatsApp em tempo real, com recursos avançados como envio de mídia, indicadores de presença, reações e organização de conversas.

## Glossary

- **Chat_Interface**: Sistema de interface de usuário para visualização e gerenciamento de conversas WhatsApp
- **Conversation**: Uma thread de mensagens entre o usuário e um contato específico do WhatsApp
- **Contact**: Pessoa ou entidade com quem o usuário está conversando via WhatsApp
- **Message**: Unidade de comunicação enviada ou recebida (texto, mídia, documento, etc.)
- **Inbox**: Lista de todas as conversas ativas do usuário
- **Message_Bubble**: Componente visual que exibe uma mensagem individual
- **Presence_Indicator**: Indicador visual de status (digitando, gravando áudio, online)
- **Read_Receipt**: Confirmação de leitura de mensagem (ticks azuis)
- **Media_Message**: Mensagem contendo arquivo de mídia (imagem, vídeo, áudio, documento)
- **Contact_Panel**: Painel lateral com informações detalhadas do contato
- **Message_Input**: Área de composição de mensagens com suporte a múltiplos tipos de conteúdo
- **Webhook_Event**: Evento recebido via webhook da WUZAPI (mensagens, status, presença)

## Requirements

### Requirement 1

**User Story:** As a user, I want to view all my WhatsApp conversations in a unified inbox, so that I can easily manage and respond to messages.

#### Acceptance Criteria

1. WHEN the user accesses the chat interface THEN the Chat_Interface SHALL display a list of all Conversations ordered by most recent activity
2. WHEN a new Message is received via Webhook_Event THEN the Chat_Interface SHALL update the Inbox list and move the Conversation to the top
3. WHEN displaying a Conversation in the Inbox THEN the Chat_Interface SHALL show the Contact name, avatar, last message preview, timestamp, and unread count
4. WHEN the user clicks on a Conversation THEN the Chat_Interface SHALL display the full message history in the main chat area
5. WHEN the Inbox contains more than 20 Conversations THEN the Chat_Interface SHALL implement pagination or infinite scroll

### Requirement 2

**User Story:** As a user, I want to send text messages to my contacts, so that I can communicate effectively through the platform.

#### Acceptance Criteria

1. WHEN the user types a message and presses Enter or clicks send THEN the Chat_Interface SHALL send the Message via WUZAPI and display it in the conversation
2. WHEN a Message is being sent THEN the Chat_Interface SHALL display a pending status indicator until confirmation is received
3. WHEN the WUZAPI confirms message delivery THEN the Chat_Interface SHALL update the Message status to sent (single tick)
4. WHEN the user attempts to send an empty message THEN the Chat_Interface SHALL prevent the action and maintain the current state
5. WHEN the user types a message THEN the Chat_Interface SHALL send a presence indicator (composing) to the Contact via WUZAPI

### Requirement 3

**User Story:** As a user, I want to send and receive media messages (images, videos, audio, documents), so that I can share rich content with my contacts.

#### Acceptance Criteria

1. WHEN the user selects an image file THEN the Chat_Interface SHALL display a preview and send the image via WUZAPI with optional caption
2. WHEN the user selects a video file THEN the Chat_Interface SHALL display a preview and send the video via WUZAPI with optional caption
3. WHEN the user records or selects an audio file THEN the Chat_Interface SHALL send the audio via WUZAPI in Opus format
4. WHEN the user selects a document file THEN the Chat_Interface SHALL send the document via WUZAPI with the original filename
5. WHEN a Media_Message is received THEN the Chat_Interface SHALL download and display the media content with appropriate preview
6. WHEN displaying an image or video THEN the Chat_Interface SHALL provide a lightbox view for full-screen viewing

### Requirement 4

**User Story:** As a user, I want to see real-time status updates for my messages, so that I know when messages are delivered and read.

#### Acceptance Criteria

1. WHEN a Message is sent THEN the Chat_Interface SHALL display a single grey tick (sent)
2. WHEN a Read_Receipt event is received for a Message THEN the Chat_Interface SHALL update the status to double blue ticks (read)
3. WHEN displaying message timestamps THEN the Chat_Interface SHALL show relative time for recent messages and full date for older ones
4. WHEN the Contact is typing THEN the Chat_Interface SHALL display a Presence_Indicator showing "typing..." in the conversation header
5. WHEN the Contact is recording audio THEN the Chat_Interface SHALL display a Presence_Indicator showing "recording audio..."

### Requirement 5

**User Story:** As a user, I want to react to messages with emojis, so that I can express quick responses without typing.

#### Acceptance Criteria

1. WHEN the user hovers over a Message_Bubble THEN the Chat_Interface SHALL display a reaction button
2. WHEN the user clicks the reaction button THEN the Chat_Interface SHALL display an emoji picker
3. WHEN the user selects an emoji THEN the Chat_Interface SHALL send the reaction via WUZAPI and display it on the Message_Bubble
4. WHEN a reaction is received via Webhook_Event THEN the Chat_Interface SHALL display the reaction on the corresponding Message_Bubble

### Requirement 6

**User Story:** As a user, I want to view detailed information about my contacts, so that I can have context during conversations.

#### Acceptance Criteria

1. WHEN the user clicks on a Contact name or avatar THEN the Chat_Interface SHALL display the Contact_Panel with detailed information
2. WHEN displaying the Contact_Panel THEN the Chat_Interface SHALL show the Contact avatar, name, phone number, and WhatsApp status
3. WHEN the Contact has a profile picture THEN the Chat_Interface SHALL fetch and display the avatar via WUZAPI user/avatar endpoint
4. WHEN the user clicks on the Contact phone number THEN the Chat_Interface SHALL copy it to clipboard

### Requirement 7

**User Story:** As a user, I want to search through my conversations and messages, so that I can quickly find specific information.

#### Acceptance Criteria

1. WHEN the user types in the search field THEN the Chat_Interface SHALL filter Conversations by Contact name or phone number
2. WHEN the user searches within a Conversation THEN the Chat_Interface SHALL highlight matching messages and allow navigation between results
3. WHEN no results are found THEN the Chat_Interface SHALL display an appropriate empty state message

### Requirement 8

**User Story:** As a user, I want to mark messages as read, so that I can manage my conversation status.

#### Acceptance Criteria

1. WHEN the user opens a Conversation THEN the Chat_Interface SHALL automatically mark visible messages as read via WUZAPI
2. WHEN messages are marked as read THEN the Chat_Interface SHALL update the unread count in the Inbox
3. WHEN the user scrolls through a Conversation THEN the Chat_Interface SHALL mark newly visible messages as read

### Requirement 9

**User Story:** As a user, I want to send location and contact cards, so that I can share useful information with my contacts.

#### Acceptance Criteria

1. WHEN the user clicks the location button THEN the Chat_Interface SHALL allow selecting a location and send it via WUZAPI
2. WHEN the user clicks the contact button THEN the Chat_Interface SHALL allow selecting a contact and send the vCard via WUZAPI
3. WHEN a location message is received THEN the Chat_Interface SHALL display a map preview with the location
4. WHEN a contact card is received THEN the Chat_Interface SHALL display the contact information with an option to save

### Requirement 10

**User Story:** As a user, I want the chat interface to be responsive and work on mobile devices, so that I can manage conversations from any device.

#### Acceptance Criteria

1. WHEN the viewport width is less than 768px THEN the Chat_Interface SHALL display a mobile-optimized layout with collapsible sidebar
2. WHEN on mobile THEN the Chat_Interface SHALL use touch-friendly controls and gestures
3. WHEN switching between Inbox and Conversation on mobile THEN the Chat_Interface SHALL use smooth transitions

### Requirement 11

**User Story:** As a user, I want to receive real-time updates via webhooks, so that my chat interface stays synchronized with WhatsApp.

#### Acceptance Criteria

1. WHEN a Message Webhook_Event is received THEN the Chat_Interface SHALL immediately display the new message in the appropriate Conversation
2. WHEN a ReadReceipt Webhook_Event is received THEN the Chat_Interface SHALL update the message status indicators
3. WHEN a ChatPresence Webhook_Event is received THEN the Chat_Interface SHALL update the Presence_Indicator for the Contact
4. WHEN the webhook connection is lost THEN the Chat_Interface SHALL display a connection status warning and attempt reconnection

### Requirement 12

**User Story:** As a user, I want to reply to specific messages, so that I can maintain context in conversations.

#### Acceptance Criteria

1. WHEN the user swipes right on a Message_Bubble or clicks reply THEN the Chat_Interface SHALL enter reply mode with the original message quoted
2. WHEN in reply mode THEN the Message_Input SHALL display a preview of the message being replied to
3. WHEN sending a reply THEN the Chat_Interface SHALL include the ContextInfo with StanzaId and Participant in the WUZAPI request
4. WHEN displaying a reply message THEN the Chat_Interface SHALL show the quoted original message above the reply

### Requirement 13

**User Story:** As a user, I want to persist my conversations locally, so that I can access message history even when offline.

#### Acceptance Criteria

1. WHEN messages are received or sent THEN the Chat_Interface SHALL store them in the local database
2. WHEN the user opens a Conversation THEN the Chat_Interface SHALL load messages from local storage first, then sync with server
3. WHEN the user is offline THEN the Chat_Interface SHALL display cached messages and queue outgoing messages for later delivery
4. WHEN connection is restored THEN the Chat_Interface SHALL sync queued messages and fetch any missed messages

### Requirement 14

**User Story:** As a user, I want keyboard shortcuts for common actions, so that I can work more efficiently.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+K or Cmd+K THEN the Chat_Interface SHALL open the search dialog
2. WHEN the user presses Escape THEN the Chat_Interface SHALL close any open modal or panel
3. WHEN the user presses Ctrl+Enter or Cmd+Enter THEN the Chat_Interface SHALL send the current message
4. WHEN the user presses Up Arrow in empty input THEN the Chat_Interface SHALL load the last sent message for editing

### Requirement 15

**User Story:** As a user, I want to see typing indicators and online status, so that I know when contacts are active.

#### Acceptance Criteria

1. WHEN the Contact is online THEN the Chat_Interface SHALL display a green dot indicator next to their avatar
2. WHEN the Contact was recently active THEN the Chat_Interface SHALL display "last seen" timestamp
3. WHEN the user starts typing THEN the Chat_Interface SHALL send a composing presence to the Contact via WUZAPI
4. WHEN the user stops typing for 5 seconds THEN the Chat_Interface SHALL send a paused presence to the Contact via WUZAPI

### Requirement 16

**User Story:** As a user, I want to configure outgoing webhooks from WUZAPI Manager, so that I can integrate external automation systems with my conversations.

#### Acceptance Criteria

1. WHEN the user accesses webhook settings THEN the Chat_Interface SHALL display a form to configure outgoing webhook URL
2. WHEN the user saves a webhook configuration THEN the Chat_Interface SHALL validate the URL format and store it in the database
3. WHEN a Message is received THEN the Chat_Interface SHALL forward the event to the configured outgoing webhook URL
4. WHEN a Message is sent THEN the Chat_Interface SHALL forward the event to the configured outgoing webhook URL
5. WHEN the webhook delivery fails THEN the Chat_Interface SHALL retry up to 3 times with exponential backoff
6. WHEN displaying webhook settings THEN the Chat_Interface SHALL show delivery statistics (success/failure count, last delivery time)

### Requirement 17

**User Story:** As a user, I want to create and manage Agent Bots, so that I can automate responses and handle common queries automatically.

#### Acceptance Criteria

1. WHEN the user accesses the Agent Bots settings THEN the Chat_Interface SHALL display a list of configured bots with their status
2. WHEN the user clicks "Create Bot" THEN the Chat_Interface SHALL display a form with fields for name, description, avatar, and outgoing webhook URL
3. WHEN the user saves a new Agent_Bot THEN the Chat_Interface SHALL store the bot configuration and generate an access token
4. WHEN an Agent_Bot is active and a Message is received THEN the Chat_Interface SHALL forward the message to the bot's outgoing webhook URL
5. WHEN the Agent_Bot webhook responds with a message THEN the Chat_Interface SHALL send that message to the Contact via WUZAPI
6. WHEN displaying an Agent_Bot THEN the Chat_Interface SHALL show name, description, avatar, status (active/paused), and webhook URL

### Requirement 18

**User Story:** As a user, I want to pause and resume Agent Bots, so that I can temporarily disable automation when needed.

#### Acceptance Criteria

1. WHEN the user clicks the pause button on an Agent_Bot THEN the Chat_Interface SHALL set the bot status to paused and stop forwarding messages
2. WHEN an Agent_Bot is paused THEN the Chat_Interface SHALL display a visual indicator (grey badge) showing the paused state
3. WHEN the user clicks the resume button on a paused Agent_Bot THEN the Chat_Interface SHALL set the bot status to active and resume message forwarding
4. WHEN an Agent_Bot is paused THEN the Chat_Interface SHALL NOT forward incoming messages to the bot's webhook
5. WHEN the user pauses a bot during an active conversation THEN the Chat_Interface SHALL allow manual takeover of the conversation

### Requirement 19

**User Story:** As a user, I want to assign Agent Bots to specific conversations, so that I can control which conversations are automated.

#### Acceptance Criteria

1. WHEN the user opens a Conversation THEN the Chat_Interface SHALL display an option to assign an Agent_Bot
2. WHEN an Agent_Bot is assigned to a Conversation THEN the Chat_Interface SHALL forward all messages in that conversation to the bot
3. WHEN the user removes an Agent_Bot from a Conversation THEN the Chat_Interface SHALL stop forwarding messages and allow manual responses
4. WHEN an Agent_Bot is assigned THEN the Chat_Interface SHALL display the bot's avatar and name in the conversation header

### Requirement 20

**User Story:** As a user, I want to use labels and tags to organize my conversations, so that I can categorize and filter them efficiently.

#### Acceptance Criteria

1. WHEN the user opens a Conversation THEN the Chat_Interface SHALL display an option to add labels
2. WHEN the user adds a label to a Conversation THEN the Chat_Interface SHALL store the label and display it as a colored badge
3. WHEN the user filters by label THEN the Chat_Interface SHALL display only Conversations with the selected label
4. WHEN the user creates a new label THEN the Chat_Interface SHALL allow setting a name and color
5. WHEN displaying the Inbox THEN the Chat_Interface SHALL show label badges on each Conversation

### Requirement 21

**User Story:** As a user, I want to use canned responses, so that I can quickly reply to frequently asked questions.

#### Acceptance Criteria

1. WHEN the user types "/" in the Message_Input THEN the Chat_Interface SHALL display a list of available canned responses
2. WHEN the user selects a canned response THEN the Chat_Interface SHALL insert the response text into the Message_Input
3. WHEN the user accesses canned response settings THEN the Chat_Interface SHALL allow creating, editing, and deleting responses
4. WHEN creating a canned response THEN the Chat_Interface SHALL require a shortcut code and response text
5. WHEN the user types a shortcut code THEN the Chat_Interface SHALL suggest matching canned responses

### Requirement 22

**User Story:** As a user, I want to add private notes to conversations, so that I can keep internal information without sending it to the contact.

#### Acceptance Criteria

1. WHEN the user clicks the "Add Note" button THEN the Chat_Interface SHALL display a note input field
2. WHEN the user saves a private note THEN the Chat_Interface SHALL store it and display it with a distinct visual style (yellow background)
3. WHEN displaying private notes THEN the Chat_Interface SHALL NOT send them to the Contact
4. WHEN viewing conversation history THEN the Chat_Interface SHALL display private notes inline with messages but visually distinct
