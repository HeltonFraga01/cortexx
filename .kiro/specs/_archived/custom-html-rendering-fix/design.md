# Design Document

## Overview

Este documento descreve o design da solução para corrigir o sistema de renderização de HTML personalizado. A solução envolve modificar o componente `CustomHtmlRenderer` para usar uma abordagem de `srcdoc` ao invés de `document.write()`, garantindo que todas as bibliotecas externas, estilos e scripts sejam carregados e executados corretamente.

## Architecture

### Current Architecture

```
PublicHome Component
  ├─ useBrandingConfig() hook
  ├─ Loading state
  └─ Conditional rendering:
      ├─ CustomHtmlRenderer (if customHomeHtml exists)
      │   └─ iframe with sandbox
      │       └─ document.write(html) ❌ PROBLEMA
      └─ LoginPage (default)
```

**Problema Identificado:**
- O método `document.write()` não garante que recursos externos sejam carregados corretamente
- O sandbox do iframe pode estar bloqueando recursos externos
- Scripts inline podem não ser executados na ordem correta
- Bibliotecas CDN (Tailwind, Lucide, TAOS) não são inicializadas

### Proposed Architecture

```
PublicHome Component
  ├─ useBrandingConfig() hook
  ├─ Loading state
  └─ Conditional rendering:
      ├─ CustomHtmlRenderer (if customHomeHtml exists)
      │   └─ iframe with srcdoc ✅ SOLUÇÃO
      │       ├─ Sandbox com permissões corretas
      │       ├─ Carregamento de recursos externos
      │       ├─ Execução de scripts inline
      │       └─ Error handling e debugging
      └─ LoginPage (default)
```

## Components and Interfaces

### 1. CustomHtmlRenderer Component (Modified)

**Location:** `src/pages/PublicHome.tsx`

**Props:**
```typescript
interface CustomHtmlRendererProps {
  html: string;
}
```

**Key Changes:**
1. Usar `srcdoc` attribute ao invés de `document.write()`
2. Configurar sandbox com permissões adequadas
3. Adicionar error handling e loading states
4. Implementar debugging logs
5. Adicionar timeout para detecção de falhas

**Sandbox Permissions:**
```typescript
sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation allow-downloads"
```

### 2. Error Boundary Component (New)

**Location:** `src/components/shared/CustomHtmlErrorBoundary.tsx`

**Purpose:** Capturar erros de renderização e mostrar fallback

**Interface:**
```typescript
interface CustomHtmlErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface CustomHtmlErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}
```

### 3. Loading Indicator Component (New)

**Location:** `src/components/shared/CustomHtmlLoadingIndicator.tsx`

**Purpose:** Mostrar indicador de carregamento enquanto HTML é renderizado

**Interface:**
```typescript
interface CustomHtmlLoadingIndicatorProps {
  message?: string;
  timeout?: number;
  onTimeout?: () => void;
}
```

## Data Models

### BrandingConfig (Existing)

```typescript
interface BrandingConfig {
  id: number;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;  // ← Campo relevante
  createdAt: string | null;
  updatedAt: string | null;
}
```

### CustomHtmlRenderState (New)

```typescript
interface CustomHtmlRenderState {
  status: 'loading' | 'ready' | 'error' | 'timeout';
  error: Error | null;
  loadTime: number | null;
  resourcesLoaded: number;
  resourcesFailed: string[];
}
```

## Error Handling

### Error Types

1. **Loading Timeout Error**
   - Timeout: 10 segundos
   - Ação: Mostrar mensagem de erro com botão "Reload"
   - Fallback: Página de login padrão

2. **Script Execution Error**
   - Capturar via `window.onerror` no iframe
   - Log no console do parent
   - Continuar renderização (não-crítico)

3. **Resource Loading Error**
   - Capturar via `onerror` events
   - Log warnings
   - Continuar renderização

4. **Critical Rendering Error**
   - Capturar via Error Boundary
   - Mostrar mensagem de erro
   - Fallback para LoginPage

### Error Messages

```typescript
const ERROR_MESSAGES = {
  TIMEOUT: 'A página personalizada demorou muito para carregar. Tente recarregar.',
  SCRIPT_ERROR: 'Erro ao executar scripts da página personalizada.',
  RESOURCE_ERROR: 'Alguns recursos da página não puderam ser carregados.',
  CRITICAL_ERROR: 'Erro crítico ao renderizar a página personalizada.',
};
```

## Testing Strategy

### Unit Tests

1. **CustomHtmlRenderer Component**
   - Test: Renderiza HTML simples corretamente
   - Test: Aplica sandbox permissions corretas
   - Test: Detecta timeout após 10 segundos
   - Test: Chama onError quando há erro

2. **CustomHtmlErrorBoundary Component**
   - Test: Captura erros de renderização
   - Test: Mostra fallback quando há erro
   - Test: Chama callback onError

3. **CustomHtmlLoadingIndicator Component**
   - Test: Mostra indicador de loading
   - Test: Detecta timeout
   - Test: Chama callback onTimeout

### Integration Tests

1. **PublicHome Page**
   - Test: Renderiza CustomHtmlRenderer quando customHomeHtml existe
   - Test: Renderiza LoginPage quando customHomeHtml não existe
   - Test: Mostra loading state enquanto branding carrega
   - Test: Fallback para LoginPage em caso de erro

### E2E Tests (Cypress)

1. **Custom HTML Rendering**
   - Test: Página personalizada carrega completamente
   - Test: Estilos Tailwind são aplicados
   - Test: Ícones Lucide são renderizados
   - Test: Animações TAOS são executadas
   - Test: Menu mobile funciona
   - Test: Modais abrem e fecham
   - Test: Links de navegação funcionam
   - Test: Formulários funcionam

## Implementation Approach

### Phase 1: Core Rendering Fix
1. Modificar `CustomHtmlRenderer` para usar `srcdoc`
2. Configurar sandbox permissions corretas
3. Adicionar basic error handling

### Phase 2: Error Handling & Loading States
1. Criar `CustomHtmlErrorBoundary` component
2. Criar `CustomHtmlLoadingIndicator` component
3. Implementar timeout detection
4. Adicionar fallback para LoginPage

### Phase 3: Debugging & Monitoring
1. Adicionar console logs para debugging
2. Implementar resource loading tracking
3. Adicionar performance monitoring
4. Criar error reporting

### Phase 4: Testing & Validation
1. Escrever unit tests
2. Escrever integration tests
3. Escrever E2E tests
4. Testar com homeCompativel.html
5. Validar performance

## Technical Considerations

### Security

- **Sandbox Isolation:** O iframe mantém isolamento de segurança
- **CSP (Content Security Policy):** Não interferir com CSP do parent
- **XSS Protection:** HTML é sanitizado no backend antes de salvar
- **Same-Origin Policy:** Permitir same-origin para funcionalidade completa

### Performance

- **Lazy Loading:** Carregar HTML apenas quando necessário
- **Resource Caching:** Browser cache para recursos externos
- **Size Limit:** Manter limite de 1MB para HTML
- **Timeout:** 10 segundos para detecção de falhas

### Browser Compatibility

- **Modern Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **srcdoc Support:** Suportado em todos os browsers modernos
- **Sandbox Support:** Suportado em todos os browsers modernos
- **Fallback:** LoginPage para browsers antigos

### Accessibility

- **ARIA Labels:** Adicionar aria-label ao iframe
- **Keyboard Navigation:** Garantir navegação por teclado
- **Screen Readers:** Anunciar loading states
- **Focus Management:** Gerenciar foco ao carregar/descarregar

## Diagrams

### Component Hierarchy

```
PublicHome
├── Loading State (Loader2)
├── CustomHtmlErrorBoundary
│   ├── CustomHtmlLoadingIndicator
│   └── CustomHtmlRenderer
│       └── iframe[srcdoc]
└── LoginPage (fallback)
```

### State Flow

```
Initial State
    ↓
Loading Branding Config
    ↓
Has customHomeHtml?
    ├─ Yes → Render CustomHtmlRenderer
    │         ↓
    │    Show Loading Indicator
    │         ↓
    │    Load HTML in iframe
    │         ↓
    │    Resources Loading...
    │         ↓
    │    ┌─────────────┬─────────────┐
    │    ↓             ↓             ↓
    │  Success      Timeout       Error
    │    ↓             ↓             ↓
    │  Ready      Show Error    Show Error
    │              + Reload      + Fallback
    │
    └─ No → Render LoginPage
```

### Resource Loading Sequence

```
1. HTML parsed
2. External stylesheets loaded (Google Fonts, TAOS CSS)
3. External scripts loaded (Tailwind CDN, Lucide, TAOS)
4. Inline styles applied
5. DOM ready
6. window.onload triggered
7. Inline scripts executed
8. Libraries initialized (taos.init(), lucide.createIcons())
9. Event listeners attached
10. Page ready
```

## Migration Plan

### Step 1: Backup Current Implementation
- Criar backup do `PublicHome.tsx` atual
- Documentar comportamento atual

### Step 2: Implement Core Changes
- Modificar `CustomHtmlRenderer` para usar `srcdoc`
- Testar com HTML simples

### Step 3: Add Error Handling
- Implementar Error Boundary
- Implementar Loading Indicator
- Testar error scenarios

### Step 4: Testing
- Testar com `homeCompativel.html`
- Validar todas as funcionalidades
- Verificar performance

### Step 5: Deployment
- Deploy em staging
- Testes de aceitação
- Deploy em produção
- Monitorar erros

## Rollback Plan

Se a solução falhar:
1. Reverter para implementação anterior (backup)
2. Investigar logs de erro
3. Corrigir problemas identificados
4. Re-deploy com correções

## Success Criteria

A solução será considerada bem-sucedida quando:

1. ✅ HTML personalizado renderiza completamente
2. ✅ Tailwind CSS é aplicado corretamente
3. ✅ Ícones Lucide são renderizados
4. ✅ Animações TAOS funcionam
5. ✅ Scripts inline são executados
6. ✅ Menu mobile funciona
7. ✅ Modais abrem e fecham
8. ✅ Formulários funcionam
9. ✅ Links de navegação funcionam
10. ✅ Performance é aceitável (< 3s para carregar)
11. ✅ Erros são tratados gracefully
12. ✅ Fallback para LoginPage funciona
