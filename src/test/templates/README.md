# Templates de Teste

Este diretório contém templates reutilizáveis para diferentes tipos de teste no projeto WUZAPI.

## Estrutura dos Templates

### Templates de Rotas Backend
- **`backend-route.template.test.js`** - Template completo para testes de rotas da API
- **`backend-service.template.test.js`** - Template para testes de serviços backend
- **`integration.template.test.js`** - Template para testes de integração end-to-end

### Templates de Componentes Frontend
- **`component-unit.template.test.tsx`** - Template para testes unitários de componentes React
- **`component-integration.template.test.tsx`** - Template para testes de integração de componentes

### Utilitários de Teste
- **`test-helpers.js`** - Funções auxiliares para testes backend
- **`component-test-helpers.tsx`** - Helpers específicos para testes de componentes React
- **`utils.js`** - Utilitários básicos reutilizáveis
- **`factory.js`** - Factory para geração de dados de teste
- **`test-config.js`** - Configurações centralizadas para testes

## Como Usar os Templates

### 1. Templates de Rotas Backend

```bash
# Copiar template
cp src/test/templates/backend-route.template.test.js server/tests/routes/users.test.js

# Substituir placeholders
# [ROUTE_NAME] -> Users
# [route-path] -> users
# Implementar testes específicos
```

### 2. Templates de Serviços

```bash
# Copiar template
cp src/test/templates/backend-service.template.test.js server/tests/services/userService.test.js

# Substituir placeholders
# [SERVICE_CLASS] -> UserService
# [SERVICE_NAME] -> User Service
# [service-file] -> userService
```

### 3. Templates de Componentes

```bash
# Copiar template
cp src/test/templates/component-unit.template.test.tsx src/components/users/__tests__/UserList.test.tsx

# Substituir placeholders e implementar testes específicos
```

## Padrões de Nomenclatura

### Arquivos de Teste
- **Rotas**: `[nome-da-rota].test.js`
- **Serviços**: `[nome-do-servico].test.js`
- **Componentes**: `[NomeDoComponente].test.tsx`
- **Integração**: `[funcionalidade].integration.test.js`

### Estrutura de Diretórios
```
server/tests/
├── routes/           # Testes de rotas
├── services/         # Testes de serviços
├── integration/      # Testes de integração
├── mocks/           # Mock servers
└── setup/           # Configuração de testes

src/test/
├── templates/       # Templates reutilizáveis
├── utils/          # Utilitários de teste
└── __tests__/      # Testes globais
```

## Configuração do Ambiente de Teste

### 1. Configurar Variáveis de Ambiente
```javascript
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.VITE_ADMIN_TOKEN = 'test-admin-token';
```

### 2. Inicializar Mock Servers
```javascript
const { testSetup } = require('./setup/test-setup');

beforeAll(async () => {
  await testSetup.setupTestEnvironment();
  await testSetup.setupWuzAPIMock();
});
```

### 3. Usar Helpers de Teste
```javascript
const { TestHelpersFactory } = require('./templates/test-helpers');

const helpers = TestHelpersFactory.create(app, testDb);
const response = await helpers.api.requestAsAdmin('GET', '/api/users');
```

## Boas Práticas

### 1. Estrutura de Testes
- Use `describe` para agrupar testes relacionados
- Use `it` para casos de teste específicos
- Mantenha testes independentes e isolados

### 2. Nomenclatura
- Nomes descritivos para testes: `should return 200 when user is authenticated`
- Agrupe por funcionalidade: `describe('Authentication', () => {})`

### 3. Dados de Teste
- Use factories para gerar dados consistentes
- Limpe dados após cada teste
- Use dados realistas mas não sensíveis

### 4. Mocks e Stubs
- Mock apenas dependências externas
- Use dados de teste consistentes
- Verifique se mocks foram chamados corretamente

### 5. Assertions
- Seja específico nas verificações
- Teste tanto casos de sucesso quanto de erro
- Verifique estrutura de resposta da API

## Exemplos de Uso

### Teste de Rota Simples
```javascript
describe('Users Routes', () => {
  it('should return all users for admin', async () => {
    const response = await helpers.api.requestAsAdmin('GET', '/api/users');
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
});
```

### Teste de Componente
```javascript
describe('UserList Component', () => {
  it('should render user list', () => {
    const users = [{ id: 1, name: 'Test User' }];
    render(<UserList users={users} />);
    
    expect(screen.getByText('Test User')).toBeInTheDocument();
  });
});
```

### Teste de Integração
```javascript
describe('User Management Integration', () => {
  it('should complete user creation flow', async () => {
    // Create user
    const createResponse = await helpers.api.requestAsAdmin('POST', '/api/users', {
      name: 'New User',
      token: 'new-token'
    });
    
    expect(createResponse.status).toBe(201);
    
    // Verify user exists
    const getResponse = await helpers.api.requestAsAdmin('GET', '/api/users');
    expect(getResponse.body.data).toContainEqual(
      expect.objectContaining({ name: 'New User' })
    );
  });
});
```

## Troubleshooting

### Problemas Comuns

1. **Testes falhando por timeout**
   - Aumente o timeout nos testes assíncronos
   - Verifique se mock servers estão rodando

2. **Dados de teste conflitando**
   - Limpe banco de dados entre testes
   - Use dados únicos (timestamps, UUIDs)

3. **Mocks não funcionando**
   - Verifique se mocks estão sendo configurados antes dos testes
   - Limpe mocks entre testes com `jest.clearAllMocks()`

4. **Problemas de importação**
   - Verifique caminhos relativos
   - Configure aliases no Jest/Vitest

### Comandos Úteis

```bash
# Executar todos os testes
npm test

# Executar testes específicos
npm test -- --grep "Users"

# Executar com coverage
npm test -- --coverage

# Executar em modo watch
npm test -- --watch
```

## Contribuindo

Ao adicionar novos templates:

1. Siga a estrutura existente
2. Inclua documentação inline
3. Adicione checklist de implementação
4. Teste o template com casos reais
5. Atualize este README

Para dúvidas ou sugestões, consulte a documentação do projeto ou abra uma issue.