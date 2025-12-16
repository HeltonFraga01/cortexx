# Bug Fix - Campanhas Agendadas Não Aparecem na Aba "Agendados"

## Problema Identificado

Quando o usuário criava uma campanha agendada, recebia a mensagem de sucesso:
> "Campanha 'Teste02' agendada com sucesso! Será iniciada em 27/11/2025 às 16:04"

Porém, a campanha não aparecia na aba "Agendados" do disparador.

## Causa Raiz

### 1. Backend - Rota `/api/user/bulk-campaigns/active`

A rota estava filtrando apenas campanhas com status `'running'` ou `'paused'`:

```javascript
// ❌ ANTES
AND status IN ('running', 'paused')
```

Campanhas com status `'scheduled'` não eram retornadas pela API.

### 2. Frontend - Função `getAllScheduledItems`

A função estava filtrando apenas campanhas com `status === 'scheduled'`, o que era muito restritivo. Campanhas que já começaram a executar (`'running'`) ou foram pausadas (`'paused'`) também deveriam aparecer se forem agendadas.

## Correções Aplicadas

### 1. Backend - `server/routes/bulkCampaignRoutes.js`

**Linha ~184:**
```javascript
// ✅ DEPOIS
AND status IN ('scheduled', 'running', 'paused')
```

**Linhas ~202-215:**
Adicionados campos `isScheduled` e `scheduledAt` na resposta:
```javascript
return {
  id: campaign.id,
  name: campaign.name,
  instance: campaign.instance,
  status: campaign.status,
  messageType: campaign.message_type,
  totalContacts: campaign.total_contacts,
  sentCount: campaign.sent_count,
  failedCount: campaign.failed_count,
  currentIndex: campaign.current_index,
  createdAt: campaign.created_at,
  startedAt: campaign.started_at,
  isScheduled: campaign.is_scheduled === 1,  // ✅ ADICIONADO
  scheduledAt: campaign.scheduled_at,         // ✅ ADICIONADO
  progress: progress ? progress.stats : null
};
```

### 2. Frontend - `src/lib/scheduled-items.ts`

**Linha ~127:**
```javascript
// ❌ ANTES
.filter(c => c.status === 'scheduled' && c.isScheduled)

// ✅ DEPOIS
.filter(c => c.isScheduled) // Incluir todas as campanhas agendadas, independente do status
```

## Resultado

Agora, quando uma campanha é agendada:
1. ✅ A API retorna a campanha na rota `/active`
2. ✅ A função `getAllScheduledItems` inclui a campanha
3. ✅ A campanha aparece na aba "Agendados"
4. ✅ O card mostra todas as informações relevantes
5. ✅ Campanhas em execução ou pausadas também aparecem se forem agendadas

## Arquivos Modificados

- `server/routes/bulkCampaignRoutes.js` - Rota GET /active
- `src/lib/scheduled-items.ts` - Função getAllScheduledItems

## Testes Realizados

- [x] Criar campanha agendada
- [x] Verificar se aparece na aba "Agendados" ✅ **FUNCIONANDO**
- [x] Verificar informações do card (nome, data, status) ✅ **FUNCIONANDO**
- [ ] Testar cancelamento da campanha
- [ ] Verificar se campanha em execução ainda aparece
- [ ] Verificar se campanha pausada ainda aparece

## Resultado dos Testes

✅ **Bug corrigido com sucesso!**

Após as correções, as campanhas agendadas agora aparecem corretamente na aba "Agendados":

- Campanha "Teste" - Agendada para 20/11/2025 às 03:02 (em 6d 9h)
- Campanha "Teste02" - Agendada para 27/11/2025 às 16:04 (em 13d 22h)

Ambas exibem:
- ✅ Nome da campanha
- ✅ Status "Agendada"
- ✅ Data e hora formatadas corretamente
- ✅ Tempo restante até execução
- ✅ Total de contatos
- ✅ Tipo de mensagem
- ✅ Instância
- ✅ Botão para cancelar

## Nota Importante

~~**O servidor backend precisa ser reiniciado** para que as mudanças na rota tenham efeito.~~

✅ **Atualização:** O servidor já está rodando com as correções aplicadas (hot reload funcionou).
