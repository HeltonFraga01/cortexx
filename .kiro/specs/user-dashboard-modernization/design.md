# Design Document: User Dashboard Modernization

## Overview

Este documento descreve o design técnico para a modernização do Dashboard do Usuário, transformando-o de uma visão single-inbox para uma plataforma multi-inbox com métricas avançadas, gráficos interativos e atualizações em tempo real.

O novo dashboard será construído usando React com TypeScript, seguindo os padrões do projeto (shadcn/ui, Tailwind CSS) e integrando com o backend via API REST e Supabase Realtime para atualizações em tempo real.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UserDashboardModern                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  InboxOverview  │  │ ConversationStats│  │  QuickActions   │ │
│  │    Component    │  │    Component     │  │   Component     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ MessageActivity │  │ AgentPerformance │  │ CampaignStatus  │ │
│  │     Chart       │  │    Summary       │  │   Overview      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │  ContactGrowth  │  │  QuotaUsage     │                      │
│  │     Chart       │  │    Panel        │                      │
│  └─────────────────┘  └─────────────────┘                      │
├─────────────────────────────────────────────────────────────────┤
│                    Services Layer                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ dashboard-stats │  │ inbox-service   │  │ realtime-sub    │ │
│  │    service      │  │                 │  │    service      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                    Backend API                                  │
│  GET /api/user/dashboard-metrics                                │
│  GET /api/user/inboxes/status                                   │
│  GET /api/user/conversations/stats                              │
│  GET /api/user/messages/activity                                │
│  GET /api/user/contacts/growth                                  │
└─────────────────────────────────────────────────────────────────┘
```


## Components and Interfaces

### 1. UserDashboardModern (Main Component)

```typescript
interface DashboardState {
  selectedInboxId: string | null;
  dateRange: DateRange;
  isLoading: boolean;
  lastUpdated: Date;
}

interface DateRange {
  start: Date;
  end: Date;
  period: 'day' | 'week' | 'month';
}
```

### 2. InboxOverviewCard

```typescript
interface InboxOverviewProps {
  inboxes: InboxStatus[];
  onInboxSelect: (inboxId: string) => void;
  selectedInboxId: string | null;
}

interface InboxStatus {
  id: string;
  name: string;
  phoneNumber: string | null;
  isConnected: boolean;
  unreadCount: number;
  lastActivityAt: Date | null;
}
```

### 3. ConversationStatsCard

```typescript
interface ConversationStatsProps {
  stats: ConversationMetrics;
  previousPeriodStats: ConversationMetrics | null;
  isLoading: boolean;
}

interface ConversationMetrics {
  openCount: number;
  resolvedCount: number;
  pendingCount: number;
  averageResponseTimeMinutes: number;
}
```

### 4. MessageActivityChart

```typescript
interface MessageActivityChartProps {
  data: MessageActivityData[];
  viewMode: 'daily' | 'hourly';
  onViewModeChange: (mode: 'daily' | 'hourly') => void;
  inboxId: string | null;
}

interface MessageActivityData {
  date: string;
  incoming: number;
  outgoing: number;
}
```

### 5. AgentPerformanceCard

```typescript
interface AgentPerformanceProps {
  agents: AgentMetrics[];
  topAgents: AgentMetrics[];
  onAgentClick: (agentId: string) => void;
}

interface AgentMetrics {
  id: string;
  name: string;
  avatarUrl: string | null;
  availability: 'online' | 'busy' | 'offline';
  assignedConversations: number;
  resolvedConversations: number;
}
```

### 6. CampaignStatusCard

```typescript
interface CampaignStatusProps {
  activeCampaigns: CampaignSummary[];
  recentCampaign: CampaignSummary | null;
  onCampaignClick: (campaignId: string) => void;
}

interface CampaignSummary {
  id: string;
  name: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  progress: number; // 0-100
  completedAt: Date | null;
}
```

### 7. ContactGrowthChart

```typescript
interface ContactGrowthChartProps {
  data: ContactGrowthData[];
  totalContacts: number;
  growthPercentage: number;
}

interface ContactGrowthData {
  date: string;
  newContacts: number;
  cumulative: number;
}
```

### 8. QuotaUsagePanel

```typescript
interface QuotaUsagePanelProps {
  quotas: QuotaStatus[];
  subscription: SubscriptionInfo | null;
  creditBalance: number;
}

interface QuotaStatus {
  key: string;
  label: string;
  used: number;
  limit: number;
  percentage: number;
  status: 'normal' | 'warning' | 'danger';
}

interface SubscriptionInfo {
  planName: string;
  renewalDate: Date | null;
  status: 'active' | 'cancelled' | 'expired' | 'trial';
}
```


## Data Models

### Backend API Response Types

```typescript
// GET /api/user/dashboard-metrics
interface DashboardMetricsResponse {
  success: boolean;
  data: {
    inboxes: InboxStatus[];
    conversations: ConversationMetrics;
    previousPeriodConversations: ConversationMetrics | null;
    agents: AgentMetrics[];
    campaigns: {
      active: CampaignSummary[];
      recent: CampaignSummary | null;
    };
    quotas: QuotaStatus[];
    subscription: SubscriptionInfo | null;
    creditBalance: number;
    contacts: {
      total: number;
      growthPercentage: number;
    };
    lastUpdated: string;
  };
}

// GET /api/user/messages/activity?period=7d&inboxId=optional
interface MessageActivityResponse {
  success: boolean;
  data: MessageActivityData[];
}

// GET /api/user/contacts/growth?days=30
interface ContactGrowthResponse {
  success: boolean;
  data: ContactGrowthData[];
}
```

### Database Queries (Supabase)

```sql
-- Inbox status with unread counts
SELECT 
  i.id,
  i.name,
  i.phone_number,
  i.wuzapi_connected as is_connected,
  COUNT(c.id) FILTER (WHERE c.unread_count > 0) as unread_count,
  MAX(c.last_message_at) as last_activity_at
FROM inboxes i
LEFT JOIN conversations c ON c.inbox_id = i.id
WHERE i.account_id = $1
GROUP BY i.id;

-- Conversation metrics
SELECT 
  COUNT(*) FILTER (WHERE status = 'open') as open_count,
  COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/60) as avg_response_minutes
FROM conversations
WHERE account_id = $1
  AND created_at >= $2
  AND ($3::uuid IS NULL OR inbox_id = $3);

-- Message activity by day
SELECT 
  DATE(timestamp) as date,
  COUNT(*) FILTER (WHERE direction = 'incoming') as incoming,
  COUNT(*) FILTER (WHERE direction = 'outgoing') as outgoing
FROM chat_messages cm
JOIN conversations c ON cm.conversation_id = c.id
WHERE c.account_id = $1
  AND cm.timestamp >= NOW() - INTERVAL '7 days'
  AND ($2::uuid IS NULL OR c.inbox_id = $2)
GROUP BY DATE(timestamp)
ORDER BY date;

-- Contact growth
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_contacts,
  SUM(COUNT(*)) OVER (ORDER BY DATE(created_at)) as cumulative
FROM contacts
WHERE account_id = $1
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Inbox Status Indicator Correctness

*For any* inbox with a known connection status, the rendered status indicator SHALL display "Conectado" with green styling when `wuzapi_connected=true`, and "Desconectado" with red styling when `wuzapi_connected=false`.

**Validates: Requirements 1.2, 1.3**

### Property 2: Inbox Card Content Completeness

*For any* inbox in the account, the rendered inbox card SHALL contain the inbox name, phone number (or placeholder if null), and unread message count.

**Validates: Requirements 1.5**

### Property 3: Conversation Metrics Accuracy

*For any* set of conversations in an account, the displayed open count SHALL equal the count of conversations with `status='open'`, and the resolved count SHALL equal the count of conversations with `status='resolved'` within the selected date range.

**Validates: Requirements 2.1, 2.2**

### Property 4: Inbox Filter Application

*For any* selected inbox filter, all displayed metrics (conversations, messages, agents) SHALL only include data associated with that specific inbox.

**Validates: Requirements 2.4, 3.5**

### Property 5: Trend Indicator Direction

*For any* metric with current and previous period values, the trend indicator SHALL show an up arrow when current > previous, a down arrow when current < previous, and no arrow when current = previous.

**Validates: Requirements 2.5**

### Property 6: Message Activity Data Integrity

*For any* date in the message activity chart, the incoming count SHALL equal the count of messages with `direction='incoming'` for that date, and the outgoing count SHALL equal the count of messages with `direction='outgoing'`.

**Validates: Requirements 3.1**

### Property 7: Agent Display Completeness

*For any* agent in the account, the agent card SHALL display the agent's name, availability status, and the count of conversations where `assigned_agent_id` equals the agent's ID.

**Validates: Requirements 4.1, 4.2**

### Property 8: Top Agents Ranking

*For any* set of agents, the top 3 displayed agents SHALL be ordered by resolved conversation count in descending order, and the count SHALL match the actual resolved conversations for each agent.

**Validates: Requirements 4.3**

### Property 9: Campaign Progress Calculation

*For any* campaign, the displayed progress percentage SHALL equal `(sentCount / totalContacts) * 100`, and the sent/failed counts SHALL match the campaign's actual values.

**Validates: Requirements 5.1, 5.2**

### Property 10: Recent Campaign Selection

*For any* set of completed campaigns, the displayed "recent campaign" SHALL be the one with the most recent `completed_at` timestamp.

**Validates: Requirements 5.3**

### Property 11: Quota Percentage Calculation

*For any* quota, the displayed percentage SHALL equal `(used / limit) * 100`, rounded to the nearest integer.

**Validates: Requirements 6.2**

### Property 12: Quota Threshold Styling

*For any* quota with usage percentage >= 95%, the styling SHALL be "danger" (red). *For any* quota with usage percentage >= 80% and < 95%, the styling SHALL be "warning" (orange). *For any* quota with usage percentage < 80%, the styling SHALL be "normal".

**Validates: Requirements 6.3, 6.4**

### Property 13: Contact Growth Data Accuracy

*For any* date in the contact growth chart, the new contacts count SHALL equal the count of contacts with `created_at` on that date, and the cumulative value SHALL equal the sum of all new contacts up to and including that date.

**Validates: Requirements 7.1, 7.3**

### Property 14: Growth Percentage Calculation

*For any* 30-day period comparison, the growth percentage SHALL equal `((currentPeriodCount - previousPeriodCount) / previousPeriodCount) * 100`, or 100% if previousPeriodCount is 0.

**Validates: Requirements 7.5**

### Property 15: Management Actions Visibility

*For any* user with management permissions enabled, the quick actions panel SHALL include "Manage Agents" and "Manage Teams" buttons. *For any* user without management permissions, these buttons SHALL NOT be displayed.

**Validates: Requirements 8.3**

### Property 16: Real-time Update Propagation

*For any* new message event received via WebSocket, the unread count for the affected inbox SHALL increment by 1 within 1 second of receiving the event.

**Validates: Requirements 9.2**

### Property 17: Last Updated Timestamp

*For any* data refresh operation, the "Last updated" timestamp SHALL be updated to the current time immediately after the refresh completes.

**Validates: Requirements 9.5**


## Error Handling

### API Error Handling

```typescript
// Service layer error handling pattern
async function fetchDashboardMetrics(): Promise<DashboardMetrics | null> {
  try {
    const response = await backendApi.get('/user/dashboard-metrics');
    if (!response.success) {
      logger.error('Dashboard metrics fetch failed', { error: response.error });
      toast.error('Erro ao carregar métricas do dashboard');
      return null;
    }
    return response.data;
  } catch (error) {
    logger.error('Dashboard metrics request failed', { error });
    toast.error('Erro de conexão. Tente novamente.');
    return null;
  }
}
```

### Component Error States

1. **Loading State**: Show skeleton loaders while data is being fetched
2. **Empty State**: Show appropriate empty state messages with action buttons
3. **Error State**: Show error message with retry button
4. **Partial Data**: Show available data with indicators for missing sections

### Fallback Values

- Unread count: 0 if query fails
- Metrics: Show "N/A" or "--" for unavailable values
- Charts: Show empty chart with "Sem dados" message
- Timestamps: Show "Desconhecido" if null

## Testing Strategy

### Unit Tests

Unit tests will verify individual component rendering and logic:

1. **InboxOverviewCard**: Test status indicator rendering based on connection state
2. **ConversationStatsCard**: Test metric display and trend indicator logic
3. **QuotaUsagePanel**: Test percentage calculation and threshold styling
4. **MessageActivityChart**: Test data transformation for chart library

### Property-Based Tests

Property-based tests will use **fast-check** library to verify correctness properties:

```typescript
import fc from 'fast-check';

// Property 11: Quota Percentage Calculation
describe('QuotaUsagePanel', () => {
  it('should calculate percentage correctly for all valid quota values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }), // used
        fc.integer({ min: 1, max: 10000 }), // limit (min 1 to avoid division by zero)
        (used, limit) => {
          const percentage = calculateQuotaPercentage(used, limit);
          const expected = Math.round((used / limit) * 100);
          return percentage === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Property 12: Quota Threshold Styling
describe('getQuotaStatus', () => {
  it('should return correct status based on percentage thresholds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (percentage) => {
          const status = getQuotaStatus(percentage);
          if (percentage >= 95) return status === 'danger';
          if (percentage >= 80) return status === 'warning';
          return status === 'normal';
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

Integration tests will verify API endpoints and data flow:

1. **Dashboard Metrics Endpoint**: Test response structure and data accuracy
2. **Inbox Filter**: Test that filtering affects all related metrics
3. **Real-time Updates**: Test WebSocket event handling

### E2E Tests (Cypress)

E2E tests will verify user flows:

1. **Dashboard Load**: Verify all sections render correctly
2. **Inbox Selection**: Verify filter updates all metrics
3. **Navigation**: Verify quick actions navigate to correct pages
4. **Responsive Layout**: Verify layout adapts to different screen sizes

## Visual Design

### Layout Grid

```
Desktop (≥1024px):
┌─────────────────────────────────────────────────────────────┐
│ Header: Dashboard Title + Last Updated + Refresh Button     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │   Inbox 1   │ │   Inbox 2   │ │   Inbox 3   │  ...       │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐ ┌─────────────┐│
│ │ Conversation Stats│ │ Message Activity  │ │Quick Actions││
│ │                   │ │     Chart         │ │             ││
│ └───────────────────┘ └───────────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────┐ ┌───────────────────┐ ┌─────────────┐│
│ │ Agent Performance │ │ Campaign Status   │ │ Quota Usage ││
│ │                   │ │                   │ │             ││
│ └───────────────────┘ └───────────────────┘ └─────────────┘│
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────────────────────────────────────┐│
│ │              Contact Growth Chart (Full Width)            ││
│ └───────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘

Mobile (<768px):
┌─────────────────┐
│ Header          │
├─────────────────┤
│ Inbox Carousel  │
├─────────────────┤
│ Conv Stats      │
├─────────────────┤
│ Quick Actions   │
├─────────────────┤
│ Message Chart   │
├─────────────────┤
│ Agent Summary   │
├─────────────────┤
│ Campaign Status │
├─────────────────┤
│ Quota Usage     │
├─────────────────┤
│ Contact Growth  │
└─────────────────┘
```

### Color Scheme

- **Status Connected**: `bg-green-100 text-green-800` / `bg-green-500` (indicator)
- **Status Disconnected**: `bg-red-100 text-red-800` / `bg-red-500` (indicator)
- **Quota Normal**: `bg-primary` (progress bar)
- **Quota Warning**: `bg-orange-500` (progress bar)
- **Quota Danger**: `bg-red-500` (progress bar)
- **Chart Incoming**: `hsl(var(--chart-1))` (blue)
- **Chart Outgoing**: `hsl(var(--chart-2))` (green)
