# Dynamic Theme Colors System Design

## Overview

O sistema de cores de tema dinâmico permitirá que administradores configurem as cores principais da aplicação para os modos dark e light através dos campos "Cor Primária" e "Cor Secundária" na página de configurações. O sistema utilizará CSS variables e Tailwind CSS para aplicar as cores dinamicamente em toda a interface, sem necessidade de recarregar a página.

## Architecture

### Frontend Architecture
- **Theme Color Manager**: Serviço responsável por converter cores hex para HSL e aplicar no DOM
- **Branding Context Extension**: Extensão do BrandingContext existente para gerenciar cores de tema
- **Theme Preview Component**: Componente para visualizar as cores antes de salvar
- **CSS Variables System**: Sistema de variáveis CSS que controla as cores do Tailwind

### Backend Architecture
- **Existing Branding API**: Utilizar endpoints existentes (`/api/admin/branding`)
- **Color Validation**: Validação de formato hex e conversão para HSL
- **Database Storage**: Campos `primary_color` e `secondary_color` já existem na tabela `branding`

### Data Flow
1. Admin seleciona cores nos campos "Cor Primária" e "Cor Secundária"
2. Preview em tempo real mostra as cores aplicadas
3. Admin salva as configurações
4. Backend valida e armazena as cores
5. Frontend atualiza CSS variables no elemento root
6. Tailwind aplica as novas cores em todos os componentes
7. Usuários veem as cores atualizadas automaticamente

## Components and Interfaces

### Frontend Components

#### ThemeColorManager Service
```typescript
interface ThemeColorManager {
  // Converter hex para HSL
  hexToHSL(hex: string): { h: number; s: number; l: number };
  
  // Aplicar cores no DOM
  applyThemeColors(primaryColor: string, secondaryColor: string): void;
  
  // Remover cores customizadas
  resetThemeColors(): void;
  
  // Gerar variações de cor (foreground, hover, etc)
  generateColorVariations(baseColor: string): {
    base: string;
    foreground: string;
    hover: string;
  };
}
```

#### BrandingContext Extension
```typescript
interface BrandingContextType {
  // ... campos existentes
  
  // Novos métodos para cores de tema
  applyThemeColors: () => void;
  resetThemeColors: () => void;
  previewThemeColors: (primary: string, secondary: string) => void;
}
```

#### ThemePreview Component
```typescript
interface ThemePreviewProps {
  primaryColor: string;
  secondaryColor: string;
  currentTheme: 'light' | 'dark';
}

// Componente que mostra preview de:
// - Botões primários
// - Cards
// - Badges
// - Links
// - Sidebar
```

### CSS Variables Mapping

#### Light Mode (usa secondaryColor)
```css
:root {
  --primary: <secondaryColor em HSL>;
  --primary-foreground: <cor contrastante>;
  --accent: <secondaryColor em HSL>;
  --sidebar-primary: <secondaryColor em HSL>;
  --ring: <secondaryColor em HSL>;
}
```

#### Dark Mode (usa primaryColor)
```css
.dark {
  --primary: <primaryColor em HSL>;
  --primary-foreground: <cor contrastante>;
  --accent: <primaryColor em HSL>;
  --sidebar-primary: <primaryColor em HSL>;
  --ring: <primaryColor em HSL>;
}
```

### Color Conversion Logic

#### Hex to HSL Conversion
```typescript
function hexToHSL(hex: string): string {
  // Remove # se presente
  hex = hex.replace('#', '');
  
  // Converter para RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  // Calcular HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  // Retornar no formato "H S% L%"
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
```

#### Foreground Color Calculation
```typescript
function calculateForeground(hsl: string): string {
  // Extrair luminosidade
  const l = parseInt(hsl.split(' ')[2]);
  
  // Se luminosidade > 50%, usar cor escura
  // Se luminosidade <= 50%, usar cor clara
  return l > 50 ? '222 47% 11%' : '210 40% 98%';
}
```

## Data Models

### BrandingConfig Extension
```typescript
interface BrandingConfig {
  // ... campos existentes
  primaryColor?: string;    // Hex color para tema dark
  secondaryColor?: string;  // Hex color para tema light
}
```

### Theme Color State
```typescript
interface ThemeColorState {
  primaryColorHSL: string;
  secondaryColorHSL: string;
  isPreviewMode: boolean;
  previewColors?: {
    primary: string;
    secondary: string;
  };
}
```

## Error Handling

### Frontend Error Handling
- **Invalid Color Format**: Validar formato hex antes de aplicar
- **Conversion Errors**: Fallback para cores padrão se conversão falhar
- **Preview Errors**: Isolar preview em try-catch para não quebrar a página
- **Apply Errors**: Reverter para cores anteriores se aplicação falhar

### Backend Error Handling
- **Invalid Hex Format**: Retornar erro 400 com mensagem descritiva
- **Missing Colors**: Aceitar null/undefined e usar cores padrão
- **Database Errors**: Log de erro e retornar 500

## Testing Strategy

### Frontend Testing
- **Unit Tests**: 
  - Testar conversão hex para HSL
  - Testar cálculo de cor foreground
  - Testar aplicação de CSS variables
- **Component Tests**:
  - Testar ThemePreview com diferentes cores
  - Testar atualização de cores no BrandingSettings
- **Integration Tests**:
  - Testar fluxo completo de salvar e aplicar cores
  - Testar alternância entre modos dark/light

### Visual Testing
- **Preview Accuracy**: Verificar se preview corresponde ao resultado final
- **Color Contrast**: Garantir contraste adequado (WCAG AA)
- **Component Coverage**: Testar cores em todos os componentes principais

## Implementation Phases

### Phase 1: Color Conversion Service
1. Criar `themeColorManager.ts` service
2. Implementar conversão hex para HSL
3. Implementar cálculo de cor foreground
4. Adicionar testes unitários

### Phase 2: CSS Variables Application
1. Criar função para aplicar CSS variables no root
2. Implementar lógica de aplicação por tema (dark/light)
3. Adicionar suporte para remover cores customizadas
4. Testar aplicação em diferentes navegadores

### Phase 3: BrandingContext Integration
1. Estender BrandingContext com métodos de tema
2. Adicionar estado para cores de tema
3. Implementar `applyThemeColors()` no contexto
4. Adicionar listener para mudanças de tema

### Phase 4: Preview Component
1. Criar componente ThemePreview
2. Implementar preview de botões, cards, badges
3. Adicionar toggle dark/light no preview
4. Integrar preview no BrandingSettings

### Phase 5: BrandingSettings Update
1. Atualizar labels dos campos de cor
2. Adicionar descrições explicativas
3. Integrar ThemePreview component
4. Adicionar preview em tempo real ao selecionar cores

### Phase 6: Testing and Polish
1. Adicionar testes de integração
2. Testar em diferentes navegadores
3. Verificar contraste de cores (acessibilidade)
4. Otimizar performance de aplicação de cores

## Security Considerations

- **Color Validation**: Validar formato hex no frontend e backend
- **XSS Prevention**: Sanitizar valores antes de aplicar no DOM
- **CSS Injection**: Usar apenas valores HSL validados
- **Admin Only**: Manter restrição de admin para modificar cores

## Accessibility Considerations

### Color Contrast
- **WCAG AA Compliance**: Garantir contraste mínimo de 4.5:1 para texto
- **Contrast Checker**: Adicionar validação de contraste no preview
- **Warning Messages**: Alertar admin se contraste for insuficiente

### Visual Feedback
- **Preview Required**: Sempre mostrar preview antes de salvar
- **Clear Labels**: Labels descritivos para cada campo de cor
- **Error Messages**: Mensagens claras sobre problemas de contraste

## Performance Considerations

### Optimization Strategies
- **Debounce Preview**: Debounce de 300ms ao selecionar cores
- **CSS Variable Update**: Atualizar apenas variáveis necessárias
- **Memoization**: Memoizar conversões de cor
- **Lazy Loading**: Carregar ThemePreview apenas quando necessário

### Caching
- **Local Storage**: Cachear cores aplicadas
- **Context Memoization**: Usar useMemo para valores do contexto
- **Conversion Cache**: Cachear conversões hex->HSL

## Migration Strategy

### Existing Data
- **Backward Compatibility**: Manter suporte para cores não configuradas
- **Default Values**: Usar azul padrão (#3B82F6) se cores não definidas
- **Gradual Rollout**: Aplicar cores apenas se configuradas

### User Communication
- **Admin Notification**: Notificar admins sobre nova funcionalidade
- **Documentation**: Documentar como usar as cores de tema
- **Examples**: Fornecer exemplos de combinações de cores
