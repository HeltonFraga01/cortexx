# Design Document: Dashboard Connection Tab Enhancement

## Overview

Este documento descreve o design para aprimorar a aba "Conexão" do Dashboard do usuário, replicando a experiência visual e funcional da página de edição de inbox (`UserInboxEditPage`). A solução reutiliza a estrutura de layout já existente na página de edição, adaptando-a para o contexto do Dashboard.

## Architecture

A implementação seguirá uma abordagem de refatoração do componente `UserOverview.tsx`, substituindo o uso atual do `InboxInfoCard` compartilhado por um layout inline mais completo, similar ao usado em `UserInboxEditPage.tsx`.

```
┌─────────────────────────────────────────────────────────────┐
│                    UserOverview.tsx                         │
│                    (Aba Conexão)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Card: Informações da Conexão (Novo Layout)         │   │
│  │  ┌──────────┬────────────────────┬──────────────┐   │   │
│  │  │  Avatar  │  Info Principal    │ Ações Rápidas│   │   │
│  │  │  + Badge │  - Nome + Status   │ - QR Code    │   │   │
│  │  │          │  - ID + Copiar     │ - Atualizar  │   │   │
│  │  │          │  - JID + Copiar    │ - Config     │   │   │
│  │  │          │  - Token + Copiar  │              │   │   │
│  │  └──────────┴────────────────────┴──────────────┘   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ConnectionControlCard (Existente)                   │   │
│  │  - Botões: Conectar/Desconectar/Logout/QR           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  QR Code Card (Condicional)                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  WebhookConfigCard + CreditBalance                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Componente Modificado: UserOverview.tsx

O componente `UserOverview.tsx` será modificado para incluir o novo layout de card de informações na aba "Conexão".

```typescript
// Novo estado para controle de cópia
const [copiedField, setCopiedField] = useState<string | null>(null)

// Handler para copiar texto
const handleCopy = async (text: string, field: string) => {
  try {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    toast.success(`${field} copiado!`)
    setTimeout(() => setCopiedField(null), 2000)
  } catch {
    toast.error('Erro ao copiar')
  }
}
```

### Layout do Card de Informações

O novo card seguirá o mesmo padrão visual do `UserInboxEditPage`:

```typescript
interface ConnectionInfoCardProps {
  connectionData: {
    inboxId: string
    inboxName: string
    phoneNumber?: string
    jid?: string
    wuzapiToken: string
    profilePicture?: string
    isConnected: boolean
    isLoggedIn: boolean
  }
  sessionStatus: {
    connected: boolean
    loggedIn: boolean
  } | null
  onGenerateQR: () => void
  onRefreshStatus: () => void
  onNavigateToEdit: () => void
  loadingAction: 'qr' | 'refresh' | null
  copiedField: string | null
  onCopy: (text: string, field: string) => void
  avatarUrl: string | null
  loadingAvatar: boolean
  onRefreshAvatar: () => void
}
```

## Data Models

### Estado de Conexão (Prioridade de Fonte de Dados)

```typescript
// Prioridade: sessionStatus > connectionData
const isConnected = sessionStatus?.connected ?? connectionData?.isConnected ?? false
const isLoggedIn = sessionStatus?.loggedIn ?? connectionData?.isLoggedIn ?? false
```

### Estado de Loading para Ações

```typescript
type LoadingAction = 'connect' | 'disconnect' | 'logout' | 'qr' | 'refresh' | null
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Badge Rendering

*For any* combination de estados de conexão (connected, loggedIn), o badge de status SHALL renderizar a cor e texto corretos:
- loggedIn=true → Badge verde "Logado"
- connected=true && loggedIn=false → Badge amarelo "Conectado"  
- connected=false && loggedIn=false → Badge cinza "Offline"

**Validates: Requirements 1.7, 3.2**

### Property 2: Data Source Priority

*For any* cenário onde sessionStatus está disponível, o componente SHALL usar sessionStatus como fonte de verdade para isConnected e isLoggedIn, ignorando connectionData para esses campos.

**Validates: Requirements 5.1, 5.4**

### Property 3: Loading State Indicator

*For any* ação em progresso (loadingAction não é null), o botão correspondente SHALL exibir um indicador de loading (spinner) e estar desabilitado.

**Validates: Requirements 2.5**

### Property 4: Avatar Conditional Rendering

*For any* estado onde isLoggedIn=true e avatarUrl está disponível, o componente SHALL renderizar a imagem do avatar. Quando avatarUrl não está disponível, SHALL renderizar o fallback com ícone.

**Validates: Requirements 1.2, 1.3**

## Error Handling

1. **Falha ao copiar**: Exibir toast de erro "Erro ao copiar"
2. **Falha ao carregar avatar**: Manter fallback com ícone, não bloquear UI
3. **Falha ao atualizar status**: Exibir toast de erro, manter último estado conhecido
4. **Falha ao gerar QR**: Exibir toast de erro com mensagem descritiva

## Testing Strategy

### Unit Tests

- Verificar renderização do card com dados mockados
- Verificar comportamento dos botões de copiar
- Verificar navegação para página de edição
- Verificar estados de loading

### Property-Based Tests

Usar Vitest com fast-check para testar as propriedades de corretude:

1. **Property 1**: Gerar combinações aleatórias de (connected, loggedIn) e verificar badge correto
2. **Property 2**: Gerar cenários com/sem sessionStatus e verificar prioridade
3. **Property 3**: Gerar estados de loadingAction e verificar indicadores
4. **Property 4**: Gerar estados de (isLoggedIn, avatarUrl) e verificar renderização

### Integration Tests

- Testar fluxo completo de conexão na aba Conexão
- Testar sincronização de status com polling
- Testar navegação entre Dashboard e página de edição
