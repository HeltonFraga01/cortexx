# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação de um sistema completo de gestão administrativa de usuários no WUZAPI Manager. O sistema permitirá que administradores do sistema gerenciem usuários (Accounts), definam limites de recursos, controlem funcionalidades disponíveis, gerenciem planos/assinaturas e monitorem o uso do sistema de forma centralizada.

O objetivo é transformar o painel administrativo atual em uma solução profissional de SaaS, com controle granular sobre cada usuário e seus recursos.

## Glossary

- **System_Admin**: Administrador do sistema com acesso total a todas as funcionalidades administrativas.
- **User (Account)**: Usuário do sistema que possui uma conta e pode ter sub-usuários (Agents).
- **Plan**: Plano de assinatura que define limites e funcionalidades disponíveis para um usuário.
- **Quota**: Limite quantitativo de uso de um recurso específico (mensagens, conexões, etc.).
- **Feature_Flag**: Controle booleano que habilita ou desabilita uma funcionalidade específica para um usuário.
- **Usage_Metric**: Registro de uso de um recurso por um usuário em um período específico.
- **Billing_Cycle**: Período de faturamento (mensal, anual) para cálculo de uso e cobrança.
- **Subscription_Status**: Estado da assinatura do usuário (trial, active, past_due, canceled, expired).
- **Rate_Limit**: Limite de requisições por período de tempo para prevenir abuso.
- **Audit_Trail**: Registro imutável de ações administrativas para compliance e auditoria.

## Requirements

### Requirement 1: Gestão de Planos e Assinaturas

**User Story:** As a System_Admin, I want to create and manage subscription plans with different limits and features, so that I can offer tiered pricing to users.

#### Acceptance Criteria

1. WHEN a System_Admin creates a new Plan THEN the System SHALL store the plan with name, description, price_cents, billing_cycle, and status
2. WHEN a Plan is created THEN the System SHALL allow configuration of resource quotas including max_agents, max_connections, max_messages_per_month, max_inboxes, max_teams, and max_storage_mb
3. WHEN a Plan is created THEN the System SHALL allow configuration of feature flags for each available system feature
4. WHEN a System_Admin views the Plans list THEN the System SHALL display all plans with their quotas, features, and count of active subscribers
5. WHEN a System_Admin updates a Plan THEN the System SHALL apply changes to all users on that plan according to the effective_date setting
6. IF a Plan is deleted THEN the System SHALL require migration of existing users to another plan before deletion

### Requirement 2: Atribuição de Planos a Usuários

**User Story:** As a System_Admin, I want to assign plans to users and manage their subscription status, so that I can control access to system resources.

#### Acceptance Criteria

1. WHEN a System_Admin assigns a Plan to a User THEN the System SHALL update the user's quotas and feature flags immediately
2. WHEN a User's plan is changed THEN the System SHALL calculate prorated charges or credits based on the billing cycle
3. WHEN a System_Admin views a User's subscription THEN the System SHALL display current plan, status, start_date, next_billing_date, and usage summary
4. WHEN a subscription status changes to past_due THEN the System SHALL send notification to the user and System_Admin
5. WHEN a subscription status changes to expired THEN the System SHALL restrict user access to read-only mode while preserving data
6. WHERE a User requires custom limits THEN the System SHALL allow override of individual quotas without changing the base plan

### Requirement 3: Controle de Quotas e Limites

**User Story:** As a System_Admin, I want to set and monitor resource quotas per user, so that I can prevent abuse and ensure fair usage.

#### Acceptance Criteria

1. THE System SHALL enforce quotas for: max_agents, max_connections, max_messages_per_day, max_messages_per_month, max_inboxes, max_teams, max_webhooks, max_campaigns, and max_storage_mb
2. WHEN a User attempts to exceed a quota THEN the System SHALL reject the operation and return a clear error message with upgrade options
3. WHEN a User reaches 80% of any quota THEN the System SHALL send a warning notification to the user
4. WHEN a System_Admin views a User's quotas THEN the System SHALL display current usage versus limit for each quota with percentage and visual indicator
5. WHEN a System_Admin overrides a User's quota THEN the System SHALL log the change in the audit trail with reason
6. WHEN the billing cycle resets THEN the System SHALL reset usage counters for cycle-based quotas (messages_per_month)

### Requirement 4: Controle de Funcionalidades (Feature Flags)

**User Story:** As a System_Admin, I want to enable or disable specific features per user, so that I can offer differentiated access based on plan or custom agreements.

#### Acceptance Criteria

1. THE System SHALL support feature flags for: page_builder, bulk_campaigns, nocodb_integration, chatwoot_integration, typebot_integration, bot_automation, advanced_reports, api_access, webhooks, scheduled_messages, media_storage, and custom_branding
2. WHEN a System_Admin toggles a feature flag for a User THEN the System SHALL immediately enable or disable that feature in the user's interface
3. WHEN a User attempts to access a disabled feature THEN the System SHALL display a message indicating the feature is not available on their plan
4. WHEN a System_Admin views a User's features THEN the System SHALL display all features with their enabled/disabled status and source (plan default or custom override)
5. WHEN a feature flag is changed at the Plan level THEN the System SHALL propagate the change to all users on that plan unless they have a custom override
6. WHEN a new feature is added to the system THEN the System SHALL default it to disabled for all existing plans until explicitly enabled

### Requirement 5: Dashboard Administrativo Avançado

**User Story:** As a System_Admin, I want a comprehensive dashboard with system-wide metrics, so that I can monitor the health and growth of the platform.

#### Acceptance Criteria

1. WHEN a System_Admin accesses the dashboard THEN the System SHALL display total users, active users, users by plan, and growth trend (last 30 days)
2. WHEN a System_Admin accesses the dashboard THEN the System SHALL display total messages sent (today, this week, this month), active connections, and storage usage
3. WHEN a System_Admin accesses the dashboard THEN the System SHALL display revenue metrics: MRR (Monthly Recurring Revenue), users by subscription status, and churn rate
4. WHEN a System_Admin accesses the dashboard THEN the System SHALL display system health: API response time, error rate, and service status
5. WHEN a System_Admin accesses the dashboard THEN the System SHALL display alerts for: users near quota limits, failed payments, connection errors, and security events
6. WHEN a System_Admin clicks on a metric THEN the System SHALL navigate to a detailed view with historical data and filtering options

### Requirement 6: Gestão Detalhada de Usuários

**User Story:** As a System_Admin, I want to view and manage detailed information about each user, so that I can provide support and make informed decisions.

#### Acceptance Criteria

1. WHEN a System_Admin views the Users list THEN the System SHALL display users with name, email, plan, status, created_at, last_activity, and usage summary
2. WHEN a System_Admin views a User's detail page THEN the System SHALL display: profile info, subscription details, quota usage, feature flags, sub-users (Agents), connections, and activity log
3. WHEN a System_Admin searches for users THEN the System SHALL support search by name, email, phone, token, and plan
4. WHEN a System_Admin filters users THEN the System SHALL support filters by plan, status, created_date_range, and usage_level
5. WHEN a System_Admin views a User's sub-users THEN the System SHALL display all Agents with their roles, status, and last activity
6. WHEN a System_Admin needs to act as a User THEN the System SHALL provide impersonation capability with full audit logging

### Requirement 7: Ações Administrativas em Usuários

**User Story:** As a System_Admin, I want to perform administrative actions on users, so that I can manage accounts effectively.

#### Acceptance Criteria

1. WHEN a System_Admin suspends a User THEN the System SHALL immediately block all access while preserving data and log the action with reason
2. WHEN a System_Admin reactivates a User THEN the System SHALL restore access according to the user's plan and log the action
3. WHEN a System_Admin resets a User's password THEN the System SHALL generate a secure temporary password and send it via email
4. WHEN a System_Admin deletes a User THEN the System SHALL require confirmation, cascade delete all related data, and log the action
5. WHEN a System_Admin exports a User's data THEN the System SHALL generate a complete data export in JSON format for GDPR compliance
6. WHEN a System_Admin sends a notification to a User THEN the System SHALL deliver the message via email and in-app notification

### Requirement 8: Ações em Massa

**User Story:** As a System_Admin, I want to perform bulk actions on multiple users, so that I can efficiently manage large numbers of accounts.

#### Acceptance Criteria

1. WHEN a System_Admin selects multiple users THEN the System SHALL enable bulk action options
2. WHEN a System_Admin applies a bulk plan change THEN the System SHALL update all selected users and generate a summary report
3. WHEN a System_Admin applies bulk suspension THEN the System SHALL suspend all selected users and log each action individually
4. WHEN a System_Admin sends a bulk notification THEN the System SHALL deliver the message to all selected users
5. WHEN a System_Admin exports multiple users THEN the System SHALL generate a consolidated export file
6. IF a bulk action fails for some users THEN the System SHALL complete successful operations and report failures with reasons

### Requirement 9: Auditoria e Compliance

**User Story:** As a System_Admin, I want a complete audit trail of all administrative actions, so that I can ensure compliance and investigate issues.

#### Acceptance Criteria

1. THE System SHALL log all administrative actions with: timestamp, admin_id, action_type, target_user_id, details, and ip_address
2. WHEN a System_Admin views the audit log THEN the System SHALL display entries with filtering by date_range, admin, action_type, and target_user
3. WHEN a System_Admin exports the audit log THEN the System SHALL generate a CSV or JSON file with all filtered entries
4. THE System SHALL retain audit logs for a minimum of 7 years for compliance
5. WHEN a sensitive action is performed (delete, suspend, impersonate) THEN the System SHALL require confirmation and additional authentication
6. WHEN unusual activity is detected THEN the System SHALL alert System_Admins via email and dashboard notification

### Requirement 10: Métricas de Uso por Usuário

**User Story:** As a System_Admin, I want to track detailed usage metrics per user, so that I can understand usage patterns and optimize pricing.

#### Acceptance Criteria

1. THE System SHALL track usage metrics for: messages_sent, messages_received, api_calls, storage_used, connections_active, webhooks_triggered, and campaigns_executed
2. WHEN a System_Admin views a User's usage THEN the System SHALL display metrics for current period, previous period, and historical trend
3. WHEN a System_Admin views usage analytics THEN the System SHALL display aggregated metrics by plan, by period, and by feature
4. THE System SHALL calculate and display cost-per-user based on resource consumption
5. WHEN usage data is collected THEN the System SHALL store it with tenant isolation and support data retention policies
6. WHEN a System_Admin exports usage data THEN the System SHALL generate reports in CSV format with customizable date ranges

### Requirement 11: Configurações Globais do Sistema

**User Story:** As a System_Admin, I want to configure global system settings, so that I can customize the platform behavior.

#### Acceptance Criteria

1. WHEN a System_Admin accesses global settings THEN the System SHALL display configurable options for: default_plan, trial_duration_days, grace_period_days, and password_policy
2. WHEN a System_Admin configures rate limits THEN the System SHALL allow setting global and per-plan rate limits for API endpoints
3. WHEN a System_Admin configures notifications THEN the System SHALL allow customization of email templates for system notifications
4. WHEN a System_Admin configures integrations THEN the System SHALL allow setup of payment gateway, email service, and external APIs
5. WHEN a global setting is changed THEN the System SHALL log the change and apply it according to the specified effective_date
6. WHEN a System_Admin views system configuration THEN the System SHALL display current values with last_modified timestamp and modifier

### Requirement 12: Relatórios e Exportações

**User Story:** As a System_Admin, I want to generate reports on system usage and revenue, so that I can make data-driven business decisions.

#### Acceptance Criteria

1. WHEN a System_Admin generates a usage report THEN the System SHALL include metrics by user, by plan, and by period with totals and averages
2. WHEN a System_Admin generates a revenue report THEN the System SHALL include MRR, ARR, churn, LTV, and revenue by plan
3. WHEN a System_Admin generates a growth report THEN the System SHALL include new users, churned users, plan upgrades, and plan downgrades
4. WHEN a System_Admin schedules a report THEN the System SHALL generate and email the report on the specified schedule
5. WHEN a System_Admin exports a report THEN the System SHALL support formats: PDF, CSV, and Excel
6. WHEN a report is generated THEN the System SHALL cache the results for quick re-access within the same day

