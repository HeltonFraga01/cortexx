---
inclusion: always
---

# Estrutura do Projeto & Organização de Arquivos

## Estrutura de Diretórios

**Frontend (`src/`):**
```
src/
├── components/
│   ├── admin/          # UI exclusiva para admin
│   ├── user/           # UI exclusiva para usuário
│   ├── shared/         # UI compartilhada (cards, forms, lists)
│   ├── features/       # Lógica de domínio (messaging, webhooks, integrations)
│   ├── ui/             # Primitivos shadcn/ui (NUNCA modificar/adicionar aqui)
│   └── ui-custom/      # Componentes shadcn estendidos
├── pages/              # Componentes de rota
├── services/           # Clientes API (api-client, nocodb, wuzapi)
├── hooks/              # Hooks React customizados
├── contexts/           # Provedores de estado global
├── types/              # Definições TypeScript
└── lib/                # Utilitários
```

**Backend (`server/`):**
```
server/
├── routes/             # Endpoints HTTP (admin*, user*, public*)
├── middleware/         # Processamento de requisições (auth, csrf, rateLimiter)
├── validators/         # Validação de entrada
├── services/           # Lógica de negócio
├── utils/              # Utilitários compartilhados (logger, wuzapiClient)
├── migrations/         # Mudanças de schema DB (executam automaticamente no startup)
└── database.js         # Abstração DB (SEMPRE use este)
```

## Convenções de Nomenclatura

| Tipo | Padrão | Localização | Exemplo |
|------|--------|-------------|---------|
| Componente React | `PascalCase.tsx` | `src/components/` | `UserDashboard.tsx` |
| Hook React | `useCamelCase.ts` | `src/hooks/` | `useAuth.ts` |
| Serviço Frontend | `kebab-case.ts` | `src/services/` | `api-client.ts` |
| Rota Backend | `camelCaseRoutes.js` | `server/routes/` | `adminRoutes.js` |
| Serviço Backend | `PascalCaseService.js` | `server/services/` | `UserRecordService.js` |
| Utilitário Backend | `camelCase.js` | `server/utils/` | `logger.js` |
| Validador | `camelCaseValidator.js` | `server/validators/` | `messageValidator.js` |
| Arquivo de Teste | `[filename].test.[ext]` | Adjacente ao fonte | `auth.test.js` |
| Diretório | `kebab-case` | Todos | `ui-custom/` |

## Posicionamento de Arquivos por Função

**Rotas backend (aplicação de autenticação):**
- `server/routes/admin[Feature]Routes.js` → Token admin, acesso total aos dados
- `server/routes/user[Feature]Routes.js` → Token usuário, escopo limitado ao usuário
- `server/routes/public[Feature]Routes.js` → Sem autenticação

**Componentes frontend (visibilidade UI):**
- `src/components/admin/[Feature].tsx` → Apenas admin
- `src/components/user/[Feature].tsx` → Apenas usuário
- `src/components/shared/[Component].tsx` → UI compartilhada
- `src/components/features/[domain]/[Component].tsx` → Lógica de domínio
- `src/components/ui/[component].tsx` → shadcn/ui (**NUNCA criar aqui**)
- `src/components/ui-custom/[Component].tsx` → shadcn estendido

**Outros arquivos:**
- `src/services/[feature].ts` → Clientes API frontend
- `server/services/[Feature]Service.js` → Lógica de negócio backend
- `server/validators/[feature]Validator.js` → Validação de entrada
- `src/types/[feature].ts` → Interfaces TypeScript
- `src/hooks/use[Feature].ts` → Hooks React reutilizáveis

## Sequência de Implementação de Features

**Siga esta ordem para novas funcionalidades:**

1. **Rota Backend** (`server/routes/[feature]Routes.js`)
   - Definir endpoints com middleware de autenticação
   - Adicionar try-catch + logger + respostas consistentes
   - Registrar em `server/routes/index.js`

2. **Validador** (`server/validators/[feature]Validator.js`)
   - Criar funções de validação
   - Exportar para uso nas rotas

3. **Serviço** (`server/services/[Feature]Service.js`)
   - Extrair lógica complexa das rotas
   - Usar abstração `database.js`

4. **Serviço Frontend** (`src/services/[feature].ts`)
   - Encapsular chamadas API
   - Tratar erros, transformar respostas

5. **Types** (`src/types/[feature].ts`)
   - Definir interfaces TypeScript
   - Manter sincronizado com backend

6. **Componentes** (`src/components/[role]/[Feature]*.tsx`)
   - Usar shadcn/ui de `@/components/ui/`
   - Seguir estrutura de componente do tech.md

7. **Hook** (`src/hooks/use[Feature].ts`)
   - Criar se reutilizável entre componentes
   - Encapsular lógica com estado

## Caminhos de Import

**Frontend - SEMPRE use alias `@/`:**
```typescript
// ✅ Correto
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import type { User } from '@/types/user'

// ❌ Errado
import { Button } from '../../../components/ui/button'
```

**Backend - Apenas caminhos relativos:**
```javascript
// ✅ Correto
const logger = require('../utils/logger')
const SupabaseService = require('../services/SupabaseService')

// ❌ Errado (sem suporte a alias)
const logger = require('@/utils/logger')
```

## Geração de Código

```bash
npm run generate route [feature]        # Rota backend
npm run generate component [path/Name]  # Componente frontend
npm run generate hook use[Feature]      # Hook React
npm run generate service [feature]      # Serviço backend
```
