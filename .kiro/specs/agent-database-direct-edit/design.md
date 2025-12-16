# Design Document: Agent Database Direct Edit Navigation

## Overview

Esta feature modifica o comportamento de navegação do menu de databases no AgentLayout para redirecionar diretamente para a página de edição quando há apenas um registro associado ao agente. Isso replica o comportamento já existente no componente `DynamicDatabaseItems` do dashboard do usuário.

## Architecture

A implementação segue a arquitetura existente do sistema:

```
┌─────────────────────────────────────────────────────────────┐
│                    AgentLayout                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Database Navigation Items                           │   │
│  │  - Carrega conexões via getAgentDatabaseConnections  │   │
│  │  - Ao clicar: busca registros via getAgentDatabaseData│  │
│  │  - Decide navegação baseado em quantidade de registros│  │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Navegação Condicional                               │   │
│  │  - 1 registro → /agent/database/{id}/edit/{recordId} │   │
│  │  - N registros → /agent/database/{id}                │   │
│  │  - 0 registros → Toast de erro                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Componentes Modificados

#### 1. AgentLayout.tsx

O componente principal que contém o menu lateral. Será modificado para:

1. Adicionar estado de loading por item de database
2. Implementar handler de clique que busca registros antes de navegar
3. Decidir a rota de navegação baseado na quantidade de registros

```typescript
interface DatabaseNavState {
  loadingId: string | null;
}

// Handler de clique no item de database
const handleDatabaseClick = async (connection: AgentDatabaseConnection) => {
  // Previne cliques múltiplos enquanto carrega
  if (loadingId) return;
  
  setLoadingId(connection.id);
  try {
    const records = await getAgentDatabaseData(connection.id);
    
    if (records.length === 0) {
      toast.error('Nenhum registro encontrado');
      return;
    }
    
    if (records.length === 1) {
      const recordId = records[0].Id || records[0].id;
      navigate(`/agent/database/${connection.id}/edit/${recordId}`);
    } else {
      navigate(`/agent/database/${connection.id}`);
    }
  } catch (error) {
    toast.error('Erro ao carregar dados');
  } finally {
    setLoadingId(null);
  }
};

// Renderização do item de menu com estado desabilitado durante loading
const isItemLoading = loadingId === connection.id;
const isDisabled = loadingId !== null; // Desabilita todos os itens durante loading

<SidebarMenuButton
  disabled={isDisabled}
  onClick={() => handleDatabaseClick(connection)}
>
  {isItemLoading ? <Loader2 className="animate-spin" /> : <Database />}
  <span>{connection.name}</span>
</SidebarMenuButton>
```

### Interfaces Existentes Utilizadas

```typescript
// De src/services/agent-auth.ts
interface AgentDatabaseConnection {
  id: string;
  name: string;
  type?: string;
  status?: string;
  accessLevel: 'view' | 'full';
}

// Função existente para buscar dados
function getAgentDatabaseData(connectionId: string | number): Promise<any[]>;
```

## Data Models

Não há alterações nos modelos de dados. A feature utiliza os modelos existentes:

- `AgentDatabaseConnection`: Representa uma conexão de database acessível ao agente
- Records do NocoDB: Registros retornados pela API com campo `id` ou `Id`

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Navigation Decision Based on Record Count

*For any* database connection and any number of records N returned by the API:
- If N = 0, the system should display an error toast and not navigate
- If N = 1, the system should navigate to `/agent/database/{connectionId}/edit/{recordId}`
- If N > 1, the system should navigate to `/agent/database/{connectionId}`

**Validates: Requirements 1.1, 1.2, 1.3, 3.1**

### Property 2: Loading State Lifecycle and Item Disabled State

*For any* database item click, the loading state should follow this lifecycle:
1. Before click: `loadingId = null`, all items enabled
2. After click, before API response: `loadingId = connectionId`, clicked item shows spinner, all items disabled
3. After API response (success or error): `loadingId = null`, all items enabled, spinner removed

**Validates: Requirements 1.4, 2.1, 2.2**

### Property 3: Error Handling Consistency

*For any* API error during record fetching, the system should:
- Display a toast notification with error message
- Restore the menu item to its original state (not loading, not disabled)
- Not navigate to any new page

**Validates: Requirements 2.3**

## Error Handling

### Consistência com DynamicDatabaseItems

As mensagens de erro e o padrão de toasts devem seguir o mesmo formato utilizado no componente `DynamicDatabaseItems` do dashboard do usuário, garantindo uma experiência consistente entre os dois contextos.

### Cenários de Erro

| Cenário | Comportamento | Mensagem |
|---------|---------------|----------|
| Nenhum registro encontrado | Toast de erro, não navega | "Nenhum registro encontrado" |
| Erro de rede/API | Toast de erro, restaura estado | "Erro ao carregar dados" |
| Conexão não encontrada | Toast de erro | "Conexão não encontrada" |
| Acesso negado | Toast de erro | "Você não tem permissão para acessar esta conexão" |

### Implementação

```typescript
try {
  const records = await getAgentDatabaseData(connection.id);
  // ... lógica de navegação
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('not found')) {
      toast.error('Conexão não encontrada');
    } else if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      toast.error('Acesso negado', {
        description: 'Você não tem permissão para acessar esta conexão'
      });
    } else {
      toast.error('Erro ao carregar dados', {
        description: error.message
      });
    }
  } else {
    toast.error('Erro ao carregar dados');
  }
} finally {
  setLoadingId(null);
}
```

## Testing Strategy

### Dual Testing Approach

A feature será testada usando tanto testes unitários quanto testes baseados em propriedades.

### Property-Based Testing

Biblioteca: **Vitest** com **fast-check**

Os testes de propriedade verificarão:

1. **Navigation Decision Property**: Gerar arrays de registros com tamanhos variados (0, 1, N) e verificar que a decisão de navegação está correta
2. **Loading State Property**: Simular cliques e verificar que o estado de loading segue o ciclo de vida esperado
3. **Error Handling Property**: Simular erros de API e verificar que o tratamento de erro é consistente

### Unit Tests

Testes unitários cobrirão:

1. Renderização correta dos itens de database no menu
2. Comportamento do spinner de loading
3. Integração com o hook de navegação
4. Chamadas corretas à API

### Test Configuration

- Mínimo de 100 iterações para testes de propriedade
- Cada teste de propriedade deve referenciar a propriedade do design document
- Formato de tag: `**Feature: agent-database-direct-edit, Property {number}: {property_text}**`
