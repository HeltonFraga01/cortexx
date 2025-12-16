# Requirements Document - Release v1.5.1

## Introduction

Preparar e publicar a versão v1.5.1 do WUZAPI Manager no Docker Hub, incluindo atualização de versões, criação de release notes, build multi-arquitetura e publicação da imagem Docker com as tags apropriadas.

## Glossary

- **WUZAPI Manager**: Sistema de gerenciamento da API WhatsApp Business
- **Docker Hub**: Registry público para imagens Docker
- **Multi-arch Build**: Build de imagem Docker para múltiplas arquiteturas (amd64, arm64)
- **Tag**: Identificador de versão da imagem Docker
- **Release Notes**: Documento descrevendo mudanças da versão

## Requirements

### Requirement 1

**User Story:** Como desenvolvedor, eu quero atualizar os arquivos de versão para v1.5.1, para que a aplicação reflita a versão correta

#### Acceptance Criteria

1. WHEN o processo de release é iniciado, THE System SHALL atualizar o campo version em package.json para "1.5.1"
2. WHEN o processo de release é iniciado, THE System SHALL atualizar o campo version em server/package.json para "1.5.1"
3. THE System SHALL verificar que ambos os arquivos package.json contêm a mesma versão

### Requirement 2

**User Story:** Como desenvolvedor, eu quero criar release notes documentando as mudanças da v1.5.1, para que usuários e desenvolvedores entendam o que foi alterado

#### Acceptance Criteria

1. THE System SHALL criar um arquivo docs/releases/RELEASE_NOTES_v1.5.1.md
2. THE Release Notes SHALL incluir seção de mudanças principais (correções de autenticação Docker)
3. THE Release Notes SHALL incluir seção de melhorias técnicas (validação de ambiente, logging, health checks)
4. THE Release Notes SHALL incluir seção de documentação criada
5. THE Release Notes SHALL seguir o formato estabelecido em releases anteriores

### Requirement 3

**User Story:** Como desenvolvedor, eu quero criar um guia de deploy para v1.5.1, para que o processo de publicação seja documentado e reproduzível

#### Acceptance Criteria

1. THE System SHALL criar um arquivo DEPLOY_v1.5.1.md na raiz do projeto
2. THE Deploy Guide SHALL incluir checklist de pré-requisitos
3. THE Deploy Guide SHALL incluir comandos para build multi-arquitetura
4. THE Deploy Guide SHALL incluir comandos para push no Docker Hub
5. THE Deploy Guide SHALL incluir comandos de verificação pós-deploy
6. THE Deploy Guide SHALL seguir o formato estabelecido em DEPLOY_v1.4.9.md

### Requirement 4

**User Story:** Como desenvolvedor, eu quero fazer build da imagem Docker multi-arquitetura, para que a aplicação rode em diferentes plataformas

#### Acceptance Criteria

1. THE System SHALL executar build para plataforma linux/amd64
2. THE System SHALL executar build para plataforma linux/arm64
3. THE System SHALL criar tag heltonfraga/wuzapi-manager:v1.5.1
4. THE System SHALL criar tag heltonfraga/wuzapi-manager:latest
5. THE System SHALL usar BuildKit para otimização de cache

### Requirement 5

**User Story:** Como desenvolvedor, eu quero publicar a imagem no Docker Hub, para que usuários possam fazer pull da nova versão

#### Acceptance Criteria

1. WHEN o build é concluído com sucesso, THE System SHALL fazer push da tag v1.5.1 para Docker Hub
2. WHEN o build é concluído com sucesso, THE System SHALL fazer push da tag latest para Docker Hub
3. THE System SHALL verificar autenticação no Docker Hub antes do push
4. THE System SHALL confirmar que as imagens estão disponíveis no registry após o push

### Requirement 6

**User Story:** Como desenvolvedor, eu quero verificar que a imagem publicada funciona corretamente, para garantir qualidade do release

#### Acceptance Criteria

1. WHEN a imagem é publicada, THE System SHALL fazer pull da imagem do Docker Hub
2. WHEN a imagem é baixada, THE System SHALL executar container de teste
3. WHEN o container está rodando, THE System SHALL verificar health check
4. THE System SHALL confirmar que a versão reportada é 1.5.1
5. THE System SHALL limpar recursos de teste após verificação
