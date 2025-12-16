# Design Document - Message Variation Humanizer

## Overview

O Message Variation System é um sistema de humanização de mensagens que permite aos usuários definir múltiplas variações de texto usando o delimitador `|` (barra vertical). O sistema processa essas variações e seleciona aleatoriamente uma opção de cada bloco antes do envio, tornando as mensagens mais naturais e menos detectáveis como automação.

Este sistema será integrado ao fluxo existente de envio de mensagens (single e bulk) e ao sistema de templates, mantendo compatibilidade com variáveis de personalização existentes (`{{variavel}}`).

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer                            │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Message Editor   │  │ Preview Generator│                │
│  │ (Inline Editing) │  │ (Real-time)      │                │
│  └────────┬─────────┘  └────────┬─────────┘                │
│           │                      │                           │
│           └──────────┬───────────┘                           │
│                      │                                       │
│           ┌──────────▼──────────┐                           │
│           │ Variation Validator │                           │
│           │ (Client-side)       │                           │
│           └──────────┬──────────┘                           │
└──────────────────────┼──────────────────────────────────────┘
                       │
                       │ API Call
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    Backend Layer                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Message Processing Pipeline                 │  │
│  │                                                        │  │
│  │  1. Variation Parser                                  │  │
│  │     └─> Extract variation blocks                      │  │
│  │                                                        │  │
│  │  2. Random Selector                                   │  │
│  │     └─> Select one option per block                   │  │
│  │                                                        │  │
│  │  3. Template Processor                                │  │
│  │     └─> Replace blocks with selections                │  │
│  │                                                        │  │
│  │  4. Variable Substitution                             │  │
│  │     └─> Apply {{variavel}} replacements               │  │
│  │                                                        │  │
│  │  5. Message Sender                                    │  │
│  │     └─> Send via WUZAPI                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Variation Tracking System                   │  │
│  │  - Log selected variations                            │  │
│  │  - Track usage statistics                             │  │
│  │  - Generate reports                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Input → Validator → Parser → Selector → Processor → Sender
                ↓           ↓         ↓          ↓         ↓
            Feedback    Blocks    Choices   Final Msg   Tracking
```

## Components and Interfaces

### 1. Frontend Components

#### 1.1 MessageVariationEditor (New Component)

**Location**: `src/components/user/MessageVariationEditor.tsx`

**Purpose**: Editor inline com preview em tempo real e validação visual de variações

**Props**:
```typescript
interface MessageVariationEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  showPreview?: boolean;
  maxVariationsPerBlock?: number;
}
```

**Features**:
- Syntax highlighting para blocos de variação
- Preview em tempo real com botão "Gerar Nova Variação"
- Contador de combinações possíveis
- Validação inline com feedback visual
- Suporte a múltiplas linhas

**Design Pattern**: Inline editing (seguindo UX patterns do projeto)

#### 1.2 VariationPreviewPanel (New Component)

**Location**: `src/components/user/VariationPreviewPanel.tsx`

**Purpose**: Painel expansível que mostra previews de variações

**Props**:
```typescript
interface VariationPreviewPanelProps {
  template: string;
  variables?: Record<string, string>;
  onGenerate: () => void;
}
```

**Features**:
- Botão "Gerar Preview" para nova amostra
- Exibição do preview processado
- Indicador de número de combinações possíveis
- Highlight das partes que foram variadas

#### 1.3 VariationStatsCard (New Component)

**Location**: `src/components/user/VariationStatsCard.tsx`

**Purpose**: Card inline que exibe estatísticas de uso de variações

**Props**:
```typescript
interface VariationStatsCardProps {
  campaignId: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}
```

**Features**:
- Gráfico de distribuição de variações
- Porcentagem de uso por variação
- Exportação de dados
- Expansão inline (sem modal)

### 2. Backend Services

#### 2.1 VariationParser

**Location**: `server/services/VariationParser.js`

**Purpose**: Parsear mensagens e extrair blocos de variação

**Interface**:
```javascript
class VariationParser {
  /**
   * Parse message and extract variation blocks
   * @param {string} message - Message with variation syntax
   * @returns {ParsedMessage} Parsed structure
   */
  parse(message) {
    // Returns: { blocks: [], staticParts: [], isValid: boolean, errors: [] }
  }

  /**
   * Validate variation syntax
   * @param {string} message - Message to validate
   * @returns {ValidationResult}
   */
  validate(message) {
    // Returns: { isValid: boolean, errors: [], warnings: [] }
  }

  /**
   * Calculate total possible combinations
   * @param {ParsedMessage} parsed - Parsed message
   * @returns {number}
   */
  calculateCombinations(parsed) {
    // Returns total combinations
  }
}
```

**Validation Rules**:
- Minimum 2 variations per block
- No empty variations
- Maximum 10 variations per block (configurable)
- Balanced delimiters

#### 2.2 RandomSelector

**Location**: `server/services/RandomSelector.js`

**Purpose**: Selecionar aleatoriamente uma variação de cada bloco

**Interface**:
```javascript
class RandomSelector {
  /**
   * Select random variation from each block
   * @param {Array<Array<string>>} blocks - Array of variation blocks
   * @returns {Array<string>} Selected variations
   */
  selectVariations(blocks) {
    // Returns array of selected variations
  }

  /**
   * Select with weighted distribution (future enhancement)
   * @param {Array<Array<string>>} blocks
   * @param {Object} weights - Weights per variation
   * @returns {Array<string>}
   */
  selectWeighted(blocks, weights) {
    // Returns weighted selections
  }
}
```

**Algorithm**: Crypto.randomInt() para distribuição uniforme

#### 2.3 TemplateProcessor

**Location**: `server/services/TemplateProcessor.js`

**Purpose**: Processar template completo substituindo variações e variáveis

**Interface**:
```javascript
class TemplateProcessor {
  /**
   * Process complete message with variations and variables
   * @param {string} template - Original template
   * @param {Object} variables - Variables for substitution
   * @returns {ProcessedMessage}
   */
  process(template, variables = {}) {
    // 1. Parse variations
    // 2. Select random variations
    // 3. Replace variation blocks
    // 4. Apply variable substitution
    // Returns: { message: string, selectedVariations: [], metadata: {} }
  }

  /**
   * Generate preview without sending
   * @param {string} template
   * @param {Object} variables
   * @returns {string}
   */
  generatePreview(template, variables = {}) {
    // Returns processed message for preview
  }
}
```

**Processing Order**:
1. Parse variation blocks
2. Select random variations
3. Replace blocks with selections
4. Apply {{variable}} substitution
5. Return final message

#### 2.4 VariationTracker

**Location**: `server/services/VariationTracker.js`

**Purpose**: Rastrear e registrar variações usadas

**Interface**:
```javascript
class VariationTracker {
  /**
   * Log variation usage
   * @param {Object} data - Tracking data
   */
  async logVariation(data) {
    // data: { campaignId, messageId, template, selectedVariations, timestamp }
  }

  /**
   * Get statistics for campaign
   * @param {string} campaignId
   * @returns {VariationStats}
   */
  async getStats(campaignId) {
    // Returns: { distribution: {}, totalSent: number, uniqueCombinations: number }
  }

  /**
   * Export variation data
   * @param {string} campaignId
   * @param {string} format - 'json' | 'csv'
   * @returns {Buffer}
   */
  async exportData(campaignId, format = 'json') {
    // Returns exportable data
  }
}
```

### 3. API Endpoints

#### 3.1 Validation Endpoint

```
POST /api/user/messages/validate-variations
```

**Request**:
```json
{
  "message": "Olá|Oi|E aí, tudo bem?|como vai?"
}
```

**Response**:
```json
{
  "isValid": true,
  "blocks": [
    {
      "index": 0,
      "variations": ["Olá", "Oi", "E aí"],
      "count": 3
    },
    {
      "index": 1,
      "variations": ["tudo bem?", "como vai?"],
      "count": 2
    }
  ],
  "totalCombinations": 6,
  "errors": [],
  "warnings": []
}
```

#### 3.2 Preview Generation Endpoint

```
POST /api/user/messages/preview-variations
```

**Request**:
```json
{
  "template": "Olá {{nome}}|Oi {{nome}}, tudo bem?|como vai?",
  "variables": {
    "nome": "João"
  }
}
```

**Response**:
```json
{
  "preview": "Oi João, tudo bem?",
  "selectedVariations": [
    { "blockIndex": 0, "selected": "Oi {{nome}}" }
  ],
  "totalCombinations": 3
}
```

#### 3.3 Statistics Endpoint

```
GET /api/user/campaigns/:campaignId/variation-stats
```

**Response**:
```json
{
  "campaignId": "123",
  "totalSent": 1000,
  "uniqueCombinations": 45,
  "distribution": {
    "block_0": {
      "Olá": { "count": 334, "percentage": 33.4 },
      "Oi": { "count": 333, "percentage": 33.3 },
      "E aí": { "count": 333, "percentage": 33.3 }
    }
  },
  "deliveryMetrics": {
    "delivered": 980,
    "failed": 20,
    "read": 450
  }
}
```

## Data Models

### 1. Database Schema

#### message_variations Table (New)

```sql
CREATE TABLE message_variations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id INTEGER,
  message_id TEXT,
  template TEXT NOT NULL,
  selected_variations TEXT NOT NULL, -- JSON array
  recipient TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered BOOLEAN DEFAULT 0,
  read BOOLEAN DEFAULT 0,
  user_id INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (campaign_id) REFERENCES bulk_campaigns(id)
);

CREATE INDEX idx_message_variations_campaign ON message_variations(campaign_id);
CREATE INDEX idx_message_variations_user ON message_variations(user_id);
CREATE INDEX idx_message_variations_sent_at ON message_variations(sent_at);
```

#### message_templates Table (Update)

Add column to existing table:

```sql
ALTER TABLE message_templates 
ADD COLUMN has_variations BOOLEAN DEFAULT 0;

CREATE INDEX idx_message_templates_variations ON message_templates(has_variations);
```

### 2. TypeScript Interfaces

```typescript
// src/lib/types.ts

export interface VariationBlock {
  index: number;
  variations: string[];
  count: number;
}

export interface ParsedMessage {
  blocks: VariationBlock[];
  staticParts: string[];
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalCombinations: number;
}

export interface ProcessedMessage {
  message: string;
  selectedVariations: Array<{
    blockIndex: number;
    selected: string;
  }>;
  metadata: {
    originalTemplate: string;
    processedAt: string;
    combinationId: string;
  };
}

export interface VariationStats {
  campaignId: string;
  totalSent: number;
  uniqueCombinations: number;
  distribution: Record<string, Record<string, {
    count: number;
    percentage: number;
  }>>;
  deliveryMetrics: {
    delivered: number;
    failed: number;
    read: number;
  };
}
```

## Error Handling

### Validation Errors

```typescript
enum VariationErrorCode {
  EMPTY_VARIATION = 'EMPTY_VARIATION',
  INSUFFICIENT_VARIATIONS = 'INSUFFICIENT_VARIATIONS',
  TOO_MANY_VARIATIONS = 'TOO_MANY_VARIATIONS',
  INVALID_SYNTAX = 'INVALID_SYNTAX',
  UNBALANCED_DELIMITERS = 'UNBALANCED_DELIMITERS'
}

interface VariationError {
  code: VariationErrorCode;
  message: string;
  blockIndex?: number;
  suggestion?: string;
}
```

### Error Messages (Portuguese)

```javascript
const ERROR_MESSAGES = {
  EMPTY_VARIATION: 'Variação vazia detectada no bloco {blockIndex}. Remova delimitadores extras.',
  INSUFFICIENT_VARIATIONS: 'Bloco {blockIndex} precisa de pelo menos 2 variações.',
  TOO_MANY_VARIATIONS: 'Bloco {blockIndex} tem mais de 10 variações. Considere simplificar.',
  INVALID_SYNTAX: 'Sintaxe inválida detectada. Verifique os delimitadores "|".',
  UNBALANCED_DELIMITERS: 'Delimitadores desbalanceados. Cada "|" deve separar variações válidas.'
};
```

### Frontend Error Display

- Inline validation com highlight vermelho
- Tooltip com mensagem de erro e sugestão
- Bloqueio de envio até correção
- Toast notification para erros críticos

### Backend Error Handling

```javascript
// server/routes/userMessageRoutes.js
router.post('/messages/send', authenticate, async (req, res) => {
  try {
    const { message, recipient, variables } = req.body;
    
    // Validate variations
    const validation = variationParser.validate(message);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid variation syntax',
        details: validation.errors
      });
    }
    
    // Process and send
    const processed = templateProcessor.process(message, variables);
    const result = await wuzapiClient.sendMessage(recipient, processed.message);
    
    // Track variation
    await variationTracker.logVariation({
      messageId: result.id,
      template: message,
      selectedVariations: processed.selectedVariations,
      recipient
    });
    
    res.json({ success: true, messageId: result.id });
    
  } catch (error) {
    logger.error('Error sending message with variations', { 
      error: error.message,
      userId: req.user.id 
    });
    res.status(500).json({ error: error.message });
  }
});
```

## Testing Strategy

### Unit Tests

**Frontend** (`src/test/`):
- `VariationParser.test.ts` - Parser logic
- `MessageVariationEditor.test.tsx` - Component behavior
- `VariationPreviewPanel.test.tsx` - Preview generation

**Backend** (`server/tests/services/`):
- `VariationParser.test.js` - Parsing and validation
- `RandomSelector.test.js` - Random selection distribution
- `TemplateProcessor.test.js` - End-to-end processing
- `VariationTracker.test.js` - Tracking and statistics

### Integration Tests

**Backend** (`server/tests/integration/`):
- `message-variations-flow.test.js` - Complete send flow
- `bulk-variations.test.js` - Bulk sending with variations
- `variation-stats.test.js` - Statistics generation

### E2E Tests

**Cypress** (`cypress/e2e/`):
- `message-variations.cy.ts` - User flow from editor to send
- `variation-preview.cy.ts` - Preview generation
- `variation-stats.cy.ts` - Statistics viewing

### Performance Tests

**Target Metrics**:
- Parse + process: < 10ms per message
- Bulk processing: 1000 messages/minute
- Statistics query: < 500ms for 10k records

**Test Scenarios**:
```javascript
// server/tests/performance/variations.perf.test.js
describe('Variation Performance', () => {
  it('should process 1000 messages in under 10 seconds', async () => {
    const template = 'Olá|Oi|E aí {{nome}}, tudo bem?|como vai?';
    const start = Date.now();
    
    for (let i = 0; i < 1000; i++) {
      await templateProcessor.process(template, { nome: `User${i}` });
    }
    
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(10000);
  });
});
```

## Design Decisions & Rationales

### 1. Delimiter Choice: Pipe (|)

**Decision**: Use `|` as variation delimiter

**Rationale**:
- Rarely used in normal Portuguese text
- Easy to type on all keyboards
- Visually distinct
- Common in template systems
- Single character (simple parsing)

**Alternatives Considered**:
- `//` - Too common in URLs
- `::` - Confusing with time format
- `{}` - Conflicts with variable syntax

### 2. Processing Order: Variations Before Variables

**Decision**: Process variations first, then apply variable substitution

**Rationale**:
- Allows variations to contain variables: `Olá {{nome}}|Oi {{nome}}`
- Simpler mental model for users
- Prevents variable syntax from interfering with variation parsing
- More flexible for complex templates

**Example**:
```
Template: "Olá {{nome}}|Oi {{nome}}, tudo bem?"
Step 1: Select variation → "Oi {{nome}}"
Step 2: Apply variables → "Oi João"
```

### 3. Inline Editing (No Modals)

**Decision**: Use inline editor with expandable preview panel

**Rationale**:
- Follows project UX patterns (see ux-patterns.md)
- Maintains context while editing
- Better mobile experience
- Faster workflow
- Consistent with existing components

### 4. Client + Server Validation

**Decision**: Validate on both frontend and backend

**Rationale**:
- Frontend: Immediate feedback, better UX
- Backend: Security, data integrity
- Prevents invalid data from reaching database
- Allows offline validation in frontend

### 5. Tracking All Variations

**Decision**: Log every variation selection to database

**Rationale**:
- Enables statistics and optimization
- Audit trail for compliance
- A/B testing capabilities
- Performance analysis
- Minimal storage overhead (< 1KB per message)

### 6. Random Selection Algorithm

**Decision**: Use `crypto.randomInt()` for uniform distribution

**Rationale**:
- Cryptographically secure randomness
- Uniform distribution (no bias)
- Built-in Node.js (no dependencies)
- Fast performance
- Future-proof for weighted selection

### 7. Maximum 10 Variations Per Block

**Decision**: Soft limit of 10 variations, warning above 5

**Rationale**:
- Maintains readability
- Prevents performance issues
- Encourages quality over quantity
- Still allows flexibility
- Configurable if needed

### 8. Separate Service Classes

**Decision**: Split into Parser, Selector, Processor, Tracker

**Rationale**:
- Single Responsibility Principle
- Easier testing
- Reusable components
- Clear separation of concerns
- Maintainable codebase

## Integration Points

### 1. Existing Message Sending Flow

**Current Flow**:
```
User Input → Validation → WUZAPI Send → Response
```

**New Flow**:
```
User Input → Variation Validation → Parse → Select → Process → WUZAPI Send → Track → Response
```

**Integration**: Middleware in message routes

### 2. Bulk Campaign System

**Location**: `server/services/CampaignScheduler.js`

**Integration**:
```javascript
// Add variation processing to queue
async processMessage(message, recipient, variables) {
  // Process variations
  const processed = await templateProcessor.process(message.template, {
    ...variables,
    ...recipient.customFields
  });
  
  // Send via existing flow
  return await this.sendMessage(recipient, processed.message);
}
```

### 3. Template System

**Location**: `server/routes/userMessageRoutes.js` (templates endpoints)

**Integration**:
- Add `has_variations` flag when saving templates
- Validate variations on template save
- Show variation indicator in template list
- Preserve variations when loading templates

### 4. Statistics Dashboard

**Location**: `src/components/user/CampaignStats.tsx`

**Integration**:
- Add new tab "Variações" to existing stats
- Inline expansion for variation details
- Export button for variation data
- Chart component for distribution

## Performance Considerations

### 1. Caching Strategy

**Template Parsing Cache**:
```javascript
// LRU cache for parsed templates
const parseCache = new LRUCache({
  max: 1000,
  ttl: 1000 * 60 * 60 // 1 hour
});

parse(template) {
  const cached = parseCache.get(template);
  if (cached) return cached;
  
  const parsed = this._doParse(template);
  parseCache.set(template, parsed);
  return parsed;
}
```

### 2. Bulk Processing Optimization

**Batch Processing**:
- Process variations asynchronously
- Use worker threads for large batches (> 1000 messages)
- Stream results to database
- Progress tracking via existing queue system

### 3. Database Indexing

**Critical Indexes**:
- `campaign_id` - For statistics queries
- `sent_at` - For time-based reports
- `user_id` - For user-scoped queries

### 4. Statistics Query Optimization

**Aggregation Strategy**:
```javascript
// Pre-aggregate statistics on insert
async logVariation(data) {
  await db.run('INSERT INTO message_variations ...');
  
  // Update aggregated stats table
  await db.run(`
    INSERT INTO variation_stats_cache (campaign_id, block_index, variation, count)
    VALUES (?, ?, ?, 1)
    ON CONFLICT (campaign_id, block_index, variation)
    DO UPDATE SET count = count + 1
  `);
}
```

## Migration Plan

### Phase 1: Core Infrastructure (Week 1)
- Create database tables
- Implement backend services (Parser, Selector, Processor)
- Add API endpoints
- Unit tests

### Phase 2: Frontend Components (Week 2)
- MessageVariationEditor component
- VariationPreviewPanel component
- Integration with existing message forms
- Frontend validation

### Phase 3: Bulk Integration (Week 3)
- Integrate with CampaignScheduler
- Bulk processing optimization
- Queue management updates
- Integration tests

### Phase 4: Statistics & Tracking (Week 4)
- VariationTracker implementation
- Statistics endpoints
- VariationStatsCard component
- Export functionality

### Phase 5: Polish & Testing (Week 5)
- E2E tests
- Performance optimization
- Documentation
- User acceptance testing

## Future Enhancements

### 1. Weighted Variations
Allow users to set probability weights for variations:
```
Olá:50|Oi:30|E aí:20
```

### 2. Conditional Variations
Variations based on contact attributes:
```
[if:vip]Olá Sr. {{nome}}[else]Oi {{nome}}[endif]
```

### 3. A/B Testing Integration
Automatic A/B testing with conversion tracking

### 4. AI-Powered Suggestions
Suggest variations based on message content and performance data

### 5. Variation Templates Library
Pre-built variation patterns for common scenarios

## Security Considerations

### 1. Input Sanitization
- Validate variation syntax before processing
- Prevent injection attacks via delimiters
- Sanitize user input in statistics display

### 2. Rate Limiting
- Apply existing rate limits to variation endpoints
- Prevent abuse of preview generation

### 3. User Scoping
- All variation data scoped to user_id
- Statistics only accessible to message owner
- Admin can view aggregated stats only

### 4. Data Privacy
- No PII in variation logs (only template structure)
- Recipient data encrypted at rest
- Comply with existing data retention policies

## Monitoring & Observability

### Metrics to Track
- Variation processing time (p50, p95, p99)
- Parse cache hit rate
- Validation error rate
- Distribution uniformity
- Statistics query performance

### Logging
```javascript
logger.info('Variation processed', {
  userId: user.id,
  campaignId: campaign.id,
  blocksCount: parsed.blocks.length,
  totalCombinations: parsed.totalCombinations,
  processingTime: duration
});
```

### Alerts
- Processing time > 50ms
- Validation error rate > 5%
- Cache hit rate < 70%
- Statistics query > 1s
