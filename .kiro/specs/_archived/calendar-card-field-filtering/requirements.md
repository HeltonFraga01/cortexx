# Requirements Document

## Introduction

Este documento especifica os requisitos para melhorar a visualização de eventos no Calendário, garantindo que os campos marcados como "Exibir no Card" sejam exibidos de forma clara nos eventos, seguindo as mesmas regras já aplicadas nas visualizações Grid, List e Kanban.

## Glossary

- **System**: WUZAPI Manager - Sistema de gerenciamento de WhatsApp Business API
- **Calendar View**: Visualização em formato de calendário com eventos baseados em datas
- **Calendar Event**: Evento individual que representa um registro em uma data específica
- **Event Tooltip**: Popup que aparece ao passar o mouse sobre um evento no calendário
- **Event Detail**: Informações detalhadas exibidas ao clicar em um evento
- **Field Mapper**: Ferramenta de configuração de campos que permite ao Admin definir quais campos são visíveis, editáveis e exibidos em cards
- **showInCard**: Propriedade booleana no Field Mapper que controla se um campo deve aparecer nos cards e eventos
- **Admin**: Usuário com permissões administrativas que configura conexões de banco de dados
- **End User**: Usuário final que visualiza e interage com os dados através das diferentes views
- **react-big-calendar**: Biblioteca React usada para renderizar o calendário

## Requirements

### Requirement 1: Calendar Event Field Display Control

**User Story:** Como Admin, eu quero que os eventos do Calendário respeitem a configuração "Exibir no Card" do Field Mapper, para que eu possa controlar exatamente quais campos aparecem nos eventos do calendário, da mesma forma que já funciona nas views Grid, List e Kanban.

#### Acceptance Criteria

1. WHEN the System renders a calendar event title, THE System SHALL display only the fields where `showInCard` is `true` AND `visible` is `true`
2. WHEN no fields have `showInCard` set to `true`, THE System SHALL display the record ID as the event title
3. WHEN the Admin marks a field with `showInCard: true` in the Field Mapper, THE System SHALL include that field in calendar event displays on the End User's next page load
4. WHEN the Admin unmarks a field from `showInCard`, THE System SHALL exclude that field from calendar event displays on the End User's next page load
5. WHEN the System displays fields in calendar events, THE System SHALL use the configured friendly label from the Field Mapper

### Requirement 2: Enhanced Event Tooltip Display

**User Story:** Como End User, eu quero ver informações detalhadas dos registros ao passar o mouse sobre eventos no calendário, para que eu possa identificar rapidamente os dados importantes sem precisar clicar no evento.

#### Acceptance Criteria

1. WHEN the End User hovers over a calendar event, THE System SHALL display a tooltip with all fields marked as `showInCard: true` AND `visible: true`
2. WHEN the tooltip is displayed, THE System SHALL show each field with its configured label and value
3. WHEN a field value is empty, null, or undefined, THE System SHALL NOT display that field in the tooltip
4. WHEN multiple fields are marked with `showInCard: true`, THE System SHALL display all of them in the tooltip in the order they appear in the Field Mapper
5. WHERE no fields are marked as `showInCard: true`, THE System SHALL display only the record ID in the tooltip

### Requirement 3: Event Title Formatting

**User Story:** Como End User, eu quero que os títulos dos eventos no calendário sejam claros e informativos, para que eu possa identificar rapidamente os registros sem precisar abrir tooltips ou detalhes.

#### Acceptance Criteria

1. WHEN the System generates an event title, THE System SHALL concatenate the values of fields marked as `showInCard: true` with a separator (e.g., " - ")
2. WHEN an event title would be too long (>50 characters), THE System SHALL truncate it with "..." at the end
3. WHEN all field values are empty for fields marked as `showInCard: true`, THE System SHALL use the record ID as the event title
4. WHEN the System displays event titles, THE System SHALL format values as strings for consistent display
5. WHEN a field value contains special characters, THE System SHALL display them correctly without encoding issues

### Requirement 4: Consistency Across View Types

**User Story:** Como End User, eu quero que os campos exibidos nos eventos do calendário sejam consistentes com as visualizações Grid, List e Kanban, para que eu tenha uma experiência uniforme ao navegar entre diferentes views.

#### Acceptance Criteria

1. WHEN the End User switches from Grid view to Calendar view, THE System SHALL display the same fields in the events (those marked with `showInCard: true`)
2. WHEN the End User switches from List view to Calendar view, THE System SHALL display the same fields in the events (those marked with `showInCard: true`)
3. WHEN the End User switches from Kanban view to Calendar view, THE System SHALL display the same fields in the events (those marked with `showInCard: true`)
4. WHEN the Admin changes the `showInCard` configuration, THE System SHALL apply the changes consistently across Grid, List, Kanban, and Calendar views
5. WHEN a field has `visible: false`, THE System SHALL NOT display that field in any view (Grid, List, Kanban, or Calendar), regardless of the `showInCard` setting

### Requirement 5: Custom Event Component

**User Story:** Como desenvolvedor, eu quero criar um componente customizado para eventos do calendário, para que eu possa ter controle total sobre a aparência e o conteúdo dos eventos exibidos.

#### Acceptance Criteria

1. WHEN the System renders calendar events, THE System SHALL use a custom event component instead of the default react-big-calendar component
2. WHEN the custom event component is rendered, THE System SHALL receive the record data and fieldMappings as props
3. WHEN the custom event component displays fields, THE System SHALL filter by `showInCard: true` AND `visible: true`
4. WHEN the custom event component is clicked, THE System SHALL trigger the onRecordClick callback
5. WHEN the custom event component is styled, THE System SHALL maintain visual consistency with other card-based views

### Requirement 6: Backward Compatibility

**User Story:** Como Admin, eu quero que conexões de banco de dados existentes continuem funcionando após a melhoria, para que não haja quebra de funcionalidade em configurações já estabelecidas.

#### Acceptance Criteria

1. WHERE a database connection has no `showInCard` configuration for any field, THE System SHALL display a default fallback (record ID) in calendar events
2. WHERE a database connection has `fieldMappings` without the `showInCard` property, THE System SHALL treat those fields as `showInCard: false`
3. WHEN the System loads an existing database connection, THE System SHALL handle both the presence and absence of `showInCard` configuration gracefully
4. WHERE `fieldMappings` is undefined or empty, THE System SHALL display the record ID as a fallback in calendar events
