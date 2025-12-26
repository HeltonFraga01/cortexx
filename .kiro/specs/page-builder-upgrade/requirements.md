# Requirements Document

## Introduction

Este documento especifica os requisitos para a modernização do Page Builder existente, substituindo a implementação atual por uma solução baseada na biblioteca Puck - um editor visual open-source para React. O objetivo é fornecer uma experiência de construção de páginas mais completa, profissional e com recursos avançados como undo/redo nativo, preview responsivo, campos dinâmicos e interface customizável.

## Glossary

- **Puck**: Biblioteca open-source de editor visual drag-and-drop para React (@measured/puck)
- **Page_Builder**: Sistema de construção visual de temas para páginas de edição de registros
- **Theme_Schema**: Estrutura JSON que define o layout e componentes de um tema
- **Block**: Componente visual arrastável que pode ser configurado pelo usuário
- **DropZone**: Área onde blocos podem ser soltos para criar layouts aninhados
- **Viewport**: Tamanho de tela simulado para preview responsivo
- **Field**: Campo de configuração de um bloco (texto, número, seleção, etc.)
- **Config**: Objeto de configuração do Puck que define os componentes disponíveis

## Requirements

### Requirement 1: Integração da Biblioteca Puck

**User Story:** As a developer, I want to integrate the Puck library into the project, so that I can leverage its visual editing capabilities.

#### Acceptance Criteria

1. WHEN the Puck package is installed, THE System SHALL include @measured/puck as a project dependency
2. WHEN the Puck editor is rendered, THE System SHALL load the Puck CSS styles correctly
3. WHEN the editor initializes, THE System SHALL configure Puck with the project's existing block types
4. THE System SHALL maintain compatibility with the existing ThemeSchema data structure

### Requirement 2: Migração dos Blocos Existentes

**User Story:** As a user, I want to continue using the existing block types, so that my current themes remain functional.

#### Acceptance Criteria

1. WHEN migrating blocks, THE System SHALL convert all existing block definitions to Puck component config format
2. WHEN a block is rendered, THE System SHALL use the existing block render components
3. WHEN a block is configured, THE System SHALL map existing props to Puck field definitions
4. THE System SHALL support all existing block types: header, form-grid, single-field, avatar, section, divider, save-button, info-card, text, image, badge, stats, link-button, tabs, list, row
5. WHEN loading existing themes, THE System SHALL parse and render them correctly in the new editor

### Requirement 3: Seleção de Conexão de Banco de Dados

**User Story:** As a user, I want to select a database connection before building a theme, so that I can access field metadata for configuration.

#### Acceptance Criteria

1. WHEN the editor loads, THE System SHALL display a connection selector
2. WHEN a connection is selected, THE System SHALL load available fields from that connection
3. WHEN fields are loaded, THE System SHALL make them available for field-select type inputs in blocks
4. IF no connection is selected, THEN THE System SHALL disable block configuration that requires field selection

### Requirement 4: Interface do Editor com Puck

**User Story:** As a user, I want a professional visual editor interface, so that I can build themes efficiently.

#### Acceptance Criteria

1. WHEN the editor renders, THE System SHALL display a component library panel on the left
2. WHEN the editor renders, THE System SHALL display a canvas/preview area in the center
3. WHEN the editor renders, THE System SHALL display a properties panel on the right
4. WHEN a block is selected, THE System SHALL show its configurable fields in the properties panel
5. WHEN dragging a block, THE System SHALL show visual feedback of the drop target
6. THE System SHALL support nested blocks using Puck DropZones

### Requirement 5: Undo/Redo Nativo

**User Story:** As a user, I want to undo and redo my changes, so that I can experiment without fear of losing work.

#### Acceptance Criteria

1. WHEN the user presses Ctrl+Z, THE System SHALL undo the last action
2. WHEN the user presses Ctrl+Shift+Z, THE System SHALL redo the last undone action
3. WHEN undo/redo buttons are clicked, THE System SHALL perform the corresponding action
4. THE System SHALL maintain a history of at least 50 actions
5. WHEN there are no actions to undo, THE System SHALL disable the undo button
6. WHEN there are no actions to redo, THE System SHALL disable the redo button

### Requirement 6: Preview Responsivo

**User Story:** As a user, I want to preview my theme in different screen sizes, so that I can ensure it looks good on all devices.

#### Acceptance Criteria

1. WHEN the editor loads, THE System SHALL display viewport switching controls
2. WHEN a viewport is selected, THE System SHALL resize the preview iframe to that width
3. THE System SHALL provide at least 3 viewport presets: mobile (360px), tablet (768px), desktop (1280px)
4. WHEN switching viewports, THE System SHALL maintain the current editor state

### Requirement 7: Campos Dinâmicos e Customizados

**User Story:** As a user, I want rich field types for configuring blocks, so that I can customize them precisely.

#### Acceptance Criteria

1. THE System SHALL support text fields for string inputs
2. THE System SHALL support number fields for numeric inputs
3. THE System SHALL support select fields for predefined options
4. THE System SHALL support field-select fields that list database columns
5. THE System SHALL support boolean/checkbox fields
6. THE System SHALL support textarea fields for long text
7. THE System SHALL support color picker fields
8. WHEN a field value changes, THE System SHALL update the block preview immediately

### Requirement 8: Salvamento e Carregamento de Temas

**User Story:** As a user, I want to save and load my themes, so that I can persist my work.

#### Acceptance Criteria

1. WHEN the user clicks "Salvar Tema", THE System SHALL serialize the Puck data to ThemeSchema format
2. WHEN saving, THE System SHALL validate that the theme has a name
3. WHEN saving, THE System SHALL validate that the theme has at least one block
4. WHEN loading an existing theme, THE System SHALL deserialize ThemeSchema to Puck data format
5. WHEN the theme is saved successfully, THE System SHALL display a success notification
6. IF saving fails, THEN THE System SHALL display an error notification

### Requirement 9: Renderização de Temas Salvos

**User Story:** As a user, I want my saved themes to render correctly on the edit page, so that end users see the designed layout.

#### Acceptance Criteria

1. WHEN a theme is loaded for rendering, THE System SHALL use Puck's Render component
2. WHEN rendering, THE System SHALL pass the correct record data to each block
3. WHEN rendering, THE System SHALL handle missing or null field values gracefully
4. THE System SHALL support all block interactions (form inputs, buttons, etc.) in render mode

### Requirement 10: Compatibilidade com Temas Existentes

**User Story:** As a user, I want my existing themes to continue working, so that I don't lose my previous work.

#### Acceptance Criteria

1. WHEN loading a legacy theme, THE System SHALL detect the old format
2. WHEN a legacy theme is detected, THE System SHALL convert it to the new Puck format
3. WHEN converting, THE System SHALL preserve all block configurations
4. WHEN converting, THE System SHALL maintain the block order
5. IF conversion fails, THEN THE System SHALL display an error and allow manual editing
