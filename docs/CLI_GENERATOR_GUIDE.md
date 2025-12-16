# Guia do CLI de Geração de Código

Este guia documenta o uso do CLI de geração de código do WUZAPI Manager, uma ferramenta que automatiza a criação de código seguindo os padrões estabelecidos no projeto.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Instalação e Configuração](#instalação-e-configuração)
- [Comandos Disponíveis](#comandos-disponíveis)
- [Tipos de Geração](#tipos-de-geração)
- [Fluxo Interativo](#fluxo-interativo)
- [Templates Disponíveis](#templates-disponíveis)
- [Exemplos Práticos](#exemplos-práticos)
- [Personalização](#personalização)
- [Troubleshooting](#troubleshooting)

## Visão Geral

### O que é o CLI Generator?
O CLI Generator é uma ferramenta de linha de comando que automatiza a criação de:
- Rotas backend Express.js
- Componentes React/TypeScript
- Páginas completas
- Custom hooks
- Serviços de API
- Testes básicos

### Benefícios
- **Consistência**: Todos os arquivos seguem os mesmos padrões
- **Produtividade**: Reduz tempo de setup inicial
- **Qualidade**: Inclui validações e tratamento de erros
- **Documentação**: Gera código autodocumentado
- **Manutenibilidade**: Facilita atualizações em massa

## Instalação e Configuração

### Pré-requisitos
- Node.js 18+
- npm ou yarn
- Projeto WUZAPI Manager configurado

### Verificação
```bash
# Verificar se CLI está disponível
npm run generate:help

# Listar geradores disponíveis
npm run generate -- --list

# Testar funcionalidades básicas
npm run generate:test
```

## Comandos Disponíveis

### Comando Principal
```bash
npm run generate <type> <name> [options]
```

### Comandos de Ajuda
```bash
# Ajuda geral
npm run generate:help
npm run generate -- --help

# Listar todos os geradores
npm run generate -- --list
npm run generate -- -l
```

### Comando de Teste
```bash
# Executar testes do CLI
npm run generate:test
```

## Tipos de Geração

### 1. Route (Rotas Backend)
Gera rotas Express.js com autenticação e validação.

```bash
npm run generate route <name>

# Exemplos
npm run generate route admin-users
npm run generate route user-profile
npm run generate route public-health
```

**Características:**
- Validação de token automática
- Logging estruturado
- Tratamento de erros padronizado
- Documentação inline
- Middleware de validação

### 2. Component (Componentes React)
Gera componentes React reutilizáveis.

```bash
npm run generate component <name>

# Exemplos
npm run generate component ProductCard
npm run generate component UserModal
npm run generate component DataTable
```

**Características:**
- TypeScript completo
- Props tipadas
- Estados de loading/error
- Integração com shadcn/ui
- Responsividade

### 3. Page (Páginas React)
Gera páginas completas com layout e funcionalidades.

```bash
npm run generate page <name>

# Exemplos
npm run generate page AdminProducts
npm run generate page UserDashboard
npm run generate page PublicLanding
```

**Características:**
- Layout completo
- Operações CRUD
- Sistema de busca/filtros
- Formulários integrados
- Gerenciamento de estado

### 4. Hook (Custom Hooks)
Gera hooks personalizados para gerenciamento de estado.

```bash
npm run generate hook <name>

# Exemplos
npm run generate hook useProducts
npm run generate hook useAuth
npm run generate hook useWebSocket
```

**Características:**
- Gerenciamento de estado completo
- Operações CRUD
- Cache e refresh
- Tratamento de erros
- TypeScript tipado

### 5. Service (Serviços de API)
Gera serviços para comunicação com APIs.

```bash
npm run generate service <name>

# Exemplos
npm run generate service productsService
npm run generate service authService
npm run generate service webhookService
```

**Características:**
- Cliente HTTP configurado
- Interceptors para auth/error
- Métodos CRUD completos
- Validação de dados
- Tratamento de erros

## Fluxo Interativo

### Exemplo: Gerando uma Rota
```bash
$ npm run generate route admin-products

🚀 Gerador de Código WUZAPI Manager
ℹ Gerando route: admin-products

Selecione o template base:
  1. Rota administrativa (requer token admin)
  2. Rota de usuário (requer token user)
  3. Rota pública (sem autenticação)
  4. Rota de integração externa

Escolha uma opção (número): 1

Método HTTP:
  1. GET
  2. POST
  3. PUT
  4. DELETE
  5. PATCH

Escolha uma opção (número): 1

Endpoint da rota (ex: users, settings): products
Descrição da operação: Listar produtos do sistema

✓ Arquivo criado: server/routes/admin-productsRoutes.js

📋 Próximos Passos:
1. Registre a rota no server/index.js:
   app.use('/api/admin-products', require('./routes/admin-productsRoutes'));
2. Implemente a lógica específica nos comentários TODO
3. Teste a rota com Postman ou curl
4. Adicione validações específicas se necessário

📁 Arquivo gerado: server/routes/admin-productsRoutes.js

✨ Código gerado com sucesso!
```

### Exemplo: Gerando um Componente
```bash
$ npm run generate component ProductCard

🚀 Gerador de Código WUZAPI Manager
ℹ Gerando component: ProductCard

Selecione o template base:
  1. Página administrativa com CRUD completo
  2. Página de usuário com perfil e configurações
  3. Componente reutilizável

Escolha uma opção (número): 3

Tipo de componente:
  1. Page
  2. Component
  3. Modal
  4. Form

Escolha uma opção (número): 2

Incluir formulário? [y/N]: n
Incluir operações CRUD? [y/N]: n
Incluir busca/filtros? [y/N]: n

✓ Arquivo criado: src/components/ui-custom/ProductCard.tsx

📋 Próximos Passos:
1. Importe o componente onde necessário
2. Substitua os comentários TODO com sua implementação
3. Configure as props e tipos específicos
4. Teste o componente na interface

📁 Arquivo gerado: src/components/ui-custom/ProductCard.tsx

✨ Código gerado com sucesso!
```

## Templates Disponíveis

### Backend Templates

#### adminRouteTemplate.js
- **Uso**: Rotas administrativas
- **Autenticação**: Token admin obrigatório
- **Características**: Validação completa, logging, error handling

#### userRouteTemplate.js
- **Uso**: Rotas de usuário
- **Autenticação**: Token user obrigatório
- **Características**: Isolamento de dados por usuário

#### publicRouteTemplate.js
- **Uso**: Rotas públicas
- **Autenticação**: Nenhuma
- **Características**: Rate limiting, validação básica

#### integrationRouteTemplate.js
- **Uso**: Integrações externas
- **Autenticação**: API key ou webhook
- **Características**: Validação de payload, retry logic

### Frontend Templates

#### AdminPageTemplate.tsx
- **Uso**: Páginas administrativas
- **Características**: CRUD completo, busca, filtros, bulk operations

#### UserPageTemplate.tsx
- **Uso**: Páginas de usuário
- **Características**: Perfil, configurações, atividades

#### ReusableComponentTemplate.tsx
- **Uso**: Componentes reutilizáveis
- **Características**: Props flexíveis, variantes, composição

#### CustomHookTemplate.ts
- **Uso**: Hooks personalizados
- **Características**: Estado, CRUD, cache, error handling

#### ServiceTemplate.ts
- **Uso**: Serviços de API
- **Características**: HTTP client, interceptors, validação

## Exemplos Práticos

### Exemplo 1: Sistema de Usuários Completo

#### 1. Backend
```bash
# Rotas administrativas
npm run generate route admin-users
# Selecionar: Rota administrativa, GET, users, "Listar usuários"

npm run generate route admin-user-create
# Selecionar: Rota administrativa, POST, users, "Criar usuário"

npm run generate route admin-user-update
# Selecionar: Rota administrativa, PUT, users/:id, "Atualizar usuário"

npm run generate route admin-user-delete
# Selecionar: Rota administrativa, DELETE, users/:id, "Deletar usuário"
```

#### 2. Frontend
```bash
# Serviço
npm run generate service usersService
# Implementar: User, UserService, user, users

# Hook
npm run generate hook useUsers
# Tipo: User, API: Sim, CRUD: Sim

# Página admin
npm run generate page AdminUsers
# Template: Administrativa, Formulário: Sim, CRUD: Sim, Busca: Sim
```

#### 3. Integração
```javascript
// server/index.js
app.use('/api/admin/users', require('./routes/admin-usersRoutes'));

// src/App.tsx
import AdminUsers from '@/pages/AdminUsers';
<Route path="/admin/users" element={<AdminUsers />} />
```

### Exemplo 2: Dashboard de Usuário

#### 1. Componentes
```bash
# Página principal
npm run generate page UserDashboard

# Componentes específicos
npm run generate component UserStats
npm run generate component ActivityFeed
npm run generate component QuickActions
```

#### 2. Hooks e Serviços
```bash
# Dados do usuário
npm run generate hook useUserData
npm run generate service userService

# Atividades
npm run generate hook useActivities
npm run generate service activitiesService
```

### Exemplo 3: Sistema de Notificações

#### 1. Backend
```bash
# API de notificações
npm run generate route user-notifications
npm run generate route admin-notifications-broadcast
```

#### 2. Frontend
```bash
# Serviços
npm run generate service notificationsService

# Componentes
npm run generate component NotificationBell
npm run generate component NotificationList
npm run generate component NotificationItem

# Hook para tempo real
npm run generate hook useNotifications
```

## Personalização

### Modificando Templates

#### 1. Localização
```
templates/
├── backend/
│   ├── adminRouteTemplate.js
│   ├── userRouteTemplate.js
│   └── ...
└── frontend/
    ├── AdminPageTemplate.tsx
    ├── ServiceTemplate.ts
    └── ...
```

#### 2. Placeholders Disponíveis
```javascript
// Básicos
[NAME]                  // Nome fornecido
[COMPONENT_NAME]        // PascalCase
[HOOK_NAME]            // camelCase
[FILE_NAME]            // kebab-case
[DESCRIPTION]          // Descrição fornecida
[TIMESTAMP]            // Data/hora atual

// Rotas
[HTTP_METHOD]          // GET, POST, etc.
[HTTP_METHOD_LOWERCASE] // get, post, etc.
[ENDPOINT]             // Endpoint da rota
[OPERATION_DESCRIPTION] // Descrição da operação
[SUCCESS_STATUS_CODE]   // 200, 201, etc.

// Componentes
[DATA_TYPE]            // Tipo de dados
[API_SERVICE]          // Nome do serviço
[COMPONENT_TYPE]       // Tipo do componente
```

#### 3. Seções Condicionais
```javascript
// Seção que pode ser removida se não preenchida
[SECTION_NAME]
// Conteúdo da seção
[/SECTION_NAME]

// Exemplos
[PARAMETERS_SECTION]
// Parâmetros da rota
[/PARAMETERS_SECTION]

[CRUD_SECTION]
// Operações CRUD
[/CRUD_SECTION]
```

### Criando Novos Templates

#### 1. Criar Arquivo Template
```bash
# Backend
touch templates/backend/myCustomTemplate.js

# Frontend
touch templates/frontend/MyCustomTemplate.tsx
```

#### 2. Adicionar ao Gerador
```javascript
// scripts/generate.cjs
const GENERATORS = {
  'my-type': {
    description: 'Gera meu tipo customizado',
    templates: ['myCustomTemplate.js'],
    outputDir: 'backend.routes'
  }
};
```

#### 3. Implementar Lógica Específica
```javascript
// No método collectUserInput
if (type === 'my-type') {
  config.customField = await this.prompt.question('Campo customizado: ');
}
```

### Configurando Diretórios de Saída

```javascript
// scripts/generate.cjs
const CONFIG = {
  outputDirs: {
    backend: {
      routes: path.join(__dirname, '..', 'server', 'routes'),
      // Adicionar novos diretórios
      controllers: path.join(__dirname, '..', 'server', 'controllers'),
      services: path.join(__dirname, '..', 'server', 'services')
    },
    frontend: {
      // Modificar diretórios existentes
      components: path.join(__dirname, '..', 'src', 'components'),
      // Adicionar novos
      utils: path.join(__dirname, '..', 'src', 'utils')
    }
  }
};
```

## Troubleshooting

### Problemas Comuns

#### 1. CLI não executa
```bash
# Verificar permissões
chmod +x scripts/generate.cjs

# Verificar Node.js
node --version  # Deve ser 18+

# Executar diretamente
node scripts/generate.cjs --help
```

#### 2. Template não encontrado
```bash
# Verificar estrutura
ls -la templates/backend/
ls -la templates/frontend/

# Verificar nome do template no código
grep -r "templateName" scripts/generate.cjs
```

#### 3. Diretório de saída não existe
```bash
# Verificar configuração
node -e "console.log(require('./scripts/generate.cjs').CONFIG)"

# Criar diretórios manualmente
mkdir -p src/components/ui-custom
mkdir -p server/routes
```

#### 4. Placeholders não substituídos
```bash
# Verificar se placeholder está definido
# Verificar sintaxe: [PLACEHOLDER] (com colchetes)
# Verificar se não há espaços extras
```

#### 5. Arquivo não é criado
```bash
# Verificar permissões do diretório
ls -la src/components/

# Verificar se arquivo já existe
# CLI pergunta se deve sobrescrever
```

### Debug Mode

#### Habilitar Logs Detalhados
```javascript
// Adicionar no início do script
process.env.DEBUG = 'true';

// Ou executar com debug
DEBUG=true npm run generate route test
```

#### Verificar Configuração
```bash
# Testar configuração
npm run generate:test

# Verificar templates
node -e "
const fs = require('fs');
const path = require('path');
const templatesDir = path.join(__dirname, 'templates');
console.log('Templates backend:', fs.readdirSync(path.join(templatesDir, 'backend')));
console.log('Templates frontend:', fs.readdirSync(path.join(templatesDir, 'frontend')));
"
```

### Logs e Monitoramento

#### Localização dos Logs
```bash
# Logs do CLI (se habilitados)
tail -f logs/cli-generator.log

# Logs de erro
tail -f logs/error.log
```

#### Métricas de Uso
```bash
# Contar arquivos gerados
find . -name "*.generated.*" | wc -l

# Verificar últimos arquivos criados
find . -name "*.tsx" -o -name "*.ts" -o -name "*.js" | head -10
```

## Recursos Adicionais

### Documentação Relacionada
- [Guia de Desenvolvimento](./DEVELOPMENT_GUIDE.md)
- [Padrões de Código](./CODE_STANDARDS.md)
- [Arquitetura do Projeto](../README-ARCHITECTURE.md)

### Ferramentas Complementares
- [VS Code Snippets](../.vscode/snippets/)
- [ESLint Rules](../eslint.config.js)
- [TypeScript Config](../tsconfig.json)

### Comunidade
- [GitHub Issues](link-to-repo/issues)
- [Discussions](link-to-repo/discussions)
- [Wiki](link-to-repo/wiki)

---

**Última atualização**: Novembro 2024  
**Versão**: 1.0.0

Para sugestões de melhorias ou novos templates, abra uma issue no repositório.