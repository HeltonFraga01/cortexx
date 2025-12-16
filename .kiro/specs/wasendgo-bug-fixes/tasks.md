# Implementation Plan

## Fase 1 - Segurança de Credenciais (Crítico)

- [x] 1. Criar sistema de configuração de ambiente
  - [x] 1.1 Criar src/lib/env-config.ts com carregamento e validação de variáveis de ambiente
    - Implementar função loadEnvConfig() que lê todas as variáveis VITE_*
    - Implementar função validateConfig() que valida tokens não-vazios
    - Lançar erros descritivos para credenciais ausentes
    - _Requirements: 1.1, 1.4, 1.5_
  - [ ]* 1.2 Write property test for credential loading and validation
    - **Property 1: Credential loading and validation**
    - **Validates: Requirements 1.1, 1.2, 1.4, 1.5**
  - [x] 1.3 Remover token hardcoded de src/services/nocodb.ts
    - Substituir token hardcoded por import de env-config
    - Usar loadEnvConfig().nocodbToken
    - _Requirements: 1.1_
  - [x] 1.4 Corrigir token vazio em src/services/wuzapi.ts
    - Substituir this.adminToken = '' por carregamento de env
    - Validar token antes de usar
    - _Requirements: 1.2_
  - [x] 1.5 Atualizar docker-compose-swarm.yaml para usar secrets
    - Remover POSTGRES_PASSWORD hardcoded
    - Configurar Docker secrets para credenciais
    - Atualizar .env.docker.example com variáveis necessárias
    - _Requirements: 1.3_
  - [x] 1.6 Atualizar arquivos .env.example com todas as variáveis necessárias
    - Adicionar VITE_NOCODB_TOKEN, VITE_ADMIN_TOKEN
    - Documentar formato esperado de cada variável
    - _Requirements: 1.1, 1.2_

- [x] 2. Checkpoint - Verificar credenciais
  - Ensure all tests pass, ask the user if questions arise.

## Fase 2 - Configuração CORS

- [x] 3. Implementar configuração CORS flexível
  - [x] 3.1 Criar server/middleware/cors.js com suporte a múltiplas origens
    - Implementar parsing de origens separadas por vírgula
    - Configurar headers CORS apropriados
    - Rejeitar origens não permitidas com 403
    - Defaults: restritivo em produção, permissivo em desenvolvimento
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [ ]* 3.2 Write property test for CORS configuration consistency
    - **Property 2: CORS configuration consistency**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  - [x] 3.3 Atualizar .env.example com VITE_CORS_ALLOWED_ORIGINS
    - Documentar formato comma-separated
    - Adicionar exemplos para múltiplos domínios
    - _Requirements: 2.1_

## Fase 3 - Gerenciamento de Memória

- [x] 4. Criar utilitários de gerenciamento de memória
  - [x] 4.1 Criar src/hooks/useCleanup.ts para cleanup de timers
    - Implementar tracking de setTimeout/setInterval
    - Implementar cleanup automático no unmount
    - Implementar tracking de subscriptions
    - _Requirements: 3.2, 3.3_
  - [ ]* 4.2 Write property test for memory management consistency
    - **Property 3: Memory management consistency**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  - [x] 4.3 Criar src/lib/storage-manager.ts para localStorage com limites
    - Implementar StorageManager com TTL
    - Implementar evição LRU quando limite é atingido
    - Implementar getSize() para monitoramento
    - Limite padrão: 5MB
    - _Requirements: 3.1, 3.4_
  - [x] 4.4 Refatorar componentes com memory leaks identificados
    - Identificar componentes com setInterval/setTimeout não limpos
    - Aplicar useCleanup hook
    - Substituir localStorage direto por StorageManager
    - _Requirements: 3.2, 3.3_

- [x] 5. Checkpoint - Verificar memory management
  - Ensure all tests pass, ask the user if questions arise.

## Fase 4 - Configuração SQLite

- [x] 6. Corrigir configuração do banco de dados
  - [x] 6.1 Atualizar server/database.js com configurações WAL robustas
    - Configurar PRAGMA journal_mode = WAL
    - Configurar PRAGMA synchronous = NORMAL
    - Configurar PRAGMA busy_timeout = 5000
    - Configurar PRAGMA foreign_keys = ON
    - _Requirements: 4.1_
  - [ ]* 6.2 Write property test for database reliability
    - **Property 4: Database reliability**
    - **Validates: Requirements 4.2, 4.3, 4.4**
  - [x] 6.3 Criar migration para tabela database_connections
    - Criar server/migrations/001_create_database_connections.js
    - Implementar criação automática da tabela se não existir
    - _Requirements: 4.2_
  - [x] 6.4 Implementar retry logic para operações de banco
    - Adicionar retry com exponential backoff para SQLITE_BUSY
    - Configurar máximo de 3 tentativas
    - _Requirements: 4.3_

## Fase 5 - Timeout e Rate Limiting

- [x] 7. Implementar timeout e rate limiting
  - [x] 7.1 Atualizar server/utils/wuzapiClient.js com timeout configurável
    - Adicionar timeout padrão de 30 segundos
    - Implementar interceptor para logging de timeouts
    - Permitir timeout customizado por requisição
    - _Requirements: 5.1, 5.2_
  - [ ]* 7.2 Write property test for request timeout and rate limiting
    - **Property 5: Request timeout and rate limiting**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
  - [x] 7.3 Criar server/middleware/rateLimiter.js
    - Implementar rate limiter com express-rate-limit
    - Criar limiters específicos: apiLimiter, authLimiter, wuzapiLimiter
    - Retornar 429 com retry-after header
    - Logar rate limit exceeded com contexto
    - _Requirements: 5.3, 5.4_
  - [x] 7.4 Aplicar rate limiter nas rotas apropriadas
    - Aplicar authLimiter em rotas de autenticação
    - Aplicar wuzapiLimiter em rotas que chamam WuzAPI
    - Aplicar apiLimiter como default
    - _Requirements: 5.3_

- [x] 8. Checkpoint - Verificar timeout e rate limiting
  - Ensure all tests pass, ask the user if questions arise.

## Fase 6 - Cache com Expiração

- [x] 9. Implementar cache com TTL
  - [x] 9.1 Criar src/lib/cache.ts com TTLCache class
    - Implementar set() com TTL configurável
    - Implementar get() com verificação de expiração
    - Implementar evição LRU quando maxSize é atingido
    - Implementar cleanup interval para entradas expiradas
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  - [ ]* 9.2 Write property test for cache TTL and eviction
    - **Property 6: Cache TTL and eviction**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
  - [x] 9.3 Refatorar src/services/database-connections.ts para usar TTLCache
    - Substituir cache sem expiração por TTLCache
    - Configurar TTL apropriado (5 minutos default)
    - Resolver race condition identificada
    - _Requirements: 6.1, 6.2_

## Fase 7 - Tratamento de Erros

- [x] 10. Implementar tratamento de erros consistente
  - [x] 10.1 Criar server/utils/errorHandler.js
    - Implementar sanitizeError() para remover dados sensíveis
    - Implementar handleError() com logging estruturado
    - Padrões sensíveis: token, password, secret, api_key
    - _Requirements: 7.1, 7.2_
  - [ ]* 10.2 Write property test for error sanitization
    - **Property 7: Error sanitization**
    - **Validates: Requirements 7.2**
  - [x] 10.3 Remover console.log verbosos de src/lib/api.ts
    - Remover logs de request/response em produção
    - Substituir por logger condicional baseado em NODE_ENV
    - _Requirements: 7.3_
  - [x] 10.4 Atualizar src/services/database-connections.ts com error handling
    - Aplicar sanitizeError em mensagens de erro
    - Adicionar contexto estruturado aos logs
    - _Requirements: 7.1, 7.2_

- [x] 11. Checkpoint - Verificar error handling
  - Ensure all tests pass, ask the user if questions arise.

## Fase 8 - Gerenciamento de Conexões

- [x] 12. Implementar gerenciamento de conexões
  - [x] 12.1 Atualizar server/database.js com connection tracking
    - Implementar tracking de conexões abertas
    - Implementar close() para cleanup
    - Implementar retry com exponential backoff
    - _Requirements: 8.1, 8.2, 8.3_
  - [ ]* 12.2 Write property test for connection lifecycle management
    - **Property 8: Connection lifecycle management**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  - [x] 12.3 Corrigir conexões não fechadas em src/services/database-connections.ts
    - Garantir que conexões são fechadas após uso
    - Implementar connection pooling se necessário
    - _Requirements: 8.2_
  - [x] 12.4 Implementar cleanup de sessões em src/lib/api.ts
    - Adicionar cleanup automático de sessões expiradas
    - Implementar interval para verificação periódica
    - _Requirements: 8.4_

## Fase 9 - Polling Otimizado

- [x] 13. Implementar polling adaptativo
  - [x] 13.1 Criar src/lib/adaptive-polling.ts
    - Implementar AdaptivePoller class
    - Aumentar intervalo quando inativo (até 5 minutos)
    - Diminuir intervalo quando ativo (mínimo 10 segundos)
    - Pausar quando tab não está visível
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [ ]* 13.2 Write property test for adaptive polling
    - **Property 9: Adaptive polling**
    - **Validates: Requirements 9.1, 9.2, 9.3**
  - [x] 13.3 Refatorar polling em src/lib/api.ts
    - Substituir setInterval fixo por AdaptivePoller
    - Aplicar em processScheduledMessages
    - _Requirements: 9.1_

- [x] 14. Checkpoint - Verificar polling
  - Ensure all tests pass, ask the user if questions arise.

## Fase 10 - Validação de Dados

- [x] 15. Implementar validação de dados robusta
  - [x] 15.1 Criar server/validators/commonValidator.js
    - Implementar validação de tipos comuns
    - Implementar sanitização contra injection
    - Retornar erros descritivos
    - _Requirements: 10.1, 10.2, 10.3_
  - [ ]* 15.2 Write property test for input validation
    - **Property 10: Input validation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  - [x] 15.3 Aplicar validação em src/lib/api.ts
    - Validar parâmetros antes de processar
    - Retornar 400 para tipos incorretos
    - _Requirements: 10.1, 10.4_

## Fase 11 - Type Safety

- [x] 16. Melhorar type safety
  - [x] 16.1 Corrigir tipo genérico em src/lib/wuzapi-client.ts
    - Substituir any implícito por tipos explícitos
    - Criar interfaces para responses
    - _Requirements: 11.1_
  - [ ]* 16.2 Write property test for runtime type safety
    - **Property 11: Runtime type safety**
    - **Validates: Requirements 11.2, 11.3**
  - [x] 16.3 Adicionar type guards em src/services/wuzapi.ts
    - Implementar type guards para validação runtime
    - Corrigir formatação inconsistente (Connected vs connected)
    - _Requirements: 11.2, 11.3_

## Fase 12 - Atualização de Dependências

- [x] 17. Atualizar dependências vulneráveis
  - [x] 17.1 Executar npm audit e atualizar pacotes críticos
    - Atualizar axios para versão mais recente
    - Atualizar react para versão mais recente
    - Verificar compatibilidade após atualizações
    - _Requirements: 12.1, 12.2_
  - [x] 17.2 Atualizar package.json com versões seguras
    - Documentar breaking changes se houver
    - Atualizar package-lock.json
    - _Requirements: 12.1_

- [x] 18. Final Checkpoint - Verificar todas as correções
  - Ensure all tests pass, ask the user if questions arise.
