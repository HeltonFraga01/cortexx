# Frontend Testing Guide

Este guia documenta a configuração e padrões de teste para o frontend do WUZAPI Manager.

## Estrutura de Testes

### Tipos de Teste

1. **Testes Unitários** - Testam componentes isoladamente
2. **Testes de Integração** - Testam fluxos completos com múltiplos componentes
3. **Testes E2E** - Testam a aplicação completa no navegador

### Organização de Arquivos

```
src/
├── test/
│   ├── setup.ts                    # Configuração global dos testes
│   ├── utils.tsx                   # Utilitários para testes unitários
│   ├── integration-utils.tsx       # Utilitários para testes de integração
│   ├── mocks/                      # Mocks reutilizáveis
│   │   ├── react-router-dom.ts
│   │   └── sonner.ts
│   └── templates/                  # Templates para novos testes
│       ├── component-unit.template.test.tsx
│       └── component-integration.template.test.tsx
├── components/
│   └── **/__tests__/              # Testes específicos de componentes
└── **/*.test.{ts,tsx}             # Testes unitários
└── **/*.integration.test.{ts,tsx} # Testes de integração

cypress/
├── e2e/                           # Testes E2E
├── fixtures/                      # Dados de teste
├── support/                       # Comandos customizados
└── cypress.config.ts              # Configuração do Cypress
```

## Configuração

### Vitest (Testes Unitários e Integração)

Configurado em `vitest.config.ts`:
- Ambiente: jsdom
- Setup: `src/test/setup.ts`
- Cobertura: v8
- Globals: habilitado

### Cypress (Testes E2E)

Configurado em `cypress.config.ts`:
- Base URL: http://localhost:5173
- Viewport: 1280x720
- Timeouts: 10s
- Screenshots: apenas em falhas

## Scripts Disponíveis

```bash
# Testes unitários
npm run test              # Modo watch
npm run test:run          # Execução única
npm run test:unit         # Apenas unitários com verbose
npm run test:coverage     # Com cobertura

# Testes de integração
npm run test:integration  # Apenas testes de integração

# Testes E2E
npm run cypress:open      # Interface gráfica
npm run cypress:run       # Headless
npm run test:e2e          # Alias para cypress:run
npm run test:e2e:open     # Alias para cypress:open
```

## Padrões de Teste

### Testes Unitários

Use para testar:
- Renderização de componentes
- Props e estados
- Eventos de usuário
- Validações
- Lógica isolada

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MyComponent from './MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent title="Test" />)
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})
```

### Testes de Integração

Use para testar:
- Fluxos completos
- Interação entre componentes
- Chamadas de API
- Contextos e providers

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, setupApiMocks } from '@/test/integration-utils'
import { screen, waitFor } from '@testing-library/react'
import MyPage from './MyPage'

describe('MyPage - Integration', () => {
  beforeEach(() => {
    setupApiMocks()
  })

  it('should complete full user flow', async () => {
    render(<MyPage />)
    
    await waitFor(() => {
      expect(screen.getByText('Loaded')).toBeInTheDocument()
    })
  })
})
```

### Testes E2E

Use para testar:
- Fluxos críticos de usuário
- Autenticação
- Navegação
- Integrações reais

```typescript
describe('User Flow', () => {
  beforeEach(() => {
    cy.mockWuzAPI()
    cy.loginAsAdmin()
  })

  it('should complete admin workflow', () => {
    cy.visit('/admin')
    cy.contains('Dashboard').should('be.visible')
    cy.get('[data-testid="users-link"]').click()
    cy.url().should('include', '/admin/users')
  })
})
```

## Utilitários Disponíveis

### Para Testes Unitários (`src/test/utils.tsx`)

- `render()` - Renderização com providers básicos
- `mockUser` - Dados de usuário mock
- `mockWuzAPIService` - Mock do serviço WUZAPI

### Para Testes de Integração (`src/test/integration-utils.tsx`)

- `render()` - Renderização com todos os providers
- `setupApiMocks()` - Configuração de mocks de API
- `mockApiError()` - Simulação de erros de API
- `simulateUserFlow` - Helpers para interações de usuário

### Para Testes E2E (Cypress)

- `cy.loginAsAdmin()` - Login como admin
- `cy.loginAsUser(token)` - Login como usuário
- `cy.mockWuzAPI()` - Mock das APIs WUZAPI
- `cy.waitForApi(alias)` - Aguardar resposta de API

## Mocks e Fixtures

### Mocks Globais

Configurados em `src/test/setup.ts`:
- `fetch` global
- `localStorage` e `sessionStorage`
- `window.confirm` e `window.alert`
- Variáveis de ambiente

### Mocks de Bibliotecas

- `sonner` - Sistema de toast
- `react-router-dom` - Navegação
- Serviços externos (WUZAPI, NocoDB)

### Fixtures do Cypress

- `users.json` - Lista de usuários
- `branding.json` - Configuração de branding

## Boas Práticas

### Geral

1. **Nomeação**: Use nomes descritivos para testes
2. **Organização**: Agrupe testes relacionados com `describe`
3. **Isolamento**: Cada teste deve ser independente
4. **Limpeza**: Use `beforeEach` e `afterEach` para setup/cleanup

### Testes Unitários

1. **Foque na lógica**: Teste comportamento, não implementação
2. **Props mínimas**: Use apenas props necessárias para o teste
3. **Mocks específicos**: Mock apenas dependências externas
4. **Assertions claras**: Use matchers específicos do jest-dom

### Testes de Integração

1. **Fluxos reais**: Teste cenários de uso real
2. **APIs mockadas**: Use mocks consistentes de API
3. **Estados de loading**: Teste estados de carregamento e erro
4. **Interações completas**: Teste do início ao fim do fluxo

### Testes E2E

1. **Cenários críticos**: Foque nos fluxos mais importantes
2. **Dados consistentes**: Use fixtures para dados de teste
3. **Seletores estáveis**: Use data-testid quando necessário
4. **Timeouts adequados**: Configure timeouts apropriados

## Debugging

### Testes Unitários/Integração

```bash
# Debug com breakpoints
npm run test -- --inspect-brk

# Executar teste específico
npm run test -- MyComponent.test.tsx

# Modo verbose
npm run test:unit
```

### Testes E2E

```bash
# Interface gráfica para debug
npm run cypress:open

# Screenshots e vídeos
# Configurado automaticamente em falhas
```

## Cobertura de Código

```bash
# Gerar relatório de cobertura
npm run test:coverage

# Visualizar no navegador
open coverage/index.html
```

### Metas de Cobertura

- **Statements**: 80%
- **Branches**: 75%
- **Functions**: 80%
- **Lines**: 80%

## Troubleshooting

### Problemas Comuns

1. **Testes lentos**: Verifique mocks de API e timeouts
2. **Falhas intermitentes**: Adicione `waitFor` para operações assíncronas
3. **Mocks não funcionam**: Verifique ordem de imports e configuração
4. **Cypress não encontra elementos**: Use seletores mais específicos

### Logs e Debug

```typescript
// Debug em testes
import { screen } from '@testing-library/react'

// Ver DOM atual
screen.debug()

// Ver elemento específico
screen.debug(screen.getByTestId('my-element'))
```

## Exemplos Práticos

Veja os templates em `src/test/templates/` para exemplos completos de:
- Testes unitários de componentes
- Testes de integração com APIs
- Testes E2E de fluxos completos

## Integração Contínua

Os testes são executados automaticamente em:
- Pull requests
- Push para main
- Releases

Configuração em `.github/workflows/` (se aplicável).