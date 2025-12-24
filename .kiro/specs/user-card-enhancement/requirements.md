# Requirements Document

## Introduction

Este documento especifica os requisitos para melhorar o componente de listagem de usuários na área administrativa. A melhoria inclui renomear "Usuários do Supabase" para simplesmente "Usuários" e enriquecer os cards com informações mais relevantes e úteis para o administrador.

## Glossary

- **User_Card**: Componente visual que exibe informações resumidas de um usuário na listagem
- **User_List**: Componente que lista todos os usuários do sistema em `/admin/multi-user`
- **Subscription**: Assinatura do usuário contendo plano, status e período
- **Quota_Usage**: Uso atual das quotas do usuário (mensagens, bots, etc.)
- **Last_Activity**: Última atividade do usuário no sistema (último login)

## Requirements

### Requirement 1: Renomear Título da Seção

**User Story:** As an admin, I want the user section to be called simply "Usuários", so that the interface is cleaner and more intuitive.

#### Acceptance Criteria

1. THE User_List SHALL display the title "Usuários" instead of "Usuários do Supabase"
2. WHEN creating a new user, THE Dialog SHALL display "Criar Novo Usuário" instead of "Criar Novo Usuário Supabase"

### Requirement 2: Exibir Informações de Último Acesso

**User Story:** As an admin, I want to see when each user last logged in, so that I can identify inactive users.

#### Acceptance Criteria

1. WHEN a user has logged in before, THE User_Card SHALL display the last login date in a human-readable format
2. WHEN a user has never logged in, THE User_Card SHALL display "Nunca acessou"
3. THE User_Card SHALL display the last login information in a prominent but non-intrusive position

### Requirement 3: Exibir Status de Assinatura de Forma Destacada

**User Story:** As an admin, I want to quickly see the subscription status of each user, so that I can identify users with payment issues or expired plans.

#### Acceptance Criteria

1. THE User_Card SHALL display the subscription status with color-coded badges
2. WHEN status is "active", THE Badge SHALL use green color scheme
3. WHEN status is "trial", THE Badge SHALL use blue color scheme
4. WHEN status is "past_due" or "expired" or "suspended", THE Badge SHALL use red color scheme
5. WHEN status is "canceled", THE Badge SHALL use gray color scheme

### Requirement 4: Exibir Resumo de Uso de Quotas

**User Story:** As an admin, I want to see a quick summary of quota usage, so that I can identify users approaching their limits.

#### Acceptance Criteria

1. THE User_Card SHALL display a visual indicator of quota usage when available
2. WHEN a user is using more than 80% of any quota, THE User_Card SHALL display a warning indicator
3. THE User_Card SHALL prioritize showing the most critical quota (highest usage percentage)

### Requirement 5: Melhorar Layout Visual do Card

**User Story:** As an admin, I want the user cards to be visually organized and easy to scan, so that I can quickly find the information I need.

#### Acceptance Criteria

1. THE User_Card SHALL organize information in clear visual sections
2. THE User_Card SHALL display the user email as the primary identifier
3. THE User_Card SHALL display the user role (Admin/User) with appropriate visual distinction
4. THE User_Card SHALL display the plan name prominently when available
5. THE User_Card SHALL maintain responsive design for mobile and desktop views

### Requirement 6: Exibir Data de Criação da Conta

**User Story:** As an admin, I want to see when each user account was created, so that I can understand user tenure.

#### Acceptance Criteria

1. THE User_Card SHALL display the account creation date
2. THE User_Card SHALL format dates in a consistent, localized format (dd/MM/yyyy)

### Requirement 7: Indicador Visual de Email Confirmado

**User Story:** As an admin, I want to quickly see if a user has confirmed their email, so that I can identify potential issues with account verification.

#### Acceptance Criteria

1. WHEN a user has confirmed their email, THE User_Card SHALL display a green checkmark indicator
2. WHEN a user has NOT confirmed their email, THE User_Card SHALL display an orange warning indicator
3. THE indicator SHALL be compact and not dominate the card layout

### Requirement 8: Atribuir Inbox Existente a Usuário

**User Story:** As an admin, I want to assign an existing unassigned inbox to a user, so that I can reuse inboxes that are not linked to any user.

#### Acceptance Criteria

1. WHEN the admin opens the inbox creation dialog, THE Dialog SHALL display two options: "Criar Nova" and "Atribuir Existente"
2. WHEN the admin selects "Atribuir Existente", THE Dialog SHALL display a searchable list of unassigned inboxes
3. WHEN searching for inboxes, THE System SHALL filter inboxes by name or phone number
4. WHEN an unassigned inbox is selected, THE Dialog SHALL display the inbox details (name, channel type, phone number)
5. WHEN the admin confirms the assignment, THE System SHALL link the selected inbox to the user
6. IF no unassigned inboxes exist, THE Dialog SHALL display a message "Nenhuma caixa de entrada disponível" and suggest creating a new one
7. WHEN the assignment is successful, THE System SHALL display a success toast and refresh the user's inbox list
