# Design Document: Contact CRM Evolution

## Overview

Este documento descreve a arquitetura e design para evoluir o sistema de contatos existente para um CRM completo. A solução será construída sobre a stack existente (React + TypeScript + Supabase + shadcn/ui) com adição incremental de funcionalidades.

### Princípios de Design

1. **Evolução Incremental**: Não reescrever, mas estender o sistema existente
2. **Supabase-First**: Usar recursos nativos do Supabase (RLS, triggers, functions)
3. **Headless Components**: Separar lógica de negócio da UI
4. **Performance**: Usar views materializadas para métricas calculadas
5. **Multi-tenant**: Manter isolamento por `tenant_id` e `account_id`

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  Pages                    │  Components                              │
│  ├── ContactDetailPage    │  ├── ContactTimeline                    │
│  ├── ContactsListPage     │  ├── LeadScoreCard                      │
│  ├── SegmentsPage         │  ├── PurchaseHistory                    │
│  └── CRMDashboardPage     │  ├── CreditBalance                      │
│                           │  ├── CustomFieldsEditor                 │
│  Hooks                    │  └── SegmentBuilder                     │
│  ├── useContactCRM        │                                          │
│  ├── useLeadScore         │  Services                                │
│  ├── usePurchaseHistory   │  ├── contactCRMService.ts               │
│  ├── useCreditBalance     │  ├── leadScoringService.ts              │
│  └── useSegments          │  └── segmentService.ts                  │
├─────────────────────────────────────────────────────────────────────┤
│                         Backend (Express)                            │
├─────────────────────────────────────────────────────────────────────┤
│  Routes                   │  Services                                │
│  ├── userCRMRoutes.js     │  ├── LeadScoringService.js              │
│  ├── userPurchaseRoutes.js│  ├── PurchaseService.js                 │
│  ├── userCreditRoutes.js  │  ├── CreditService.js                   │
│  └── userSegmentRoutes.js │  └── SegmentService.js                  │
├─────────────────────────────────────────────────────────────────────┤
│                         Supabase (PostgreSQL)                        │
├─────────────────────────────────────────────────────────────────────┤
│  Tables                   │  Functions/Triggers                      │
│  ├── contacts (extended)  │  ├── calculate_lead_score()             │
│  ├── contact_interactions │  ├── update_contact_metrics()           │
│  ├── contact_purchases    │  ├── process_credit_transaction()       │
│  ├── contact_credits      │  └── evaluate_segment_membership()      │
│  ├── contact_custom_fields│                                          │
│  ├── custom_field_defs    │  Views                                   │
│  └── contact_segments     │  ├── contact_metrics_view               │
│                           │  └── segment_members_view               │
└─────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### ContactDetailPage
Página principal de detalhes do contato com todas as informações CRM.

```typescript
interface ContactDetailPageProps {
  contactId: string;
}

// Sections:
// - Header: Nome, avatar, lead score badge, quick actions
// - Metrics: LTV, AOV, credit balance, last interaction
// - Timeline: Unified activity feed
// - Purchases: Purchase history table
// - Credits: Credit balance and transactions
// - Custom Fields: Editable custom fields
// - Preferences: Communication opt-in/out
```

#### ContactTimeline
Timeline unificada de todas as atividades do contato.

```typescript
interface TimelineEvent {
  id: string;
  type: 'message' | 'purchase' | 'credit' | 'note' | 'status_change';
  timestamp: Date;
  direction?: 'incoming' | 'outgoing';
  content: string;
  metadata?: Record<string, unknown>;
}

interface ContactTimelineProps {
  contactId: string;
  events: TimelineEvent[];
  onLoadMore: () => void;
  filters?: {
    types?: TimelineEvent['type'][];
    dateRange?: { start: Date; end: Date };
  };
}
```

#### LeadScoreCard
Exibe e permite editar o lead score do contato.

```typescript
interface LeadScoreCardProps {
  score: number; // 0-100
  tier: 'cold' | 'warm' | 'hot' | 'vip';
  lastUpdated: Date;
  breakdown?: {
    messages: number;
    purchases: number;
    recency: number;
    custom: number;
  };
}
```

#### SegmentBuilder
Construtor visual de segmentos com lógica AND/OR.

```typescript
interface SegmentCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
  value: unknown;
}

interface SegmentGroup {
  logic: 'AND' | 'OR';
  conditions: (SegmentCondition | SegmentGroup)[];
}

interface SegmentBuilderProps {
  segment?: SegmentGroup;
  availableFields: FieldDefinition[];
  onChange: (segment: SegmentGroup) => void;
  onPreview: () => Promise<{ count: number; sample: Contact[] }>;
}
```

### Backend Services

#### LeadScoringService
Calcula e atualiza lead scores baseado em configuração.

```javascript
// server/services/LeadScoringService.js
class LeadScoringService {
  // Configuração padrão de scoring
  static DEFAULT_CONFIG = {
    messageReceived: 5,
    messageSent: 2,
    purchaseMade: 20,
    purchaseValueMultiplier: 0.01, // 1 ponto por R$100
    inactivityDecayPerDay: 0.5,
    maxScore: 100,
    tiers: {
      cold: { min: 0, max: 25 },
      warm: { min: 26, max: 50 },
      hot: { min: 51, max: 75 },
      vip: { min: 76, max: 100 }
    }
  };

  async calculateScore(contactId, config = DEFAULT_CONFIG) {}
  async updateScoreOnMessage(contactId, direction) {}
  async updateScoreOnPurchase(contactId, amount) {}
  async applyDecay(accountId) {} // Batch job
  async getTier(score, config = DEFAULT_CONFIG) {}
}
```

#### CreditService
Gerencia saldo e transações de créditos.

```javascript
// server/services/CreditService.js
class CreditService {
  async getBalance(contactId) {}
  async addCredits(contactId, amount, source, metadata = {}) {}
  async consumeCredits(contactId, amount, reason, metadata = {}) {}
  async getTransactionHistory(contactId, options = {}) {}
  async checkSufficientBalance(contactId, amount) {}
}
```

#### SegmentService
Avalia e gerencia segmentos dinâmicos.

```javascript
// server/services/SegmentService.js
class SegmentService {
  async createSegment(accountId, name, conditions) {}
  async evaluateSegment(segmentId) {} // Returns matching contact IDs
  async getSegmentMembers(segmentId, options = {}) {}
  async updateSegmentMembership(contactId) {} // Called on contact change
  async getPrebuiltTemplates() {}
}
```

## Data Models

### Extended Contacts Table

```sql
-- Extensão da tabela contacts existente
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0 CHECK (lead_score >= 0 AND lead_score <= 100);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_tier VARCHAR(20) DEFAULT 'cold' CHECK (lead_tier IN ('cold', 'warm', 'hot', 'vip'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifetime_value_cents INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS purchase_count INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_purchase_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS bulk_messaging_opt_in BOOLEAN DEFAULT true;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opt_out_method VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
```

### Contact Interactions Table

```sql
CREATE TABLE contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('message', 'call', 'email', 'note', 'status_change')),
  direction VARCHAR(20) CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT,
  content_preview VARCHAR(200),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_by_type VARCHAR(20) CHECK (created_by_type IN ('account', 'agent', 'system'))
);

CREATE INDEX idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_created ON contact_interactions(created_at DESC);
CREATE INDEX idx_contact_interactions_type ON contact_interactions(type);
```

### Contact Purchases Table

```sql
CREATE TABLE contact_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  external_id VARCHAR(255), -- ID do sistema externo (Stripe, etc)
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency VARCHAR(3) DEFAULT 'BRL',
  description TEXT,
  product_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  source VARCHAR(50) DEFAULT 'manual' CHECK (source IN ('manual', 'stripe', 'webhook', 'import')),
  metadata JSONB DEFAULT '{}',
  purchased_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contact_purchases_contact ON contact_purchases(contact_id);
CREATE INDEX idx_contact_purchases_date ON contact_purchases(purchased_at DESC);
CREATE INDEX idx_contact_purchases_external ON contact_purchases(external_id);
```

### Contact Credits Table

```sql
CREATE TABLE contact_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('credit', 'debit', 'adjustment', 'expiration')),
  amount INTEGER NOT NULL, -- Positivo para crédito, negativo para débito
  balance_after INTEGER NOT NULL,
  source VARCHAR(100), -- 'purchase', 'bonus', 'message_sent', 'manual', etc
  description TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  created_by_type VARCHAR(20) CHECK (created_by_type IN ('account', 'agent', 'system'))
);

CREATE INDEX idx_contact_credits_contact ON contact_credit_transactions(contact_id);
CREATE INDEX idx_contact_credits_created ON contact_credit_transactions(created_at DESC);
```

### Custom Field Definitions Table

```sql
CREATE TABLE custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  name VARCHAR(100) NOT NULL,
  label VARCHAR(200) NOT NULL,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email', 'phone')),
  options JSONB, -- Para dropdown: ["option1", "option2"]
  is_required BOOLEAN DEFAULT false,
  is_searchable BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  default_value TEXT,
  validation_rules JSONB, -- { "min": 0, "max": 100, "pattern": "..." }
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(account_id, name)
);

CREATE INDEX idx_custom_fields_account ON custom_field_definitions(account_id);
```

### Contact Segments Table

```sql
CREATE TABLE contact_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  conditions JSONB NOT NULL, -- SegmentGroup structure
  is_template BOOLEAN DEFAULT false,
  template_key VARCHAR(100), -- 'inactive', 'high_value', 'new_leads'
  member_count INTEGER DEFAULT 0,
  last_evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contact_segment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES contact_segments(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(segment_id, contact_id)
);

CREATE INDEX idx_segment_members_segment ON contact_segment_members(segment_id);
CREATE INDEX idx_segment_members_contact ON contact_segment_members(contact_id);
```

### Lead Scoring Configuration Table

```sql
CREATE TABLE lead_scoring_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  account_id UUID NOT NULL REFERENCES accounts(id) UNIQUE,
  config JSONB NOT NULL DEFAULT '{
    "messageReceived": 5,
    "messageSent": 2,
    "purchaseMade": 20,
    "purchaseValueMultiplier": 0.01,
    "inactivityDecayPerDay": 0.5,
    "maxScore": 100,
    "tiers": {
      "cold": {"min": 0, "max": 25},
      "warm": {"min": 26, "max": 50},
      "hot": {"min": 51, "max": 75},
      "vip": {"min": 76, "max": 100}
    }
  }',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Lead Score Bounds
*For any* contact in the system, the lead_score SHALL always be between 0 and 100 inclusive, and the lead_tier SHALL always match the score according to the configured thresholds.

**Validates: Requirements 2.1, 2.5**

### Property 2: Lead Score Monotonic Increase on Positive Events
*For any* contact, when a message is received or a purchase is made, the lead_score SHALL increase by the configured amount (capped at max_score), and the previous score SHALL be less than or equal to the new score.

**Validates: Requirements 2.2, 2.3**

### Property 3: Timeline Chronological Ordering
*For any* contact timeline query, the returned events SHALL be ordered by timestamp in descending order (most recent first), and all events SHALL belong to the specified contact.

**Validates: Requirements 1.3, 3.5, 8.5**

### Property 4: Credit Balance Consistency
*For any* contact, the credit_balance SHALL equal the sum of all credit_transaction amounts for that contact. After any credit transaction, the balance_after field SHALL equal the previous balance plus the transaction amount.

**Validates: Requirements 4.1, 4.2, 4.3, 4.7**

### Property 5: Purchase Metrics Accuracy
*For any* contact with purchases, the lifetime_value_cents SHALL equal the sum of all completed purchase amounts, the purchase_count SHALL equal the count of completed purchases, and the AOV (lifetime_value_cents / purchase_count) SHALL be correctly calculated.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 6: Communication Preference Enforcement
*For any* bulk campaign recipient list, no contact with bulk_messaging_opt_in = false SHALL be included. When a contact opts out, the opt_out_at timestamp SHALL be recorded and bulk_messaging_opt_in SHALL be set to false.

**Validates: Requirements 5.1, 5.2, 5.4**

### Property 7: Opt-Out Keyword Detection
*For any* incoming message containing an opt-out keyword (case-insensitive: "SAIR", "PARAR", "STOP", "UNSUBSCRIBE"), the contact's bulk_messaging_opt_in SHALL be set to false and opt_out_method SHALL be set to "keyword".

**Validates: Requirements 5.3**

### Property 8: Custom Field Type Validation
*For any* custom field value, the value SHALL conform to the field_type definition: numbers for 'number' type, valid dates for 'date' type, valid URLs for 'url' type, and values from options array for 'dropdown' type.

**Validates: Requirements 6.1, 6.3**

### Property 9: Dynamic Segment Membership
*For any* segment with defined conditions, a contact SHALL be a member if and only if the contact's attributes satisfy all conditions (for AND logic) or at least one condition (for OR logic). When a contact's attributes change, their segment membership SHALL be re-evaluated.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 10: Purchase Webhook Contact Matching
*For any* purchase webhook received, if a contact exists with matching phone or email, the purchase SHALL be associated with that contact. If no match exists, a new contact SHALL be created with the purchase data and source = 'webhook'.

**Validates: Requirements 9.1, 9.2, 9.3**

### Property 11: Interaction Log Completeness
*For any* message sent or received, an interaction record SHALL be created with the correct type, direction, timestamp, and content_preview (first 200 characters). The contact's last_interaction_at SHALL be updated to the interaction timestamp.

**Validates: Requirements 1.1, 1.2, 1.4**

### Property 12: Inactivity Detection
*For any* contact where (current_time - last_interaction_at) > 30 days, the is_active flag SHALL be false. For contacts with recent interactions, is_active SHALL be true.

**Validates: Requirements 1.5, 2.4**

### Property 13: Analytics Metrics Accuracy
*For any* analytics query, the total_contacts SHALL equal the count of contacts in the account, active_contacts SHALL equal contacts with is_active = true, average_lead_score SHALL equal the mean of all lead_scores, and total_ltv SHALL equal the sum of all lifetime_value_cents.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

## Error Handling

### Database Errors
- Todas as operações de banco usam transações para garantir consistência
- Erros de constraint (FK, CHECK) são capturados e retornados com mensagens amigáveis
- Deadlocks são tratados com retry automático (max 3 tentativas)

### Credit Operations
- Operações de débito verificam saldo antes de executar
- Se saldo insuficiente, retorna erro `INSUFFICIENT_CREDITS` com saldo atual
- Transações de crédito são atômicas (balance update + transaction log)

### Webhook Processing
- Webhooks são processados de forma idempotente (usando external_id)
- Falhas são logadas e podem ser reprocessadas
- Timeout de 30s para processamento de webhook

### Segment Evaluation
- Segmentos grandes (>10k contatos) são avaliados em batches
- Avaliação é feita em background job para não bloquear UI
- Cache de membership com TTL de 5 minutos

## Testing Strategy

### Unit Tests
- Testar cada service method isoladamente
- Mockar Supabase para testes de lógica de negócio
- Testar validações de input (custom fields, segment conditions)

### Property-Based Tests
Usar `fast-check` para testes de propriedade:

```typescript
// Exemplo: Property 1 - Lead Score Bounds
import fc from 'fast-check';

describe('LeadScoringService', () => {
  it('should always produce scores between 0 and 100', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 1000 }), // random score adjustments
        fc.integer({ min: 0, max: 100 }), // initial score
        (adjustment, initialScore) => {
          const newScore = calculateNewScore(initialScore, adjustment);
          return newScore >= 0 && newScore <= 100;
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests
- Testar fluxos completos (webhook → purchase → score update)
- Testar RLS policies com diferentes usuários
- Testar segment evaluation com dados reais

### E2E Tests (Cypress)
- Testar UI de detalhes do contato
- Testar segment builder
- Testar timeline com diferentes tipos de eventos
