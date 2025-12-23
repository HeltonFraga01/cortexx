# Requirements Document

## Introduction

Este documento especifica os requisitos para o sistema de configuração de webhooks multi-tenant no WUZAPI Manager. O objetivo é permitir que cada tenant (administrador) configure sua própria instância da API WUZAPI (URL base + token admin), e que cada inbox dentro do tenant tenha sua configuração de webhook específica para integração com o sistema de chat. A arquitetura deve garantir isolamento completo entre tenants, com webhooks organizados por subdomínio.

## Glossary

- **Sistema**: O WUZAPI Manager, plataforma de gerenciamento da API WhatsApp Business
- **Tenant**: Uma organização/empresa que utiliza o sistema, identificada por um subdomínio único
- **Admin_Tenant**: Administrador de um tenant específico, responsável por configurar a API WUZAPI do tenant
- **User**: Usuário final dentro de um tenant que utiliza o sistema de chat
- **WUZAPI**: API externa de WhatsApp Business que o sistema integra
- **Inbox**: Caixa de entrada de mensagens WhatsApp, vinculada a um número de telefone
- **Webhook_URL**: URL que recebe eventos da API WUZAPI (mensagens recebidas, status, etc.)
- **Tenant_Settings**: Tabela que armazena configurações específicas de cada tenant
- **Webhook_Config**: Configuração de webhook específica de uma inbox

## Requirements

### Requirement 1: Configuração da API WUZAPI por Tenant

**User Story:** Como admin de um tenant, eu quero configurar a URL base e token admin da API WUZAPI do meu tenant, para que meus usuários possam utilizar o sistema de chat com minha própria instância WUZAPI.

#### Acceptance Criteria

1. WHEN an Admin_Tenant accesses the API settings section THEN the Sistema SHALL display editable input fields for WUZAPI base URL and admin token
2. WHEN an Admin_Tenant submits API settings THEN the Sistema SHALL validate that the URL is a valid HTTPS URL
3. WHEN API settings are saved THEN the Sistema SHALL persist the values to the tenant_settings table with the tenant_id
4. WHEN API settings are saved THEN the Sistema SHALL encrypt the admin token before storing
5. IF the WUZAPI base URL is unreachable THEN the Sistema SHALL display a warning but allow saving
6. WHEN a User accesses the system THEN the Sistema SHALL use the tenant's WUZAPI configuration automatically

### Requirement 2: Configuração de Webhook por Inbox

**User Story:** Como admin de um tenant, eu quero que cada inbox tenha sua própria configuração de webhook, para que as mensagens sejam roteadas corretamente para o sistema de chat.

#### Acceptance Criteria

1. WHEN an inbox is created THEN the Sistema SHALL generate a unique webhook URL based on the tenant subdomain
2. WHEN configuring webhook for an inbox THEN the Sistema SHALL use the tenant's WUZAPI base URL and admin token
3. WHEN a webhook is configured THEN the Sistema SHALL store the configuration in the inbox record
4. THE Sistema SHALL support multiple inboxes per tenant, each with its own webhook configuration
5. WHEN an inbox webhook is configured THEN the Sistema SHALL register the webhook URL with the WUZAPI API

### Requirement 3: Roteamento de Webhooks por Tenant

**User Story:** Como sistema, eu quero rotear webhooks recebidos para o tenant correto, para que as mensagens sejam processadas no contexto correto.

#### Acceptance Criteria

1. WHEN a webhook event is received THEN the Sistema SHALL identify the tenant by the wuzapi_token in the inbox
2. WHEN routing a webhook THEN the Sistema SHALL validate that the inbox belongs to an active tenant
3. IF a webhook is received for an inactive tenant THEN the Sistema SHALL reject the webhook with appropriate logging
4. WHEN processing a webhook THEN the Sistema SHALL set the tenant context before any database operations
5. THE Sistema SHALL log all webhook routing decisions for audit purposes

### Requirement 4: Isolamento de Configurações entre Tenants

**User Story:** Como admin de um tenant, eu quero que minhas configurações de API e webhooks sejam completamente isoladas de outros tenants, para garantir segurança e privacidade.

#### Acceptance Criteria

1. THE Sistema SHALL enforce RLS (Row Level Security) on tenant_settings table
2. WHEN querying API settings THEN the Sistema SHALL only return settings for the current tenant
3. THE Sistema SHALL prevent cross-tenant access to webhook configurations
4. WHEN an Admin_Tenant updates settings THEN the Sistema SHALL verify tenant ownership before saving
5. THE Sistema SHALL use tenant_id in all webhook-related queries

### Requirement 5: Interface de Configuração de Webhook no Chat

**User Story:** Como usuário, eu quero ver e configurar o webhook da minha inbox no painel de configurações do chat, para receber mensagens do WhatsApp.

#### Acceptance Criteria

1. WHEN a User accesses chat settings THEN the Sistema SHALL display the current webhook status for the selected inbox
2. WHEN displaying webhook URL THEN the Sistema SHALL show the URL based on the tenant's main domain
3. WHEN a User clicks configure webhook THEN the Sistema SHALL use the tenant's WUZAPI credentials automatically
4. IF the webhook configuration fails THEN the Sistema SHALL display a descriptive error message
5. WHEN webhook is successfully configured THEN the Sistema SHALL update the inbox status to reflect the configuration

### Requirement 6: Migração de Configurações Globais para Tenant

**User Story:** Como sistema, eu quero migrar configurações globais existentes para o modelo multi-tenant, para manter compatibilidade com instalações existentes.

#### Acceptance Criteria

1. WHEN the system starts THEN the Sistema SHALL check for existing global WUZAPI settings
2. IF global settings exist and no tenant settings THEN the Sistema SHALL offer migration to tenant settings
3. WHEN migrating settings THEN the Sistema SHALL preserve all existing webhook configurations
4. THE Sistema SHALL support fallback to environment variables if no tenant settings exist
5. WHEN a new tenant is created THEN the Sistema SHALL NOT inherit settings from other tenants

