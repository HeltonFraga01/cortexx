# Requirements Document

## Introduction

O sistema atual de renderização de HTML personalizado não está carregando corretamente as bibliotecas externas (Tailwind CSS CDN, Lucide Icons, TAOS animations) necessárias para que páginas HTML complexas como o `homeCompativel.html` sejam renderizadas adequadamente. O HTML é inserido em um iframe com sandbox, mas as bibliotecas externas não são carregadas, resultando em uma página sem estilos e sem funcionalidades JavaScript.

Este documento define os requisitos para corrigir o sistema de renderização de HTML personalizado, garantindo que:
1. Bibliotecas externas CDN sejam carregadas corretamente
2. Scripts inline funcionem adequadamente
3. Estilos CSS (inline e externos) sejam aplicados
4. A página seja renderizada exatamente como o HTML original

## Glossary

- **CustomHtmlRenderer**: Componente React que renderiza HTML personalizado em um iframe
- **Sandbox**: Atributo do iframe que restringe permissões de segurança
- **CDN (Content Delivery Network)**: Rede de distribuição de conteúdo para bibliotecas JavaScript/CSS
- **Tailwind CSS**: Framework CSS utilitário carregado via CDN
- **Lucide Icons**: Biblioteca de ícones SVG
- **TAOS**: Biblioteca de animações on-scroll
- **BrandingConfig**: Configuração de branding que inclui o HTML personalizado
- **PublicHome**: Página pública que renderiza o HTML personalizado ou página de login

## Requirements

### Requirement 1: Renderização Completa de HTML

**User Story:** Como administrador, eu quero que o HTML personalizado seja renderizado exatamente como está no arquivo original, para que todas as funcionalidades e estilos funcionem corretamente.

#### Acceptance Criteria

1. WHEN THE System_CustomHtmlRenderer receives HTML with external CDN libraries, THE System_CustomHtmlRenderer SHALL load and execute all external scripts from CDN sources
2. WHEN THE System_CustomHtmlRenderer receives HTML with inline styles, THE System_CustomHtmlRenderer SHALL apply all inline CSS styles to the rendered page
3. WHEN THE System_CustomHtmlRenderer receives HTML with inline scripts, THE System_CustomHtmlRenderer SHALL execute all inline JavaScript code after the DOM is loaded
4. WHEN THE System_CustomHtmlRenderer receives HTML with external stylesheets, THE System_CustomHtmlRenderer SHALL load and apply all external CSS files
5. THE System_CustomHtmlRenderer SHALL preserve the complete HTML structure including DOCTYPE, html, head, and body tags

### Requirement 2: Configuração de Sandbox do Iframe

**User Story:** Como desenvolvedor, eu quero que o iframe tenha as permissões corretas de sandbox, para que scripts externos e inline possam ser executados mantendo a segurança.

#### Acceptance Criteria

1. THE System_CustomHtmlRenderer SHALL configure the iframe sandbox attribute to allow script execution
2. THE System_CustomHtmlRenderer SHALL configure the iframe sandbox attribute to allow same-origin access
3. THE System_CustomHtmlRenderer SHALL configure the iframe sandbox attribute to allow forms submission
4. THE System_CustomHtmlRenderer SHALL configure the iframe sandbox attribute to allow popups and modals
5. THE System_CustomHtmlRenderer SHALL configure the iframe sandbox attribute to allow top-level navigation by user activation

### Requirement 3: Carregamento de Bibliotecas Externas

**User Story:** Como administrador, eu quero que bibliotecas JavaScript externas (Tailwind CSS, Lucide Icons, TAOS) sejam carregadas corretamente, para que os componentes visuais e animações funcionem.

#### Acceptance Criteria

1. WHEN THE System_CustomHtmlRenderer loads HTML with Tailwind CSS CDN link, THE System_CustomHtmlRenderer SHALL ensure Tailwind CSS is fully loaded before rendering content
2. WHEN THE System_CustomHtmlRenderer loads HTML with Lucide Icons script, THE System_CustomHtmlRenderer SHALL ensure Lucide Icons library is available and icons are rendered
3. WHEN THE System_CustomHtmlRenderer loads HTML with TAOS animation library, THE System_CustomHtmlRenderer SHALL ensure TAOS is initialized and animations are triggered
4. WHEN THE System_CustomHtmlRenderer loads HTML with custom fonts from Google Fonts, THE System_CustomHtmlRenderer SHALL load and apply the custom fonts
5. THE System_CustomHtmlRenderer SHALL wait for all external resources to load before marking the page as ready

### Requirement 4: Execução de Scripts Inline

**User Story:** Como administrador, eu quero que scripts inline no HTML personalizado sejam executados corretamente, para que funcionalidades interativas (menu mobile, modais, animações) funcionem.

#### Acceptance Criteria

1. WHEN THE System_CustomHtmlRenderer loads HTML with window.onload scripts, THE System_CustomHtmlRenderer SHALL execute the window.onload function after all resources are loaded
2. WHEN THE System_CustomHtmlRenderer loads HTML with event listeners, THE System_CustomHtmlRenderer SHALL attach all event listeners to the correct DOM elements
3. WHEN THE System_CustomHtmlRenderer loads HTML with canvas animations, THE System_CustomHtmlRenderer SHALL initialize and run canvas animations
4. WHEN THE System_CustomHtmlRenderer loads HTML with form handlers, THE System_CustomHtmlRenderer SHALL enable form submission and validation
5. THE System_CustomHtmlRenderer SHALL execute scripts in the correct order to prevent dependency errors

### Requirement 5: Compatibilidade com HTML Complexo

**User Story:** Como administrador, eu quero que o sistema suporte HTML complexo com múltiplas seções, animações e interatividade, para que landing pages profissionais possam ser usadas.

#### Acceptance Criteria

1. WHEN THE System_CustomHtmlRenderer receives HTML with multiple sections and navigation, THE System_CustomHtmlRenderer SHALL render all sections with correct styling and layout
2. WHEN THE System_CustomHtmlRenderer receives HTML with scroll-triggered animations, THE System_CustomHtmlRenderer SHALL trigger animations when elements enter the viewport
3. WHEN THE System_CustomHtmlRenderer receives HTML with responsive design, THE System_CustomHtmlRenderer SHALL adapt the layout to different screen sizes
4. WHEN THE System_CustomHtmlRenderer receives HTML with interactive elements (buttons, forms, modals), THE System_CustomHtmlRenderer SHALL enable all interactive functionality
5. THE System_CustomHtmlRenderer SHALL maintain performance with large HTML files up to 1MB in size

### Requirement 6: Debugging e Diagnóstico

**User Story:** Como desenvolvedor, eu quero ter ferramentas de debugging para identificar problemas de renderização, para que eu possa corrigir erros rapidamente.

#### Acceptance Criteria

1. WHEN THE System_CustomHtmlRenderer fails to load an external resource, THE System_CustomHtmlRenderer SHALL log the error with the resource URL and error message
2. WHEN THE System_CustomHtmlRenderer encounters a JavaScript error, THE System_CustomHtmlRenderer SHALL log the error with stack trace and line number
3. WHEN THE System_CustomHtmlRenderer successfully loads the HTML, THE System_CustomHtmlRenderer SHALL log the loading time and resource count
4. THE System_CustomHtmlRenderer SHALL provide a console message indicating when all resources are loaded
5. THE System_CustomHtmlRenderer SHALL expose iframe console errors to the parent window for debugging

### Requirement 7: Fallback e Tratamento de Erros

**User Story:** Como usuário, eu quero que o sistema mostre uma mensagem clara se o HTML personalizado falhar ao carregar, para que eu saiba que há um problema.

#### Acceptance Criteria

1. IF THE System_CustomHtmlRenderer fails to load the HTML after 10 seconds, THEN THE System_CustomHtmlRenderer SHALL display an error message to the user
2. IF THE System_CustomHtmlRenderer encounters a critical JavaScript error, THEN THE System_CustomHtmlRenderer SHALL display a fallback message
3. WHEN THE System_CustomHtmlRenderer detects missing external resources, THE System_CustomHtmlRenderer SHALL log warnings but continue rendering
4. THE System_CustomHtmlRenderer SHALL provide a "Reload" button if rendering fails
5. IF THE System_CustomHtmlRenderer fails completely, THEN THE System_CustomHtmlRenderer SHALL fallback to the default login page
