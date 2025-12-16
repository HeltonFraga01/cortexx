# Design Document: Container Restart Policy Fix

## Overview

Este documento descreve a solução para corrigir a política de reinício do container Docker do WUZAPI Manager. O problema atual é que o container não reinicia automaticamente após receber SIGTERM, causando indisponibilidade do serviço.

A solução envolve:
1. Alterar a restart policy de `on-failure` para `any`
2. Remover limite de `max_attempts`
3. Aumentar resiliência do healthcheck
4. Melhorar logging de shutdown/startup

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Docker Swarm                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Restart Policy (condition: any)          │   │
│  │  - Reinicia em qualquer terminação                    │   │
│  │  - Sem limite de tentativas                           │   │
│  │  - Delay de 5s entre reinícios                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Healthcheck (resiliente)                 │   │
│  │  - 5 retries antes de marcar unhealthy               │   │
│  │  - 90s start_period                                   │   │
│  │  - 30s interval, 10s timeout                          │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WUZAPI Manager Container                 │   │
│  │  - Graceful shutdown handler                          │   │
│  │  - Startup logging com restart info                   │   │
│  │  - Signal logging (SIGTERM, SIGINT)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Docker Compose Swarm Configuration

**Arquivo:** `docker-compose.swarm.yml`

**Mudanças na restart_policy:**
```yaml
restart_policy:
  condition: any          # Antes: on-failure
  delay: 5s
  # max_attempts removido  # Antes: max_attempts: 3
  window: 120s
```

**Mudanças no healthcheck:**
```yaml
healthcheck:
  test: ["CMD", "node", "server/healthcheck.js"]
  interval: 30s
  timeout: 10s
  retries: 5              # Antes: 3
  start_period: 90s       # Antes: 60s
```

### 2. Healthcheck Script Enhancement

**Arquivo:** `server/healthcheck.js`

Melhorias:
- Timeout mais tolerante
- Logging mais detalhado
- Retry interno antes de falhar

### 3. Shutdown Handler Enhancement

**Arquivo:** `server/index.js`

Melhorias:
- Log do tipo de sinal recebido
- Log da duração do shutdown
- Log de informações de restart no startup

## Data Models

Não há mudanças em modelos de dados. As alterações são apenas em configuração e logging.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Baseado na análise de prework, a maioria dos critérios de aceitação são verificações de configuração (examples) e não propriedades universais. No entanto, podemos definir uma propriedade importante:

### Property 1: Restart Policy Configuration Validity

*For any* Docker Compose Swarm configuration file, if it defines a restart_policy for the wuzapi-manager service, then the condition MUST be "any" and max_attempts MUST NOT be defined or MUST be greater than 100.

**Validates: Requirements 1.4, 2.1, 2.2**

### Property 2: Healthcheck Resilience Configuration

*For any* Docker Compose Swarm configuration file, if it defines a healthcheck for the wuzapi-manager service, then retries MUST be >= 5 and start_period MUST be >= 90s.

**Validates: Requirements 3.1, 3.2**

## Error Handling

### Shutdown Handling

1. **SIGTERM recebido:**
   - Log do sinal e timestamp
   - Iniciar shutdown gracioso
   - Fechar conexões HTTP
   - Fechar conexão SQLite
   - Log da duração total do shutdown
   - Exit code 0 (sucesso)

2. **SIGINT recebido:**
   - Mesmo comportamento do SIGTERM
   - Log indicando interrupção manual

3. **Crash/Exception não tratada:**
   - Log do erro
   - Exit code 1 (falha)
   - Docker reinicia automaticamente

### Startup Handling

1. **Container reiniciado:**
   - Tentar ler informações do restart anterior (se disponível)
   - Log do número de reinícios (via Docker API ou env var)
   - Log do exit code anterior (se disponível)

## Testing Strategy

### Testes de Configuração (Examples)

Verificar que os arquivos de configuração estão corretos:

1. **Restart Policy Test:**
   - Parsear `docker-compose.swarm.yml`
   - Verificar `restart_policy.condition === 'any'`
   - Verificar `restart_policy.max_attempts` não existe ou > 100

2. **Healthcheck Test:**
   - Parsear `docker-compose.swarm.yml`
   - Verificar `healthcheck.retries >= 5`
   - Verificar `healthcheck.start_period >= 90s`

### Testes de Integração (Manual)

1. **SIGTERM Restart Test:**
   - Deploy do stack
   - Enviar SIGTERM ao container
   - Verificar que reinicia automaticamente

2. **Crash Restart Test:**
   - Deploy do stack
   - Forçar crash do processo
   - Verificar que reinicia automaticamente

### Property-Based Testing

Usar Vitest com fast-check para validar configurações:

```typescript
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import yaml from 'js-yaml'
import fs from 'fs'

describe('Docker Compose Configuration Properties', () => {
  // Property 1: Restart Policy Validity
  it('should have valid restart policy', () => {
    const config = yaml.load(fs.readFileSync('docker-compose.swarm.yml', 'utf8'))
    const restartPolicy = config.services['wuzapi-manager'].deploy.restart_policy
    
    expect(restartPolicy.condition).toBe('any')
    expect(restartPolicy.max_attempts).toBeUndefined()
  })

  // Property 2: Healthcheck Resilience
  it('should have resilient healthcheck', () => {
    const config = yaml.load(fs.readFileSync('docker-compose.swarm.yml', 'utf8'))
    const healthcheck = config.services['wuzapi-manager'].healthcheck
    
    expect(healthcheck.retries).toBeGreaterThanOrEqual(5)
    // Parse start_period (e.g., "90s" -> 90)
    const startPeriod = parseInt(healthcheck.start_period)
    expect(startPeriod).toBeGreaterThanOrEqual(90)
  })
})
```

### Framework de Testes

- **Unit/Property Tests:** Vitest + fast-check
- **Integration Tests:** Manual via Docker commands
- **Configuration Validation:** YAML parsing tests
