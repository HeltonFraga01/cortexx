# Stability Fixes V2 - Requirements Specification

## Overview
Esta especificação aborda problemas críticos de estabilidade identificados na auditoria técnica da aplicação Cortexx. Os problemas estão causando crashes do servidor, falhas de autenticação e indisponibilidade de serviços.

## Análise do Estado Atual

### ✅ Já Implementado
1. **Graceful Shutdown** - Implementado em `server/index.js` com handlers para SIGINT/SIGTERM
2. **WUZAPI Client** - Timeout de 30s já configurado, retry básico implementado
3. **Health Check** - Endpoint `/health` já verifica Supabase, WUZAPI, Redis, S3
4. **Logging Estruturado** - Logger com níveis, rotação de arquivos, métricas

### ❌ Problemas Identificados

#### P0 - Crítico

1. **Session Store em Memória**
   - **Problema**: Sessions são perdidas em cada restart do servidor
   - **Impacto**: Usuários perdem autenticação, UX degradada
   - **Localização**: `server/middleware/session.js` usa MemoryStore
   - **Solução**: Migrar para PostgreSQL session store (connect-pg-simple)

2. **EPIPE Error Handling Ausente**
   - **Problema**: Erros EPIPE em stdout/stderr causam crash
   - **Impacto**: Servidor cai quando stdout é fechado (comum em containers)
   - **Localização**: `server/utils/logger.js` não trata EPIPE
   - **Solução**: Adicionar handlers para EPIPE em stdout/stderr

3. **uncaughtException Handler Duplicado**
   - **Problema**: Handler em logger.js e index.js causam conflito
   - **Impacto**: Comportamento inconsistente em erros não capturados
   - **Localização**: `server/utils/logger.js` linha 295, `server/index.js` linha 1455
   - **Solução**: Centralizar handlers em um único local

#### P1 - Alto

4. **Circuit Breaker Ausente no WUZAPI Client**
   - **Problema**: Falhas em cascata quando WUZAPI está indisponível
   - **Impacto**: Todas as requisições falham, timeout longo
   - **Localização**: `server/utils/wuzapiClient.js`
   - **Solução**: Implementar circuit breaker pattern

5. **Retry Logic Incompleto**
   - **Problema**: Retry não implementado com exponential backoff
   - **Impacto**: Falhas temporárias não são recuperadas
   - **Localização**: `server/utils/wuzapiClient.js`
   - **Solução**: Adicionar retry com backoff exponencial

## User Stories

### US-001: Session Persistence
**Como** administrador do sistema  
**Quero** que as sessões dos usuários persistam entre restarts do servidor  
**Para que** os usuários não percam seu estado de autenticação

#### Critérios de Aceitação
- [ ] Sessões são armazenadas em PostgreSQL via Supabase
- [ ] Sessões sobrevivem a restarts do servidor
- [ ] Limpeza automática de sessões expiradas
- [ ] Tabela de sessões criada com índices apropriados
- [ ] Configuração existente de cookies preservada

### US-002: EPIPE Error Handling
**Como** operador do sistema  
**Quero** que o servidor trate erros EPIPE graciosamente  
**Para que** a aplicação não crashe quando stdout é fechado

#### Critérios de Aceitação
- [ ] Erros EPIPE em stdout são capturados e tratados
- [ ] Servidor faz shutdown gracioso em vez de crash
- [ ] Erro é logado antes do shutdown (se possível)
- [ ] Nenhuma perda de dados durante shutdown gracioso

### US-003: WUZAPI Connection Resilience
**Como** operador do sistema  
**Quero** que conexões WUZAPI sejam resilientes a timeouts  
**Para que** funcionalidade WhatsApp permaneça disponível durante problemas de rede

#### Critérios de Aceitação
- [ ] Circuit breaker implementado para prevenir falhas em cascata
- [ ] Retry logic com exponential backoff implementado
- [ ] Conexões falhas são logadas com contexto
- [ ] Estado do circuit breaker exposto no health check

### US-004: Error Handler Consolidation
**Como** desenvolvedor  
**Quero** handlers de erro centralizados  
**Para que** o comportamento seja consistente em toda a aplicação

#### Critérios de Aceitação
- [ ] Único handler para uncaughtException
- [ ] Único handler para unhandledRejection
- [ ] Handlers removidos de locais duplicados
- [ ] Logging consistente para todos os erros

## Requisitos Técnicos

### TR-001: Database Session Store
- Usar pacote `connect-pg-simple` para armazenamento de sessões em PostgreSQL
- Criar tabela `user_sessions` com schema apropriado
- Configurar limpeza automática de sessões (pruning)
- Manter compatibilidade com dados de sessão existentes

### TR-002: Error Handling Infrastructure
- Implementar handlers globais para exceções não capturadas
- Adicionar handlers de sinal de processo (SIGTERM, SIGINT)
- Implementar shutdown gracioso com draining de conexões
- Adicionar logging estruturado para todos os cenários de erro

### TR-003: External Service Resilience
- Implementar circuit breaker pattern
- Configurar políticas de retry com exponential backoff
- Adicionar configuração de timeout por serviço
- Implementar respostas de fallback onde apropriado

## Ordem de Prioridade

1. **P0 (Crítico)**: US-001 Session Persistence - Bloqueando acesso de usuários
2. **P0 (Crítico)**: US-002 EPIPE Error Handling - Causando crashes
3. **P1 (Alto)**: US-003 WUZAPI Resilience - Afetando features WhatsApp
4. **P1 (Alto)**: US-004 Error Handler Consolidation - Comportamento inconsistente

## Dependências

### Novos Pacotes Necessários
- `connect-pg-simple`: PostgreSQL session store

### Pacotes Existentes a Verificar
- `@supabase/supabase-js`: Garantir compatibilidade v2.x
- `express-session`: Compatibilidade com versão atual
- `pg`: Já instalado

## Arquivos a Modificar

### Session Persistence
- `server/middleware/session.js` - Configuração principal de sessão

### Error Handling
- `server/utils/logger.js` - Tratamento EPIPE, remover handlers duplicados
- `server/index.js` - Manter handlers centralizados

### WUZAPI Resilience
- `server/utils/wuzapiClient.js` - Circuit breaker e retry config

## Métricas de Sucesso

- Zero crashes relacionados a EPIPE em 24 horas
- Persistência de sessão em 10 restarts consecutivos
- Erros de timeout WUZAPI reduzidos em 80%
- Tempo de resposta do health check < 500ms
- Nenhum erro de "sessão corrompida" nos logs

## Plano de Rollback

Se problemas surgirem:
1. Reverter session store para MemoryStore (temporário)
2. Desabilitar circuit breaker se causar problemas
3. Restaurar valores originais de timeout
4. Manter migração de banco de dados (não destrutiva)
