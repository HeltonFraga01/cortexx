# Requirements Document

## Introduction

Este documento especifica os requisitos para tornar as configurações da API WUZAPI editáveis através do painel de administração, em vez de depender exclusivamente de variáveis de ambiente no arquivo `.env`. O objetivo é permitir que administradores configurem e atualizem as credenciais e URLs da API diretamente pela interface web, com as configurações sendo persistidas no banco de dados e tendo precedência sobre as variáveis de ambiente.

## Glossary

- **Sistema**: O WUZAPI Manager, plataforma de gerenciamento da API WhatsApp Business
- **Administrador**: Usuário com papel admin que tem acesso total às configurações do sistema
- **API_Settings**: Configurações relacionadas à integração com a API WUZAPI (URL base, token, timeout)
- **global_settings**: Tabela existente no banco de dados para armazenar configurações globais do sistema
- **WUZAPI**: API externa de WhatsApp Business que o sistema integra
- **Fallback**: Valor padrão usado quando não há configuração no banco de dados

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to edit API settings through the admin panel, so that I can configure the WUZAPI integration without modifying environment files.

#### Acceptance Criteria

1. WHEN an administrator accesses the API settings section THEN the Sistema SHALL display editable input fields for WUZAPI_BASE_URL, WUZAPI_ADMIN_TOKEN, and WUZAPI_TIMEOUT
2. WHEN an administrator submits new API settings THEN the Sistema SHALL validate the input format before saving
3. WHEN API settings are saved THEN the Sistema SHALL persist the values to the global_settings table in the database
4. WHEN the Sistema loads API settings THEN the Sistema SHALL prioritize database values over environment variables (database takes precedence)
5. WHEN no database settings exist THEN the Sistema SHALL fall back to environment variable values as defaults

### Requirement 2

**User Story:** As an administrator, I want to test the API connection after changing settings, so that I can verify the configuration is correct before relying on it.

#### Acceptance Criteria

1. WHEN an administrator clicks the test connection button THEN the Sistema SHALL use the currently saved settings to test connectivity
2. WHEN the connection test succeeds THEN the Sistema SHALL display a success message with connection details
3. WHEN the connection test fails THEN the Sistema SHALL display a descriptive error message indicating the failure reason
4. IF the WUZAPI_BASE_URL is unreachable THEN the Sistema SHALL report a connection timeout error within 15 seconds

### Requirement 3

**User Story:** As an administrator, I want the API token to be securely handled, so that sensitive credentials are protected.

#### Acceptance Criteria

1. WHEN displaying the API token field THEN the Sistema SHALL mask the token value with asterisks
2. WHEN an administrator edits the token THEN the Sistema SHALL allow viewing the current value only after explicit action
3. WHEN storing the API token THEN the Sistema SHALL encrypt the value before persisting to the database
4. WHEN the Sistema retrieves the token for API calls THEN the Sistema SHALL decrypt the value in memory only

### Requirement 4

**User Story:** As a system operator, I want the API settings to be loaded at runtime, so that configuration changes take effect without server restart.

#### Acceptance Criteria

1. WHEN API settings are updated in the database THEN the Sistema SHALL apply the new settings to subsequent API calls without restart
2. WHEN the backend service starts THEN the Sistema SHALL load API settings from database with fallback to environment variables
3. WHEN a setting is deleted from the database THEN the Sistema SHALL revert to the environment variable value for that setting

### Requirement 5

**User Story:** As an administrator, I want to see the current source of each setting, so that I can understand whether values come from database or environment.

#### Acceptance Criteria

1. WHEN displaying API settings THEN the Sistema SHALL indicate the source of each value (database or environment fallback)
2. WHEN a setting uses the environment fallback THEN the Sistema SHALL display a visual indicator showing it is using the default value
3. WHEN an administrator hovers over a setting source indicator THEN the Sistema SHALL display a tooltip explaining the configuration hierarchy

