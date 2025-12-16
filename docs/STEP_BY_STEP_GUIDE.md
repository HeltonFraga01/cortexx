# Guia Passo-a-Passo: Adicionando Nova Funcionalidade

Este guia fornece instruções detalhadas para implementar uma nova funcionalidade completa no WUZAPI Manager, desde o planejamento até o deploy.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Fase 1: Planejamento](#fase-1-planejamento)
- [Fase 2: Backend Development](#fase-2-backend-development)
- [Fase 3: Frontend Development](#fase-3-frontend-development)
- [Fase 4: Integração e Testes](#fase-4-integração-e-testes)
- [Fase 5: Documentação](#fase-5-documentação)
- [Fase 6: Deploy](#fase-6-deploy)
- [Exemplo Prático Completo](#exemplo-prático-completo)
- [Checklist Final](#checklist-final)

## Visão Geral

### Metodologia
Este guia segue uma abordagem estruturada em 6 fases:
1. **Planejamento** - Definir requisitos e arquitetura
2. **Backend** - Implementar APIs e lógica de negócio
3. **Frontend** - Criar interfaces e componentes
4. **Integração** - Conectar frontend e backend
5. **Documentação** - Documentar a funcionalidade
6. **Deploy** - Publicar em produção

### Ferramentas Utilizadas
- **CLI Generator**: Para gerar código padronizado
- **Git**: Para controle de versão
- **Postman**: Para testar APIs
- **Browser DevTools**: Para debug frontend

## Fase 1: Planejamento

### 1.1 Definir Requisitos

#### ✅ Checklist de Planejamento
- [ ] Definir objetivo da funcionalidade
- [ ] Identificar usuários-alvo (admin, user, público)
- [ ] Listar funcionalidades específicas
- [ ] Definir critérios de aceitação
- [ ] Identificar dependências externas
- [ ] Estimar complexidade e tempo

#### 📝 Template de Requisitos
```markdown
## Funcionalidade: [Nome da Funcionalidade]

### Objetivo
Descrever o que a funcionalidade deve fazer e por quê.

### Usuários-Alvo
- [ ] Administradores
- [ ] Usuários finais
- [ ] APIs externas

### Funcionalidades
1. [Funcionalidade 1]
2. [Funcionalidade 2]
3. [Funcionalidade 3]

### Critérios de Aceitação
- [ ] Critério 1
- [ ] Critério 2
- [ ] Critério 3

### Dependências
- Integração com [Sistema X]
- Permissões de [Tipo Y]
- Dados de [Fonte Z]
```

### 1.2 Planejar Arquitetura

#### 🏗️ Definir Estrutura
```bash
# Backend
server/routes/[funcionalidade]Routes.js
server/middleware/[funcionalidade]Middleware.js (se necessário)
server/validators/[funcionalidade]Validator.js (se necessário)

# Frontend
src/components/[dominio]/[Funcionalidade].tsx
src/hooks/use[Funcionalidade].ts
src/services/[funcionalidade]Service.ts
src/pages/[Funcionalidade]Page.tsx (se necessário)
```

#### 🗄️ Planejar Dados
```sql
-- Definir estrutura de dados (se necessário)
CREATE TABLE [tabela] (
  id INTEGER PRIMARY KEY,
  user_token TEXT,
  -- campos específicos
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.3 Criar Branch

```bash
# Criar branch para a funcionalidade
git checkout -b feature/[nome-da-funcionalidade]

# Exemplo
git checkout -b feature/sistema-notificacoes
```

## Fase 2: Backend Development

### 2.1 Gerar Estrutura Backend

#### 🚀 Usar CLI Generator
```bash
# Gerar rota principal
npm run generate route [tipo]-[funcionalidade]

# Exemplos
npm run generate route admin-notifications  # Para funcionalidade admin
npm run generate route user-profile        # Para funcionalidade de usuário
npm run generate route public-status       # Para funcionalidade pública
```

#### ⚙️ Configurar Rota Interativamente
```bash
$ npm run generate route admin-notifications

Selecione o template base:
  1. Rota administrativa (requer token admin)
  2. Rota de usuário (requer token user)
  3. Rota pública (sem autenticação)
  4. Rota de integração externa

Escolha: 1

Método HTTP:
  1. GET
  2. POST
  3. PUT
  4. DELETE

Escolha: 1

Endpoint: notifications
Descrição: Gerenciar notificações do sistema
```

### 2.2 Implementar Lógica de Negócio

#### 📝 Editar Arquivo Gerado
```javascript
// server/routes/admin-notificationsRoutes.js

// 1. Implementar validações específicas
if (!requestData.title || requestData.title.trim().length === 0) {
  return res.status(400).json({
    success: false,
    error: 'Título da notificação é obrigatório',
    code: 400,
    timestamp: new Date().toISOString()
  });
}

// 2. Implementar lógica de negócio
const db = req.app.locals.db;

// Para GET - Listar notificações
const notifications = await db.query(
  'SELECT * FROM notifications WHERE user_token = ? ORDER BY created_at DESC',
  [userToken]
);

// Para POST - Criar notificação
const result = await db.query(
  'INSERT INTO notifications (title, message, user_token) VALUES (?, ?, ?)',
  [requestData.title, requestData.message, userToken]
);

// 3. Retornar resposta padronizada
return res.status(200).json({
  success: true,
  code: 200,
  data: notifications.rows,
  message: 'Notificações recuperadas com sucesso',
  timestamp: new Date().toISOString()
});
```

### 2.3 Registrar Rota

#### 📋 Adicionar no Servidor Principal
```javascript
// server/index.js

// Adicionar import
const notificationsRoutes = require('./routes/admin-notificationsRoutes');

// Registrar rota
app.use('/api/admin/notifications', notificationsRoutes);
```

### 2.4 Testar Backend

#### 🧪 Testar com cURL
```bash
# Testar GET
curl -X GET http://localhost:3001/api/admin/notifications \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN"

# Testar POST
curl -X POST http://localhost:3001/api/admin/notifications \
  -H "Authorization: Bearer SEU_TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Teste",
    "message": "Mensagem de teste"
  }'
```

#### 📮 Testar com Postman
1. Criar nova collection "Funcionalidade [Nome]"
2. Adicionar requests para cada endpoint
3. Configurar variáveis de ambiente
4. Testar cenários de sucesso e erro

## Fase 3: Frontend Development

### 3.1 Gerar Estrutura Frontend

#### 🎨 Gerar Serviço
```bash
npm run generate service notificationsService

# Configurar interativamente:
# Tipo de dados: Notification
# Conectar com API: Sim
# Incluir CRUD: Sim
```

#### 🪝 Gerar Hook (se necessário)
```bash
npm run generate hook useNotifications

# Configurar:
# Tipo de dados: Notification
# Conectar com API: Sim
# Incluir CRUD: Sim
```

#### 🧩 Gerar Componente/Página
```bash
# Para página completa
npm run generate page AdminNotifications

# Para componente reutilizável
npm run generate component NotificationCard
```

### 3.2 Implementar Serviço

#### 🔧 Configurar Tipos e Interfaces
```typescript
// src/services/notificationsService.ts

export interface Notification {
  id: string;
  title: string;
  message: string;
  status: 'read' | 'unread';
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotificationRequest {
  title: string;
  message: string;
}
```

#### 🌐 Implementar Métodos da API
```typescript
// Implementar nos TODOs do template gerado

async getAll(): Promise<Notification[]> {
  try {
    const response = await this.api.get<ApiResponse<Notification[]>>('/admin/notifications');
    return response.data || [];
  } catch (error) {
    console.error('Erro ao buscar notificações:', error);
    throw error;
  }
}

async create(data: CreateNotificationRequest): Promise<Notification> {
  try {
    this.validateCreateData(data);
    const response = await this.api.post<ApiResponse<Notification>>('/admin/notifications', data);
    
    if (!response.data) {
      throw new Error('Resposta inválida do servidor');
    }

    return response.data;
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    throw error;
  }
}
```

### 3.3 Implementar Componentes

#### 🎯 Configurar Página Principal
```typescript
// src/pages/AdminNotifications.tsx

// 1. Substituir tipos genéricos
interface NotificationData {
  id: string;
  title: string;
  message: string;
  status: 'read' | 'unread';
  createdAt: string;
}

// 2. Configurar serviço
const notificationsService = new NotificationsService();

// 3. Implementar operações CRUD
const handleCreate = async (formData: CreateNotificationRequest) => {
  try {
    const newNotification = await notificationsService.create(formData);
    setItems(prev => [newNotification, ...prev]);
    toast.success('Notificação criada com sucesso!');
    setShowCreateForm(false);
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    toast.error('Erro ao criar notificação');
  }
};
```

#### 🎨 Personalizar Interface
```typescript
// Personalizar campos do formulário
<div className="space-y-4">
  <div>
    <Label htmlFor="title">Título</Label>
    <Input 
      id="title" 
      placeholder="Digite o título da notificação"
      value={formData.title}
      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
    />
  </div>
  
  <div>
    <Label htmlFor="message">Mensagem</Label>
    <Textarea 
      id="message" 
      placeholder="Digite a mensagem da notificação"
      value={formData.message}
      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
    />
  </div>
</div>
```

### 3.4 Integrar na Aplicação

#### 🗺️ Adicionar Rotas
```typescript
// src/App.tsx ou arquivo de rotas

import AdminNotifications from '@/pages/AdminNotifications';

// Adicionar rota
<Route path="/admin/notifications" element={<AdminNotifications />} />
```

#### 🧭 Adicionar Navegação
```typescript
// src/components/admin/AdminSidebar.tsx

<NavItem 
  href="/admin/notifications" 
  icon={Bell}
  label="Notificações"
/>
```

## Fase 4: Integração e Testes

### 4.1 Testar Integração

#### 🔗 Verificar Comunicação Frontend-Backend
```bash
# 1. Iniciar backend
npm run server:dev

# 2. Iniciar frontend
npm run dev

# 3. Testar no browser
# - Abrir http://localhost:8080/admin/notifications
# - Testar operações CRUD
# - Verificar Network tab no DevTools
```

#### 🐛 Debug de Problemas Comuns
```typescript
// Frontend - Adicionar logs temporários
console.log('Dados enviados:', formData);
console.log('Resposta recebida:', response);

// Backend - Verificar logs
logger.info('Dados recebidos:', requestData);
logger.info('Resultado da query:', result);
```

### 4.2 Testar Cenários de Erro

#### ❌ Testar Validações
- [ ] Campos obrigatórios vazios
- [ ] Dados inválidos
- [ ] Token expirado/inválido
- [ ] Permissões insuficientes

#### 🌐 Testar Conectividade
- [ ] Servidor offline
- [ ] Timeout de requisição
- [ ] Erro 500 do servidor
- [ ] Resposta malformada

### 4.3 Testar Responsividade

#### 📱 Dispositivos Móveis
```bash
# Testar em diferentes tamanhos
# - Mobile (375px)
# - Tablet (768px)
# - Desktop (1024px+)
```

#### ♿ Testar Acessibilidade
- [ ] Navegação por teclado
- [ ] Screen readers
- [ ] Contraste de cores
- [ ] Labels apropriados

## Fase 5: Documentação

### 5.1 Documentar API

#### 📚 Atualizar Documentação da API
```yaml
# docs/api/notifications.yaml
paths:
  /api/admin/notifications:
    get:
      summary: Listar notificações
      tags: [Admin, Notifications]
      security:
        - AdminToken: []
      responses:
        200:
          description: Lista de notificações
          content:
            application/json:
              schema:
                type: object
                properties:
                  success:
                    type: boolean
                  data:
                    type: array
                    items:
                      $ref: '#/components/schemas/Notification'
```

### 5.2 Documentar Componentes

#### 🧩 Criar README do Componente
```markdown
# AdminNotifications

Componente para gerenciamento de notificações administrativas.

## Props

| Prop | Tipo | Obrigatório | Descrição |
|------|------|-------------|-----------|
| title | string | Não | Título da página |

## Uso

```tsx
import AdminNotifications from '@/pages/AdminNotifications';

<AdminNotifications title="Gerenciar Notificações" />
```

## Funcionalidades

- [x] Listar notificações
- [x] Criar nova notificação
- [x] Editar notificação
- [x] Deletar notificação
- [x] Busca e filtros
```

### 5.3 Atualizar Guias

#### 📖 Adicionar aos Guias Existentes
```markdown
# docs/DEVELOPMENT_GUIDE.md

## Exemplos de Funcionalidades Implementadas

### Sistema de Notificações
- **Backend**: `/api/admin/notifications`
- **Frontend**: `AdminNotifications` page
- **Serviço**: `notificationsService`
- **Hook**: `useNotifications`

### Navegação Dinâmica de Bancos de Dados
- **Backend**: `/api/user/database-connections/:id/record`
- **Frontend**: `DynamicDatabaseItems`, `DirectEditPage`
- **Serviço**: `database-connections` service
- **Documentação**: `docs/USER_DATABASE_NAVIGATION_GUIDE.md`
- **Guia Rápido**: `docs/QUICK_START_DATABASE_NAVIGATION.md`
```

## Fase 6: Deploy

### 6.1 Preparar para Deploy

#### 🧪 Executar Testes Finais
```bash
# Testes unitários
npm run test

# Lint
npm run lint

# Build de produção
npm run build:production
```

#### 📝 Commit das Alterações
```bash
# Adicionar arquivos
git add .

# Commit com mensagem descritiva
git commit -m "feat: implementar sistema de notificações administrativas

- Adicionar rota GET/POST /api/admin/notifications
- Criar página AdminNotifications com CRUD completo
- Implementar notificationsService e useNotifications hook
- Adicionar validações e tratamento de erros
- Documentar API e componentes

Closes #123"
```

### 6.2 Deploy

#### 🚀 Merge e Deploy
```bash
# Fazer merge na branch principal
git checkout main
git merge feature/sistema-notificacoes

# Deploy (se automatizado)
git push origin main

# Deploy manual (se necessário)
npm run deploy:build
./deploy-swarm.sh
```

#### ✅ Verificar Deploy
```bash
# Verificar se aplicação está rodando
curl -X GET https://seu-dominio.com/api/health

# Testar nova funcionalidade
curl -X GET https://seu-dominio.com/api/admin/notifications \
  -H "Authorization: Bearer TOKEN"
```

## Exemplo Prático Completo

### Cenário: Sistema de Categorias de Produtos

Vamos implementar um sistema completo para gerenciar categorias de produtos.

#### Fase 1: Planejamento
```markdown
## Funcionalidade: Sistema de Categorias de Produtos

### Objetivo
Permitir que administradores gerenciem categorias de produtos para organizar o catálogo.

### Usuários-Alvo
- [x] Administradores

### Funcionalidades
1. Listar todas as categorias
2. Criar nova categoria
3. Editar categoria existente
4. Deletar categoria
5. Buscar categorias por nome

### Critérios de Aceitação
- [x] Admin pode ver lista de categorias
- [x] Admin pode criar categoria com nome e descrição
- [x] Admin pode editar categoria existente
- [x] Admin pode deletar categoria (com confirmação)
- [x] Sistema valida nome único
- [x] Interface responsiva
```

#### Fase 2: Backend
```bash
# 1. Gerar rota
npm run generate route admin-categories
# Selecionar: Administrativa, GET, categories, "Gerenciar categorias de produtos"

# 2. Implementar lógica
# Editar server/routes/admin-categoriesRoutes.js
# Adicionar validações e operações CRUD

# 3. Registrar rota
# Adicionar em server/index.js:
# app.use('/api/admin/categories', require('./routes/admin-categoriesRoutes'));

# 4. Testar
curl -X GET http://localhost:3001/api/admin/categories \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### Fase 3: Frontend
```bash
# 1. Gerar serviço
npm run generate service categoriesService
# Configurar: Category, CategoryService, category, categories

# 2. Gerar página
npm run generate page AdminCategories
# Selecionar: Administrativa, Formulário: Sim, CRUD: Sim, Busca: Sim

# 3. Implementar tipos específicos
# Editar interfaces para Category
# Implementar métodos do serviço
# Personalizar formulários

# 4. Integrar na aplicação
# Adicionar rota no React Router
# Adicionar item no menu admin
```

#### Fase 4: Integração
```bash
# 1. Testar fluxo completo
# - Criar categoria
# - Listar categorias
# - Editar categoria
# - Deletar categoria

# 2. Testar cenários de erro
# - Nome duplicado
# - Campos obrigatórios
# - Token inválido

# 3. Testar responsividade
# - Mobile, tablet, desktop
```

#### Fase 5: Documentação
```yaml
# Atualizar docs/api/categories.yaml
# Criar README para AdminCategories
# Adicionar exemplo no guia de desenvolvimento
```

#### Fase 6: Deploy
```bash
# 1. Commit
git add .
git commit -m "feat: implementar sistema de categorias de produtos"

# 2. Deploy
git push origin main
```

## Checklist Final

### ✅ Backend
- [ ] Rota gerada com CLI
- [ ] Lógica de negócio implementada
- [ ] Validações adicionadas
- [ ] Rota registrada no servidor
- [ ] Testado com cURL/Postman
- [ ] Logs estruturados adicionados
- [ ] Tratamento de erros implementado

### ✅ Frontend
- [ ] Serviço gerado e configurado
- [ ] Componente/página implementado
- [ ] Tipos TypeScript definidos
- [ ] Formulários funcionando
- [ ] Estados de loading/error
- [ ] Integrado na aplicação
- [ ] Navegação adicionada

### ✅ Integração
- [ ] Comunicação frontend-backend testada
- [ ] Cenários de erro testados
- [ ] Responsividade verificada
- [ ] Acessibilidade testada
- [ ] Performance adequada

### ✅ Documentação
- [ ] API documentada
- [ ] Componentes documentados
- [ ] Guias atualizados
- [ ] Exemplos adicionados

### ✅ Deploy
- [ ] Testes executados
- [ ] Build de produção funcionando
- [ ] Commit com mensagem clara
- [ ] Deploy realizado
- [ ] Funcionalidade verificada em produção

### ✅ Qualidade
- [ ] Código segue padrões do projeto
- [ ] TODOs implementados
- [ ] Sem warnings de lint
- [ ] Performance adequada
- [ ] Segurança verificada

---

**Dica**: Use este guia como checklist para cada nova funcionalidade. Adapte conforme necessário para funcionalidades específicas.

**Próximos Passos**: Após dominar este fluxo, explore funcionalidades mais avançadas como WebSockets, integrações complexas e otimizações de performance.