# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir os problemas de autenticação e carregamento de dados no painel administrativo do WUZAPI Manager. O problema principal é que a rota `/api/admin/dashboard-stats` não existe no backend, causando erros 401 e impedindo o carregamento das estatísticas do sistema.

## Glossary

- **Admin Dashboard**: Painel administrativo que exibe estatísticas do sistema WUZAPI
- **WuzAPI**: API externa do WhatsApp Business que fornece dados de usuários e status
- **Session Middleware**: Middleware que gerencia sessões HTTP-only para autenticação
- **Dashboard Stats**: Estatísticas agregadas do sistema (total de usuários, usuários conectados, status do sistema, etc.)

## Requirements

### Requirement 1

**User Story:** Como administrador, quero visualizar as estatísticas do sistema no dashboard para monitorar o status geral da aplicação

#### Acceptance Criteria

1. WHEN o administrador acessa o painel admin, THE System SHALL exibir as estatísticas do sistema sem erros 401
2. THE System SHALL fornecer uma rota `/api/admin/dashboard-stats` que retorna estatísticas agregadas
3. THE System SHALL incluir nas estatísticas: total de usuários, usuários conectados, usuários logados, status do sistema, uptime e uso de memória
4. THE System SHALL validar a sessão do administrador antes de retornar os dados
5. THE System SHALL retornar erro 401 se a sessão não for válida ou não for de administrador

### Requirement 2

**User Story:** Como administrador, quero que o sistema use corretamente a autenticação baseada em sessão para evitar erros de autorização

#### Acceptance Criteria

1. THE System SHALL usar o middleware `requireAdmin` para proteger todas as rotas administrativas
2. THE System SHALL obter o token admin da sessão (`req.session.userToken`) ou da variável de ambiente
3. THE System SHALL validar o token com a WuzAPI antes de processar requisições administrativas
4. THE System SHALL manter a sessão ativa enquanto o administrador estiver usando o sistema
5. THE System SHALL retornar mensagens de erro claras quando a autenticação falhar

### Requirement 3

**User Story:** Como desenvolvedor, quero que o componente AdminOverview use a nova API de estatísticas para exibir dados corretos

#### Acceptance Criteria

1. THE AdminOverview Component SHALL fazer requisições para `/api/admin/dashboard-stats` com credenciais de sessão
2. THE AdminOverview Component SHALL exibir um estado de carregamento enquanto busca os dados
3. THE AdminOverview Component SHALL exibir as estatísticas recebidas da API em cards visuais
4. THE AdminOverview Component SHALL atualizar as estatísticas automaticamente a cada 30 segundos
5. THE AdminOverview Component SHALL exibir mensagens de erro apropriadas se a API falhar

### Requirement 4

**User Story:** Como administrador, quero que o sistema agregue dados de múltiplas fontes para fornecer uma visão completa do status

#### Acceptance Criteria

1. THE System SHALL buscar dados de usuários da WuzAPI usando o token administrativo
2. THE System SHALL calcular estatísticas agregadas (total, conectados, logados)
3. THE System SHALL incluir informações de saúde do sistema (uptime, versão, memória)
4. THE System SHALL retornar os dados em formato JSON padronizado
5. THE System SHALL cachear os dados por até 30 segundos para reduzir carga na WuzAPI
