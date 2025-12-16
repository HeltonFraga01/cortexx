# Requirements Document - Correção de Retomada de Campanhas

## Introduction

Este documento especifica os requisitos para corrigir o problema crítico de retomada de campanhas pausadas no sistema de disparo em massa. Atualmente, quando uma campanha é pausada e depois retomada, o sistema apresenta erro 500 ("Erro interno do servidor") e a campanha não consegue continuar o processamento.

## Glossary

- **Campaign**: Uma campanha de disparo em massa de mensagens WhatsApp
- **QueueManager**: Serviço responsável por processar a fila de envio de mensagens de uma campanha
- **CampaignScheduler**: Serviço que gerencia o ciclo de vida das campanhas (iniciar, pausar, retomar, cancelar)
- **Contact**: Um destinatário individual dentro de uma campanha
- **Processing State**: Estado atual do processamento (running, paused, completed, cancelled, failed)
- **Resume Operation**: Operação de retomar uma campanha pausada

## Análise do Problema Atual

### Sintomas Observados

1. **Erro 500 ao retomar**: Quando o usuário clica em "Retomar", a API retorna erro 500
2. **Mensagem de erro**: "Erro interno do servidor. Tente novamente mais tarde"
3. **Campanha não retoma**: A campanha permanece pausada mesmo após a tentativa de retomada
4. **Logs mostram**: "Campanha retomada" mas nada acontece

### Causa Raiz Identificada

Após análise profunda do código, identifiquei **3 problemas principais**:

#### 1. **Falta de Recriação da Fila no Resume**

**Localização**: `server/services/CampaignScheduler.js` - método `resumeCampaign()`

**Problema**: 
- Quando uma campanha é pausada, a fila (`QueueManager`) permanece em memória
- Se o servidor reinicia ou a fila é removida da memória, ao tentar retomar, a fila não existe mais
- O código atual tenta recriar a fila, MAS passa o objeto `campaign` (do banco) diretamente para o construtor do `QueueManager`
- O construtor do `QueueManager` espera um objeto `config` com estrutura específica, não o objeto `campaign` do banco

**Código Problemático**:
```javascript
// CampaignScheduler.js - linha ~340
const campaign = rows[0];
queue = new QueueManager(campaignId, campaign, this.db); // ❌ ERRADO
```

**O que acontece**:
- `campaign` tem campos como `message_type`, `message_content`, etc.
- `QueueManager` acessa `config.message_type`, `config.message_content`
- Como `campaign` é o objeto do banco, funciona parcialmente
- MAS falta chamar `loadContacts()` e restaurar o estado (`currentIndex`, `sentCount`, etc.)

#### 2. **Falta de Restauração do Estado da Campanha**

**Localização**: `server/services/QueueManager.js` - construtor e método `resume()`

**Problema**:
- Quando a fila é recriada, ela começa do zero:
  - `currentIndex = 0`
  - `sentCount = 0`
  - `failedCount = 0`
- Os contatos já enviados serão enviados novamente
- O progresso é perdido

**Código Problemático**:
```javascript
// QueueManager.js - construtor
this.currentIndex = 0; // ❌ Sempre começa do zero
this.sentCount = 0;
this.failedCount = 0;
```

#### 3. **Falta de Carregamento de Contatos na Retomada**

**Localização**: `server/services/CampaignScheduler.js` - método `resumeCampaign()`

**Problema**:
- Quando a fila é recriada, o método `loadContacts()` não é chamado
- A fila fica vazia (`contacts = []`)
- Ao tentar processar, não há contatos para enviar

**Código Problemático**:
```javascript
// CampaignScheduler.js - linha ~345
queue = new QueueManager(campaignId, campaign, this.db);
this.activeQueues.set(campaignId, queue);
// ❌ Falta: await queue.loadContacts();
// ❌ Falta: await queue.restoreState();
```

### Fluxo Atual (Quebrado)

```
1. Usuário clica "Retomar"
   ↓
2. Frontend chama POST /api/user/bulk-campaigns/:id/resume
   ↓
3. Backend chama scheduler.resumeCampaign(id)
   ↓
4. Scheduler verifica se fila existe em memória
   ↓
5. Se não existe, tenta recriar:
   - Busca campanha no banco ✓
   - Cria novo QueueManager ✓
   - Passa objeto campaign (estrutura errada) ❌
   - NÃO carrega contatos ❌
   - NÃO restaura estado (currentIndex, sentCount) ❌
   ↓
6. Chama queue.resume()
   ↓
7. queue.resume() chama processQueue()
   ↓
8. processQueue() tenta processar contacts[currentIndex]
   ↓
9. contacts está vazio OU currentIndex = 0 (recomeça do início)
   ↓
10. ERRO ou comportamento incorreto
```

## Requirements

### Requirement 1: Restauração Correta do Estado da Campanha

**User Story:** Como usuário do sistema, eu quero que ao retomar uma campanha pausada, ela continue exatamente de onde parou, sem reenviar mensagens já enviadas.

#### Acceptance Criteria

1. WHEN uma campanha pausada é retomada, THE System SHALL restaurar o índice atual de processamento (`currentIndex`) do banco de dados
2. WHEN uma campanha pausada é retomada, THE System SHALL restaurar as contagens de mensagens enviadas (`sentCount`) e falhadas (`failedCount`) do banco de dados
3. WHEN uma campanha pausada é retomada, THE System SHALL carregar apenas os contatos pendentes (status = 'pending') para processamento
4. WHEN uma campanha pausada é retomada, THE System SHALL preservar a ordem original de processamento dos contatos
5. WHEN uma campanha pausada é retomada, THE System SHALL validar que existem contatos pendentes antes de iniciar o processamento

### Requirement 2: Recriação Correta da Fila de Processamento

**User Story:** Como desenvolvedor do sistema, eu quero que a fila de processamento seja recriada corretamente após uma pausa, mesmo se o servidor reiniciar.

#### Acceptance Criteria

1. WHEN o scheduler tenta retomar uma campanha pausada, THE System SHALL verificar se a fila existe em memória
2. IF a fila não existe em memória, THEN THE System SHALL buscar os dados completos da campanha no banco de dados
3. WHEN recriando a fila, THE System SHALL transformar os dados do banco para o formato esperado pelo QueueManager
4. WHEN recriando a fila, THE System SHALL chamar o método `loadContacts()` para carregar os contatos pendentes
5. WHEN recriando a fila, THE System SHALL chamar um novo método `restoreState()` para restaurar o estado da campanha

### Requirement 3: Tratamento de Erros na Retomada

**User Story:** Como usuário do sistema, eu quero receber mensagens de erro claras quando algo der errado ao retomar uma campanha.

#### Acceptance Criteria

1. IF uma campanha não existe no banco, THEN THE System SHALL retornar erro 404 com mensagem "Campanha não encontrada"
2. IF uma campanha não está no status 'paused', THEN THE System SHALL retornar erro 400 com mensagem "Campanha não está pausada"
3. IF não há contatos pendentes para processar, THEN THE System SHALL retornar erro 400 com mensagem "Não há contatos pendentes para processar"
4. IF ocorrer erro ao carregar contatos, THEN THE System SHALL retornar erro 500 com mensagem descritiva do erro
5. IF ocorrer erro ao restaurar estado, THEN THE System SHALL registrar no log e retornar erro 500 com mensagem descritiva

### Requirement 4: Validação de Conexão WUZAPI na Retomada

**User Story:** Como usuário do sistema, eu quero que o sistema valide a conexão com o WhatsApp antes de retomar uma campanha.

#### Acceptance Criteria

1. WHEN uma campanha é retomada, THE System SHALL validar a conexão com a instância WUZAPI antes de iniciar o processamento
2. IF a conexão WUZAPI não está disponível, THEN THE System SHALL retornar erro 503 com mensagem "Instância WhatsApp não está conectada"
3. IF a validação de conexão falhar, THEN THE System SHALL manter a campanha no status 'paused'
4. WHEN a conexão é validada com sucesso, THE System SHALL registrar no log a confirmação da conexão

### Requirement 5: Persistência do Estado Durante o Processamento

**User Story:** Como usuário do sistema, eu quero que o progresso da campanha seja salvo continuamente, para que eu possa pausar e retomar sem perder o progresso.

#### Acceptance Criteria

1. WHEN um contato é processado com sucesso, THE System SHALL atualizar imediatamente o status do contato no banco de dados
2. WHEN um contato é processado com sucesso, THE System SHALL incrementar o `current_index` da campanha no banco de dados
3. WHEN um contato falha após todas as tentativas, THE System SHALL registrar o tipo de erro e mensagem no banco de dados
4. WHEN a campanha é pausada, THE System SHALL salvar o `current_index` atual no banco de dados
5. WHEN a campanha é pausada, THE System SHALL salvar o timestamp de pausa (`paused_at`) no banco de dados

### Requirement 6: Logs Detalhados para Debugging

**User Story:** Como desenvolvedor do sistema, eu quero logs detalhados do processo de retomada para facilitar o debugging de problemas.

#### Acceptance Criteria

1. WHEN uma campanha é retomada, THE System SHALL registrar no log o ID da campanha, nome e status atual
2. WHEN a fila é recriada, THE System SHALL registrar no log a quantidade de contatos carregados e o índice atual
3. WHEN o estado é restaurado, THE System SHALL registrar no log os valores de `currentIndex`, `sentCount` e `failedCount`
4. WHEN ocorrer erro na retomada, THE System SHALL registrar no log o stack trace completo do erro
5. WHEN a retomada é bem-sucedida, THE System SHALL registrar no log a confirmação de que o processamento foi retomado

### Requirement 7: Testes de Integração

**User Story:** Como desenvolvedor do sistema, eu quero testes automatizados que validem o fluxo completo de pausar e retomar campanhas.

#### Acceptance Criteria

1. THE System SHALL ter um teste que cria uma campanha, processa alguns contatos, pausa e retoma com sucesso
2. THE System SHALL ter um teste que simula reinício do servidor (limpa memória) e retoma campanha pausada
3. THE System SHALL ter um teste que valida que contatos já enviados não são reenviados na retomada
4. THE System SHALL ter um teste que valida tratamento de erro quando não há contatos pendentes
5. THE System SHALL ter um teste que valida tratamento de erro quando a conexão WUZAPI não está disponível

## Constraints

- A solução DEVE ser compatível com SQLite (não pode usar features específicas de outros bancos)
- A solução DEVE manter compatibilidade com campanhas já existentes no banco de dados
- A solução NÃO DEVE reenviar mensagens já enviadas com sucesso
- A solução DEVE funcionar mesmo após reinício do servidor
- A solução DEVE manter a performance atual (não adicionar queries desnecessárias)

## Success Criteria

A correção será considerada bem-sucedida quando:

1. ✅ Usuário consegue pausar e retomar campanha sem erro 500
2. ✅ Campanha retomada continua exatamente de onde parou
3. ✅ Contatos já enviados não são reenviados
4. ✅ Progresso é preservado após reinício do servidor
5. ✅ Mensagens de erro são claras e descritivas
6. ✅ Logs permitem debugging fácil de problemas
7. ✅ Testes automatizados validam o fluxo completo
