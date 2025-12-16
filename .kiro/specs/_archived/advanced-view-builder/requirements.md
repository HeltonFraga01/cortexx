# Requirements Document

## Introduction

This feature evolves the Admin's "Advanced Configuration" screen from a simple "form field mapper" into a powerful "View Builder". The Admin will be able to:
1. Add helper text (descriptions) to form fields to provide better guidance to end users
2. Enable and configure Calendar views for date-based data visualization
3. Enable and configure Kanban views for status/stage-based data visualization

This transforms the user experience from basic CRUD operations into rich, context-aware data visualization and management.

## Glossary

- **Admin**: The administrator user who configures database connections and field mappings
- **End User**: The regular user who views and edits their data through the configured interfaces
- **Field Mapper**: The existing table in the Advanced Configuration screen that maps NocoDB columns to user-friendly labels
- **Helper Text**: A descriptive text that appears below a form field to provide additional guidance
- **View Builder**: The enhanced configuration system that allows Admins to define multiple visualization modes
- **Calendar View**: A calendar-based visualization that displays records organized by date
- **Kanban View**: A board-based visualization that displays records as cards organized in columns by status/stage
- **NocoDB**: The backend database system that stores the actual data
- **View Configuration Section**: A new section in the Advanced Configuration screen for enabling and configuring views

## Requirements

### Requirement 1: Helper Text for Form Fields

**User Story:** As an Admin, I want to add descriptive helper text to form fields, so that end users understand what information is expected in complex fields.

#### Acceptance Criteria

1. WHEN the Admin accesses the Field Mapper table in the Advanced Configuration screen, THE System SHALL display a new column titled "Texto de Ajuda (Descrição)"
2. WHEN the Admin enters text in the "Texto de Ajuda (Descrição)" column for a field, THE System SHALL save this helper text in the database connection configuration
3. WHEN an End User views the form with a field that has helper text configured, THE System SHALL display the helper text below the input field in a smaller font size or lighter color
4. WHERE a field has no helper text configured, THE System SHALL display only the field label without additional description
5. WHEN the Admin updates or removes helper text, THE System SHALL immediately reflect the changes for End Users on their next form load

### Requirement 2: Calendar View Configuration

**User Story:** As an Admin, I want to enable and configure a Calendar view for a database connection, so that end users can visualize their records organized by date.

#### Acceptance Criteria

1. WHEN the Admin accesses the Advanced Configuration screen, THE System SHALL display a new section titled "Configuração de Visualizações"
2. WHEN the Admin views the View Configuration Section, THE System SHALL display a toggle or checkbox labeled "Habilitar Visualização Calendário"
3. WHEN the Admin enables the Calendar View, THE System SHALL display a dropdown labeled "Organizar por (Coluna de Data)"
4. WHEN the dropdown is displayed, THE System SHALL populate it only with columns from the NocoDB table that are of type "Date" or "DateTime"
5. WHEN the Admin selects a date column and saves the configuration, THE System SHALL store the Calendar View settings in the database connection configuration
6. WHEN an End User accesses a database connection with Calendar View enabled, THE System SHALL display view tabs including "Formulário" and "Calendário"
7. WHEN the End User clicks the "Calendário" tab, THE System SHALL display their records plotted on a calendar using the configured date column
8. WHERE the Calendar View is disabled, THE System SHALL not display the "Calendário" tab to End Users

### Requirement 3: Kanban View Configuration

**User Story:** As an Admin, I want to enable and configure a Kanban view for a database connection, so that end users can visualize their records organized by status or stage.

#### Acceptance Criteria

1. WHEN the Admin views the View Configuration Section, THE System SHALL display a toggle or checkbox labeled "Habilitar Visualização Kanban"
2. WHEN the Admin enables the Kanban View, THE System SHALL display a dropdown labeled "Organizar por (Coluna de Etapas/Status)"
3. WHEN the dropdown is displayed, THE System SHALL populate it with columns suitable for grouping, including columns of type "Text", "Select", and "Tags"
4. WHEN the Admin selects a status/stage column and saves the configuration, THE System SHALL store the Kanban View settings in the database connection configuration
5. WHEN an End User accesses a database connection with Kanban View enabled, THE System SHALL display a "Kanban" tab in the view tabs
6. WHEN the End User clicks the "Kanban" tab, THE System SHALL display columns (pipelines) based on the unique values of the configured status/stage column
7. WHEN the System displays the Kanban view, THE System SHALL render each record as a card within the appropriate column
8. WHEN rendering Kanban cards, THE System SHALL display only the fields marked as "Exibir no Card" in the Field Mapper
9. WHERE the Kanban View is disabled, THE System SHALL not display the "Kanban" tab to End Users

### Requirement 4: Integration with Existing Field Mapper

**User Story:** As an Admin, I want the "Exibir no Card" setting in the Field Mapper to control which fields appear in Kanban cards, so that I can create clean, focused card displays.

#### Acceptance Criteria

1. WHEN the Admin marks a field as "Exibir no Card" in the Field Mapper, THE System SHALL include that field in Kanban card displays
2. WHEN the Admin unmarks a field from "Exibir no Card", THE System SHALL exclude that field from Kanban card displays
3. WHEN the System renders a Kanban card, THE System SHALL display all fields marked as "Exibir no Card" with their configured friendly labels
4. WHERE no fields are marked as "Exibir no Card", THE System SHALL display a default set of fields (such as the record ID) in Kanban cards
5. WHEN the Admin changes the "Exibir no Card" settings, THE System SHALL reflect the changes in the Kanban view on the End User's next page load

### Requirement 5: View Persistence and Navigation

**User Story:** As an End User, I want my selected view (Form, Calendar, or Kanban) to be remembered, so that I can continue working in my preferred visualization mode.

#### Acceptance Criteria

1. WHEN an End User selects a view tab (Formulário, Calendário, or Kanban), THE System SHALL store the selected view preference in the browser's local storage
2. WHEN the End User returns to the same database connection, THE System SHALL automatically display the last selected view
3. WHEN the End User switches between different database connections, THE System SHALL remember the view preference for each connection separately
4. WHERE no view preference is stored, THE System SHALL default to the "Formulário" view
5. WHEN the Admin disables a view that was previously selected by an End User, THE System SHALL automatically switch the End User to the "Formulário" view on their next access
