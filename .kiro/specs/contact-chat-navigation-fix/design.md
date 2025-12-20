# Design Document: Contact Chat Navigation Fix

## Overview

Este documento descreve a solução para corrigir o bug de navegação do chat a partir da página de contatos. O problema ocorre porque o `ChatLayout` tenta carregar a conversa da URL antes que o `AgentInboxContext` esteja pronto, resultando em uma chamada de API com o modo errado ou falha silenciosa.

A solução envolve modificar o `useEffect` de carregamento de conversa no `ChatLayout` para aguardar que o `chatApi` esteja no modo correto antes de fazer a chamada.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Fluxo de Navegação                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ContactsTable                                               │
│     └── handleStartChat()                                       │
│         └── chatApi.startConversation(phone)                    │
│             └── navigate('/agent/chat?conversation={id}')       │
│                                                                 │
│  2. AgentChatPage                                               │
│     └── AgentInboxProvider (monta contexto)                     │
│         └── ChatLayout                                          │
│             └── useEffect (carrega conversa da URL)             │
│                 └── PROBLEMA: chatApi pode não estar pronto     │
│                                                                 │
│  SOLUÇÃO:                                                       │
│  - Adicionar estado de loading para carregamento da URL         │
│  - Verificar se chatApi.isAgentMode corresponde à rota          │
│  - Aguardar modo correto antes de carregar                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### ChatLayout Component (Modificações)

```typescript
interface ChatLayoutProps {
  className?: string
  isAgentMode?: boolean
}

// Novo estado para controlar carregamento da URL
const [isLoadingFromUrl, setIsLoadingFromUrl] = useState(false)
const [urlLoadError, setUrlLoadError] = useState<string | null>(null)

// useEffect modificado para aguardar modo correto
useEffect(() => {
  const conversationId = searchParams.get('conversation')
  
  // Verificar se há conversa para carregar e se o modo está correto
  if (!conversationId) return
  if (initialConversationLoaded.current) return
  
  // Aguardar o chatApi estar no modo correto
  // isAgentMode prop indica o modo esperado
  // chatApi.isAgentMode indica o modo atual
  if (isAgentMode !== chatApi.isAgentMode) {
    // Modo ainda não está correto, aguardar próximo render
    return
  }
  
  // Marcar como carregado para evitar múltiplas tentativas
  initialConversationLoaded.current = true
  setIsLoadingFromUrl(true)
  setUrlLoadError(null)
  
  const loadConversation = async () => {
    try {
      const conversation = await chatApi.getConversation(parseInt(conversationId, 10))
      if (conversation) {
        setSelectedConversation(conversation)
      }
    } catch (error) {
      console.error('Failed to load conversation from URL:', error)
      setUrlLoadError('Não foi possível carregar a conversa')
    } finally {
      setIsLoadingFromUrl(false)
      // Limpar URL após tentativa (sucesso ou erro)
      setSearchParams({}, { replace: true })
    }
  }
  
  loadConversation()
}, [searchParams, setSearchParams, chatApi, isAgentMode])
```

### EmptyState Component (Modificações)

```typescript
interface EmptyStateProps {
  onToggleSidebar: () => void
  isSidebarCollapsed: boolean
  isLoading?: boolean
  error?: string | null
}

function EmptyState({ 
  onToggleSidebar, 
  isSidebarCollapsed,
  isLoading,
  error 
}: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando conversa...</p>
        </div>
      </div>
    )
  }
  
  // Resto do componente com suporte a erro
}
```

## Data Models

Não há alterações em modelos de dados. A correção é puramente no fluxo de controle do componente.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Carregamento de Conversa com Modo Correto

*For any* conversation ID na URL e modo esperado (agente ou usuário), o ChatLayout SHALL aguardar que `chatApi.isAgentMode` corresponda ao `isAgentMode` prop antes de chamar `getConversation`.

**Validates: Requirements 1.2, 2.3**

### Property 2: Seleção de Conversa Após Carregamento Bem-Sucedido

*For any* conversation ID válido na URL, após carregamento bem-sucedido, `selectedConversation` SHALL ser igual à conversa retornada pela API e o parâmetro `conversation` SHALL ser removido da URL.

**Validates: Requirements 1.1, 1.3, 4.1**

### Property 3: Limpeza de Estado Após Erro

*For any* erro durante carregamento de conversa da URL, o estado `isLoadingFromUrl` SHALL ser `false`, `urlLoadError` SHALL conter uma mensagem de erro, e o parâmetro `conversation` SHALL ser removido da URL.

**Validates: Requirements 1.4, 3.3, 4.2**

### Property 4: Idempotência de Carregamento

*For any* conversation ID na URL, o carregamento SHALL ocorrer no máximo uma vez, mesmo que o componente re-renderize múltiplas vezes.

**Validates: Requirements 1.2**

## Error Handling

| Cenário | Tratamento |
|---------|------------|
| Conversa não encontrada (404) | Exibir erro "Conversa não encontrada", limpar URL |
| Erro de rede | Exibir erro "Não foi possível carregar a conversa", limpar URL |
| Modo incorreto | Aguardar modo correto (não é erro) |
| ID inválido na URL | Ignorar e limpar URL |

## Testing Strategy

### Unit Tests

1. **Teste de aguardar modo correto**: Verificar que o carregamento não ocorre quando `isAgentMode !== chatApi.isAgentMode`
2. **Teste de carregamento único**: Verificar que `initialConversationLoaded.current` previne múltiplos carregamentos
3. **Teste de limpeza de URL**: Verificar que `setSearchParams({}, { replace: true })` é chamado após carregamento

### Property-Based Tests

Usar Vitest com `@fast-check/vitest` para testes de propriedade:

1. **Property 1**: Gerar combinações de `isAgentMode` prop e `chatApi.isAgentMode`, verificar que carregamento só ocorre quando iguais
2. **Property 2**: Gerar IDs de conversa válidos, verificar estado final após carregamento
3. **Property 4**: Simular múltiplos renders, verificar que API é chamada apenas uma vez

### Integration Tests (Cypress)

1. Navegar de `/agent/contacts` para `/agent/chat?conversation=123`
2. Verificar que conversa é selecionada
3. Verificar que URL é limpa
4. Verificar que toast de erro aparece em caso de falha
