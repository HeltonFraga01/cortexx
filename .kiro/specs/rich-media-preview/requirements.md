# Requirements Document

## Introduction

Este documento especifica os requisitos para implementar Rich Media Preview no chat do WUZAPI Manager. O objetivo é buscar e exibir metadados reais (OpenGraph) de links compartilhados, incluindo imagem de preview, título e descrição do conteúdo, proporcionando uma experiência similar ao WhatsApp.

## Glossary

- **Chat_System**: O sistema de chat do WUZAPI Manager que exibe mensagens do WhatsApp
- **Link_Preview_Service**: Serviço backend que busca metadados OpenGraph de URLs
- **OpenGraph_Metadata**: Metadados padronizados (og:title, og:description, og:image) extraídos de páginas web
- **Preview_Card**: Componente visual que exibe o preview de um link com imagem, título e descrição
- **Platform_Detector**: Utilitário que identifica plataformas de redes sociais a partir de URLs

## Requirements

### Requirement 1

**User Story:** As a user, I want to see rich previews of shared links with images and descriptions, so that I can understand the content without opening the link.

#### Acceptance Criteria

1. WHEN a message contains a URL THEN the Chat_System SHALL fetch OpenGraph metadata from the Link_Preview_Service
2. WHEN OpenGraph metadata is available THEN the Preview_Card SHALL display the og:image as a thumbnail
3. WHEN OpenGraph metadata is available THEN the Preview_Card SHALL display the og:title as the preview title
4. WHEN OpenGraph metadata is available THEN the Preview_Card SHALL display the og:description truncated to 100 characters
5. WHEN the og:image is not available THEN the Preview_Card SHALL display the platform icon or favicon as fallback
6. WHEN the user clicks on the Preview_Card THEN the Chat_System SHALL open the URL in a new browser tab

### Requirement 2

**User Story:** As a user, I want link previews to load quickly without blocking the message display, so that I can read messages immediately.

#### Acceptance Criteria

1. WHEN a message with a URL is displayed THEN the Chat_System SHALL show the message text immediately without waiting for preview data
2. WHILE the Link_Preview_Service is fetching metadata THEN the Preview_Card SHALL display a loading skeleton
3. WHEN the Link_Preview_Service fails to fetch metadata THEN the Preview_Card SHALL display a minimal fallback with domain and platform icon
4. THE Link_Preview_Service SHALL respond within 5 seconds or return cached/fallback data

### Requirement 3

**User Story:** As a system administrator, I want link preview data to be cached, so that repeated requests for the same URL are fast and efficient.

#### Acceptance Criteria

1. WHEN the Link_Preview_Service fetches metadata for a URL THEN it SHALL cache the result for 24 hours
2. WHEN a cached preview exists for a URL THEN the Link_Preview_Service SHALL return the cached data without fetching again
3. WHEN cache storage exceeds 1000 entries THEN the Link_Preview_Service SHALL remove the oldest entries (LRU eviction)

### Requirement 4

**User Story:** As a developer, I want the Link_Preview_Service to handle various URL formats and edge cases, so that previews work reliably.

#### Acceptance Criteria

1. WHEN a URL redirects to another URL THEN the Link_Preview_Service SHALL follow up to 3 redirects and fetch metadata from the final URL
2. WHEN a URL returns non-HTML content THEN the Link_Preview_Service SHALL return minimal metadata with domain only
3. WHEN a URL is from a known social media platform THEN the Link_Preview_Service SHALL use the Platform_Detector to provide branded styling
4. WHEN parsing HTML for metadata THEN the Link_Preview_Service SHALL extract og:title, og:description, og:image, and fallback to title tag and meta description
5. WHEN the og:image URL is relative THEN the Link_Preview_Service SHALL resolve it to an absolute URL

### Requirement 5

**User Story:** As a user, I want social media previews to show platform-specific branding, so that I can quickly identify the content source.

#### Acceptance Criteria

1. WHEN a URL is from Instagram THEN the Preview_Card SHALL display the Instagram icon with brand color (#E4405F)
2. WHEN a URL is from YouTube THEN the Preview_Card SHALL display the YouTube icon with brand color (#FF0000)
3. WHEN a URL is from TikTok THEN the Preview_Card SHALL display the TikTok icon with brand color (#000000)
4. WHEN a URL is from Twitter/X THEN the Preview_Card SHALL display the X icon with brand color (#000000)
5. WHEN a URL is from Facebook THEN the Preview_Card SHALL display the Facebook icon with brand color (#1877F2)
6. WHEN a URL is from LinkedIn THEN the Preview_Card SHALL display the LinkedIn icon with brand color (#0A66C2)
7. WHEN a URL is from an unknown platform THEN the Preview_Card SHALL display a generic globe icon with the site favicon

