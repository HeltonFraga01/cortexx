# Docker Cookie Fix - Correção de Sessão

## 🐛 Problema Identificado

**Sintoma:** Usuário faz login com sucesso, mas é imediatamente deslogado. Requisições subsequentes retornam 401 (Unauthorized).

**Causa Raiz:** Cookie de sessão configurado com `secure: true` em produção, mas aplicação acessada via HTTP (não HTTPS).

---

## 🔍 Diagnóstico

### Comportamento Observado

1. ✅ Login funciona: `POST /api/auth/login` → 200 OK
2. ✅ Sessão criada: Log mostra "Session created"
3. ❌ Cookie não enviado: Navegador não envia cookie nas requisições seguintes
4. ❌ Requisições falham: `GET /api/admin/dashboard-stats` → 401 Unauthorized

### Logs do Servidor

```json
{
  "message": "Login successful",
  "userId": "admin",
  "role": "admin"
}
{
  "message": "Session created",
  "sessionId": "7nEvp7sarZ4qL-X1Y9y5oUcEDyYhsrKE"
}
// Mas depois...
{
  "message": "Unauthorized access attempt",
  "path": "/api/admin/dashboard-stats"
}
```

### Análise do Código

**Arquivo:** `server/middleware/session.js`

**Problema:**
```javascript
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // ❌ PROBLEMA!
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000
}
```

**Explicação:**
- `NODE_ENV=production` no Docker
- `secure: true` → Cookie só enviado via HTTPS
- Acesso via HTTP → Navegador não envia cookie
- Sem cookie → Sem sessão → 401 Unauthorized

---

## ✅ Correção Implementada

### Mudança no Código

**Arquivo:** `server/middleware/session.js`

**Antes:**
```javascript
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 24 * 60 * 60 * 1000
}
```

**Depois:**
```javascript
cookie: {
  httpOnly: true,
  // Secure apenas se HTTPS estiver disponível (não apenas em produção)
  // Permite testes locais em produção via HTTP
  secure: process.env.COOKIE_SECURE === 'true' || false,
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  maxAge: 24 * 60 * 60 * 1000
}
```

### Configuração no .env.docker

**Adicionado:**
```bash
# Cookie settings
# COOKIE_SECURE=true apenas se usar HTTPS
# Para testes locais via HTTP, deixe false ou omita
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
```

---

## 🧪 Testes Após Correção

### Teste 1: Login Admin
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "UeH7cZ2c1K3zVUBFi7SginSC", "role": "admin"}' \
  -c cookies.txt
```

**Resultado:** ✅ 200 OK, cookie salvo

### Teste 2: Requisição Protegida
```bash
curl http://localhost:3001/api/admin/dashboard-stats -b cookies.txt
```

**Resultado:** ✅ 200 OK, dados retornados

### Teste 3: Navegação no Browser

**Passos:**
1. Abrir http://localhost:3001
2. Login como admin
3. Navegar para Dashboard
4. Navegar para Usuários
5. Navegar para Configurações

**Resultado:** ✅ Todas as páginas carregam sem erros 401

### Teste 4: Verificar Requisições

**Requisições observadas:**
- `POST /api/auth/login` → 200 ✅
- `GET /api/admin/dashboard-stats` → 200 ✅
- `GET /api/admin/branding` → 200 ✅
- `GET /api/admin/users` → 200 ✅

**Nenhum erro 401!** ✅

---

## 📊 Comparação

### Antes da Correção
```
Login → 200 OK
Dashboard Stats → 401 ❌
Branding → 401 ❌
Users → 401 ❌
```

### Depois da Correção
```
Login → 200 OK ✅
Dashboard Stats → 200 OK ✅
Branding → 200 OK ✅
Users → 200 OK ✅
```

---

## 🔧 Configuração por Ambiente

### Desenvolvimento Local (HTTP)
```bash
# server/.env
NODE_ENV=development
# Cookie secure=false automaticamente
```

### Docker Local (HTTP)
```bash
# .env.docker
NODE_ENV=production
COOKIE_SECURE=false  # ← Permite HTTP
COOKIE_SAMESITE=lax
```

### Produção com HTTPS
```bash
# .env.docker
NODE_ENV=production
COOKIE_SECURE=true   # ← Requer HTTPS
COOKIE_SAMESITE=strict
```

---

## 🎯 Lições Aprendidas

### 1. NODE_ENV ≠ Protocolo
`NODE_ENV=production` não significa necessariamente HTTPS. Testes locais podem usar produção via HTTP.

### 2. Cookie Secure Flag
O flag `secure` deve ser baseado no **protocolo** (HTTP/HTTPS), não no ambiente (dev/prod).

### 3. Configuração Flexível
Usar variáveis de ambiente (`COOKIE_SECURE`) permite configuração por ambiente sem mudar código.

### 4. Testes Importantes
Sempre testar o fluxo completo (login → navegação) para detectar problemas de sessão.

---

## ✅ Checklist de Validação

Para confirmar que a correção está funcionando:

- [x] Login retorna 200 OK
- [x] Cookie é enviado pelo servidor (Set-Cookie header)
- [x] Cookie é armazenado pelo navegador
- [x] Cookie é enviado nas requisições subsequentes
- [x] Requisições protegidas retornam 200 OK (não 401)
- [x] Navegação entre páginas funciona
- [x] Sessão persiste após reload
- [x] Nenhum erro no console do navegador

---

## 🚀 Status Final

✅ **Problema 100% resolvido!**

- Login funciona perfeitamente
- Sessão persiste corretamente
- Todas as rotas admin acessíveis
- Nenhum erro 401
- Navegação fluida entre páginas

**Link de acesso:** http://localhost:3001

---

**Corrigido por:** Kiro AI Assistant  
**Data:** 16 de Novembro de 2025  
**Método:** MCP Chrome DevTools para diagnóstico interativo
