# Design Document

## Overview

Este documento descreve o design técnico para a página de edição de usuários Supabase Auth. A solução envolve criar uma nova rota e componentes dedicados, além de endpoints backend para suportar todas as operações necessárias.

## Architecture

### Routing Strategy

```
/admin/users/edit/:userId        -> EditUserPage (WUZAPI users - existente)
/admin/supabase-users/edit/:userId -> SupabaseUserEditPage (Supabase Auth users - NOVO)
```

A separação de rotas evita conflitos e permite que cada tipo de usuário tenha sua própria experiência de edição otimizada.

### Component Hierarchy

```
SupabaseUserEditPage
├── Breadcrumb
├── BackButton
├── SupabaseUserInfoCard
│   ├── Avatar/Initials
│   ├── BasicInfo (email, phone, dates)
│   ├── MetadataEditor
│   └── CredentialsActions (reset password, confirm email)
├── SupabaseUserAccountCard
│   ├── AccountInfo (name, status, token)
│   ├── SettingsEditor (timezone, locale)
│   └── AccountActions (suspend, reactivate)
├── SupabaseUserSubscriptionCard
│   ├── CurrentPlan
│   ├── SubscriptionStatus
│   ├── FeaturesList
│   └── PlanActions (change, cancel, extend trial)
├── SupabaseUserQuotaCard
│   ├── QuotaProgress (messages, bots, campaigns)
│   └── QuotaDetails
├── WuzapiInstancesCard
│   ├── InstancesList
│   ├── LinkInstanceAction
│   └── UnlinkInstanceAction
└── SupabaseUserActionsCard
    ├── DeleteUserAction
    └── SendEmailAction
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SupabaseUserEditPage                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Mount: Extract userId from URL params                       │
│  2. Fetch: GET /api/admin/supabase/users/:id/full               │
│  3. Validate: Check user belongs to current tenant              │
│  4. Render: Display data in organized cards                     │
│  5. Edit: User modifies data in forms                           │
│  6. Save: PUT /api/admin/supabase/users/:id                     │
│  7. Feedback: Toast notification + optional redirect            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Models

### SupabaseUserFull (Response from /full endpoint)

```typescript
interface SupabaseUserFull {
  // Supabase Auth data
  user: {
    id: string
    email: string
    phone?: string
    email_confirmed_at?: string
    last_sign_in_at?: string
    created_at: string
    updated_at?: string
    user_metadata: {
      role?: 'admin' | 'user'
      name?: string
      wuzapi_id?: string
      [key: string]: any
    }
  }
  
  // Account data (from accounts table)
  account: {
    id: number
    name: string
    owner_user_id: string
    tenant_id: string
    wuzapi_token?: string
    status: 'active' | 'suspended' | 'inactive'
    timezone?: string
    locale?: string
    settings?: Record<string, any>
    created_at: string
    updated_at?: string
  } | null
  
  // Subscription data
  subscription: {
    id: string
    user_id: string
    plan_id: string
    status: 'trial' | 'active' | 'past_due' | 'canceled' | 'expired' | 'suspended'
    current_period_start?: string
    current_period_end?: string
    trial_end?: string
    canceled_at?: string
    plan: {
      id: string
      name: string
      description?: string
      price_cents: number
      billing_cycle: 'monthly' | 'yearly'
      features: Record<string, any>
      limits: Record<string, number>
    }
  } | null
  
  // Quota usage
  quotas: {
    messages_sent: number
    messages_limit: number
    bots_active: number
    bots_limit: number
    campaigns_active: number
    campaigns_limit: number
    [key: string]: number
  } | null
  
  // WUZAPI instances linked
  wuzapiInstances: Array<{
    id: string
    name: string
    token: string
    connected: boolean
    loggedIn: boolean
    jid?: string
  }>
}
```

### Update DTOs

```typescript
interface UpdateSupabaseUserDTO {
  email?: string
  phone?: string
  email_confirm?: boolean
  user_metadata?: Record<string, any>
}

interface UpdateAccountDTO {
  name?: string
  status?: 'active' | 'suspended' | 'inactive'
  timezone?: string
  locale?: string
  settings?: Record<string, any>
}
```

## API Endpoints

### GET /api/admin/supabase/users/:id/full

Retorna dados completos do usuário incluindo account, subscription e quotas.

```javascript
// server/routes/adminRoutes.js
router.get('/supabase/users/:id/full', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    if (!tenantId) {
      return res.status(403).json({ error: 'Tenant context required' });
    }
    
    const supabase = supabaseService.adminClient;
    
    // 1. Get Supabase Auth user
    const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(id);
    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // 2. Get account and validate tenant
    const { data: account } = await supabase
      .from('accounts')
      .select('*')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!account) {
      // User exists but doesn't belong to this tenant
      logger.warn('Cross-tenant access attempt', { userId: id, tenantId });
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // 3. Get subscription with plan details
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*, plan:plans(*)')
      .eq('user_id', id)
      .single();
    
    // 4. Get quota usage
    const { data: quotas } = await supabase
      .from('user_quota_usage')
      .select('*')
      .eq('user_id', id)
      .single();
    
    // 5. Get linked WUZAPI instances (via user_metadata.wuzapi_id or account.wuzapi_token)
    // This requires calling WUZAPI to get instance details
    let wuzapiInstances = [];
    // ... implementation depends on how instances are linked
    
    return res.json({
      success: true,
      data: {
        user,
        account,
        subscription,
        quotas,
        wuzapiInstances
      }
    });
  } catch (error) {
    logger.error('Error fetching full user data', { error: error.message, id: req.params.id });
    return res.status(500).json({ error: error.message });
  }
});
```

### POST /api/admin/supabase/users/:id/reset-password

```javascript
router.post('/supabase/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { sendEmail = true } = req.body;
    const tenantId = getTenantIdFromRequest(req);
    
    // Validate tenant access
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .single();
    
    if (!account) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get user email
    const { data: { user } } = await supabase.auth.admin.getUserById(id);
    
    if (sendEmail && user.email) {
      // Send password reset email
      await supabase.auth.resetPasswordForEmail(user.email);
      return res.json({ success: true, message: 'Password reset email sent' });
    } else {
      // Generate temporary password
      const tempPassword = crypto.randomBytes(12).toString('base64');
      await supabase.auth.admin.updateUserById(id, { password: tempPassword });
      return res.json({ success: true, tempPassword });
    }
  } catch (error) {
    logger.error('Error resetting password', { error: error.message, id: req.params.id });
    return res.status(500).json({ error: error.message });
  }
});
```

### POST /api/admin/supabase/users/:id/suspend

```javascript
router.post('/supabase/users/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = getTenantIdFromRequest(req);
    
    // Validate and update account status
    const { data, error } = await supabase
      .from('accounts')
      .update({ status: 'suspended', updated_at: new Date().toISOString() })
      .eq('owner_user_id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error || !data) {
      return res.status(403).json({ error: 'Access denied or user not found' });
    }
    
    // Optionally ban user in Supabase Auth
    // await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' });
    
    logger.info('User suspended', { userId: id, tenantId, adminId: req.session?.userId });
    
    return res.json({ success: true, data });
  } catch (error) {
    logger.error('Error suspending user', { error: error.message, id: req.params.id });
    return res.status(500).json({ error: error.message });
  }
});
```

## Frontend Components

### SupabaseUserEditPage.tsx

```typescript
// src/pages/admin/SupabaseUserEditPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { SupabaseUserInfoCard } from '@/components/admin/supabase-user/SupabaseUserInfoCard'
import { SupabaseUserAccountCard } from '@/components/admin/supabase-user/SupabaseUserAccountCard'
import { SupabaseUserSubscriptionCard } from '@/components/admin/supabase-user/SupabaseUserSubscriptionCard'
import { SupabaseUserQuotaCard } from '@/components/admin/supabase-user/SupabaseUserQuotaCard'
import { SupabaseUserActionsCard } from '@/components/admin/supabase-user/SupabaseUserActionsCard'
import { supabaseUserService } from '@/services/supabase-user'
import type { SupabaseUserFull } from '@/types/supabase-user'

export function SupabaseUserEditPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userData, setUserData] = useState<SupabaseUserFull | null>(null)
  
  const loadUserData = useCallback(async () => {
    if (!userId) {
      setError('ID do usuário não fornecido')
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      const data = await supabaseUserService.getFullUser(userId)
      setUserData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuário')
      toast.error('Erro ao carregar dados do usuário')
    } finally {
      setLoading(false)
    }
  }, [userId])
  
  useEffect(() => {
    loadUserData()
  }, [loadUserData])
  
  const handleBackToList = () => {
    navigate('/admin/multi-user')
  }
  
  const handleRefresh = () => {
    loadUserData()
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }
  
  if (error || !userData) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Erro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>{error || 'Usuário não encontrado'}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRefresh}>Tentar Novamente</Button>
            <Button onClick={handleBackToList}>Voltar à Lista</Button>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6 max-w-6xl mx-auto p-6">
      {/* Breadcrumb */}
      <Breadcrumb items={[
        { label: 'Admin', href: '/admin' },
        { label: 'Multi-User', href: '/admin/multi-user' },
        { label: `Editar: ${userData.user.email}` }
      ]} />
      
      {/* Back Button */}
      <Button variant="ghost" onClick={handleBackToList} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Voltar à Lista
      </Button>
      
      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SupabaseUserInfoCard 
          user={userData.user} 
          onUpdate={handleRefresh}
        />
        
        <SupabaseUserAccountCard 
          account={userData.account}
          userId={userData.user.id}
          onUpdate={handleRefresh}
        />
        
        <SupabaseUserSubscriptionCard 
          subscription={userData.subscription}
          userId={userData.user.id}
          onUpdate={handleRefresh}
        />
        
        <SupabaseUserQuotaCard 
          quotas={userData.quotas}
          subscription={userData.subscription}
        />
        
        <SupabaseUserActionsCard 
          user={userData.user}
          account={userData.account}
          onUpdate={handleRefresh}
          onDelete={handleBackToList}
        />
      </div>
    </div>
  )
}
```

## Security Considerations

### Multi-Tenant Isolation

1. **Backend Validation**: Todas as operações DEVEM validar que o usuário pertence ao tenant do admin
2. **Generic Errors**: Usar mensagens genéricas ("Access denied") para não vazar informações
3. **Audit Logging**: Registrar todas as ações administrativas e tentativas de acesso cross-tenant
4. **Frontend Validation**: Verificar tenant no frontend como camada adicional (não confiar apenas nisso)

### Data Protection

1. **Sensitive Data**: Não expor tokens ou senhas em logs ou responses
2. **Password Reset**: Usar email de reset em vez de gerar senhas temporárias quando possível
3. **Session Validation**: Verificar sessão admin válida em todas as operações

## Implementation Phases

### Phase 1: Backend Endpoints
1. Criar endpoint `/supabase/users/:id/full`
2. Criar endpoint `/supabase/users/:id/reset-password`
3. Criar endpoint `/supabase/users/:id/suspend`
4. Criar endpoint `/supabase/users/:id/reactivate`
5. Adicionar validação de tenant em todos os endpoints

### Phase 2: Frontend Service
1. Criar `src/services/supabase-user.ts` com métodos para todos os endpoints
2. Criar tipos em `src/types/supabase-user.ts`

### Phase 3: UI Components
1. Criar `SupabaseUserEditPage.tsx`
2. Criar cards individuais para cada seção
3. Implementar formulários de edição inline
4. Adicionar confirmações para ações destrutivas

### Phase 4: Integration
1. Atualizar `SupabaseUsersList` para navegar para nova rota
2. Adicionar rota no React Router
3. Testar fluxo completo
4. Verificar responsividade

## Testing Strategy

1. **Unit Tests**: Testar cada componente isoladamente
2. **Integration Tests**: Testar fluxo completo de edição
3. **Security Tests**: Testar isolamento multi-tenant
4. **E2E Tests**: Testar navegação e operações via Cypress
