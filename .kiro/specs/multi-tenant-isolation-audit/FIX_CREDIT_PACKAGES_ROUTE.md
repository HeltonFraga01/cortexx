# Correção: Rota de Pacotes de Créditos (Credit Packages) - 404 Error

## Data: 2025-12-25

## Status: ✅ CORRIGIDO

## Problema Identificado

A rota `/api/admin/credit-packages` retornava erro 404 "Rota não encontrada" quando acessada via `cortexx.localhost:8080/admin/stripe` na aba "Créditos".

### Sintomas
- Request: `GET http://cortexx.localhost:8080/api/admin/credit-packages`
- Response: `{"success":false,"error":"Rota não encontrada","code":404}`
- Authorization header continha JWT válido com `tenant_id` e `role: "admin"`

## Causas Raiz (2 problemas)

### Problema 1: Rota não registrada no servidor principal

A rota `adminCreditPackagesRoutes` foi criada em `server/routes/adminCreditPackagesRoutes.js` e registrada em `server/routes/index.js`, porém o arquivo `server/routes/index.js` **NÃO é utilizado** pelo servidor.

O servidor principal (`server/index.js`) registra as rotas diretamente, e a rota de credit-packages não estava importada nem registrada nesse arquivo.

### Problema 2: Middleware incorreto

O arquivo `adminCreditPackagesRoutes.js` usava `authenticate` como middleware, mas esse nome não é exportado pelo módulo `auth.js`. O nome correto é `requireAuth`.

## Correções Aplicadas

### 1. Adicionada importação em `server/index.js`

```javascript
const adminSettingsRoutes = require('./routes/adminSettingsRoutes');
const adminApiSettingsRoutes = require('./routes/adminApiSettingsRoutes');
const adminStripeRoutes = require('./routes/adminStripeRoutes');
const adminCreditPackagesRoutes = require('./routes/adminCreditPackagesRoutes'); // ADICIONADO
const stripeWebhookRoutes = require('./routes/stripeWebhookRoutes');
```

### 2. Adicionado registro da rota em `server/index.js`

```javascript
app.use('/api/admin/settings', adminSettingsRoutes);
app.use('/api/admin/api-settings', adminApiSettingsRoutes);
app.use('/api/admin/stripe', adminStripeRoutes);
app.use('/api/admin/credit-packages', adminCreditPackagesRoutes); // ADICIONADO
// Generic admin routes
```

### 3. Corrigido middleware em `server/routes/adminCreditPackagesRoutes.js`

```javascript
// ANTES (incorreto)
const { authenticate, requireAdmin } = require('../middleware/auth');
router.get('/', authenticate, requireAdmin, async (req, res) => { ... });

// DEPOIS (correto)
const { requireAuth, requireAdmin } = require('../middleware/auth');
router.get('/', requireAuth, requireAdmin, async (req, res) => { ... });
```

## Verificações Realizadas

1. ✅ Tenant `cortexx` existe e está ativo (ID: `47c1b641-8389-4c8a-9eba-e17a113d8e70`)
2. ✅ Tabela `tenant_credit_packages` existe com estrutura correta
3. ✅ Serviço `TenantCreditPackageService` implementado corretamente
4. ✅ Middleware `subdomainRouter` define `req.context.tenantId` corretamente
5. ✅ Middleware `requireAdmin` aplicado globalmente a `/api/admin/*`
6. ✅ Sem erros de sintaxe nos arquivos modificados
7. ✅ Servidor reiniciou com sucesso
8. ✅ Pacote de crédito criado com sucesso (ID: `53db0788-da5f-4487-b8e5-95b725fce43a`)

## Lições Aprendidas

1. O projeto tem dois arquivos de registro de rotas: `server/index.js` (usado) e `server/routes/index.js` (não usado)
2. Novas rotas devem ser registradas em `server/index.js`, não em `server/routes/index.js`
3. A documentação em `.kiro/steering/structure.md` menciona `server/routes/index.js`, mas o servidor não usa esse arquivo
4. O middleware de autenticação correto é `requireAuth`, não `authenticate`
