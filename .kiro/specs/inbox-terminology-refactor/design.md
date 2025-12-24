# Design Document

## Overview

Este documento descreve o design técnico para refatorar a nomenclatura do sistema, substituindo "WuzAPIUser" e termos relacionados por "Inbox" (Caixa de Entrada). A refatoração será feita de forma gradual, mantendo compatibilidade retroativa através de aliases deprecated.

## Architecture

### Estratégia de Migração em Fases

```
┌─────────────────────────────────────────────────────────────────┐
│                    Migração de Nomenclatura                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Fase 1: Criar novos tipos/interfaces                           │
│  ├── Inbox, InboxResponse, InboxListResponse                    │
│  └── Aliases @deprecated para tipos antigos                     │
│                                                                 │
│  Fase 2: Criar novos métodos no serviço                         │
│  ├── listInboxes(), getInbox(), createInbox(), etc.             │
│  └── Aliases @deprecated para métodos antigos                   │
│                                                                 │
│  Fase 3: Criar novos componentes                                │
│  ├── InboxList, InboxEditForm, CreateInboxForm                  │
│  └── Re-exports @deprecated para componentes antigos            │
│                                                                 │
│  Fase 4: Criar novas rotas                                      │
│  ├── /admin/inboxes, /admin/inboxes/new, etc.                   │
│  └── Redirects 301 para rotas antigas                           │
│                                                                 │
│  Fase 5: Atualizar UI e documentação                            │
│  └── Textos, ícones, descrições                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Mapeamento de Arquivos

```
Tipos (src/lib/wuzapi-types.ts):
  WuzAPIUser          → Inbox
  WuzAPIUserResponse  → InboxResponse
  WuzAPIUsersResponse → InboxListResponse

Serviço (src/services/wuzapi.ts):
  getUsers()    → listInboxes()
  getUser()     → getInbox()
  createUser()  → createInbox()
  updateUser()  → updateInbox()
  deleteUser()  → deleteInbox()

Componentes:
  WuzapiUsersList.tsx  → InboxList.tsx
  CreateUserForm.tsx   → CreateInboxForm.tsx (para inbox)
  UserEditForm.tsx     → InboxEditForm.tsx (para inbox)

Rotas Frontend:
  /admin/users         → /admin/inboxes
  /admin/users/new     → /admin/inboxes/new
  /admin/users/edit/:id → /admin/inboxes/edit/:id

Rotas Backend:
  /api/admin/users     → /api/admin/inboxes
```

## Components and Interfaces

### Novos Tipos TypeScript

```typescript
// src/lib/wuzapi-types.ts

/**
 * Representa uma caixa de entrada WhatsApp conectada via WUZAPI.
 * Anteriormente chamada de WuzAPIUser.
 */
export interface Inbox {
  id: string;
  phone: string;
  name: string;
  token: string;
  jid: string;
  connected: boolean;
  loggedIn: boolean;
  webhook?: string;
  events?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type InboxResponse = WuzAPIResponse<Inbox>;
export type InboxListResponse = WuzAPIResponse<Inbox[]>;

// Aliases deprecated para compatibilidade
/** @deprecated Use Inbox instead */
export type WuzAPIUser = Inbox;
/** @deprecated Use InboxResponse instead */
export type WuzAPIUserResponse = InboxResponse;
/** @deprecated Use InboxListResponse instead */
export type WuzAPIUsersResponse = InboxListResponse;
```

### Novos Métodos no Serviço

```typescript
// src/services/wuzapi.ts

export class WuzAPIService {
  /**
   * Lista todas as caixas de entrada (inboxes) do sistema.
   */
  async listInboxes(): Promise<InboxListResponse> {
    // Implementação existente de getUsers()
  }

  /**
   * Obtém uma caixa de entrada específica pelo ID.
   */
  async getInbox(id: string): Promise<InboxResponse> {
    // Implementação existente de getUser()
  }

  /**
   * Cria uma nova caixa de entrada.
   */
  async createInbox(data: CreateInboxPayload): Promise<InboxResponse> {
    // Implementação existente de createUser()
  }

  /**
   * Atualiza uma caixa de entrada existente.
   */
  async updateInbox(id: string, data: UpdateInboxPayload): Promise<InboxResponse> {
    // Implementação existente de updateUser()
  }

  /**
   * Remove uma caixa de entrada.
   */
  async deleteInbox(id: string): Promise<WuzAPIResponse> {
    // Implementação existente de deleteUser()
  }

  // Aliases deprecated
  /** @deprecated Use listInboxes() instead */
  async getUsers(): Promise<InboxListResponse> {
    console.warn('[DEPRECATED] getUsers() is deprecated. Use listInboxes() instead.');
    return this.listInboxes();
  }

  /** @deprecated Use getInbox() instead */
  async getUser(id: string): Promise<InboxResponse> {
    console.warn('[DEPRECATED] getUser() is deprecated. Use getInbox() instead.');
    return this.getInbox(id);
  }

  // ... outros aliases
}
```

### Novos Componentes React

```typescript
// src/components/admin/InboxList.tsx
export function InboxList() {
  // Implementação baseada em WuzapiUsersList
  // Com textos atualizados para "Caixa de Entrada"
}

// src/components/admin/index.ts (re-exports)
export { InboxList } from './InboxList';
/** @deprecated Use InboxList instead */
export { InboxList as WuzapiUsersList } from './InboxList';
```

### Novas Rotas

```typescript
// src/pages/admin/AdminDashboard.tsx
<Routes>
  {/* Novas rotas */}
  <Route path="inboxes" element={<InboxList />} />
  <Route path="inboxes/new" element={<CreateInboxForm />} />
  <Route path="inboxes/edit/:inboxId" element={<InboxEditForm />} />
  
  {/* Redirects para compatibilidade */}
  <Route path="users" element={<Navigate to="/admin/inboxes" replace />} />
  <Route path="users/new" element={<Navigate to="/admin/inboxes/new" replace />} />
  <Route path="users/edit/:id" element={<Navigate to={`/admin/inboxes/edit/${id}`} replace />} />
</Routes>
```

## Data Models

### Inbox (antes WuzAPIUser)

```typescript
interface Inbox {
  // Identificação
  id: string;              // ID único no WUZAPI
  phone: string;           // Número de telefone
  name: string;            // Nome da caixa de entrada
  token: string;           // Token de autenticação WUZAPI
  
  // Status de conexão
  jid: string;             // JID do WhatsApp (formato: 5531xxx@s.whatsapp.net)
  connected: boolean;      // Se está conectado ao servidor
  loggedIn: boolean;       // Se está autenticado no WhatsApp
  
  // Configurações
  webhook?: string;        // URL do webhook configurado
  events?: string[];       // Eventos habilitados para webhook
  
  // Metadados
  createdAt?: string;      // Data de criação
  updatedAt?: string;      // Data de última atualização
}
```

### Payloads de Operação

```typescript
interface CreateInboxPayload {
  name: string;
  phone?: string;
  webhook?: string;
  events?: string[];
}

interface UpdateInboxPayload {
  name?: string;
  webhook?: string;
  events?: string[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Equivalência de Tipos

*For any* objeto que era válido como `WuzAPIUser`, esse mesmo objeto deve ser válido como `Inbox`, pois os tipos são estruturalmente idênticos.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Equivalência de Métodos CRUD

*For any* chamada válida aos métodos antigos (`getUsers`, `getUser`, `createUser`, `updateUser`, `deleteUser`), a chamada equivalente aos novos métodos (`listInboxes`, `getInbox`, `createInbox`, `updateInbox`, `deleteInbox`) deve retornar resultado estruturalmente idêntico.

**Validates: Requirements 2.2, 2.3, 2.4, 2.5, 2.6**

### Property 3: Equivalência de Rotas

*For any* rota antiga (`/admin/users/*`), acessá-la deve resultar em redirect para a rota nova equivalente (`/admin/inboxes/*`), e a rota nova deve renderizar o mesmo conteúdo funcional.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 4: Equivalência de Endpoints API

*For any* request válido aos endpoints antigos (`/api/admin/users/*`), o endpoint novo equivalente (`/api/admin/inboxes/*`) deve retornar resposta estruturalmente idêntica.

**Validates: Requirements 6.1, 6.2**

### Property 5: Ausência de Terminologia Antiga na UI

*For any* string visível na interface relacionada a inboxes, essa string não deve conter os termos "usuário WUZAPI", "WuzAPI user", ou "Usuários do Sistema" quando se referindo a inboxes.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 6: Warnings de Deprecação

*For any* uso de código deprecated (tipos, métodos, componentes antigos), o sistema deve emitir warning no console indicando a alternativa recomendada.

**Validates: Requirements 2.7, 8.1, 8.2**

## Error Handling

### Erros de Migração

1. **Import não encontrado**: Se código tentar importar tipo/componente antigo que foi removido
   - Solução: Manter aliases deprecated por período de transição
   - Log: Warning indicando uso de código deprecated

2. **Rota não encontrada**: Se usuário acessar rota antiga após remoção
   - Solução: Manter redirects permanentes (301)
   - Fallback: Página 404 com link para nova rota

3. **Endpoint deprecated**: Se cliente usar endpoint antigo
   - Solução: Manter endpoint funcionando com warning no log
   - Header: `Deprecation: true` na resposta

### Mensagens de Erro Atualizadas

```typescript
// Antes
throw new Error('Erro ao criar usuário');

// Depois
throw new Error('Erro ao criar caixa de entrada');
```

## Testing Strategy

### Testes Unitários

1. **Tipos**: Verificar que `Inbox` e `WuzAPIUser` são estruturalmente compatíveis
2. **Serviço**: Testar que novos métodos retornam mesmos dados que antigos
3. **Componentes**: Snapshot tests para verificar renderização correta

### Testes de Integração

1. **Rotas**: Verificar redirects funcionam corretamente
2. **API**: Verificar endpoints novos e antigos retornam mesmos dados
3. **UI**: Verificar textos atualizados aparecem corretamente

### Testes E2E (Cypress)

1. **Navegação**: Testar fluxo completo de gerenciamento de inboxes
2. **Compatibilidade**: Testar que rotas antigas redirecionam corretamente
3. **UI**: Verificar ausência de terminologia antiga

### Property-Based Tests

Usar Vitest com `fast-check` para:
- Testar equivalência de tipos
- Testar equivalência de métodos
- Testar ausência de strings proibidas

```typescript
import fc from 'fast-check';
import { describe, it, expect } from 'vitest';

describe('Inbox type equivalence', () => {
  it('should accept any valid WuzAPIUser as Inbox', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string(),
          phone: fc.string(),
          name: fc.string(),
          token: fc.string(),
          jid: fc.string(),
          connected: fc.boolean(),
          loggedIn: fc.boolean(),
        }),
        (data) => {
          // Se é válido como WuzAPIUser, deve ser válido como Inbox
          const inbox: Inbox = data;
          const wuzapiUser: WuzAPIUser = data;
          expect(inbox).toEqual(wuzapiUser);
        }
      )
    );
  });
});
```

## Implementation Notes

### Ordem de Implementação

1. **Tipos primeiro**: Criar novos tipos antes de modificar código que os usa
2. **Serviço depois**: Atualizar serviço com novos métodos
3. **Componentes em seguida**: Criar novos componentes
4. **Rotas por último**: Atualizar rotas após componentes prontos

### Checklist de Arquivos

**Frontend:**
- [ ] `src/lib/wuzapi-types.ts` - Novos tipos
- [ ] `src/lib/wuzapi-utils.ts` - Funções de mapeamento
- [ ] `src/services/wuzapi.ts` - Novos métodos
- [ ] `src/components/admin/InboxList.tsx` - Novo componente
- [ ] `src/components/admin/CreateInboxForm.tsx` - Novo componente
- [ ] `src/components/admin/InboxEditForm.tsx` - Novo componente
- [ ] `src/pages/admin/AdminDashboard.tsx` - Novas rotas

**Backend:**
- [ ] `server/routes/adminInboxRoutes.js` - Novos endpoints
- [ ] `server/routes/index.js` - Registrar novas rotas

**Documentação:**
- [ ] `README.md` - Atualizar nomenclatura
- [ ] `docs/MIGRATION_GUIDE.md` - Guia de migração
- [ ] `.kiro/steering/` - Atualizar steering files

