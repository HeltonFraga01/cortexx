# Requirements Document

## Introduction

Este documento especifica os requisitos para modernização do Page Builder existente no WUZAPI Manager. O objetivo é transformar o Page Builder atual em uma ferramenta mais completa e moderna, com suporte a mais tipos de blocos, melhor renderização de imagens (especialmente no componente Avatar), e um canvas com opções avançadas de layout como colunas, ordenação e responsividade.

## Glossary

- **Page_Builder**: Sistema visual de construção de temas para páginas de edição de registros
- **Block**: Componente visual reutilizável que pode ser arrastado para o canvas
- **Canvas**: Área de trabalho onde os blocos são organizados para formar o layout da página
- **Block_Registry**: Registro singleton que gerencia todos os blocos disponíveis
- **Theme_Schema**: Estrutura JSON que define a configuração completa de um tema
- **Grid_Layout**: Sistema de layout baseado em colunas para organização de blocos
- **Container_Block**: Bloco especial que pode conter outros blocos dentro dele
- **Field_Binding**: Vinculação de um campo do banco de dados a um componente visual

## Requirements

### Requirement 1

**User Story:** As an admin, I want the Avatar block to properly render images from URL fields, so that I can display profile pictures and other images correctly.

#### Acceptance Criteria

1. WHEN an Avatar block has an imageField configured with a valid URL THEN the Page_Builder SHALL render the image from that URL in the avatar component
2. WHEN the imageField contains an empty or invalid URL THEN the Page_Builder SHALL display the fallback initials or default icon
3. WHEN the image URL fails to load THEN the Page_Builder SHALL gracefully fallback to initials without breaking the UI
4. WHEN previewing the theme THEN the Page_Builder SHALL fetch and display the actual image from the record data

### Requirement 2

**User Story:** As an admin, I want more block types available in the Page Builder, so that I can create richer and more diverse page layouts.

#### Acceptance Criteria

1. WHEN accessing the block library THEN the Page_Builder SHALL provide a Text/Paragraph block for displaying formatted text content
2. WHEN accessing the block library THEN the Page_Builder SHALL provide an Image block for displaying standalone images from URL fields
3. WHEN accessing the block library THEN the Page_Builder SHALL provide a Badge/Tag block for displaying status indicators and labels
4. WHEN accessing the block library THEN the Page_Builder SHALL provide a Stats/Metrics block for displaying numerical values with labels
5. WHEN accessing the block library THEN the Page_Builder SHALL provide a Link/Button block for navigation and external links
6. WHEN accessing the block library THEN the Page_Builder SHALL provide a Tabs block for organizing content in tabbed sections
7. WHEN accessing the block library THEN the Page_Builder SHALL provide a List block for displaying arrays of data

### Requirement 3

**User Story:** As an admin, I want a container/row block that supports multiple columns, so that I can create complex side-by-side layouts.

#### Acceptance Criteria

1. WHEN adding a Row/Container block THEN the Page_Builder SHALL allow configuration of 1 to 4 columns
2. WHEN configuring a Row block THEN the Page_Builder SHALL allow setting individual column widths as percentages or fractions
3. WHEN dropping blocks into a Row THEN the Page_Builder SHALL place them in the specified column
4. WHEN rendering a Row block THEN the Page_Builder SHALL display child blocks in their respective columns side by side
5. WHEN the viewport is mobile-sized THEN the Page_Builder SHALL stack columns vertically for responsive behavior

### Requirement 4

**User Story:** As an admin, I want to reorder blocks easily with visual feedback, so that I can organize my page layout intuitively.

#### Acceptance Criteria

1. WHEN dragging a block in the canvas THEN the Page_Builder SHALL display a clear visual indicator of the drop position
2. WHEN hovering over a valid drop zone THEN the Page_Builder SHALL highlight the target area with a distinct color
3. WHEN reordering blocks THEN the Page_Builder SHALL animate the transition smoothly
4. WHEN a block is selected THEN the Page_Builder SHALL provide up/down arrow buttons for keyboard-based reordering

### Requirement 5

**User Story:** As an admin, I want to duplicate and copy blocks, so that I can quickly create similar layouts without reconfiguring from scratch.

#### Acceptance Criteria

1. WHEN a block is selected THEN the Page_Builder SHALL display a duplicate button in the block toolbar
2. WHEN clicking duplicate THEN the Page_Builder SHALL create an identical copy of the block with a new unique ID
3. WHEN duplicating a container block THEN the Page_Builder SHALL also duplicate all child blocks within it

### Requirement 6

**User Story:** As an admin, I want to configure spacing and alignment options for blocks, so that I can fine-tune the visual appearance of my layouts.

#### Acceptance Criteria

1. WHEN editing block properties THEN the Page_Builder SHALL provide margin configuration options (top, bottom, left, right)
2. WHEN editing block properties THEN the Page_Builder SHALL provide padding configuration options
3. WHEN editing block properties THEN the Page_Builder SHALL provide horizontal alignment options (left, center, right, stretch)
4. WHEN editing block properties THEN the Page_Builder SHALL provide vertical alignment options for container children

### Requirement 7

**User Story:** As an admin, I want a live preview that accurately reflects the final rendered output, so that I can see exactly how my theme will look.

#### Acceptance Criteria

1. WHEN clicking the preview button THEN the Page_Builder SHALL display the theme with sample data from the connected database
2. WHEN the preview is open THEN the Page_Builder SHALL allow switching between desktop, tablet, and mobile viewport sizes
3. WHEN changes are made in the builder THEN the Page_Builder SHALL update the preview in real-time if the preview panel is open
4. WHEN the preview is open THEN the Page_Builder SHALL use the user authentication token to fetch real data from the connected database
5. WHEN fetching preview data THEN the Page_Builder SHALL allow selecting a specific record from the database to preview

### Requirement 8

**User Story:** As an admin, I want to undo and redo my changes, so that I can experiment with layouts without fear of losing previous work.

#### Acceptance Criteria

1. WHEN making changes to the canvas THEN the Page_Builder SHALL maintain a history of up to 50 previous states
2. WHEN clicking undo or pressing Ctrl+Z THEN the Page_Builder SHALL revert to the previous state
3. WHEN clicking redo or pressing Ctrl+Shift+Z THEN the Page_Builder SHALL restore the next state in history
4. WHEN the history is empty THEN the Page_Builder SHALL disable the undo button

### Requirement 9

**User Story:** As an admin, I want to save and load block templates, so that I can reuse common block configurations across different themes.

#### Acceptance Criteria

1. WHEN a block is selected THEN the Page_Builder SHALL provide a "Save as Template" option
2. WHEN saving a template THEN the Page_Builder SHALL prompt for a template name and store the block configuration
3. WHEN accessing the block library THEN the Page_Builder SHALL display saved templates in a separate "Templates" category
4. WHEN dragging a template to the canvas THEN the Page_Builder SHALL create a new block instance with the saved configuration

### Requirement 10

**User Story:** As an admin, I want conditional visibility for blocks, so that I can show or hide blocks based on field values.

#### Acceptance Criteria

1. WHEN editing block properties THEN the Page_Builder SHALL provide a visibility condition configuration
2. WHEN configuring visibility THEN the Page_Builder SHALL allow selecting a field and comparison operator (equals, not equals, contains, is empty)
3. WHEN rendering the theme THEN the Page_Builder SHALL evaluate visibility conditions and hide blocks that do not match
4. WHEN a block has a visibility condition THEN the Page_Builder SHALL display a visibility indicator icon in the canvas

