# Relatório de Diagnóstico - Problema de Retomada de Campanhas

## 🔴 Problema Identificado

Quando o usuário pausa uma campanha e tenta retomá-la, o sistema retorna **Erro 500** e a campanha não consegue continuar o processamento.

## 🔍 Análise da Causa Raiz

Após análise profunda do código, identifiquei **3 problemas principais** que causam a falha:

### 1. ❌ Estrutura de Dados Incorreta na Recriação da Fila

**Arquivo**: `server/services/CampaignScheduler.js` (linha ~340)

**Problema**: 
- Quando a fila não existe em memória (ex: após reinício do servidor), o código tenta recriá-la
- O construtor do `QueueManager` espera um objeto `config` com estrutura específica
- O código passa o objeto `campaign` (do banco) diretamente, que tem estrutura diferente

**Código Problemático**:
```javascript
const campaign = rows[0]; // Objeto do banco
queue = new QueueManager(campaignId, campaign, this.db); // ❌ Estrutura errada
```

**O que acontece**:
- `QueueManager` acessa `config.message_type`, `config.delay_min`, etc.
- `campaign` tem esses campos, então funciona parcialmente
- MAS falta chamar `loadContacts()` e `restoreState()`

### 2. ❌ Falta de Restauração do Estado da Campanha

**Arquivo**: `server/services/QueueManager.js` (construtor)

**Problema**:
- Quando a fila é recriada, ela sempre começa do zero:
  - `currentIndex = 0` → Recomeça do primeiro contato
  - `sentCount = 0` → Perde contagem de enviados
  - `failedCount = 0` → Perde contagem de falhas

**Código Problemático**:
```javascript
constructor(campaignId, config, db) {
  this.currentIndex = 0; // ❌ Sempre zero
  this.sentCount = 0;
  this.failedCount = 0;
  // ...
}
```

**Consequência**:
- Contatos já enviados serão enviados novamente (duplicatas!)
- Progresso é perdido

### 3. ❌ Falta de Carregamento de Contatos na Retomada

**Arquivo**: `server/services/CampaignScheduler.js` (método `resumeCampaign`)

**Problema**:
- Após criar a fila, o método `loadContacts()` não é chamado
- A fila fica com `contacts = []` (vazio)
- Ao tentar processar, não há contatos para enviar

**Código Problemático**:
```javascript
queue = new QueueManager(campaignId, campaign, this.db);
this.activeQueues.set(campaignId, queue);
// ❌ Falta: await queue.loadContacts();
// ❌ Falta: await queue.restoreState();
await queue.resume(); // Tenta processar array vazio
```

## 📊 Fluxo Atual (Quebrado)

```
1. Usuário clica "Retomar"
   ↓
2. Frontend → POST /api/user/bulk-campaigns/:id/resume
   ↓
3. Backend → scheduler.resumeCampaign(id)
   ↓
4. Scheduler verifica se fila existe em memória
   ↓
5. ❌ Fila não existe (foi removida ou servidor reiniciou)
   ↓
6. Tenta recriar fila:
   ✓ Busca campanha no banco
   ✓ Cria novo QueueManager
   ❌ Passa estrutura errada (campaign ao invés de config)
   ❌ NÃO carrega contatos
   ❌ NÃO restaura estado (currentIndex, sentCount)
   ↓
7. Chama queue.resume()
   ↓
8. queue.resume() → processQueue()
   ↓
9. ❌ Tenta processar contacts[0] (array vazio OU recomeça do início)
   ↓
10. 💥 ERRO 500 ou comportamento incorreto
```

## ✅ Solução Proposta

### Modificações Necessárias

#### 1. CampaignScheduler.resumeCampaign()

```javascript
async resumeCampaign(campaignId) {
  let queue = this.activeQueues.get(campaignId);
  
  if (!queue) {
    // 1. Buscar campanha
    const campaign = await this.getCampaignFromDB(campaignId);
    
    // 2. Validar status
    if (campaign.status !== 'paused') {
      throw new Error('Campanha não está pausada');
    }
    
    // 3. Validar conexão WUZAPI
    const isConnected = await this.validateWuzapiConnection(...);
    if (!isConnected) {
      throw new Error('WhatsApp não conectado');
    }
    
    // 4. ✅ Transformar para estrutura correta
    const config = this.transformCampaignToConfig(campaign);
    
    // 5. ✅ Criar fila com estrutura correta
    queue = new QueueManager(campaignId, config, this.db);
    
    // 6. ✅ Carregar contatos pendentes
    await queue.loadContacts();
    
    // 7. ✅ Restaurar estado (currentIndex, sentCount, etc.)
    await queue.restoreState(campaign);
    
    // 8. Adicionar à lista de filas ativas
    this.activeQueues.set(campaignId, queue);
  }
  
  // 9. Retomar processamento
  await queue.resume();
}
```

#### 2. QueueManager.restoreState() (NOVO)

```javascript
async restoreState(campaign) {
  // Restaurar contadores do banco
  this.currentIndex = campaign.current_index || 0;
  this.sentCount = campaign.sent_count || 0;
  this.failedCount = campaign.failed_count || 0;
  
  // Restaurar timestamps
  this.startedAt = campaign.started_at ? new Date(campaign.started_at) : null;
  this.pausedAt = campaign.paused_at ? new Date(campaign.paused_at) : null;
  
  // Validar que há contatos para processar
  if (this.currentIndex >= this.contacts.length) {
    throw new Error('Não há contatos pendentes');
  }
  
  logger.info('Estado restaurado', {
    currentIndex: this.currentIndex,
    contactsRemaining: this.contacts.length - this.currentIndex
  });
}
```

#### 3. QueueManager.loadContacts() (MODIFICADO)

```javascript
async loadContacts() {
  // ✅ Carregar APENAS contatos pendentes
  const sql = `
    SELECT * FROM campaign_contacts 
    WHERE campaign_id = ? 
    AND status = 'pending'  -- ✅ Filtro adicionado
    ORDER BY processing_order
  `;
  
  const { rows } = await this.db.query(sql, [this.campaignId]);
  
  this.contacts = rows.map(row => ({
    id: row.id,
    phone: row.phone,
    name: row.name,
    variables: JSON.parse(row.variables || '{}'),
    status: row.status
  }));
  
  logger.info('Contatos pendentes carregados', {
    count: this.contacts.length
  });
}
```

## 📈 Fluxo Corrigido

```
1. Usuário clica "Retomar"
   ↓
2. Frontend → POST /api/user/bulk-campaigns/:id/resume
   ↓
3. Backend → scheduler.resumeCampaign(id)
   ↓
4. Scheduler verifica se fila existe em memória
   ↓
5. Fila não existe → Recriar:
   ✅ Busca campanha no banco
   ✅ Valida status = 'paused'
   ✅ Valida conexão WUZAPI
   ✅ Transforma dados para estrutura correta
   ✅ Cria QueueManager com config correto
   ✅ Carrega contatos pendentes (apenas não enviados)
   ✅ Restaura estado (currentIndex, sentCount, failedCount)
   ✅ Adiciona à lista de filas ativas
   ↓
6. Chama queue.resume()
   ↓
7. queue.resume() → processQueue()
   ↓
8. ✅ Processa contacts[currentIndex] (continua de onde parou)
   ↓
9. ✅ Sucesso! Campanha retomada corretamente
```

## 🎯 Benefícios da Correção

1. ✅ **Retomada Funciona**: Campanha continua exatamente de onde parou
2. ✅ **Sem Duplicatas**: Contatos já enviados não são reenviados
3. ✅ **Progresso Preservado**: currentIndex, sentCount mantidos
4. ✅ **Funciona Após Reinício**: Servidor pode reiniciar sem perder estado
5. ✅ **Erros Claros**: Mensagens descritivas para cada tipo de erro
6. ✅ **Logs Detalhados**: Facilita debugging de problemas

## 📝 Próximos Passos

1. **Revisar Requirements** (`.kiro/specs/campaign-resume-fix/requirements.md`)
2. **Revisar Design** (`.kiro/specs/campaign-resume-fix/design.md`)
3. **Executar Tasks** (`.kiro/specs/campaign-resume-fix/tasks.md`)
4. **Testar Manualmente**:
   - Criar campanha com 5 contatos
   - Pausar após 2 enviados
   - Retomar e verificar que continua do 3º
5. **Validar em Produção**

## 🔧 Arquivos que Serão Modificados

1. `server/services/CampaignScheduler.js`
   - Método `resumeCampaign()` - Refatoração completa
   - Novos métodos: `getCampaignFromDB()`, `transformCampaignToConfig()`

2. `server/services/QueueManager.js`
   - Novo método: `restoreState()`
   - Modificação: `loadContacts()` - Filtrar apenas pendentes

3. `server/routes/bulkCampaignRoutes.js`
   - Endpoint `/resume` - Melhor tratamento de erros

4. `server/migrations/` (novo)
   - Adicionar índice para otimizar queries

## ⚠️ Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Campanhas antigas não funcionam | Baixa | Médio | Validar compatibilidade com dados existentes |
| Performance degradada | Baixa | Baixo | Adicionar índice no banco |
| Bugs em edge cases | Média | Médio | Testes automatizados completos |
| Duplicatas em campanhas em andamento | Baixa | Alto | Testar exaustivamente antes de deploy |

## 📊 Estimativa de Esforço

- **Implementação**: 4-6 horas
- **Testes**: 2-3 horas
- **Documentação**: 1 hora
- **Total**: 7-10 horas

## ✅ Critérios de Sucesso

A correção será considerada bem-sucedida quando:

1. ✅ Usuário consegue pausar e retomar sem erro 500
2. ✅ Campanha continua exatamente de onde parou
3. ✅ Contatos já enviados não são reenviados
4. ✅ Funciona após reinício do servidor
5. ✅ Mensagens de erro são claras
6. ✅ Logs permitem debugging fácil
