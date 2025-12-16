# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o comportamento dos cards do Kanban, garantindo que apenas os campos marcados como "Exibir no Card" sejam exibidos, seguindo as mesmas regras já aplicadas nas visualizações Grid e List.

## Glossary

- **System**: WUZAPI Manager - Sistema de gerenciamento de WhatsApp Business API
- **Kanban View**: Visualização em formato de quadro Kanban com colunas baseadas em status/etapas
- **Kanban Card**: Card individual que representa um registro dentro de uma coluna do Kanban
- **Field Mapper**: Ferramenta de configuração de campos que permite ao Admin definir quais campos são visíveis, editáveis e exibidos em cards
- **showInCard**: Propriedade booleana no Field Mapper que controla se um campo deve aparecer nos cards
- **Admin**: Usuário com permissões administrativas que configura conexões de banco de dados
- **End User**: Usuário final que visualiza e interage com os dados através das diferentes views
- **Grid View**: Visualização em formato de grade com cards
- **List View**: Visualização em formato de lista com cards
- **Table View**: Visualização em formato de tabela

## Requirements

### Requirement 1: Kanban Card Field Display Control

**User Story:** Como Admin, eu quero que os cards do Kanban respeitem a configuração "Exibir no Card" do Field Mapper, para que eu possa controlar exatamente quais campos aparecem nos cards do Kanban, da mesma forma que já funciona nas views Grid e List.

#### Acceptance Criteria

1. WHEN the System renders a Kanban card, THE System SHALL display only the fields where `showInCard` is `true` AND `visible` is `true`
2. WHEN no fields have `showInCard` set to `true`, THE System SHALL display a fallback showing the record ID
3. WHEN the Admin marks a field with `showInCard: true` in the Field Mapper, THE System SHALL include that field in Kanban cards on the End User's next page load
4. WHEN the Admin unmarks a field from `showInCard`, THE System SHALL exclude that field from Kanban cards on the End User's next page load
5. WHEN the System displays fields in Kanban cards, THE System SHALL use the configured friendly label from the Field Mapper

### Requirement 2: Consistency Across View Types

**User Story:** Como End User, eu quero que os campos exibidos nos cards sejam consistentes entre as visualizações Grid, List e Kanban, para que eu tenha uma experiência uniforme ao navegar entre diferentes views.

#### Acceptance Criteria

1. WHEN the End User switches from Grid view to Kanban view, THE System SHALL display the same fields in the cards (those marked with `showInCard: true`)
2. WHEN the End User switches from List view to Kanban view, THE System SHALL display the same fields in the cards (those marked with `showInCard: true`)
3. WHEN the Admin changes the `showInCard` configuration, THE System SHALL apply the changes consistently across Grid, List, and Kanban views
4. WHEN a field has `visible: false`, THE System SHALL NOT display that field in any card view (Grid, List, or Kanban), regardless of the `showInCard` setting

### Requirement 3: Field Value Display

**User Story:** Como End User, eu quero que os valores dos campos sejam exibidos de forma clara e legível nos cards do Kanban, para que eu possa identificar rapidamente as informações importantes de cada registro.

#### Acceptance Criteria

1. WHEN the System displays a field in a Kanban card, THE System SHALL show the field label above the field value
2. WHEN a field value is empty, null, or undefined, THE System SHALL NOT display that field in the card
3. WHEN the System displays field values, THE System SHALL format them as strings for consistent display
4. WHEN multiple fields are marked with `showInCard: true`, THE System SHALL display all of them in the card in the order they appear in the Field Mapper
5. WHEN a field value is too long, THE System SHALL allow text wrapping to ensure readability

### Requirement 4: Backward Compatibility

**User Story:** Como Admin, eu quero que conexões de banco de dados existentes continuem funcionando após a correção, para que não haja quebra de funcionalidade em configurações já estabelecidas.

#### Acceptance Criteria

1. WHERE a database connection has no `showInCard` configuration for any field, THE System SHALL display a default fallback (record ID) in Kanban cards
2. WHERE a database connection has `fieldMappings` without the `showInCard` property, THE System SHALL treat those fields as `showInCard: false`
3. WHEN the System loads an existing database connection, THE System SHALL handle both the presence and absence of `showInCard` configuration gracefully
4. WHERE `fieldMappings` is undefined or empty, THE System SHALL display the record ID as a fallback in Kanban cards
