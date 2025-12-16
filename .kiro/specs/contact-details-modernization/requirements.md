# Requirements Document

## Introduction

Este documento especifica os requisitos para modernização do painel de Detalhes do Contato no WUZAPI Manager. O objetivo é aprimorar a experiência do usuário inspirando-se nas melhores práticas do Chatwoot, adicionando funcionalidades como atributos customizados, notas do contato, histórico de conversas anteriores, informações da conversa atual, macros/ações rápidas e participantes da conversa (para grupos).

A modernização visa criar um painel de contato mais completo e funcional, permitindo que os usuários tenham uma visão 360° do contato e da conversa, facilitando o atendimento e a gestão de relacionamentos.

## Glossary

- **Contact_Panel**: Componente lateral que exibe informações detalhadas sobre o contato selecionado na conversa
- **Contact_Attributes**: Campos customizáveis definidos pelo usuário para armazenar informações adicionais sobre contatos (ex: empresa, cargo, preferências)
- **Contact_Notes**: Anotações textuais associadas a um contato específico, visíveis apenas para a equipe
- **Conversation_Info**: Metadados da conversa atual incluindo data de criação, última atividade, duração e estatísticas
- **Previous_Conversations**: Histórico de conversas anteriores com o mesmo contato
- **Macros**: Ações automatizadas pré-configuradas que podem ser executadas com um clique (ex: marcar como resolvido + enviar mensagem de encerramento)
- **Conversation_Participants**: Lista de participantes em conversas de grupo, incluindo seus papéis (admin, membro)
- **WUZAPI**: API WhatsApp Business utilizada para comunicação
- **Collapsible_Section**: Seção expansível/retrátil do painel que pode ser aberta ou fechada pelo usuário

## Requirements

### Requirement 1

**User Story:** As a support agent, I want to view and manage custom contact attributes, so that I can store and access relevant information about each contact.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Atributos do contato" section
2. WHEN a user clicks to expand the attributes section THEN the system SHALL display all custom attributes defined for that contact
3. WHEN a user clicks the add button in the attributes section THEN the system SHALL display a form to add a new attribute with name and value fields
4. WHEN a user submits a new attribute with valid name and value THEN the system SHALL persist the attribute and display it in the list
5. WHEN a user edits an existing attribute value THEN the system SHALL update the value and persist the change immediately
6. WHEN a user deletes an attribute THEN the system SHALL remove it from the contact after confirmation

### Requirement 2

**User Story:** As a support agent, I want to add and view notes about a contact, so that I can keep track of important information and context for future interactions.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Notas do contato" section
2. WHEN a user expands the notes section THEN the system SHALL display all notes for that contact in reverse chronological order
3. WHEN a user clicks the add note button THEN the system SHALL display a text input field for the new note
4. WHEN a user submits a note with non-empty content THEN the system SHALL persist the note with timestamp and display it in the list
5. WHEN a user attempts to submit an empty note THEN the system SHALL prevent submission and maintain the current state
6. WHEN a user deletes a note THEN the system SHALL remove it after confirmation

### Requirement 3

**User Story:** As a support agent, I want to view conversation metadata and statistics, so that I can understand the context and history of the current interaction.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Informação da conversa" section
2. WHEN a user expands the conversation info section THEN the system SHALL display: creation date, last activity date, total message count, and conversation duration
3. WHEN the conversation has an assigned bot THEN the system SHALL display the bot assignment timestamp
4. WHEN the conversation has labels THEN the system SHALL display when each label was assigned
5. WHEN conversation metadata changes THEN the system SHALL update the displayed information within 5 seconds

### Requirement 4

**User Story:** As a support agent, I want to view previous conversations with the same contact, so that I can understand the full history of interactions.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Conversas anteriores" section
2. WHEN a user expands the previous conversations section THEN the system SHALL display a list of past conversations with the same contact JID
3. WHEN displaying previous conversations THEN the system SHALL show: date, status, message count, and preview of last message for each
4. WHEN a user clicks on a previous conversation THEN the system SHALL navigate to that conversation in the chat view
5. WHEN there are no previous conversations THEN the system SHALL display a message indicating no history exists

### Requirement 5

**User Story:** As a support agent, I want to execute quick actions and macros, so that I can perform common tasks efficiently.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Ações da conversa" section with quick action buttons
2. WHEN a user clicks "Abrir no WhatsApp Web" THEN the system SHALL open the WhatsApp Web URL for that contact in a new tab
3. WHEN a user clicks "Marcar como resolvida" THEN the system SHALL update the conversation status to resolved
4. WHEN a user clicks "Enviar para bot" THEN the system SHALL display a bot selection dialog and assign the selected bot
5. WHEN a user opens the Contact_Panel THEN the system SHALL display a collapsible "Macros" section
6. WHEN a user clicks on a macro THEN the system SHALL execute all actions defined in that macro sequentially

### Requirement 6

**User Story:** As a support agent, I want to view group conversation participants, so that I can understand who is involved in group chats.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel for a group conversation THEN the system SHALL display a collapsible "Participantes da conversa" section
2. WHEN a user expands the participants section THEN the system SHALL display all group members with their names and roles
3. WHEN displaying participants THEN the system SHALL indicate admin status with a badge
4. WHEN a participant has a profile picture THEN the system SHALL display their avatar
5. WHEN the conversation is not a group THEN the system SHALL hide the participants section

### Requirement 7

**User Story:** As a support agent, I want the contact panel to have a modern collapsible design, so that I can focus on relevant information and reduce visual clutter.

#### Acceptance Criteria

1. WHEN a user views the Contact_Panel THEN the system SHALL display all sections as collapsible accordions
2. WHEN a user clicks on a section header THEN the system SHALL toggle the expanded/collapsed state of that section
3. WHEN a section is collapsed THEN the system SHALL display only the section title and a count indicator where applicable
4. WHEN the user closes and reopens the Contact_Panel THEN the system SHALL restore the previous expanded/collapsed state of each section
5. WHEN the panel loads THEN the system SHALL expand only the most relevant sections by default (Status, Etiquetas, Bot atribuído)

### Requirement 8

**User Story:** As a support agent, I want to see enhanced contact information, so that I can quickly identify and understand who I'm communicating with.

#### Acceptance Criteria

1. WHEN a user opens the Contact_Panel THEN the system SHALL display the contact's profile picture with a refresh button
2. WHEN a user clicks the refresh avatar button THEN the system SHALL fetch the latest profile picture from WUZAPI
3. WHEN displaying the contact THEN the system SHALL show: name, phone number with copy button, and WhatsApp JID
4. WHEN the contact has a verified business name THEN the system SHALL display a verified badge
5. WHEN the contact has a status message THEN the system SHALL display it below the contact name
