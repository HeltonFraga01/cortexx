# Requirements Document - Sistema de Branding Consolidado

## Introduction

Este documento consolida todos os requisitos relacionados ao sistema de branding do WUZAPI Manager, incluindo white label, cores dinâmicas, nome da aplicação e editor de página inicial customizada.

## Glossary

- **Sistema**: WUZAPI Manager - plataforma de gerenciamento WhatsApp Business
- **Branding**: Conjunto de configurações visuais e de identidade da aplicação
- **Administrador**: Usuário com permissões para configurar o branding
- **White_Label**: Capacidade de personalizar completamente a identidade visual
- **Tema**: Conjunto de cores e estilos aplicados à interface

## Requirements

### Requirement 1: Configuração de Identidade da Aplicação

**User Story:** Como administrador, eu quero configurar o nome e logo da aplicação, para que a plataforma reflita a identidade da minha empresa.

#### Acceptance Criteria

1. THE Sistema SHALL permitir configuração de nome customizado da aplicação
2. THE Sistema SHALL permitir upload de logo customizado
3. WHEN o Administrador atualiza o nome, THE Sistema SHALL aplicar mudanças em toda interface
4. THE Sistema SHALL validar formato e tamanho do logo (máximo 2MB, formatos: PNG, JPG, SVG)
5. THE Sistema SHALL manter valores padrão "WUZAPI" quando não configurado

### Requirement 2: Sistema de Cores Dinâmicas

**User Story:** Como administrador, eu quero configurar cores primárias e secundárias, para que a interface combine com a identidade visual da minha marca.

#### Acceptance Criteria

1. THE Sistema SHALL permitir configuração de cor primária (tema dark)
2. THE Sistema SHALL permitir configuração de cor secundária (tema light)
3. THE Sistema SHALL calcular cores de contraste automaticamente para acessibilidade
4. THE Sistema SHALL validar contraste WCAG AA (mínimo 4.5:1)
5. WHEN cores são alteradas, THE Sistema SHALL aplicar mudanças imediatamente sem reload

### Requirement 3: Editor de Página Inicial Customizada

**User Story:** Como administrador, eu quero criar uma página inicial customizada com HTML, para que usuários vejam conteúdo personalizado ao acessar o sistema.

#### Acceptance Criteria

1. THE Sistema SHALL fornecer editor de HTML para página inicial
2. THE Sistema SHALL permitir HTML completo incluindo scripts e estilos
3. THE Sistema SHALL validar tamanho máximo de 1MB para HTML customizado
4. THE Sistema SHALL fornecer preview do HTML antes de salvar
5. WHEN HTML customizado existe, THE Sistema SHALL renderizar na rota raiz "/"

### Requirement 4: Persistência e Carregamento

**User Story:** Como usuário, eu quero que as configurações de branding sejam carregadas automaticamente, para que eu sempre veja a interface personalizada.

#### Acceptance Criteria

1. THE Sistema SHALL armazenar configurações de branding no banco de dados
2. THE Sistema SHALL carregar branding na inicialização da aplicação
3. THE Sistema SHALL aplicar cache de branding para performance
4. THE Sistema SHALL fornecer fallback para valores padrão em caso de erro
5. WHEN configurações mudam, THE Sistema SHALL invalidar cache automaticamente

### Requirement 5: Meta Tags e SEO

**User Story:** Como administrador, eu quero que links compartilhados mostrem o nome customizado, para que a identidade da marca seja consistente em todas plataformas.

#### Acceptance Criteria

1. THE Sistema SHALL atualizar meta tags Open Graph com nome customizado
2. THE Sistema SHALL atualizar meta tags Twitter Card com nome customizado
3. THE Sistema SHALL atualizar document.title dinamicamente
4. THE Sistema SHALL manter meta tags sincronizadas com configurações
5. THE Sistema SHALL fornecer meta tags padrão quando branding não configurado

### Requirement 6: Segurança e Validação

**User Story:** Como administrador, eu quero que o sistema valide minhas configurações, para que eu não configure valores que quebrem a aplicação.

#### Acceptance Criteria

1. THE Sistema SHALL validar formato hexadecimal de cores
2. THE Sistema SHALL sanitizar HTML customizado para prevenir XSS (opcional)
3. THE Sistema SHALL validar tamanho de arquivos de logo
4. THE Sistema SHALL validar comprimento de nome da aplicação (máximo 50 caracteres)
5. THE Sistema SHALL fornecer mensagens de erro claras para validações

### Requirement 7: API de Branding

**User Story:** Como desenvolvedor, eu quero endpoints de API para gerenciar branding, para que eu possa integrar com outras ferramentas.

#### Acceptance Criteria

1. THE Sistema SHALL fornecer endpoint GET /api/admin/branding
2. THE Sistema SHALL fornecer endpoint PUT /api/admin/branding
3. THE Sistema SHALL requerer autenticação admin para endpoints de branding
4. THE Sistema SHALL retornar configurações completas no GET
5. THE Sistema SHALL validar payload no PUT antes de persistir

## Status de Implementação

✅ **Completo:** Todos os requisitos foram implementados nas specs arquivadas:
- `white-label-branding`
- `dynamic-app-name-branding`
- `dynamic-theme-colors`
- `custom-home-page-editor`
- `fix-custom-home-page-editor`

## Referências

- Specs arquivadas em `.kiro/specs/_archived/`
- Código implementado em:
  - Backend: `server/routes/brandingRoutes.js`
  - Frontend: `src/contexts/BrandingContext.tsx`
  - Serviços: `src/services/branding.ts`, `src/services/themeColorManager.ts`
  - Componentes: `src/components/admin/BrandingSettings.tsx`
