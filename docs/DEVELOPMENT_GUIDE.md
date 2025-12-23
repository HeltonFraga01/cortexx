# Guia de Desenvolvimento - WUZAPI Manager

Este guia fornece instruções completas para desenvolver novas funcionalidades no WUZAPI Manager usando os padrões estabelecidos e ferramentas de geração de código.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração do Ambiente](#configuração-do-ambiente)
- [CLI de Geração de Código](#cli-de-geração-de-código)
- [Padrões de Desenvolvimento](#padrões-de-desenvolvimento)
- [Fluxo de Desenvolvimento](#fluxo-de-desenvolvimento)
- [Exemplos Práticos](#exemplos-práticos)
- [Checklist de Qualidade](#checklist-de-qualidade)
- [Troubleshooting](#troubleshooting)

## Visão Geral

### Arquitetura do Projeto
```
WUZAPI Manager/
├── 📁 server/              # Backend Node.js/Express
│   ├── routes/             # Rotas da API
│   ├── middleware/         # Middlewares
│   ├── validators/         # Validadores
│   └── utils/              # Utilitários
├── 📁 src/                 # Frontend React/TypeScript
│   ├── components/         # Componentes React
│   ├── hooks/              # Custom hooks
│   ├── services/           # Serviços de API
│   └── pages/              # Páginas da aplicação
├── 📁 templates/           # Templates para geração
├── 📁 scripts/             # Scripts de automação
└── 📁 docs/                # Documentação
```

### Tecnologias Principais
- **Backend**: Node.js, Express, Supabase (PostgreSQL)
- **Frontend**: React, TypeScript, Tailwind CSS, shadcn/ui
- **Ferramentas**: Vite, ESLint, Vitest
- **Deploy**: Docker, Docker Swarm

## Configuração do Ambiente

### Pré-requisitos
- Node.js 18+ 
- npm ou yarn
- Git
- Docker (para deploy)

### Setup Inicial
```bash
# 1. Clonar repositório
git clone <repository-url>
cd wuzapi-manager

# 2. Instalar dependências
npm run setup

# 3. Configurar variáveis de ambiente
cp .env.example .env
cp server/.env.example server/.env

# 4. Iniciar desenvolvimento
npm run dev:full
```

### Estrutura de Desenvolvimento
```bash
# Terminal 1: Backend
npm run server:dev

# Terminal 2: Frontend  
npm run dev

# Terminal 3: Testes (opcional)
npm run test
```

## CLI de Geração de Código

### Visão Geral
O CLI automatiza a criação de código seguindo os padrões do projeto:

```bash
# Sintaxe básica
npm run generate <type> <name> [options]

# Ajuda
npm run generate --help

# Listar geradores disponíveis
npm run generate --list
```

### Tipos de Geração Disponíveis

#### 1. Rotas Backend (`route`)
Gera rotas Express com padrões de autenticação e validação.

```bash
# Exemplos
npm run generate route admin-users
npm run generate route user-profile  
npm run generate route public-health
npm run generate route integration-webhook
```

**Templates disponíveis:**
- `adminRouteTemplate.js` - Rotas administrativas (requer token admin)
- `userRouteTemplate.js` - Rotas de usuário (requer token user)
- `publicRouteTemplate.js` - Rotas públicas (sem autenticação)
- `integrationRouteTemplate.js` - Rotas de integração externa

#### 2. Componentes React (`component`)
Gera componentes reutilizáveis com padrões estabelecidos.

```bash
# Exemplos
npm run generate component ProductCard
npm run generate component UserModal
npm run generate component DataTable
```

**Templates disponíveis:**
- `AdminPageTemplate.tsx` - Páginas administrativas com CRUD
- `UserPageTemplate.tsx` - Páginas de usuário
- `ReusableComponentTemplate.tsx` - Componentes reutilizáveis

#### 3. Páginas React (`page`)
Gera páginas completas com layout e funcionalidades.

```bash
# Exemplos
npm run generate page AdminProducts
npm run generate page UserDashboard
npm run generate page PublicLanding
```

#### 4. Custom Hooks (`hook`)
Gera hooks personalizados para gerenciamento de estado.

```bash
# Exemplos
npm run generate hook useProducts
npm run generate hook useAuth
npm run generate hook useWebSocket
```

#### 5. Serviços de API (`service`)
Gera serviços para comunicação com APIs.

```bash
# Exemplos
npm run generate service productsService
npm run generate service authService
npm run generate service webhookService
```

### Fluxo Interativo
O CLI guia você através de perguntas para personalizar a geração:

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

## Padrões de Desenvolvimento

### Backend - Rotas

#### Estrutura Padrão
```javascript
// server/routes/exampleRoutes.js
const express = require('express');
const adminValidator = require('../validators/adminValidator');
const errorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/endpoint',
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.authorization;
      
      // Validação de entrada
      // Lógica de negócio
      // Resposta padronizada
      
    } catch (error) {
      // Tratamento de erro padronizado
    }
  }
);

module.exports = router;
```

#### Padrões de Resposta
```javascript
// Sucesso
res.status(200).json({
  success: true,
  code: 200,
  data: result,
  message: 'Operação realizada com sucesso',
  timestamp: new Date().toISOString()
});

// Erro
res.status(400).json({
  success: false,
  error: 'Mensagem de erro amigável',
  code: 400,
  timestamp: new Date().toISOString()
});
```

#### Logging Estruturado
```javascript
logger.info('Operação iniciada', {
  url: req.url,
  method: req.method,
  user_agent: req.get('User-Agent'),
  ip: req.ip
});
```

### Frontend - Componentes

#### Estrutura Padrão
```typescript
// src/components/example/ExampleComponent.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ExampleProps {
  title: string;
  onAction?: (id: string) => void;
}

const ExampleComponent = ({ title, onAction }: ExampleProps) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Lógica do componente

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Conteúdo do componente */}
      </CardContent>
    </Card>
  );
};

export default ExampleComponent;
```

#### Padrões de Estado
```typescript
// Estados relacionados agrupados
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Operações CRUD
const [creating, setCreating] = useState(false);
const [updating, setUpdating] = useState<string | null>(null);
const [deleting, setDeleting] = useState<string | null>(null);
```

#### Tratamento de Erros
```typescript
try {
  setLoading(true);
  const result = await apiCall();
  setData(result);
  toast.success('Operação realizada com sucesso!');
} catch (error) {
  console.error('Error:', error);
  toast.error(error.message || 'Erro ao realizar operação');
  setError(error.message);
} finally {
  setLoading(false);
}
```

### Serviços de API

#### Estrutura Padrão
```typescript
// src/services/exampleService.ts
import axios, { AxiosInstance } from 'axios';

export interface DataType {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

export class ExampleService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      timeout: 10000,
    });

    // Interceptors para auth e error handling
  }

  async getAll(): Promise<DataType[]> {
    const response = await this.api.get('/endpoint');
    return response.data.data || [];
  }

  // Outros métodos CRUD
}

export const exampleService = new ExampleService();
```

### Custom Hooks

#### Estrutura Padrão
```typescript
// src/hooks/useExample.ts
import { useState, useEffect, useCallback } from 'react';
import { exampleService } from '@/services/exampleService';

export const useExample = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await exampleService.getAll();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
```

## Fluxo de Desenvolvimento

### 1. Planejamento
- [ ] Definir requisitos da funcionalidade
- [ ] Identificar endpoints necessários
- [ ] Planejar estrutura de dados
- [ ] Definir componentes de UI necessários

### 2. Backend Development
```bash
# 1. Gerar rota
npm run generate route feature-name

# 2. Implementar lógica
# - Editar arquivo gerado
# - Implementar TODOs
# - Adicionar validações

# 3. Registrar rota
# Adicionar em server/index.js:
app.use('/api/feature', require('./routes/featureRoutes'));

# 4. Testar
curl -X GET http://localhost:3001/api/feature/endpoint
```

### 3. Frontend Development
```bash
# 1. Gerar serviço
npm run generate service featureService

# 2. Gerar hook (se necessário)
npm run generate hook useFeature

# 3. Gerar componente/página
npm run generate component FeatureComponent

# 4. Integrar na aplicação
# - Adicionar rotas no React Router
# - Importar componentes
# - Testar funcionalidades
```

### 4. Integração e Testes
- [ ] Testar integração backend-frontend
- [ ] Verificar tratamento de erros
- [ ] Testar responsividade
- [ ] Validar acessibilidade
- [ ] Executar testes automatizados

### 5. Documentação
- [ ] Atualizar documentação da API
- [ ] Documentar novos componentes
- [ ] Atualizar guias de uso
- [ ] Criar exemplos de código

## Exemplos Práticos

### Exemplo 1: Sistema de Produtos

#### 1. Gerar Backend
```bash
npm run generate route admin-products
# Selecionar: Rota administrativa
# Método: GET
# Endpoint: products
# Descrição: Listar produtos do sistema
```

#### 2. Implementar Lógica Backend
```javascript
// server/routes/admin-productsRoutes.js
// Implementar nos TODOs:

// Buscar produtos no banco
const db = req.app.locals.db;
const products = await db.query('SELECT * FROM products WHERE user_token = ?', [userToken]);

// Retornar dados
return res.status(200).json({
  success: true,
  code: 200,
  data: products.rows,
  message: 'Produtos recuperados com sucesso',
  timestamp: new Date().toISOString()
});
```

#### 3. Gerar Frontend Service
```bash
npm run generate service productsService
# Implementar tipos e métodos específicos
```

#### 4. Gerar Página Admin
```bash
npm run generate page AdminProducts
# Selecionar: Página administrativa com CRUD completo
# Incluir formulário: Sim
# Incluir CRUD: Sim
# Incluir busca: Sim
```

#### 5. Integrar na Aplicação
```typescript
// src/App.tsx ou router
import AdminProducts from '@/pages/AdminProducts';

// Adicionar rota
<Route path="/admin/products" element={<AdminProducts />} />
```

### Exemplo 2: Hook Personalizado

#### 1. Gerar Hook
```bash
npm run generate hook useProducts
# Tipo de dados: Product
# Conectar com API: Sim
# Incluir CRUD: Sim
```

#### 2. Usar Hook em Componente
```typescript
import { useProducts } from '@/hooks/useProducts';

const ProductsPage = () => {
  const { data, loading, error, createRecord, updateRecord, deleteRecord } = useProducts();

  // Usar dados e operações
};
```

### Exemplo 3: Integração Completa

#### Cenário: Sistema de Notificações

```bash
# 1. Backend
npm run generate route admin-notifications
npm run generate route user-notifications

# 2. Frontend
npm run generate service notificationsService
npm run generate hook useNotifications
npm run generate component NotificationCard
npm run generate page AdminNotifications
npm run generate page UserNotifications

# 3. Implementar lógica específica em cada arquivo
# 4. Integrar componentes na aplicação
# 5. Testar fluxo completo
```

## Checklist de Qualidade

### Backend
- [ ] Rota registrada no servidor principal
- [ ] Validação de entrada implementada
- [ ] Autenticação/autorização configurada
- [ ] Tratamento de erros padronizado
- [ ] Logging estruturado adicionado
- [ ] Resposta padronizada implementada
- [ ] Documentação da API atualizada

### Frontend
- [ ] Tipos TypeScript definidos
- [ ] Tratamento de loading states
- [ ] Tratamento de erros com toast
- [ ] Responsividade testada
- [ ] Acessibilidade verificada
- [ ] Componentes reutilizáveis usados
- [ ] Padrões de código seguidos

### Geral
- [ ] Código segue padrões do projeto
- [ ] TODOs implementados
- [ ] Testes básicos funcionando
- [ ] Performance adequada
- [ ] Documentação atualizada
- [ ] Git commit com mensagem clara

## Troubleshooting

### Problemas Comuns

#### 1. CLI não funciona
```bash
# Verificar permissões
chmod +x scripts/generate.js

# Verificar Node.js
node --version  # Deve ser 18+

# Executar diretamente
node scripts/generate.js --help
```

#### 2. Template não encontrado
```bash
# Verificar estrutura de templates
ls -la templates/backend/
ls -la templates/frontend/

# Recriar templates se necessário
```

#### 3. Imports não funcionam
```bash
# Verificar tsconfig.json paths
# Verificar estrutura de diretórios
# Reiniciar TypeScript server no VS Code
```

#### 4. API não responde
```bash
# Verificar se servidor está rodando
npm run server:dev

# Verificar logs do servidor
# Testar endpoint com curl
curl -X GET http://localhost:3001/api/health
```

#### 5. Componente não renderiza
```bash
# Verificar imports
# Verificar tipos TypeScript
# Verificar console do browser
# Verificar React DevTools
```

### Debug Tips

#### Backend
```javascript
// Adicionar logs temporários
console.log('Debug:', { variable, anotherVar });

// Usar debugger
debugger;

// Verificar middleware chain
logger.info('Middleware executado', { middleware: 'name' });
```

#### Frontend
```typescript
// React DevTools
// Console logs
console.log('Component state:', { data, loading, error });

// Network tab para APIs
// TypeScript errors no VS Code
```

### Recursos Úteis

#### Documentação
- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)

#### Ferramentas
- [Postman](https://www.postman.com/) - Testar APIs
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [VS Code Extensions](https://code.visualstudio.com/docs/editor/extension-marketplace)

#### Comunidade
- [GitHub Issues](link-to-repo/issues)
- [Discord/Slack](link-to-community)
- [Stack Overflow](https://stackoverflow.com/)

---

**Última atualização**: Novembro 2024  
**Versão**: 1.0.0

Para dúvidas ou sugestões, abra uma issue no repositório ou entre em contato com a equipe de desenvolvimento.