# Design Document

## Overview

Esta refatoração aplica o Design System Guide documentado em `docs/DESIGN_SYSTEM_GUIDE.md` ao WUZAPI Manager. O objetivo é modernizar a interface visual mantendo todas as funcionalidades existentes, implementando:

- Sidebar com cor de destaque baseada no branding (configurado em admin/settings)
- Cards de estatísticas com gradientes semânticos
- Paleta de cores dark mode otimizada
- Scrollbar customizada
- Componentes reutilizáveis para consistência

**IMPORTANTE**: As cores de destaque e nome da aplicação DEVEM respeitar as configurações de branding definidas em `admin/settings`. O sistema já possui `BrandingContext` que fornece `primaryColor`, `appName`, e `logoUrl`. Os componentes devem consumir essas configurações ao invés de usar cores hardcoded.

## Architecture

A refatoração segue a arquitetura existente do projeto:

```
src/
├── components/
│   ├── ui/              # shadcn/ui primitivos (NÃO modificar)
│   ├── ui-custom/       # Componentes estendidos (ADICIONAR aqui)
│   │   ├── GradientCard.tsx      # Card com gradiente
│   │   ├── StatsCard.tsx         # Card de estatísticas
│   │   ├── ListItem.tsx          # Item de lista padronizado
│   │   └── EmptyState.tsx        # Estado vazio
│   ├── admin/
│   │   └── AdminLayout.tsx       # Layout admin (REFATORAR)
│   └── user/
│       └── UserLayout.tsx        # Layout user (REFATORAR)
├── index.css                     # CSS global (ATUALIZAR variáveis)
└── lib/
    └── utils.ts                  # Utilitários (já existe cn())
```

### Estratégia de Refatoração

1. **CSS Variables**: Atualizar `src/index.css` com novas variáveis de cor
2. **Componentes Reutilizáveis**: Criar em `src/components/ui-custom/`
3. **Layouts**: Refatorar `AdminLayout.tsx` e `UserLayout.tsx`
4. **Páginas**: Atualizar dashboards para usar novos componentes

## Components and Interfaces

### GradientCard Component

```typescript
// src/components/ui-custom/GradientCard.tsx
interface GradientCardProps {
  variant: 'green' | 'red' | 'blue' | 'purple' | 'orange';
  children: React.ReactNode;
  className?: string;
}

const GRADIENT_CLASSES = {
  green: {
    card: 'from-green-500/10 to-green-500/5',
    icon: 'bg-green-500/20 text-green-500',
  },
  red: {
    card: 'from-red-500/10 to-red-500/5',
    icon: 'bg-red-500/20 text-red-500',
  },
  blue: {
    card: 'from-blue-500/10 to-blue-500/5',
    icon: 'bg-blue-500/20 text-blue-500',
  },
  purple: {
    card: 'from-purple-500/10 to-purple-500/5',
    icon: 'bg-purple-500/20 text-purple-500',
  },
  orange: {
    card: 'from-orange-500/10 to-orange-500/5',
    icon: 'bg-orange-500/20 text-orange-500',
  },
};
```

### StatsCard Component

```typescript
// src/components/ui-custom/StatsCard.tsx
interface StatsCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant: 'green' | 'red' | 'blue' | 'purple' | 'orange';
  trend?: {
    value: number;
    isPositive: boolean;
  };
}
```

### ListItem Component

```typescript
// src/components/ui-custom/ListItem.tsx
interface ListItemProps {
  icon: React.ComponentType<{ className?: string }>;
  iconVariant: 'green' | 'red' | 'blue' | 'purple' | 'orange';
  title: string;
  subtitle?: string;
  badge?: string;
  value?: string;
  valueVariant?: 'positive' | 'negative' | 'neutral';
  onClick?: () => void;
}
```

### EmptyState Component

```typescript
// src/components/ui-custom/EmptyState.tsx
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### Sidebar Navigation Item

```typescript
// Padrão para itens de navegação na sidebar
interface NavItemProps {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
}

// Classes para estado ativo - usa cor primária do branding
// A cor primária vem do BrandingContext (configurado em admin/settings)
// Fallback para primary do tema se não configurado
const activeClasses = "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary";
const inactiveClasses = "text-muted-foreground hover:bg-muted hover:text-foreground";

// Alternativa com CSS variable customizada do branding:
// --brand-primary: cor configurada em admin/settings
// bg-[hsl(var(--brand-primary)/0.1)] text-[hsl(var(--brand-primary))]
```

### Branding Integration

```typescript
// Hook para acessar configurações de branding
import { useBrandingConfig } from '@/hooks/useBranding';

// Uso nos componentes
const brandingConfig = useBrandingConfig();
// brandingConfig.primaryColor - cor primária (hex)
// brandingConfig.appName - nome da aplicação
// brandingConfig.logoUrl - URL do logo

// Converter hex para classes Tailwind dinâmicas via CSS variables
// ou usar inline styles para cores dinâmicas do branding
```

## Data Models

Não há alterações em modelos de dados. Esta refatoração é puramente visual/frontend.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Acceptance Criteria Testing Prework

1.1 WHEN a user views the sidebar THEN the system SHALL display a logo area with gradient background using orange color
- Thoughts: This is a visual rendering requirement. We can test that the sidebar contains elements with the expected CSS classes.
- Testable: yes - property

1.2 WHEN a navigation item is active THEN the system SHALL highlight it with orange background
- Thoughts: This tests that active navigation items have specific CSS classes applied. We can generate random navigation states and verify the correct classes are present.
- Testable: yes - property

1.3 WHEN a user hovers over a navigation item THEN the system SHALL provide visual feedback
- Thoughts: This is a CSS hover state, which is difficult to test programmatically without browser automation.
- Testable: no

1.4 WHEN the sidebar renders THEN the system SHALL display navigation items with consistent spacing
- Thoughts: This is about CSS classes being applied consistently. We can verify the classes are present.
- Testable: yes - property

2.1 WHEN displaying a stats card THEN the system SHALL render it with a gradient background based on semantic color
- Thoughts: For any variant prop, the component should apply the correct gradient classes. This is testable across all variants.
- Testable: yes - property

2.2 WHEN a stats card renders THEN the system SHALL display an icon with matching color
- Thoughts: The icon container should have classes matching the variant. Testable for all variants.
- Testable: yes - property

2.3 WHEN a stats card renders THEN the system SHALL show the metric value in bold text
- Thoughts: This is about specific CSS classes being applied. Can be verified.
- Testable: yes - property

2.4 WHEN multiple stats cards are displayed THEN the system SHALL arrange them in a responsive grid
- Thoughts: This is about parent container classes, not the component itself. Layout testing.
- Testable: no

3.1 WHEN displaying a list item THEN the system SHALL render it with icon, content area, and optional value
- Thoughts: For any list item props, the rendered output should contain all expected elements.
- Testable: yes - property

3.2 WHEN a user hovers over a list item THEN the system SHALL apply a subtle background change
- Thoughts: CSS hover state, difficult to test without browser automation.
- Testable: no

3.3 WHEN a list item contains a badge THEN the system SHALL display it with secondary variant styling
- Thoughts: When badge prop is provided, the badge element should be rendered with correct classes.
- Testable: yes - property

3.4 WHEN a list item displays a monetary value THEN the system SHALL color it semantically
- Thoughts: For any valueVariant prop, the correct color class should be applied.
- Testable: yes - property

4.1-4.4 Dark mode CSS variables
- Thoughts: These are CSS variable definitions, not component behavior. Testing would require browser rendering.
- Testable: no

5.1-5.4 Scrollbar styling
- Thoughts: These are CSS pseudo-element styles, not testable via unit tests.
- Testable: no

6.1 WHEN a card has a header THEN the system SHALL display it with flex layout
- Thoughts: Card header structure can be verified by checking rendered elements.
- Testable: yes - property

6.2 WHEN a card header has an action button THEN the system SHALL style it as ghost variant
- Thoughts: When action prop is provided, button should have ghost variant classes.
- Testable: yes - property

6.3 WHEN a card header icon renders THEN the system SHALL display it with semantic color
- Thoughts: Icon color should match the provided variant.
- Testable: yes - property

6.4 WHEN a card header renders THEN the system SHALL use consistent padding
- Thoughts: CSS class verification.
- Testable: yes - property

7.1 WHEN no data is available THEN the system SHALL display an empty state
- Thoughts: Empty state component should render with expected structure.
- Testable: yes - property

7.2 WHEN data is loading THEN the system SHALL display skeleton placeholders
- Thoughts: Skeleton component should render with expected structure.
- Testable: yes - property

7.3 WHEN loading skeletons render THEN the system SHALL animate them with pulse effect
- Thoughts: CSS animation class verification.
- Testable: yes - property

7.4 WHEN empty state renders THEN the system SHALL use opacity-20 for the icon
- Thoughts: CSS class verification.
- Testable: yes - property

8.1 WHEN creating a gradient card THEN the system SHALL accept a color variant prop
- Thoughts: TypeScript type checking ensures this at compile time.
- Testable: no (compile-time)

8.2 WHEN a gradient card renders THEN the system SHALL apply the correct gradient classes
- Thoughts: For any variant, the correct gradient classes should be applied.
- Testable: yes - property

8.3 WHEN a gradient card renders THEN the system SHALL include proper TypeScript types
- Thoughts: TypeScript compilation ensures this.
- Testable: no (compile-time)

8.4 WHEN using gradient cards THEN the system SHALL export them from a central location
- Thoughts: Import/export structure, not runtime behavior.
- Testable: no

### Property Reflection

After reviewing the testable properties, I can consolidate:

- Properties 2.1, 2.2, 8.2 all test variant-to-class mapping → Combine into single property
- Properties 3.3, 3.4 both test conditional rendering based on props → Keep separate (different conditions)
- Properties 6.2, 6.3, 6.4 test card header structure → Combine into single comprehensive property
- Properties 7.1, 7.4 both test empty state rendering → Combine into single property
- Properties 7.2, 7.3 both test skeleton rendering → Combine into single property

### Correctness Properties

Property 1: Gradient variant class mapping
*For any* gradient card variant (green, red, blue, purple, orange), the rendered component SHALL apply the corresponding gradient CSS classes from the GRADIENT_CLASSES mapping.
**Validates: Requirements 2.1, 2.2, 8.2**

Property 2: Stats card structure
*For any* stats card with title, value, and icon props, the rendered output SHALL contain all three elements with the correct CSS classes for typography (text-2xl font-bold for value, text-muted-foreground for title).
**Validates: Requirements 2.3**

Property 3: Navigation item active state
*For any* navigation item where isActive is true, the rendered element SHALL have the primary color highlight classes (bg-primary/10 text-primary or equivalent using branding color).
**Validates: Requirements 1.2**

Property 4: Navigation item consistent styling
*For any* navigation item, the rendered element SHALL have consistent spacing classes (px-3 py-2 rounded-lg).
**Validates: Requirements 1.4**

Property 5: List item badge rendering
*For any* list item with a badge prop, the rendered output SHALL include a Badge component with secondary variant and text-xs sizing.
**Validates: Requirements 3.3**

Property 6: List item value coloring
*For any* list item with valueVariant prop, the value element SHALL have the corresponding color class (text-green-500 for positive, text-red-500 for negative).
**Validates: Requirements 3.4**

Property 7: List item structure
*For any* list item props, the rendered output SHALL contain icon container, content area with title, and optional value aligned with gap-3 spacing.
**Validates: Requirements 3.1**

Property 8: Card header structure
*For any* card header with icon, title, and optional action, the rendered output SHALL use flex layout with icon on left, title centered, and action button (if present) styled as ghost variant with orange text.
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

Property 9: Empty state rendering
*For any* empty state component, the rendered output SHALL display centered icon with opacity-20, and message with text-sm text-muted-foreground.
**Validates: Requirements 7.1, 7.4**

Property 10: Skeleton loading animation
*For any* skeleton component, the rendered output SHALL have the animate-pulse class for loading animation.
**Validates: Requirements 7.2, 7.3**

## Error Handling

- **Invalid variant prop**: TypeScript will catch at compile time. Runtime fallback to 'blue' variant.
- **Missing required props**: TypeScript enforcement. Components will not render without required props.
- **CSS variable fallbacks**: All CSS variables have fallback values defined.

## Testing Strategy

### Dual Testing Approach

This refactoring requires both unit tests and property-based tests:

**Unit Tests** (Vitest + React Testing Library):
- Verify component rendering with specific props
- Test edge cases (empty strings, undefined optional props)
- Snapshot tests for visual regression

**Property-Based Tests** (fast-check):
- Verify variant-to-class mapping holds for all variants
- Verify structure consistency across random prop combinations
- Verify conditional rendering logic

### Testing Framework

- **Library**: fast-check (already available via npm)
- **Runner**: Vitest
- **Rendering**: @testing-library/react
- **Minimum iterations**: 100 per property test

### Test File Structure

```
src/components/ui-custom/
├── GradientCard.tsx
├── GradientCard.test.tsx        # Unit + property tests
├── StatsCard.tsx
├── StatsCard.test.tsx
├── ListItem.tsx
├── ListItem.test.tsx
├── EmptyState.tsx
└── EmptyState.test.tsx
```

### Property Test Annotation Format

Each property-based test MUST include a comment in this format:
```typescript
// **Feature: design-system-refactor, Property 1: Gradient variant class mapping**
// **Validates: Requirements 2.1, 2.2, 8.2**
```
