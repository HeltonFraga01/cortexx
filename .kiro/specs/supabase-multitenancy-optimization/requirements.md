# Otimização Multi-Tenant com Supabase Nativo

## Contexto

O sistema atual de multi-tenancy não está aproveitando os recursos nativos do Supabase, resultando em:
- Código repetitivo para filtros de tenant
- Segurança dependente apenas da aplicação
- Performance não otimizada
- Complexidade desnecessária na autenticação

## Objetivo

Refatorar a arquitetura multi-tenant para usar recursos nativos do Supabase:
- Row Level Security (RLS) para isolamento automático
- Supabase Auth como fonte única de autenticação
- Índices otimizados para queries multi-tenant
- Realtime com filtros de tenant nativos

---

## User Stories

### US-001: Isolamento Automático por RLS

**Como** desenvolvedor do sistema  
**Quero** que o isolamento de dados por tenant seja automático via RLS  
**Para que** não precise adicionar filtros `tenant_id` manualmente em cada query

#### Critérios de Aceitação

1. **AC-001.1**: Todas as tabelas multi-tenant têm RLS habilitado
2. **AC-001.2**: Políticas RLS filtram automaticamente por `tenant_id` do usuário autenticado
3. **AC-001.3**: Queries sem filtro manual retornam apenas dados do tenant correto
4. **AC-001.4**: Tentativas de acesso cross-tenant são bloqueadas no nível do banco
5. **AC-001.5**: Logs de auditoria registram tentativas de violação

---

### US-002: Autenticação Unificada via Supabase Auth

**Como** usuário do sistema  
**Quero** uma experiência de autenticação consistente  
**Para que** não tenha confusão entre diferentes métodos de login

#### Critérios de Aceitação

1. **AC-002.1**: Supabase Auth é a única fonte de autenticação
2. **AC-002.2**: JWT do Supabase contém `tenant_id` nos claims customizados
3. **AC-002.3**: Refresh tokens são gerenciados pelo Supabase
4. **AC-002.4**: Logout invalida sessão em todos os dispositivos
5. **AC-002.5**: MFA pode ser habilitado via Supabase Auth

---

### US-003: Performance Otimizada para Multi-Tenant

**Como** administrador do sistema  
**Quero** queries otimizadas para cenários multi-tenant  
**Para que** o sistema escale com muitos tenants sem degradação

#### Critérios de Aceitação

1. **AC-003.1**: Índices compostos `(tenant_id, ...)` em todas as tabelas multi-tenant
2. **AC-003.2**: Queries usam índices de forma eficiente (verificado via EXPLAIN)
3. **AC-003.3**: Connection pooling configurado adequadamente
4. **AC-003.4**: Cache de queries frequentes implementado
5. **AC-003.5**: Métricas de performance por tenant disponíveis

---

### US-004: Realtime com Isolamento de Tenant

**Como** usuário do sistema  
**Quero** receber atualizações em tempo real apenas do meu tenant  
**Para que** tenha uma experiência responsiva e segura

#### Critérios de Aceitação

1. **AC-004.1**: Subscriptions Realtime filtram por tenant automaticamente
2. **AC-004.2**: Broadcast channels são isolados por tenant
3. **AC-004.3**: Presence mostra apenas usuários do mesmo tenant
4. **AC-004.4**: Eventos cross-tenant são impossíveis

---

### US-005: Simplificação do Código Backend

**Como** desenvolvedor  
**Quero** remover código redundante de filtros de tenant  
**Para que** o código seja mais limpo e menos propenso a erros

#### Critérios de Aceitação

1. **AC-005.1**: SupabaseService não precisa adicionar filtros `tenant_id` manualmente
2. **AC-005.2**: Middlewares de autenticação são simplificados
3. **AC-005.3**: Código de verificação de permissões é reduzido em 50%+
4. **AC-005.4**: Testes de isolamento são mais simples (testam RLS, não código)

---

### US-006: Migração Segura

**Como** administrador do sistema  
**Quero** migrar para a nova arquitetura sem downtime  
**Para que** os usuários não sejam impactados

#### Critérios de Aceitação

1. **AC-006.1**: Migração pode ser feita de forma incremental
2. **AC-006.2**: Rollback é possível em caso de problemas
3. **AC-006.3**: Dados existentes são preservados
4. **AC-006.4**: Sessões ativas não são invalidadas durante migração
5. **AC-006.5**: Monitoramento detecta problemas em tempo real

---

## Arquitetura Proposta

### Antes (Atual)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────▶│   Backend   │────▶│  Supabase   │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                    ┌─────┴─────┐
                    │ Filtros   │
                    │ tenant_id │
                    │ MANUAIS   │
                    └───────────┘
```

### Depois (Proposto)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Cliente   │────▶│   Backend   │────▶│  Supabase   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                       │
      │              ┌───────────────────────┐│
      └─────────────▶│  Supabase Auth JWT    ││
                     │  + RLS Automático     ││
                     │  + Realtime Filtrado  │◀┘
                     └───────────────────────┘
```

---

## Recursos Supabase a Utilizar

| Recurso | Uso | Benefício |
|---------|-----|----------|
| **RLS** | Isolamento automático | Segurança no banco |
| **Auth JWT Claims** | tenant_id no token | Contexto automático |
| **Índices** | Compostos com tenant_id | Performance |
| **Realtime** | Subscriptions filtradas | UX responsiva |
| **Edge Functions** | Lógica próxima ao banco | Latência reduzida |
| **Database Functions** | Operações complexas | Atomicidade |

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| RLS mal configurado | Média | Alto | Testes extensivos, ambiente staging |
| Performance RLS | Baixa | Médio | Índices otimizados, benchmarks |
| Migração de sessões | Média | Médio | Migração gradual, dual-auth temporário |
| Complexidade inicial | Alta | Baixo | Documentação, treinamento |

---

## Métricas de Sucesso

1. **Segurança**: Zero vazamentos cross-tenant em testes de penetração
2. **Performance**: Queries 20% mais rápidas com RLS vs filtros manuais
3. **Código**: Redução de 40% no código de autenticação/autorização
4. **Manutenção**: Tempo de onboarding de novos devs reduzido em 30%
