# Requirements Document

## Introduction

O sistema WUZAPI Manager precisa de um editor simples de HTML para a página inicial. O administrador deve poder colar um código HTML completo (gerado externamente) e esse HTML deve ser exibido na raiz do site (`/`). Não há necessidade de sanitização restritiva ou validações complexas - o admin confia em si mesmo.

## Glossary

- **System**: WUZAPI Manager - Sistema de gestão de dados e integrações WhatsApp
- **Admin**: Usuário com permissões administrativas que configura o HTML
- **Custom Home HTML**: Campo único de texto onde o admin cola o código HTML completo da página inicial
- **Root Route**: Rota `/` do sistema onde o HTML é exibido
- **Backend API**: API REST do servidor Express
- **Frontend**: Aplicação React

## Requirements

### Requirement 1

**User Story:** Como administrador, eu quero colar HTML completo da página inicial em um único campo, para que eu possa usar código gerado externamente

#### Acceptance Criteria

1. WHEN o administrador cola HTML no campo "HTML da Página Inicial" e clica em "Salvar", THE System SHALL persistir o HTML no banco de dados sem modificações restritivas
2. WHEN o salvamento é bem-sucedido, THE System SHALL exibir uma mensagem de confirmação
3. IF o salvamento falhar, THEN THE System SHALL exibir uma mensagem de erro
4. WHEN o administrador recarrega a página de configurações, THE System SHALL exibir o HTML previamente salvo
5. THE System SHALL permitir qualquer HTML válido, incluindo tags `<script>`, `<style>`, `<html>`, `<head>`, `<body>`

### Requirement 2

**User Story:** Como visitante, eu quero ver o HTML customizado ao acessar a raiz do site, para que eu veja a página configurada pelo admin

#### Acceptance Criteria

1. WHEN um visitante acessa a rota `/`, THE System SHALL verificar se existe HTML customizado
2. IF HTML customizado existe, THEN THE System SHALL retornar o HTML exatamente como foi salvo
3. IF HTML customizado não existe, THEN THE System SHALL exibir a página de login padrão (SPA React)
4. THE System SHALL servir o HTML com content-type `text/html`
5. WHEN o administrador atualiza o HTML customizado, THE System SHALL invalidar o cache imediatamente
6. WHEN um visitante acessa `/` após atualização, THE System SHALL exibir o novo HTML sem necessidade de aguardar expiração de cache

### Requirement 3

**User Story:** Como administrador, eu quero limpar o HTML customizado, para que o sistema volte a exibir a página padrão

#### Acceptance Criteria

1. WHEN o administrador clica no botão "Limpar", THE System SHALL exibir um diálogo de confirmação
2. IF o administrador confirma, THEN THE System SHALL remover o HTML customizado do banco de dados
3. THE System SHALL exibir uma mensagem de confirmação
4. WHEN visitantes acessam `/`, THE System SHALL exibir a página padrão novamente
