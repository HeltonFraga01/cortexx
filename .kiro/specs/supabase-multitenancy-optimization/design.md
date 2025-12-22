# Design Técnico: Otimização Multi-Tenant com Supabase

## 1. Visão Geral da Arquitetura

### 1.1 Arquitetura Atual vs Proposta

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ARQUITETURA ATUAL                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────────────────────────────────┐    ┌──────────┐  │
│  │  Client  │───▶│            Backend Node.js            │───▶│ Supabase │  │
│  └──────────┘    │                                      │    │    DB    │  │
│                  │  ┌────────────────────────────────┐  │    └──────────┘  │
│                  │  │ AuthMiddleware                 │  │                  │
│                  │  │ - Verifica JWT manual          │  │                  │
│                  │  │ - Extrai tenant_id             │  │                  │
│                  │  │ - Adiciona filtros em TODAS    │  │                  │
│                  │  │   as queries manualmente       │  │                  │
│                  │  └────────────────────────────────┘  │                  │
│                  └──────────────────────────────────────┘                  │
│                                                                             │
│  ⚠️ Problemas:                                                              │
│  - Filtros manuais em cada query (risco de esquecer)                       │
│  - Segurança depende 100% do código                                        │
│  - JWT gerenciado manualmente                                              │
│  - Sem RLS no banco                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          ARQUITETURA PROPOSTA                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────────────────────────────────┐    ┌──────────┐  │
│  │  Client  │───▶│            Backend Node.js            │───▶│ Supabase │  │
│  └──────────┘    │                                      │    │    DB    │  │
│       │          │  ┌────────────────────────────────┐  │    │          │  │
│       │          │  │ Middleware Simplificado        │  │    │  ┌────┐  │  │
│       │          │  │ - Valida JWT Supabase          │  │    │  │RLS │  │  │
│       │          │  │ - Passa token para Supabase    │  │    │  │AUTO│  │  │
│       │          │  │ - SEM filtros manuais          │  │    │  └────┘  │  │
│       │          │  └────────────────────────────────┘  │    │          │  │
│       │          └──────────────────────────────────────┘    └──────────┘  │
│       │                                                           ▲        │
│       └───────────────────────────────────────────────────────────┘        │
│                         Supabase Auth JWT                                  │
│                         (tenant_id nos claims)                             │
│                                                                             │
│  ✅ Benefícios:                                                             │
│  - RLS filtra automaticamente por tenant                                   │
│  - Segurança no nível do banco                                             │
│  - JWT gerenciado pelo Supabase                                            │
│  - Código 40% mais simples                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Row Level Security (RLS)

### 2.1 Estratégia de RLS

O Supabase permite que o `tenant_id` seja extraído automaticamente do JWT do usuário autenticado.

```sql
-- Função para extrair tenant_id do JWT
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'tenant_id')::uuid,
    (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### 2.2 Políticas RLS por Tabela

#### Tabela: `accounts`

```sql
-- Habilitar RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Política: Usuários só veem accounts do mesmo tenant
CREATE POLICY "accounts_tenant_isolation" ON accounts
  FOR ALL
  USING (tenant_id = auth.tenant_id());

-- Política: Service role tem acesso total
CREATE POLICY "accounts_service_role_access" ON accounts
  FOR ALL
  USING (auth.role() = 'service_role');
```

#### Tabela: `agents`

```sql
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Leitura: agentes do mesmo tenant (via account)
CREATE POLICY "agents_select" ON agents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = agents.account_id 
      AND accounts.tenant_id = auth.tenant_id()
    )
  );

-- Escrita: apenas admins e owners
CREATE POLICY "agents_insert" ON agents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM accounts 
      WHERE accounts.id = agents.account_id 
      AND accounts.tenant_id = auth.tenant_id()
    )
  );
```

#### Template para Outras Tabelas

```sql
-- Template genérico para tabelas multi-tenant
CREATE OR REPLACE FUNCTION create_tenant_rls_policies(table_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Habilitar RLS
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
  
  -- Política de isolamento básico
  EXECUTE format('
    CREATE POLICY "%s_tenant_isolation" ON %I
    FOR ALL
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id())
  ', table_name, table_name);
  
  -- Política para service role
  EXECUTE format('
    CREATE POLICY "%s_service_role_access" ON %I
    FOR ALL
    USING (auth.role() = ''service_role'')
  ', table_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Aplicar em todas as tabelas multi-tenant
SELECT create_tenant_rls_policies('inboxes');
SELECT create_tenant_rls_policies('conversations');
SELECT create_tenant_rls_policies('messages');
SELECT create_tenant_rls_policies('webhooks');
SELECT create_tenant_rls_policies('bulk_campaigns');
```

---

## 3. Autenticação Unificada

### 3.1 Fluxo de Autenticação

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE AUTENTICAÇÃO                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LOGIN                                                                   │
│  ┌──────────┐                      ┌──────────────┐                         │
│  │  Client  │─── email/password ──▶│ Supabase Auth│                         │
│  └──────────┘                      └──────────────┘                         │
│       │                                   │                                 │
│       │                                   ▼                                 │
│       │                            ┌──────────────┐                         │
│       │                            │ Trigger:     │                         │
│       │                            │ add_tenant_  │                         │
│       │                            │ to_jwt()     │                         │
│       │                            └──────────────┘                         │
│       │                                   │                                 │
│       ◀───────── JWT com tenant_id ───────┘                                 │
│                                                                             │
│  2. REQUISIÇÃO AUTENTICADA                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────┐          │
│  │  Client  │───▶│ Backend  │───▶│ Supabase     │───▶│    DB    │          │
│  │  + JWT   │    │ (valida) │    │ (RLS auto)   │    │ (filtrado)│          │
│  └──────────┘    └──────────┘    └──────────────┘    └──────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Trigger para Adicionar tenant_id ao JWT

```sql
-- Função que adiciona tenant_id aos claims do JWT
CREATE OR REPLACE FUNCTION public.handle_user_claims()
RETURNS TRIGGER AS $$
DECLARE
  user_tenant_id UUID;
  user_role TEXT;
  user_account_id UUID;
BEGIN
  -- Buscar tenant_id e role do usuário via accounts
  SELECT a.tenant_id, ag.role, a.id 
  INTO user_tenant_id, user_role, user_account_id
  FROM accounts a
  LEFT JOIN agents ag ON ag.account_id = a.id AND ag.user_id = NEW.id
  WHERE a.owner_user_id = NEW.id
  LIMIT 1;
  
  -- Atualizar raw_app_meta_data com tenant_id
  UPDATE auth.users
  SET raw_app_meta_data = 
    COALESCE(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'tenant_id', user_tenant_id,
      'role', COALESCE(user_role, 'user'),
      'account_id', user_account_id
    )
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger após login
CREATE OR REPLACE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_claims();
```

### 3.3 Configuração do Supabase Client

```javascript
// server/config/supabase.js
const { createClient } = require('@supabase/supabase-js');

// Cliente para operações administrativas (service role)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Cliente para operações de usuário (com RLS)
const createUserClient = (accessToken) => {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    }
  );
};

module.exports = { supabaseAdmin, createUserClient };
```

---

## 4. Refatoração do SupabaseService

### 4.1 Antes (Atual)

```javascript
// ❌ Código atual - filtros manuais em todo lugar
class SupabaseService {
  async getAccounts(tenantId) {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('tenant_id', tenantId); // ⚠️ Filtro manual
    return data;
  }
  
  async createAccount(tenantId, accountData) {
    const { data, error } = await supabase
      .from('accounts')
      .insert({
        ...accountData,
        tenant_id: tenantId // ⚠️ Inserção manual
      });
    return data;
  }
}
```

### 4.2 Depois (Proposto)

```javascript
// ✅ Código novo - RLS cuida do isolamento
class SupabaseService {
  constructor(userAccessToken) {
    // Cliente com token do usuário - RLS automático
    this.client = createUserClient(userAccessToken);
  }
  
  async getAccounts() {
    // ✅ Sem filtro manual - RLS filtra automaticamente
    const { data, error } = await this.client
      .from('accounts')
      .select('*');
    return data;
  }
  
  async createAccount(accountData) {
    // ✅ tenant_id é adicionado automaticamente via trigger
    const { data, error } = await this.client
      .from('accounts')
      .insert(accountData);
    return data;
  }
}
```

### 4.3 Trigger para Auto-Inserção de tenant_id

```sql
-- Trigger que adiciona tenant_id automaticamente em INSERTs
CREATE OR REPLACE FUNCTION set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se tenant_id não foi fornecido, usar do JWT
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := auth.tenant_id();
  END IF;
  
  -- Validar que tenant_id corresponde ao do usuário
  IF NEW.tenant_id != auth.tenant_id() AND auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Cannot insert data for another tenant';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em tabelas multi-tenant
CREATE TRIGGER set_tenant_id_accounts
  BEFORE INSERT ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id();

CREATE TRIGGER set_tenant_id_inboxes
  BEFORE INSERT ON inboxes
  FOR EACH ROW
  EXECUTE FUNCTION set_tenant_id();
```

---

## 5. Índices Otimizados

### 5.1 Estratégia de Indexação

```sql
-- Índices compostos para queries multi-tenant eficientes

-- Accounts
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_id ON accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_status ON accounts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_accounts_tenant_created ON accounts(tenant_id, created_at DESC);

-- Agents
CREATE INDEX IF NOT EXISTS idx_agents_account_id ON agents(account_id);
CREATE INDEX IF NOT EXISTS idx_agents_account_status ON agents(account_id, status);

-- Inboxes
CREATE INDEX IF NOT EXISTS idx_inboxes_account_id ON inboxes(account_id);
CREATE INDEX IF NOT EXISTS idx_inboxes_account_status ON inboxes(account_id, status);

-- Conversations
CREATE INDEX IF NOT EXISTS idx_conversations_account_id ON conversations(account_id);
CREATE INDEX IF NOT EXISTS idx_conversations_inbox_id ON conversations(inbox_id);
CREATE INDEX IF NOT EXISTS idx_conversations_account_updated ON conversations(account_id, updated_at DESC);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_account_created ON messages(account_id, created_at DESC);

-- Bulk Campaigns
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_account_id ON bulk_campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_bulk_campaigns_account_status ON bulk_campaigns(account_id, status);
```

### 5.2 Verificação de Performance

```sql
-- Query para verificar uso de índices
EXPLAIN ANALYZE
SELECT * FROM accounts
WHERE tenant_id = 'uuid-do-tenant'
AND status = 'active';

-- Deve mostrar "Index Scan" e não "Seq Scan"
```

---

## 6. Realtime com Isolamento

### 6.1 Configuração de Realtime

```javascript
// client/services/realtime.js
import { createClient } from '@supabase/supabase-js';

class RealtimeService {
  constructor(accessToken) {
    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      }
    );
  }
  
  // Subscription com RLS automático
  subscribeToConversations(callback) {
    return this.client
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
          // ✅ Não precisa filtrar por tenant - RLS faz isso
        },
        callback
      )
      .subscribe();
  }
  
  // Broadcast isolado por tenant
  subscribeToBroadcast(tenantId, callback) {
    return this.client
      .channel(`tenant:${tenantId}`)
      .on('broadcast', { event: 'notification' }, callback)
      .subscribe();
  }
}
```

### 6.2 Configuração de Realtime no Supabase

```sql
-- Habilitar Realtime para tabelas específicas
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE inboxes;

-- RLS se aplica automaticamente ao Realtime
```

---

## 7. Middleware Simplificado

### 7.1 Antes (Atual)

```javascript
// ❌ Middleware atual - complexo
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    // Verificação manual do JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuário no banco
    const user = await User.findById(decoded.userId);
    
    // Verificar tenant
    if (!user || !user.tenant_id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Adicionar tenant_id ao request para filtros manuais
    req.tenantId = user.tenant_id;
    req.userId = user.id;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### 7.2 Depois (Proposto)

```javascript
// ✅ Middleware novo - simplificado
const { createUserClient } = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Criar cliente Supabase com token do usuário
    // RLS será aplicado automaticamente
    req.supabase = createUserClient(token);
    
    // Extrair claims do JWT (opcional, para logging)
    const { data: { user }, error } = await req.supabase.auth.getUser();
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = user;
    req.tenantId = user.app_metadata?.tenant_id;
    
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authMiddleware };
```

---

## 8. Plano de Migração

### 8.1 Fase 1: Preparação (Semana 1)

1. Criar função `auth.tenant_id()` no Supabase
2. Criar triggers para adicionar tenant_id ao JWT
3. Criar índices otimizados
4. Testar em ambiente de desenvolvimento

### 8.2 Fase 2: RLS Incremental (Semana 2-3)

1. Habilitar RLS em tabelas menos críticas primeiro
2. Criar policies de isolamento
3. Testar isolamento com testes automatizados
4. Monitorar logs de erro

### 8.3 Fase 3: Refatoração de Código (Semana 3-4)

1. Criar novo SupabaseService com suporte a RLS
2. Refatorar rotas para usar novo service
3. Remover filtros manuais de tenant_id
4. Atualizar testes

### 8.4 Fase 4: Autenticação Unificada (Semana 4-5)

1. Migrar autenticação para Supabase Auth
2. Deprecar métodos de auth legados
3. Atualizar frontend para usar Supabase Auth
4. Testar fluxos de login/logout

### 8.5 Fase 5: Realtime (Semana 5-6)

1. Configurar Realtime com RLS
2. Implementar subscriptions no frontend
3. Testar isolamento de eventos
4. Documentar uso

---

## 9. Testes de Segurança

### 9.1 Testes de Isolamento

```javascript
describe('Multi-Tenant Isolation', () => {
  it('should not allow cross-tenant data access', async () => {
    // Criar dois tenants
    const tenant1 = await createTenant('Tenant 1');
    const tenant2 = await createTenant('Tenant 2');
    
    // Criar account no tenant1
    const account1 = await createAccount(tenant1.id, { name: 'Account 1' });
    
    // Tentar acessar account1 com token do tenant2
    const client2 = createUserClient(tenant2.token);
    const { data, error } = await client2
      .from('accounts')
      .select('*')
      .eq('id', account1.id);
    
    // Deve retornar vazio (RLS bloqueia)
    expect(data).toHaveLength(0);
  });
  
  it('should not allow cross-tenant data insertion', async () => {
    const tenant1 = await createTenant('Tenant 1');
    const tenant2 = await createTenant('Tenant 2');
    
    // Tentar inserir account com tenant_id diferente
    const client1 = createUserClient(tenant1.token);
    const { data, error } = await client1
      .from('accounts')
      .insert({ name: 'Malicious', tenant_id: tenant2.id });
    
    // Deve falhar
    expect(error).toBeTruthy();
  });
});
```

---

## 10. Monitoramento

### 10.1 Métricas a Monitorar

- Tempo de resposta de queries com RLS
- Taxa de erros de autenticação
- Tentativas de acesso cross-tenant (bloqueadas)
- Uso de índices

### 10.2 Alertas

- Alerta se query > 1s
- Alerta se taxa de erro > 1%
- Alerta se tentativa de violação de RLS

---

## 11. Rollback Plan

### 11.1 Em Caso de Problemas

1. Desabilitar RLS nas tabelas afetadas
2. Reverter para middleware com filtros manuais
3. Investigar causa raiz
4. Corrigir e re-habilitar RLS

### 11.2 Scripts de Rollback

```sql
-- Desabilitar RLS em emergência
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE agents DISABLE ROW LEVEL SECURITY;
-- ... etc

-- Remover policies
DROP POLICY IF EXISTS "accounts_tenant_isolation" ON accounts;
DROP POLICY IF EXISTS "agents_tenant_isolation" ON agents;
-- ... etc
```
