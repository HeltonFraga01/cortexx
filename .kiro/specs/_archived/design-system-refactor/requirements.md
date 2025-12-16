# Requirements Document

## Introduction

Este documento especifica os requisitos para refatorar o design system do WUZAPI Manager, aplicando o guia de design documentado em `docs/DESIGN_SYSTEM_GUIDE.md`. A refatoração modernizará o layout visual mantendo todas as funcionalidades existentes, implementando cards com gradientes, sidebar aprimorada com cor de destaque laranja, scrollbar customizada e melhor hierarquia visual.

## Glossary

- **Design System**: Conjunto de padrões visuais, componentes e diretrizes que garantem consistência na interface
- **Sidebar**: Barra lateral de navegação fixa presente nos layouts Admin e User
- **Stats Card**: Card de estatísticas com ícone, título e valor numérico
- **Gradient Card**: Card com fundo em gradiente sutil para destaque visual
- **Theme Toggle**: Botão para alternar entre modo claro e escuro
- **CSS Variables**: Variáveis CSS customizadas para cores e espaçamentos do tema
- **shadcn/ui**: Biblioteca de componentes React baseada em Radix UI

## Requirements

### Requirement 1

**User Story:** As a user, I want the sidebar navigation to have a modern design with the branding accent color, so that the interface feels more polished and matches the configured brand identity.

#### Acceptance Criteria

1. WHEN a user views the sidebar THEN the system SHALL display a logo area using the logo and app name from branding configuration (admin/settings)
2. WHEN a navigation item is active THEN the system SHALL highlight it with the primary color from branding (bg-primary/10 text-primary in light mode, bg-primary/20 text-primary in dark mode)
3. WHEN a user hovers over a navigation item THEN the system SHALL provide visual feedback with muted background transition
4. WHEN the sidebar renders THEN the system SHALL display navigation items with consistent spacing (px-3 py-2) and rounded corners (rounded-lg)

### Requirement 2

**User Story:** As a user, I want stats cards with gradient backgrounds, so that important metrics are visually distinguished and easier to scan.

#### Acceptance Criteria

1. WHEN displaying a stats card THEN the system SHALL render it with a gradient background based on semantic color (green for success, red for error, blue for info, orange for highlight)
2. WHEN a stats card renders THEN the system SHALL display an icon with matching color in a rounded container (rounded-xl) with semi-transparent background
3. WHEN a stats card renders THEN the system SHALL show the metric value in bold text (text-2xl font-bold) and label in muted color (text-muted-foreground)
4. WHEN multiple stats cards are displayed THEN the system SHALL arrange them in a responsive grid (grid-cols-1 sm:grid-cols-2 lg:grid-cols-4)

### Requirement 3

**User Story:** As a user, I want list items with consistent styling, so that data is easy to read and interact with.

#### Acceptance Criteria

1. WHEN displaying a list item THEN the system SHALL render it with icon, content area, and optional value aligned horizontally with gap-3 spacing
2. WHEN a user hovers over a list item THEN the system SHALL apply a subtle background change (hover:bg-muted/50) with smooth transition
3. WHEN a list item contains a badge THEN the system SHALL display it with secondary variant styling and appropriate sizing (text-xs px-1.5 py-0)
4. WHEN a list item displays a monetary value THEN the system SHALL color it semantically (green for positive, red for negative)

### Requirement 4

**User Story:** As a user, I want the dark mode to have proper contrast and colors, so that the interface is comfortable to use in low-light conditions.

#### Acceptance Criteria

1. WHEN dark mode is active THEN the system SHALL apply the dark color palette with deep blue background (224 71% 4%)
2. WHEN dark mode is active THEN the system SHALL use orange as the ring/accent color for focus states
3. WHEN switching themes THEN the system SHALL apply smooth transitions (transition: background-color 0.3s ease, color 0.3s ease)
4. WHEN dark mode is active THEN the system SHALL maintain readable contrast ratios for all text elements

### Requirement 5

**User Story:** As a user, I want a customized scrollbar that matches the design system, so that the interface feels cohesive and polished.

#### Acceptance Criteria

1. WHEN scrolling content THEN the system SHALL display a styled scrollbar with 12px width
2. WHEN in light mode THEN the system SHALL render scrollbar track with light gradient and thumb with orange gradient
3. WHEN in dark mode THEN the system SHALL render scrollbar track with dark gradient maintaining the orange thumb
4. WHEN hovering the scrollbar THEN the system SHALL provide visual feedback with shadow effect

### Requirement 6

**User Story:** As a user, I want card headers with icons and action buttons, so that I can quickly identify card purpose and access related actions.

#### Acceptance Criteria

1. WHEN a card has a header THEN the system SHALL display it with flex layout, icon on the left, title in the middle, and optional action button on the right
2. WHEN a card header has an action button THEN the system SHALL style it as ghost variant with orange text color
3. WHEN a card header icon renders THEN the system SHALL display it with semantic color matching the card purpose
4. WHEN a card header renders THEN the system SHALL use consistent padding (pb-2) and text sizing (text-lg for title)

### Requirement 7

**User Story:** As a user, I want empty states and loading skeletons, so that I understand the system state when data is loading or unavailable.

#### Acceptance Criteria

1. WHEN no data is available THEN the system SHALL display an empty state with centered icon, muted text, and appropriate message
2. WHEN data is loading THEN the system SHALL display skeleton placeholders matching the expected content layout
3. WHEN loading skeletons render THEN the system SHALL animate them with pulse effect
4. WHEN empty state renders THEN the system SHALL use opacity-20 for the icon and text-sm for the message

### Requirement 8

**User Story:** As a developer, I want reusable gradient card components, so that I can maintain consistency across the application without duplicating code.

#### Acceptance Criteria

1. WHEN creating a gradient card THEN the system SHALL accept a color variant prop (green, red, blue, purple, orange)
2. WHEN a gradient card renders THEN the system SHALL apply the correct gradient classes based on the variant
3. WHEN a gradient card renders THEN the system SHALL include proper TypeScript types for all props
4. WHEN using gradient cards THEN the system SHALL export them from a central location for easy imports
