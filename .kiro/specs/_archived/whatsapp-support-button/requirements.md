# Requirements Document

## Introduction

Este documento especifica os requisitos para implementação de um botão de suporte via WhatsApp no sistema WUZAPI Manager. O botão será exibido de forma flutuante em todas as páginas da aplicação, permitindo que usuários entrem em contato com o suporte através de um link direto para o WhatsApp. O número de telefone do suporte será configurável pelo administrador nas configurações do sistema.

## Glossary

- **Support Button**: Botão flutuante verde com ícone do WhatsApp que redireciona para o chat do suporte
- **Support Phone**: Número de telefone do WhatsApp de suporte, configurado pelo administrador
- **Branding Config**: Tabela de configuração do sistema que armazena personalizações visuais e de contato
- **wa.me Link**: URL do WhatsApp Web/App no formato `https://wa.me/{numero}` para iniciar conversas

## Requirements

### Requirement 1

**User Story:** As an administrator, I want to configure a support WhatsApp number in the admin settings, so that users can contact support directly through WhatsApp.

#### Acceptance Criteria

1. WHEN an administrator accesses the branding settings page THEN the System SHALL display a field for entering the support WhatsApp number
2. WHEN an administrator enters a phone number THEN the System SHALL validate the format (only digits, 10-15 characters including country code)
3. WHEN an administrator saves the support phone number THEN the System SHALL persist the value to the branding_config table
4. WHEN an administrator clears the support phone field THEN the System SHALL hide the support button from all pages
5. IF an administrator enters an invalid phone format THEN the System SHALL display a validation error message and prevent saving

### Requirement 2

**User Story:** As a user, I want to see a floating support button on all pages, so that I can easily contact support when needed.

#### Acceptance Criteria

1. WHEN a support phone number is configured THEN the System SHALL display a floating green button with WhatsApp icon in the bottom-right corner
2. WHEN a user clicks the support button THEN the System SHALL open a new tab with the WhatsApp link `https://wa.me/{supportPhone}`
3. WHEN no support phone number is configured THEN the System SHALL hide the support button completely
4. WHILE the user scrolls the page THEN the System SHALL keep the support button fixed in position
5. WHEN the support button is rendered THEN the System SHALL display the text "Suporte" next to the WhatsApp icon

### Requirement 3

**User Story:** As a developer, I want the support phone configuration to follow existing branding patterns, so that the codebase remains consistent and maintainable.

#### Acceptance Criteria

1. WHEN the support phone is stored THEN the System SHALL use the existing branding_config table with a new support_phone column
2. WHEN the support phone is retrieved THEN the System SHALL include it in the getBrandingConfig response
3. WHEN the support phone is updated THEN the System SHALL follow the same validation and update patterns as other branding fields
4. WHEN the public branding endpoint is called THEN the System SHALL include the support phone in the response for button rendering
