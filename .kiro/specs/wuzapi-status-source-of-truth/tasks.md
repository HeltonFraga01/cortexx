# Implementation Tasks: User Inbox Edit Page

## Análise do Problema

### Estrutura de Dados

**Tabela `inboxes` (Supabase):**
```sql
id: 841964be-35b8-4aa2-aeb8-1721dfc0107a  -- UUID Supabase (usado na URL do user)
wuzapi_user_id: 9815d127aa0eb8e2eb4cc80de2fb2a3b  -- ID no WUZAPI
wuzapi_token: 553194974759MINVP9QM2ZOV4WMPR  -- Token para API WUZAPI
name: WhatsApp HeltonFraga
phone_number: null  -- NÃO preenchido
wuzapi_connected: false  -- Cache (não confiável)
-- NÃO TEM campo jid
```

**WUZAPI retorna (via /api/admin/users):**
```json
{
  "id": "9815d127aa0eb8e2eb4cc80de2fb2a3b",
  "name": "HeltonFraga",
  "token": "553194974759MINVP9QM2ZOV4WMPR",
  "jid": "553194974759:64@s.whatsapp.net",
  "connected": true,
  "loggedIn": true,
  "webhook": "https://cloudapi.wasend.com.br/api/webhook/events",
  "events": "Message,ReadReceipt"
}
```

### Problema Identificado

**Arquivo:** `server/routes/inboxContextRoutes.js` (linha 458-530)

O endpoint `GET /api/user/inbox/:inboxId/connection` só busca dados do Supabase:
```javascript
const { data: inbox } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
  query.select('*').eq('id', inboxId).single()
);

res.json({
  success: true,
  data: {
    inboxId: inbox.id,
    inboxName: inbox.name,
    phoneNumber: inbox.phone_number,  // ❌ null no Supabase
    wuzapiToken: inbox.wuzapi_token,
    instance: inbox.wuzapi_user_id,
    jid: inbox.jid || null,  // ❌ Campo não existe na tabela
    profilePicture: inbox.profile_picture || null,
    isConnected: inbox.wuzapi_connected || false  // ❌ Cache, não confiável
  }
});
```

**Resultado:** JID, phone, status vêm como `null` ou `false` porque não estão no Supabase.

---

## Solução

O endpoint precisa:
1. Buscar inbox do Supabase (para pegar `wuzapi_user_id` e `wuzapi_token`)
2. Usar `wuzapi_user_id` para buscar dados do WUZAPI
3. Combinar os dados e retornar

---

## Tasks

### Task 1: Corrigir endpoint `/api/user/inbox/:id/connection` ✅ DONE

**Arquivo:** `server/routes/inboxContextRoutes.js`

**Mudança:** Após buscar inbox do Supabase, buscar dados do WUZAPI usando `wuzapi_token`.

**Implementado:**
- Endpoint agora busca `/session/status` do WUZAPI
- Retorna `jid`, `phoneNumber` (extraído do JID), `isConnected`, `isLoggedIn` do WUZAPI
- Fallback para dados do Supabase se WUZAPI falhar

**Acceptance Criteria:**
- [x] Endpoint retorna `jid` do WUZAPI
- [x] Endpoint retorna `phoneNumber` extraído do JID
- [x] Endpoint retorna `isConnected` e `isLoggedIn` do WUZAPI
- [x] Se WUZAPI falhar, retorna dados do Supabase como fallback

---

### Task 2: Atualizar frontend para usar novos campos ✅ DONE

**Arquivo:** `src/components/user/UserInboxEditPage.tsx`

**Mudanças:**
- [x] Usar `connectionData.jid` para exibir JID
- [x] Usar `connectionData.phoneNumber` para exibir telefone
- [x] Usar `connectionData.isLoggedIn` para status

---

### Task 3: Adicionar campo Token na UI ✅ DONE

**Arquivo:** `src/components/user/UserInboxEditPage.tsx`

**Mudanças:**
- [x] Adicionado campo readonly para `wuzapiToken`
- [x] Adicionado botão de copiar
- [x] Usa mesmo estilo do admin

---

### Task 4: Adicionar campo JID completo na UI ✅ DONE

**Arquivo:** `src/components/user/UserInboxEditPage.tsx`

**Mudanças:**
- [x] Campo JID já existia, agora funciona com dados do WUZAPI
- [x] Botão de copiar já implementado
- [x] Formato: `553194974759:64@s.whatsapp.net`

---

### Task 5: Corrigir busca de avatar ✅ DONE (automático)

**Arquivo:** `src/components/user/UserInboxEditPage.tsx`

**Problema resolvido:** Com Task 1, o JID agora vem preenchido do WUZAPI, então o avatar funciona automaticamente.

---

### Task 6: Atualizar interface TypeScript ✅ DONE

**Arquivo:** `src/hooks/useInboxConnectionData.ts`

**Mudanças:**
- [x] Adicionado `wuzapiUserId` na interface
- [x] Adicionado `isLoggedIn` na interface
- [x] `phoneNumber` agora aceita `null`
- [x] Removido campo `instance` (substituído por `wuzapiUserId`)

---

## Comparação Final

| Campo | Admin | User Antes | User Após Fix |
|-------|-------|------------|---------------|
| Avatar | ✅ | ❌ (jid null) | ✅ |
| Nome | ✅ | ✅ | ✅ |
| Status | ✅ WUZAPI | ❌ cache | ✅ WUZAPI |
| ID inbox | ✅ | ✅ | ✅ |
| Phone | ✅ do JID | ❌ null | ✅ do JID |
| Token | ✅ | ❌ | ✅ |
| JID | ✅ | ❌ null | ✅ |
| Webhook | ✅ | ✅ | ✅ |
| Eventos | ✅ | ✅ | ✅ |

---

## Status de Implementação

✅ **TODAS AS TASKS CONCLUÍDAS**

**Arquivos modificados:**
1. `server/routes/inboxContextRoutes.js` - Endpoint agora busca WUZAPI
2. `src/hooks/useInboxConnectionData.ts` - Interface atualizada
3. `src/components/user/UserInboxEditPage.tsx` - UI com Token e JID
