# Design Document: Production Cleanup

## Overview

Este documento descreve a arquitetura e abordagem para limpeza e preparação do WUZAPI Manager para produção. O trabalho envolve remoção de código de debug, consolidação de documentação, e validação final do sistema.

## Architecture

A limpeza será executada em fases sequenciais para minimizar riscos:

```
┌─────────────────────────────────────────────────────────────┐
│                    FASE 1: ANÁLISE                          │
│  - Identificar console.log no backend/frontend              │
│  - Mapear testes duplicados                                 │
│  - Listar documentação redundante                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASE 2: LIMPEZA                          │
│  - Substituir console.log por logger (backend)              │
│  - Envolver console.log em IS_DEVELOPMENT (frontend)        │
│  - Consolidar testes duplicados                             │
│  - Remover código comentado                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASE 3: DOCUMENTAÇÃO                     │
│  - Consolidar docs redundantes                              │
│  - Atualizar INDEX.md                                       │
│  - Limpar release notes antigas                             │
│  - Atualizar specs                                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASE 4: VALIDAÇÃO                        │
│  - Executar testes                                          │
│  - Verificar build                                          │
│  - Testar Docker                                            │
│  - Atualizar status de produção                             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Logging

**Arquivo:** `server/utils/logger.js`

O logger estruturado já existe e deve ser usado em vez de console.log:

```javascript
const logger = require('../utils/logger');

// Em vez de:
console.log('Mensagem');

// Usar:
logger.info('Mensagem', { context: 'value' });
logger.debug('Debug info', { data });
logger.error('Erro', { error: error.message });
```

### Frontend Development Check

**Padrão:** Usar `IS_DEVELOPMENT` para logs condicionais

```typescript
const IS_DEVELOPMENT = import.meta.env.DEV;

// Em vez de:
console.log('Debug info');

// Usar:
if (IS_DEVELOPMENT) {
  console.log('Debug info');
}
```

### Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `server/routes/index.js` | Substituir console.log por logger |
| `src/services/contactsStorageService.ts` | Remover ou envolver em IS_DEVELOPMENT |
| `src/services/database-connections.ts` | Envolver em IS_DEVELOPMENT |
| `src/services/contactImportService.ts` | Remover logs de debug |
| `src/pages/PublicHome.tsx` | Remover logs de debug |

## Data Models

Não há mudanças em modelos de dados - este é um trabalho de limpeza de código.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Frontend console.log wrapped in development check

*For any* console.log call in frontend service files (`src/services/*.ts`), the call should be wrapped in an `IS_DEVELOPMENT` conditional check.

**Validates: Requirements 2.1, 2.2**

### Property 2: No commented code blocks

*For any* source file in `server/` or `src/`, there should be no large blocks (>5 lines) of commented-out code.

**Validates: Requirements 6.1**

### Property 3: No unused imports

*For any* TypeScript file in `src/`, all imports should be used in the file.

**Validates: Requirements 6.4**

## Error Handling

A limpeza não deve introduzir erros. Estratégias de mitigação:

1. **Backup implícito**: Git preserva todo histórico
2. **Testes**: Executar suite completa após cada fase
3. **Build verification**: Verificar build após mudanças
4. **Rollback**: Commits atômicos permitem reverter facilmente

## Testing Strategy

### Abordagem Dual

**Unit Tests:**
- Verificar que logger é chamado corretamente após substituição
- Verificar que IS_DEVELOPMENT check funciona

**Property-Based Tests:**
- Não aplicável para este trabalho de limpeza (é principalmente verificação estática)

### Verificações Manuais

1. **Grep verification**: Buscar console.log após limpeza
2. **Lint check**: Executar ESLint para imports não usados
3. **Build check**: `npm run build` deve completar sem erros
4. **Test suite**: `npm run test:run` deve passar

### Comandos de Validação

```bash
# Verificar console.log no backend (excluindo testes e scripts)
grep -r "console.log" server/ --include="*.js" | grep -v "test" | grep -v "scripts"

# Verificar console.log no frontend (deve estar em IS_DEVELOPMENT)
grep -r "console.log" src/ --include="*.ts" --include="*.tsx"

# Executar testes
npm run test:run

# Verificar build
npm run build

# Verificar Docker
docker build -t wuzapi-manager:test .
```
