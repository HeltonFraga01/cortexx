# Task 12 Implementation - Unificar Visualização de Mensagens Agendadas

## Objetivo

Criar uma visualização unificada que combine mensagens únicas agendadas (localStorage) com campanhas agendadas (backend) em uma única aba "Agendados".

## Implementação

### Subtask 12.1: Interface Unificada ✅

**Arquivo criado:** `src/lib/scheduled-items.ts`

**Interfaces criadas:**
- `ScheduledItem`: Discriminated union type para mensagens e campanhas
- `ScheduledSingleMessage`: Representa mensagem única do localStorage
- `ScheduledCampaign`: Representa campanha do backend

**Funções implementadas:**
- `getAllScheduledItems()`: Combina dados do localStorage e backend
- `formatScheduledDate()`: Formata data para exibição brasileira
- `isOverdue()`: Verifica se item está atrasado
- `getTimeUntilScheduled()`: Calcula tempo restante até agendamento

### Subtask 12.3: Componentes de Card ✅

**Arquivos criados:**

1. **`src/components/disparador/ScheduledSingleMessageCard.tsx`**
   - Exibe mensagem única agendada
   - Mostra tipo (texto/mídia), destinatário, conteúdo
   - Indica se está atrasado
   - Botão para remover com confirmação
   - Exibe erros se houver

2. **`src/components/disparador/ScheduledCampaignCard.tsx`**
   - Exibe campanha agendada
   - Mostra progresso (barra de progresso)
   - Status (agendada, em execução, pausada, etc.)
   - Botões para pausar/retomar/cancelar
   - Estatísticas (total, enviadas, falhas, taxa de sucesso)

### Subtask 12.2: Atualização do DisparadorList ✅

**Arquivo modificado:** `src/components/disparador/DisparadorList.tsx`

**Mudanças principais:**
- Substituiu `getScheduledMessages()` por `getAllScheduledItems()`
- Adicionou polling a cada 30 segundos para atualizar campanhas
- Renderiza `ScheduledSingleMessageCard` para mensagens únicas
- Renderiza `ScheduledCampaignCard` para campanhas
- Implementou handlers para:
  - Remover mensagem única
  - Cancelar campanha
  - Pausar campanha
  - Retomar campanha

## Funcionalidades

### Visualização Unificada
- ✅ Mensagens únicas e campanhas na mesma lista
- ✅ Ordenação por data de agendamento (mais próximo primeiro)
- ✅ Filtro por instância
- ✅ Atualização automática via storage events e polling

### Feedback Visual
- ✅ Badge de status para cada tipo de item
- ✅ Indicador de "Atrasado" para itens que passaram do horário
- ✅ Tempo restante até agendamento
- ✅ Barra de progresso para campanhas em execução
- ✅ Ícones distintos para cada tipo

### Ações Disponíveis
- ✅ Remover mensagem única (com confirmação)
- ✅ Cancelar campanha (com confirmação)
- ✅ Pausar campanha em execução
- ✅ Retomar campanha pausada

## Benefícios

1. **Visão Centralizada**: Usuário vê todos os agendamentos em um só lugar
2. **Melhor UX**: Não precisa alternar entre diferentes telas
3. **Informações Completas**: Cada card mostra informações relevantes
4. **Ações Contextuais**: Botões apropriados para cada tipo de item
5. **Atualização Automática**: Lista se atualiza automaticamente

## Arquivos Criados/Modificados

### Criados
- `src/lib/scheduled-items.ts`
- `src/components/disparador/ScheduledSingleMessageCard.tsx`
- `src/components/disparador/ScheduledCampaignCard.tsx`

### Modificados
- `src/components/disparador/DisparadorList.tsx`

## Testes Recomendados

- [ ] Criar mensagem única agendada e verificar na aba
- [ ] Criar campanha agendada e verificar na aba
- [ ] Verificar ordenação por data
- [ ] Testar remoção de mensagem única
- [ ] Testar cancelamento de campanha
- [ ] Testar pausa/retomada de campanha
- [ ] Verificar atualização automática
- [ ] Testar com múltiplas instâncias
