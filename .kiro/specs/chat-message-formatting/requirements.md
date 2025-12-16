# Requirements Document

## Introduction

Este documento especifica os requisitos para modernizar a formatação de mensagens no chat do WUZAPI Manager. O objetivo é renderizar mensagens do WhatsApp com formatação rica (negrito, itálico, tachado, código), melhorar a exibição de captions em mídias, e aprimorar os link previews para redes sociais.

## Glossary

- **Chat_System**: O sistema de chat do WUZAPI Manager que exibe mensagens do WhatsApp
- **WhatsApp_Formatting**: Sintaxe de formatação usada pelo WhatsApp (`*negrito*`, `_itálico_`, `~tachado~`, ` ```código``` `)
- **Caption**: Texto que acompanha uma mídia (imagem, vídeo, documento)
- **Link_Preview**: Visualização prévia de um link com título, descrição e imagem
- **Rich_Media_Preview**: Preview aprimorado para redes sociais com embed de conteúdo
- **Message_Parser**: Componente que converte texto com formatação WhatsApp em HTML/React

## Requirements

### Requirement 1

**User Story:** As a user, I want to see WhatsApp text formatting (bold, italic, strikethrough, monospace) rendered correctly in the chat, so that messages appear as they do in WhatsApp.

#### Acceptance Criteria

1. WHEN a message contains text wrapped in asterisks (`*text*`) THEN the Chat_System SHALL render the text in bold style
2. WHEN a message contains text wrapped in underscores (`_text_`) THEN the Chat_System SHALL render the text in italic style
3. WHEN a message contains text wrapped in tildes (`~text~`) THEN the Chat_System SHALL render the text with strikethrough style
4. WHEN a message contains text wrapped in triple backticks (` ```text``` `) THEN the Chat_System SHALL render the text in monospace font
5. WHEN a message contains nested formatting (e.g., `*_bold italic_*`) THEN the Chat_System SHALL apply all applicable styles
6. WHEN formatting markers appear without matching pairs THEN the Chat_System SHALL display the markers as plain text

### Requirement 2

**User Story:** As a user, I want to see message captions with proper line breaks, so that multi-line captions are readable.

#### Acceptance Criteria

1. WHEN a media message contains a caption with newline characters THEN the Chat_System SHALL preserve and render all line breaks
2. WHEN a caption contains WhatsApp formatting THEN the Chat_System SHALL apply the formatting rules from Requirement 1
3. WHEN a caption exceeds the media width THEN the Chat_System SHALL wrap text appropriately without truncation

### Requirement 3

**User Story:** As a user, I want to see enhanced link previews for social media URLs, so that I can preview content without leaving the chat.

#### Acceptance Criteria

1. WHEN a message contains a URL from Instagram, YouTube, TikTok, Twitter/X, Facebook, or LinkedIn THEN the Chat_System SHALL display a branded preview card with the platform icon
2. WHEN a link preview is displayed THEN the Chat_System SHALL show the domain name, title, and a clickable link
3. WHEN the user clicks on a link preview THEN the Chat_System SHALL open the URL in a new browser tab
4. WHEN a URL cannot be previewed THEN the Chat_System SHALL display the URL as a clickable link without blocking the message display

### Requirement 4

**User Story:** As a user, I want emoji characters to display correctly in messages, so that the chat experience matches WhatsApp.

#### Acceptance Criteria

1. WHEN a message contains emoji characters THEN the Chat_System SHALL render them using native system emoji or a consistent emoji font
2. WHEN emojis appear alongside formatted text THEN the Chat_System SHALL preserve both the emoji and the text formatting

### Requirement 5

**User Story:** As a developer, I want a reusable message formatting utility, so that formatting logic is consistent across the application.

#### Acceptance Criteria

1. THE Chat_System SHALL provide a Message_Parser utility that converts WhatsApp formatting syntax to React components
2. THE Message_Parser SHALL be a pure function that accepts a string and returns formatted React nodes
3. THE Message_Parser SHALL handle edge cases including empty strings, strings with only whitespace, and strings with unmatched formatting markers
4. WHEN the Message_Parser processes text THEN it SHALL sanitize HTML to prevent XSS attacks
