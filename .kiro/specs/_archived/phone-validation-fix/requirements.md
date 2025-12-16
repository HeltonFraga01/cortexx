# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir a validação e formatação de números de telefone no sistema WUZAPI Manager. A abordagem é usar a API `/user/check` da WUZAPI para validar números e obter o formato correto, em vez de criar lógica de normalização manual.

## Glossary

- **WUZAPI**: API WhatsApp Business utilizada para envio de mensagens
- **Phone Number**: Número de telefone no formato internacional sem caracteres especiais
- **JID**: Jabber ID, formato interno do WhatsApp (ex: 553193514418@s.whatsapp.net)
- **LID**: Linked Device ID, identificador de dispositivo vinculado (ex: 1234567890@lid)
- **SenderAlt**: Campo alternativo em webhooks que contém o número real quando Chat usa @lid
- **Validated Number**: Número retornado pela API `/user/check` no campo `Query` (ex: 553193514418)
- **Campaign Scheduler**: Serviço que processa campanhas em massa
- **Queue Manager**: Gerenciador de fila que envia mensagens individuais
- **Single Message**: Envio de mensagem única através da interface

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor, quero que o sistema valide números de telefone usando a API WUZAPI antes de enviar mensagens, para garantir que o formato esteja correto.

#### Acceptance Criteria

1. WHEN o sistema precisa validar um número THEN o sistema SHALL chamar a API `/user/check` da WUZAPI
2. WHEN a API `/user/check` retorna sucesso THEN o sistema SHALL usar o campo `Query` como o número validado
3. WHEN a API `/user/check` retorna `IsInWhatsapp: false` THEN o sistema SHALL rejeitar o número com mensagem de erro
4. WHEN a API `/user/check` falha THEN o sistema SHALL logar o erro e rejeitar o envio
5. WHEN o sistema armazena um número validado THEN o sistema SHALL armazenar o valor do campo `Query` retornado pela API

### Requirement 2

**User Story:** Como desenvolvedor, quero que o envio em massa use a mesma validação do envio único, para que ambos tenham o mesmo comportamento.

#### Acceptance Criteria

1. WHEN o CampaignScheduler processa um contato THEN o sistema SHALL validar o número usando `/user/check` antes de enviar
2. WHEN o QueueManager envia uma mensagem THEN o sistema SHALL usar o número validado pela API
3. WHEN o sistema importa contatos THEN o sistema SHALL validar cada número usando `/user/check`
4. WHEN o sistema exibe um número THEN o sistema SHALL formatar para exibição visual

### Requirement 3

**User Story:** Como desenvolvedor, quero preparar números antes de chamar a API de validação, para aumentar a chance de sucesso.

#### Acceptance Criteria

1. WHEN o sistema prepara um número para validação THEN o sistema SHALL remover sufixos WhatsApp (@s.whatsapp.net, @c.us, @lid)
2. WHEN o sistema prepara um número para validação THEN o sistema SHALL remover caracteres não numéricos
3. WHEN o sistema prepara um número para validação THEN o sistema SHALL remover zero inicial do DDD (021 → 21)
4. WHEN o sistema prepara um número sem código de país THEN o sistema SHALL adicionar o código 55

### Requirement 4

**User Story:** Como desenvolvedor, quero que o sistema trate corretamente webhooks com diferentes tipos de JID, para que números sejam extraídos corretamente de chats individuais, grupos e canais.

#### Acceptance Criteria

1. WHEN o webhook contém Chat terminando com @s.whatsapp.net THEN o sistema SHALL extrair o número do campo Chat
2. WHEN o webhook contém Chat terminando com @g.us (grupo) THEN o sistema SHALL extrair o número do campo Sender
3. WHEN o webhook contém Chat terminando com @lid THEN o sistema SHALL usar o endpoint `/user/lid/{phone}` para resolver o número real
4. WHEN o sistema extrai número de webhook THEN o sistema SHALL remover todos os sufixos WhatsApp do número extraído
5. WHEN o webhook não contém Info.Chat ou Info.Sender THEN o sistema SHALL retornar string vazia e logar erro
6. WHEN o sistema precisa resolver um LID para número THEN o sistema SHALL chamar GET `/user/lid/{phone}` e usar o campo `jid` retornado

### Requirement 5

**User Story:** Como desenvolvedor, quero cachear resultados de validação, para evitar chamadas repetidas à API.

#### Acceptance Criteria

1. WHEN o sistema valida um número THEN o sistema SHALL verificar se já existe no cache
2. WHEN o número existe no cache THEN o sistema SHALL retornar o resultado cacheado
3. WHEN o número não existe no cache THEN o sistema SHALL chamar a API e cachear o resultado
4. WHEN o cache expira THEN o sistema SHALL revalidar o número na próxima requisição
