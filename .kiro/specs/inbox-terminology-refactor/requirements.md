# Requirements Document

## Introduction

Este documento especifica os requisitos para refatorar a nomenclatura do sistema, clarificando a distinção entre **Inbox** (caixa de entrada WhatsApp via WUZAPI) e **User** (usuário do sistema autenticado via Supabase).

Atualmente, o sistema usa "WuzAPIUser", "usuário WUZAPI" e termos similares para se referir às instâncias WhatsApp, causando confusão com os usuários reais do sistema. Esta refatoração visa:

1. Renomear "WuzAPIUser" para "Inbox" em todo o codebase
2. Atualizar interfaces, componentes e serviços para usar a nova nomenclatura
3. Melhorar a clareza da documentação e UI

## Glossary

- **Inbox**: Caixa de entrada WhatsApp conectada via WUZAPI. Representa uma instância/número WhatsApp que pode enviar e receber mensagens. Anteriormente chamada de "WuzAPIUser" ou "usuário WUZAPI".
- **User**: Usuário do sistema autenticado via Supabase Auth. Pessoa real que acessa a plataforma.
- **Account**: Registro na tabela `accounts` que vincula um User a um Tenant e pode ter múltiplos Inboxes associados.
- **Tenant**: Organização/empresa no sistema multi-tenant.
- **Agent**: Usuário com papel de atendente que gerencia conversas em Inboxes atribuídos.
- **WUZAPI**: API externa que gerencia conexões WhatsApp. O sistema se comunica com WUZAPI para gerenciar Inboxes.

## Requirements

### Requirement 1: Renomear tipos e interfaces TypeScript

**User Story:** Como desenvolvedor, quero que os tipos TypeScript reflitam corretamente a nomenclatura de Inbox, para que o código seja mais claro e auto-documentado.

#### Acceptance Criteria

1. THE System SHALL renomear `WuzAPIUser` para `Inbox` em `src/lib/wuzapi-types.ts`
2. THE System SHALL renomear `WuzAPIUserResponse` para `InboxResponse` em `src/lib/wuzapi-types.ts`
3. THE System SHALL renomear `WuzAPIUsersResponse` para `InboxListResponse` em `src/lib/wuzapi-types.ts`
4. THE System SHALL criar alias de compatibilidade temporários para os tipos antigos com marcação `@deprecated`
5. THE System SHALL atualizar todas as importações que usam os tipos renomeados

### Requirement 2: Renomear serviços e funções

**User Story:** Como desenvolvedor, quero que os serviços e funções usem nomenclatura consistente de Inbox, para facilitar a manutenção do código.

#### Acceptance Criteria

1. THE System SHALL renomear `WuzAPIService` para `InboxService` ou manter como `WuzAPIService` mas renomear métodos internos
2. THE System SHALL renomear método `getUsers()` para `listInboxes()` no serviço WUZAPI
3. THE System SHALL renomear método `getUser()` para `getInbox()` no serviço WUZAPI
4. THE System SHALL renomear método `createUser()` para `createInbox()` no serviço WUZAPI
5. THE System SHALL renomear método `updateUser()` para `updateInbox()` no serviço WUZAPI
6. THE System SHALL renomear método `deleteUser()` para `deleteInbox()` no serviço WUZAPI
7. THE System SHALL manter métodos antigos como aliases `@deprecated` para compatibilidade

### Requirement 3: Renomear componentes de UI

**User Story:** Como desenvolvedor, quero que os componentes React usem nomenclatura de Inbox, para que a estrutura de arquivos seja intuitiva.

#### Acceptance Criteria

1. THE System SHALL renomear `WuzapiUsersList.tsx` para `InboxList.tsx`
2. THE System SHALL renomear `UserEditForm.tsx` para `InboxEditForm.tsx` (quando se refere a inbox)
3. THE System SHALL renomear `CreateUserForm.tsx` para `CreateInboxForm.tsx` (quando se refere a inbox)
4. THE System SHALL atualizar todas as importações dos componentes renomeados
5. THE System SHALL manter exports antigos como aliases `@deprecated` para compatibilidade

### Requirement 4: Atualizar textos da interface do usuário

**User Story:** Como usuário do sistema, quero que a interface use termos claros como "Caixa de Entrada" ou "Inbox", para entender que estou gerenciando conexões WhatsApp e não usuários.

#### Acceptance Criteria

1. WHEN exibindo lista de instâncias WUZAPI, THE System SHALL usar título "Caixas de Entrada" ou "Inboxes" em vez de "Usuários do Sistema"
2. WHEN exibindo botão de criação, THE System SHALL usar "Nova Caixa de Entrada" ou "Novo Inbox" em vez de "Novo Usuário"
3. WHEN exibindo mensagens de erro/sucesso, THE System SHALL usar "inbox" ou "caixa de entrada" em vez de "usuário"
4. THE System SHALL atualizar tooltips e textos de ajuda para refletir a nova nomenclatura
5. THE System SHALL manter consistência entre português ("Caixa de Entrada") e inglês ("Inbox") conforme padrão do sistema

### Requirement 5: Atualizar rotas e navegação

**User Story:** Como desenvolvedor, quero que as rotas da aplicação reflitam a nomenclatura de Inbox, para que URLs sejam semânticas.

#### Acceptance Criteria

1. THE System SHALL criar nova rota `/admin/inboxes` para listar inboxes (mantendo `/admin/users` como redirect temporário)
2. THE System SHALL criar nova rota `/admin/inboxes/new` para criar inbox
3. THE System SHALL criar nova rota `/admin/inboxes/edit/:inboxId` para editar inbox
4. THE System SHALL manter rotas antigas com redirect 301 para compatibilidade
5. THE System SHALL atualizar navegação do sidebar para usar novas rotas

### Requirement 6: Atualizar endpoints do backend

**User Story:** Como desenvolvedor, quero que os endpoints da API usem nomenclatura de Inbox, para que a API seja consistente com o frontend.

#### Acceptance Criteria

1. THE System SHALL criar novos endpoints `/api/admin/inboxes/*` espelhando funcionalidade de `/api/admin/users/*`
2. THE System SHALL manter endpoints antigos `/api/admin/users/*` como aliases `@deprecated`
3. THE System SHALL atualizar documentação da API para refletir nova nomenclatura
4. THE System SHALL logar warnings quando endpoints deprecated forem usados

### Requirement 7: Atualizar documentação

**User Story:** Como desenvolvedor ou usuário, quero que a documentação use nomenclatura consistente de Inbox, para evitar confusão.

#### Acceptance Criteria

1. THE System SHALL atualizar README.md com nova nomenclatura
2. THE System SHALL atualizar guias de desenvolvimento em `/docs`
3. THE System SHALL atualizar comentários de código que mencionam "WuzAPI user"
4. THE System SHALL criar guia de migração explicando a mudança de nomenclatura

### Requirement 8: Manter compatibilidade retroativa

**User Story:** Como desenvolvedor, quero que a refatoração não quebre código existente, para que a migração seja gradual e segura.

#### Acceptance Criteria

1. THE System SHALL manter aliases `@deprecated` para todos os tipos, funções e componentes renomeados
2. THE System SHALL emitir warnings no console quando código deprecated for usado
3. THE System SHALL documentar timeline para remoção de código deprecated (sugestão: 3 meses)
4. THE System SHALL garantir que testes existentes continuem passando durante a migração

### Requirement 9: Distinguir claramente Inbox de User na UI

**User Story:** Como administrador, quero que a interface distinga claramente entre gerenciamento de Inboxes (WhatsApp) e gerenciamento de Users (pessoas), para não confundir as funcionalidades.

#### Acceptance Criteria

1. THE System SHALL usar ícones diferentes para Inbox (ex: MessageSquare, Inbox) e User (ex: User, Users)
2. THE System SHALL usar cores/estilos diferentes para seções de Inbox vs User no admin
3. THE System SHALL separar claramente no menu: "Inboxes (WhatsApp)" vs "Usuários (Pessoas)"
4. THE System SHALL adicionar descrições explicativas em cada seção

## Technical Notes

### Arquivos Principais a Modificar

**Frontend - Tipos:**
- `src/lib/wuzapi-types.ts` - Renomear interfaces
- `src/lib/wuzapi-utils.ts` - Atualizar funções de mapeamento
- `src/services/wuzapi.ts` - Renomear métodos

**Frontend - Componentes:**
- `src/components/admin/WuzapiUsersList.tsx` → `InboxList.tsx`
- `src/components/shared/forms/CreateUserForm.tsx` → `CreateInboxForm.tsx`
- `src/pages/admin/MultiUserManagement.tsx` - Atualizar imports e textos

**Backend - Rotas:**
- `server/routes/adminRoutes.js` - Adicionar novos endpoints
- `server/routes/index.js` - Registrar novas rotas

**Documentação:**
- `README.md`
- `docs/DEVELOPMENT_GUIDE.md`
- Steering files em `.kiro/steering/`

### Estratégia de Migração

1. **Fase 1**: Criar novos tipos/funções/componentes com nomenclatura correta
2. **Fase 2**: Criar aliases deprecated para código antigo
3. **Fase 3**: Migrar código interno para usar nova nomenclatura
4. **Fase 4**: Atualizar UI e documentação
5. **Fase 5**: Remover código deprecated após período de transição

### Mapeamento de Nomenclatura

| Antigo | Novo |
|--------|------|
| WuzAPIUser | Inbox |
| WuzAPIUserResponse | InboxResponse |
| WuzAPIUsersResponse | InboxListResponse |
| getUsers() | listInboxes() |
| getUser() | getInbox() |
| createUser() | createInbox() |
| updateUser() | updateInbox() |
| deleteUser() | deleteInbox() |
| WuzapiUsersList | InboxList |
| CreateUserForm | CreateInboxForm |
| UserEditForm | InboxEditForm |
| "Usuário WUZAPI" | "Inbox" ou "Caixa de Entrada" |
| "Novo Usuário" | "Novo Inbox" |
| /admin/users | /admin/inboxes |

