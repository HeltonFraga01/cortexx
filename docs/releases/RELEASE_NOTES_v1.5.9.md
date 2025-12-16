# Release Notes - v1.5.9

**Data de Lançamento**: 17 de Novembro de 2025

## 🎯 Objetivo da Release

Correção crítica de autenticação para permitir que ferramentas de automação externa (n8n, Zapier, Make) possam chamar as APIs de database-connections usando apenas o token de admin no header, sem necessidade de sessão ativa.

## 🐛 Correções

### Autenticação para APIs Externas

**Problema**: Mesmo após remover a proteção CSRF (v1.5.8), as rotas ainda retornavam erro 401 "Autenticação necessária" porque o middleware `requireAdmin` exigia uma sessão ativa.

**Solução**: 
- Novo middleware `requireAdminToken` que valida apenas o token no header `Authorization`
- Rotas `/api/admin/database-connections/*` agora usam `requireAdminToken` ao invés de `requireAdmin`
- Não requer mais sessão ativa para chamadas de APIs externas
- Mantém validação de token de admin para segurança

**Fluxo de Autenticação**:
```
Antes (v1.5.8):
n8n → Header: Authorization → requireAdmin → ❌ 401 (sem sessão)

Depois (v1.5.9):
n8n → Header: Authorization → requireAdminToken → ✅ 200 (token válido)
```

## ✨ Adicionado

### Middleware `requireAdminToken`

Novo middleware em `server/middleware/auth.js`:

```javascript
function requireAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.VITE_ADMIN_TOKEN;
  
  if (!authHeader || authHeader !== adminToken) {
    return res.status(401).json({ 
      error: 'Token de administrador inválido',
      code: 'INVALID_ADMIN_TOKEN'
    });
  }
  
  next();
}
```

**Características**:
- Valida token diretamente do header `Authorization`
- Não requer sessão ativa
- Logs de segurança para tentativas de acesso
- Compatível com ferramentas de automação

## 🔧 Melhorias

### Ordem de Middlewares

Reorganização da aplicação de middlewares em `server/index.js`:

```javascript
// ANTES: requireAdmin aplicado a TODAS as rotas /api/admin/*
app.use('/api/admin', requireAdmin);
app.use('/api/admin/database-connections', adminDatabaseUsersRoutes);

// DEPOIS: database-connections registrado ANTES do requireAdmin global
app.use('/api/admin/database-connections', adminDatabaseUsersRoutes);
app.use('/api/admin', requireAdmin);
```

**Benefícios**:
- Permite autenticação via token sem conflito com autenticação via sessão
- Outras rotas admin continuam usando autenticação via sessão
- Separação clara entre APIs para frontend (sessão) e APIs para automação (token)

## 📦 Deployment

### Imagem Docker

```bash
# Pull da imagem
docker pull heltonfraga/wuzapi-manager:v1.5.9

# Ou usar latest
docker pull heltonfraga/wuzapi-manager:latest
```

### Arquiteturas Suportadas

- ✅ linux/amd64
- ✅ linux/arm64

### Atualização no Docker Swarm

```bash
# Atualizar serviço existente
docker service update --image heltonfraga/wuzapi-manager:v1.5.9 wuzapi-manager_wuzapi-manager

# Verificar status
docker service ps wuzapi-manager_wuzapi-manager

# Acompanhar logs
docker service logs wuzapi-manager_wuzapi-manager -f
```

## 🔧 Integração com n8n

### Exemplo Completo de Configuração

```json
{
  "method": "POST",
  "url": "https://seu-dominio.com/api/admin/database-connections/{{connectionId}}/users",
  "headers": {
    "Authorization": "{{admin_token}}",
    "Content-Type": "application/json"
  },
  "body": {
    "user_ids": ["{{user_token}}"],
    "create_permissions": true,
    "permissions": {
      "can_read": true,
      "can_write": false,
      "can_delete": false
    }
  }
}
```

### Headers Necessários

- ✅ `Authorization`: Token de admin (obrigatório)
- ✅ `Content-Type`: application/json (obrigatório)
- ❌ `CSRF-Token`: Não é necessário
- ❌ `Cookie`: Não é necessário (sem sessão)

### Endpoints Disponíveis

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/admin/database-connections/:id/users` | Atribuir usuários |
| DELETE | `/api/admin/database-connections/:id/users/:userId` | Remover usuário |
| GET | `/api/admin/database-connections/:id/users` | Listar usuários |

## 📝 Notas de Upgrade

### De v1.5.8 para v1.5.9

1. **Sem Breaking Changes**: Atualização compatível
2. **Sem Migrations**: Nenhuma alteração no banco de dados
3. **Configuração**: Nenhuma mudança necessária em variáveis de ambiente
4. **Downtime**: Zero (rolling update no Docker Swarm)

### Checklist de Atualização

- [ ] Fazer backup do banco de dados (`/app/data/wuzapi.db`)
- [ ] Atualizar imagem Docker para v1.5.9
- [ ] Verificar health check (`GET /health`)
- [ ] Testar integração n8n
- [ ] Verificar logs para erros

## 🧪 Testes

### Validação da Correção

```bash
# Testar endpoint com token no header (SEM sessão)
curl -X POST https://seu-dominio.com/api/admin/database-connections/1/users \
  -H "Authorization: seu_admin_token" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["user_token"]}'

# Deve retornar 201 Created (não mais 401 Unauthorized)
```

### Teste de Segurança

```bash
# Testar com token inválido
curl -X POST https://seu-dominio.com/api/admin/database-connections/1/users \
  -H "Authorization: token_invalido" \
  -H "Content-Type: application/json" \
  -d '{"user_ids": ["user_token"]}'

# Deve retornar 401 com erro "Token de administrador inválido"
```

## 📊 Estatísticas da Release

- **Arquivos Modificados**: 6
  - `server/middleware/auth.js` (novo middleware)
  - `server/routes/adminDatabaseUsersRoutes.js` (usar novo middleware)
  - `server/index.js` (ordem de middlewares + versão)
  - `package.json` (versão)
  - `server/package.json` (versão)
  - `CHANGELOG.md` (documentação)

- **Linhas de Código**: ~50 linhas adicionadas/modificadas
- **Tempo de Build**: ~2 minutos (multi-arch)
- **Tamanho da Imagem**: ~450 MB (comprimido)

## 🔒 Segurança

### Validações Mantidas

- ✅ Token de admin validado em cada requisição
- ✅ Rate limiting aplicado (via `adminLimiter`)
- ✅ Logs de segurança para tentativas de acesso
- ✅ Outras rotas admin continuam protegidas por sessão + CSRF

### Considerações

- Token de admin deve ser mantido em segredo
- Use HTTPS em produção para proteger o token em trânsito
- Monitore logs para tentativas de acesso não autorizado

## 🔗 Links Úteis

- [CHANGELOG Completo](../../CHANGELOG.md)
- [Release Notes v1.5.8](./RELEASE_NOTES_v1.5.8.md)
- [Documentação de Deploy](../deployment/)
- [Guia de Integração n8n](../../docs/integrations/n8n.md) (em breve)

## 👥 Contribuidores

- [@heltonfraga](https://github.com/heltonfraga) - Correção de autenticação

---

**Versão Anterior**: [v1.5.8](./RELEASE_NOTES_v1.5.8.md)
**Próxima Versão**: TBD
