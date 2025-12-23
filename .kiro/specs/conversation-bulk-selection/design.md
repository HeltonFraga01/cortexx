# Design Document: Conversation Bulk Selection

## Overview

Este documento detalha o design técnico para implementar a funcionalidade de seleção em massa de conversas e corrigir os botões de ação rápida (QuickActions) na interface de chat.

A implementação modifica o componente `InboxSidebar.tsx` existente para:
1. Conectar os QuickActions às funções da API
2. Adicionar modo de seleção em massa com checkboxes
3. Implementar barra de ações em lote

## Architecture

A arquitetura existente será estendida com novos estados e componentes:

```
src/components/features/chat/
├── InboxSidebar.tsx        # Modificado: adicionar selection mode
├── ConversationItem.tsx    # Extraído: componente de item (já existe inline)
├── QuickActions.tsx        # Extraído: conectar às APIs
├── SelectionToolbar.tsx    # Novo: barra de ações em lote
└── hooks/
    └── useConversationSelection.ts  # Novo: hook para gerenciar seleção
```

### Design Decisions

1. **Hook-based State Management**: Escolhemos um hook customizado (`useConversationSelection`) em vez de Context para evitar re-renders desnecessários em componentes não relacionados à seleção.

2. **Set para IDs Selecionados**: Usamos `Set<number>` para armazenar IDs selecionados, garantindo O(1) para operações de add/delete/has.

3. **Escape Key Global**: O listener de Escape é registrado no hook para garantir comportamento consistente independente do foco do usuário.

4. **Promise.allSettled para Bulk Actions**: Permite que ações parcialmente bem-sucedidas sejam reportadas ao usuário, em vez de falhar completamente.

## Components and Interfaces

### 1. Hook useConversationSelection

```tsx
interface UseConversationSelectionReturn {
  // State
  isSelectionMode: boolean
  selectedIds: Set<number>
  
  // Actions
  enterSelectionMode: () => void
  exitSelectionMode: () => void
  toggleSelection: (id: number) => void
  selectAll: (ids: number[]) => void
  deselectAll: () => void
  
  // Computed
  selectedCount: number
  isAllSelected: (totalCount: number) => boolean
  isIndeterminate: (totalCount: number) => boolean
}

function useConversationSelection(): UseConversationSelectionReturn {
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  
  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true)
  }, [])
  
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false)
    setSelectedIds(new Set())
  }, [])
  
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])
  
  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids))
  }, [])
  
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])
  
  const selectedCount = selectedIds.size
  
  const isAllSelected = useCallback((totalCount: number) => {
    return totalCount > 0 && selectedIds.size === totalCount
  }, [selectedIds.size])
  
  const isIndeterminate = useCallback((totalCount: number) => {
    return selectedIds.size > 0 && selectedIds.size < totalCount
  }, [selectedIds.size])
  
  // Exit selection mode on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectionMode) {
        exitSelectionMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSelectionMode, exitSelectionMode])
  
  return {
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
    deselectAll,
    selectedCount,
    isAllSelected,
    isIndeterminate
  }
}
```

### 2. QuickActions Component (Corrigido)

```tsx
interface QuickActionsProps {
  conversation: Conversation
  onMarkRead: () => Promise<void>
  onMute: () => Promise<void>
  onResolve: () => Promise<void>
}

function QuickActions({ conversation, onMarkRead, onMute, onResolve }: QuickActionsProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const { toast } = useToast()
  
  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setIsLoading(action)
    try {
      await fn()
      toast({
        title: 'Sucesso',
        description: getSuccessMessage(action),
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao executar ação',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(null)
    }
  }
  
  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 bg-card border rounded-md shadow-sm p-0.5">
        {/* Mark as Read */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                handleAction('read', onMarkRead)
              }}
            >
              {isLoading === 'read' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <MailCheck className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Marcar como lida</TooltipContent>
        </Tooltip>
        
        {/* Mute/Unmute */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isLoading !== null}
              onClick={(e) => {
                e.stopPropagation()
                handleAction('mute', onMute)
              }}
            >
              {isLoading === 'mute' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : conversation.isMuted ? (
                <Bell className="h-3 w-3" />
              ) : (
                <BellOff className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {conversation.isMuted ? 'Ativar notificações' : 'Silenciar'}
          </TooltipContent>
        </Tooltip>
        
        {/* Resolve */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={isLoading !== null || conversation.status === 'resolved'}
              onClick={(e) => {
                e.stopPropagation()
                handleAction('resolve', onResolve)
              }}
            >
              {isLoading === 'resolve' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Resolver</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
```

### 3. SelectionToolbar Component

```tsx
interface SelectionToolbarProps {
  selectedCount: number
  totalCount: number
  isAllSelected: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onCancel: () => void
  onMarkAsRead: () => Promise<void>
  onMarkAsUnread: () => Promise<void>
  onResolve: () => Promise<void>
  onDelete: () => Promise<void>
}

function SelectionToolbar({
  selectedCount,
  totalCount,
  isAllSelected,
  onSelectAll,
  onDeselectAll,
  onCancel,
  onMarkAsRead,
  onMarkAsUnread,
  onResolve,
  onDelete
}: SelectionToolbarProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const { toast } = useToast()
  const { confirm, ConfirmDialog } = useConfirmDialog()
  
  const handleBulkAction = async (action: string, fn: () => Promise<void>, successMsg: string) => {
    setIsLoading(action)
    try {
      await fn()
      toast({
        title: 'Sucesso',
        description: `${selectedCount} ${successMsg}`,
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Falha ao executar ação',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(null)
    }
  }
  
  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Confirmar exclusão',
      description: `Tem certeza que deseja excluir ${selectedCount} conversa(s)? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      await handleBulkAction('delete', onDelete, 'conversa(s) excluída(s)')
    }
  }
  
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-primary/10 border-b">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={() => isAllSelected ? onDeselectAll() : onSelectAll()}
            aria-label="Selecionar todas"
          />
          <span className="text-sm font-medium">
            {isAllSelected ? 'Todas selecionadas' : `${selectedCount} selecionada(s)`}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('read', onMarkAsRead, 'conversa(s) marcada(s) como lida(s)')}
              >
                {isLoading === 'read' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como lidas</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('unread', onMarkAsUnread, 'conversa(s) marcada(s) como não lida(s)')}
              >
                {isLoading === 'unread' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Marcar como não lidas</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={isLoading !== null}
                onClick={() => handleBulkAction('resolve', onResolve, 'conversa(s) resolvida(s)')}
              >
                {isLoading === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Resolver</TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                disabled={isLoading !== null}
                onClick={handleDelete}
              >
                {isLoading === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
          
          <div className="w-px h-5 bg-border mx-1" />
          
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
      <ConfirmDialog />
    </>
  )
}
```

### 4. ConversationItem com Checkbox

```tsx
interface ConversationItemProps {
  conversation: Conversation
  isSelected: boolean
  isSelectionMode: boolean
  onSelect: () => void
  onToggleSelection: () => void
  onMarkRead: () => Promise<void>
  onMute: () => Promise<void>
  onResolve: () => Promise<void>
  showInboxBadge?: boolean
  inboxName?: string
}

function ConversationItem({
  conversation,
  isSelected,
  isSelectionMode,
  onSelect,
  onToggleSelection,
  onMarkRead,
  onMute,
  onResolve,
  showInboxBadge,
  inboxName
}: ConversationItemProps) {
  const isChecked = isSelectionMode && isSelected
  
  const handleClick = () => {
    if (isSelectionMode) {
      onToggleSelection()
    } else {
      onSelect()
    }
  }
  
  return (
    <div
      onClick={handleClick}
      className={cn(
        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
        isSelected && !isSelectionMode && 'bg-primary/10 border-l-2 border-primary',
        isChecked && 'bg-primary/20',
        !isSelected && !isChecked && 'hover:bg-muted/80'
      )}
    >
      {/* Checkbox - shown in selection mode */}
      {isSelectionMode && (
        <Checkbox
          checked={isChecked}
          onCheckedChange={onToggleSelection}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0"
        />
      )}
      
      {/* Avatar */}
      <Avatar className="h-11 w-11 ring-2 ring-background shrink-0">
        <AvatarImage src={conversation.contactAvatarUrl || undefined} loading="lazy" />
        <AvatarFallback>{getInitials(conversation)}</AvatarFallback>
      </Avatar>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* ... existing content ... */}
      </div>
      
      {/* QuickActions - hidden in selection mode */}
      {!isSelectionMode && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <QuickActions
            conversation={conversation}
            onMarkRead={onMarkRead}
            onMute={onMute}
            onResolve={onResolve}
          />
        </div>
      )}
    </div>
  )
}
```

### 5. InboxSidebar Header com Select Button

```tsx
// No header do InboxSidebar
<div className="flex items-center justify-between px-4 h-14 border-b">
  <div className="flex items-center gap-2">
    <h2 className="text-sm font-semibold">Conversas</h2>
    {isConnected !== undefined && (
      <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-green-500' : 'bg-red-500')} />
    )}
  </div>
  
  <div className="flex items-center gap-1">
    {!isSelectionMode && (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={enterSelectionMode}
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Selecionar</TooltipContent>
      </Tooltip>
    )}
    
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCollapse}>
      <ChevronLeft className="h-4 w-4" />
    </Button>
  </div>
</div>
```

## Data Models

Não há alterações nos modelos de dados. As funcionalidades utilizam as APIs existentes:

- `markConversationAsRead(id)` - Marcar como lida
- `markConversationAsUnread(id)` - Marcar como não lida
- `muteConversation(id, muted)` - Silenciar/Ativar notificações
- `updateConversation(id, { status: 'resolved' })` - Resolver
- `deleteConversation(id)` - Excluir

### Filter Integration (Requirement 6)

Para garantir que a seleção seja limpa quando filtros mudam, o hook deve ser integrado com o estado de filtros:

```tsx
// No InboxSidebar.tsx
const { exitSelectionMode } = useConversationSelection()

// Limpar seleção quando filtro/tab muda
useEffect(() => {
  exitSelectionMode()
}, [activeFilter, activeTab, exitSelectionMode])
```

Isso garante que:
- Mudança de filtro limpa a seleção (Req 6.1)
- "Select All" só seleciona conversas visíveis no filtro atual (Req 6.2)
- Conversas selecionadas que recebem novas mensagens mantêm a seleção (Req 6.3 - gerenciado pelo Set de IDs)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Quick Action Mark as Read

*For any* conversation with unreadCount > 0, clicking the "Mark as Read" quick action SHALL result in unreadCount becoming 0 and the API `markConversationAsRead` being called.

**Validates: Requirements 1.1**

### Property 2: Quick Action Mute Toggle

*For any* conversation, clicking the "Mute" quick action SHALL toggle the `isMuted` state and call `muteConversation` with the opposite value.

**Validates: Requirements 1.2**

### Property 3: Quick Action Resolve

*For any* conversation with status !== 'resolved', clicking the "Resolve" quick action SHALL change status to 'resolved' via `updateConversation`.

**Validates: Requirements 1.3**

### Property 4: Quick Action Toast Feedback

*For any* quick action execution, the system SHALL display a toast notification - success toast on completion, error toast with failure reason on error.

**Validates: Requirements 1.4, 1.5**

### Property 5: Selection Mode Exit Methods

*For any* active selection mode, pressing Escape key OR clicking "Cancel" button SHALL exit selection mode and clear all selections.

**Validates: Requirements 2.4**

### Property 6: Selection Mode Checkbox Visibility

*For any* conversation item when `isSelectionMode` is true, the component SHALL render a visible Checkbox element.

**Validates: Requirements 2.2, 2.3**

### Property 7: Checkbox Toggle Selection

*For any* conversation in selection mode, clicking its checkbox SHALL toggle its presence in the `selectedIds` set.

**Validates: Requirements 3.1**

### Property 8: Select All Behavior

*For any* list of visible conversations, clicking "Select All" SHALL add all conversation IDs to `selectedIds` when not all are selected, or clear `selectedIds` when all are selected.

**Validates: Requirements 3.2, 3.3, 6.2**

### Property 9: Indeterminate Checkbox State

*For any* selection state where 0 < selectedCount < totalCount, the "Select All" checkbox SHALL display indeterminate state.

**Validates: Requirements 3.4**

### Property 10: Selection Toolbar Visibility

*For any* selection state where selectedCount > 0, the SelectionToolbar component SHALL be rendered showing action buttons (Mark as Read, Mark as Unread, Resolve, Delete).

**Validates: Requirements 4.1, 4.2**

### Property 11: Bulk Action Execution

*For any* set of selected conversation IDs, executing a bulk action SHALL call the corresponding API function for each ID in the set.

**Validates: Requirements 4.3**

### Property 12: Bulk Action Success Feedback

*For any* successful bulk action, the system SHALL display a success toast showing the count of affected conversations.

**Validates: Requirements 4.4**

### Property 13: Bulk Action Partial Failure

*For any* bulk action where some operations fail, the system SHALL display a warning toast indicating how many succeeded and how many failed.

**Validates: Requirements 4.5**

### Property 14: Bulk Action Cleanup

*For any* bulk action completion (success or failure), the system SHALL exit selection mode and clear all selections.

**Validates: Requirements 4.6**

### Property 15: Selected Item Highlight

*For any* conversation where its ID is in `selectedIds`, the component SHALL apply the highlight class (bg-primary/20).

**Validates: Requirements 5.1**

### Property 16: Checkbox Animation

*For any* transition into selection mode, the checkboxes SHALL appear with a smooth transition animation.

**Validates: Requirements 5.2**

### Property 17: Selection Count Update

*For any* change to `selectedIds`, the SelectionToolbar SHALL immediately reflect the new count.

**Validates: Requirements 5.3**

### Property 18: All Selected Text Display

*For any* selection state where all visible conversations are selected, the toolbar SHALL display "Todas selecionadas" instead of the numeric count.

**Validates: Requirements 5.4**

### Property 19: Filter Change Clears Selection

*For any* change to conversation filters or active tab, the system SHALL clear `selectedIds` and exit selection mode.

**Validates: Requirements 6.1**

### Property 20: Selection Persistence on Message Update

*For any* conversation in `selectedIds` that receives a new message, the conversation SHALL remain in `selectedIds`.

**Validates: Requirements 6.3**

## Error Handling

### Quick Action Errors

```tsx
const handleQuickAction = async (action: () => Promise<void>, successMsg: string) => {
  try {
    await action()
    toast({ title: 'Sucesso', description: successMsg })
  } catch (error) {
    toast({
      title: 'Erro',
      description: error instanceof Error ? error.message : 'Falha ao executar ação',
      variant: 'destructive'
    })
  }
}
```

### Bulk Action Errors

```tsx
const handleBulkAction = async (ids: number[], action: (id: number) => Promise<void>) => {
  const results = await Promise.allSettled(ids.map(id => action(id)))
  
  const succeeded = results.filter(r => r.status === 'fulfilled').length
  const failed = results.filter(r => r.status === 'rejected').length
  
  if (failed === 0) {
    toast({ title: 'Sucesso', description: `${succeeded} conversa(s) atualizada(s)` })
  } else if (succeeded === 0) {
    toast({ title: 'Erro', description: 'Falha ao atualizar conversas', variant: 'destructive' })
  } else {
    toast({
      title: 'Parcialmente concluído',
      description: `${succeeded} sucesso, ${failed} falha(s)`,
      variant: 'warning'
    })
  }
  
  exitSelectionMode()
}
```

## Testing Strategy

### Unit Tests

- Testar hook `useConversationSelection` com diferentes cenários
- Testar QuickActions com mocks das funções de API
- Testar SelectionToolbar com diferentes estados de seleção

### Property-Based Tests

Usar Vitest com fast-check:

```typescript
import { test, fc } from '@fast-check/vitest'

// Property 7: Checkbox toggle
test.prop([fc.integer({ min: 1, max: 1000 })])('checkbox toggle adds/removes from selection', (id) => {
  const { result } = renderHook(() => useConversationSelection())
  
  // Initially not selected
  expect(result.current.selectedIds.has(id)).toBe(false)
  
  // Toggle on
  act(() => result.current.toggleSelection(id))
  expect(result.current.selectedIds.has(id)).toBe(true)
  
  // Toggle off
  act(() => result.current.toggleSelection(id))
  expect(result.current.selectedIds.has(id)).toBe(false)
})

// Property 8: Select all behavior
test.prop([fc.array(fc.integer({ min: 1, max: 1000 }), { minLength: 1, maxLength: 100 })])(
  'select all adds all IDs',
  (ids) => {
    const { result } = renderHook(() => useConversationSelection())
    
    act(() => result.current.selectAll(ids))
    
    ids.forEach(id => {
      expect(result.current.selectedIds.has(id)).toBe(true)
    })
    expect(result.current.selectedCount).toBe(ids.length)
  }
)
```

### Integration Tests

- Testar fluxo completo de seleção e ação em lote
- Testar interação entre filtros e seleção
- Testar feedback visual durante ações
