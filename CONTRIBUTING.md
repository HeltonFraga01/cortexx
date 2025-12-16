# Guia de Contribuição - WUZAPI Manager

Obrigado por seu interesse em contribuir com o WUZAPI Manager! Este guia fornece todas as informações necessárias para contribuir efetivamente com o projeto.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Contribuir](#como-contribuir)
- [Setup do Ambiente](#setup-do-ambiente)
- [Padrões de Código](#padrões-de-código)
- [Processo de Pull Request](#processo-de-pull-request)
- [Testes](#testes)
- [Documentação](#documentação)
- [Troubleshooting](#troubleshooting)

## 🤝 Código de Conduta

Este projeto segue o [Código de Conduta do Contributor Covenant](https://www.contributor-covenant.org/). Ao participar, você concorda em manter um ambiente respeitoso e inclusivo para todos.

### Comportamentos Esperados

- Use linguagem acolhedora e inclusiva
- Respeite diferentes pontos de vista e experiências
- Aceite críticas construtivas graciosamente
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros da comunidade## 
🚀 Como Contribuir

### Tipos de Contribuição

Aceitamos vários tipos de contribuição:

- **🐛 Correção de bugs**: Identifique e corrija problemas
- **✨ Novas funcionalidades**: Implemente recursos solicitados
- **📚 Documentação**: Melhore ou adicione documentação
- **🧪 Testes**: Adicione ou melhore testes existentes
- **🎨 UI/UX**: Melhore a interface e experiência do usuário
- **⚡ Performance**: Otimize código e recursos
- **🔧 Refatoração**: Melhore a estrutura do código

### Antes de Começar

1. **Verifique issues existentes**: Procure por issues relacionadas ao seu problema/ideia
2. **Crie uma issue**: Se não existir, crie uma issue descrevendo o problema ou funcionalidade
3. **Discuta a solução**: Comente na issue para alinhar a abordagem
4. **Aguarde aprovação**: Para funcionalidades grandes, aguarde aprovação dos mantenedores

## 🛠️ Setup do Ambiente

### Pré-requisitos

- **Node.js** 20.x ou superior
- **npm** 10.x ou superior
- **Git** 2.x ou superior
- **Docker** 20.10+ (opcional, para desenvolvimento com containers)
- **Docker Compose** 2.0+ (opcional)

### Instalação

1. **Fork o repositório**
   ```bash
   # Via GitHub UI ou CLI
   gh repo fork wuzapi/wuzapi-manager
   ```

2. **Clone seu fork**
   ```bash
   git clone https://github.com/SEU_USUARIO/wuzapi-manager.git
   cd wuzapi-manager
   ```

3. **Configure o remote upstream**
   ```bash
   git remote add upstream https://github.com/wuzapi/wuzapi-manager.git
   ```

4. **Instale as dependências**
   ```bash
   # Instalar dependências do frontend e backend
   npm run setup
   
   # Ou manualmente
   npm install
   cd server && npm install
   ```

5. **Configure o ambiente**
   ```bash
   # Copie o arquivo de exemplo
   cp server/.env.example server/.env
   
   # Configure as variáveis necessárias
   vi server/.env
   ```

6. **Inicie o ambiente de desenvolvimento**
   ```bash
   # Opção 1: Desenvolvimento local
   npm run dev:full
   
   # Opção 2: Com Docker
   docker-compose up -d
   ```##
# Estrutura do Projeto

```
wuzapi-manager/
├── src/                    # Frontend React + TypeScript
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes base (shadcn/ui)
│   │   ├── ui-custom/     # Componentes customizados
│   │   ├── admin/         # Componentes administrativos
│   │   └── user/          # Componentes do usuário
│   ├── pages/             # Páginas da aplicação
│   ├── hooks/             # Hooks customizados
│   ├── contexts/          # Contextos React
│   ├── utils/             # Utilitários frontend
│   └── types/             # Tipos TypeScript
├── server/                # Backend Node.js
│   ├── routes/            # Rotas da API
│   ├── middleware/        # Middlewares Express
│   ├── utils/             # Utilitários backend
│   ├── config/            # Configurações
│   └── tests/             # Testes backend
├── docs/                  # Documentação
├── scripts/               # Scripts de automação
├── monitoring/            # Configurações de monitoramento
└── deploy/                # Configurações de deploy
```

## 📝 Padrões de Código

### Estilo de Código

**Formatação**:
- Use **Prettier** para formatação automática
- Indentação: 2 espaços
- Aspas: simples para JavaScript, duplas para JSX
- Ponto e vírgula: sempre usar

**Linting**:
- Use **ESLint** para análise estática
- Siga as regras configuradas em `.eslintrc.js`
- Corrija todos os warnings antes do commit

### Convenções de Nomenclatura

**JavaScript/TypeScript**:
```javascript
// Variáveis e funções: camelCase
const userName = 'john';
function getUserData() {}

// Constantes: UPPER_SNAKE_CASE
const API_BASE_URL = 'https://api.example.com';

// Classes: PascalCase
class UserService {}

// Interfaces: PascalCase
interface UserData {}
```

**React Components**:
```tsx
// Componentes: PascalCase
const UserProfile = () => {};

// Props: camelCase
interface UserProfileProps {
  userId: string;
  showAvatar: boolean;
}

// Hooks: camelCase com prefixo use
const useUserData = () => {};
```

**Arquivos e Diretórios**:
```bash
# Arquivos: kebab-case
user-profile.tsx
api-client.ts
database-config.js

# Diretórios: kebab-case ou camelCase
components/user-management/
hooks/useAuth/
services/apiClient/
```

### Estrutura de Commits

Seguimos o padrão **Conventional Commits**:

```bash
# Formato
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Tipos permitidos**:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças na documentação
- `style`: Formatação, ponto e vírgula, etc
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Tarefas de manutenção

**Exemplos**:
```bash
feat(auth): add user login validation
fix(api): resolve database connection timeout
docs(readme): update installation instructions
style(components): format user card component
refactor(hooks): simplify useAuth implementation
test(api): add user creation endpoint tests
chore(deps): update dependencies to latest versions
```

### Padrões de Código Específicos

#### TypeScript
```typescript
// Use interfaces para objetos
interface User {
  id: string;
  name: string;
  email: string;
}

// Use types para unions e primitivos
type Status = 'active' | 'inactive' | 'pending';
type UserId = string;

// Sempre tipifique props de componentes
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  children: React.ReactNode;
}
```

#### React Hooks
```typescript
// Sempre use useCallback para funções passadas como props
const handleClick = useCallback(() => {
  // lógica
}, [dependency]);

// Use useMemo para cálculos custosos
const expensiveValue = useMemo(() => {
  return heavyCalculation(data);
}, [data]);

// Sempre limpe efeitos quando necessário
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, []);
```

#### Error Handling
```typescript
// Frontend - Use try/catch com toast
try {
  const result = await apiCall();
  toast.success('Operação realizada com sucesso!');
} catch (error) {
  console.error('Error:', error);
  toast.error(error.message || 'Erro inesperado');
}

// Backend - Use middleware de erro
const handleAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

## 🔄 Processo de Pull Request

### Antes de Criar o PR

1. **Sincronize com upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Crie uma branch específica**
   ```bash
   git checkout -b feature/user-authentication
   # ou
   git checkout -b fix/database-connection
   # ou
   git checkout -b docs/api-documentation
   ```

3. **Execute os testes**
   ```bash
   # Frontend
   npm run test:run
   npm run lint
   
   # Backend
   cd server && npm test
   
   # E2E (opcional)
   npm run test:e2e
   ```

4. **Verifique o build**
   ```bash
   npm run build:production
   ```

### Criando o Pull Request

#### Template de PR
Use este template ao criar seu PR:

```markdown
## 📝 Descrição

Breve descrição das mudanças implementadas.

## 🎯 Tipo de Mudança

- [ ] 🐛 Bug fix (mudança que corrige um problema)
- [ ] ✨ Nova funcionalidade (mudança que adiciona funcionalidade)
- [ ] 💥 Breaking change (mudança que quebra compatibilidade)
- [ ] 📚 Documentação (mudanças apenas na documentação)
- [ ] 🎨 Estilo (formatação, ponto e vírgula, etc)
- [ ] ♻️ Refatoração (mudança que não corrige bug nem adiciona funcionalidade)
- [ ] ⚡ Performance (mudança que melhora performance)
- [ ] 🧪 Testes (adição ou correção de testes)

## 🧪 Como Testar

1. Faça checkout da branch
2. Execute `npm run setup`
3. Execute `npm run dev:full`
4. Navegue para [URL específica]
5. Teste [funcionalidade específica]

## 📋 Checklist

- [ ] Meu código segue os padrões do projeto
- [ ] Realizei uma auto-revisão do código
- [ ] Comentei partes complexas do código
- [ ] Minhas mudanças não geram novos warnings
- [ ] Adicionei testes que provam que minha correção/funcionalidade funciona
- [ ] Testes novos e existentes passam localmente
- [ ] Atualizei a documentação conforme necessário

## 📸 Screenshots (se aplicável)

Adicione screenshots para mudanças visuais.

## 🔗 Issues Relacionadas

Fixes #123
Closes #456
Related to #789
```

#### Boas Práticas para PRs

**Tamanho do PR**:
- Mantenha PRs pequenos e focados (< 400 linhas quando possível)
- Uma funcionalidade por PR
- Separe refatorações de novas funcionalidades

**Título e Descrição**:
- Título claro e descritivo
- Descrição detalhada do que foi implementado
- Contexto sobre o porquê da mudança

**Commits**:
- Commits atômicos e bem descritos
- Use squash se necessário antes do merge
- Mantenha histórico limpo

### Processo de Review

#### Para Reviewers

**O que verificar**:
- [ ] Código segue padrões estabelecidos
- [ ] Lógica está correta e eficiente
- [ ] Tratamento de erros adequado
- [ ] Testes cobrem cenários importantes
- [ ] Documentação atualizada
- [ ] Performance não foi degradada
- [ ] Segurança não foi comprometida

**Como dar feedback**:
- Seja construtivo e específico
- Sugira melhorias quando possível
- Aprove quando estiver satisfeito
- Solicite mudanças se necessário

#### Para Autores

**Respondendo ao feedback**:
- Responda a todos os comentários
- Implemente mudanças solicitadas
- Explique decisões quando necessário
- Marque conversas como resolvidas

**Após aprovação**:
- Aguarde aprovação de pelo menos 1 reviewer
- Certifique-se que CI passou
- Faça merge usando "Squash and merge"

## 🧪 Testes

### Estrutura de Testes

```
tests/
├── frontend/
│   ├── components/        # Testes de componentes
│   ├── hooks/            # Testes de hooks
│   ├── services/         # Testes de serviços
│   └── integration/      # Testes de integração
├── backend/
│   ├── routes/           # Testes de rotas
│   ├── services/         # Testes de serviços
│   ├── utils/            # Testes de utilitários
│   └── integration/      # Testes de integração
└── e2e/                  # Testes end-to-end
```

### Frontend Testing

#### Testes de Componentes
```typescript
// src/components/__tests__/UserCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { UserCard } from '../UserCard';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com'
  };

  it('renders user information correctly', () => {
    render(<UserCard user={mockUser} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn();
    render(<UserCard user={mockUser} onEdit={mockOnEdit} />);
    
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(mockOnEdit).toHaveBeenCalledWith(mockUser.id);
  });
});
```

#### Testes de Hooks
```typescript
// src/hooks/__tests__/useUsers.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useUsers } from '../useUsers';

describe('useUsers', () => {
  it('fetches users on mount', async () => {
    const { result } = renderHook(() => useUsers());
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.users).toHaveLength(2);
    });
  });
});
```

### Backend Testing

#### Testes de Rotas
```javascript
// server/tests/routes/users.test.js
const request = require('supertest');
const app = require('../../index');

describe('Users API', () => {
  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', 'valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .get('/api/users')
        .expect(401);
    });
  });
});
```

### Comandos de Teste

```bash
# Frontend
npm run test              # Modo watch
npm run test:run          # Execução única
npm run test:coverage     # Com coverage
npm run test:integration  # Testes de integração

# Backend
cd server
npm test                  # Todos os testes
npm run test:unit         # Testes unitários
npm run test:routes       # Testes de rotas
npm run test:integration  # Testes de integração

# E2E
npm run test:e2e          # Cypress headless
npm run test:e2e:open     # Cypress interface
```

## 📚 Documentação

### Documentando Código

#### Componentes React
```typescript
/**
 * Card component for displaying user information
 * 
 * @param user - User object containing id, name, and email
 * @param onEdit - Callback function called when edit button is clicked
 * @param showActions - Whether to show action buttons (default: true)
 * 
 * @example
 * ```tsx
 * <UserCard 
 *   user={{ id: '1', name: 'John', email: 'john@example.com' }}
 *   onEdit={(id) => console.log('Edit user:', id)}
 * />
 * ```
 */
export const UserCard = ({ user, onEdit, showActions = true }: UserCardProps) => {
  // Component implementation
};
```

#### APIs Backend
```javascript
/**
 * Get all users
 * 
 * @route GET /api/users
 * @access Admin
 * @param {string} req.headers.authorization - Admin token
 * @returns {Object} Response object with users array
 * 
 * @example
 * // Request
 * GET /api/users
 * Authorization: admin-token-123
 * 
 * // Response
 * {
 *   "success": true,
 *   "data": [{ "id": "1", "name": "John" }],
 *   "message": "Users retrieved successfully"
 * }
 */
router.get('/users', validateAdminToken, async (req, res) => {
  // Route implementation
});
```

### Atualizando Documentação

Sempre atualize a documentação quando:
- Adicionar nova funcionalidade
- Modificar APIs existentes
- Alterar comportamento de componentes
- Adicionar novas configurações
- Modificar processo de setup

## 🔧 Troubleshooting

### Problemas Comuns

#### Setup do Ambiente

**Erro: "Cannot find module"**
```bash
# Limpar e reinstalar dependências
npm run clean:install

# Verificar versões
node --version  # Deve ser 20.x+
npm --version   # Deve ser 10.x+
```

**Erro: "Port already in use"**
```bash
# Encontrar processo usando a porta
lsof -i :3000  # Frontend
lsof -i :3001  # Backend

# Matar processo
kill -9 <PID>

# Ou usar portas diferentes
PORT=3002 npm run dev
```

#### Desenvolvimento

**TypeScript errors**
```bash
# Reiniciar TypeScript server no VS Code
Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"

# Verificar configuração
npx tsc --noEmit
```

**ESLint warnings**
```bash
# Corrigir automaticamente
npm run lint -- --fix

# Verificar configuração
npx eslint --print-config src/App.tsx
```

**Testes falhando**
```bash
# Executar testes específicos
npm test -- UserCard.test.tsx

# Modo debug
npm test -- --verbose

# Limpar cache
npm test -- --clearCache
```

#### Build e Deploy

**Build falha**
```bash
# Verificar dependências
npm audit
npm audit fix

# Build com logs detalhados
npm run build -- --verbose

# Verificar tamanho do bundle
npm run build:analyze
```

**Docker issues**
```bash
# Rebuild imagem
docker-compose build --no-cache

# Verificar logs
docker-compose logs -f

# Limpar volumes
docker-compose down -v
```

### Recursos de Ajuda

#### Documentação Técnica
- [Guia de Desenvolvimento](./docs/DEVELOPMENT_GUIDE.md)
- [Documentação da API](./docs/api/README.md)
- [Guia de Deploy](./docs/DEPLOY.md)

#### Ferramentas Úteis
- **VS Code Extensions**:
  - ES7+ React/Redux/React-Native snippets
  - TypeScript Importer
  - ESLint
  - Prettier
  - GitLens

#### Comunidade
- **Issues**: Para bugs e solicitações de funcionalidades
- **Discussions**: Para perguntas e discussões gerais
- **Wiki**: Para documentação colaborativa

### Contato

Para dúvidas específicas sobre contribuição:
- Abra uma issue com a tag `question`
- Entre em contato com os mantenedores
- Consulte a documentação existente

---

## 🎉 Obrigado por Contribuir!

Sua contribuição é valiosa para o crescimento e melhoria do WUZAPI Manager. Seguindo este guia, você ajuda a manter a qualidade e consistência do projeto.

**Lembre-se**:
- Qualidade > Quantidade
- Documentação é tão importante quanto código
- Testes previnem regressões
- Comunicação clara facilita reviews
- Paciência e colaboração constroem comunidades

**Próximos Passos**:
1. Configure seu ambiente de desenvolvimento
2. Explore o código existente
3. Escolha uma issue para trabalhar
4. Faça sua primeira contribuição
5. Ajude outros contribuidores

Bem-vindo à comunidade WUZAPI Manager! 🚀