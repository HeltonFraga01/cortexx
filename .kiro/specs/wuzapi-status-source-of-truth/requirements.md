# Requirements Document

## Introduction

Este documento define os requisitos para a página de edição de Inbox no painel admin. A página exibe informações combinadas de duas fontes:
1. **WUZAPI** (fonte de verdade): Status de conexão, token, JID, webhook, eventos
2. **Supabase**: Dados da conta vinculada (email, datas, ID)

A página `/admin/inboxes/edit/:id` permite ao admin visualizar e gerenciar uma inbox específica.

## Glossary

- **Inbox**: Registro no WUZAPI que representa uma sessão WhatsApp (identificado pelo `id` hexadecimal)
- **WUZAPI**: API que gerencia sessões WhatsApp - fonte de verdade para status de conexão
- **Token**: Credencial de autenticação do WUZAPI (formato: `{phone}MIN{random}`)
- **JID**: WhatsApp ID completo (formato: `{phone}:{device}@s.whatsapp.net`)
- **Conta Supabase**: Usuário no banco de dados vinculado à inbox via `user_metadata.wuzapi_id`

## Requirements

### Requirement 1: Carregamento de Dados da Inbox

**User Story:** Como admin, quero ver todos os dados de uma inbox em uma única página.

#### Acceptance Criteria

1. WHEN a página carrega, THE Sistema SHALL buscar dados do WUZAPI via `GET /api/admin/users`
2. THE Sistema SHALL filtrar o usuário pelo `id` da URL
3. THE Sistema SHALL exibir: nome, token, JID, status de conexão, webhook, eventos
4. THE Sistema SHALL buscar a conta Supabase vinculada via `GET /api/admin/supabase/users?search={id}`

### Requirement 2: Exibição do Avatar do WhatsApp

**User Story:** Como admin, quero ver a foto de perfil do WhatsApp da inbox.

#### Acceptance Criteria

1. WHEN a inbox está logada, THE Sistema SHALL buscar o avatar via `POST /api/user/avatar`
2. THE Requisição SHALL incluir o header `token` com o token da inbox
3. THE Requisição SHALL enviar body `{ Phone: "{phone}", Preview: false }`
4. THE Sistema SHALL extrair o phone do JID (parte antes do `:`)
5. IF o avatar não existir, THEN THE Sistema SHALL exibir avatar padrão

### Requirement 3: Status de Conexão (WUZAPI como Fonte de Verdade)

**User Story:** Como admin, quero ver o status real de conexão da inbox.

#### Acceptance Criteria

1. THE Status SHALL vir exclusivamente do WUZAPI (campos `connected` e `loggedIn`)
2. THE Sistema SHALL exibir "Logado" quando `loggedIn: true`
3. THE Sistema SHALL exibir "Conectado" quando `connected: true` mas `loggedIn: false`
4. THE Sistema SHALL exibir "Desconectado" quando `connected: false`
5. THE Sistema SHALL exibir descrição contextual do status

### Requirement 4: Vinculação com Conta Supabase

**User Story:** Como admin, quero ver se a inbox está vinculada a uma conta no sistema.

#### Acceptance Criteria

1. THE Sistema SHALL buscar conta Supabase onde `user_metadata.wuzapi_id` = inbox.id
2. IF conta encontrada, THEN THE Sistema SHALL exibir badge "Vinculado"
3. THE Sistema SHALL exibir: ID Supabase, email, data de criação, último login
4. THE Sistema SHALL permitir alterar credenciais da conta
5. THE Sistema SHALL permitir desvincular a conta

### Requirement 5: Configuração de Webhook

**User Story:** Como admin, quero configurar o webhook e eventos da inbox.

#### Acceptance Criteria

1. THE Sistema SHALL exibir URL do webhook atual (do WUZAPI)
2. THE Sistema SHALL permitir editar a URL do webhook
3. THE Sistema SHALL exibir eventos selecionados agrupados por categoria
4. THE Sistema SHALL permitir selecionar/deselecionar eventos
5. THE Sistema SHALL salvar alterações no WUZAPI

### Requirement 6: Ações Rápidas

**User Story:** Como admin, quero executar ações comuns rapidamente.

#### Acceptance Criteria

1. THE Sistema SHALL exibir botão "Gerar QR Code" para reconectar
2. THE Sistema SHALL exibir botão "Remover do DB" para remover apenas do Supabase
3. THE Sistema SHALL exibir botão "Remover Completo" para remover do WUZAPI e Supabase
4. WHEN ação é executada, THE Sistema SHALL exibir feedback de sucesso/erro

### Requirement 7: Campos Somente Leitura

**User Story:** Como admin, quero ver informações que não devem ser editadas.

#### Acceptance Criteria

1. THE Campo Token SHALL ser somente leitura com botão de copiar
2. THE Campo JID SHALL ser somente leitura com botão de copiar
3. THE Campo ID da Inbox SHALL ser somente leitura com botão de copiar
4. THE Campo ID Supabase SHALL ser somente leitura com botão de copiar
