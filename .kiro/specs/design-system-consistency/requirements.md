# Requirements Document

## Introduction

Este documento especifica os requisitos para aplicar o Design System Guide (`docs/DESIGN_SYSTEM_GUIDE.md`) de forma consistente em todo o painel de Superadmin do WUZAPI Manager. Atualmente, alguns componentes seguem parcialmente o design system, mas há inconsistências visuais que precisam ser corrigidas para manter uma experiência de usuário coesa.

## Glossary

- **Design_System**: Conjunto de padrões visuais, cores, tipografia e componentes definidos em `docs/DESIGN_SYSTEM_GUIDE.md`
- **Stats_Card**: Card com gradiente colorido para exibir métricas (accounts, MRR, agents, inboxes)
- **Gradient_Classes**: Classes CSS para gradientes de fundo em cards (`from-{color}-500/10 to-{color}-500/5`)
- **Icon_Container**: Container com fundo colorido para ícones (`p-3 rounded-xl bg-{color}-500/20`)
- **Orange_Accent**: Cor de destaque principal do sistema (`orange-500`, `#f97316`)
- **Superadmin_Panel**: Painel de administração para gerenciamento de tenants

## Requirements

### Requirement 1

**User Story:** As a superadmin, I want the tenant details page to follow the design system consistently, so that I have a cohesive visual experience.

#### Acceptance Criteria

1. WHEN viewing the tenant details page THEN the system SHALL display stats cards with gradient backgrounds following the design system pattern
2. WHEN viewing stats cards THEN the system SHALL use the correct gradient classes: `from-{color}-500/10 to-{color}-500/5` with `border-0`
3. WHEN viewing stats cards THEN the system SHALL display icons in containers with `p-3 rounded-xl bg-{color}-500/20`
4. WHEN viewing the header THEN the system SHALL display the tenant icon with orange gradient (`from-orange-500 to-orange-600`) and shadow
5. WHEN viewing action buttons THEN the system SHALL use orange accent color for primary actions (`bg-orange-500 hover:bg-orange-600`)

### Requirement 2

**User Story:** As a superadmin, I want the management panel tabs to follow the design system, so that navigation is visually consistent.

#### Acceptance Criteria

1. WHEN viewing the tabs THEN the system SHALL display active tabs with orange background (`data-[state=active]:bg-orange-500`)
2. WHEN viewing the tabs container THEN the system SHALL use `bg-muted/50 p-1 rounded-xl` styling
3. WHEN hovering over inactive tabs THEN the system SHALL provide subtle visual feedback with transition effects
4. WHEN viewing tab icons THEN the system SHALL display them with consistent sizing (`h-4 w-4`)

### Requirement 3

**User Story:** As a superadmin, I want all list items and tables to follow the design system patterns, so that data is presented consistently.

#### Acceptance Criteria

1. WHEN viewing list items THEN the system SHALL use the pattern: icon container + content + value aligned right
2. WHEN viewing empty states THEN the system SHALL display centered content with muted icon, title, and description
3. WHEN viewing loading states THEN the system SHALL display skeleton loaders with `animate-pulse` and `bg-muted` classes
4. WHEN viewing table rows THEN the system SHALL provide hover feedback with `hover:bg-muted/50 transition-colors`

### Requirement 4

**User Story:** As a superadmin, I want forms and inputs to follow the design system, so that data entry is consistent.

#### Acceptance Criteria

1. WHEN viewing form cards THEN the system SHALL use proper spacing with `space-y-4` or `space-y-6`
2. WHEN viewing form buttons THEN the system SHALL use orange accent for primary actions and outline variant for secondary
3. WHEN viewing color inputs THEN the system SHALL display color preview boxes with `rounded border` styling
4. WHEN viewing form labels THEN the system SHALL use `text-sm font-medium` styling

### Requirement 5

**User Story:** As a superadmin, I want alert and status indicators to follow the design system, so that I can quickly identify important information.

#### Acceptance Criteria

1. WHEN viewing status badges THEN the system SHALL use semantic colors: green for active, yellow for inactive, red for suspended
2. WHEN viewing alert cards THEN the system SHALL use colored borders and backgrounds (`border-{color}-500/30 bg-{color}-500/5`)
3. WHEN viewing warning banners THEN the system SHALL display with appropriate icon and destructive variant styling
4. WHEN viewing success/error toasts THEN the system SHALL use consistent toast styling from the design system

### Requirement 6

**User Story:** As a superadmin, I want the overall layout to follow the design system spacing and structure, so that the interface feels polished.

#### Acceptance Criteria

1. WHEN viewing page content THEN the system SHALL use consistent spacing with `space-y-6` between major sections
2. WHEN viewing card headers THEN the system SHALL display icons with colored backgrounds and proper alignment
3. WHEN viewing grid layouts THEN the system SHALL use responsive breakpoints: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
4. WHEN viewing the page THEN the system SHALL maintain proper padding and margins as defined in the design system
