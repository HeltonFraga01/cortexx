# Requirements Document

## Introduction

Este documento define os requisitos para implementar uma funcionalidade de "Chat de Teste com Bot" na página de configurações do usuário (`/user/settings`). A funcionalidade permite que usuários testem a interação com seus bots configurados usando a mesma interface de chat existente (`/user/chat`), mas com um JID (WhatsApp ID) simulado para não quebrar o payload do webhook.

O sistema deve:
1. Criar um botão "Testar Bot" na página de configurações de bots
2. Abrir uma interface de chat simulada para testar o bot
3. Gerar um JID simulado que seja compatível com o formato real do WhatsApp
4. Enviar o mesmo payload para o webhook do bot como se fosse uma mensagem real
5. Respeitar os limites de quota do usuário (chamadas, mensagens, tokens)
6. Permitir que o bot responda tanto via webhook quanto diretamente no chat de teste

## Glossary

- **Bot_Test_Chat**: Interface de chat simulada para testar interações com bots
- **Simulated_JID**: Identificador WhatsApp simulado no formato `test_<userId>_<timestamp>@s.whatsapp.net`
- **Test_Conversation**: Conversa criada especificamente para testes de bot, marcada com flag `is_test`
- **Bot_System**: Sistema de gerenciamento de bots de automação (agent_bots)
- **Quota_System**: Sistema de controle de quotas e limites de uso
- **Webhook_Payload**: Estrutura de dados enviada ao webhook do bot
- **User_Interface**: Interface do usuário para visualização e interação

## Requirements

### Requirement 1

**User Story:** As a user, I want to test my bot configuration from the settings page, so that I can verify the bot is working correctly before using it with real customers.

#### Acceptance Criteria

1. WHEN a user views a bot card in the Bots settings tab THEN the User_Interface SHALL display a "Testar Bot" button
2. WHEN the user clicks the "Testar Bot" button THEN the User_Interface SHALL open a chat dialog/modal for testing
3. WHEN the test chat opens THEN the Bot_System SHALL create a test conversation with a simulated JID
4. THE simulated JID SHALL follow the format `test_<userId>_<timestamp>@s.whatsapp.net` to maintain payload compatibility
5. WHEN the test chat is closed THEN the Bot_System SHALL mark the test conversation as archived

### Requirement 2

**User Story:** As a user, I want the test chat to send the same payload to my bot webhook as real messages, so that I can accurately test my bot's behavior.

#### Acceptance Criteria

1. WHEN a user sends a message in the test chat THEN the Bot_System SHALL forward the message to the bot's webhook URL
2. THE webhook payload SHALL include the same structure as real messages including `jid`, `message`, `timestamp`, and `conversationId`
3. WHEN the bot webhook responds with a reply action THEN the Bot_System SHALL display the reply in the test chat
4. WHEN the bot webhook responds with token usage THEN the Quota_System SHALL track the tokens consumed
5. IF the bot webhook fails to respond THEN the User_Interface SHALL display an error message in the chat

### Requirement 3

**User Story:** As a user, I want the test chat to respect my quota limits, so that testing doesn't unexpectedly consume all my resources.

#### Acceptance Criteria

1. WHEN a test message is sent THEN the Quota_System SHALL check the user's bot call quota before forwarding
2. WHEN the bot call quota is exceeded THEN the User_Interface SHALL display a quota exceeded message
3. WHEN a bot reply is received THEN the Quota_System SHALL increment the bot messages counter
4. WHEN the bot messages quota is exceeded THEN the Bot_System SHALL skip sending the reply and notify the user
5. THE test chat SHALL display current quota usage in a visible indicator

### Requirement 4

**User Story:** As a user, I want to see a clear visual distinction between test conversations and real conversations, so that I don't confuse them.

#### Acceptance Criteria

1. WHEN displaying a test conversation THEN the User_Interface SHALL show a "Teste" badge prominently
2. THE test chat dialog SHALL have a distinct visual style (e.g., different border color or header)
3. WHEN the test chat is active THEN the User_Interface SHALL display a warning that this is a test environment
4. THE test conversation SHALL NOT appear in the main conversation list by default

### Requirement 5

**User Story:** As a user, I want to test admin-assigned bots as well as my own bots, so that I can verify all automations are working.

#### Acceptance Criteria

1. WHEN viewing admin-assigned bots THEN the User_Interface SHALL display a "Testar Bot" button for each bot
2. WHEN testing an admin-assigned bot THEN the Bot_System SHALL use the bot's configured webhook URL
3. WHEN testing an admin-assigned bot THEN the Quota_System SHALL use the user's quota limits
4. THE test functionality SHALL work identically for user-created and admin-assigned bots

### Requirement 6

**User Story:** As a user, I want to include message history in my test conversations, so that I can test bots that use conversation context.

#### Acceptance Criteria

1. WHEN a bot has `includeHistory` enabled THEN the webhook payload SHALL include previous test messages
2. THE history SHALL include up to 10 previous messages from the test conversation
3. WHEN starting a new test session THEN the history SHALL be empty
4. THE user SHALL be able to clear the test conversation history via a button

### Requirement 7

**User Story:** As a developer, I want the test chat to support the same message types as real conversations, so that I can test all bot capabilities.

#### Acceptance Criteria

1. THE test chat SHALL support sending text messages
2. THE test chat SHALL support receiving text replies from the bot
3. WHEN the bot responds with a message type other than text THEN the User_Interface SHALL display an appropriate placeholder
4. THE test chat SHALL display timestamps for all messages

