# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o problema de salvamento de configuração de webhook no sistema WUZAPI Manager. O problema atual é que a configuração de webhook não está sendo salva corretamente porque o middleware de autenticação não está usando o token WUZAPI correto quando o usuário tem múltiplas inboxes.

## Glossary

- **Webhook_System**: Sistema responsável por configurar e gerenciar webhooks no WUZAPI
- **WUZAPI**: API externa de WhatsApp que gerencia conexões e webhooks
- **Inbox**: Caixa de entrada WhatsApp conectada via WUZAPI
- **WUZAPI_Token**: Token de autenticação específico de cada inbox no WUZAPI
- **Inbox_Context**: Contexto carregado pelo middleware que contém dados da inbox ativa
- **Session_Context**: Contexto da sessão do usuário que pode conter preferências de inbox

## Requirements

### Requirement 1: Priorização do Token Explícito

**User Story:** Como usuário, eu quero que o token WUZAPI passado explicitamente no header seja usado para configurar webhooks, para que eu possa configurar qualquer inbox independente da inbox ativa.

#### Acceptance Criteria

1. WHEN o frontend envia um header `token` com valor não-vazio THEN THE Webhook_System SHALL usar esse token para a requisição ao WUZAPI, independente do JWT presente
2. WHEN o frontend envia apenas JWT (sem header `token`) THEN THE Webhook_System SHALL usar o token da inbox ativa do contexto
3. IF o header `token` estiver presente mas vazio THEN THE Webhook_System SHALL fazer fallback para o token do contexto da inbox

### Requirement 2: Validação de Token WUZAPI

**User Story:** Como sistema, eu quero validar que o token WUZAPI é válido antes de enviar para o WUZAPI, para evitar erros de autenticação.

#### Acceptance Criteria

1. WHEN um token WUZAPI é obtido (do header ou contexto) THEN THE Webhook_System SHALL verificar que o token não está vazio
2. IF nenhum token WUZAPI válido for encontrado THEN THE Webhook_System SHALL retornar erro 401 com código `NO_WUZAPI_TOKEN`
3. WHEN o WUZAPI retorna erro 401 THEN THE Webhook_System SHALL retornar erro com mensagem clara indicando token inválido

### Requirement 3: Logging de Debug para Troubleshooting

**User Story:** Como desenvolvedor, eu quero logs detalhados do fluxo de autenticação de webhook, para facilitar o diagnóstico de problemas.

#### Acceptance Criteria

1. WHEN o middleware processa uma requisição de webhook THEN THE Webhook_System SHALL logar a fonte do token usado (header, contexto, ou sessão)
2. WHEN o token é obtido do header THEN THE Webhook_System SHALL logar os primeiros 8 caracteres do token para debug
3. WHEN a requisição ao WUZAPI falha THEN THE Webhook_System SHALL logar o status code e mensagem de erro

### Requirement 4: Consistência entre GET e POST de Webhook

**User Story:** Como usuário, eu quero que GET e POST de webhook usem o mesmo token, para que a configuração lida seja a mesma que foi salva.

#### Acceptance Criteria

1. WHEN o frontend faz GET /webhook com header `token` THEN THE Webhook_System SHALL usar esse token para buscar a configuração
2. WHEN o frontend faz POST /webhook com header `token` THEN THE Webhook_System SHALL usar esse token para salvar a configuração
3. FOR ALL requisições de webhook com o mesmo header `token`, THE Webhook_System SHALL usar o mesmo token para comunicação com WUZAPI

### Requirement 5: Feedback de Sucesso/Erro

**User Story:** Como usuário, eu quero feedback claro quando a configuração de webhook é salva ou falha, para saber se a operação foi bem-sucedida.

#### Acceptance Criteria

1. WHEN a configuração de webhook é salva com sucesso THEN THE Webhook_System SHALL retornar `{ success: true, data: { webhook: "...", events: [...] } }`
2. WHEN a configuração de webhook falha THEN THE Webhook_System SHALL retornar `{ success: false, error: "...", message: "..." }`
3. WHEN o WUZAPI retorna sucesso mas com dados diferentes do enviado THEN THE Webhook_System SHALL logar um warning

### Requirement 6: Compatibilidade com Fluxo Existente

**User Story:** Como sistema, eu quero manter compatibilidade com o fluxo existente de autenticação, para não quebrar funcionalidades que dependem do contexto da inbox.

#### Acceptance Criteria

1. WHEN nenhum header `token` é fornecido THEN THE Webhook_System SHALL continuar usando o fluxo de contexto da inbox
2. WHEN o contexto da inbox está disponível THEN THE Webhook_System SHALL usar o token do contexto como fallback
3. WHEN a sessão tem um token salvo THEN THE Webhook_System SHALL usar como último fallback
