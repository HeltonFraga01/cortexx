# Design Document: Legacy Cleanup & Documentation Update

## Overview

Este documento descreve o design para a limpeza completa de código legado relacionado ao SQLite e atualização de toda documentação para refletir a arquitetura atual do WUZAPI Manager, que agora utiliza Supabase (PostgreSQL) como banco de dados e inclui integração com Stripe para pagamentos.

### Objetivos

1. **Eliminar confusão**: Remover todas as referências a tecnologias obsoletas
2. **Manter consistência**: Garantir que código, documentação e configurações estejam alinhados
3. **Facilitar onboarding**: Novos desenvolvedores devem encontrar informações precisas
4. **Preservar histórico**: Manter arquivos arquivados como referência histórica

### Escopo

- Código fonte (frontend e backend)
- Steering files (`.kiro/steering/`)
- Documentação (`docs/`)
- Arquivos de configuração (`.env`, Docker, GitHub workflows)
- Specs (`.kiro/specs/`)
- Tipos TypeScript

## Architecture

### Estado Atual vs Estado Desejado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ESTADO ATUAL                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Código     │     │  Documentação │     │  Configuração │                │
│  │  (Misto)     │     │  (Desatualizada)│   │  (Obsoleta)   │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Referências SQLite + Supabase + Stripe (inconsistente)      │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ESTADO DESEJADO                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │   Código     │     │  Documentação │     │  Configuração │                │
│  │  (Limpo)     │     │  (Atualizada) │     │  (Correta)    │                │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘                │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌──────────────────────────────────────────────────────────────┐          │
│  │  Apenas Supabase + Stripe (consistente)                      │          │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Arquitetura Atual do Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         WUZAPI Manager (Atual)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Frontend (React 18 + TypeScript + Vite)                                    │
│  ├── src/components/  (admin, user, shared, features)                       │
│  ├── src/services/    (API clients, Supabase client)                        │
│  └── src/types/       (TypeScript definitions)                              │
│                                                                              │
│  Backend (Node.js + Express + Supabase)                                     │
│  ├── server/routes/   (HTTP endpoints)                                      │
│  ├── server/services/ (SupabaseService, StripeService, etc.)               │
│  └── server/database.js (Compatibility layer → SupabaseService)            │
│                                                                              │
│  External Services                                                           │
│  ├── Supabase (PostgreSQL + Auth + Realtime)                               │
│  ├── Stripe (Payments, Subscriptions)                                       │
│  ├── WUZAPI (WhatsApp Business API)                                         │
│  └── NocoDB (External Database Integration)                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Arquivos a Serem Modificados

#### 1.1 Código Fonte

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/services/database-connections.ts` | Modificar | Remover tipo 'SQLITE' e método `testSQLiteConnection` |
| `src/lib/types.ts` | Modificar | Remover 'SQLITE' do union type |
| `src/components/admin/AdminDatabases.tsx` | Modificar | Remover menção a SQLite na UI |
| `src/components/user/GenericTableView.README.md` | Modificar | Atualizar descrição |
| `src/test/templates/factory.js` | Modificar | Atualizar tipo de conexão padrão |
| `src/test/templates/README.md` | Modificar | Remover referência a SQLITE_DB_PATH |
| `server/database.js` | Modificar | Remover métodos SQLite obsoletos |

#### 1.2 Steering Files

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.kiro/steering/tech.md` | Atualizar | Stack atual com Supabase e Stripe |
| `.kiro/steering/structure.md` | Atualizar | Estrutura de diretórios atual |
| `.kiro/steering/project-overview.md` | Atualizar | Visão geral com novas integrações |
| `.kiro/steering/product.md` | Atualizar | Contexto do produto com pagamentos |
| `.kiro/steering/coding-standards.md` | Verificar | Padrões de código atuais |
| `.kiro/steering/frontend-guidelines.md` | Verificar | Guidelines do frontend |
| `.kiro/steering/backend-guidelines.md` | Atualizar | Remover referências SQLite |
| `.kiro/steering/docker-deployment.md` | Atualizar | Configurações Supabase |
| `.kiro/steering/stack_docker_Swarm.yaml.md` | Atualizar | Remover config SQLite |

#### 1.3 Documentação

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `docs/DOCKER_DATABASE_CONFIG.md` | Atualizar | Configuração Supabase |
| `VERIFICACOES_ADICIONAIS.md` | Atualizar | Remover referências SQLite |
| Outros docs com SQLite | Atualizar | Conforme necessário |

#### 1.4 Configuração

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.env.example` | Atualizar | Remover nota sobre SQLite |
| `.vscode/extensions.json` | Atualizar | Remover extensões SQLite |
| `.github/workflows/docker-multiarch.yml` | Atualizar | Remover tags sqlite-* |

#### 1.5 Specs

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `.kiro/specs/branding-system/README.md` | Atualizar | Mudar SQLite para Supabase |
| `.kiro/specs/container-restart-policy/design.md` | Atualizar | Remover menção SQLite |
| Outras specs com SQLite | Atualizar | Conforme necessário |

### 2. Arquivos a Serem Criados

| Arquivo | Descrição |
|---------|-----------|
| `server/migrations-sqlite-archived/ARCHIVED_README.md` | Explicação do histórico |
| `docs/STRIPE_INTEGRATION.md` | Documentação do sistema de pagamentos |

### 3. Arquivos a Serem Preservados (Histórico)

| Arquivo/Pasta | Motivo |
|---------------|--------|
| `server/migrations-sqlite-archived/` | Referência histórica das migrações |
| `docs/archived/database-sqlite.js.bak` | Backup histórico |

## Data Models

### Tipos TypeScript Atualizados

```typescript
// src/lib/types.ts - ANTES
interface DatabaseConnection {
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  // ...
}

// src/lib/types.ts - DEPOIS
interface DatabaseConnection {
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API';
  // ...
}
```

```typescript
// src/services/database-connections.ts - ANTES
export interface DatabaseConnection {
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  // ...
}

// src/services/database-connections.ts - DEPOIS
export interface DatabaseConnection {
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API';
  // ...
}
```

### Variáveis de Ambiente

```bash
# REMOVIDAS (obsoletas)
SQLITE_DB_PATH
SQLITE_WAL_MODE
SQLITE_TIMEOUT
SQLITE_CACHE_SIZE
SQLITE_SYNCHRONOUS
SQLITE_JOURNAL_MODE

# MANTIDAS (atuais)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

Após análise do prework, a maioria dos critérios de aceitação são verificações pontuais (examples) que confirmam remoção ou atualização de arquivos específicos. A única propriedade universal identificada é:

**Propriedade consolidada**: Após a limpeza, nenhum arquivo de produção (exceto arquivados) deve conter referências a SQLite.

### Properties

**Property 1: Ausência de referências SQLite em código de produção**

*For any* arquivo no projeto (excluindo `server/migrations-sqlite-archived/`, `docs/archived/`, e `.kiro/specs/_archived/`), o conteúdo do arquivo não deve conter as strings 'sqlite', 'SQLite', ou 'SQLITE' em contexto de código ou configuração ativa.

**Validates: Requirements 9.1**

**Property 2: Consistência de tipos de conexão**

*For any* interface ou tipo que define `DatabaseConnection`, o campo `type` deve ser um union type que inclui apenas 'POSTGRES', 'MYSQL', 'NOCODB', e 'API' (sem 'SQLITE').

**Validates: Requirements 7.1, 7.2**

## Error Handling

### Estratégia de Rollback

1. **Antes de modificações**: Criar branch de backup
2. **Durante modificações**: Commits incrementais por categoria
3. **Após modificações**: Executar testes para validar

### Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebra de funcionalidade | Executar testes após cada modificação |
| Remoção acidental de código necessário | Revisar cada remoção cuidadosamente |
| Documentação incompleta | Checklist de verificação final |

## Testing Strategy

### Abordagem Dual de Testes

#### Unit Tests

- Verificar que tipos TypeScript compilam sem erros após remoção de 'SQLITE'
- Verificar que serviços funcionam sem métodos SQLite removidos

#### Property-Based Tests

- **Framework**: Vitest com busca de arquivos
- **Propriedade 1**: Buscar recursivamente por termos SQLite em arquivos de produção
- **Propriedade 2**: Validar que interfaces não contêm tipo SQLITE

### Validação Manual

1. **Busca por termos obsoletos**:
   ```bash
   grep -r "sqlite\|SQLite\|SQLITE" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.md" --exclude-dir=migrations-sqlite-archived --exclude-dir=archived --exclude-dir=_archived
   ```

2. **Execução de testes existentes**:
   ```bash
   npm run test:run
   cd server && npm test
   ```

3. **Build de produção**:
   ```bash
   npm run build
   ```

### Checklist de Validação Final

- [ ] Nenhuma referência SQLite em código de produção
- [ ] Tipos TypeScript compilam sem erros
- [ ] Testes unitários passam
- [ ] Build de produção funciona
- [ ] Documentação atualizada e consistente
- [ ] Steering files refletem arquitetura atual
