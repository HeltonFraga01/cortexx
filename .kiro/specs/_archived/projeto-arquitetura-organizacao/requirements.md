# Especificação de Arquitetura e Organização do Projeto WUZAPI Manager

## Introdução

O WUZAPI Manager é um sistema completo de gerenciamento para WhatsApp Business que atua como uma ponte entre a API WUZAPI, clientes e administradores. O sistema permite gerenciar instâncias WhatsApp, enviar mensagens, configurar webhooks, integrar com bancos de dados externos (NocoDB) e fornecer interfaces administrativas e de usuário distintas.

## Glossário

- **WUZAPI_Manager**: Sistema principal de gerenciamento WhatsApp Business
- **Admin_Dashboard**: Interface administrativa para gerenciar usuários e configurações
- **User_Dashboard**: Interface do usuário para envio de mensagens e configurações pessoais
- **Backend_API**: Servidor Node.js/Express que gerencia todas as operações
- **SQLite_Database**: Banco de dados embarcado para persistência local
- **WUZAPI_Service**: Serviço externo de WhatsApp Business API
- **NocoDB_Integration**: Integração com banco de dados visual
- **Webhook_System**: Sistema de eventos em tempo real
- **Docker_Swarm**: Orquestração de containers para deploy
- **Frontend_React**: Interface web construída em React/TypeScript

## Requisitos

### Requisito 1

**User Story:** Como um desenvolvedor, eu quero uma arquitetura bem organizada e documentada, para que eu possa facilmente entender, manter e expandir o sistema.

#### Acceptance Criteria

1. WHEN um desenvolvedor acessa o projeto, THE WUZAPI_Manager SHALL provide uma estrutura de diretórios clara e consistente
2. WHILE desenvolvendo novas funcionalidades, THE Backend_API SHALL follow padrões modulares com separação de responsabilidades
3. THE Frontend_React SHALL organize componentes por domínio (admin, user, ui, etc.)
4. THE WUZAPI_Manager SHALL maintain documentação atualizada da arquitetura
5. WHERE novas funcionalidades são adicionadas, THE WUZAPI_Manager SHALL follow os padrões estabelecidos

### Requisito 2

**User Story:** Como um desenvolvedor, eu quero um sistema de roteamento bem estruturado na API, para que eu possa facilmente localizar e implementar endpoints específicos.

#### Acceptance Criteria

1. THE Backend_API SHALL organize routes por domínio funcional (admin, session, branding, etc.)
2. WHEN implementando novos endpoints, THE Backend_API SHALL follow padrões RESTful consistentes
3. THE Backend_API SHALL provide middleware de validação e tratamento de erros padronizado
4. WHERE endpoints são criados, THE Backend_API SHALL include logging estruturado
5. THE Backend_API SHALL maintain separação clara entre rotas públicas e protegidas

### Requisito 3

**User Story:** Como um desenvolvedor, eu quero uma camada de dados bem estruturada, para que eu possa facilmente gerenciar persistência e integrações externas.

#### Acceptance Criteria

1. THE SQLite_Database SHALL provide uma camada de abstração clara para operações de dados
2. WHEN integrando com serviços externos, THE Backend_API SHALL use clients dedicados (WuzAPIClient, NocoDB)
3. THE Backend_API SHALL implement validação de dados consistente em todas as operações
4. WHERE dados são persistidos, THE SQLite_Database SHALL maintain integridade referencial
5. THE Backend_API SHALL provide métodos de backup e recuperação de dados

### Requisito 4

**User Story:** Como um desenvolvedor, eu quero componentes frontend reutilizáveis e bem organizados, para que eu possa construir interfaces consistentes rapidamente.

#### Acceptance Criteria

1. THE Frontend_React SHALL organize componentes em bibliotecas reutilizáveis (ui, ui-custom)
2. WHEN criando novas telas, THE Frontend_React SHALL use componentes base padronizados
3. THE Frontend_React SHALL implement contextos para gerenciamento de estado global
4. WHERE funcionalidades específicas são implementadas, THE Frontend_React SHALL group componentes por domínio
5. THE Frontend_React SHALL maintain tipagem TypeScript consistente

### Requisito 5

**User Story:** Como um desenvolvedor, eu quero um sistema de build e deploy padronizado, para que eu possa facilmente implantar e manter o sistema em produção.

#### Acceptance Criteria

1. THE WUZAPI_Manager SHALL provide configuração Docker Swarm para deploy em produção
2. WHEN fazendo deploy, THE Docker_Swarm SHALL ensure alta disponibilidade e persistência de dados
3. THE WUZAPI_Manager SHALL include scripts automatizados para build e deploy
4. WHERE configurações são necessárias, THE WUZAPI_Manager SHALL use variáveis de ambiente padronizadas
5. THE WUZAPI_Manager SHALL provide health checks e monitoramento integrado

### Requisito 6

**User Story:** Como um desenvolvedor, eu quero documentação clara de como implementar novas funcionalidades, para que eu possa seguir padrões consistentes e acelerar o desenvolvimento.

#### Acceptance Criteria

1. THE WUZAPI_Manager SHALL provide guias de implementação para cada camada (frontend, backend, database)
2. WHEN adicionando novos módulos, THE WUZAPI_Manager SHALL follow templates e padrões documentados
3. THE WUZAPI_Manager SHALL include exemplos de código para casos comuns
4. WHERE integrações externas são necessárias, THE WUZAPI_Manager SHALL provide guias específicos
5. THE WUZAPI_Manager SHALL maintain changelog e versionamento semântico