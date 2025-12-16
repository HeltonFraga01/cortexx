# Design Document - Correção de Retomada de Campanhas

## Overview

Este documento detalha a solução técnica para corrigir o problema de retomada de campanhas pausadas. A solução envolve modificações em dois serviços principais: `CampaignScheduler` e `QueueManager`.

## Architecture

### Componentes Afetados

1. **CampaignScheduler** (`server/services/CampaignScheduler.js`)
   - Método `resumeCampaign()` - Recriação correta da fila
   - Validação de conexão WUZAPI antes de retomar

2. **QueueManager** (`server/services/QueueManager.js`)
   - Novo método `restoreState()` - Restaura estado da campanha
   - Modificação no método `loadContacts()` - Carrega apenas pendentes
   - Modificação no método `resume()` - Valida estado antes de processar

3. **Rotas** (`server/routes/bulkCampaignRoutes.js`)
   - Melhor tratamento de erros no endpoint `/resume`
   - Mensagens de erro mais descritivas

## Components and Interfaces

### 1. CampaignScheduler.resumeCampaign()

**Responsabilidade**: Retomar uma campanha pausada, recriando a fila se necessário

**Fluxo Atual (Quebrado)**:
```javascript
async resumeCampaign(campaignId) {
  let queue = this.activeQueues.get(campaignId);
  
  if (!queue) {
    // Busca campanha
    const campaign = rows[0];
    // Cria fila (estrutura errada)
    queue = new QueueManager(campaignId, campaign, this.db);
    // ❌ Não carrega contatos
    // ❌ Não restaura estado
  }
  
  await queue.resume();
}
```

**Fluxo Corrigido**:
```javascript
async resumeCampaign(campaignId) {
  let queue = this.activeQueues.get(campaignId);
  
  if (!queue) {
    // 1. Buscar campanha do banco
    const campaign = await this.getCampaignFromDB(campaignId);
    
    // 2. Validar status
    if (campaign.status !== 'paused') {
      throw new Error('Campanha não está pausada');
    }
    
    // 3. Validar conexão WUZAPI
    const isConnected = await this.validateWuzapiConnection(
      campaign.instance,
      campaign.user_token
    );
    
    if (!isConnected) {
      throw new Error('Instância WhatsApp não está conectada');
    }
    
    // 4. Transformar dados para formato correto
    const config = this.transformCampaignToConfig(campaign);
    
    // 5. Criar nova fila
    queue = new QueueManager(campaignId, config, this.db);
    
    // 6. Carregar contatos pendentes
    await queue.loadContacts();
    
    // 7. Restaurar estado da campanha
    await queue.restoreState(campaign);
    
    // 8. Adicionar à lista de filas ativas
    this.activeQueues.set(campaignId, queue);
  }
  
  // 9. Retomar processamento
  await queue.resume();
}
```

**Novos Métodos Auxiliares**:

```javascript
// Busca campanha do banco com validação
async getCampaignFromDB(campaignId) {
  const sql = 'SELECT * FROM campaigns WHERE id = ?';
  const { rows } = await this.db.query(sql, [campaignId]);
  
  if (rows.length === 0) {
    throw new Error('Campanha não encontrada');
  }
  
  return rows[0];
}

// Transforma objeto do banco para formato do QueueManager
transformCampaignToConfig(campaign) {
  return {
    instance: campaign.instance,
    user_token: campaign.user_token,
    message_type: campaign.message_type,
    message_content: campaign.message_content,
    media_url: campaign.media_url,
    media_type: campaign.media_type,
    media_file_name: campaign.media_file_name,
    delay_min: campaign.delay_min,
    delay_max: campaign.delay_max,
    randomize_order: campaign.randomize_order === 1
  };
}
```

### 2. QueueManager.restoreState()

**Responsabilidade**: Restaurar o estado de uma campanha pausada

**Implementação**:
```javascript
async restoreState(campaign) {
  logger.info('Restaurando estado da campanha', {
    campaignId: this.campaignId,
    currentIndex: campaign.current_index,
    sentCount: campaign.sent_count,
    failedCount: campaign.failed_count
  });
  
  // Restaurar contadores
  this.currentIndex = campaign.current_index || 0;
  this.sentCount = campaign.sent_count || 0;
  this.failedCount = campaign.failed_count || 0;
  
  // Restaurar timestamps
  this.startedAt = campaign.started_at ? new Date(campaign.started_at) : null;
  this.pausedAt = campaign.paused_at ? new Date(campaign.paused_at) : null;
  
  // Validar que há contatos para processar
  if (this.currentIndex >= this.contacts.length) {
    throw new Error('Não há contatos pendentes para processar');
  }
  
  logger.info('Estado restaurado com sucesso', {
    campaignId: this.campaignId,
    contactsRemaining: this.contacts.length - this.currentIndex
  });
}
```

### 3. QueueManager.loadContacts() - Modificado

**Responsabilidade**: Carregar apenas contatos pendentes (não enviados)

**Implementação Atual**:
```javascript
async loadContacts() {
  const sql = `
    SELECT * FROM campaign_contacts 
    WHERE campaign_id = ? 
    ORDER BY processing_order
  `;
  // Carrega TODOS os contatos
}
```

**Implementação Corrigida**:
```javascript
async loadContacts() {
  const sql = `
    SELECT * FROM campaign_contacts 
    WHERE campaign_id = ? 
    AND status = 'pending'
    ORDER BY processing_order
  `;
  
  const { rows } = await this.db.query(sql, [this.campaignId]);
  
  this.contacts = rows.map(row => ({
    id: row.id,
    phone: row.phone,
    name: row.name,
    variables: row.variables ? JSON.parse(row.variables) : {},
    status: row.status,
    processingOrder: row.processing_order
  }));

  logger.info('Contatos pendentes carregados', {
    campaignId: this.campaignId,
    count: this.contacts.length
  });
  
  if (this.contacts.length === 0) {
    logger.warn('Nenhum contato pendente encontrado', {
      campaignId: this.campaignId
    });
  }
}
```

### 4. Tratamento de Erros nas Rotas

**Endpoint**: `POST /api/user/bulk-campaigns/:id/resume`

**Implementação Corrigida**:
```javascript
router.post('/:id/resume', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;

    const db = req.app.locals.db;
    const scheduler = req.app.locals.campaignScheduler;

    // Verificar se campanha pertence ao usuário
    const sql = 'SELECT * FROM campaigns WHERE id = ? AND user_token = ?';
    const { rows } = await db.query(sql, [id, userToken]);

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: 'A campanha solicitada não existe ou não pertence a este usuário'
      });
    }

    const campaign = rows[0];

    // Validar status
    if (campaign.status !== 'paused') {
      return res.status(400).json({
        error: 'Operação inválida',
        message: `Não é possível retomar uma campanha com status '${campaign.status}'. Apenas campanhas pausadas podem ser retomadas.`
      });
    }

    if (!scheduler) {
      return res.status(503).json({
        error: 'Serviço indisponível',
        message: 'O serviço de agendamento não está disponível no momento'
      });
    }

    // Tentar retomar
    await scheduler.resumeCampaign(id);

    logger.info('Campanha retomada via API', { 
      campaignId: id,
      userToken: userToken.substring(0, 8) + '...'
    });

    res.json({
      success: true,
      status: 'running',
      message: 'Campanha retomada com sucesso'
    });

  } catch (error) {
    logger.error('Erro ao retomar campanha:', {
      campaignId: req.params.id,
      error: error.message,
      stack: error.stack
    });

    // Mensagens de erro específicas
    if (error.message.includes('não encontrada')) {
      return res.status(404).json({
        error: 'Campanha não encontrada',
        message: error.message
      });
    }
    
    if (error.message.includes('não está pausada')) {
      return res.status(400).json({
        error: 'Operação inválida',
        message: error.message
      });
    }
    
    if (error.message.includes('não está conectada')) {
      return res.status(503).json({
        error: 'Conexão indisponível',
        message: 'A instância do WhatsApp não está conectada. Conecte-se e tente novamente.'
      });
    }
    
    if (error.message.includes('contatos pendentes')) {
      return res.status(400).json({
        error: 'Sem contatos pendentes',
        message: 'Não há mais contatos pendentes para processar nesta campanha'
      });
    }

    // Erro genérico
    res.status(500).json({
      error: 'Erro ao retomar campanha',
      message: error.message
    });
  }
});
```

## Data Models

### Campaign (banco de dados)

```sql
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  instance TEXT NOT NULL,
  user_token TEXT NOT NULL,
  status TEXT NOT NULL, -- 'scheduled', 'running', 'paused', 'completed', 'cancelled', 'failed'
  message_type TEXT NOT NULL,
  message_content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  media_file_name TEXT,
  delay_min INTEGER NOT NULL,
  delay_max INTEGER NOT NULL,
  randomize_order INTEGER DEFAULT 0,
  is_scheduled INTEGER DEFAULT 0,
  scheduled_at TEXT,
  total_contacts INTEGER NOT NULL,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  current_index INTEGER DEFAULT 0, -- ⭐ Crucial para retomada
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  paused_at TEXT, -- ⭐ Timestamp da pausa
  completed_at TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### CampaignContact (banco de dados)

```sql
CREATE TABLE campaign_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campaign_id TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  variables TEXT, -- JSON
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_type TEXT,
  error_message TEXT,
  sent_at TEXT,
  processing_order INTEGER NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
);
```

## Error Handling

### Tipos de Erro e Tratamento

| Erro | HTTP Status | Mensagem | Ação |
|------|-------------|----------|------|
| Campanha não encontrada | 404 | "Campanha não encontrada" | Verificar ID |
| Campanha não pausada | 400 | "Campanha não está pausada" | Verificar status |
| Sem contatos pendentes | 400 | "Não há contatos pendentes" | Campanha já concluída |
| WhatsApp desconectado | 503 | "Instância não conectada" | Reconectar WhatsApp |
| Scheduler indisponível | 503 | "Serviço indisponível" | Aguardar/reiniciar |
| Erro ao carregar contatos | 500 | "Erro ao carregar contatos" | Verificar banco |
| Erro ao restaurar estado | 500 | "Erro ao restaurar estado" | Verificar logs |

## Testing Strategy

### Testes Unitários

1. **CampaignScheduler.resumeCampaign()**
   - Deve retomar campanha com fila em memória
   - Deve recriar fila quando não está em memória
   - Deve validar status antes de retomar
   - Deve validar conexão WUZAPI
   - Deve lançar erro se campanha não existe
   - Deve lançar erro se não está pausada

2. **QueueManager.restoreState()**
   - Deve restaurar currentIndex corretamente
   - Deve restaurar sentCount e failedCount
   - Deve restaurar timestamps
   - Deve lançar erro se não há contatos pendentes

3. **QueueManager.loadContacts()**
   - Deve carregar apenas contatos com status 'pending'
   - Deve ordenar por processing_order
   - Deve retornar array vazio se não há pendentes

### Testes de Integração

1. **Fluxo Completo de Pausa/Retomada**
   ```javascript
   // 1. Criar campanha com 10 contatos
   // 2. Iniciar campanha
   // 3. Aguardar envio de 3 contatos
   // 4. Pausar campanha
   // 5. Verificar que status = 'paused' e current_index = 3
   // 6. Retomar campanha
   // 7. Verificar que continua do contato 4
   // 8. Aguardar conclusão
   // 9. Verificar que todos os 10 foram enviados (sem duplicatas)
   ```

2. **Retomada Após Reinício do Servidor**
   ```javascript
   // 1. Criar e pausar campanha
   // 2. Limpar activeQueues (simular reinício)
   // 3. Retomar campanha
   // 4. Verificar que fila foi recriada corretamente
   // 5. Verificar que processamento continua do ponto correto
   ```

3. **Tratamento de Erros**
   ```javascript
   // 1. Tentar retomar campanha que não existe → 404
   // 2. Tentar retomar campanha 'running' → 400
   // 3. Tentar retomar campanha sem contatos pendentes → 400
   // 4. Tentar retomar com WhatsApp desconectado → 503
   ```

## Performance Considerations

- **Query Otimizada**: Carregar apenas contatos pendentes reduz uso de memória
- **Índices**: Adicionar índice em `campaign_contacts(campaign_id, status, processing_order)`
- **Logs**: Usar nível DEBUG para logs detalhados (não impacta produção)
- **Validação WUZAPI**: Cache de 30s para evitar múltiplas chamadas

## Security Considerations

- **Validação de Ownership**: Sempre verificar que campanha pertence ao usuário
- **Sanitização**: Dados já são sanitizados na criação da campanha
- **Rate Limiting**: Endpoint de resume deve ter rate limit (5 req/min por usuário)

## Rollback Plan

Se a correção causar problemas:

1. Reverter commits das modificações
2. Campanhas pausadas antes da correção continuarão pausadas
3. Usuários podem cancelar e recriar campanhas se necessário
4. Nenhuma perda de dados (apenas funcionalidade de retomada afetada)
