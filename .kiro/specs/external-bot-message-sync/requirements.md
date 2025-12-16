# Requirements Document

## Introduction

Este documento especifica os requisitos para sincronização de mensagens enviadas por automações externas (bots) no histórico de conversas do sistema. Atualmente, mensagens enviadas diretamente via API WUZAPI por automações externas não aparecem no histórico do sistema, criando uma lacuna quando o atendente humano assume a conversa.

O sistema precisa capturar e exibir todas as mensagens enviadas, independentemente de terem sido enviadas pelo sistema, pelo WhatsApp nativo ou por automações externas, garantindo que o atendente tenha visibilidade completa do histórico da conversa.

## Glossary

- **WUZAPI**: API de integração com WhatsApp Business utilizada pelo sistema
- **Bot Externo**: Automação que roda fora do sistema e envia mensagens via API WUZAPI diretamente
- **Webhook**: Endpoint que recebe eventos do WUZAPI (mensagens recebidas, enviadas, status, etc.)
- **Histórico de Conversa**: Lista de mensagens exibidas na interface de chat do sistema
- **fromMe**: Flag do WUZAPI que indica se a mensagem foi enviada pelo próprio número (true) ou recebida (false)
- **Endpoint Proxy**: Rota do sistema que recebe requisições de envio e as encaminha para WUZAPI, registrando no histórico
- **skip_webhook**: Flag opcional para indicar que a mensagem não deve disparar webhooks de saída (evita loops)

## Requirements

### Requirement 1

**User Story:** Como atendente, quero ver todas as mensagens enviadas pelo bot no histórico da conversa, para que eu tenha contexto completo ao assumir o atendimento.

#### Acceptance Criteria

1. WHEN uma mensagem com `fromMe: true` é recebida via webhook THEN the System SHALL armazenar a mensagem no histórico com direction `outgoing` e sender_type `bot`
2. WHEN o atendente visualiza uma conversa THEN the System SHALL exibir mensagens enviadas por bots com indicador visual diferenciado
3. WHEN uma mensagem outgoing é armazenada THEN the System SHALL NÃO incrementar o contador de mensagens não lidas
4. WHEN uma mensagem outgoing é armazenada THEN the System SHALL atualizar o preview da última mensagem na lista de conversas

### Requirement 2

**User Story:** Como desenvolvedor de automação, quero um endpoint proxy para enviar mensagens que são automaticamente registradas no histórico, para que eu não precise me preocupar com sincronização.

#### Acceptance Criteria

1. WHEN uma automação envia mensagem via endpoint proxy `/api/bot/send/text` THEN the System SHALL encaminhar para WUZAPI e registrar no histórico local
2. WHEN o endpoint proxy recebe uma requisição THEN the System SHALL validar o token do usuário e o número de telefone
3. WHEN o endpoint proxy registra a mensagem THEN the System SHALL marcar sender_type como `bot` e incluir bot_id se fornecido
4. WHEN o endpoint proxy é usado com flag `skip_webhook: true` THEN the System SHALL NÃO disparar webhooks de saída para evitar loops de automação

### Requirement 3

**User Story:** Como administrador, quero identificar claramente quais mensagens foram enviadas por bots vs humanos, para análise e auditoria.

#### Acceptance Criteria

1. WHEN uma mensagem é armazenada THEN the System SHALL registrar o sender_type (`user`, `bot`, `contact`, `system`)
2. WHEN uma mensagem é enviada por bot THEN the System SHALL registrar o bot_id quando disponível
3. WHEN mensagens são listadas THEN the System SHALL incluir informações de sender_type e bot_id na resposta

### Requirement 4

**User Story:** Como desenvolvedor, quero que o sistema evite duplicação de mensagens quando a mesma mensagem é registrada via webhook e via endpoint proxy.

#### Acceptance Criteria

1. WHEN uma mensagem é recebida via webhook THEN the System SHALL verificar se já existe mensagem com mesmo message_id antes de inserir
2. WHEN uma mensagem duplicada é detectada THEN the System SHALL ignorar a inserção e retornar sucesso
3. WHEN o endpoint proxy envia uma mensagem THEN the System SHALL usar o message_id retornado pelo WUZAPI para evitar duplicação

### Requirement 5

**User Story:** Como atendente, quero que mensagens de bots apareçam em tempo real na interface, para acompanhar a conversa enquanto o bot está ativo.

#### Acceptance Criteria

1. WHEN uma mensagem outgoing é armazenada THEN the System SHALL emitir evento WebSocket para atualização em tempo real
2. WHEN o WebSocket emite atualização de mensagem THEN the System SHALL incluir sender_type para renderização correta
3. WHEN a conversa é atualizada THEN the System SHALL emitir evento de atualização da lista de conversas

