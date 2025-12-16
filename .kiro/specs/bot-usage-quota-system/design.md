# Design Document: Bot Usage Quota System

## Overview

Este documento descreve o design para implementar um sistema de controle de uso de bots, seguindo a mesma arquitetura do sistema de quotas existente (`QuotaService`). O sistema adicionará 6 novos tipos de quota para controlar:

1. **Chamadas de webhook do bot** (diário e mensal)
2. **Mensagens enviadas pelo bot** (diário e mensal)
3. **Tokens de IA consumidos** (diário e mensal)

O sistema se integra com a infraestrutura existente de quotas, planos e tracking de uso.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Bot Usage Quota System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐       │
│  │   Plan System    │    │  Quota System    │    │   Bot System     │       │
│  │                  │    │                  │    │                  │       │
│  │ - max_bot_calls  │───▶│ - checkQuota()   │◀───│ - forwardToBot() │       │
│  │   _per_day/month │    │ - incrementUsage │    │ - handleBotReply │       │
│  │ - max_bot_msgs   │    │ - getCurrentUsage│    │                  │       │
│  │   _per_day/month │    │ - getEffective   │    └────────┬─────────┘       │
│  │ - max_bot_tokens │    │   Limit()        │             │                 │
│  │   _per_day/month │    └────────┬─────────┘             │                 │
│  └──────────────────┘             │                       │                 │
│                                   │                       ▼                 │
│  ┌──────────────────┐    ┌────────▼─────────┐    ┌──────────────────┐       │
│  │ Usage Tracking   │    │  Period Manager  │    │ Webhook Handler  │       │
│  │                  │    │                  │    │                  │       │
│  │ user_quota_usage │◀───│ - getPeriodStart │    │ - processMessage │       │
│  │ - quota_type     │    │ - getPeriodEnd   │    │ - checkBotQuota  │       │
│  │ - period_start   │    │ - resetCounters  │    │ - trackTokens    │       │
│  │ - current_usage  │    └──────────────────┘    └──────────────────┘       │
│  └──────────────────┘                                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. QuotaService Extensions

Adicionar novos tipos de quota ao `QUOTA_TYPES`:

```javascript
// server/services/QuotaService.js

const QUOTA_TYPES = {
  // Existing quotas...
  MAX_AGENTS: 'max_agents',
  MAX_CONNECTIONS: 'max_connections',
  MAX_MESSAGES_PER_DAY: 'max_messages_per_day',
  MAX_MESSAGES_PER_MONTH: 'max_messages_per_month',
  MAX_INBOXES: 'max_inboxes',
  MAX_TEAMS: 'max_teams',
  MAX_WEBHOOKS: 'max_webhooks',
  MAX_CAMPAIGNS: 'max_campaigns',
  MAX_STORAGE_MB: 'max_storage_mb',
  MAX_BOTS: 'max_bots',
  
  // NEW: Bot usage quotas
  MAX_BOT_CALLS_PER_DAY: 'max_bot_calls_per_day',
  MAX_BOT_CALLS_PER_MONTH: 'max_bot_calls_per_month',
  MAX_BOT_MESSAGES_PER_DAY: 'max_bot_messages_per_day',
  MAX_BOT_MESSAGES_PER_MONTH: 'max_bot_messages_per_month',
  MAX_BOT_TOKENS_PER_DAY: 'max_bot_tokens_per_day',
  MAX_BOT_TOKENS_PER_MONTH: 'max_bot_tokens_per_month'
};

// Update CYCLE_QUOTAS to include new bot quotas
const CYCLE_QUOTAS = [
  QUOTA_TYPES.MAX_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_MESSAGES_PER_MONTH,
  // NEW
  QUOTA_TYPES.MAX_BOT_CALLS_PER_DAY,
  QUOTA_TYPES.MAX_BOT_CALLS_PER_MONTH,
  QUOTA_TYPES.MAX_BOT_MESSAGES_PER_DAY,
  QUOTA_TYPES.MAX_BOT_MESSAGES_PER_MONTH,
  QUOTA_TYPES.MAX_BOT_TOKENS_PER_DAY,
  QUOTA_TYPES.MAX_BOT_TOKENS_PER_MONTH
];
```

### 2. BotService Extensions

Adicionar métodos para verificar e rastrear uso de quotas:

```javascript
// server/services/BotService.js

/**
 * Check if bot can process a message based on quotas
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { allowed, quotaType, usage, limit }
 */
async checkBotCallQuota(userId) {
  // Check daily limit first, then monthly
}

/**
 * Check if bot can send a message based on quotas
 * @param {string} userId - User ID
 * @returns {Promise<Object>} { allowed, quotaType, usage, limit }
 */
async checkBotMessageQuota(userId) {
  // Check daily limit first, then monthly
}

/**
 * Check if bot can use tokens based on quotas
 * @param {string} userId - User ID
 * @param {number} tokensNeeded - Estimated tokens needed
 * @returns {Promise<Object>} { allowed, quotaType, usage, limit }
 */
async checkBotTokenQuota(userId, tokensNeeded = 0) {
  // Check daily limit first, then monthly
}

/**
 * Track token usage from bot webhook response
 * @param {string} userId - User ID
 * @param {number} tokensUsed - Tokens consumed
 */
async trackBotTokenUsage(userId, tokensUsed) {
  // Increment both daily and monthly counters
}
```

### 3. ChatMessageHandler Integration

Modificar o fluxo de processamento de mensagens:

```javascript
// server/webhooks/chatMessageHandler.js

// In handleMessageEvent, before forwarding to bot:
if (messageDirection === 'incoming' && conversation.assigned_bot_id) {
  // NEW: Check bot call quota before forwarding
  const quotaCheck = await this.checkBotCallQuota(userId);
  
  if (!quotaCheck.allowed) {
    logger.warn('Bot call quota exceeded', {
      userId,
      quotaType: quotaCheck.quotaType,
      usage: quotaCheck.usage,
      limit: quotaCheck.limit
    });
    
    // Continue without bot processing
    return { 
      handled: true, 
      conversationId: conversation.id, 
      messageId: message.id,
      botSkipped: true,
      quotaExceeded: {
        quotaType: quotaCheck.quotaType,
        usage: quotaCheck.usage,
        limit: quotaCheck.limit
      }
    };
  }
  
  // Increment bot call counter
  await this.incrementBotCallUsage(userId);
  
  // Forward to bot...
  const botResponse = await this.botService.forwardToBot(...);
  
  // NEW: Track token usage if reported
  if (botResponse.tokensUsed) {
    await this.trackBotTokenUsage(userId, botResponse.tokensUsed);
  }
  
  // NEW: Check message quota before sending reply
  if (botResponse.action === 'reply') {
    const msgQuotaCheck = await this.checkBotMessageQuota(userId);
    if (msgQuotaCheck.allowed) {
      await this.handleBotReply(userId, conversation, botResponse);
      await this.incrementBotMessageUsage(userId);
    }
  }
}
```

## Data Models

### Database Schema Changes

```sql
-- Migration: Add bot usage quota columns to plans table
ALTER TABLE plans ADD COLUMN max_bot_calls_per_day INTEGER DEFAULT 100;
ALTER TABLE plans ADD COLUMN max_bot_calls_per_month INTEGER DEFAULT 3000;
ALTER TABLE plans ADD COLUMN max_bot_messages_per_day INTEGER DEFAULT 50;
ALTER TABLE plans ADD COLUMN max_bot_messages_per_month INTEGER DEFAULT 1500;
ALTER TABLE plans ADD COLUMN max_bot_tokens_per_day INTEGER DEFAULT 10000;
ALTER TABLE plans ADD COLUMN max_bot_tokens_per_month INTEGER DEFAULT 300000;

-- Update existing plans with appropriate values
UPDATE plans SET 
  max_bot_calls_per_day = 50,
  max_bot_calls_per_month = 1500,
  max_bot_messages_per_day = 25,
  max_bot_messages_per_month = 750,
  max_bot_tokens_per_day = 5000,
  max_bot_tokens_per_month = 150000
WHERE name = 'Free';

UPDATE plans SET 
  max_bot_calls_per_day = 100,
  max_bot_calls_per_month = 3000,
  max_bot_messages_per_day = 50,
  max_bot_messages_per_month = 1500,
  max_bot_tokens_per_day = 10000,
  max_bot_tokens_per_month = 300000
WHERE name = 'Basic';

UPDATE plans SET 
  max_bot_calls_per_day = 500,
  max_bot_calls_per_month = 15000,
  max_bot_messages_per_day = 250,
  max_bot_messages_per_month = 7500,
  max_bot_tokens_per_day = 50000,
  max_bot_tokens_per_month = 1500000
WHERE name = 'Pro';

UPDATE plans SET 
  max_bot_calls_per_day = 2000,
  max_bot_calls_per_month = 60000,
  max_bot_messages_per_day = 1000,
  max_bot_messages_per_month = 30000,
  max_bot_tokens_per_day = 200000,
  max_bot_tokens_per_month = 6000000
WHERE name = 'Enterprise';
```

### Plans Table Schema (Updated)

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| max_bot_calls_per_day | INTEGER | 100 | Max bot webhook calls per day |
| max_bot_calls_per_month | INTEGER | 3000 | Max bot webhook calls per month |
| max_bot_messages_per_day | INTEGER | 50 | Max bot replies per day |
| max_bot_messages_per_month | INTEGER | 1500 | Max bot replies per month |
| max_bot_tokens_per_day | INTEGER | 10000 | Max AI tokens per day |
| max_bot_tokens_per_month | INTEGER | 300000 | Max AI tokens per month |

### Default Plan Configurations

| Plan | bot_calls/day | bot_calls/month | bot_msgs/day | bot_msgs/month | tokens/day | tokens/month |
|------|---------------|-----------------|--------------|----------------|------------|--------------|
| Free | 50 | 1,500 | 25 | 750 | 5,000 | 150,000 |
| Basic | 100 | 3,000 | 50 | 1,500 | 10,000 | 300,000 |
| Pro | 500 | 15,000 | 250 | 7,500 | 50,000 | 1,500,000 |
| Enterprise | 2,000 | 60,000 | 1,000 | 30,000 | 200,000 | 6,000,000 |

### Bot Webhook Response Schema (Extended)

```typescript
interface BotWebhookResponse {
  action: 'reply' | 'ignore' | 'handoff';
  content?: string;
  messageType?: 'text' | 'image' | 'document';
  // NEW: Token usage tracking
  tokensUsed?: number;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Plan quota fields completeness
*For any* plan created or retrieved, the plan object SHALL contain all 6 bot quota fields with valid numeric values.
**Validates: Requirements 1.1, 1.2, 2.1, 2.2, 3.1, 3.2**

### Property 2: Bot call counter increment
*For any* message forwarded to a bot, the bot calls counter for that user SHALL increase by exactly 1.
**Validates: Requirements 1.3**

### Property 3: Bot call quota enforcement
*For any* user whose bot calls count equals or exceeds their limit (daily or monthly), bot processing SHALL be skipped for incoming messages.
**Validates: Requirements 1.4, 1.5**

### Property 4: Message storage independence
*For any* incoming message, the message SHALL be stored in the database regardless of bot quota status.
**Validates: Requirements 1.6**

### Property 5: Bot message counter increment
*For any* bot reply successfully sent, the bot messages counter for that user SHALL increase by exactly 1.
**Validates: Requirements 2.6**

### Property 6: Bot message quota enforcement
*For any* user whose bot messages count equals or exceeds their limit (daily or monthly), bot replies SHALL be skipped.
**Validates: Requirements 2.4, 2.5**

### Property 7: Token counter increment
*For any* bot webhook response with a `tokensUsed` field, the token counter SHALL increase by exactly that amount.
**Validates: Requirements 3.3**

### Property 8: Token quota enforcement
*For any* user whose token count equals or exceeds their limit (daily or monthly), bot processing SHALL be skipped.
**Validates: Requirements 3.4, 3.5**

### Property 9: Quota percentage calculation
*For any* quota with limit > 0, the percentage SHALL equal (currentUsage / limit) * 100, rounded to nearest integer.
**Validates: Requirements 4.4, 4.5**

### Property 10: Override precedence
*For any* user with a quota override, the effective limit SHALL be the override value, not the plan default.
**Validates: Requirements 5.4**

### Property 11: Period boundary reset
*For any* quota type, usage records for a new period SHALL start with current_usage = 0.
**Validates: Requirements 6.3**

### Property 12: Quota exceeded response structure
*For any* bot processing skipped due to quota, the response SHALL include quotaExceeded flag, quotaType, usage, and limit.
**Validates: Requirements 7.1, 7.2, 7.3**

### Property 13: Default values consistency
*For any* new plan created without explicit quota values, all bot quota fields SHALL have the defined default values.
**Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7**

## Error Handling

### Quota Exceeded Response

```json
{
  "handled": true,
  "conversationId": 123,
  "messageId": 456,
  "botSkipped": true,
  "quotaExceeded": {
    "quotaType": "max_bot_calls_per_day",
    "usage": 100,
    "limit": 100,
    "remaining": 0,
    "resetsAt": "2025-12-16T00:00:00-03:00"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `BOT_CALL_QUOTA_EXCEEDED` | Daily or monthly bot call limit reached |
| `BOT_MESSAGE_QUOTA_EXCEEDED` | Daily or monthly bot message limit reached |
| `BOT_TOKEN_QUOTA_EXCEEDED` | Daily or monthly token limit reached |

## User Interface: Admin-Assigned Bots Display

### 4. Backend API for Admin-Assigned Bots

Criar endpoint para buscar bots templates atribuídos às inboxes do usuário:

```javascript
// server/routes/userBotRoutes.js

/**
 * GET /api/user/assigned-bots
 * Returns bot templates assigned to user's inboxes with quota usage
 */
router.get('/assigned-bots', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user's inboxes
    const inboxes = await inboxService.getUserInboxes(userId);
    
    // Get bot templates assigned to these inboxes
    const assignedBots = await automationService.getBotTemplatesForInboxes(
      inboxes.map(i => i.id)
    );
    
    // Get quota usage for the user
    const quotaUsage = await quotaService.getBotQuotaUsage(userId);
    
    // Combine bot info with quota usage
    const botsWithQuota = assignedBots.map(bot => ({
      ...bot,
      quotaUsage: {
        calls: {
          daily: quotaUsage.botCallsDaily,
          monthly: quotaUsage.botCallsMonthly,
          dailyLimit: quotaUsage.maxBotCallsPerDay,
          monthlyLimit: quotaUsage.maxBotCallsPerMonth
        },
        messages: {
          daily: quotaUsage.botMessagesDaily,
          monthly: quotaUsage.botMessagesMonthly,
          dailyLimit: quotaUsage.maxBotMessagesPerDay,
          monthlyLimit: quotaUsage.maxBotMessagesPerMonth
        },
        tokens: {
          daily: quotaUsage.botTokensDaily,
          monthly: quotaUsage.botTokensMonthly,
          dailyLimit: quotaUsage.maxBotTokensPerDay,
          monthlyLimit: quotaUsage.maxBotTokensPerMonth
        }
      }
    }));
    
    res.json({ success: true, data: botsWithQuota });
  } catch (error) {
    logger.error('Failed to get assigned bots', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: error.message });
  }
});
```

### 5. AutomationService Extension

Adicionar método para buscar bot templates por inbox:

```javascript
// server/services/AutomationService.js

/**
 * Get bot templates assigned to specific inboxes
 * @param {number[]} inboxIds - Array of inbox IDs
 * @returns {Promise<BotTemplate[]>} Bot templates with inbox info
 */
async getBotTemplatesForInboxes(inboxIds) {
  if (!inboxIds.length) return [];
  
  const { rows } = await this.db.query(`
    SELECT bt.*, 
           json_extract(bt.inbox_assignments, '$') as assignments
    FROM bot_templates bt
    WHERE bt.inbox_assignments IS NOT NULL
      AND bt.inbox_assignments != '[]'
  `);
  
  // Filter templates that have assignments matching user's inboxes
  return rows.filter(template => {
    const assignments = JSON.parse(template.inbox_assignments || '[]');
    return assignments.some(a => inboxIds.includes(a.inboxId));
  }).map(template => ({
    id: template.id,
    name: template.name,
    description: template.description,
    outgoingUrl: template.outgoing_url,
    includeHistory: template.include_history === 1,
    isDefault: template.is_default === 1,
    inboxAssignments: JSON.parse(template.inbox_assignments || '[]')
      .filter(a => inboxIds.includes(a.inboxId))
  }));
}
```

### 6. Frontend Service

```typescript
// src/services/chat.ts

export interface AssignedBot {
  id: number;
  name: string;
  description: string | null;
  outgoingUrl: string;
  includeHistory: boolean;
  isDefault: boolean;
  inboxAssignments: Array<{
    inboxId: number;
    inboxName: string;
  }>;
  quotaUsage: BotQuotaUsage;
}

export interface BotQuotaUsage {
  calls: QuotaMetric;
  messages: QuotaMetric;
  tokens: QuotaMetric;
}

export interface QuotaMetric {
  daily: number;
  monthly: number;
  dailyLimit: number;
  monthlyLimit: number;
}

/**
 * Get admin-assigned bots for current user with quota usage
 */
export async function getAssignedBots(): Promise<AssignedBot[]> {
  const response = await api.get('/api/user/assigned-bots');
  return response.data.data;
}
```

### 7. Frontend Component: AdminAssignedBots

```typescript
// src/components/features/chat/settings/AdminAssignedBots.tsx

interface AdminAssignedBotsProps {
  // No props needed, fetches data internally
}

export function AdminAssignedBots() {
  const { data: assignedBots = [], isLoading } = useQuery({
    queryKey: ['assigned-bots'],
    queryFn: getAssignedBots
  });

  if (isLoading) return <LoadingSpinner />;
  
  if (assignedBots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nenhum bot atribuído pelo administrador
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="h-5 w-5 text-primary" />
        <h4 className="font-medium">Bots do Administrador</h4>
        <Badge variant="secondary">Gerenciado</Badge>
      </div>
      
      {assignedBots.map(bot => (
        <AdminBotCard key={bot.id} bot={bot} />
      ))}
    </div>
  );
}
```

### 8. Frontend Component: AdminBotCard

```typescript
// src/components/features/chat/settings/AdminBotCard.tsx

interface AdminBotCardProps {
  bot: AssignedBot;
}

export function AdminBotCard({ bot }: AdminBotCardProps) {
  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="py-4">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-primary/10">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-medium">{bot.name}</h4>
              <Badge variant="outline" className="text-xs">
                <Shield className="h-3 w-3 mr-1" />
                Admin
              </Badge>
              {bot.isDefault && (
                <Badge variant="default" className="bg-yellow-500">
                  <Star className="h-3 w-3 mr-1" />
                  Padrão
                </Badge>
              )}
            </div>
            {bot.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {bot.description}
              </p>
            )}
            
            {/* Inbox assignments */}
            <div className="flex flex-wrap gap-1 mt-2">
              {bot.inboxAssignments.map(inbox => (
                <Badge key={inbox.inboxId} variant="secondary" className="text-xs">
                  <Inbox className="h-3 w-3 mr-1" />
                  {inbox.inboxName}
                </Badge>
              ))}
            </div>
            
            {/* Quota Usage Section */}
            <div className="mt-4 space-y-3">
              <QuotaProgressBar
                label="Chamadas"
                icon={<Phone className="h-4 w-4" />}
                daily={bot.quotaUsage.calls.daily}
                dailyLimit={bot.quotaUsage.calls.dailyLimit}
                monthly={bot.quotaUsage.calls.monthly}
                monthlyLimit={bot.quotaUsage.calls.monthlyLimit}
              />
              <QuotaProgressBar
                label="Mensagens"
                icon={<MessageSquare className="h-4 w-4" />}
                daily={bot.quotaUsage.messages.daily}
                dailyLimit={bot.quotaUsage.messages.dailyLimit}
                monthly={bot.quotaUsage.messages.monthly}
                monthlyLimit={bot.quotaUsage.messages.monthlyLimit}
              />
              <QuotaProgressBar
                label="Tokens IA"
                icon={<Cpu className="h-4 w-4" />}
                daily={bot.quotaUsage.tokens.daily}
                dailyLimit={bot.quotaUsage.tokens.dailyLimit}
                monthly={bot.quotaUsage.tokens.monthly}
                monthlyLimit={bot.quotaUsage.tokens.monthlyLimit}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 9. Frontend Component: QuotaProgressBar

```typescript
// src/components/features/chat/settings/QuotaProgressBar.tsx

interface QuotaProgressBarProps {
  label: string;
  icon: React.ReactNode;
  daily: number;
  dailyLimit: number;
  monthly: number;
  monthlyLimit: number;
}

export function QuotaProgressBar({
  label,
  icon,
  daily,
  dailyLimit,
  monthly,
  monthlyLimit
}: QuotaProgressBarProps) {
  const dailyPercent = dailyLimit > 0 ? Math.round((daily / dailyLimit) * 100) : 0;
  const monthlyPercent = monthlyLimit > 0 ? Math.round((monthly / monthlyLimit) * 100) : 0;
  
  const getStatusColor = (percent: number) => {
    if (percent >= 100) return 'bg-destructive';
    if (percent >= 80) return 'bg-yellow-500';
    return 'bg-primary';
  };
  
  const getStatusBadge = (percent: number) => {
    if (percent >= 100) return <Badge variant="destructive">Excedido</Badge>;
    if (percent >= 80) return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Atenção</Badge>;
    return null;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          {icon}
          <span>{label}</span>
        </div>
        {getStatusBadge(Math.max(dailyPercent, monthlyPercent))}
      </div>
      
      {/* Daily progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Diário</span>
          <span>{daily.toLocaleString()} / {dailyLimit.toLocaleString()}</span>
        </div>
        <Progress value={dailyPercent} className={getStatusColor(dailyPercent)} />
      </div>
      
      {/* Monthly progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mensal</span>
          <span>{monthly.toLocaleString()} / {monthlyLimit.toLocaleString()}</span>
        </div>
        <Progress value={monthlyPercent} className={getStatusColor(monthlyPercent)} />
      </div>
    </div>
  );
}
```

### 10. BotSettings Integration

Modificar o componente BotSettings para incluir a seção de bots do admin:

```typescript
// src/components/features/chat/settings/BotSettings.tsx

export function BotSettings() {
  // ... existing code ...

  return (
    <div className="space-y-6">
      {/* NEW: Admin-assigned bots section */}
      <AdminAssignedBots />
      
      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Seus Bots
          </span>
        </div>
      </div>
      
      {/* Existing user bots section */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Bots de Atendimento</h3>
          {/* ... rest of existing code ... */}
        </div>
      </div>
      
      {/* ... rest of existing code ... */}
    </div>
  );
}
```

## Correctness Properties (Extended)

### Property 14: Admin-assigned bots visibility
*For any* user with inboxes that have bot templates assigned, the assigned bots list SHALL contain all and only those bot templates that are assigned to the user's inboxes.
**Validates: Requirements 9.1, 9.2**

### Property 15: Bot card content completeness
*For any* admin-assigned bot displayed, the rendered card SHALL contain the bot name, description, assigned inbox names, and all quota metrics (calls, messages, tokens) with both daily and monthly values.
**Validates: Requirements 9.2, 9.3, 10.1, 10.2**

### Property 16: Admin bot immutability
*For any* admin-assigned bot card rendered, the component SHALL NOT include edit or delete action buttons.
**Validates: Requirements 9.5**

### Property 17: Quota threshold indicators
*For any* quota metric with usage percentage >= 80%, the UI SHALL display a warning indicator; for usage percentage >= 100%, the UI SHALL display an exceeded indicator.
**Validates: Requirements 9.6, 9.7**

## Testing Strategy

### Dual Testing Approach

This implementation requires both unit tests and property-based tests:

**Unit Tests:**
- Test specific examples of quota checking
- Test edge cases (exactly at limit, one over limit)
- Test period boundary transitions
- Test override precedence

**Property-Based Tests:**
- Use `fast-check` library for property-based testing
- Generate random users, quotas, and usage values
- Verify invariants hold across all generated inputs
- Each property test should run minimum 100 iterations

### Property-Based Testing Library

Use `fast-check` (already available in the project via vitest integration).

### Test Annotations

Each property-based test MUST be annotated with:
```javascript
// **Feature: bot-usage-quota-system, Property {number}: {property_text}**
// **Validates: Requirements X.Y**
```

### Test Coverage

1. **QuotaService tests:**
   - New quota types are recognized
   - Period calculations work correctly
   - Usage tracking increments correctly

2. **BotService tests:**
   - Quota checks return correct results
   - Token tracking works correctly

3. **ChatMessageHandler tests:**
   - Bot processing is skipped when quota exceeded
   - Messages are stored regardless of quota
   - Token usage is tracked from webhook response

4. **Integration tests:**
   - End-to-end flow with quota enforcement
   - Period reset behavior
