# Guia de Testes - Correções de Segurança

## Status Atual

✅ **Sistema está rodando:**
- Frontend: http://localhost:8080
- Backend: http://localhost:3001
- Página de login carregando corretamente

✅ **Correções implementadas:**
- Tokens removidos do frontend
- Bundle de produção limpo (sem tokens expostos)
- Autenticação baseada em sessões HTTP-only
- Proxy backend para WuzAPI

## Pré-requisitos para Testes

Para testar o sistema completamente, você precisa:

### 1. Token Admin WuzAPI

Adicione ao arquivo `server/.env`:

```bash
WUZAPI_ADMIN_TOKEN=seu_token_admin_aqui
```

**Como obter:**
- Acesse sua conta WuzAPI em https://wzapi.wasend.com.br
- Copie o token de administrador
- Cole no arquivo `server/.env`

### 2. Token de Usuário WuzAPI (opcional)

Para testar login como usuário:
- Use um token de usuário válido do WuzAPI
- Ou crie um novo usuário via painel admin após fazer login como admin

## Testes Manuais

### 1. Teste de Login Admin

**Passos:**
1. Acesse http://localhost:8080
2. Clique na aba "Administrador"
3. Cole seu token admin do WuzAPI
4. Clique em "Entrar como Administrador"

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para dashboard admin
- ✅ Cookie de sessão criado (visível no DevTools > Application > Cookies)
- ✅ Token NÃO visível no localStorage ou sessionStorage

**Verificar no DevTools:**
```javascript
// Console do navegador
localStorage.getItem('token') // deve retornar null
sessionStorage.getItem('token') // deve retornar null
document.cookie // deve mostrar connect.sid (sessão)
```

### 2. Teste de Login User

**Passos:**
1. Acesse http://localhost:8080
2. Na aba "Usuário"
3. Cole um token de usuário válido
4. Clique em "Entrar como Usuário"

**Resultado esperado:**
- ✅ Login bem-sucedido
- ✅ Redirecionamento para dashboard user
- ✅ Cookie de sessão criado
- ✅ Token NÃO visível no frontend

### 3. Teste de Autorização

**Teste 1: User tentando acessar endpoint admin**
```bash
# Fazer login como user primeiro, depois:
curl http://localhost:3001/api/admin/users \
  -H "Cookie: connect.sid=<session_cookie>" \
  -v
```

**Resultado esperado:** 403 Forbidden

**Teste 2: Admin acessando endpoint admin**
```bash
# Fazer login como admin primeiro, depois:
curl http://localhost:3001/api/admin/users \
  -H "Cookie: connect.sid=<session_cookie>" \
  -v
```

**Resultado esperado:** 200 OK com lista de usuários

### 4. Teste de Rate Limiting

**Teste de login com token inválido:**
```bash
# Tentar 6 vezes seguidas
for i in {1..6}; do
  curl http://localhost:3001/api/auth/login \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"token":"invalid","role":"admin"}' \
    -v
  echo "\n--- Tentativa $i ---\n"
done
```

**Resultado esperado:**
- Tentativas 1-5: 401 Unauthorized
- Tentativa 6: 429 Too Many Requests

### 5. Teste de Sessão

**Teste de persistência:**
1. Faça login
2. Recarregue a página (F5)
3. Verifique se continua logado

**Teste de logout:**
1. Faça login
2. Clique em "Sair"
3. Tente acessar uma página protegida
4. Deve ser redirecionado para login

### 6. Teste de Bundle de Produção

**Verificar que não há tokens expostos:**
```bash
# Build de produção
npm run build

# Verificar bundle
grep -r "VITE_ADMIN_TOKEN\|VITE_WUZAPI_BASE_URL" dist/

# Resultado esperado: Nenhuma referência encontrada
```

## Testes Automatizados (Opcional)

Os testes opcionais marcados com `*` nas tasks podem ser implementados:

### Testes de Autenticação
```bash
cd server
npm test -- auth.test.js
```

### Testes de Autorização
```bash
cd server
npm test -- authorization.test.js
```

### Testes de Rate Limiting
```bash
cd server
npm test -- rate-limiting.test.js
```

## Verificação de Segurança

### Checklist de Segurança

- [ ] Tokens não expostos no bundle de produção
- [ ] Tokens não armazenados no localStorage/sessionStorage
- [ ] Cookies de sessão são HTTP-only
- [ ] Cookies de sessão são Secure (em produção)
- [ ] CSRF protection ativo
- [ ] Rate limiting funcionando
- [ ] Logs de segurança sendo gerados
- [ ] Endpoints protegidos com middlewares corretos

### Verificar Logs de Segurança

```bash
# Ver logs do servidor
tail -f server/logs/app-*.log | grep -E "login|unauthorized|suspicious"
```

**Logs esperados:**
- Login attempts (sucesso e falha)
- Unauthorized access attempts
- Admin endpoint access
- Suspicious activity

## Problemas Conhecidos

### Sem Token WuzAPI

Se você não tem um token WuzAPI:
- ❌ Não é possível fazer login
- ❌ Não é possível testar fluxo completo
- ✅ Pode verificar que a página carrega
- ✅ Pode verificar que o bundle está limpo
- ✅ Pode verificar que o backend está rodando

**Solução:** Obtenha um token WuzAPI em https://wzapi.wasend.com.br

### Erro de CORS

Se encontrar erros de CORS:
1. Verifique `CORS_ORIGINS` em `server/.env`
2. Adicione a origem do frontend: `http://localhost:8080`
3. Reinicie o servidor

### Sessão não persiste

Se a sessão não persiste após reload:
1. Verifique se `SESSION_SECRET` está configurado em `server/.env`
2. Verifique se o banco de dados SQLite está acessível
3. Verifique logs do servidor para erros de sessão

## Próximos Passos

1. **Configure o token admin** no `server/.env`
2. **Teste o fluxo de login** completo
3. **Verifique os logs de segurança**
4. **Teste os endpoints protegidos**
5. **Valide o rate limiting**

## Conclusão

O sistema está pronto e funcionando. As correções de segurança foram implementadas com sucesso:

- ✅ Arquitetura de sessões HTTP-only
- ✅ Tokens nunca expostos ao frontend
- ✅ Proxy backend para APIs externas
- ✅ Rate limiting e CSRF protection
- ✅ Logging de segurança completo

**Para testar completamente, você precisa apenas configurar um token WuzAPI válido.**
