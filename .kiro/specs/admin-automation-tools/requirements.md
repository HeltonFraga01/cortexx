# Requirements Document

## Introduction

Este documento especifica os requisitos para ferramentas de automação administrativa no WUZAPI Manager. O objetivo é permitir que administradores configurem padrões globais e automações que se aplicam automaticamente a novos usuários, reduzindo trabalho manual repetitivo e garantindo consistência na configuração da plataforma.

As funcionalidades incluem: configuração de bot padrão para novos usuários, templates de configuração de webhooks, labels e respostas rápidas padrão, configurações de integração com NocoDB, automações de onboarding, bulk actions para usuários existentes, e monitoramento centralizado.

## Glossary

- **Admin**: Usuário com token administrativo que gerencia a plataforma e outros usuários
- **User**: Usuário final da plataforma que utiliza os recursos de WhatsApp
- **Bot Template**: Configuração de bot reutilizável que pode ser aplicada a múltiplos usuários
- **Default Bot**: Bot template que é automaticamente aplicado a novos usuários
- **Label Template**: Conjunto de labels pré-definidas que podem ser aplicadas a novos usuários
- **Canned Response Template**: Conjunto de respostas rápidas pré-definidas para novos usuários
- **Onboarding Automation**: Processo automatizado de configuração inicial de novos usuários
- **Global Settings**: Configurações administrativas que afetam o comportamento padrão do sistema
- **Admin Settings**: Página de configurações administrativas do sistema
- **Bulk Action**: Operação aplicada a múltiplos usuários simultaneamente
- **Automation Audit Log**: Registro de todas as automações executadas pelo sistema

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to configure a default bot that is automatically assigned to new users, so that I don't have to manually configure bots for each new user.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Default Bot Configuration" section
2. WHEN an administrator selects a bot template as default THEN the Admin_Settings SHALL persist this selection in the global settings
3. WHEN a new user is created THEN the System SHALL automatically create a bot instance based on the default bot template for that user
4. WHEN the default bot template is updated THEN the System SHALL apply the new template only to users created after the update
5. IF no default bot template is configured THEN the System SHALL create new users without an automatic bot assignment

### Requirement 2

**User Story:** As an administrator, I want to create and manage bot templates, so that I can define reusable bot configurations for different use cases.

#### Acceptance Criteria

1. WHEN an administrator accesses the bot templates section THEN the Admin_Settings SHALL display a list of existing bot templates
2. WHEN an administrator creates a new bot template THEN the Admin_Settings SHALL require name, description, and outgoing URL fields
3. WHEN an administrator edits a bot template THEN the Admin_Settings SHALL update the template without affecting existing user bots
4. WHEN an administrator deletes a bot template THEN the Admin_Settings SHALL prevent deletion if the template is set as default
5. WHEN displaying bot templates THEN the Admin_Settings SHALL indicate which template is currently set as default

### Requirement 3

**User Story:** As an administrator, I want to configure default webhook settings for new users, so that new users automatically have webhooks configured for common events.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Default Webhook Configuration" section
2. WHEN an administrator configures default webhook events THEN the Admin_Settings SHALL allow selection from all available WUZAPI events
3. WHEN a new user is created with a webhook URL THEN the System SHALL automatically subscribe the user to the default events
4. IF a new user is created without a webhook URL THEN the System SHALL store the default events for later application when webhook is configured
5. WHEN the default webhook events are updated THEN the System SHALL apply changes only to users created after the update

### Requirement 4

**User Story:** As an administrator, I want to view and manage all global automation settings in one place, so that I can efficiently configure platform-wide defaults.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display all automation settings in organized tabs or sections
2. WHEN an administrator modifies any global setting THEN the Admin_Settings SHALL save changes immediately with visual confirmation
3. WHEN displaying automation settings THEN the Admin_Settings SHALL show the current status of each automation (enabled/disabled)
4. WHEN an administrator enables or disables an automation THEN the System SHALL apply the change to all future user creations
5. WHEN the admin settings page loads THEN the Admin_Settings SHALL retrieve and display all current global settings values

### Requirement 5

**User Story:** As an administrator, I want to configure default labels for new users, so that they start with a consistent set of conversation organization tools.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Default Labels" section
2. WHEN an administrator creates a default label THEN the Admin_Settings SHALL require name and color fields
3. WHEN a new user is created THEN the System SHALL automatically create the default labels for that user
4. WHEN an administrator edits a default label THEN the Admin_Settings SHALL update the template without affecting existing user labels
5. WHEN displaying default labels THEN the Admin_Settings SHALL show a preview of each label with its color

### Requirement 6

**User Story:** As an administrator, I want to configure default canned responses for new users, so that they have quick reply templates ready to use immediately.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Default Canned Responses" section
2. WHEN an administrator creates a default canned response THEN the Admin_Settings SHALL require shortcut and content fields
3. WHEN a new user is created THEN the System SHALL automatically create the default canned responses for that user
4. WHEN an administrator edits a default canned response THEN the Admin_Settings SHALL update the template without affecting existing user responses
5. WHEN displaying default canned responses THEN the Admin_Settings SHALL show the shortcut and a preview of the content

### Requirement 7

**User Story:** As an administrator, I want to configure default NocoDB integration settings, so that new users can quickly connect to their databases with pre-configured field mappings.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Default Database Configuration" section
2. WHEN an administrator configures default NocoDB base URL THEN the Admin_Settings SHALL validate the URL format before saving
3. WHEN an administrator configures default field mappings THEN the Admin_Settings SHALL allow mapping of common fields (name, phone, email)
4. WHEN a new user configures their NocoDB connection THEN the System SHALL pre-populate fields with default values if available
5. IF default database settings are not configured THEN the System SHALL present empty configuration forms to new users

### Requirement 8

**User Story:** As an administrator, I want to apply configurations to existing users in bulk, so that I can update multiple users without configuring each one individually.

#### Acceptance Criteria

1. WHEN an administrator accesses the user management page THEN the Admin_Settings SHALL display a "Bulk Actions" dropdown
2. WHEN an administrator selects multiple users THEN the Admin_Settings SHALL enable bulk action options
3. WHEN an administrator applies a bot template to selected users THEN the System SHALL create bot instances for each selected user
4. WHEN an administrator applies default labels to selected users THEN the System SHALL create labels for users who don't have them
5. WHEN a bulk action completes THEN the Admin_Settings SHALL display a summary of successful and failed operations

### Requirement 9

**User Story:** As an administrator, I want to see an audit log of automation actions, so that I can track what automations were applied to which users.

#### Acceptance Criteria

1. WHEN an administrator accesses the automation audit log THEN the Admin_Settings SHALL display a chronological list of automation events
2. WHEN an automation is applied to a new user THEN the System SHALL log the event with timestamp, user ID, and automation type
3. WHEN displaying audit log entries THEN the Admin_Settings SHALL show the automation type, affected user, and result status
4. WHEN an administrator filters the audit log THEN the Admin_Settings SHALL support filtering by date range, automation type, and user
5. WHEN the audit log exceeds retention period THEN the System SHALL automatically archive old entries

### Requirement 10

**User Story:** As an administrator, I want to see a dashboard with automation statistics, so that I can understand how automations are being used across the platform.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin dashboard THEN the Admin_Dashboard SHALL display automation statistics cards
2. WHEN displaying automation statistics THEN the Admin_Dashboard SHALL show count of automations applied in the last 7 days
3. WHEN displaying automation statistics THEN the Admin_Dashboard SHALL show success and failure rates for each automation type
4. WHEN an administrator clicks on a statistic THEN the Admin_Dashboard SHALL navigate to the filtered audit log
5. WHEN the dashboard loads THEN the Admin_Dashboard SHALL retrieve statistics from the automation audit log

### Requirement 11

**User Story:** As an administrator, I want to configure message templates that are available to all users, so that I can ensure consistent messaging across the platform.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Global Message Templates" section
2. WHEN an administrator creates a global message template THEN the Admin_Settings SHALL require name, content, and category fields
3. WHEN a user accesses their message templates THEN the System SHALL display both personal and global templates
4. WHEN displaying global templates to users THEN the System SHALL mark them as "Global" and prevent editing
5. WHEN an administrator updates a global template THEN the System SHALL make the update immediately available to all users

### Requirement 12

**User Story:** As an administrator, I want to configure user quotas and limits, so that I can control resource usage across the platform.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "User Quotas" section
2. WHEN an administrator configures default quotas THEN the Admin_Settings SHALL allow setting limits for messages per day, bots per user, and campaigns per month
3. WHEN a new user is created THEN the System SHALL apply the default quotas to that user
4. WHEN an administrator overrides quotas for a specific user THEN the System SHALL use the override instead of defaults
5. WHEN a user approaches their quota limit THEN the System SHALL display a warning notification

### Requirement 13

**User Story:** As an administrator, I want to export and import automation configurations, so that I can backup settings or replicate them across environments.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display "Export Configuration" and "Import Configuration" buttons
2. WHEN an administrator exports configuration THEN the System SHALL generate a JSON file with all automation settings
3. WHEN an administrator imports configuration THEN the Admin_Settings SHALL validate the JSON structure before applying
4. WHEN importing configuration THEN the Admin_Settings SHALL show a preview of changes before applying
5. IF import validation fails THEN the Admin_Settings SHALL display specific error messages for each invalid field

### Requirement 14

**User Story:** As an administrator, I want to schedule automated maintenance tasks, so that the system stays optimized without manual intervention.

#### Acceptance Criteria

1. WHEN an administrator accesses the admin settings page THEN the Admin_Settings SHALL display a "Scheduled Tasks" section
2. WHEN an administrator configures a scheduled task THEN the Admin_Settings SHALL allow setting frequency (daily, weekly, monthly)
3. WHEN a scheduled task executes THEN the System SHALL log the execution in the audit log
4. WHEN displaying scheduled tasks THEN the Admin_Settings SHALL show last execution time and next scheduled time
5. WHEN a scheduled task fails THEN the System SHALL send a notification to the administrator
