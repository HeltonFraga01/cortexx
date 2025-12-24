# Design Document: User Card Enhancement

## Overview

Este documento descreve o design para melhorar o componente de listagem de usuários na área administrativa. As melhorias incluem renomear a seção, enriquecer as informações exibidas nos cards e melhorar a organização visual.

## Architecture

A implementação envolve modificações em dois componentes existentes:

1. **SupabaseUsersList.tsx** - Componente de listagem (renomear títulos)
2. **SupabaseUserCard.tsx** - Componente de card individual (enriquecer informações)

Não há necessidade de novos endpoints de API, pois todas as informações necessárias já estão disponíveis:
- `last_sign_in_at` - Último login (já disponível no SupabaseUser)
- `created_at` - Data de criação (já disponível)
- `email_confirmed_at` - Confirmação de email (já disponível)
- `subscription` - Informações de assinatura (já carregadas em batch)

```
┌─────────────────────────────────────────────────────────────┐
│                    SupabaseUsersList                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Header: "Usuários" + Botões (Refresh, Novo Usuário)  │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Search Input                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐│
│  │ SupabaseUserCard│ │ SupabaseUserCard│ │ SupabaseUserCard││
│  │ ┌─────────────┐ │ │ ┌─────────────┐ │ │ ┌─────────────┐ ││
│  │ │Avatar + Info│ │ │ │Avatar + Info│ │ │ │Avatar + Info│ ││
│  │ │- Email      │ │ │ │- Email      │ │ │ │- Email      │ ││
│  │ │- Role Badge │ │ │ │- Role Badge │ │ │ │- Role Badge │ ││
│  │ │- Plan Badge │ │ │ │- Plan Badge │ │ │ │- Plan Badge │ ││
│  │ │- Status     │ │ │ │- Status     │ │ │ │- Status     │ ││
│  │ │- Last Login │ │ │ │- Last Login │ │ │ │- Last Login │ ││
│  │ │- Created At │ │ │ │- Created At │ │ │ │- Created At │ ││
│  │ │- Email ✓/⚠  │ │ │ │- Email ✓/⚠  │ │ │ │- Email ✓/⚠  │ ││
│  │ └─────────────┘ │ │ └─────────────┘ │ │ └─────────────┘ ││
│  └─────────────────┘ └─────────────────┘ └─────────────────┘│
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Pagination                                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### SupabaseUserCard Props (Existing - No Changes)

```typescript
interface SupabaseUserCardProps {
  user: SupabaseUser
  subscription?: UserSubscription | null
  onEdit: (userId: string) => void
  onAssignPlan: (userId: string) => void
  onDelete: (userId: string, email: string) => void
}
```

### SupabaseUser Interface (Existing)

```typescript
interface SupabaseUser {
  id: string
  email?: string
  phone?: string
  email_confirmed_at?: string  // Usado para indicador de confirmação
  last_sign_in_at?: string     // Usado para último acesso
  user_metadata?: Record<string, any>  // Contém role
  created_at: string           // Usado para data de criação
  updated_at?: string
}
```

### Status Badge Configuration

```typescript
const statusConfig: Record<SubscriptionStatus, { 
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string 
}> = {
  trial: { label: 'Trial', variant: 'outline', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  active: { label: 'Ativo', variant: 'default', className: 'bg-green-50 text-green-700 border-green-200' },
  past_due: { label: 'Pagamento Pendente', variant: 'destructive' },
  canceled: { label: 'Cancelado', variant: 'secondary' },
  expired: { label: 'Expirado', variant: 'destructive' },
  suspended: { label: 'Suspenso', variant: 'destructive' }
}
```

## Data Models

Não há novos modelos de dados. Utilizamos os existentes:

- **SupabaseUser** - Dados do usuário do Supabase Auth
- **UserSubscription** - Dados de assinatura do usuário
- **Plan** - Dados do plano (nome, quotas, features)

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Status Badge Color Mapping

*For any* subscription status, the User_Card SHALL display a badge with the correct color scheme according to the status-to-color mapping (active=green, trial=blue, past_due/expired/suspended=red, canceled=gray).

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 2: Last Login Date Formatting

*For any* user with a `last_sign_in_at` value, the User_Card SHALL display the date in a human-readable format. *For any* user without a `last_sign_in_at` value, the User_Card SHALL display "Nunca acessou".

**Validates: Requirements 2.1, 2.2**

### Property 3: Email Confirmation Indicator

*For any* user, the User_Card SHALL display a green checkmark if `email_confirmed_at` is present, or an orange warning indicator if `email_confirmed_at` is null/undefined.

**Validates: Requirements 7.1, 7.2**

### Property 4: Required Information Display

*For any* user, the User_Card SHALL display: email, role (Admin/User), plan name (when available), and account creation date in dd/MM/yyyy format.

**Validates: Requirements 5.2, 5.3, 5.4, 6.1, 6.2**

### Property 5: Unassigned Inbox Filtering

*For any* search query, the inbox list SHALL only display inboxes that match the query by name or phone number AND are not assigned to any user.

**Validates: Requirements 8.2, 8.3**

### Property 6: Inbox Assignment Idempotence

*For any* inbox assignment operation, assigning the same inbox to the same user multiple times SHALL result in the same state (inbox linked to user exactly once).

**Validates: Requirements 8.5**

## Assign Existing Inbox Feature

### Component Structure

O dialog `CreateUserInboxDialog` será expandido para suportar dois modos:
1. **Criar Nova** - Comportamento atual
2. **Atribuir Existente** - Nova funcionalidade

```
┌─────────────────────────────────────────────────────────────┐
│  Gerenciar Caixa de Entrada                            [X]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐ ┌─────────────────┐                   │
│  │   Criar Nova    │ │Atribuir Existente│  ← Tabs          │
│  └─────────────────┘ └─────────────────┘                   │
│                                                             │
│  [Tab: Atribuir Existente]                                 │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ 🔍 Buscar inbox por nome ou telefone...               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ ○ WhatsApp Vendas                                     │ │
│  │   📱 WhatsApp • 5511999999999                         │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ ○ Suporte Técnico                                     │ │
│  │   📱 WhatsApp • 5511888888888                         │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ ○ API Integration                                     │ │
│  │   🔌 API • Sem telefone                               │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│                        [Cancelar] [Atribuir Inbox]         │
└─────────────────────────────────────────────────────────────┘
```

### API Endpoint

Novo endpoint para listar inboxes não atribuídas:

```javascript
// GET /api/admin/inboxes/unassigned
// Response:
{
  success: true,
  data: [
    {
      id: "uuid",
      name: "WhatsApp Vendas",
      channel_type: "whatsapp",
      phone_number: "5511999999999",
      created_at: "2024-01-01T00:00:00Z"
    }
  ]
}
```

Endpoint para atribuir inbox a usuário:

```javascript
// POST /api/admin/users/:userId/inboxes/assign
// Body: { inbox_id: "uuid" }
// Response:
{
  success: true,
  data: { /* user_inbox record */ }
}
```

### Interface Updates

```typescript
interface UnassignedInbox {
  id: string
  name: string
  channel_type: 'whatsapp' | 'email' | 'web' | 'api'
  phone_number?: string
  created_at: string
}

// Service method
async getUnassignedInboxes(): Promise<UnassignedInbox[]>
async assignInboxToUser(userId: string, inboxId: string): Promise<void>
```

## Error Handling

### Missing Data Scenarios

| Field | Fallback Display |
|-------|------------------|
| `email` | "Sem email" |
| `last_sign_in_at` | "Nunca acessou" |
| `subscription` | Badge "Sem plano" |
| `phone` | Não exibir campo |

### Date Formatting Errors

Se uma data for inválida, exibir "-" como fallback.

```typescript
const formatDate = (dateString?: string) => {
  if (!dateString) return '-'
  try {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR })
  } catch {
    return '-'
  }
}
```

## Testing Strategy

### Unit Tests

1. **Text Changes**: Verificar que os títulos foram alterados corretamente
2. **Date Formatting**: Testar formatação de datas válidas e inválidas
3. **Status Badge Mapping**: Testar cada status retorna o badge correto

### Property-Based Tests

Utilizaremos **Vitest** com a biblioteca **fast-check** para property-based testing.

Configuração: Mínimo 100 iterações por teste.

1. **Property 1**: Gerar status aleatórios e verificar mapeamento de cores
2. **Property 2**: Gerar datas aleatórias e verificar formatação
3. **Property 3**: Gerar usuários com/sem email_confirmed_at e verificar indicador
4. **Property 4**: Gerar usuários aleatórios e verificar presença de informações obrigatórias

### Test File Location

```
src/components/admin/__tests__/SupabaseUserCard.test.tsx
```
