# Checklist de Qualidade e Padrões

Este documento define os padrões de qualidade e boas práticas que devem ser seguidos em todo o desenvolvimento do WUZAPI Manager.

## 📋 Índice

- [Padrões Gerais](#padrões-gerais)
- [Backend - Node.js/Express](#backend---nodejsexpress)
- [Frontend - React/TypeScript](#frontend---reacttypescript)
- [Banco de Dados - SQLite](#banco-de-dados---sqlite)
- [Segurança](#segurança)
- [Performance](#performance)
- [Testes](#testes)
- [Documentação](#documentação)
- [Git e Versionamento](#git-e-versionamento)
- [Deploy e Produção](#deploy-e-produção)

## Padrões Gerais

### ✅ Estrutura de Código

#### Organização de Arquivos
- [ ] Arquivos organizados por domínio/funcionalidade
- [ ] Nomes de arquivos em kebab-case para backend
- [ ] Nomes de arquivos em PascalCase para componentes React
- [ ] Estrutura de diretórios consistente
- [ ] Imports organizados (React, libs, internos)

#### Nomenclatura
- [ ] Variáveis e funções em camelCase
- [ ] Constantes em UPPER_SNAKE_CASE
- [ ] Classes e componentes em PascalCase
- [ ] Arquivos de configuração em kebab-case
- [ ] Nomes descritivos e significativos

#### Comentários e Documentação
- [ ] Funções complexas documentadas com JSDoc
- [ ] Comentários explicam "por que", não "o que"
- [ ] TODOs com contexto e responsável
- [ ] README atualizado para cada módulo
- [ ] Exemplos de uso incluídos

### ✅ Formatação e Estilo

#### ESLint e Prettier
- [ ] Código passa no lint sem warnings
- [ ] Formatação consistente aplicada
- [ ] Regras customizadas seguidas
- [ ] Imports organizados automaticamente
- [ ] Trailing commas e semicolons consistentes

#### TypeScript (Frontend)
- [ ] Tipagem explícita para props e estados
- [ ] Interfaces definidas para dados da API
- [ ] Tipos genéricos usados apropriadamente
- [ ] Strict mode habilitado
- [ ] Sem uso de `any` sem justificativa

## Backend - Node.js/Express

### ✅ Estrutura de Rotas

#### Padrões de Rota
- [ ] Rotas seguem padrão RESTful
- [ ] Middleware de validação implementado
- [ ] Autenticação/autorização configurada
- [ ] Logging estruturado adicionado
- [ ] Tratamento de erros padronizado

#### Validação de Entrada
```javascript
// ✅ Bom
if (!requestData || typeof requestData !== 'object') {
  return res.status(400).json({
    success: false,
    error: 'Dados inválidos',
    code: 400,
    timestamp: new Date().toISOString()
  });
}

// ❌ Ruim
if (!requestData) {
  res.send('erro');
}
```

#### Resposta Padronizada
```javascript
// ✅ Bom - Sucesso
return res.status(200).json({
  success: true,
  code: 200,
  data: result,
  message: 'Operação realizada com sucesso',
  timestamp: new Date().toISOString()
});

// ✅ Bom - Erro
return res.status(400).json({
  success: false,
  error: 'Mensagem de erro amigável',
  code: 400,
  details: error.message, // Opcional para debug
  timestamp: new Date().toISOString()
});
```

### ✅ Segurança

#### Validação de Token
- [ ] Token validado em todas as rotas protegidas
- [ ] Formato de token verificado
- [ ] Expiração de token checada
- [ ] Logs de tentativas de acesso inválido
- [ ] Rate limiting implementado onde necessário

#### Sanitização de Dados
- [ ] Dados de entrada sanitizados
- [ ] SQL injection prevenido
- [ ] XSS prevenido
- [ ] Validação de tipos de dados
- [ ] Limites de tamanho de payload

### ✅ Performance

#### Otimizações de Banco
- [ ] Queries otimizadas com índices
- [ ] Paginação implementada para listas grandes
- [ ] Conexões de banco gerenciadas adequadamente
- [ ] Transações usadas quando necessário
- [ ] Cache implementado para dados frequentes

#### Logging e Monitoramento
```javascript
// ✅ Bom
logger.info('Operação iniciada', {
  url: req.url,
  method: req.method,
  user_agent: req.get('User-Agent'),
  ip: req.ip,
  response_time_ms: responseTime
});

// ❌ Ruim
console.log('operação');
```

## Frontend - React/TypeScript

### ✅ Componentes

#### Estrutura de Componente
```typescript
// ✅ Bom
interface ComponentProps {
  title: string;
  description?: string;
  onAction: (id: string) => void;
}

const Component = ({ title, description, onAction }: ComponentProps) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lógica do componente

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        {/* Conteúdo */}
      </CardContent>
    </Card>
  );
};

export default Component;
```

#### Props e Estado
- [ ] Props tipadas com interface
- [ ] Props opcionais marcadas com `?`
- [ ] Estado inicial definido corretamente
- [ ] Estados relacionados agrupados
- [ ] Callbacks memoizados quando necessário

#### Hooks e Efeitos
```typescript
// ✅ Bom
const fetchData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);
    const result = await apiService.getData();
    setData(result);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Erro desconhecido');
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => {
  fetchData();
}, [fetchData]);
```

### ✅ Gerenciamento de Estado

#### Estados de Loading e Erro
- [ ] Loading states implementados
- [ ] Error states tratados adequadamente
- [ ] Feedback visual para usuário
- [ ] Retry mechanisms onde apropriado
- [ ] Estados de sucesso mostrados

#### Formulários
```typescript
// ✅ Bom
const [formData, setFormData] = useState({
  name: '',
  email: '',
  phone: ''
});

const [formErrors, setFormErrors] = useState<Record<string, string>>({});

const validateForm = () => {
  const errors: Record<string, string> = {};
  
  if (!formData.name.trim()) {
    errors.name = 'Nome é obrigatório';
  }
  
  if (!formData.email.includes('@')) {
    errors.email = 'Email inválido';
  }
  
  setFormErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### ✅ Integração com APIs

#### Serviços
- [ ] Serviços organizados por domínio
- [ ] Interceptors configurados para auth/error
- [ ] Timeout configurado adequadamente
- [ ] Retry logic implementado onde necessário
- [ ] Tipos TypeScript para requests/responses

#### Tratamento de Erros
```typescript
// ✅ Bom
try {
  const result = await apiService.createItem(data);
  toast.success('Item criado com sucesso!');
  onSuccess(result);
} catch (error) {
  console.error('Erro ao criar item:', error);
  toast.error(error.message || 'Erro ao criar item');
  setError(error.message);
}
```

### ✅ UI/UX

#### Responsividade
- [ ] Layout responsivo em todos os breakpoints
- [ ] Componentes adaptam a diferentes tamanhos
- [ ] Navegação funciona em mobile
- [ ] Touch targets adequados (44px mínimo)
- [ ] Texto legível em todos os tamanhos

#### Acessibilidade
- [ ] Labels apropriados para inputs
- [ ] ARIA labels onde necessário
- [ ] Navegação por teclado funcional
- [ ] Contraste adequado (WCAG AA)
- [ ] Screen readers suportados

#### Feedback Visual
```typescript
// ✅ Bom
{loading && (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
)}

{error && (
  <div className="bg-red-50 border border-red-200 rounded-md p-4">
    <p className="text-red-800">{error}</p>
  </div>
)}
```

## Banco de Dados - SQLite

### ✅ Estrutura de Dados

#### Schema Design
- [ ] Tabelas normalizadas adequadamente
- [ ] Chaves primárias definidas
- [ ] Índices criados para queries frequentes
- [ ] Constraints de integridade implementadas
- [ ] Campos de auditoria (created_at, updated_at)

#### Queries
```javascript
// ✅ Bom
const result = await db.query(
  'SELECT * FROM users WHERE status = ? AND created_at > ? ORDER BY created_at DESC LIMIT ?',
  ['active', startDate, limit]
);

// ❌ Ruim
const result = await db.query(
  `SELECT * FROM users WHERE status = '${status}'`
);
```

#### Transações
- [ ] Transações usadas para operações múltiplas
- [ ] Rollback implementado em caso de erro
- [ ] Locks adequados para concorrência
- [ ] Timeout configurado para transações
- [ ] Logs de transações para auditoria

## Segurança

### ✅ Autenticação e Autorização

#### Tokens
- [ ] Tokens validados em todas as rotas protegidas
- [ ] Expiração de tokens verificada
- [ ] Refresh tokens implementados onde necessário
- [ ] Tokens armazenados de forma segura
- [ ] Logout limpa tokens adequadamente

#### Validação de Entrada
- [ ] Todos os inputs validados no backend
- [ ] Sanitização de dados implementada
- [ ] Limites de tamanho de payload
- [ ] Rate limiting configurado
- [ ] CORS configurado adequadamente

### ✅ Proteção contra Ataques

#### SQL Injection
```javascript
// ✅ Bom
const result = await db.query(
  'SELECT * FROM users WHERE id = ?',
  [userId]
);

// ❌ Ruim
const result = await db.query(
  `SELECT * FROM users WHERE id = ${userId}`
);
```

#### XSS Prevention
```typescript
// ✅ Bom
const sanitizedInput = DOMPurify.sanitize(userInput);

// ✅ Bom - React escapa automaticamente
<div>{userInput}</div>

// ❌ Ruim
<div dangerouslySetInnerHTML={{__html: userInput}} />
```

## Performance

### ✅ Backend Performance

#### Otimizações de Query
- [ ] Índices criados para campos frequentemente consultados
- [ ] Queries otimizadas para evitar N+1
- [ ] Paginação implementada para listas grandes
- [ ] Cache implementado para dados estáticos
- [ ] Connection pooling configurado

#### Monitoramento
```javascript
// ✅ Bom
const startTime = Date.now();
// ... operação
const responseTime = Date.now() - startTime;

logger.info('Operação concluída', {
  operation: 'getUserData',
  response_time_ms: responseTime,
  user_id: userId
});

if (responseTime > 1000) {
  logger.warn('Operação lenta detectada', {
    operation: 'getUserData',
    response_time_ms: responseTime
  });
}
```

### ✅ Frontend Performance

#### Otimizações React
- [ ] Componentes memoizados quando necessário
- [ ] Callbacks memoizados com useCallback
- [ ] Valores computados memoizados com useMemo
- [ ] Lazy loading implementado para rotas
- [ ] Bundle size otimizado

#### Carregamento de Dados
```typescript
// ✅ Bom
const [data, setData] = useState([]);
const [hasMore, setHasMore] = useState(true);

const loadMore = useCallback(async () => {
  if (!hasMore || loading) return;
  
  try {
    setLoading(true);
    const newData = await apiService.getData(page);
    setData(prev => [...prev, ...newData]);
    setHasMore(newData.length === pageSize);
  } catch (error) {
    setError(error.message);
  } finally {
    setLoading(false);
  }
}, [hasMore, loading, page]);
```

## Testes

### ✅ Testes Backend

#### Testes Unitários
- [ ] Funções críticas testadas
- [ ] Casos de sucesso e erro cobertos
- [ ] Mocks implementados para dependências externas
- [ ] Cobertura de código adequada (>80%)
- [ ] Testes executam rapidamente (<5s)

#### Testes de Integração
```javascript
// ✅ Bom
describe('Admin Users API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('should create user with valid data', async () => {
    const userData = {
      name: 'Test User',
      email: 'test@example.com'
    };

    const response = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(userData)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe(userData.name);
  });
});
```

### ✅ Testes Frontend

#### Testes de Componente
```typescript
// ✅ Bom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import UserForm from './UserForm';

describe('UserForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('should submit form with valid data', async () => {
    render(<UserForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/nome/i), {
      target: { value: 'João Silva' }
    });

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'João Silva'
      });
    });
  });
});
```

## Documentação

### ✅ Documentação de Código

#### JSDoc
```javascript
/**
 * Cria um novo usuário no sistema
 * @param {Object} userData - Dados do usuário
 * @param {string} userData.name - Nome do usuário
 * @param {string} userData.email - Email do usuário
 * @param {string} adminToken - Token de autenticação admin
 * @returns {Promise<Object>} Dados do usuário criado
 * @throws {Error} Quando dados são inválidos ou token é inválido
 */
async function createUser(userData, adminToken) {
  // implementação
}
```

#### README de Componentes
```markdown
# UserForm

Formulário para criação e edição de usuários.

## Props

| Prop | Tipo | Obrigatório | Padrão | Descrição |
|------|------|-------------|--------|-----------|
| user | User | Não | null | Usuário para edição |
| onSubmit | Function | Sim | - | Callback ao submeter |
| loading | boolean | Não | false | Estado de carregamento |

## Exemplo

```tsx
<UserForm
  user={selectedUser}
  onSubmit={handleSubmit}
  loading={isSubmitting}
/>
```
```

### ✅ Documentação de API

#### OpenAPI/Swagger
```yaml
paths:
  /api/admin/users:
    post:
      summary: Criar novo usuário
      tags: [Admin, Users]
      security:
        - AdminToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        201:
          description: Usuário criado com sucesso
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
```

## Git e Versionamento

### ✅ Commits

#### Mensagens de Commit
```bash
# ✅ Bom
feat: adicionar sistema de notificações administrativas

- Implementar rota GET/POST /api/admin/notifications
- Criar página AdminNotifications com CRUD completo
- Adicionar validações e tratamento de erros
- Documentar API e componentes

Closes #123

# ❌ Ruim
fix bug
```

#### Conventional Commits
- [ ] Tipo de commit claro (feat, fix, docs, style, refactor, test, chore)
- [ ] Escopo definido quando relevante
- [ ] Descrição concisa no título
- [ ] Corpo explicativo quando necessário
- [ ] Breaking changes documentadas

### ✅ Branches

#### Estratégia de Branch
- [ ] Feature branches para novas funcionalidades
- [ ] Hotfix branches para correções urgentes
- [ ] Release branches para preparação de releases
- [ ] Nomes descritivos (feature/user-management)
- [ ] Branches limpas antes do merge

## Deploy e Produção

### ✅ Build e Deploy

#### Preparação para Produção
- [ ] Build de produção sem erros
- [ ] Testes passando
- [ ] Lint sem warnings
- [ ] Bundle size otimizado
- [ ] Variáveis de ambiente configuradas

#### Verificações Pós-Deploy
```bash
# ✅ Checklist pós-deploy
curl -X GET https://app.domain.com/api/health
curl -X GET https://app.domain.com/api/admin/users -H "Authorization: Bearer TOKEN"

# Verificar logs
docker logs wuzapi-manager-backend
docker logs wuzapi-manager-frontend
```

### ✅ Monitoramento

#### Logs Estruturados
- [ ] Logs em formato JSON
- [ ] Níveis de log apropriados
- [ ] Contexto suficiente para debug
- [ ] Logs de erro com stack trace
- [ ] Métricas de performance incluídas

#### Health Checks
```javascript
// ✅ Bom
app.get('/health', async (req, res) => {
  try {
    // Verificar banco de dados
    await db.query('SELECT 1');
    
    // Verificar serviços externos
    const wuzapiStatus = await checkWuzapiHealth();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: 'ok',
        wuzapi: wuzapiStatus ? 'ok' : 'error'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

## Checklist de Review

### ✅ Antes do Commit
- [ ] Código testado localmente
- [ ] Testes unitários passando
- [ ] Lint sem warnings
- [ ] Documentação atualizada
- [ ] Variáveis de ambiente documentadas

### ✅ Antes do Merge
- [ ] Code review aprovado
- [ ] Testes de integração passando
- [ ] Build de produção funcionando
- [ ] Documentação da API atualizada
- [ ] Changelog atualizado

### ✅ Antes do Deploy
- [ ] Backup do banco de dados
- [ ] Variáveis de produção configuradas
- [ ] Health checks funcionando
- [ ] Rollback plan definido
- [ ] Monitoramento configurado

---

**Dica**: Use este checklist como guia durante o desenvolvimento e reviews. Adapte conforme necessário para funcionalidades específicas.

**Automação**: Considere implementar verificações automáticas via CI/CD para garantir que estes padrões sejam seguidos consistentemente.