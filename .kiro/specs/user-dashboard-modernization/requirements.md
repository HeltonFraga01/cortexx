# Requirements Document

## Introduction

Modernização do Dashboard do Usuário para suportar múltiplas caixas de entrada (inboxes), exibir métricas avançadas com gráficos interativos, e fornecer uma visão completa das operações do usuário. O novo dashboard deve seguir os padrões de design do projeto, mantendo uma UX moderna e intuitiva.

## Glossary

- **Dashboard**: Painel principal do usuário com visão geral de métricas e status
- **Inbox**: Caixa de entrada WhatsApp conectada à conta do usuário
- **Conversation**: Conversa individual com um contato
- **Agent**: Atendente que pode ser atribuído a conversas
- **Campaign**: Campanha de envio de mensagens em massa
- **Quota**: Limite de uso de recursos baseado no plano de assinatura
- **Metric_Card**: Componente visual que exibe uma métrica com ícone e valor
- **Chart_Component**: Componente de gráfico para visualização de dados temporais
- **Inbox_Selector**: Componente para selecionar e filtrar por caixa de entrada

## Requirements

### Requirement 1: Multi-Inbox Overview

**User Story:** As a user, I want to see an overview of all my inboxes, so that I can monitor the status of each WhatsApp connection.

#### Acceptance Criteria

1. WHEN the dashboard loads, THE Dashboard SHALL display a list of all inboxes associated with the user's account
2. WHEN an inbox is connected, THE Dashboard SHALL show a green status indicator with "Conectado" label
3. WHEN an inbox is disconnected, THE Dashboard SHALL show a red status indicator with "Desconectado" label
4. WHEN the user clicks on an inbox card, THE Dashboard SHALL navigate to the chat page filtered by that inbox
5. FOR EACH inbox, THE Dashboard SHALL display the inbox name, phone number, and unread message count

### Requirement 2: Conversation Metrics

**User Story:** As a user, I want to see conversation statistics, so that I can understand my messaging activity.

#### Acceptance Criteria

1. THE Dashboard SHALL display the total number of open conversations across all inboxes
2. THE Dashboard SHALL display the total number of resolved conversations in the current period
3. THE Dashboard SHALL display the average response time for conversations
4. WHEN the user selects a specific inbox, THE Dashboard SHALL filter all conversation metrics to that inbox
5. THE Dashboard SHALL display a trend indicator (up/down arrow) comparing current period to previous period

### Requirement 3: Message Activity Chart

**User Story:** As a user, I want to see a chart of message activity over time, so that I can identify patterns and peak hours.

#### Acceptance Criteria

1. THE Dashboard SHALL display a line chart showing messages sent and received over the last 7 days
2. THE Chart_Component SHALL support toggling between daily and hourly views
3. WHEN hovering over a data point, THE Chart_Component SHALL display a tooltip with exact values
4. THE Chart_Component SHALL use distinct colors for incoming vs outgoing messages
5. WHEN the user selects a specific inbox, THE Chart_Component SHALL filter data to that inbox

### Requirement 4: Agent Performance Summary

**User Story:** As a user, I want to see agent performance metrics, so that I can monitor team productivity.

#### Acceptance Criteria

1. THE Dashboard SHALL display a summary of active agents and their current availability status
2. FOR EACH agent, THE Dashboard SHALL show the number of assigned conversations
3. THE Dashboard SHALL display the top 3 agents by resolved conversations in the current period
4. WHEN no agents exist, THE Dashboard SHALL display an empty state with a link to create agents
5. WHEN the user clicks on an agent, THE Dashboard SHALL navigate to the agent management page

### Requirement 5: Campaign Status Overview

**User Story:** As a user, I want to see the status of my campaigns, so that I can track message delivery progress.

#### Acceptance Criteria

1. THE Dashboard SHALL display a summary of active campaigns with progress indicators
2. FOR EACH active campaign, THE Dashboard SHALL show sent count, failed count, and total contacts
3. THE Dashboard SHALL display the most recent completed campaign with its final statistics
4. WHEN no campaigns exist, THE Dashboard SHALL display an empty state with a link to create campaigns
5. WHEN the user clicks on a campaign, THE Dashboard SHALL navigate to the campaign details page

### Requirement 6: Quota and Subscription Status

**User Story:** As a user, I want to see my quota usage and subscription status, so that I can manage my resources.

#### Acceptance Criteria

1. THE Dashboard SHALL display current quota usage for messages, inboxes, agents, and campaigns
2. FOR EACH quota, THE Dashboard SHALL show a progress bar indicating usage percentage
3. WHEN quota usage exceeds 80%, THE Dashboard SHALL highlight the quota in warning color (orange)
4. WHEN quota usage exceeds 95%, THE Dashboard SHALL highlight the quota in danger color (red)
5. THE Dashboard SHALL display the current subscription plan name and renewal date
6. THE Dashboard SHALL display credit balance if the account has credits

### Requirement 7: Contact Growth Chart

**User Story:** As a user, I want to see contact growth over time, so that I can track my audience expansion.

#### Acceptance Criteria

1. THE Dashboard SHALL display a bar chart showing new contacts added per day over the last 30 days
2. THE Dashboard SHALL display the total contact count prominently
3. THE Chart_Component SHALL show cumulative growth trend line
4. WHEN hovering over a bar, THE Chart_Component SHALL display the exact count for that day
5. THE Dashboard SHALL display the percentage growth compared to the previous 30-day period

### Requirement 8: Quick Actions Panel

**User Story:** As a user, I want quick access to common actions, so that I can navigate efficiently.

#### Acceptance Criteria

1. THE Dashboard SHALL display a quick actions panel with buttons for common tasks
2. THE Quick_Actions panel SHALL include: New Message, New Campaign, View Contacts, Settings
3. WHEN the user has management permissions, THE Quick_Actions panel SHALL include: Manage Agents, Manage Teams
4. WHEN the user clicks a quick action, THE Dashboard SHALL navigate to the corresponding page
5. THE Quick_Actions panel SHALL be responsive and adapt to mobile screens

### Requirement 9: Real-time Updates

**User Story:** As a user, I want the dashboard to update in real-time, so that I see current information without refreshing.

#### Acceptance Criteria

1. THE Dashboard SHALL refresh inbox connection status every 30 seconds
2. THE Dashboard SHALL update unread message counts when new messages arrive
3. THE Dashboard SHALL update campaign progress in real-time during active campaigns
4. WHEN a WebSocket connection is available, THE Dashboard SHALL use it for real-time updates
5. THE Dashboard SHALL display a "Last updated" timestamp showing when data was last refreshed

### Requirement 10: Responsive Layout

**User Story:** As a user, I want the dashboard to work well on all devices, so that I can monitor my account from anywhere.

#### Acceptance Criteria

1. THE Dashboard SHALL use a responsive grid layout that adapts to screen size
2. ON mobile devices, THE Dashboard SHALL stack cards vertically in a single column
3. ON tablet devices, THE Dashboard SHALL display cards in a 2-column grid
4. ON desktop devices, THE Dashboard SHALL display cards in a 3-column grid with sidebar
5. THE Dashboard SHALL maintain readability and usability at all screen sizes
