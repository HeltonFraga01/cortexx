# Design Document

## Overview

Este documento descreve a arquitetura técnica para criar componentes compartilhados de inbox que serão reutilizados entre a página de edição admin e o dashboard do usuário. A abordagem foca em extrair a lógica de apresentação em componentes "dumb" que recebem dados via props, mantendo a lógica de negócio nos containers específicos de cada contexto.

## Architecture

### Component Hierarchy

```
src/components/shared/inbox/
├── index.ts                      # Exports públicos
├── InboxInfoCard.tsx             # Informações da inbox (avatar, nome, token)
├── ConnectionControlCard.tsx     # Botões de conexão/desconexão
├── WebhookConfigCard.tsx         # Configuração de webhook e eventos
└── types.ts                      # Interfaces TypeScript compartilhadas

src/lib/adapters/
└── inbox-adapters.ts             # Funções de transformação de dados
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN CONTEXT                                │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │ WUZAPI Service  │───▶│ adaptWuzapiUser  │                    │
│  │ (direct API)    │    │ ToInboxInfo()    │                    │
│  └─────────────────┘    └────────┬─────────┘                    │
│                                  │                               │
│                                  ▼                               │
│                    ┌─────────────────────────┐                  │
│                    │   SHARED COMPONENTS     │                  │
│                    │  ┌─────────────────┐    │                  │
│                    │  │ InboxInfoCard   │    │                  │
│                    │  ├─────────────────┤    │                  │
│                    │  │ ConnectionCtrl  │    │                  │
│                    │  ├─────────────────┤    │                  │
│                    │  │ WebhookConfig   │    │                  │
│                    │  └─────────────────┘    │                  │
│                    └─────────────────────────┘                  │
│                                  ▲                               │
│                                  │                               │
│                    ┌─────────────┴─────────┐                    │
│  ┌─────────────────┐    ┌──────────────────┐                    │
│  │ Backend Proxy   │───▶│ adaptConnection  │                    │
│  │ (user APIs)     │    │ DataToInboxInfo()│                    │
│  └─────────────────┘    └──────────────────┘                    │
│                     USER CONTEXT                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Specifications

### InboxInfoCard

```typescript
// src/components/shared/inbox/types.ts
export interface InboxInfoCardProps {
  inbox: {
    id: string
    name: string
    phone?: string
    jid?: string
    token: string
    profilePicture?: string
  }
  connectionStatus: {
    isConnected: boolean
    isLoggedIn: boolean
  }
  variant?: 'compact' | 'full'
  onRefreshAvatar?: () => void
  isLoadingAvatar?: boolean
  className?: string
}
```

**Visual Design:**
- Avatar com indicador de status (círculo verde/cinza)
- Nome em destaque (text-lg font-semibold)
- Telefone formatado com ícone Phone
- JID com botão de copiar
- Token com toggle show/hide e botão copiar
- Badge de status (Conectado/Desconectado)

### ConnectionControlCard

```typescript
export interface ConnectionControlCardProps {
  connectionStatus: {
    isConnected: boolean
    isLoggedIn: boolean
  }
  isLoading?: boolean
  loadingAction?: 'connect' | 'disconnect' | 'logout' | 'qr'
  onConnect?: () => void
  onDisconnect?: () => void
  onLogout?: () => void
  onGenerateQR?: () => void
  className?: string
}
```

**Visual Design:**
- Card com título "Controle de Conexão"
- Botões coloridos baseados no estado:
  - Desconectado: "Conectar" (verde), "Gerar QR" (azul)
  - Conectado sem login: "Gerar QR" (azul, destaque)
  - Logado: "Desconectar" (laranja), "Logout" (vermelho)
- Loading spinner nos botões durante operações

### WebhookConfigCard

```typescript
export interface WebhookConfigCardProps {
  config: {
    webhookUrl: string
    events: string[]
  }
  availableEvents: Array<{
    value: string
    label: string
    category: string
  }>
  onChange?: (config: { webhookUrl: string; events: string[] }) => void
  onSave?: () => void
  isLoading?: boolean
  readOnly?: boolean
  hasChanges?: boolean
  className?: string
}
```

**Visual Design:**
- Card com título "Configuração de Webhook"
- Input de URL com validação visual
- Seção de eventos agrupados por categoria
- Checkbox "Todos os Eventos"
- Badge com contagem de eventos selecionados
- Botão "Salvar" (desabilitado se readOnly ou sem mudanças)

## Data Adapters

### adaptWuzapiUserToInboxInfo

```typescript
// src/lib/adapters/inbox-adapters.ts
import type { WuzAPIUser } from '@/services/wuzapi'
import type { InboxInfoCardProps } from '@/components/shared/inbox/types'

export function adaptWuzapiUserToInboxInfo(
  user: WuzAPIUser,
  avatarUrl?: string | null
): InboxInfoCardProps {
  return {
    inbox: {
      id: user.id,
      name: user.name,
      phone: user.jid?.split(':')[0],
      jid: user.jid,
      token: user.token,
      profilePicture: avatarUrl || undefined
    },
    connectionStatus: {
      isConnected: user.connected,
      isLoggedIn: user.loggedIn
    }
  }
}
```

### adaptConnectionDataToInboxInfo

```typescript
import type { InboxConnectionData } from '@/hooks/useInboxConnectionData'
import type { InboxInfoCardProps } from '@/components/shared/inbox/types'

export function adaptConnectionDataToInboxInfo(
  data: InboxConnectionData,
  sessionStatus: { connected?: boolean; loggedIn?: boolean } | null
): InboxInfoCardProps {
  return {
    inbox: {
      id: data.inboxId,
      name: data.inboxName,
      phone: data.phoneNumber,
      jid: data.jid || undefined,
      token: data.wuzapiToken,
      profilePicture: data.profilePicture || undefined
    },
    connectionStatus: {
      isConnected: sessionStatus?.connected ?? data.isConnected,
      isLoggedIn: sessionStatus?.loggedIn ?? false
    }
  }
}
```

## Migration Strategy

### Phase 1: Create Shared Components
1. Criar `src/components/shared/inbox/types.ts` com interfaces
2. Criar `InboxInfoCard.tsx` baseado em `UserInfoCardModern.tsx`
3. Criar `ConnectionControlCard.tsx` baseado em `ConnectionControlCardModern.tsx`
4. Criar `WebhookConfigCard.tsx` extraindo lógica de `UserEditForm.tsx`
5. Criar `index.ts` com exports

### Phase 2: Create Adapters
1. Criar `src/lib/adapters/inbox-adapters.ts`
2. Implementar `adaptWuzapiUserToInboxInfo`
3. Implementar `adaptConnectionDataToInboxInfo`
4. Adicionar testes unitários para adapters

### Phase 3: Integrate in User Dashboard
1. Substituir `UserInfoCardModern` por `InboxInfoCard`
2. Substituir `ConnectionControlCardModern` por `ConnectionControlCard`
3. Substituir `WebhookConfigCardModern` por `WebhookConfigCard`
4. Testar todas as funcionalidades

### Phase 4: Integrate in Admin Edit Page
1. Refatorar `UserEditForm.tsx` para usar componentes compartilhados
2. Manter seções específicas do admin (Supabase linking, delete actions)
3. Reduzir tamanho do arquivo significativamente
4. Testar todas as funcionalidades

### Phase 5: Cleanup
1. Deprecar componentes antigos em `src/components/user/dashboard/`
2. Atualizar imports em todo o projeto
3. Remover código duplicado

## Testing Strategy

- Unit tests para adapters (transformação de dados)
- Component tests para shared components (renderização, props)
- Integration tests para páginas admin e user
- E2E tests para fluxos críticos (conexão, webhook)

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Implementar em fases, manter componentes antigos até validação |
| Props mismatch between contexts | Medium | TypeScript strict mode, interfaces bem definidas |
| Performance regression | Low | Memoização com React.memo, useCallback para handlers |
| Visual inconsistencies | Medium | Usar mesmos tokens de design (Tailwind classes) |
