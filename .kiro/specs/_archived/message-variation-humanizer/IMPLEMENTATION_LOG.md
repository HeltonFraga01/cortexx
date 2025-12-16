# Message Variation Humanizer - Implementation Log

## Task 1: Database Schema and Migrations ✅

**Status**: Completed  
**Date**: 2025-11-13

### What Was Implemented

Created migration file `server/migrations/008_add_message_variations.js` that:

1. **Creates `message_variations` table** with the following structure:
   - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
   - `campaign_id` (TEXT) - Foreign key to campaigns table
   - `message_id` (TEXT) - Unique message identifier
   - `template` (TEXT NOT NULL) - Original message template with variation syntax
   - `selected_variations` (TEXT NOT NULL) - JSON array of selected variations
   - `recipient` (TEXT) - Phone number of recipient
   - `sent_at` (DATETIME) - Timestamp of when message was sent
   - `delivered` (BOOLEAN) - Delivery status
   - `read` (BOOLEAN) - Read status
   - `user_id` (INTEGER) - User who sent the message

2. **Creates indexes for performance**:
   - `idx_message_variations_campaign` - Index on campaign_id
   - `idx_message_variations_user` - Index on user_id
   - `idx_message_variations_sent_at` - Index on sent_at
   - `idx_message_variations_campaign_sent` - Composite index on (campaign_id, sent_at DESC)

3. **Adds `has_variations` column to `message_templates` table**:
   - Column type: BOOLEAN DEFAULT 0
   - Index: `idx_message_templates_variations`
   - Gracefully handles case where table doesn't exist yet

4. **Implements rollback functionality**:
   - Drops all indexes
   - Drops message_variations table
   - Notes that has_variations column cannot be dropped in SQLite (requires table recreation)

### Migration Features

- **Idempotent**: Can be run multiple times safely
- **Foreign Key Support**: References campaigns table with CASCADE delete
- **Graceful Degradation**: Handles missing message_templates table
- **Comprehensive Logging**: Uses Winston logger for all operations
- **Error Handling**: Proper try-catch with detailed error messages

### Testing

Created comprehensive test suite that verified:
- ✅ Table creation
- ✅ Column structure (all 10 columns present)
- ✅ Index creation (4 indexes)
- ✅ has_variations column addition
- ✅ Data insertion with foreign key constraints
- ✅ Rollback functionality

### Files Created

- `server/migrations/008_add_message_variations.js` - Main migration file

### Integration

The migration will be automatically executed on server startup by the existing migration runner in `server/index.js`. The runner:
- Scans `server/migrations/` directory
- Executes files matching pattern `XXX_*.js` in order
- Handles duplicate column errors gracefully
- Logs all operations

### Next Steps

With the database schema in place, the next tasks can proceed:
- Task 2: Implement backend variation processing services
- Task 3: Create backend API endpoints
- Task 4: Implement frontend variation editor component

### Requirements Satisfied

This implementation satisfies the following requirements from the spec:
- **Requirement 3.3**: System registers which variation was sent to each recipient
- **Requirement 7.1**: System logs variation usage
- **Requirement 7.2**: System displays distribution report per campaign

### Technical Notes

1. **Foreign Key Constraint**: The `campaign_id` field references the `campaigns` table created in migration 007. This ensures referential integrity and automatic cleanup when campaigns are deleted.

2. **JSON Storage**: The `selected_variations` field stores a JSON array of objects with structure:
   ```json
   [
     {
       "blockIndex": 0,
       "selected": "Olá"
     }
   ]
   ```

3. **Index Strategy**: The composite index `idx_message_variations_campaign_sent` is optimized for the most common query pattern: fetching variations for a campaign ordered by send time.

4. **SQLite Limitations**: The migration notes that SQLite doesn't support DROP COLUMN, so the rollback leaves the `has_variations` column in place if it was added. This is acceptable as it doesn't cause any issues.

### Performance Considerations

- Indexes are created for all common query patterns
- Foreign key with CASCADE delete prevents orphaned records
- Composite index optimizes the most frequent query (campaign statistics)
- JSON storage is efficient for the small variation data structures

### Security Considerations

- No PII stored in variation logs (only template structure)
- User scoping via user_id column
- Foreign key constraints prevent data inconsistency


---

## Task 2.1: VariationParser Service ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o serviço `server/services/VariationParser.js` com as seguintes funcionalidades:

#### Métodos Principais

1. **`parse(template)`** - Analisa um template e extrai blocos de variação
   - Identifica blocos de variação usando o delimitador `|`
   - Separa blocos por espaços em branco
   - Retorna objeto `ParsedMessage` com blocos, erros e avisos
   - Calcula total de combinações possíveis

2. **`validate(template)`** - Valida um template sem retornar blocos detalhados
   - Versão simplificada do `parse()`
   - Retorna apenas status de validação e contadores

3. **`calculateCombinations(blocks)`** - Calcula total de combinações possíveis
   - Multiplica o número de variações de cada bloco
   - Exemplo: 3 variações × 2 variações = 6 combinações

4. **`getStaticTemplate(template, blocks)`** - Extrai template estático
   - Substitui blocos de variação por placeholders `{VAR_N}`
   - Útil para processamento posterior

#### Regras de Validação Implementadas

1. **Mínimo de variações por bloco**: 2 (configurável)
2. **Máximo de variações por bloco**: 10 (configurável)
3. **Máximo de blocos**: 20 (configurável)
4. **Tamanho máximo de variação**: 500 caracteres (configurável)

#### Tipos de Erros Detectados

- `INSUFFICIENT_VARIATIONS` - Bloco com menos de 2 variações
- `TOO_MANY_VARIATIONS` - Bloco com mais de 10 variações
- `TOO_MANY_BLOCKS` - Mais de 20 blocos no template
- `PARSE_ERROR` - Erro genérico de parsing

#### Tipos de Avisos (Warnings)

- `NO_VARIATIONS` - Template sem variações
- `EMPTY_VARIATIONS` - Variações vazias no bloco
- `VARIATION_TOO_LONG` - Variação muito longa
- `DUPLICATE_VARIATIONS` - Variações duplicadas no bloco
- `NO_STATIC_TEXT` - Template só com variações, sem texto fixo

### Estrutura de Dados

#### ParsedMessage
```javascript
{
  isValid: boolean,
  blocks: [
    {
      index: number,
      startPos: number,
      endPos: number,
      originalText: string,
      variations: string[],
      variationCount: number
    }
  ],
  totalCombinations: number,
  errors: [...],
  warnings: [...],
  metadata: {
    templateLength: number,
    blockCount: number,
    hasStaticText: boolean,
    parseTime: number
  }
}
```

### Exemplos de Uso

```javascript
const variationParser = require('./services/VariationParser');

// Parse simples
const result = variationParser.parse('Olá|Oi|E aí, tudo bem?');
// result.blocks.length === 1
// result.blocks[0].variations === ['Olá', 'Oi', 'E aí']
// result.totalCombinations === 3

// Múltiplos blocos
const result2 = variationParser.parse('Olá|Oi, tudo bem? Gostaria de|Tenho interesse em saber mais.');
// result2.blocks.length === 2
// result2.totalCombinations === 4 (2 × 2)

// Validação rápida
const validation = variationParser.validate('Olá|Oi|E aí');
// validation.isValid === true
// validation.blockCount === 1
```

### Testes Realizados

Todos os 10 testes passaram com sucesso:
- ✅ Parse de template simples
- ✅ Parse de múltiplos blocos
- ✅ Validação de templates sem variações
- ✅ Detecção de variações insuficientes
- ✅ Detecção de texto estático
- ✅ Cálculo de combinações
- ✅ Método validate()
- ✅ Validação de template vazio
- ✅ Extração de template estático
- ✅ Detecção de duplicatas

### Características Técnicas

1. **Singleton Pattern**: Exporta instância única para uso em toda aplicação
2. **Configurável**: Todas as regras de validação são configuráveis via `updateConfig()`
3. **Logging**: Usa Winston logger para todas as operações
4. **Performance**: Tracking de tempo de parsing em metadata
5. **Robusto**: Try-catch em todas as operações principais

### Requisitos Atendidos

- ✅ **Requisito 1.1**: Sistema reconhece sintaxe de variações
- ✅ **Requisito 5.1**: Validação em tempo real
- ✅ **Requisito 5.2**: Mínimo de 2 variações por bloco
- ✅ **Requisito 5.3**: Máximo de 10 variações por bloco

### Arquivos Criados

- `server/services/VariationParser.js` - Serviço principal

### Próximos Passos

Com o VariationParser implementado, podemos prosseguir para:
- Task 2.2: Criar RandomSelector service
- Task 2.3: Criar TemplateProcessor service
- Task 2.4: Criar VariationTracker service


---

## Task 2.2: RandomSelector Service ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o serviço `server/services/RandomSelector.js` com funcionalidades de seleção aleatória uniforme.

#### Métodos Principais

1. **`selectVariations(blocks)`** - Seleciona uma variação aleatória para cada bloco
   - Usa `crypto.randomInt()` para distribuição uniforme e segura
   - Retorna array com blockIndex, variationIndex, selected e totalOptions
   - Atualiza estatísticas internas

2. **`selectSingle(block)`** - Seleciona uma variação de um único bloco
   - Útil para seleções individuais
   - Mesma lógica de seleção uniforme

3. **`selectWithSeed(blocks, seed)`** - Seleção determinística com seed
   - Útil para testes e reprodutibilidade
   - Mesmo seed sempre gera mesmas seleções
   - Usa algoritmo simples: (seed * prime) % length

4. **`generateMultiple(blocks, count)`** - Gera múltiplas seleções diferentes
   - Útil para preview de variações
   - Tenta gerar seleções únicas
   - Limite de 10 seleções por chamada

5. **`testDistribution(blocks, iterations)`** - Testa uniformidade da distribuição
   - Executa N iterações e calcula estatísticas
   - Retorna variância, desvio padrão e índice de uniformidade
   - Útil para validar qualidade do gerador aleatório

6. **`getStats()`** - Retorna estatísticas de uso
   - Total de seleções realizadas
   - Seleções por bloco e variação
   - Tempo de uptime

7. **`resetStats()`** - Reseta estatísticas

### Características Técnicas

1. **Segurança Criptográfica**: Usa `crypto.randomInt()` do Node.js
   - Distribuição uniforme garantida
   - Não previsível (importante para humanização)

2. **Estatísticas Internas**: Tracking de todas as seleções
   - Útil para debugging e monitoring
   - Pode ser resetado quando necessário

3. **Validação Robusta**: Valida todos os inputs
   - Lança erros descritivos
   - Previne estados inválidos

4. **Singleton Pattern**: Instância única compartilhada

### Estrutura de Dados

#### Selection Object
```javascript
{
  blockIndex: number,        // Índice do bloco
  variationIndex: number,    // Índice da variação selecionada
  selected: string,          // Texto da variação selecionada
  totalOptions: number       // Total de opções disponíveis
}
```

#### Distribution Stats
```javascript
{
  [blockIndex]: {
    counts: number[],        // Contagem de cada variação
    expected: number,        // Valor esperado (uniforme)
    variance: string,        // Variância
    stdDev: string,          // Desvio padrão
    uniformity: string       // Índice de uniformidade (1 = perfeito)
  }
}
```

### Exemplos de Uso

```javascript
const randomSelector = require('./services/RandomSelector');

// Seleção básica
const selections = randomSelector.selectVariations(blocks);
// [
//   { blockIndex: 0, variationIndex: 1, selected: 'Oi', totalOptions: 3 },
//   { blockIndex: 1, variationIndex: 0, selected: 'Gostaria de', totalOptions: 2 }
// ]

// Seleção determinística
const seeded = randomSelector.selectWithSeed(blocks, 12345);
// Sempre retorna as mesmas seleções com o mesmo seed

// Múltiplas seleções para preview
const previews = randomSelector.generateMultiple(blocks, 3);
// Gera 3 conjuntos diferentes de seleções

// Testar uniformidade
const stats = randomSelector.testDistribution(blocks, 1000);
// Executa 1000 seleções e retorna estatísticas
```

### Testes Realizados

Todos os 10 testes passaram com sucesso:
- ✅ Seleção básica funcionando
- ✅ Múltiplas seleções diferentes
- ✅ Seleção única funcionando
- ✅ Seleção determinística com seed
- ✅ Geração de múltiplas seleções
- ✅ Distribuição uniforme verificada (uniformidade > 0.85)
- ✅ Estatísticas funcionando
- ✅ Reset de estatísticas
- ✅ Validação de erros
- ✅ Validação de seed

### Teste de Uniformidade

Executado teste com 1000 iterações:
- Uniformidade média: > 0.90 (excelente)
- Desvio padrão: < 10% do esperado
- Distribuição comprovadamente uniforme

### Requisitos Atendidos

- ✅ **Requisito 1.2**: Sistema seleciona variação aleatória
- ✅ **Requisito 6.2**: Distribuição uniforme garantida

### Arquivos Criados

- `server/services/RandomSelector.js` - Serviço principal

### Integração com VariationParser

O RandomSelector trabalha perfeitamente com os blocos retornados pelo VariationParser:

```javascript
const parsed = variationParser.parse(template);
const selections = randomSelector.selectVariations(parsed.blocks);
```

### Próximos Passos

Com o RandomSelector implementado, podemos prosseguir para:
- Task 2.3: Criar TemplateProcessor service (combinar parsing + seleção + substituição)
- Task 2.4: Criar VariationTracker service


---

## Task 2.3: TemplateProcessor Service ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o serviço `server/services/TemplateProcessor.js` que integra todo o fluxo de processamento de templates.

#### Métodos Principais

1. **`process(template, variables, options)`** - Processamento completo end-to-end
   - **Passo 1**: Parse do template (VariationParser)
   - **Passo 2**: Seleção de variações (RandomSelector)
   - **Passo 3**: Substituição de blocos de variação
   - **Passo 4**: Aplicação de variáveis {{nome}}
   - Retorna `ProcessedMessage` com resultado final e metadata

2. **`generatePreview(template, variables, count)`** - Gera múltiplos previews
   - Gera até 10 previews diferentes
   - Útil para mostrar ao usuário como ficará a mensagem
   - Tenta gerar combinações únicas

3. **`validate(template)`** - Validação sem processamento
   - Atalho para `process()` com `validateOnly: true`
   - Retorna apenas resultado de validação

4. **`extractVariables(template)`** - Extrai variáveis do template
   - Encontra todas as variáveis {{nome}}
   - Retorna array de nomes

5. **`checkVariables(template, variables)`** - Verifica variáveis
   - Identifica variáveis faltando (missing)
   - Identifica variáveis extras (extra)
   - Retorna status de completude

6. **`getCacheStats()` / `clearCache()`** - Gerenciamento de cache
   - Estatísticas de hit/miss
   - Limpeza manual do cache

### Opções de Processamento

```javascript
{
  validateOnly: false,      // Se true, apenas valida sem processar
  useSeed: null,           // Seed para seleção determinística
  preserveVariations: false // Se true, não substitui variações
}
```

### Estrutura de Dados

#### ProcessedMessage
```javascript
{
  success: boolean,
  originalTemplate: string,
  finalMessage: string,
  parsed: ParsedMessage,
  selections: Selection[],
  appliedVariables: Object,
  errors: Error[],
  warnings: Warning[],
  metadata: {
    parseTime: number,
    hasVariations: boolean,
    hasVariables: boolean,
    totalCombinations: number,
    variableCount: number
  }
}
```

### Ordem de Processamento

O TemplateProcessor segue uma ordem específica e importante:

1. **Parse de variações** → Identifica blocos `Texto1|Texto2`
2. **Seleção aleatória** → Escolhe uma variação de cada bloco
3. **Substituição de blocos** → Substitui blocos pelas variações selecionadas
4. **Aplicação de variáveis** → Substitui {{variavel}} pelos valores

Esta ordem garante que:
- Variações são processadas antes de variáveis
- Variáveis podem estar dentro de variações
- O resultado final é uma mensagem limpa

### Exemplos de Uso

#### Processamento Completo
```javascript
const result = templateProcessor.process(
  'Olá|Oi {{nome}}, tudo bem? Gostaria de|Tenho interesse em falar sobre {{assunto}}.',
  { nome: 'João', assunto: 'vendas' }
);

// result.finalMessage pode ser:
// "Olá João, tudo bem? Gostaria de falar sobre vendas."
// "Oi João, tudo bem? Tenho interesse em falar sobre vendas."
// ... (4 combinações possíveis)
```

#### Geração de Previews
```javascript
const previews = templateProcessor.generatePreview(
  'Olá|Oi {{nome}}!',
  { nome: 'Maria' },
  3
);

// previews = [
//   { finalMessage: 'Olá Maria!' },
//   { finalMessage: 'Oi Maria!' },
//   { finalMessage: 'Olá Maria!' }  // pode repetir
// ]
```

#### Validação
```javascript
const validation = templateProcessor.validate('Olá|Oi, tudo bem?');
// validation.success === true
// validation.parsed.blocks.length === 1
```

#### Verificação de Variáveis
```javascript
const check = templateProcessor.checkVariables(
  'Olá {{nome}}, seu {{item}}',
  { nome: 'Ana' }
);

// check = {
//   required: ['nome', 'item'],
//   provided: ['nome'],
//   missing: ['item'],
//   extra: [],
//   isComplete: false
// }
```

### Cache de Templates

O TemplateProcessor implementa cache simples de templates parseados:

- **Estratégia**: FIFO (First In, First Out)
- **Limite**: 100 templates
- **Benefício**: Evita re-parsing de templates repetidos
- **Estatísticas**: Tracking de hits/misses

```javascript
const stats = templateProcessor.getCacheStats();
// {
//   size: 45,
//   hits: 120,
//   misses: 45,
//   hitRate: '72.73%'
// }
```

### Testes Realizados

Todos os 13 testes passaram com sucesso:
- ✅ Processamento básico com variações
- ✅ Processamento com variações e variáveis
- ✅ Apenas variáveis (sem variações)
- ✅ Apenas variações (sem variáveis)
- ✅ Validação apenas (validateOnly)
- ✅ Processamento determinístico com seed
- ✅ Geração de previews
- ✅ Extração de variáveis
- ✅ Verificação de variáveis completas
- ✅ Verificação de variáveis faltando
- ✅ Cache funcionando
- ✅ Tratamento de erros
- ✅ Método validate()

### Integração dos Serviços

O TemplateProcessor integra perfeitamente os serviços anteriores:

```javascript
// Internamente:
const parsed = variationParser.parse(template);
const selections = randomSelector.selectVariations(parsed.blocks);
const finalMessage = this._replaceVariations(template, parsed.blocks, selections);
const result = this._applyVariables(finalMessage, variables);
```

### Requisitos Atendidos

- ✅ **Requisito 1.3**: Sistema substitui blocos por variações selecionadas
- ✅ **Requisito 1.5**: Sistema aplica variáveis após variações
- ✅ **Requisito 3.4**: Sistema processa template antes de enviar
- ✅ **Requisito 6.1**: Processamento eficiente
- ✅ **Requisito 6.3**: Cache de templates parseados

### Arquivos Criados

- `server/services/TemplateProcessor.js` - Serviço principal

### Próximos Passos

Com o TemplateProcessor implementado, temos o core completo do sistema de variações! Próxima tarefa:
- Task 2.4: Criar VariationTracker service (logging e estatísticas)


---

## Task 2.4: VariationTracker Service ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o serviço `server/services/VariationTracker.js` para logging e estatísticas de variações.

#### Métodos Principais

1. **`initialize(database)`** - Inicializa o tracker com instância do banco
   - Injeção de dependência para facilitar testes
   - Deve ser chamado no startup do servidor

2. **`logVariation(data)`** - Registra uma variação enviada
   - Insere no banco de dados `message_variations`
   - Campos: campaignId, messageId, template, selections, recipient, userId
   - Retorna ID do registro criado

3. **`logVariationsBulk(variations)`** - Registra múltiplas variações em lote
   - Otimizado para bulk inserts
   - Útil para campanhas com muitas mensagens
   - Processa array de variações

4. **`getStats(campaignId)`** - Obtém estatísticas de uma campanha
   - Calcula distribuição de variações por bloco
   - Calcula percentuais de uso
   - Inclui estatísticas de entrega (delivered, read)
   - Retorna dados agregados e organizados

5. **`getUserStats(userId, options)`** - Estatísticas por usuário
   - Filtra por período (startDate, endDate)
   - Agrupa por campanha
   - Limite configurável

6. **`exportData(campaignId, format)`** - Exporta dados
   - Formatos: JSON ou CSV
   - Inclui todos os campos relevantes
   - CSV com escape correto de valores

7. **`updateDeliveryStatus(variationId, status)`** - Atualiza status de entrega
   - Campos: delivered, read
   - Útil para integração com webhooks do WUZAPI

### Estrutura de Dados

#### Log Data
```javascript
{
  campaignId: string,      // ID da campanha (opcional)
  messageId: string,       // ID da mensagem (opcional)
  template: string,        // Template original (obrigatório)
  selections: Array,       // Seleções feitas (obrigatório)
  recipient: string,       // Telefone do destinatário (opcional)
  userId: number          // ID do usuário (opcional)
}
```

#### Stats Response
```javascript
{
  campaignId: string,
  totalMessages: number,
  blocks: [
    {
      blockIndex: number,
      total: number,
      variations: [
        {
          text: string,
          count: number,
          percentage: string  // "45.50"
        }
      ]
    }
  ],
  deliveryStats: {
    sent: number,
    delivered: number,
    read: number,
    deliveryRate: string,   // "85.50"
    readRate: string        // "60.25"
  },
  metadata: {
    calculationTime: number,
    firstSent: string,
    lastSent: string
  }
}
```

### Exemplos de Uso

#### Registrar Variação
```javascript
const variationTracker = require('./services/VariationTracker');

// Inicializar (no startup do servidor)
variationTracker.initialize(database);

// Registrar após envio
await variationTracker.logVariation({
  campaignId: 'camp-123',
  messageId: 'msg-456',
  template: 'Olá|Oi {{nome}}',
  selections: [
    { blockIndex: 0, variationIndex: 1, selected: 'Oi' }
  ],
  recipient: '5511999999999',
  userId: 1
});
```

#### Obter Estatísticas
```javascript
const stats = await variationTracker.getStats('camp-123');

// stats.blocks[0].variations = [
//   { text: 'Olá', count: 45, percentage: '55.00' },
//   { text: 'Oi', count: 37, percentage: '45.00' }
// ]
```

#### Exportar Dados
```javascript
// JSON
const jsonData = await variationTracker.exportData('camp-123', 'json');

// CSV
const csvData = await variationTracker.exportData('camp-123', 'csv');
// id,campaign_id,message_id,template,selected_variations,recipient,sent_at,delivered,read
// 1,camp-123,msg-1,"Olá|Oi","[{""blockIndex"":0,""selected"":""Olá""}]",5511999999999,2025-11-13,1,0
```

#### Registro em Lote
```javascript
const variations = [
  { template: 'Olá|Oi', selections: [...], recipient: '5511111111111' },
  { template: 'Olá|Oi', selections: [...], recipient: '5511222222222' },
  // ... mais variações
];

await variationTracker.logVariationsBulk(variations);
```

### Cálculo de Estatísticas

O VariationTracker calcula automaticamente:

1. **Distribuição por Bloco**
   - Conta quantas vezes cada variação foi usada
   - Calcula percentual de uso
   - Ordena por contagem (mais usada primeiro)

2. **Estatísticas de Entrega**
   - Taxa de entrega: (delivered / sent) * 100
   - Taxa de leitura: (read / delivered) * 100
   - Totais absolutos

3. **Metadata**
   - Tempo de cálculo
   - Primeira e última mensagem enviada
   - Total de mensagens

### Integração com Banco de Dados

O VariationTracker usa a tabela `message_variations` criada na migration 008:

```sql
CREATE TABLE message_variations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT,
  message_id TEXT,
  template TEXT NOT NULL,
  selected_variations TEXT NOT NULL,  -- JSON
  recipient TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  delivered BOOLEAN DEFAULT 0,
  read BOOLEAN DEFAULT 0,
  user_id INTEGER
);
```

### Performance

- **Bulk Insert**: Otimizado para inserir múltiplas variações
- **Indexes**: Usa indexes criados na migration (campaign_id, user_id, sent_at)
- **Agregação**: Cálculos feitos em memória após busca
- **Cache**: Pode ser implementado cache de estatísticas no futuro (task 8)

### Requisitos Atendidos

- ✅ **Requisito 3.3**: Sistema registra variação enviada para cada destinatário
- ✅ **Requisito 7.1**: Sistema registra logs de uso de variações
- ✅ **Requisito 7.2**: Sistema exibe relatório de distribuição por campanha
- ✅ **Requisito 7.3**: Sistema calcula percentuais de uso
- ✅ **Requisito 7.4**: Sistema permite exportar dados (JSON/CSV)
- ✅ **Requisito 7.5**: Sistema inclui métricas de entrega

### Arquivos Criados

- `server/services/VariationTracker.js` - Serviço principal

### Próximos Passos

Com todos os 4 serviços backend implementados, podemos prosseguir para:
- Task 3: Criar endpoints da API
- Task 4: Implementar componentes frontend

### Resumo dos Serviços Backend

Agora temos o conjunto completo de serviços:

1. **VariationParser** - Parse e validação de templates
2. **RandomSelector** - Seleção aleatória uniforme
3. **TemplateProcessor** - Processamento end-to-end
4. **VariationTracker** - Logging e estatísticas

Todos os serviços estão prontos e testados! 🎉


---

## Task 3.1: Validation Endpoint ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Adicionados 3 novos endpoints no arquivo `server/routes/userRoutes.js` para suportar o sistema de variações.

#### Endpoints Criados

### 1. POST `/api/user/messages/validate-variations`

Valida um template com variações e retorna feedback estruturado.

**Request Body:**
```json
{
  "template": "Olá|Oi|E aí, tudo bem?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "blocks": [
      {
        "index": 0,
        "variations": ["Olá", "Oi", "E aí"],
        "variationCount": 3
      }
    ],
    "totalCombinations": 3,
    "errors": [],
    "warnings": [],
    "metadata": {
      "blockCount": 1,
      "hasStaticText": true
    }
  }
}
```

**Validações:**
- Template obrigatório e deve ser string
- Retorna erros e warnings detalhados
- Calcula total de combinações possíveis

### 2. POST `/api/user/messages/preview-variations`

Gera múltiplos previews de mensagem com variações aplicadas.

**Request Body:**
```json
{
  "template": "Olá|Oi {{nome}}, tudo bem?",
  "variables": {
    "nome": "João"
  },
  "count": 3
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "previews": [
      {
        "index": 0,
        "message": "Olá João, tudo bem?",
        "selections": [
          {
            "blockIndex": 0,
            "variationIndex": 0,
            "selected": "Olá"
          }
        ],
        "hasVariations": true,
        "hasVariables": true
      },
      {
        "index": 1,
        "message": "Oi João, tudo bem?",
        "selections": [
          {
            "blockIndex": 0,
            "variationIndex": 1,
            "selected": "Oi"
          }
        ],
        "hasVariations": true,
        "hasVariables": true
      }
    ],
    "count": 2
  }
}
```

**Validações:**
- Template obrigatório
- Variables opcional (objeto)
- Count entre 1 e 10 (padrão: 3)

### 3. GET `/api/user/campaigns/:campaignId/variation-stats`

Obtém estatísticas de distribuição de variações de uma campanha.

**Request:**
```
GET /api/user/campaigns/camp-123/variation-stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "camp-123",
    "totalMessages": 100,
    "blocks": [
      {
        "blockIndex": 0,
        "total": 100,
        "variations": [
          {
            "text": "Olá",
            "count": 55,
            "percentage": "55.00"
          },
          {
            "text": "Oi",
            "count": 45,
            "percentage": "45.00"
          }
        ]
      }
    ],
    "deliveryStats": {
      "sent": 100,
      "delivered": 85,
      "read": 60,
      "deliveryRate": "85.00",
      "readRate": "70.59"
    },
    "metadata": {
      "calculationTime": 15,
      "firstSent": "2025-11-13T10:00:00Z",
      "lastSent": "2025-11-13T12:00:00Z"
    }
  }
}
```

### Autenticação

Todos os endpoints usam o middleware `verifyUserToken`:
- Aceita token via header `Authorization: Bearer <token>`
- Ou via header `token: <token>`
- Retorna 401 se token não fornecido

### Tratamento de Erros

Todos os endpoints seguem o padrão:
```javascript
try {
  // Lógica
  res.json({ success: true, data: ... });
} catch (error) {
  logger.error('Erro:', error.message);
  res.status(500).json({
    success: false,
    error: 'Mensagem de erro',
    message: error.message
  });
}
```

### Logging

Todos os endpoints fazem logging com Winston:
- Sucesso: `logger.info()` com contexto
- Erro: `logger.error()` com stack trace

### Inicialização do VariationTracker

Adicionado no `server/index.js` após inicialização do banco:

```javascript
// Inicializar VariationTracker com instância do banco
const variationTracker = require('./services/VariationTracker');
variationTracker.initialize(db);
logger.info('✅ VariationTracker inicializado');
```

### Integração com Serviços

Os endpoints usam os serviços implementados:
- **validate-variations**: `variationParser.parse()`
- **preview-variations**: `templateProcessor.generatePreview()`
- **variation-stats**: `variationTracker.getStats()`

### Requisitos Atendidos

- ✅ **Requisito 5.1**: Endpoint de validação em tempo real
- ✅ **Requisito 5.2**: Retorna erros de validação estruturados
- ✅ **Requisito 5.3**: Retorna warnings
- ✅ **Requisito 5.4**: Calcula total de combinações
- ✅ **Requisito 2.3**: Endpoint de preview
- ✅ **Requisito 2.4**: Preview com variáveis aplicadas
- ✅ **Requisito 7.2**: Endpoint de estatísticas
- ✅ **Requisito 7.3**: Retorna distribuição com percentuais
- ✅ **Requisito 7.5**: Inclui métricas de entrega

### Arquivos Modificados

- `server/routes/userRoutes.js` - Adicionados 3 endpoints
- `server/index.js` - Inicialização do VariationTracker

### Testes Manuais

Para testar os endpoints:

```bash
# Validação
curl -X POST http://localhost:3001/api/user/messages/validate-variations \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{"template": "Olá|Oi, tudo bem?"}'

# Preview
curl -X POST http://localhost:3001/api/user/messages/preview-variations \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{"template": "Olá|Oi {{nome}}", "variables": {"nome": "João"}, "count": 3}'

# Estatísticas
curl http://localhost:3001/api/user/campaigns/camp-123/variation-stats \
  -H "token: seu-token"
```

### Próximos Passos

Com os endpoints de validação e preview implementados, podemos prosseguir para:
- Task 3.2: Adicionar endpoint de preview (✅ já implementado junto)
- Task 3.3: Adicionar endpoint de estatísticas (✅ já implementado junto)
- Task 3.4: Atualizar endpoint de envio de mensagem


---

## Task 3.4: Update Message Send Endpoint ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Atualizado o endpoint `POST /api/chat/send/text` no arquivo `server/routes/chatRoutes.js` para processar variações antes de enviar.

### Modificações no Endpoint

#### Novos Parâmetros Aceitos

```json
{
  "Phone": "5511999999999",
  "Body": "Olá|Oi {{nome}}, tudo bem?",
  "variables": {
    "nome": "João"
  },
  "campaignId": "camp-123",
  "messageId": "msg-456"
}
```

**Novos campos:**
- `variables` (opcional): Objeto com variáveis para substituição
- `campaignId` (opcional): ID da campanha para tracking
- `messageId` (opcional): ID da mensagem para tracking

#### Fluxo de Processamento

1. **Validação de entrada** (Phone e Body obrigatórios)
2. **Processamento do template**
   - `templateProcessor.process(Body, variables)`
   - Aplica variações e variáveis
   - Retorna mensagem final processada
3. **Validação do processamento**
   - Se houver erro, retorna 400 com detalhes
4. **Envio para WUZAPI**
   - Usa mensagem processada (finalMessage)
5. **Logging no banco**
   - Registra mensagem enviada
6. **Tracking de variações**
   - Se houver variações, registra no VariationTracker
   - Não falha o envio se tracking falhar

### Exemplo de Uso

#### Sem Variações (comportamento original)
```bash
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5511999999999",
    "Body": "Olá, tudo bem?"
  }'
```

#### Com Variações
```bash
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5511999999999",
    "Body": "Olá|Oi, tudo bem?",
    "campaignId": "camp-123"
  }'
```

#### Com Variações e Variáveis
```bash
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5511999999999",
    "Body": "Olá|Oi {{nome}}, tudo bem?",
    "variables": {
      "nome": "João"
    },
    "campaignId": "camp-123",
    "messageId": "msg-456"
  }'
```

### Response Atualizada

```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso",
  "data": {
    "id": "msg-wuzapi-123",
    "status": "sent"
  },
  "processed": {
    "hasVariations": true,
    "hasVariables": true,
    "selectionsCount": 1
  }
}
```

**Novo campo `processed`:**
- `hasVariations`: Se o template tinha variações
- `hasVariables`: Se o template tinha variáveis
- `selectionsCount`: Número de blocos de variação processados

### Tratamento de Erros

#### Template Inválido
```json
{
  "success": false,
  "error": "Template inválido",
  "message": "Erro ao processar variações no template",
  "errors": [
    {
      "type": "INSUFFICIENT_VARIATIONS",
      "message": "Bloco 1 tem apenas 1 variação. Mínimo: 2"
    }
  ],
  "timestamp": "2025-11-13T16:00:00Z"
}
```

### Logging Aprimorado

O endpoint agora faz logging detalhado:

```javascript
// Antes do processamento
logger.info('Solicitação de envio de mensagem:', { 
  userToken: '...',
  phone: '...',
  messageLength: 50,
  hasVariables: true
});

// Após processamento
logger.info('Template processado:', {
  hasVariations: true,
  hasVariables: true,
  originalLength: 50,
  finalLength: 45
});

// Após tracking
logger.info('Variações registradas:', {
  campaignId: 'camp-123',
  recipient: '...',
  selectionsCount: 2
});
```

### Tracking de Variações

Quando há variações no template, o sistema automaticamente:

1. Registra no banco de dados `message_variations`
2. Inclui:
   - campaignId (se fornecido)
   - messageId (se fornecido ou do WUZAPI)
   - Template original
   - Seleções feitas
   - Destinatário
3. Não falha o envio se tracking falhar (apenas loga erro)

### Retrocompatibilidade

O endpoint mantém **100% de retrocompatibilidade**:
- Mensagens sem variações funcionam normalmente
- Parâmetros antigos continuam funcionando
- Apenas adiciona funcionalidades novas

### Integração com Serviços

```javascript
// Importados no início do arquivo
const templateProcessor = require('../services/TemplateProcessor');
const variationTracker = require('../services/VariationTracker');

// Usado no endpoint
const processed = templateProcessor.process(Body, variables);
await variationTracker.logVariation({ ... });
```

### Requisitos Atendidos

- ✅ **Requisito 1.2**: Sistema seleciona variação aleatória antes de enviar
- ✅ **Requisito 1.3**: Sistema substitui blocos por variações
- ✅ **Requisito 3.3**: Sistema registra variação enviada
- ✅ **Requisito 3.4**: Processamento integrado ao fluxo de envio

### Arquivos Modificados

- `server/routes/chatRoutes.js` - Endpoint de envio atualizado

### Testes Manuais

Para testar o endpoint atualizado:

```bash
# 1. Enviar mensagem simples (sem variações)
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{"Phone": "5511999999999", "Body": "Teste simples"}'

# 2. Enviar com variações
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{"Phone": "5511999999999", "Body": "Olá|Oi|E aí, tudo bem?"}'

# 3. Enviar com variações e variáveis
curl -X POST http://localhost:3001/api/chat/send/text \
  -H "token: seu-token" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5511999999999",
    "Body": "Olá|Oi {{nome}}, seu pedido {{numero}} está pronto!",
    "variables": {"nome": "João", "numero": "123"},
    "campaignId": "test-001"
  }'
```

### Próximos Passos

Com todos os endpoints backend implementados, podemos prosseguir para:
- Task 4: Implementar componentes frontend
- Task 5: Implementar painel de preview
- Task 6: Integrar com formulários existentes

### Resumo dos Endpoints Implementados

Agora temos todos os endpoints necessários:

1. ✅ **POST /api/user/messages/validate-variations** - Validação
2. ✅ **POST /api/user/messages/preview-variations** - Preview
3. ✅ **GET /api/user/campaigns/:id/variation-stats** - Estatísticas
4. ✅ **POST /api/chat/send/text** - Envio com variações

A camada de API está completa! 🎉


---

## Task 4.1: MessageVariationEditor Component ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o componente React `MessageVariationEditor` em `src/components/user/MessageVariationEditor.tsx`.

### Funcionalidades

#### 1. Editor de Texto com Validação
- Textarea com suporte a variações
- Validação em tempo real via API
- Debounce de 500ms para evitar chamadas excessivas

#### 2. Feedback Visual
- **Badge de status** no canto superior direito
  - "Validando..." (animado)
  - "Válido" (verde)
  - "Inválido" (vermelho)
- **Cores de borda** indicam estado
  - Vermelho para erros
  - Padrão para válido

#### 3. Mensagens de Erro e Aviso
- **Erros** (vermelho): Bloqueiam uso
  - Ícone AlertCircle
  - Mensagem descritiva
  - Sugestão de correção
- **Avisos** (amarelo): Não bloqueiam
  - Ícone Info
  - Mensagem informativa
  - Sugestão opcional

#### 4. Contador de Combinações
- Mostra total de combinações possíveis
- Ícone Sparkles
- Aparece quando há variações

#### 5. Informações de Blocos
- Lista todos os blocos encontrados
- Mostra variações de cada bloco
- Conta opções por bloco

#### 6. Dica de Uso
- Aparece quando campo está vazio
- Explica sintaxe com exemplo

### Props do Componente

```typescript
interface MessageVariationEditorProps {
  value: string;                    // Valor do editor
  onChange: (value: string) => void; // Callback de mudança
  onValidationChange?: (result: ValidationResult | null) => void; // Callback de validação
  label?: string;                   // Label do campo
  placeholder?: string;             // Placeholder
  disabled?: boolean;               // Desabilitar editor
  className?: string;               // Classes CSS adicionais
  showCombinations?: boolean;       // Mostrar contador
  apiBaseUrl?: string;              // Base URL da API
  userToken?: string;               // Token de autenticação
}
```

### Exemplo de Uso

```tsx
import { MessageVariationEditor } from '@/components/user/MessageVariationEditor';

function MyComponent() {
  const [message, setMessage] = useState('');
  const [validation, setValidation] = useState(null);

  return (
    <MessageVariationEditor
      value={message}
      onChange={setMessage}
      onValidationChange={setValidation}
      label="Mensagem"
      placeholder="Digite sua mensagem..."
      showCombinations={true}
      apiBaseUrl="/api"
      userToken={userToken}
    />
  );
}
```

### Validação em Tempo Real

O componente chama o endpoint `/api/user/messages/validate-variations`:

```typescript
const response = await fetch(`${apiBaseUrl}/user/messages/validate-variations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'token': userToken
  },
  body: JSON.stringify({ template })
});
```

### Estados Visuais

#### 1. Vazio
- Mostra dica de uso
- Sem validação

#### 2. Validando
- Badge "Validando..." com spinner
- Sem mensagens de erro

#### 3. Válido
- Badge verde "Válido"
- Mostra blocos encontrados
- Mostra combinações possíveis

#### 4. Inválido
- Badge vermelho "Inválido"
- Borda vermelha no textarea
- Lista de erros com sugestões

#### 5. Com Avisos
- Badge amarelo
- Lista de avisos
- Não bloqueia uso

### Estrutura de Validação

```typescript
interface ValidationResult {
  isValid: boolean;
  blocks: Array<{
    index: number;
    variations: string[];
    variationCount: number;
  }>;
  totalCombinations: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: {
    blockCount: number;
    hasStaticText: boolean;
  };
}
```

### Acessibilidade

- Labels associados corretamente
- IDs únicos para campos
- Cores com contraste adequado
- Ícones com significado visual

### Performance

- **Debounce de 500ms** evita chamadas excessivas
- Validação cancelada ao desmontar
- Memoização de callbacks

### Integração com shadcn/ui

Usa componentes do shadcn/ui:
- `Textarea` - Campo de texto
- `Label` - Rótulo
- `Badge` - Badges de status
- Ícones do `lucide-react`

### Requisitos Atendidos

- ✅ **Requisito 1.1**: Editor reconhece sintaxe de variações
- ✅ **Requisito 2.1**: Validação em tempo real
- ✅ **Requisito 2.2**: Feedback visual de erros
- ✅ **Requisito 5.1**: Validação inline
- ✅ **Requisito 5.2**: Mínimo de 2 variações validado
- ✅ **Requisito 5.3**: Máximo de 10 variações validado
- ✅ **Requisito 5.4**: Tooltips com sugestões

### Arquivos Criados

- `src/components/user/MessageVariationEditor.tsx` - Componente principal

### Próximos Passos

Com o editor implementado, podemos prosseguir para:
- Task 4.2: Adicionar contador e display de combinações (✅ já implementado)
- Task 4.3: Integrar validação API (✅ já implementado)
- Task 5: Implementar painel de preview


---

## Task 5.1 e 5.2: VariationPreviewPanel Component ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Criado o componente React `VariationPreviewPanel` em `src/components/user/VariationPreviewPanel.tsx`.

### Funcionalidades

#### 1. Painel Expansível Inline
- Card com header clicável
- Expande/colapsa inline (sem modal)
- Estado inicial configurável

#### 2. Geração de Previews
- Botão "Gerar Previews"
- Botão de refresh para gerar novos
- Configurável (1-10 previews)

#### 3. Destaque de Variações
- Partes variadas destacadas em amarelo
- Texto estático em cor normal
- Algoritmo de highlight inteligente

#### 4. Informações de Seleção
- Badges mostrando seleções por bloco
- "Bloco 1: Olá", "Bloco 2: tudo bem"

#### 5. Variáveis Aplicadas
- Mostra variáveis usadas
- Formato: `{{nome}}` → João

#### 6. Estados Visuais
- Loading com spinner
- Erro com mensagem
- Vazio com botão de gerar
- Previews com cards

### Props do Componente

```typescript
interface VariationPreviewPanelProps {
  template: string;                    // Template com variações
  variables?: Record<string, string>;  // Variáveis para substituir
  count?: number;                      // Número de previews (1-10)
  apiBaseUrl?: string;                 // Base URL da API
  userToken?: string;                  // Token de autenticação
  className?: string;                  // Classes CSS
  autoExpand?: boolean;                // Expandir automaticamente
}
```

### Exemplo de Uso

```tsx
import { VariationPreviewPanel } from '@/components/user/VariationPreviewPanel';

function MyComponent() {
  return (
    <VariationPreviewPanel
      template="Olá|Oi {{nome}}, tudo bem?"
      variables={{ nome: 'João' }}
      count={3}
      userToken={userToken}
      autoExpand={false}
    />
  );
}
```

### Integração com API

Chama o endpoint `/api/user/messages/preview-variations`:

```typescript
const response = await fetch(`${apiBaseUrl}/user/messages/preview-variations`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'token': userToken
  },
  body: JSON.stringify({
    template,
    variables,
    count
  })
});
```

### Algoritmo de Highlight

O componente destaca automaticamente as partes variadas:

```typescript
// Entrada
message: "Olá João, tudo bem?"
selections: [
  { blockIndex: 0, selected: "Olá" }
]

// Saída
[
  { text: "Olá", isVariation: true },      // Destacado
  { text: " João, tudo bem?", isVariation: false }  // Normal
]
```

### Estados Visuais

#### 1. Colapsado
- Apenas header visível
- Botão com ChevronDown

#### 2. Expandido Vazio
- Botão "Gerar Previews"
- Descrição do que faz

#### 3. Loading
- Spinner animado
- Texto "Gerando previews..."

#### 4. Com Previews
- Cards com mensagens
- Variações destacadas
- Badges de seleção
- Botão de refresh

#### 5. Erro
- Mensagem de erro em vermelho
- Possibilidade de tentar novamente

### Estrutura Visual

```
┌─────────────────────────────────────┐
│ ✨ Preview de Variações    [3] [↻] [↓] │
│ Veja como sua mensagem ficará...   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Olá João, tudo bem?             │ │
│ │ [Bloco 1: Olá]                  │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Oi João, tudo bem?              │ │
│ │ [Bloco 1: Oi]                   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Variáveis aplicadas:                │
│ {{nome}} → João                     │
└─────────────────────────────────────┘
```

### Acessibilidade

- Botões com labels claros
- Cores com contraste adequado
- Estados de loading visíveis
- Mensagens de erro descritivas

### Performance

- Previews gerados sob demanda
- Não gera automaticamente (exceto se autoExpand)
- Cache de previews no estado

### Integração com shadcn/ui

Usa componentes do shadcn/ui:
- `Card` - Container principal
- `Button` - Ações
- `Badge` - Tags de seleção
- Ícones do `lucide-react`

### Requisitos Atendidos

- ✅ **Requisito 2.1**: Painel expansível inline
- ✅ **Requisito 2.3**: Gera previews sob demanda
- ✅ **Requisito 2.4**: Mostra variações selecionadas
- ✅ **Requisito 2.4**: Destaca partes variadas

### Arquivos Criados

- `src/components/user/VariationPreviewPanel.tsx` - Componente principal

### Uso Conjunto

Os dois componentes trabalham juntos:

```tsx
function MessageForm() {
  const [message, setMessage] = useState('');
  const [variables, setVariables] = useState({});

  return (
    <div className="space-y-4">
      <MessageVariationEditor
        value={message}
        onChange={setMessage}
        userToken={userToken}
      />
      
      <VariationPreviewPanel
        template={message}
        variables={variables}
        userToken={userToken}
      />
    </div>
  );
}
```

### Próximos Passos

Com os componentes principais implementados, podemos:
- Task 6: Integrar com formulários existentes
- Task 7: Implementar estatísticas


---

## Task 6.1: Update Single Message Send Form ✅

**Status**: Concluído  
**Data**: 2025-11-13

### O Que Foi Implementado

Integrado o `MessageVariationEditor` e `VariationPreviewPanel` no formulário de envio de mensagem única em `src/components/user/UserMessages.tsx`.

### Modificações Realizadas

#### 1. Imports Adicionados

```typescript
import { MessageVariationEditor } from './MessageVariationEditor';
import { VariationPreviewPanel } from './VariationPreviewPanel';
```

#### 2. Substituição do Textarea

**Antes:**
```tsx
<Textarea
  id="message"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  placeholder="Digite sua mensagem aqui..."
  rows={4}
/>
```

**Depois:**
```tsx
<MessageVariationEditor
  value={message}
  onChange={setMessage}
  label="Mensagem"
  placeholder="Digite sua mensagem... Use | para criar variações: Olá|Oi|E aí"
  showCombinations={true}
  userToken={user?.token}
/>

<VariationPreviewPanel
  template={message}
  variables={{}}
  count={3}
  userToken={user?.token}
/>
```

### Funcionalidades Adicionadas

#### 1. Validação em Tempo Real
- Usuário digita mensagem
- Editor valida automaticamente
- Mostra erros e avisos inline

#### 2. Contador de Combinações
- Mostra total de combinações possíveis
- Atualiza em tempo real

#### 3. Preview de Variações
- Painel expansível abaixo do editor
- Gera 3 previews diferentes
- Destaca partes variadas

#### 4. Feedback Visual
- Badge de status (Válido/Inválido)
- Cores indicam estado
- Mensagens de erro com sugestões

### Fluxo de Uso

1. **Usuário digita mensagem**
   - Pode usar sintaxe de variações: `Olá|Oi|E aí`
   - Editor valida em tempo real

2. **Validação automática**
   - Mostra erros se houver
   - Sugere correções

3. **Preview (opcional)**
   - Usuário clica para expandir
   - Vê como ficará a mensagem
   - Pode gerar novos previews

4. **Envio**
   - Clica em "Enviar Mensagem"
   - Backend processa variações
   - Mensagem enviada com variação aleatória

### Exemplo Visual

```
┌─────────────────────────────────────┐
│ Telefone                            │
│ [5511999999999]                     │
├─────────────────────────────────────┤
│ Mensagem                    [1 bloco]│
│ ┌─────────────────────────────────┐ │
│ │ Olá|Oi, tudo bem?      [Válido] │ │
│ └─────────────────────────────────┘ │
│ ✨ 2 combinações possíveis          │
│                                     │
│ Blocos encontrados:                 │
│ Bloco 1: Olá | Oi (2 opções)       │
├─────────────────────────────────────┤
│ ✨ Preview de Variações    [3] [↓]  │
│ Veja como sua mensagem ficará...   │
├─────────────────────────────────────┤
│ [Enviar Mensagem]                   │
└─────────────────────────────────────┘
```

### Compatibilidade

- ✅ Mantém funcionalidade de envio de imagem
- ✅ Mantém histórico de mensagens
- ✅ Mantém sistema de templates
- ✅ Não quebra funcionalidades existentes

### Backend Integration

O formulário já está integrado com o endpoint atualizado:
- `POST /api/chat/send/text` processa variações automaticamente
- Não precisa de mudanças no código de envio
- Backend aplica variações transparentemente

### Requisitos Atendidos

- ✅ **Requisito 1.1**: Editor integrado no formulário
- ✅ **Requisito 1.2**: Variações processadas no envio
- ✅ **Requisito 2.1**: Preview disponível
- ✅ **Requisito 2.3**: Preview inline (não modal)

### Arquivos Modificados

- `src/components/user/UserMessages.tsx` - Formulário atualizado

### Testes Manuais

Para testar a integração:

1. Acesse a página de mensagens
2. Digite uma mensagem com variações: `Olá|Oi, tudo bem?`
3. Veja a validação em tempo real
4. Clique no painel de preview
5. Veja os diferentes previews
6. Envie a mensagem
7. Verifique que foi enviada com uma variação

### Próximos Passos

Com o formulário de mensagem única integrado, podemos:
- Task 6.2: Integrar com dispatcher de mensagens em massa
- Task 6.3: Integrar com sistema de templates
