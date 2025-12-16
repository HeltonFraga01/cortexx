# Design Document

## Overview

Este documento descreve a arquitetura e estratégia de implementação para substituir referências hardcoded ao nome "WUZAPI" por valores dinâmicos baseados na configuração de branding. A solução utiliza o BrandingContext existente para fornecer o nome da aplicação de forma consistente em toda a interface.

## Architecture

### Componentes Principais

```
┌─────────────────────────────────────────────────────────────┐
│                     BrandingContext                          │
│  - Fornece appName configurado pelo admin                   │
│  - Fallback para "WUZAPI" quando não configurado            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ useBrandingConfig()
                   │
    ┌──────────────┴──────────────┬──────────────────────────┐
    │                              │                          │
┌───▼────────────┐    ┌───────────▼──────────┐   ┌──────────▼─────────┐
│ UI Components  │    │  Default Templates   │   │   Test Mocks       │
│ - AdminSettings│    │  - defaultHomeHtml   │   │   - test-config    │
│ - UserSettings │    │  - BrandingSettings  │   │   - test-helpers   │
└────────────────┘    └──────────────────────┘   └────────────────────┘
```

### Fluxo de Dados

1. **Carregamento Inicial**:
   - BrandingContext busca configuração do backend
   - Se não existe, usa "WUZAPI" como padrão
   - Disponibiliza via hook `useBrandingConfig()`

2. **Renderização de Componentes**:
   - Componentes importam `useBrandingConfig()`
   - Acessam `brandingConfig.appName`
   - Exibem valor dinâmico na UI

3. **Templates HTML**:
   - Template padrão usa placeholders
   - Sistema substitui placeholders pelo appName
   - Renderiza HTML final com nome correto

## Components and Interfaces

### 1. BrandingContext (Existente - Sem Mudanças)

```typescript
interface BrandingConfig {
  id: number | null;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;
}

// Hook existente
const useBrandingConfig = () => {
  const context = useContext(BrandingContext);
  return context.config; // { appName: "WUZAPI" ou valor configurado }
};
```

### 2. Componentes de UI (Atualizar)

#### AdminSettings.tsx

**Antes**:
```typescript
<span className="text-sm font-medium">WUZAPI Team</span>
```

**Depois**:
```typescript
const brandingConfig = useBrandingConfig();

<span className="text-sm font-medium">{brandingConfig.appName} Team</span>
```

#### UserSettings.tsx

**Antes**:
```typescript
<CardDescription>
  Detalhes da sua instância WUZAPI
</CardDescription>
```

**Depois**:
```typescript
const brandingConfig = useBrandingConfig();

<CardDescription>
  Detalhes da sua instância {brandingConfig.appName}
</CardDescription>
```

### 3. Template HTML (Atualizar)

#### defaultHomeHtml.ts

**Estratégia**: Criar função que substitui placeholders

```typescript
export const getDefaultHomeHtml = (appName: string = 'WUZAPI'): string => {
  return DEFAULT_HOME_HTML_TEMPLATE
    .replace(/\{\{APP_NAME\}\}/g, appName)
    .replace(/\{\{APP_NAME_MANAGER\}\}/g, `${appName} Manager`);
};

const DEFAULT_HOME_HTML_TEMPLATE = `
  <!-- Template Landing Page SaaS - {{APP_NAME}} -->
  <h2>{{APP_NAME}} centraliza gestão de dados...</h2>
  <footer>© 2025 {{APP_NAME_MANAGER}}. Todos os direitos reservados.</footer>
`;
```

### 4. Meta Tags HTML (Atualizar Dinamicamente)

#### index.html

**Problema**: Meta tags hardcoded fazem o link compartilhado mostrar "WUZAPI Manager"

**Solução**: Atualizar meta tags dinamicamente via JavaScript após carregar branding

```typescript
// Em App.tsx ou main.tsx, após carregar branding
useEffect(() => {
  const brandingConfig = useBrandingConfig();
  const appName = brandingConfig?.appName || 'WUZAPI';
  
  // Atualizar título da página
  document.title = `${appName} Manager`;
  
  // Atualizar meta tags Open Graph
  updateMetaTag('og:title', `${appName} Manager`);
  updateMetaTag('og:site_name', `${appName} Manager`);
  updateMetaTag('twitter:title', `${appName} Manager`);
  
  // Atualizar descrição se necessário
  const description = `Gerencie suas instâncias ${appName} de forma eficiente`;
  updateMetaTag('og:description', description);
  updateMetaTag('twitter:description', description);
}, [brandingConfig]);

function updateMetaTag(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.querySelector(`meta[name="${property}"]`) as HTMLMetaElement;
  }
  if (!meta) {
    meta = document.createElement('meta');
    if (property.startsWith('og:') || property.startsWith('twitter:')) {
      meta.setAttribute('property', property);
    } else {
      meta.setAttribute('name', property);
    }
    document.head.appendChild(meta);
  }
  meta.content = content;
}
```

**index.html** deve ter meta tags base:

```html
<!DOCTYPE html>
<html lang="pt-br">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WUZAPI Manager</title>
    
    <!-- Meta tags para compartilhamento (serão atualizadas dinamicamente) -->
    <meta property="og:title" content="WUZAPI Manager" />
    <meta property="og:site_name" content="WUZAPI Manager" />
    <meta property="og:description" content="Gerencie suas instâncias WhatsApp Business API de forma eficiente" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://painel.meggatv.com" />
    <meta property="og:image" content="/og-image.png" />
    
    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="WUZAPI Manager" />
    <meta name="twitter:description" content="Gerencie suas instâncias WhatsApp Business API de forma eficiente" />
    <meta name="twitter:image" content="/og-image.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 5. Valores Padrão (Manter Fallback)

Estes locais devem manter "WUZAPI" como valor padrão:

```typescript
// src/services/branding.ts
const defaultConfig: BrandingConfig = {
  appName: 'WUZAPI', // ✅ Manter como fallback
  // ...
};

// src/types/branding.ts
export const DEFAULT_BRANDING_CONFIG: BrandingConfig = {
  appName: import.meta.env.VITE_APP_NAME || 'WUZAPI', // ✅ Manter
  // ...
};
```

## Data Models

### BrandingConfig (Existente)

```typescript
interface BrandingConfig {
  id: number | null;
  appName: string;        // Valor dinâmico configurado pelo admin
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;
}
```

### Banco de Dados (Existente)

```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_home_html TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Error Handling

### Cenários de Erro

1. **BrandingContext não disponível**:
   - Usar fallback "WUZAPI" diretamente
   - Logar warning no console

2. **appName vazio ou null**:
   - Usar "WUZAPI" como fallback
   - Não quebrar a renderização

3. **Template HTML inválido**:
   - Usar template padrão sem substituições
   - Logar erro no console

### Implementação

```typescript
const useSafeAppName = (): string => {
  try {
    const brandingConfig = useBrandingConfig();
    return brandingConfig?.appName || 'WUZAPI';
  } catch (error) {
    console.warn('BrandingContext not available, using fallback');
    return 'WUZAPI';
  }
};
```

## Testing Strategy

### 1. Testes Unitários

**Componentes**:
- Verificar que `useBrandingConfig()` é chamado
- Verificar que appName é exibido corretamente
- Verificar fallback quando branding não está disponível

```typescript
describe('AdminSettings', () => {
  it('should display app name from branding config', () => {
    const mockBranding = { appName: 'MyApp' };
    render(<AdminSettings />, { brandingConfig: mockBranding });
    expect(screen.getByText('MyApp Team')).toBeInTheDocument();
  });

  it('should fallback to WUZAPI when branding not available', () => {
    render(<AdminSettings />, { brandingConfig: null });
    expect(screen.getByText('WUZAPI Team')).toBeInTheDocument();
  });
});
```

### 2. Testes de Integração

**Fluxo Completo**:
- Admin configura appName
- Usuário vê novo nome em todas as telas
- Reset para padrão volta para "WUZAPI"

```typescript
describe('Dynamic App Name Integration', () => {
  it('should update app name across all screens', async () => {
    // Admin configura
    await updateBranding({ appName: 'CustomApp' });
    
    // Verifica em diferentes telas
    await navigateTo('/admin/settings');
    expect(screen.getByText('CustomApp Team')).toBeInTheDocument();
    
    await navigateTo('/user/settings');
    expect(screen.getByText(/CustomApp/)).toBeInTheDocument();
  });
});
```

### 3. Testes de Template

**Template HTML**:
- Verificar substituição de placeholders
- Verificar fallback para "WUZAPI"
- Verificar múltiplas ocorrências

```typescript
describe('getDefaultHomeHtml', () => {
  it('should replace placeholders with app name', () => {
    const html = getDefaultHomeHtml('MyApp');
    expect(html).toContain('MyApp centraliza');
    expect(html).toContain('© 2025 MyApp Manager');
    expect(html).not.toContain('{{APP_NAME}}');
  });

  it('should use WUZAPI as default', () => {
    const html = getDefaultHomeHtml();
    expect(html).toContain('WUZAPI centraliza');
  });
});
```

## Implementation Plan

### Fase 1: Atualizar Componentes de UI
1. Adicionar `useBrandingConfig()` em AdminSettings
2. Adicionar `useBrandingConfig()` em UserSettings
3. Substituir strings hardcoded por `brandingConfig.appName`

### Fase 2: Atualizar Template HTML
1. Criar função `getDefaultHomeHtml(appName)`
2. Substituir strings por placeholders no template
3. Atualizar locais que usam o template

### Fase 3: Atualizar Testes
1. Atualizar mocks para usar valores dinâmicos
2. Adicionar testes para verificar comportamento dinâmico
3. Garantir que todos os testes passam

### Fase 4: Validação
1. Testar em ambiente de desenvolvimento
2. Verificar todas as telas afetadas
3. Testar cenários de fallback

## Locais Específicos de Mudança

### Arquivos Já Implementados (Verificar)

1. **src/components/admin/AdminSettings.tsx** ✅
   - Linha 222: Substituir "WUZAPI Team" por `{brandingConfig.appName} Team`

2. **src/components/user/UserSettings.tsx** ✅
   - Linha 207: Substituir "instância WUZAPI" por `instância {brandingConfig.appName}`
   - Linha 261: Substituir "API WUZAPI" por `API {brandingConfig.appName}`

3. **src/constants/defaultHomeHtml.ts** ✅
   - Criar função `getDefaultHomeHtml(appName: string)`
   - Substituir "WUZAPI" por placeholders `{{APP_NAME}}`
   - Substituir "WUZAPI Manager" por `{{APP_NAME_MANAGER}}`

### Novos Arquivos a Modificar

4. **src/pages/UserContacts.tsx** ✅
   - Linha 279: Substituir "Organize e gerencie seus contatos da agenda WUZAPI" por `Organize e gerencie seus contatos da agenda {brandingConfig.appName}`
   - Linha 370: Substituir "Importe contatos da agenda WUZAPI para começar" por `Importe contatos da agenda {brandingConfig.appName} para começar`
   - Linha 383: Substituir "importar seus contatos da agenda WUZAPI" por `importar seus contatos da agenda {brandingConfig.appName}`
   - Linha 389: Substituir "💡 Faça login para importar contatos da agenda WUZAPI" por `💡 Faça login para importar contatos da agenda {brandingConfig.appName}`

5. **src/components/shared/forms/CreateUserForm.tsx**
   - Linha 268: JÁ USA BRANDING ✅ - "Configure uma nova instância {brandingConfig.appName} com configurações avançadas"
   - Verificar se há outras referências hardcoded

6. **src/components/disparador/DisparadorWrapper.tsx** ✅
   - Linha 83: Substituir "Use o token de outra instância WUZAPI" por `Use o token de outra instância {brandingConfig.appName}`

7. **src/components/disparador/ContactImporter.tsx** ✅
   - Linha 5: Atualizar comentário "Agenda WUZAPI" para "Agenda do sistema"
   - Linha 103: Substituir "contatos importados da agenda WUZAPI" por `contatos importados da agenda {brandingConfig.appName}`
   - Linha 325: Substituir "Importe contatos da agenda WUZAPI" por `Importe contatos da agenda {brandingConfig.appName}`
   - Linha 340: Substituir "Agenda WUZAPI" por `Agenda {brandingConfig.appName}`

### Comentários Técnicos (Opcional - Baixa Prioridade)

Estes são comentários de código que podem ser atualizados, mas não afetam a funcionalidade:

6. **src/components/shared/forms/CreateUserForm.tsx**
   - Linha 2: Comentário "Componente avançado para criar usuários WuzAPI"

7. **src/pages/UserContacts.tsx**
   - Linha 6: Comentário "da agenda WUZAPI para envio de mensagens"

8. **src/pages/Index.tsx**
   - Linha 2: Comentário "Index Page - WuzAPI Dashboard"
   - Linha 3: Comentário "Página principal que renderiza o dashboard WuzAPI"

### Arquivos de Teste (Já Implementados)

9. **src/test/integration-utils.tsx** ✅
   - Atualizar mock para usar valor dinâmico

10. **src/test/branding-integration.test.tsx** ✅
   - Atualizar expectativas para usar valor do mock

11. **src/test/templates/test-config.js** ✅
   - Manter "Test WUZAPI" como valor de teste

12. **src/test/templates/test-helpers.js** ✅
   - Manter valores de teste consistentes

### Arquivos a NÃO Modificar (Referências Técnicas)

- `src/services/wuzapi.ts` - Tipos técnicos (WuzAPIUser, WuzAPIService)
- `src/services/mock-api.ts` - Tipos técnicos
- `src/lib/wuzapi-types.ts` - Tipos TypeScript (WuzAPIResponse, WuzAPIInstance, etc.)
- `src/lib/wuzapi-client.ts` - Cliente técnico
- `src/contexts/WuzAPIAuthContext.tsx` - Nomes de contextos e tipos técnicos
- `src/contexts/WuzAPIInstancesContext.tsx` - Nomes de contextos e tipos técnicos
- `src/components/wuzapi/` - Nomes de componentes e arquivos
- `src/lib/api.ts` - Variáveis de configuração
- `src/config/environment.ts` - Variáveis de ambiente
- `src/services/branding.ts` - Valores padrão (fallback)
- `src/types/branding.ts` - Valores padrão (fallback)
- localStorage keys (ex: 'wuzapi_user', 'wuzapi_config', 'wuzapi_contacts')
- Nomes de arquivos e módulos

## Performance Considerations

- **BrandingContext**: Já está implementado e otimizado
- **useBrandingConfig()**: Hook leve, sem impacto de performance
- **Template HTML**: Substituição de strings é operação rápida
- **Sem re-renders desnecessários**: Usar memo se necessário

## Security Considerations

- **XSS**: appName já é sanitizado pelo backend
- **Validação**: appName tem limite de 50 caracteres
- **Fallback**: Sempre usar valor seguro ("WUZAPI") em caso de erro
