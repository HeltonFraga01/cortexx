# Design Document: User Dashboard Redesign

## Overview

Este documento descreve o redesign do dashboard do usuário para uma interface mais moderna, responsiva e visualmente consistente. O design utiliza como referência os componentes do painel de usuário no Admin (SupabaseUserCard, SupabaseUserStatsCard) que possuem um design mais limpo.

A arquitetura mantém a estrutura existente de componentes modulares, mas com melhorias significativas no layout, espaçamento e consistência visual.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         UserOverview (Container)                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    DashboardHeader                               │   │
│  │  [Avatar] [Welcome Message] [Date/Time]        [Refresh Button] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Tabs                                     │   │
│  │  [Dashboard] [Conexão]                                          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Dashboard Tab Content                         │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │              InboxOverviewSection (horizontal scroll)    │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                 │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │ Stats 1  │ │ Stats 2  │ │ Stats 3  │ │ Stats 4  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────┐ ┌─────────────────────────┐      │   │
│  │  │   MessageActivityChart  │ │   ConversationStats     │      │   │
│  │  └─────────────────────────┘ └─────────────────────────┘      │   │
│  │                                                                 │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │                  QuickActionsPanel                       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Connection Tab Content                        │   │
│  │  ┌─────────────────────────┐ ┌─────────────────────────┐       │   │
│  │  │     UserInfoCard        │ │   ConnectionControlCard │       │   │
│  │  └─────────────────────────┘ └─────────────────────────┘       │   │
│  │                                                                  │   │
│  │  ┌─────────────────────────┐ ┌─────────────────────────┐       │   │
│  │  │   WebhookConfigCard     │ │   QuotaSummaryCard      │       │   │
│  │  └─────────────────────────┘ └─────────────────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. DashboardHeader Component (New)

```typescript
interface DashboardHeaderProps {
  userName: string
  userAvatar?: string
  onRefresh: () => void
  isRefreshing: boolean
  lastUpdated?: Date
}
```

Layout:
- Flex container com justify-between
- Lado esquerdo: Avatar (h-10 w-10) + Nome + Welcome message
- Lado direito: Data/hora atual + Botão refresh com spinner

### 2. ModernStatsCard Component (New)

```typescript
interface ModernStatsCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  iconColor: 'blue' | 'green' | 'orange' | 'purple' | 'red'
  trend?: {
    value: number
    direction: 'up' | 'down' | 'neutral'
  }
  isLoading?: boolean
}
```

Design:
- Card com p-4 e rounded-xl
- Ícone em círculo colorido (p-2 rounded-lg)
- Valor em text-2xl font-bold
- Trend indicator com seta e porcentagem

Color mapping:
```typescript
const colorMap = {
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
}
```

### 3. ModernInboxCard Component (Refactored)

```typescript
interface ModernInboxCardProps {
  inbox: {
    id: string
    name: string
    phoneNumber?: string
    isConnected: boolean
    unreadCount: number
  }
  isSelected: boolean
  onSelect: () => void
}
```

Design:
- Card com min-w-[180px] max-w-[200px]
- Status indicator: círculo colorido (h-3 w-3) no canto
- Nome truncado com max-w
- Badge para unread count
- Ring-2 ring-primary quando selecionado
- Hover: shadow-md transition

### 4. UserInfoCardModern Component (Refactored)

```typescript
interface UserInfoCardModernProps {
  user: {
    id: string
    name: string
    email?: string
    phone?: string
    jid?: string
    token: string
    profilePicture?: string
  }
  sessionStatus: SessionStatus | null
  onRefreshAvatar: () => void
  isLoadingAvatar: boolean
}
```

Layout (2 colunas):
- Coluna esquerda: Avatar grande (h-20 w-20) + Status badge
- Coluna direita: Grid com Name, Phone, JID, Token (com show/hide)

### 5. ConnectionControlCardModern Component (Refactored)

```typescript
interface ConnectionControlCardModernProps {
  sessionStatus: SessionStatus | null
  onConnect: () => void
  onDisconnect: () => void
  onLogout: () => void
  isConnecting: boolean
}
```

Design:
- Card com header icon (Settings)
- Status badge colorido
- Botões com cores semânticas:
  - Connect: bg-green-600 hover:bg-green-700
  - Disconnect: variant="outline"
  - Logout: variant="destructive"

### 6. WebhookConfigCardModern Component (Refactored)

```typescript
interface WebhookConfigCardModernProps {
  webhookUrl: string
  subscribedEvents: string[]
  onSave: (url: string) => void
  onNavigateToSettings: () => void
  isSaving: boolean
}
```

Design:
- Card com header icon (Webhook, text-purple-500)
- Input para URL com placeholder
- Badge mostrando número de eventos configurados
- Botões: Salvar (primary) + Configurar Eventos (outline)

## Data Models

Os data models existentes são mantidos:

```typescript
// Existing types from @/types/dashboard
interface DashboardMetrics {
  inboxes: InboxStatus[]
  conversations: ConversationStats
  previousPeriodConversations?: ConversationStats
  agents: AgentPerformance[]
  campaigns: CampaignMetrics
  quotas: QuotaUsage[]
  subscription: SubscriptionInfo | null
  creditBalance: number
  contacts: ContactMetrics
  lastUpdated: string
}

interface InboxStatus {
  id: string
  name: string
  phoneNumber?: string
  isConnected: boolean
  unreadCount: number
  lastActivityAt?: string
}

interface ConversationStats {
  openCount: number
  resolvedCount: number
  pendingCount: number
  averageResponseTimeMinutes: number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Inbox Card Rendering Correctness

*For any* inbox data object with id, name, phoneNumber, isConnected, and unreadCount fields, the rendered InboxCard component SHALL display the correct connection status color (green for connected, red for disconnected) and include all provided data fields in the output.

**Validates: Requirements 3.1, 3.2**

### Property 2: Stats Card Color Mapping

*For any* metric type (blue, green, orange, purple, red), the ModernStatsCard component SHALL render the icon background with the corresponding color class from the colorMap.

**Validates: Requirements 4.1**

### Property 3: Trend Indicator Display

*For any* stats data with previousPeriodStats provided, the stats card SHALL display a trend indicator showing the direction (up/down) and percentage change calculated as ((current - previous) / previous * 100).

**Validates: Requirements 4.3**

### Property 4: Management Permissions Visibility

*For any* user with hasManagementPermission=true, the QuickActionsPanel SHALL render additional management buttons (Agentes, Equipes, Caixas). *For any* user with hasManagementPermission=false, these buttons SHALL NOT be rendered.

**Validates: Requirements 6.4**

### Property 5: User Info Card Data Display

*For any* user object with name, phone, jid, and token fields, the UserInfoCardModern component SHALL include all these fields in the rendered output, with the token initially masked.

**Validates: Requirements 7.2**

### Property 6: Webhook Config Display

*For any* webhook configuration with url and subscribedEvents array, the WebhookConfigCard SHALL display the URL in the input field and show the count of subscribed events.

**Validates: Requirements 7.4**

## Error Handling

### Loading States
- All cards display Skeleton components during loading
- Skeletons match the final layout dimensions
- Loading state is managed via isLoading props

### Error States
- Dashboard shows error card with retry button on API failure
- Individual card errors don't break the entire dashboard
- Toast notifications for user feedback

### Empty States
- "Nenhuma caixa configurada" for empty inboxes
- "Sem dados disponíveis" for empty metrics
- EmptyState component with icon and action button

## Testing Strategy

### Unit Tests
- Test individual component rendering with various props
- Test color mapping functions
- Test trend calculation logic
- Test conditional rendering based on permissions

### Property-Based Tests
Using Vitest with fast-check for property-based testing:

1. **Inbox Card Rendering** - Generate random inbox data and verify correct rendering
2. **Stats Card Colors** - Generate random metric types and verify color mapping
3. **Trend Calculations** - Generate random current/previous values and verify trend direction
4. **Permission Visibility** - Generate random permission states and verify button visibility
5. **User Info Display** - Generate random user data and verify all fields are displayed
6. **Webhook Config Display** - Generate random webhook configs and verify display

Configuration:
- Minimum 100 iterations per property test
- Tag format: **Feature: user-dashboard-redesign, Property N: [property_text]**

### Integration Tests
- Test dashboard data fetching and display
- Test tab switching behavior
- Test refresh functionality

### E2E Tests (Cypress)
- Test responsive layout at different viewport sizes
- Test user interactions (click, hover)
- Test loading and error states
