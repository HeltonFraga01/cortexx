# Requirements Document - Transferência de Conversa entre Caixas de Entrada

## Introduction

Esta funcionalidade permite que usuários transfiram conversas de uma caixa de entrada (inbox) para outra dentro da mesma conta. Isso é útil quando um contato entra em contato por uma caixa específica, mas o atendimento precisa ser feito por outra equipe/número.

## Glossary

- **Inbox**: Caixa de entrada associada a um número WhatsApp específico (via WUZAPI)
- **Conversation**: Conversa com um contato específico, vinculada a uma inbox
- **Account**: Conta do usuário que pode ter múltiplas inboxes
- **Transfer**: Ação de mover uma conversa de uma inbox de origem para uma inbox de destino
- **Contact_JID**: Identificador único do contato no WhatsApp (formato: número@s.whatsapp.net)

## Requirements

### Requirement 1: Transferir Conversa para Outra Inbox

**User Story:** Como um atendente, eu quero transferir uma conversa para outra caixa de entrada, para que eu possa responder ao contato usando um número diferente.

#### Acceptance Criteria

1. WHEN um usuário seleciona a opção de transferir conversa, THE System SHALL exibir uma lista de inboxes disponíveis na conta
2. WHEN um usuário seleciona uma inbox de destino, THE System SHALL atualizar o campo `inbox_id` da conversa para a nova inbox
3. WHEN uma conversa é transferida, THE System SHALL manter todo o histórico de mensagens intacto
4. WHEN uma conversa é transferida, THE System SHALL notificar o usuário com uma mensagem de sucesso
5. IF a inbox de destino for a mesma da origem, THEN THE System SHALL exibir um aviso e não realizar a transferência
6. IF o usuário não tiver permissão para a inbox de destino, THEN THE System SHALL negar a transferência

### Requirement 2: Indicador Visual de Inbox na Conversa

**User Story:** Como um atendente, eu quero ver claramente qual inbox está associada a uma conversa, para que eu saiba por qual número estou respondendo.

#### Acceptance Criteria

1. THE Conversation_View SHALL exibir o nome da inbox associada à conversa
2. WHEN uma conversa é transferida, THE Conversation_View SHALL atualizar o indicador de inbox imediatamente
3. THE Inbox_Indicator SHALL ser visível no painel de detalhes da conversa

### Requirement 3: Responder pela Inbox Correta

**User Story:** Como um atendente, eu quero que minhas respostas sejam enviadas pelo número da inbox associada à conversa, para que o contato receba a mensagem do número correto.

#### Acceptance Criteria

1. WHEN um usuário envia uma mensagem, THE System SHALL usar o token WUZAPI da inbox associada à conversa
2. WHEN uma conversa foi transferida, THE System SHALL usar o token da nova inbox para enviar mensagens
3. THE System SHALL validar que a inbox tem um token WUZAPI válido antes de enviar

### Requirement 4: Registro de Transferência

**User Story:** Como um administrador, eu quero ver o histórico de transferências de uma conversa, para auditoria e rastreamento.

#### Acceptance Criteria

1. WHEN uma conversa é transferida, THE System SHALL registrar a transferência com: inbox de origem, inbox de destino, usuário que transferiu, e timestamp
2. THE Conversation_Info SHALL exibir o histórico de transferências quando disponível

### Requirement 5: Permissões de Transferência

**User Story:** Como um administrador, eu quero controlar quais usuários podem transferir conversas, para manter a organização do atendimento.

#### Acceptance Criteria

1. THE System SHALL verificar se o usuário tem acesso à inbox de destino antes de permitir a transferência
2. WHEN um usuário não tem permissão, THE System SHALL exibir uma mensagem de erro apropriada
