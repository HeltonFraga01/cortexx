# Correções Admin Dashboard - Resumo

## Data: 2024-11-16

## Problema Identificado

O dashboard admin estava retornando erro 401 (Unauthorized) ao tentar buscar dados da API WuzAPI. Os endpoints `/api/admin/dashboard-stats` e `/api/admin/users` não estavam funcionando.

## Causa Raiz

1. **Endpoint `/api/admin/dashboard-stats`** ainda usava validação de token antiga com `Authorization` header
2. **Rotas admin** não tinham middleware `requireAdmin` aplicado
3. **Endpoint `/api/admin/users`** esperava token no header `Authorization` em vez de usar sessão

## Correções Aplicadas

### 1. ✅ server/routes/index.js - Endpoint dashboard-stats
**Antes:**
```javascript
app.get('/api/admin/dashboard-stats', async (req, res) => {
  const authHeader = req.headers.authorization;
  const adminToken = process.env.VITE_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
  
  if (!authHeader || authHeader !== adminToken) {
    return res.status(401).json({...});
  }
```

**Depois:**
```javascript
app.get('/api/admin/dashboard-stats', (req, res, next) => {
  // Verificar se está autenticado como admin
  if (!req.session?.userId || req.session?.role !== 'admin') {
    return res.status(401).json({...});
  }
  next();
}, async (req, res) => {
  const adminToken = process.env.WUZAPI_ADMIN_TOKEN || 'UeH7cZ2c1K3zVUBFi7SginSC';
```

### 2. ✅ server/index.js - Middleware requireAdmin
**Adicionado:**
```javascript
// Importar middleware de autenticação
const { requireAdmin } = require('./middleware/auth');

// Aplicar middleware requireAdmin a todas as rotas admin
app.use('/api/admin', requireAdmin);

// Rotas admin (protegidas pelo middleware acima)
app.use('/api/admin', adminRoutes);
app.use('/api/admin/branding', brandingRoutes);
app.use('/api/admin/landing-page', landingPageRoutes);
app.use('/api/admin/table-permissions', adminTablePermissionsRoutes);
app.use('/api/admin/tables', adminTablesRoutes);
app.use('/api/admin/database-connections', adminDatabaseUsersRoutes);
```

### 3. ✅ server/routes/adminRoutes.js - Endpoint /users
**Antes:**
```javascript
router.get('/users',
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => {
    const token = req.headers.authorization;
```

**Depois:**
```javascript
router.get('/users',
  async (req, res) => {
    // Obter token da sessão (já validado pelo middleware requireAdmin)
    const token = req.session.userToken || process.env.WUZAPI_ADMIN_TOKEN;
```

## Arquivos Modificados

1. `server/routes/index.js` - Endpoint `/api/admin/dashboard-stats`
2. `server/index.js` - Adicionado middleware `requireAdmin`
3. `server/routes/adminRoutes.js` - Endpoint `/api/admin/users`

## Status

✅ **Correções aplicadas**
⚠️ **Servidor precisa ser reiniciado** para aplicar as mudanças

## Próximos Passos

1. Reiniciar o servidor backend
2. Testar dashboard admin
3. Verificar se os dados estão carregando corretamente
4. Verificar outros endpoints admin que possam ter o mesmo problema

## Endpoints Admin que Podem Precisar de Correção

Outros endpoints em `adminRoutes.js` que podem estar usando o padrão antigo:
- `/api/admin/stats`
- `/api/admin/users/:userId`
- `POST /api/admin/users`
- `DELETE /api/admin/users/:userId`
- `DELETE /api/admin/users/:userId/full`

Todos esses endpoints devem ser verificados e atualizados para usar `req.session.userToken` em vez de `req.headers.authorization`.

## Comando para Reiniciar

```bash
# Parar o servidor
# Ctrl+C no terminal onde está rodando

# Ou reiniciar o processo
npm run server:dev
```

## Verificação

Após reiniciar, verificar:
1. Dashboard admin carrega sem erros 401
2. Estatísticas são exibidas corretamente
3. Lista de usuários é carregada
4. Todos os cards mostram dados reais (não "0")
