# Requirements Document

## Introduction

Integração profunda entre o sistema CRM de contatos e o sistema de Chat. O objetivo é trazer para a página de detalhes do contato no CRM as mesmas funcionalidades disponíveis no painel de contato do Chat, incluindo: busca de avatar do WhatsApp, atributos do contato, notas, conversas anteriores e integração com status/etiquetas/bots.

## Contexto

Atualmente existem dois sistemas separados:

1. **CRM Contact Detail Page** (`src/components/features/crm/ContactDetailPage.tsx`)
   - Exibe informações básicas do contato (nome, telefone, avatar com iniciais)
   - Lead score, métricas, timeline, compras, créditos, campos personalizados
   - Não tem integração com dados do chat

2. **Chat Contact Panel** (`src/components/features/chat/ContactPanel.tsx`)
   - Avatar real do WhatsApp (com fetch automático)
   - Atributos do contato (key-value pairs)
   - Notas do contato
   - Conversas anteriores
   - Status, etiquetas, bot atribuído
   - Macros e ações da conversa

## Objetivo

Unificar a experiência trazendo as funcionalidades do Chat Panel para o CRM, permitindo que o usuário tenha uma visão 360° do contato em um único lugar.

## APIs Disponíveis (via useChatApi)

O hook `useChatApi` já expõe todas as APIs necessárias:

- `fetchConversationAvatar(conversationId)` - Busca avatar do WhatsApp
- `getContactAttributes(contactJid)` - Lista atributos do contato
- `createContactAttribute(contactJid, { name, value })` - Cria atributo
- `updateContactAttribute(contactJid, attributeId, value)` - Atualiza atributo
- `deleteContactAttribute(contactJid, attributeId)` - Remove atributo
- `getContactNotes(contactJid)` - Lista notas do contato
- `createContactNote(contactJid, content)` - Cria nota
- `deleteContactNote(contactJid, noteId)` - Remove nota
- `getPreviousConversations(contactJid, excludeId?)` - Lista conversas anteriores
- `getLabels()` - Lista etiquetas disponíveis
- `getBots()` - Lista bots disponíveis
- `startConversation(phone)` - Inicia/encontra conversa

## Glossary

- **ContactJid**: Identificador único do contato no WhatsApp (formato: `5511999999999@s.whatsapp.net`)
- **ContactAttribute**: Par chave-valor personalizado associado a um contato
- **ContactNote**: Nota de texto livre associada a um contato
- **PreviousConversation**: Conversa anterior com o mesmo contato

## Requirements

### Requirement 1: Avatar do WhatsApp no CRM

**User Story:** As a user, I want to see the real WhatsApp profile picture of a contact in the CRM detail page, so that I can easily identify contacts visually.

#### Acceptance Criteria

1. WHEN a user views a contact detail page, THE CRM_System SHALL attempt to fetch the WhatsApp avatar using the contact's phone number
2. WHEN the avatar is successfully fetched, THE CRM_System SHALL display it in the contact header replacing the initials fallback
3. THE CRM_System SHALL provide a refresh button to manually re-fetch the avatar
4. WHEN the avatar fetch fails or is unavailable, THE CRM_System SHALL gracefully fallback to showing initials
5. THE CRM_System SHALL cache the fetched avatar URL in the contact record for future visits

### Requirement 2: Atributos do Contato no CRM

**User Story:** As a user, I want to view and manage contact attributes in the CRM detail page, so that I can store and access custom information about the contact.

#### Acceptance Criteria

1. THE CRM_System SHALL display a "Atributos do contato" section in the contact detail page
2. WHEN viewing the section, THE CRM_System SHALL list all existing attributes with name and value
3. THE CRM_System SHALL allow adding new attributes with name and value fields
4. THE CRM_System SHALL allow editing existing attribute values inline
5. THE CRM_System SHALL allow deleting attributes with confirmation
6. WHEN an attribute is modified, THE CRM_System SHALL sync the change with the chat system

### Requirement 3: Notas do Contato no CRM

**User Story:** As a user, I want to view and add notes about a contact in the CRM detail page, so that I can keep track of important information and context.

#### Acceptance Criteria

1. THE CRM_System SHALL display a "Notas do contato" section in the contact detail page
2. WHEN viewing the section, THE CRM_System SHALL list all existing notes with content and timestamp
3. THE CRM_System SHALL allow adding new notes via a text input
4. THE CRM_System SHALL allow deleting notes with confirmation
5. THE CRM_System SHALL display notes in reverse chronological order (newest first)
6. WHEN a note is added or deleted, THE CRM_System SHALL sync the change with the chat system

### Requirement 4: Conversas Anteriores no CRM

**User Story:** As a user, I want to see previous conversations with a contact in the CRM detail page, so that I can quickly access conversation history.

#### Acceptance Criteria

1. THE CRM_System SHALL display a "Conversas anteriores" section in the contact detail page
2. WHEN viewing the section, THE CRM_System SHALL list all conversations with the contact
3. FOR each conversation, THE CRM_System SHALL display: status, last message preview, timestamp
4. WHEN a user clicks on a conversation, THE CRM_System SHALL navigate to the chat with that conversation selected
5. THE CRM_System SHALL indicate the current/active conversation if one exists

### Requirement 5: Integração com Etiquetas e Bots

**User Story:** As a user, I want to see and manage labels and bot assignments for a contact's conversations in the CRM, so that I can organize and automate interactions.

#### Acceptance Criteria

1. THE CRM_System SHALL display labels assigned to the contact's active conversation (if any)
2. THE CRM_System SHALL display the bot assigned to the contact's active conversation (if any)
3. THE CRM_System SHALL allow quick navigation to manage labels and bots in the chat interface
4. WHEN the contact has no active conversation, THE CRM_System SHALL indicate this state clearly

## Implementation Notes

### Componentes a Reutilizar do Chat

Os seguintes componentes do chat podem ser reutilizados ou adaptados:

- `ContactAttributesSection` - Seção de atributos
- `ContactNotesSection` - Seção de notas
- `PreviousConversationsSection` - Seção de conversas anteriores

### Conversão Phone → ContactJid

Para usar as APIs do chat, é necessário converter o telefone do contato para o formato JID:

```typescript
const contactJid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`
```

### Localização no Layout

As novas seções devem ser adicionadas na aba "Visão Geral" ou em uma nova aba "Chat" do `ContactDetailPage.tsx`.

## Out of Scope

- Envio de mensagens diretamente do CRM (usar botão "Mensagem" existente)
- Gerenciamento de etiquetas e bots diretamente do CRM (apenas visualização)
- Criação de novas conversas (usar botão "Mensagem" existente)
