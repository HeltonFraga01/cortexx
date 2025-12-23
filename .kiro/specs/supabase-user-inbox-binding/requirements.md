# Requirements Document

## Introduction

Este documento define os requisitos para vincular automaticamente as informações da caixa de entrada (inbox) ao usuário autenticado via Supabase Auth. Quando um usuário faz login, o sistema deve carregar automaticamente os dados da inbox associada (token WUZAPI, instância, etc.) e disponibilizá-los em todo o sistema para operações de chat, contatos e envio de mensagens.

## Glossary

- **Supabase_Auth**: Sistema de autenticação do Supabase usado para login de usuários
- **User**: Usuário autenticado via Supabase Auth (tabela `auth.users`)
- **Account**: Conta do sistema vinculada ao usuário (tabela `accounts`)
- **Inbox**: Caixa de entrada WhatsApp com token WUZAPI e configurações (tabela `inboxes`)
- **Agent**: Membro de um time/equipe associado a uma ou mais inboxes (tabela `agents`)
- **Team**: Equipe/time que agrupa agentes com acesso a inboxes específicas (tabela `teams`)
- **WUZAPI_Token**: Token de autenticação para a API do WhatsApp
- **Instance**: Identificador da instância WhatsApp no WUZAPI
- **Session_Context**: Contexto da sessão contendo dados do usuário, account, agent e inbox ativos

## Requirements

### Requirement 1: Carregamento Automático de Inbox no Login

**User Story:** Como usuário, quero que ao fazer login via Supabase Auth, o sistema carregue automaticamente minha caixa de entrada vinculada, para que eu possa usar todas as funcionalidades do WhatsApp sem configuração adicional.

#### Acceptance Criteria

1. WHEN um usuário faz login via Supabase Auth THEN o Sistema SHALL buscar a account vinculada ao user_id do Supabase
2. WHEN a account é encontrada THEN o Sistema SHALL buscar a inbox ativa vinculada a essa account
3. WHEN a inbox é encontrada THEN o Sistema SHALL carregar o wuzapi_token, instance e demais configurações no contexto da sessão
4. IF o usuário não possui account vinculada THEN o Sistema SHALL retornar erro informativo solicitando vinculação
5. IF a account não possui inbox ativa THEN o Sistema SHALL retornar erro informativo solicitando configuração de inbox

### Requirement 2: Contexto de Sessão com Dados da Inbox

**User Story:** Como desenvolvedor, quero que o contexto da sessão contenha todos os dados necessários da inbox, para que qualquer parte do sistema possa acessar token, instância e configurações sem consultas adicionais.

#### Acceptance Criteria

1. THE Session_Context SHALL conter os campos: userId, accountId, inboxId, wuzapiToken, instance, inboxName
2. WHEN qualquer endpoint autenticado é acessado THEN o Sistema SHALL disponibilizar o Session_Context completo via req.session ou req.context
3. THE Session_Context SHALL ser populado uma única vez no middleware de autenticação
4. WHEN o wuzapiToken não estiver disponível no contexto THEN o Sistema SHALL rejeitar operações que dependem da API WhatsApp

### Requirement 3: Uso do Contexto em Operações de Chat

**User Story:** Como usuário, quero que o chat use automaticamente minha inbox vinculada, para que eu possa enviar e receber mensagens sem selecionar manualmente a caixa de entrada.

#### Acceptance Criteria

1. WHEN o usuário acessa o chat THEN o Sistema SHALL usar o wuzapiToken e instance do Session_Context
2. WHEN o usuário envia uma mensagem THEN o Sistema SHALL usar a inbox do contexto para envio via WUZAPI
3. WHEN mensagens são recebidas THEN o Sistema SHALL filtrar apenas mensagens da inbox do contexto
4. THE Chat_Component SHALL exibir o nome da inbox ativa no cabeçalho

### Requirement 4: Uso do Contexto em Operações de Contatos

**User Story:** Como usuário, quero que meus contatos sejam automaticamente associados à minha inbox, para que eu possa gerenciá-los sem configuração manual.

#### Acceptance Criteria

1. WHEN o usuário lista contatos THEN o Sistema SHALL filtrar por account_id do Session_Context
2. WHEN o usuário importa contatos THEN o Sistema SHALL associá-los ao account_id do contexto
3. WHEN o usuário busca contatos THEN o Sistema SHALL usar a inbox do contexto para sincronização com WhatsApp
4. THE Contacts_List SHALL exibir apenas contatos da account do usuário logado

### Requirement 5: Uso do Contexto em Envio de Mensagens

**User Story:** Como usuário, quero que todos os envios de mensagem usem automaticamente minha inbox, para que eu não precise selecionar a caixa de entrada em cada operação.

#### Acceptance Criteria

1. WHEN o usuário envia mensagem individual THEN o Sistema SHALL usar wuzapiToken e instance do Session_Context
2. WHEN o usuário cria campanha em massa THEN o Sistema SHALL associar a campanha ao account_id e inbox_id do contexto
3. WHEN o usuário agenda mensagem THEN o Sistema SHALL armazenar inbox_id do contexto junto com a mensagem
4. IF a inbox do contexto estiver desconectada THEN o Sistema SHALL informar o usuário e bloquear envios

### Requirement 6: Middleware de Autenticação Unificado

**User Story:** Como desenvolvedor, quero um middleware unificado que popule o contexto completo, para que todos os endpoints tenham acesso consistente aos dados do usuário e inbox.

#### Acceptance Criteria

1. THE Middleware SHALL interceptar todas as requisições autenticadas
2. WHEN o token JWT do Supabase é válido THEN o Middleware SHALL extrair o user_id
3. WHEN o user_id é extraído THEN o Middleware SHALL buscar account e inbox associadas
4. THE Middleware SHALL popular req.context com: userId, accountId, inboxId, wuzapiToken, instance, tenantId
5. WHEN qualquer etapa falha THEN o Middleware SHALL retornar erro 401 ou 403 com mensagem descritiva
6. THE Middleware SHALL cachear o contexto para evitar consultas repetidas na mesma sessão

### Requirement 7: Fallback para Múltiplas Inboxes

**User Story:** Como usuário com múltiplas caixas de entrada, quero poder selecionar qual inbox usar, para que eu possa gerenciar diferentes números WhatsApp.

#### Acceptance Criteria

1. WHEN a account possui múltiplas inboxes THEN o Sistema SHALL usar a inbox marcada como padrão (is_default = true)
2. IF nenhuma inbox está marcada como padrão THEN o Sistema SHALL usar a primeira inbox ativa
3. THE User_Interface SHALL permitir trocar a inbox ativa via seletor no header
4. WHEN o usuário troca a inbox ativa THEN o Sistema SHALL atualizar o Session_Context
5. THE Sistema SHALL persistir a preferência de inbox do usuário para sessões futuras

### Requirement 8: Sincronização de Estado da Conexão

**User Story:** Como usuário, quero ver o status de conexão da minha inbox em tempo real, para saber se posso enviar mensagens.

#### Acceptance Criteria

1. THE Sistema SHALL verificar o status de conexão da inbox ao carregar o contexto
2. WHEN a inbox está conectada THEN o Sistema SHALL exibir indicador verde no header
3. WHEN a inbox está desconectada THEN o Sistema SHALL exibir indicador vermelho e opção de reconectar
4. THE Sistema SHALL atualizar o status de conexão periodicamente (a cada 30 segundos)
5. WHEN o status muda THEN o Sistema SHALL notificar o usuário via toast

### Requirement 9: Acesso de Agentes às Inboxes Associadas

**User Story:** Como agente de um time, quero ter acesso automático às inboxes associadas ao meu time, para que eu possa atender conversas e enviar mensagens usando as caixas de entrada permitidas.

#### Acceptance Criteria

1. WHEN um agente faz login via Supabase Auth THEN o Sistema SHALL buscar o registro do agente na tabela agents
2. WHEN o agente é encontrado THEN o Sistema SHALL buscar as inboxes associadas ao agente via inbox_agents ou team_inboxes
3. WHEN o agente possui múltiplas inboxes THEN o Sistema SHALL carregar a inbox padrão ou a primeira disponível
4. THE Session_Context do agente SHALL conter: userId, agentId, accountId, inboxId, wuzapiToken, instance, role, permissions
5. IF o agente não possui inboxes associadas THEN o Sistema SHALL retornar erro informando que não há caixas de entrada disponíveis

### Requirement 10: Permissões de Agente por Inbox

**User Story:** Como administrador, quero definir quais inboxes cada agente pode acessar, para controlar o acesso às diferentes caixas de entrada da empresa.

#### Acceptance Criteria

1. THE Sistema SHALL respeitar a associação agent-inbox ao carregar o contexto
2. WHEN um agente tenta acessar uma inbox não associada THEN o Sistema SHALL retornar erro 403
3. THE Agent_Dashboard SHALL exibir apenas as inboxes às quais o agente tem acesso
4. WHEN um agente troca de inbox THEN o Sistema SHALL verificar se ele tem permissão antes de atualizar o contexto
5. THE Sistema SHALL permitir que administradores associem/desassociem agentes de inboxes

### Requirement 11: Contexto Unificado para Owners e Agentes

**User Story:** Como desenvolvedor, quero um contexto unificado que funcione tanto para owners quanto para agentes, para simplificar a lógica de acesso em todo o sistema.

#### Acceptance Criteria

1. THE Session_Context SHALL ter estrutura consistente independente do tipo de usuário (owner ou agent)
2. WHEN o usuário é owner da account THEN o Sistema SHALL conceder acesso a todas as inboxes da account
3. WHEN o usuário é agente THEN o Sistema SHALL conceder acesso apenas às inboxes associadas
4. THE Session_Context SHALL incluir campo userType com valor 'owner' ou 'agent'
5. THE Session_Context SHALL incluir campo permissions com array de permissões do usuário
6. WHEN qualquer operação é executada THEN o Sistema SHALL verificar se o usuário tem permissão para a inbox ativa

### Requirement 12: Seletor de Inbox para Agentes

**User Story:** Como agente com acesso a múltiplas inboxes, quero poder alternar entre elas facilmente, para atender conversas de diferentes números WhatsApp.

#### Acceptance Criteria

1. THE Header_Component SHALL exibir seletor de inbox quando o usuário tem acesso a múltiplas inboxes
2. THE Inbox_Selector SHALL listar apenas inboxes às quais o usuário/agente tem acesso
3. WHEN o usuário seleciona outra inbox THEN o Sistema SHALL atualizar o Session_Context
4. WHEN o contexto é atualizado THEN o Sistema SHALL recarregar dados (chat, contatos) da nova inbox
5. THE Sistema SHALL persistir a última inbox selecionada por usuário para sessões futuras
