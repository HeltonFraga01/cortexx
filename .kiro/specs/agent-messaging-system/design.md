# Design Document: Agent Messaging System

## Overview

O Agent Messaging System é uma extensão do sistema de mensagens existente para usuários, adaptado para o contexto de agentes. O sistema permite que agentes enviem mensagens individuais e em massa através das caixas de entrada às quais têm acesso, enquanto o consumo de quota é debitado do saldo do usuário proprietário (owner) da conta.

A arquitetura reutiliza componentes existentes do sistema de mensagens do usuário (`/user/mensagens`), adaptando-os para o contexto do agente com as seguintes diferenças principais:
- Autenticação via token de agente em vez de token de usuário
- Filtragem de inboxes baseada nas permissões do agente
- Consumo de quota do owner em vez do agente
- Rotas separadas em `/api/agent/messaging/*`

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Agent Messaging System                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Frontend (React + TypeScript)                                          │
│  ├── src/pages/agent/                                                   │
│  │   ├── AgentMessagingPage.tsx      (SendFlow principal)              │
│  │   ├── AgentOutboxPage.tsx         (Caixa de saída)                  │
│  │   ├── AgentTemplatesPage.tsx      (Templates)                       │
│  │   └── AgentReportsPage.tsx        (Relatórios)                      │
│  │                                                                      │
│  ├── src/components/agent/                                              │
│  │   ├── AgentSendFlow.tsx           (Wrapper do SendFlow)             │
│  │   ├── AgentInboxSelector.tsx      (Seletor filtrado)                │
│  │   └── AgentQuotaDisplay.tsx       (Exibe quota do owner)            │
│  │                                                                      │
│  └── src/services/                                                      │
│      └── agent-messaging.ts          (API client)                       │
│                                                                         │
│  Backend (Node.js + Express)                                            │
│  ├── server/routes/                                                     │
│  │   └── agentMessagingRoutes.js     (Rotas de mensagens)              │
│  │                                                                      │
│  └── server/services/                                                   │
│      ├── AgentCampaignService.js     (Campanhas do agente)             │
│      └── AgentTemplateService.js     (Templates do agente)             │
│                                                                         │
│  Database (SQLite)                                                      │
│  ├── agent_campaigns                 (Campanhas criadas por agentes)   │
│  ├── agent_campaign_contacts         (Contatos das campanhas)          │
│  └── agent_templates                 (Templates dos agentes)           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Request Flow

```
Agent Browser → AgentLayout → AgentMessagingPage
                    ↓
              agent-messaging.ts (API Client)
                    ↓
              /api/agent/messaging/* (Backend Routes)
                    ↓
              agentAuth middleware (Validate agent token)
                    ↓
              AgentCampaignService / QuotaService
                    ↓
              InboxService (Get agent's inboxes)
                    ↓
              QuotaService (Check/increment owner's quota)
                    ↓
              WUZAPI (Send via inbox token)
```

## Components and Interfaces

### Frontend Components

#### AgentMessagingPage
Página principal de envio de mensagens, reutilizando o SendFlow existente.

```typescript
interface AgentMessagingPageProps {
  // Nenhuma prop necessária, usa contexto de autenticação
}

// Reutiliza SendFlow com adaptações para agente
```

#### AgentInboxSelector
Seletor de caixas de entrada filtrado pelas permissões do agente.

```typescript
interface AgentInboxSelectorProps {
  selectedInboxes: SelectedInbox[]
  onSelectionChange: (inboxes: SelectedInbox[]) => void
  minSelection?: number
}

interface SelectedInbox {
  id: string
  name: string
  phoneNumber?: string
  connected: boolean
  wuzapiToken?: string
}
```

#### AgentQuotaDisplay
Exibe o saldo de mensagens do owner.

```typescript
interface AgentQuotaDisplayProps {
  // Busca quota automaticamente via API
}

interface QuotaInfo {
  daily: {
    limit: number
    used: number
    remaining: number
  }
  monthly: {
    limit: number
    used: number
    remaining: number
  }
}
```

### Backend Services

#### AgentCampaignService
Gerencia campanhas criadas por agentes.

```typescript
interface AgentCampaignService {
  createCampaign(agentId: string, config: CampaignConfig): Promise<Campaign>
  listCampaigns(agentId: string, filters?: CampaignFilters): Promise<Campaign[]>
  getCampaign(agentId: string, campaignId: string): Promise<Campaign>
  pauseCampaign(agentId: string, campaignId: string): Promise<void>
  resumeCampaign(agentId: string, campaignId: string): Promise<void>
  cancelCampaign(agentId: string, campaignId: string): Promise<void>
}

interface CampaignConfig {
  name: string
  inboxId: string
  messages: MessageItem[]
  contacts: Contact[]
  humanization: HumanizationConfig
  schedule?: ScheduleConfig
}
```

#### AgentTemplateService
Gerencia templates de mensagens dos agentes.

```typescript
interface AgentTemplateService {
  createTemplate(agentId: string, template: CreateTemplateDTO): Promise<Template>
  listTemplates(agentId: string): Promise<Template[]>
  getTemplate(agentId: string, templateId: string): Promise<Template>
  updateTemplate(agentId: string, templateId: string, data: UpdateTemplateDTO): Promise<Template>
  deleteTemplate(agentId: string, templateId: string): Promise<void>
}

interface CreateTemplateDTO {
  name: string
  content: string
  config?: TemplateConfig
}
```

### API Endpoints

```
GET    /api/agent/messaging/inboxes           - Lista inboxes do agente
GET    /api/agent/messaging/quota             - Quota do owner
POST   /api/agent/messaging/send/text         - Envia texto
POST   /api/agent/messaging/send/image        - Envia imagem
POST   /api/agent/messaging/send/document     - Envia documento
POST   /api/agent/messaging/send/audio        - Envia áudio

POST   /api/agent/messaging/campaigns         - Cria campanha
GET    /api/agent/messaging/campaigns         - Lista campanhas
GET    /api/agent/messaging/campaigns/:id     - Detalhes da campanha
PUT    /api/agent/messaging/campaigns/:id/pause   - Pausa campanha
PUT    /api/agent/messaging/campaigns/:id/resume  - Retoma campanha
PUT    /api/agent/messaging/campaigns/:id/cancel  - Cancela campanha

GET    /api/agent/messaging/templates         - Lista templates
POST   /api/agent/messaging/templates         - Cria template
GET    /api/agent/messaging/templates/:id     - Detalhes do template
PUT    /api/agent/messaging/templates/:id     - Atualiza template
DELETE /api/agent/messaging/templates/:id     - Remove template

GET    /api/agent/messaging/reports           - Lista relatórios
GET    /api/agent/messaging/reports/:id       - Detalhes do relatório
GET    /api/agent/messaging/reports/:id/export - Exporta CSV
```

## Data Models

### agent_campaigns Table

```sql
CREATE TABLE agent_campaigns (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  inbox_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_contacts INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  current_position INTEGER DEFAULT 0,
  config TEXT, -- JSON with messages, humanization, schedule
  scheduled_at TEXT,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (inbox_id) REFERENCES inboxes(id)
);
```

### agent_campaign_contacts Table

```sql
CREATE TABLE agent_campaign_contacts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  variables TEXT, -- JSON
  status TEXT DEFAULT 'pending',
  sent_at TEXT,
  error_message TEXT,
  message_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (campaign_id) REFERENCES agent_campaigns(id)
);
```

### agent_templates Table

```sql
CREATE TABLE agent_templates (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  config TEXT, -- JSON with humanization settings
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following properties have been identified after reflection to eliminate redundancy:

### Property 1: Permission-based menu visibility
*For any* agent with a set of permissions, the messaging menu SHALL be visible if and only if the agent has the `messages:send` permission.
**Validates: Requirements 1.3, 1.4, 11.1**

### Property 2: Inbox filtering by agent access
*For any* agent and set of inboxes, the inbox selector SHALL display only inboxes that the agent has been granted access to.
**Validates: Requirements 2.1**

### Property 3: CSV contact parsing and validation
*For any* valid CSV file with phone numbers and variables, parsing SHALL extract all contacts with validated phone numbers and correctly mapped variables.
**Validates: Requirements 2.3**

### Property 4: Template variable substitution
*For any* message template with variables `{{var}}` and contact with matching variable values, the final message SHALL have all variables replaced with their corresponding values.
**Validates: Requirements 3.2**

### Property 5: Template persistence round-trip
*For any* template created by an agent, saving and then retrieving the template SHALL return an equivalent template with all fields preserved.
**Validates: Requirements 3.5, 8.2, 8.3**

### Property 6: Delay validation bounds
*For any* delay configuration, the minimum delay SHALL be less than or equal to the maximum delay, and both SHALL be within valid bounds (1-30 minutes).
**Validates: Requirements 4.4**

### Property 7: Randomization changes order
*For any* list of contacts with more than one element, enabling randomization SHALL produce a different order than the original (with high probability).
**Validates: Requirements 4.2**

### Property 8: Delay values within bounds
*For any* message send with configured delays, the actual delay applied SHALL be between the minimum and maximum configured values.
**Validates: Requirements 4.3**

### Property 9: Schedule time validation
*For any* scheduled campaign, the scheduled time SHALL be in the future relative to the current time.
**Validates: Requirements 5.2**

### Property 10: Sending window enforcement
*For any* campaign with a sending window configured, messages SHALL only be sent during the specified hours and days.
**Validates: Requirements 5.3**

### Property 11: Campaign progress calculation
*For any* campaign with N total contacts and M sent, the progress SHALL be calculated as M/N and displayed correctly.
**Validates: Requirements 6.2**

### Property 12: Campaign pause preserves position
*For any* running campaign that is paused, the current position SHALL be preserved and resuming SHALL continue from that position.
**Validates: Requirements 6.3, 6.4**

### Property 13: Campaign cancellation marks remaining
*For any* campaign that is cancelled, all remaining unsent contacts SHALL be marked with status 'cancelled'.
**Validates: Requirements 6.5**

### Property 14: Report statistics calculation
*For any* completed campaign, the delivery rate SHALL equal (sent_count / total_contacts) * 100, and all counts SHALL be accurate.
**Validates: Requirements 7.2**

### Property 15: Report date filtering
*For any* date range filter, the returned campaigns SHALL all have created_at within the specified range.
**Validates: Requirements 7.3**

### Property 16: CSV export completeness
*For any* campaign report export, the CSV SHALL contain all contacts with their status, phone, name, and timestamp.
**Validates: Requirements 7.4**

### Property 17: Template deletion removes from list
*For any* template that is deleted, subsequent list queries SHALL not include that template.
**Validates: Requirements 8.4**

### Property 18: Quota check before send
*For any* message send attempt, the system SHALL check the owner's daily and monthly quota before allowing the send.
**Validates: Requirements 9.1**

### Property 19: Quota exceeded rejection
*For any* send attempt when the owner's daily OR monthly quota is exceeded, the system SHALL reject the send with an appropriate error.
**Validates: Requirements 9.2, 9.3**

### Property 20: Quota increment on success
*For any* successful message send, the owner's daily and monthly usage counters SHALL be incremented by exactly 1.
**Validates: Requirements 9.4**

### Property 21: Quota display shows owner's balance
*For any* quota display request by an agent, the returned values SHALL be the owner's quota, not the agent's.
**Validates: Requirements 9.5, 1.2**

### Property 22: Media quota consumption
*For any* media message (image, document, audio) sent, exactly one message SHALL be consumed from the owner's quota.
**Validates: Requirements 10.4**

### Property 23: Draft persistence round-trip
*For any* draft saved by an agent, restoring the draft SHALL load all recipients, messages, and settings exactly as saved.
**Validates: Requirements 12.1, 12.3**

### Property 24: Draft cleared after send
*For any* campaign that is successfully sent, the associated draft SHALL be cleared/deleted.
**Validates: Requirements 12.4**

## Error Handling

### Frontend Errors

| Error Type | Handling | User Feedback |
|------------|----------|---------------|
| Network Error | Retry with exponential backoff | Toast: "Erro de conexão. Tentando novamente..." |
| Quota Exceeded | Disable send button | Alert: "Limite de mensagens atingido" |
| Invalid Phone | Highlight field | Inline error: "Número inválido" |
| Permission Denied | Redirect to dashboard | Toast: "Sem permissão para esta ação" |
| Inbox Disconnected | Disable inbox option | Badge: "Desconectado" |

### Backend Errors

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| QUOTA_EXCEEDED | 429 | Owner's daily or monthly quota exceeded |
| INBOX_NOT_FOUND | 404 | Inbox does not exist or agent has no access |
| INBOX_DISCONNECTED | 400 | Inbox is not connected to WhatsApp |
| INVALID_PHONE | 400 | Phone number validation failed |
| CAMPAIGN_NOT_FOUND | 404 | Campaign does not exist or belongs to another agent |
| TEMPLATE_NOT_FOUND | 404 | Template does not exist or belongs to another agent |
| PERMISSION_DENIED | 403 | Agent lacks required permission |

### Error Response Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

## Testing Strategy

### Dual Testing Approach

The system will use both unit tests and property-based tests to ensure correctness:

1. **Unit Tests (Vitest)**: Verify specific examples, edge cases, and integration points
2. **Property-Based Tests (fast-check)**: Verify universal properties across all valid inputs

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript/TypeScript)
- **Minimum iterations**: 100 per property
- **Test file naming**: `*.property.test.ts` or `*.property.test.js`

### Test Categories

#### Backend Property Tests

```javascript
// server/services/AgentCampaignService.property.test.js
// **Feature: agent-messaging-system, Property 12: Campaign pause preserves position**
// **Validates: Requirements 6.3, 6.4**

// **Feature: agent-messaging-system, Property 20: Quota increment on success**
// **Validates: Requirements 9.4**
```

#### Frontend Property Tests

```typescript
// src/services/agent-messaging.property.test.ts
// **Feature: agent-messaging-system, Property 4: Template variable substitution**
// **Validates: Requirements 3.2**
```

### Unit Test Coverage

- Route handlers: Authentication, authorization, input validation
- Service methods: CRUD operations, business logic
- Components: Rendering, user interactions, state management
- Integration: API calls, database operations

### Test Data Generators

```typescript
// Generators for property-based tests
const phoneGenerator = fc.stringMatching(/^55\d{10,11}$/)
const contactGenerator = fc.record({
  phone: phoneGenerator,
  name: fc.string({ minLength: 1, maxLength: 100 }),
  variables: fc.dictionary(fc.string(), fc.string())
})
const templateGenerator = fc.record({
  name: fc.string({ minLength: 1, maxLength: 100 }),
  content: fc.string({ minLength: 1, maxLength: 4096 })
})
```

