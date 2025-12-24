# Requirements Document

## Introduction

Redesign do dashboard do usuário (`/user/dashboard`) para uma interface mais moderna, responsiva e visualmente atraente. O dashboard atual apresenta problemas de layout com elementos desalinhados, disposição ruim e falta de consistência visual. Esta modernização utilizará como referência os componentes do painel de usuário no Admin (SupabaseUserCard, SupabaseUserStatsCard) que possuem um design mais limpo e moderno.

## Glossary

- **Dashboard**: Painel principal do usuário que exibe métricas, status de conexão e ações rápidas
- **User_Dashboard_System**: Sistema responsável por renderizar e gerenciar o dashboard do usuário
- **Inbox_Card**: Componente que exibe o status de uma caixa de entrada WhatsApp
- **Stats_Card**: Componente que exibe métricas com ícones coloridos e valores
- **Quick_Actions**: Painel de botões para ações frequentes do usuário
- **Responsive_Grid**: Sistema de grid que se adapta a diferentes tamanhos de tela

## Requirements

### Requirement 1: Layout Responsivo e Moderno

**User Story:** As a user, I want a clean and modern dashboard layout, so that I can easily view my metrics and navigate the system.

#### Acceptance Criteria

1. THE User_Dashboard_System SHALL use a consistent spacing system with 4px base unit (gap-4, gap-6)
2. THE User_Dashboard_System SHALL implement a responsive grid that adapts from 1 column on mobile to 3 columns on desktop
3. THE User_Dashboard_System SHALL use rounded corners (rounded-lg, rounded-xl) consistently across all cards
4. THE User_Dashboard_System SHALL apply subtle shadows (shadow-sm, hover:shadow-md) for depth hierarchy
5. WHEN the viewport width changes, THE User_Dashboard_System SHALL smoothly transition between layouts without content jumping

### Requirement 2: Header Section Redesign

**User Story:** As a user, I want a welcoming header with my profile info, so that I feel recognized and can quickly see my account status.

#### Acceptance Criteria

1. THE User_Dashboard_System SHALL display a header section with user avatar, name, and welcome message
2. THE User_Dashboard_System SHALL show the current date and time in the header
3. THE User_Dashboard_System SHALL include a refresh button with loading state indicator
4. WHEN the user clicks refresh, THE User_Dashboard_System SHALL update all dashboard data and show a loading spinner

### Requirement 3: Inbox Overview Redesign

**User Story:** As a user, I want to see my WhatsApp inboxes in a visually appealing horizontal scroll, so that I can quickly check connection status.

#### Acceptance Criteria

1. THE Inbox_Card SHALL display connection status with a colored indicator (green for connected, red for disconnected)
2. THE Inbox_Card SHALL show inbox name, phone number, and unread count in a compact layout
3. THE Inbox_Card SHALL have a hover effect with subtle shadow increase
4. WHEN an inbox is selected, THE Inbox_Card SHALL display a primary color ring border
5. THE User_Dashboard_System SHALL display inboxes in a horizontal scrollable container with smooth scrolling

### Requirement 4: Statistics Cards Modernization

**User Story:** As a user, I want to see my key metrics in visually distinct cards with icons, so that I can quickly understand my performance.

#### Acceptance Criteria

1. THE Stats_Card SHALL display a colored icon background matching the metric type (blue for messages, green for resolved, orange for pending)
2. THE Stats_Card SHALL show the metric value in large bold text (text-2xl font-bold)
3. THE Stats_Card SHALL display trend indicators (up/down arrows) when comparison data is available
4. THE Stats_Card SHALL use consistent padding (p-4) and spacing across all instances
5. WHEN loading, THE Stats_Card SHALL display skeleton placeholders matching the final layout

### Requirement 5: Charts and Graphs Styling

**User Story:** As a user, I want charts that are easy to read and visually consistent with the dashboard theme, so that I can analyze my data effectively.

#### Acceptance Criteria

1. THE Message_Activity_Chart SHALL use the primary color palette for data visualization
2. THE Contact_Growth_Chart SHALL display a gradient fill under the line for visual appeal
3. THE User_Dashboard_System SHALL ensure charts have proper padding and don't overflow their containers
4. WHEN hovering over chart data points, THE User_Dashboard_System SHALL display tooltips with detailed information

### Requirement 6: Quick Actions Panel Redesign

**User Story:** As a user, I want quick action buttons that are easy to find and use, so that I can perform common tasks efficiently.

#### Acceptance Criteria

1. THE Quick_Actions panel SHALL display action buttons in a responsive grid (2 columns on mobile, 4 on desktop)
2. THE Quick_Actions buttons SHALL have consistent height and icon placement
3. THE Quick_Actions buttons SHALL use outline variant with hover:bg-primary/5 effect
4. WHEN the user has management permissions, THE Quick_Actions panel SHALL show additional management buttons

### Requirement 7: Connection Tab Modernization

**User Story:** As a user, I want the connection tab to have a clean layout with clear sections, so that I can manage my WhatsApp connection easily.

#### Acceptance Criteria

1. THE User_Dashboard_System SHALL organize the connection tab into distinct sections: User Info, Connection Control, Webhook Config
2. THE User_Info_Card SHALL display avatar, name, phone, and token in a clean two-column layout
3. THE Connection_Control_Card SHALL use colored buttons (green for connect, red for disconnect)
4. THE Webhook_Config_Card SHALL display current webhook URL and event count clearly
5. WHEN QR code is needed, THE User_Dashboard_System SHALL display it in a centered, prominent card

### Requirement 8: Visual Consistency

**User Story:** As a user, I want all dashboard elements to look consistent, so that the interface feels professional and polished.

#### Acceptance Criteria

1. THE User_Dashboard_System SHALL use the same card component style (Card, CardHeader, CardContent) throughout
2. THE User_Dashboard_System SHALL apply consistent text sizes: titles (text-lg font-semibold), labels (text-sm), values (text-2xl font-bold)
3. THE User_Dashboard_System SHALL use muted-foreground color for secondary text consistently
4. THE User_Dashboard_System SHALL ensure all icons have consistent sizing (h-4 w-4 for inline, h-5 w-5 for card headers)
5. THE User_Dashboard_System SHALL use the Badge component consistently for status indicators

### Requirement 9: Loading and Empty States

**User Story:** As a user, I want clear feedback when data is loading or unavailable, so that I understand the system state.

#### Acceptance Criteria

1. WHEN data is loading, THE User_Dashboard_System SHALL display skeleton components matching the final layout
2. WHEN no data is available, THE User_Dashboard_System SHALL display an empty state with helpful message and action
3. WHEN an error occurs, THE User_Dashboard_System SHALL display an error message with retry button
4. THE User_Dashboard_System SHALL maintain layout stability during loading (no content jumping)

### Requirement 10: Dark Mode Support

**User Story:** As a user, I want the dashboard to look good in both light and dark modes, so that I can use my preferred theme.

#### Acceptance Criteria

1. THE User_Dashboard_System SHALL use Tailwind dark: variants for all color classes
2. THE Stats_Card colored backgrounds SHALL have dark mode variants (e.g., bg-blue-100 dark:bg-blue-900/30)
3. THE User_Dashboard_System SHALL ensure sufficient contrast in both modes
4. WHEN the theme changes, THE User_Dashboard_System SHALL update colors without page reload
