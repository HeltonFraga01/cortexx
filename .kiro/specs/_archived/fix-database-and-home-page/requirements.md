# Requirements Document

## Introduction

Este documento define os requisitos para corrigir dois problemas críticos no sistema WUZAPI Manager:
1. Erros de conexão e configuração do banco de dados SQLite
2. Página inicial customizada não sendo carregada como padrão para usuários

## Glossary

- **Sistema**: WUZAPI Manager - aplicação web para gerenciamento de conexões WhatsApp
- **Banco_SQLite**: Sistema de gerenciamento de banco de dados SQLite usado para armazenar configurações
- **Página_Home**: Página inicial exibida aos usuários após login
- **HTML_Customizado**: Conteúdo HTML personalizado armazenado na tabela branding_config
- **Usuário**: Pessoa autenticada que acessa o sistema
- **Administrador**: Usuário com permissões elevadas para configurar o sistema

## Requirements

### Requirement 1: Diagnóstico e Correção de Erros do Banco de Dados

**User Story:** Como administrador do sistema, eu quero que o banco de dados SQLite funcione corretamente, para que todas as funcionalidades do sistema operem sem erros.

#### Acceptance Criteria

1. WHEN o Sistema inicializa, THE Banco_SQLite SHALL verificar a integridade do arquivo de banco de dados
2. IF o arquivo do banco não existe, THEN THE Sistema SHALL criar o arquivo com as permissões corretas
3. WHEN ocorre um erro de conexão, THE Sistema SHALL registrar detalhes específicos do erro no log
4. THE Sistema SHALL validar que todas as tabelas necessárias existem durante a inicialização
5. WHEN a coluna custom_home_html não existe, THE Sistema SHALL executar a migration 003 automaticamente

### Requirement 2: Configuração da Página Home Padrão

**User Story:** Como usuário do sistema, eu quero ver a página inicial customizada configurada pelo administrador, para que eu tenha uma experiência personalizada ao acessar o sistema.

#### Acceptance Criteria

1. WHEN um Usuário acessa a rota raiz ("/"), THE Sistema SHALL verificar se existe HTML_Customizado configurado
2. IF HTML_Customizado existe na tabela branding_config, THEN THE Sistema SHALL renderizar este conteúdo
3. IF HTML_Customizado não existe, THEN THE Sistema SHALL renderizar o template padrão do sistema
4. THE Sistema SHALL aplicar as variáveis CSS do tema ao HTML_Customizado
5. WHEN o Administrador salva novo HTML_Customizado, THE Sistema SHALL validar e sanitizar o conteúdo antes de armazenar

### Requirement 3: Endpoint de Configuração de Branding

**User Story:** Como administrador, eu quero um endpoint API para recuperar e atualizar as configurações de branding incluindo HTML customizado, para que eu possa gerenciar a aparência do sistema.

#### Acceptance Criteria

1. THE Sistema SHALL fornecer endpoint GET /api/admin/branding para recuperar configurações
2. THE Sistema SHALL fornecer endpoint PUT /api/admin/branding para atualizar configurações
3. WHEN o Administrador envia HTML_Customizado, THE Sistema SHALL validar o tamanho máximo de 100KB
4. THE Sistema SHALL sanitizar HTML_Customizado removendo scripts e conteúdo perigoso
5. WHEN a atualização é bem-sucedida, THE Sistema SHALL retornar status 200 com os dados atualizados

### Requirement 4: Componente Frontend para Página Home

**User Story:** Como desenvolvedor frontend, eu quero um componente React que carregue e exiba o HTML customizado, para que os usuários vejam o conteúdo personalizado.

#### Acceptance Criteria

1. THE Sistema SHALL fornecer componente CustomHomePage que busca HTML_Customizado via API
2. WHEN HTML_Customizado está carregando, THE Sistema SHALL exibir indicador de carregamento
3. IF ocorre erro ao carregar, THE Sistema SHALL exibir mensagem de erro amigável
4. THE Sistema SHALL renderizar HTML_Customizado de forma segura usando dangerouslySetInnerHTML
5. THE Sistema SHALL aplicar estilos do tema ao conteúdo renderizado

### Requirement 5: Roteamento e Navegação

**User Story:** Como usuário, eu quero que a página inicial seja a primeira coisa que vejo após fazer login, para que eu tenha acesso imediato ao conteúdo personalizado.

#### Acceptance Criteria

1. WHEN Usuário acessa rota "/", THE Sistema SHALL exibir CustomHomePage
2. THE Sistema SHALL manter a navegação para outras rotas funcionando corretamente
3. WHEN Usuário não está autenticado, THE Sistema SHALL redirecionar para página de login
4. THE Sistema SHALL preservar o estado de autenticação durante navegação
5. WHEN Usuário faz logout, THE Sistema SHALL limpar cache e redirecionar para login
