# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o isolamento de branding por tenant no sistema multi-tenant. Atualmente, o sistema está carregando dados de branding da tabela global `branding_config` em vez de usar a tabela `tenant_branding` específica por tenant, causando vazamento de dados entre tenants.

## Glossary

- **Tenant**: Uma organização/empresa que utiliza o sistema de forma isolada
- **Tenant_Branding**: Configuração de marca específica de um tenant (logo, cores, nome)
- **Subdomain**: Identificador único do tenant na URL (ex: acmecorp.localhost)
- **Tenant_Context**: Informações do tenant extraídas do subdomínio da requisição
- **Branding_Service**: Serviço responsável por gerenciar configurações de branding

## Requirements

### Requirement 1: Isolamento de Branding por Tenant

**User Story:** Como um administrador de tenant, eu quero que as configurações de branding sejam isoladas por tenant, para que cada tenant veja apenas suas próprias configurações.

#### Acceptance Criteria

1. WHEN um usuário acessa uma rota de branding THEN o Sistema SHALL carregar o branding da tabela `tenant_branding` filtrado pelo `tenant_id` do contexto
2. WHEN um tenant admin atualiza configurações de branding THEN o Sistema SHALL salvar na tabela `tenant_branding` associada ao seu tenant
3. IF um tenant não possui registro em `tenant_branding` THEN o Sistema SHALL retornar valores padrão
4. WHEN um usuário de um tenant acessa o sistema THEN o Sistema SHALL exibir apenas o branding do seu próprio tenant

### Requirement 2: Contexto de Tenant nas Rotas de Branding

**User Story:** Como desenvolvedor, eu quero que as rotas de branding utilizem o contexto de tenant, para garantir isolamento de dados.

#### Acceptance Criteria

1. WHEN uma requisição chega nas rotas de branding THEN o Sistema SHALL extrair o `tenant_id` do contexto da requisição
2. IF o contexto de tenant não estiver disponível THEN o Sistema SHALL retornar erro 400 com mensagem apropriada
3. WHEN o branding é carregado THEN o Sistema SHALL usar o `tenant_id` como filtro obrigatório na query

### Requirement 3: Migração de Dados Legados

**User Story:** Como administrador do sistema, eu quero que dados existentes na tabela `branding_config` sejam migrados para `tenant_branding`, para manter consistência.

#### Acceptance Criteria

1. THE Sistema SHALL manter compatibilidade com a tabela `branding_config` para o tenant padrão
2. WHEN um tenant não possui branding configurado THEN o Sistema SHALL criar um registro padrão em `tenant_branding`

### Requirement 4: Rotas Públicas de Branding

**User Story:** Como visitante, eu quero ver o branding correto do tenant ao acessar a landing page, para ter uma experiência consistente.

#### Acceptance Criteria

1. WHEN um visitante acessa `/api/branding/public` THEN o Sistema SHALL retornar o branding do tenant baseado no subdomínio
2. WHEN um visitante acessa `/api/branding/landing-page` THEN o Sistema SHALL retornar o HTML customizado do tenant correto
3. IF nenhum subdomínio for detectado THEN o Sistema SHALL retornar o branding do tenant padrão

### Requirement 5: Validação de Acesso Cross-Tenant

**User Story:** Como administrador de segurança, eu quero que tentativas de acesso cross-tenant sejam bloqueadas, para proteger dados sensíveis.

#### Acceptance Criteria

1. WHEN um usuário tenta acessar branding de outro tenant THEN o Sistema SHALL retornar erro 403
2. WHEN uma tentativa de acesso cross-tenant é detectada THEN o Sistema SHALL registrar o evento no log de segurança
3. THE Sistema SHALL validar que o `tenant_id` da sessão corresponde ao `tenant_id` do contexto
