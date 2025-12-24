# Design Document: Página de Edição de Inbox (Admin)

## Overview

A página `/admin/inboxes/edit/:id` exibe e permite editar uma inbox específica. Os dados vêm de duas fontes que são combinadas no frontend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Página de Edição de Inbox                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Informações Básicas                                      │   │
│  │  ┌─────────┐  Nome: HeltonFraga                          │   │
│  │  │ Avatar  │  Status: Logado (badge verde)               │   │
│  │  │ (foto)  │  ID: 9815d127aa0eb8e2eb4cc80de2fb2a3b       │   │
│  │  └─────────┘  Phone: 553194974759                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Campos Editáveis/Somente Leitura                         │   │
│  │  - Nome: [input editável]                                 │   │
│  │  - Token: [readonly + copy] 553194974759MINVP9QM2ZOV4WMPR│   │
│  │  - JID: [readonly + copy] 553194974759:64@s.whatsapp.net │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Conta Supabase (Vinculado)                               │   │
│  │  - ID: ba2ca611-3220-4470-8f8f-e6c286461362              │   │
│  │  - Email: cortexx4@cortexx.com                           │   │
│  │  - Criado: 22/12/2025                                    │   │
│  │  - Último Login: 24/12/2025                              │   │
│  │  [Alterar Credenciais] [Desvincular]                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Configuração de Webhook                                  │   │
│  │  - URL: [input editável]                                  │   │
│  │  - Eventos: [checkboxes agrupados por categoria]         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Carregamento Inicial

```
┌─────────────┐     GET /api/admin/users      ┌─────────────┐
│   Frontend  │ ─────────────────────────────▶│   Backend   │
│             │                               │             │
│             │◀───────────────────────────── │             │
│             │   { data: [all inboxes] }     │             │
└─────────────┘                               └──────┬──────┘
                                                     │
                                                     ▼
                                              ┌─────────────┐
                                              │   WUZAPI    │
                                              │   Server    │
                                              └─────────────┘
```

**Resposta do WUZAPI (via /api/admin/users):**
```json
{
  "code": 200,
  "success": true,
  "data": [{
    "id": "9815d127aa0eb8e2eb4cc80de2fb2a3b",
    "name": "HeltonFraga",
    "token": "553194974759MINVP9QM2ZOV4WMPR",
    "jid": "553194974759:64@s.whatsapp.net",
    "connected": true,
    "loggedIn": true,
    "webhook": "https://cloudapi.wasend.com.br/api/webhook/events",
    "events": "Message,ReadReceipt",
    "qrcode": "",
    "proxy_url": "socks5://frp.cortexx.online:1080",
    "proxy_config": { "enabled": true, "proxy_url": "..." },
    "s3_config": { ... }
  }]
}
```

### 2. Busca da Conta Supabase Vinculada

```
┌─────────────┐  GET /api/admin/supabase/users?search={id}  ┌─────────────┐
│   Frontend  │ ───────────────────────────────────────────▶│   Backend   │
│             │                                             │             │
│             │◀─────────────────────────────────────────── │             │
│             │   { data: [matching users] }                │             │
└─────────────┘                                             └──────┬──────┘
                                                                   │
                                                                   ▼
                                                            ┌─────────────┐
                                                            │  Supabase   │
                                                            │    Auth     │
                                                            └─────────────┘
```

**Busca no Supabase:**
- Endpoint: `GET /api/admin/supabase/users?page=1&per_page=100&search={wuzapi_id}`
- O backend busca usuários onde `user_metadata.wuzapi_id` contém o ID da inbox

**Resposta:**
```json
{
  "success": true,
  "data": [{
    "id": "ba2ca611-3220-4470-8f8f-e6c286461362",
    "email": "cortexx4@cortexx.com",
    "created_at": "2025-12-22T03:56:24.549062Z",
    "last_sign_in_at": "2025-12-24T06:26:44.464458Z",
    "user_metadata": {
      "name": "HeltonFraga",
      "role": "user",
      "wuzapi_id": "9815d127aa0eb8e2eb4cc80de2fb2a3b"
    }
  }]
}
```

### 3. Busca do Avatar

```
┌─────────────┐     POST /api/user/avatar      ┌─────────────┐
│   Frontend  │ ──────────────────────────────▶│   Backend   │
│             │  Headers: { token: "..." }     │             │
│             │  Body: { Phone, Preview }      │             │
│             │◀────────────────────────────── │             │
│             │   { data: { url: "..." } }     │             │
└─────────────┘                                └──────┬──────┘
                                                      │
                                                      ▼
                                               ┌─────────────┐
                                               │   WUZAPI    │
                                               │   Server    │
                                               └─────────────┘
```

**Requisição:**
```javascript
POST /api/user/avatar
Headers: {
  'token': '553194974759MINVP9QM2ZOV4WMPR',  // Token da inbox
  'csrf-token': '...',
  'Content-Type': 'application/json'
}
Body: {
  "Phone": "553194974759",  // Extraído do JID (antes do :)
  "Preview": false
}
```

**Resposta:**
```json
{
  "success": true,
  "data": {
    "url": "https://pps.whatsapp.net/v/t61.24694-24/...",
    "direct_path": "/v/t61.24694-24/...",
    "id": "33240835",
    "type": "image"
  }
}
```

## Component Structure

### InboxEditPage.tsx

```typescript
// src/pages/admin/InboxEditPage.tsx

interface InboxEditPageProps {
  inboxId: string  // Da URL: /admin/inboxes/edit/:id
}

function InboxEditPage({ inboxId }: InboxEditPageProps) {
  // 1. Buscar dados do WUZAPI
  const { data: wuzapiUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.get('/api/admin/users')
  })
  
  // 2. Filtrar inbox pelo ID
  const inbox = wuzapiUsers?.data?.find(u => u.id === inboxId)
  
  // 3. Buscar conta Supabase vinculada
  const { data: supabaseUsers } = useQuery({
    queryKey: ['admin', 'supabase-users', inboxId],
    queryFn: () => api.get(`/api/admin/supabase/users?search=${inboxId}`)
  })
  
  // 4. Encontrar conta vinculada (onde wuzapi_id = inboxId)
  const linkedAccount = supabaseUsers?.data?.find(
    u => u.user_metadata?.wuzapi_id === inboxId
  )
  
  // 5. Buscar avatar (se logado)
  const phone = inbox?.jid?.split(':')[0]
  const { data: avatar } = useQuery({
    queryKey: ['avatar', phone],
    queryFn: () => api.post('/api/user/avatar', 
      { Phone: phone, Preview: false },
      { headers: { token: inbox.token } }
    ),
    enabled: !!inbox?.loggedIn && !!phone
  })
  
  return (
    <div>
      <InboxHeader inbox={inbox} avatarUrl={avatar?.data?.url} />
      <InboxBasicInfo inbox={inbox} />
      <SupabaseAccountSection account={linkedAccount} />
      <WebhookConfigSection inbox={inbox} />
      <QuickActions inbox={inbox} />
    </div>
  )
}
```

## Status Display Logic

```typescript
function getStatusDisplay(inbox: WuzapiUser) {
  if (inbox.loggedIn) {
    return {
      label: 'Logado',
      variant: 'success',
      description: 'Conectado e autenticado no WhatsApp. Pronto para enviar/receber mensagens.'
    }
  }
  
  if (inbox.connected) {
    return {
      label: 'Conectado',
      variant: 'warning', 
      description: 'Conexão estabelecida, aguardando autenticação via QR Code.'
    }
  }
  
  return {
    label: 'Desconectado',
    variant: 'destructive',
    description: 'Sem conexão com o WhatsApp. Clique em "Gerar QR Code" para conectar.'
  }
}
```

## API Endpoints Used

| Endpoint | Método | Descrição | Fonte |
|----------|--------|-----------|-------|
| `/api/admin/users` | GET | Lista todas as inboxes | WUZAPI |
| `/api/admin/supabase/users` | GET | Lista usuários Supabase | Supabase Auth |
| `/api/user/avatar` | POST | Busca foto de perfil | WUZAPI |
| `/api/admin/users/:id` | PUT | Atualiza inbox | WUZAPI |
| `/api/admin/users/:id` | DELETE | Remove inbox | WUZAPI |

## Key Points

1. **WUZAPI é fonte de verdade** para status de conexão (`connected`, `loggedIn`)
2. **Supabase armazena metadados** da conta (email, datas, vinculação via `wuzapi_id`)
3. **Avatar vem do WUZAPI** usando o token da inbox específica
4. **Vinculação** é feita via `user_metadata.wuzapi_id` no Supabase
5. **Não existe tabela `inboxes`** no Supabase - os dados vêm direto do WUZAPI
