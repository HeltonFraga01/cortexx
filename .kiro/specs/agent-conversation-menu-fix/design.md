# Design Document: Agent Conversation Menu Fix

## Overview

Este documento descreve a solução para corrigir o menu de opções de conversa na interface de chat do agent. A correção envolve duas partes principais:

1. **Backend**: Adicionar a permissão `conversations:manage` ao sistema de permissões
2. **Frontend**: Esconder a opção "Excluir conversa" quando em modo agent e garantir que todas as operações de gerenciamento funcionem corretamente

## Architecture

A solução segue a arquitetura existente do sistema:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ├── ConversationView.tsx (menu de opções)                 │
│  ├── useChatApi.ts (isAgentMode flag)                      │
│  └── useToast.ts (notificações)                            │
├─────────────────────────────────────────────────────────────┤
│                    Backend (Express)                        │
│  ├── PermissionService.js (lista de permissões)            │
│  ├── AgentService.js (permissões por role)                 │
│  ├── agentChatRoutes.js (rotas protegidas)                 │
│  └── MacroService.js (execução de macros)                  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Components

#### PermissionService.js

Adicionar `conversations:manage` à lista `ALL_PERMISSIONS`:

```javascript
const ALL_PERMISSIONS = [
  'conversations:view',
  'conversations:create',
  'conversations:assign',
  'conversations:manage',  // NEW
  'conversations:delete',
  // ... other permissions
];
```

#### AgentService.js

Atualizar `DEFAULT_ROLE_PERMISSIONS` para incluir a nova permissão:

```javascript
const DEFAULT_ROLE_PERMISSIONS = {
  owner: ['*'],
  administrator: [
    'conversations:view', 'conversations:create', 'conversations:assign', 
    'conversations:manage', 'conversations:delete',  // manage added
    // ...
  ],
  agent: [
    'conversations:view', 'conversations:create', 'conversations:assign',
    'conversations:manage',  // NEW - allows status updates, muting, labels, macros
    // ...
  ],
  viewer: [
    'conversations:view',  // NO manage permission
    // ...
  ]
};
```

#### agentChatRoutes.js

As rotas que usam `conversations:manage` devem verificar a permissão:

```javascript
// PATCH /conversations/:id - Update conversation status/muted
router.patch('/conversations/:id', 
  requirePermission('conversations:manage'),
  async (req, res) => {
    // Handle status update, muted toggle
  }
);

// POST /conversations/:id/labels - Manage labels
router.post('/conversations/:id/labels',
  requirePermission('conversations:manage'),
  async (req, res) => {
    // Handle label assignment
  }
);

// DELETE /conversations/:id/labels/:labelId - Remove label
router.delete('/conversations/:id/labels/:labelId',
  requirePermission('conversations:manage'),
  async (req, res) => {
    // Handle label removal
  }
);

// POST /conversations/:id/macros/:macroId - Execute macro
router.post('/conversations/:id/macros/:macroId',
  requirePermission('conversations:manage'),
  async (req, res) => {
    // Handle macro execution
  }
);
```

### Frontend Components

#### ConversationView.tsx

Adicionar lógica para controlar visibilidade do menu de exclusão:

```typescript
interface ConversationViewProps {
  // ... existing props
}

// Inside component:
const chatApi = useChatApi()
const { toast } = useToast()
const canDelete = !chatApi.isAgentMode  // Only show delete in user mode

// Status update handler with toast notifications
const handleStatusUpdate = async (status: ConversationStatus) => {
  try {
    await chatApi.updateConversationStatus(conversationId, status)
    toast({
      title: 'Sucesso',
      description: `Conversa marcada como ${status}`,
    })
  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message || 'Falha ao atualizar status',
      variant: 'destructive',
    })
  }
}

// Muted toggle handler
const handleMutedToggle = async () => {
  try {
    await chatApi.toggleConversationMuted(conversationId)
    toast({
      title: 'Sucesso',
      description: conversation.muted ? 'Conversa reativada' : 'Conversa silenciada',
    })
  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message || 'Falha ao silenciar conversa',
      variant: 'destructive',
    })
  }
}

// Label management handlers
const handleLabelAssign = async (labelId: string) => {
  try {
    await chatApi.assignLabel(conversationId, labelId)
    // UI updates automatically via query invalidation
  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message || 'Falha ao atribuir label',
      variant: 'destructive',
    })
  }
}

const handleLabelRemove = async (labelId: string) => {
  try {
    await chatApi.removeLabel(conversationId, labelId)
    // UI updates automatically via query invalidation
  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message || 'Falha ao remover label',
      variant: 'destructive',
    })
  }
}

// Macro execution handler
const handleMacroExecute = async (macroId: string) => {
  try {
    await chatApi.executeMacro(conversationId, macroId)
    toast({
      title: 'Sucesso',
      description: 'Macro executada com sucesso',
    })
  } catch (error) {
    toast({
      title: 'Erro',
      description: error.message || 'Falha ao executar macro',
      variant: 'destructive',
    })
  }
}
```

Condicionar a renderização do menu:

```tsx
{/* Status options - always visible for agents with manage permission */}
<DropdownMenuItem onClick={() => handleStatusUpdate('resolved')}>
  <CheckCircle className="h-4 w-4 mr-2" />
  Marcar como resolvida
</DropdownMenuItem>

<DropdownMenuItem onClick={() => handleStatusUpdate('pending')}>
  <Clock className="h-4 w-4 mr-2" />
  Marcar como pendente
</DropdownMenuItem>

<DropdownMenuItem onClick={() => handleStatusUpdate('snoozed')}>
  <BellOff className="h-4 w-4 mr-2" />
  Adiar conversa
</DropdownMenuItem>

<DropdownMenuItem onClick={handleMutedToggle}>
  <VolumeX className="h-4 w-4 mr-2" />
  {conversation.muted ? 'Reativar conversa' : 'Silenciar conversa'}
</DropdownMenuItem>

{/* Delete option - only visible in user mode */}
{canDelete && <DropdownMenuSeparator />}

{canDelete && (
  <DropdownMenuItem 
    onClick={() => setShowDeleteDialog(true)}
    className="text-destructive focus:text-destructive"
  >
    <Trash2 className="h-4 w-4 mr-2" />
    Excluir conversa
  </DropdownMenuItem>
)}

{/* Delete dialog - only rendered when canDelete is true */}
{canDelete && showDeleteDialog && (
  <DeleteConfirmationDialog
    open={showDeleteDialog}
    onOpenChange={setShowDeleteDialog}
    onConfirm={handleDelete}
  />
)}
```

## Data Models

Não há alterações nos modelos de dados. A permissão é uma string que já é suportada pelo sistema existente.

### Conversation Status Values

```typescript
type ConversationStatus = 'open' | 'resolved' | 'pending' | 'snoozed'
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status update with valid status succeeds

*For any* conversation and any valid status (open, resolved, pending, snoozed), when an agent with `conversations:manage` permission updates the conversation status, the operation should succeed and the conversation status should be updated to the new value.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 2: Permission enforcement for manage operations

*For any* agent, if the agent has `conversations:manage` permission, then PATCH requests to update conversation properties should succeed. If the agent does NOT have `conversations:manage` permission, then PATCH requests should return 403 Forbidden.

**Validates: Requirements 2.5, 2.6**

### Property 3: Delete option visibility based on mode

*For any* chat interface state, if the interface is in agent mode then the delete option and its separator should not be rendered. If the interface is in user mode then the delete option and separator should be rendered.

**Validates: Requirements 3.1, 3.2, 3.4**

### Property 4: Label assignment round-trip

*For any* conversation and any valid label, assigning the label and then removing it should restore the conversation to its original label state.

**Validates: Requirements 4.1, 4.2**

### Property 5: Muted toggle round-trip

*For any* conversation, toggling the muted state twice should restore the conversation to its original muted state.

**Validates: Requirements 1.3**

### Property 6: Macro execution performs all actions

*For any* macro with defined actions and any conversation, executing the macro should result in all macro actions being performed on the conversation.

**Validates: Requirements 5.1**

## Error Handling

### Backend Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| FORBIDDEN | 403 | Agent lacks required permission |
| NOT_FOUND | 404 | Conversation not found |
| INVALID_STATUS | 400 | Invalid status value provided |
| ACCESS_DENIED | 403 | Agent doesn't have access to conversation's inbox |
| LABEL_NOT_FOUND | 404 | Label not found |
| MACRO_NOT_FOUND | 404 | Macro not found |
| MACRO_EXECUTION_FAILED | 500 | Macro action failed during execution |

### Frontend Error Handling

- All mutations use `onError` callbacks to display toast notifications (Requirements 1.6, 4.4, 5.3)
- Success operations display success toast notifications (Requirements 1.5, 5.2)
- Error messages are extracted from API response and displayed to user
- UI state is not updated on error (optimistic updates are rolled back)
- Label operations update UI automatically via TanStack Query invalidation (Requirement 4.3)

## Testing Strategy

### Unit Tests

1. **PermissionService tests**: Verify `conversations:manage` is in ALL_PERMISSIONS (Requirement 2.1)
2. **Role permission tests**: Verify each role has correct permissions (Requirements 2.2, 2.3, 2.4)
3. **ConversationView tests**: Verify delete option visibility based on mode (Requirements 3.1, 3.2, 3.3, 3.4)
4. **Toast notification tests**: Verify correct toast messages for success/error states

### Property-Based Tests

Using Vitest with fast-check for property-based testing:

1. **Status update property test**: Generate random valid statuses and verify updates succeed
   - **Feature: agent-conversation-menu-fix, Property 1: Status update with valid status succeeds**

2. **Permission enforcement property test**: Generate agents with/without permission and verify correct behavior
   - **Feature: agent-conversation-menu-fix, Property 2: Permission enforcement for manage operations**

3. **Delete visibility property test**: Generate agent/user mode states and verify correct rendering
   - **Feature: agent-conversation-menu-fix, Property 3: Delete option visibility based on mode**

4. **Label round-trip property test**: Generate random labels and verify assignment/removal round-trip
   - **Feature: agent-conversation-menu-fix, Property 4: Label assignment round-trip**

5. **Muted toggle property test**: Generate conversations and verify double toggle restores state
   - **Feature: agent-conversation-menu-fix, Property 5: Muted toggle round-trip**

6. **Macro execution property test**: Generate macros with actions and verify all actions are performed
   - **Feature: agent-conversation-menu-fix, Property 6: Macro execution performs all actions**

### Integration Tests

1. Test full flow of agent updating conversation status
2. Test permission denial for viewer role
3. Test UI menu rendering in agent vs user mode
4. Test label assignment and removal flow
5. Test macro execution flow

### Test Configuration

- Property tests should run minimum 100 iterations
- Each property test must be tagged with the correctness property it implements
- Format: `**Feature: agent-conversation-menu-fix, Property {number}: {property_text}**`
