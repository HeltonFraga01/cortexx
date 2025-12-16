# Release Notes - v1.5.0

**Data de Lançamento:** 2025-11-16  
**Tipo:** Minor Release  
**Compatibilidade:** 100% compatível com v1.4.9

---

## 🎯 Resumo

Versão focada em correção crítica do sistema de campanhas em massa, permitindo retomar campanhas pausadas sem perda de dados ou estado.

---

## ✨ Novidades

### 1. Correção Crítica: Retomada de Campanhas

**Problema Resolvido:** Ao tentar retomar uma campanha pausada, o sistema retornava erro 500 e a campanha não podia ser continuada.

**Causa Raiz Identificada:**
1. **Estrutura de dados incorreta** - Dados do banco não eram transformados para o formato esperado
2. **Estado não restaurado** - Índice atual, contadores de envio e falhas não eram recuperados
3. **Contatos não carregados** - Sistema não carregava contatos pendentes ao retomar

**Solução Implementada:**

#### CampaignScheduler.js
- ✅ Novo método `getCampaignFromDB()` - Busca campanha completa do banco
- ✅ Novo método `transformCampaignToConfig()` - Transforma dados do banco para formato correto
- ✅ Refatoração completa de `resumeCampaign()`:
  - Validação de campanha existente
  - Validação de estado pausado
  - Transformação de dados
  - Restauração de estado
  - Carregamento de contatos pendentes
  - Tratamento de erros específicos

#### QueueManager.js
- ✅ Novo método `restoreState()` - Restaura índice e contadores do banco
- ✅ Modificação em `loadContacts()` - Filtra apenas contatos com status 'pending'
- ✅ Preservação de progresso ao retomar

#### bulkCampaignRoutes.js
- ✅ Melhor tratamento de erros no endpoint `/resume`
- ✅ Mensagens de erro específicas para cada cenário
- ✅ Logging detalhado para diagnóstico

**Impacto:**
- Campanhas pausadas podem ser retomadas sem perda de dados
- Estado preservado (contatos enviados, falhas, índice atual)
- Apenas contatos pendentes são processados
- Sem duplicação de envios
- Experiência do usuário restaurada

**Arquivos Modificados:**
- `server/services/CampaignScheduler.js`
- `server/services/QueueManager.js`
- `server/routes/bulkCampaignRoutes.js`

---

## 🐛 Correções de Bugs

### 1. Erro 500 ao Retomar Campanha

**Problema:** 
```
POST /api/user/bulk-campaigns/123/resume
Response: 500 Internal Server Error
```

**Solução:**
- Validação completa antes de processar
- Transformação correta de dados
- Restauração de estado
- Carregamento de contatos

**Resultado:**
```
POST /api/user/bulk-campaigns/123/resume
Response: 200 OK
{
  "success": true,
  "message": "Campanha retomada com sucesso",
  "campaign": { ... }
}
```

### 2. Perda de Progresso ao Retomar

**Problema:** Campanha retomada começava do zero, reenviando mensagens.

**Solução:**
- Método `restoreState()` recupera:
  - `currentIndex` - Índice do último contato processado
  - `sentCount` - Total de mensagens enviadas
  - `failedCount` - Total de falhas
- Apenas contatos com `status = 'pending'` são processados

**Resultado:** Campanha continua exatamente de onde parou.

### 3. Estrutura de Dados Incorreta

**Problema:** Dados do banco não correspondiam ao formato esperado pelo scheduler.

**Solução:**
- Método `transformCampaignToConfig()` transforma:
  - `campaign_name` → `name`
  - `message_template` → `messageTemplate`
  - `delay_between_messages` → `delayBetweenMessages`
  - `delay_variation` → `delayVariation`
  - `start_time` → `startTime`
  - `end_time` → `endTime`
  - `days_of_week` → `daysOfWeek` (parse JSON)
  - `time_windows` → `timeWindows` (parse JSON)

**Resultado:** Scheduler recebe dados no formato correto.

---

## 📝 Documentação

### Novos Documentos

1. **`.kiro/specs/campaign-resume-fix/`**
   - `requirements.md` - Requisitos usando padrão EARS/INCOSE
   - `design.md` - Arquitetura da solução
   - `tasks.md` - Tasks implementadas
   - `DIAGNOSTIC_REPORT.md` - Diagnóstico técnico completo com análise de causa raiz

2. **Documentação de Contexto**
   - Análise de 3 causas raiz
   - Fluxos de dados antes/depois
   - Exemplos de código
   - Testes de validação

---

## 🔧 Melhorias Técnicas

### Antes: Erro ao Retomar

```javascript
async resumeCampaign(campaignId) {
  const campaign = this.campaigns.get(campaignId);
  // ❌ campaign não existe (não está em memória)
  // ❌ Erro: Cannot read property 'status' of undefined
}
```

### Depois: Retomada Funcional

```javascript
async resumeCampaign(campaignId) {
  // 1. Buscar do banco
  const campaignData = await this.getCampaignFromDB(campaignId);
  
  // 2. Validar estado
  if (campaignData.status !== 'paused') {
    throw new Error('Campanha não está pausada');
  }
  
  // 3. Transformar dados
  const config = this.transformCampaignToConfig(campaignData);
  
  // 4. Criar queue manager
  const queueManager = new QueueManager(config);
  
  // 5. Restaurar estado
  await queueManager.restoreState(campaignId);
  
  // 6. Carregar contatos pendentes
  await queueManager.loadContacts(campaignId);
  
  // 7. Retomar processamento
  this.campaigns.set(campaignId, { config, queueManager });
  await this.processCampaign(campaignId);
}
```

### Restauração de Estado

```javascript
async restoreState(campaignId) {
  const campaign = await db.get(
    'SELECT current_index, sent_count, failed_count FROM bulk_campaigns WHERE id = ?',
    [campaignId]
  );
  
  this.currentIndex = campaign.current_index || 0;
  this.sentCount = campaign.sent_count || 0;
  this.failedCount = campaign.failed_count || 0;
}
```

### Filtragem de Contatos Pendentes

```javascript
async loadContacts(campaignId) {
  const contacts = await db.all(
    `SELECT * FROM bulk_campaign_contacts 
     WHERE campaign_id = ? AND status = 'pending'
     ORDER BY id ASC`,
    [campaignId]
  );
  
  this.contacts = contacts;
}
```

---

## 📊 Estatísticas

### Arquivos Modificados
- **Total:** 3 arquivos
- **Backend:** 3 arquivos (services + routes)
- **Documentação:** 4 arquivos novos

### Bugs Corrigidos
- **Críticos:** 1 (erro 500 ao retomar)
- **Graves:** 2 (perda de progresso, estrutura incorreta)
- **Total:** 3 bugs relacionados

### Linhas de Código
- **Adicionadas:** ~150 linhas
- **Modificadas:** ~50 linhas
- **Métodos novos:** 3 (getCampaignFromDB, transformCampaignToConfig, restoreState)

---

## 🔄 Migração

### Compatibilidade

✅ **100% compatível** com v1.4.9
- Sem mudanças no banco de dados
- Sem mudanças na API (apenas correções)
- Sem mudanças em variáveis de ambiente
- Sem breaking changes

### Atualização

```bash
# Docker Swarm
docker service update --image heltonfraga/wuzapi-manager:v1.5.0 wuzapi-manager_wuzapi-manager

# Docker Compose
docker-compose pull
docker-compose up -d

# Verificar versão
curl http://localhost:8080/api/admin/health
```

### Rollback

Se necessário, voltar para v1.4.9:

```bash
docker service update --image heltonfraga/wuzapi-manager:v1.4.9 wuzapi-manager_wuzapi-manager
```

---

## ✅ Testes Recomendados

### Campanhas em Massa

1. **Criar Nova Campanha**
   - [ ] Criar campanha com múltiplos contatos
   - [ ] Iniciar campanha
   - [ ] Verificar envio de mensagens
   - [ ] Pausar campanha
   - [ ] Verificar status = 'paused'

2. **Retomar Campanha Pausada**
   - [ ] Clicar em "Retomar" na campanha pausada
   - [ ] Verificar que não retorna erro 500
   - [ ] Verificar que campanha continua de onde parou
   - [ ] Verificar que contatos já enviados não recebem novamente
   - [ ] Verificar que apenas contatos pendentes são processados

3. **Progresso Preservado**
   - [ ] Verificar `sent_count` mantido
   - [ ] Verificar `failed_count` mantido
   - [ ] Verificar `current_index` correto
   - [ ] Verificar total de contatos correto

4. **Múltiplas Pausas/Retomadas**
   - [ ] Pausar campanha
   - [ ] Retomar campanha
   - [ ] Pausar novamente
   - [ ] Retomar novamente
   - [ ] Verificar que funciona em todas as iterações

### Funcionalidades Gerais

- [ ] Dashboard carrega normalmente
- [ ] Outras funcionalidades não afetadas
- [ ] Logs não mostram erros
- [ ] Performance mantida

---

## 🎯 Próximas Versões

### v1.6.0 (Planejado)

- Sistema de variações de mensagem (humanização)
- Cores dinâmicas de tema
- Melhorias de responsividade mobile
- Validação de variáveis em contatos

---

## 📞 Suporte

- **Documentação:** `docs/INDEX.md`
- **Configuração:** `docs/CONFIGURATION.md`
- **Deployment:** `DEPLOY_v1.5.0.md`
- **Spec Técnica:** `.kiro/specs/campaign-resume-fix/`

---

## 👥 Contribuidores

- Helton Fraga (@heltonfraga)
- Kiro AI Assistant

---

**Status:** ✅ Pronto para Produção  
**Recomendação:** Atualização **CRÍTICA** para usuários que utilizam campanhas em massa

