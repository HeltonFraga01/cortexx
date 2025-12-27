# Requirements Document

## Introduction

Evolução do sistema de contatos para um CRM completo e moderno. O objetivo é transformar a gestão de contatos simples (importados do WhatsApp) em uma plataforma de relacionamento com cliente que inclui histórico de interações, qualificação de leads (scoring), histórico de compras, sistema de créditos/bônus, preferências de comunicação e segmentação avançada.

## Pesquisa de Bibliotecas e Frameworks

### Opções Analisadas

| Biblioteca | Stars | Descrição | Prós | Contras |
|------------|-------|-----------|------|---------|
| **Twenty CRM** | 37.7k | CRM open-source alternativa ao Salesforce | CRM completo, React/TypeScript, GraphQL, PostgreSQL | Sistema completo (não embarcável), arquitetura complexa |
| **Refine** | 29k+ | Meta-framework React para apps CRUD/B2B | Headless, suporta Supabase, shadcn/ui compatível, hooks reutilizáveis | Framework completo, curva de aprendizado |
| **React-Admin** | 25k+ | Framework frontend para admin panels | Maduro, bem documentado, Material UI | Opinionated, difícil customizar visual |
| **Chatwoot** | 22k+ | Plataforma de suporte omnichannel | Já integrado no projeto, contatos e conversas | Foco em suporte, não CRM completo |
| **erxes** | 3.5k | XOS com CRM, marketing, vendas | Muito completo, modular | Complexo, MongoDB, difícil integrar |

### Recomendação

**Abordagem Híbrida:**

1. **Usar componentes do Refine** para funcionalidades de CRUD avançado (DataGrid, filtros, paginação)
2. **Inspirar-se no Twenty CRM** para UX/UI de timeline e detalhes de contato
3. **Aproveitar estrutura existente** do Chatwoot (já integrado) para conversas
4. **Construir sobre Supabase** (já em uso) para persistência

**Bibliotecas Específicas Recomendadas:**

- `@refinedev/core` - Hooks para CRUD e data fetching
- `@refinedev/supabase` - Data provider para Supabase
- `react-timeline-component` ou custom - Para timeline de atividades
- `recharts` (já no projeto) - Para analytics/gráficos
- `@tanstack/react-table` - Para tabelas avançadas (já em uso via shadcn)

**Justificativa:** Construir sobre a stack existente (React + TypeScript + Supabase + shadcn/ui) é mais eficiente do que integrar um CRM completo. O Refine oferece hooks úteis que podem ser adotados incrementalmente sem reescrever o sistema.

## Glossary

- **CRM_System**: Sistema de Customer Relationship Management que gerencia contatos e suas interações
- **Contact**: Entidade que representa um cliente ou lead no sistema
- **Lead_Score**: Pontuação numérica que indica o nível de engajamento e potencial de conversão de um contato
- **Credit_Balance**: Saldo de créditos/bônus disponível para um contato usar em serviços
- **Purchase_History**: Registro histórico de todas as compras realizadas por um contato
- **Interaction_Log**: Registro de todas as interações (mensagens, chamadas, etc.) com um contato
- **Communication_Preference**: Configuração de opt-in/opt-out para receber mensagens de disparo em massa
- **Contact_Timeline**: Visualização cronológica de todas as atividades relacionadas a um contato
- **Custom_Field**: Campo personalizado definido pelo usuário para armazenar informações específicas do negócio
- **Segment**: Grupo dinâmico de contatos baseado em critérios de filtro

## Requirements

### Requirement 1: Histórico de Interações

**User Story:** As a user, I want to see the complete interaction history with a contact, so that I can understand the relationship context and provide better service.

#### Acceptance Criteria

1. WHEN a user views a contact detail page, THE CRM_System SHALL display the last message timestamp and direction (sent/received)
2. WHEN a message is sent or received from a contact, THE CRM_System SHALL automatically update the interaction log with timestamp, direction, and content preview
3. WHEN viewing the contact timeline, THE CRM_System SHALL display all interactions in chronological order with filtering options
4. THE CRM_System SHALL track and display the total number of messages exchanged with each contact
5. WHEN a contact has no interactions in the last 30 days, THE CRM_System SHALL flag them as "inactive" for re-engagement campaigns

### Requirement 2: Lead Scoring e Qualificação

**User Story:** As a user, I want to automatically score and qualify contacts based on their interactions, so that I can prioritize high-value leads.

#### Acceptance Criteria

1. THE CRM_System SHALL calculate a Lead_Score (0-100) for each contact based on configurable criteria
2. WHEN a contact sends a message, THE CRM_System SHALL increase their Lead_Score by a configurable amount
3. WHEN a contact makes a purchase, THE CRM_System SHALL increase their Lead_Score by a configurable amount
4. WHEN a contact has no interaction for 30 days, THE CRM_System SHALL decrease their Lead_Score by a configurable decay rate
5. THE CRM_System SHALL categorize contacts into tiers (Cold, Warm, Hot, VIP) based on Lead_Score thresholds
6. WHEN viewing contacts list, THE CRM_System SHALL allow sorting and filtering by Lead_Score and tier

### Requirement 3: Histórico de Compras

**User Story:** As a user, I want to track purchase history for each contact, so that I can understand their buying behavior and offer relevant products.

#### Acceptance Criteria

1. THE CRM_System SHALL store purchase records with date, amount, product/service description, and status
2. WHEN a purchase is recorded, THE CRM_System SHALL update the contact's total lifetime value (LTV)
3. WHEN viewing a contact, THE CRM_System SHALL display the last purchase date and total purchase count
4. THE CRM_System SHALL calculate and display average order value (AOV) for each contact
5. WHEN a contact has made purchases, THE CRM_System SHALL display a purchase history timeline
6. THE CRM_System SHALL allow manual entry of purchases and integration with external payment systems

### Requirement 4: Sistema de Créditos/Bônus

**User Story:** As a user, I want to manage credit balances for contacts, so that I can offer loyalty rewards and track usage.

#### Acceptance Criteria

1. THE CRM_System SHALL maintain a Credit_Balance for each contact
2. WHEN credits are added to a contact, THE CRM_System SHALL record the transaction with amount, source, and timestamp
3. WHEN credits are consumed, THE CRM_System SHALL deduct from the balance and record the transaction
4. WHEN a contact sends a message (if credit-based messaging is enabled), THE CRM_System SHALL deduct credits according to configured rates
5. THE CRM_System SHALL display current credit balance prominently on the contact detail page
6. WHEN credit balance reaches zero, THE CRM_System SHALL notify the user and optionally restrict messaging
7. THE CRM_System SHALL provide a credit transaction history for each contact

### Requirement 5: Preferências de Comunicação

**User Story:** As a user, I want to manage communication preferences for each contact, so that I can respect their opt-in/opt-out choices for bulk messaging.

#### Acceptance Criteria

1. THE CRM_System SHALL store opt-in/opt-out status for bulk messaging campaigns per contact
2. WHEN creating a bulk campaign, THE CRM_System SHALL automatically exclude contacts who have opted out
3. THE CRM_System SHALL provide a way for contacts to opt-out via keyword response (e.g., "SAIR")
4. WHEN a contact opts out, THE CRM_System SHALL record the timestamp and method of opt-out
5. THE CRM_System SHALL allow users to manually update communication preferences
6. WHEN viewing contacts, THE CRM_System SHALL clearly indicate opt-out status with visual indicators

### Requirement 6: Campos Personalizados

**User Story:** As a user, I want to create custom fields for contacts, so that I can store business-specific information.

#### Acceptance Criteria

1. THE CRM_System SHALL allow creation of custom fields with types: text, number, date, dropdown, checkbox, and URL
2. WHEN a custom field is created, THE CRM_System SHALL make it available for all contacts in the account
3. THE CRM_System SHALL allow custom fields to be marked as required or optional
4. WHEN viewing or editing a contact, THE CRM_System SHALL display custom fields in a configurable order
5. THE CRM_System SHALL allow filtering and searching contacts by custom field values
6. THE CRM_System SHALL support importing custom field values via CSV

### Requirement 7: Segmentação Dinâmica

**User Story:** As a user, I want to create dynamic segments based on contact attributes, so that I can target specific groups for campaigns.

#### Acceptance Criteria

1. THE CRM_System SHALL allow creation of segments with multiple filter conditions (AND/OR logic)
2. WHEN a segment is created, THE CRM_System SHALL automatically include/exclude contacts as their attributes change
3. THE CRM_System SHALL support segment conditions based on: tags, Lead_Score, purchase history, last interaction date, custom fields, and communication preferences
4. WHEN viewing a segment, THE CRM_System SHALL display the current contact count and list
5. THE CRM_System SHALL allow segments to be used as targets for bulk campaigns
6. THE CRM_System SHALL provide pre-built segment templates (e.g., "Inactive contacts", "High-value customers", "New leads")

### Requirement 8: Interface de Detalhes do Contato

**User Story:** As a user, I want a comprehensive contact detail view, so that I can see all relevant information in one place.

#### Acceptance Criteria

1. THE CRM_System SHALL display a contact detail page with sections for: basic info, timeline, purchases, credits, custom fields, and communication preferences
2. WHEN viewing a contact, THE CRM_System SHALL show key metrics: Lead_Score, LTV, credit balance, last interaction, and opt-in status
3. THE CRM_System SHALL provide quick actions: send message, add note, add purchase, add credits, edit preferences
4. WHEN a contact has associated conversations, THE CRM_System SHALL provide a link to view the full conversation history
5. THE CRM_System SHALL display a visual timeline combining all activities (messages, purchases, credit transactions, notes)
6. THE CRM_System SHALL allow inline editing of contact fields without navigating away

### Requirement 9: Integração com Pagamentos

**User Story:** As a user, I want to integrate purchase data from payment systems, so that I can automatically track customer transactions.

#### Acceptance Criteria

1. THE CRM_System SHALL support webhook integration to receive purchase notifications from external systems
2. WHEN a purchase webhook is received, THE CRM_System SHALL match the contact by phone number or email and record the purchase
3. IF a purchase cannot be matched to an existing contact, THE CRM_System SHALL create a new contact with the purchase data
4. THE CRM_System SHALL support manual CSV import of purchase history
5. WHEN Stripe integration is enabled, THE CRM_System SHALL automatically sync customer purchases

### Requirement 10: Relatórios e Analytics

**User Story:** As a user, I want to see analytics about my contacts, so that I can understand my customer base and make data-driven decisions.

#### Acceptance Criteria

1. THE CRM_System SHALL display a dashboard with key metrics: total contacts, active contacts, average Lead_Score, total LTV
2. THE CRM_System SHALL show contact growth over time (new contacts per day/week/month)
3. THE CRM_System SHALL display Lead_Score distribution across tiers
4. THE CRM_System SHALL show top contacts by LTV and engagement
5. WHEN viewing analytics, THE CRM_System SHALL allow filtering by date range and segments
