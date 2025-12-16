# Requirements Document

## Introduction

Este documento especifica os requisitos para implementar um sistema de validação de usuários que verifica a existência e validade de tokens de usuários através da API externa WuzAPI (https://wzapi.wasend.com.br). O sistema deve garantir que apenas usuários válidos e autenticados na WuzAPI possam acessar o dashboard, sem armazenar dados sensíveis de usuários localmente.

## Glossary

- **WuzAPI**: API externa de WhatsApp localizada em https://wzapi.wasend.com.br que gerencia usuários e sessões
- **Dashboard**: Sistema local de gerenciamento que atua como proxy para a WuzAPI
- **Token**: Chave de autenticação única fornecida pela WuzAPI para identificar usuários
- **Proxy_Service**: Serviço intermediário que encaminha requisições entre o Dashboard e a WuzAPI
- **Session_Validator**: Componente responsável por validar tokens de usuários na WuzAPI
- **Admin_Token**: Token especial para operações administrativas na WuzAPI

## Requirements

### Requirement 1

**User Story:** Como um usuário do dashboard, eu quero que meu token seja validado automaticamente na WuzAPI, para que eu possa acessar apenas se for um usuário válido e autenticado.

#### Acceptance Criteria

1. WHEN um usuário fornece um token de acesso, THE Session_Validator SHALL fazer uma requisição para o endpoint `/session/status` da WuzAPI
2. WHEN a WuzAPI retorna status 200 com dados válidos, THE Dashboard SHALL permitir o acesso do usuário
3. IF a WuzAPI retorna status 401 ou erro de token inválido, THEN THE Dashboard SHALL negar o acesso e retornar mensagem de erro apropriada
4. THE Session_Validator SHALL incluir o token fornecido no header `Authorization` da requisição para a WuzAPI
5. THE Dashboard SHALL não armazenar dados de usuários localmente, apenas fazer proxy das informações da WuzAPI

### Requirement 2

**User Story:** Como um administrador do sistema, eu quero que o dashboard valide meu token administrativo na WuzAPI, para que eu possa acessar funcionalidades administrativas se tiver permissões válidas.

#### Acceptance Criteria

1. WHEN um administrador fornece um token administrativo, THE Proxy_Service SHALL fazer uma requisição para o endpoint `/admin/users` da WuzAPI
2. WHEN a WuzAPI retorna status 200 com lista de usuários, THE Dashboard SHALL permitir acesso administrativo
3. IF a WuzAPI retorna status 401 ou erro de autorização, THEN THE Dashboard SHALL negar o acesso administrativo
4. THE Proxy_Service SHALL incluir o token administrativo no header `Authorization` da requisição
5. THE Dashboard SHALL retornar os dados dos usuários recebidos da WuzAPI sem modificações

### Requirement 3

**User Story:** Como desenvolvedor do sistema, eu quero que todas as validações sejam feitas em tempo real na WuzAPI, para que o dashboard sempre tenha informações atualizadas e não dependa de dados locais desatualizados.

#### Acceptance Criteria

1. THE Proxy_Service SHALL fazer requisições HTTP para a WuzAPI a cada validação de token
2. THE Dashboard SHALL não implementar cache de validações de token
3. WHEN a WuzAPI está indisponível, THE Dashboard SHALL retornar erro de serviço indisponível
4. THE Proxy_Service SHALL configurar timeout de 10 segundos para requisições à WuzAPI
5. THE Dashboard SHALL registrar logs detalhados de todas as tentativas de validação

### Requirement 4

**User Story:** Como usuário do sistema, eu quero receber mensagens de erro claras quando meu token for inválido, para que eu possa entender o problema e tomar as ações necessárias.

#### Acceptance Criteria

1. WHEN um token é inválido, THE Dashboard SHALL retornar mensagem "Token inválido ou expirado"
2. WHEN a WuzAPI está indisponível, THE Dashboard SHALL retornar mensagem "Serviço de validação temporariamente indisponível"
3. WHEN um token não é fornecido, THE Dashboard SHALL retornar mensagem "Token de autorização necessário"
4. THE Dashboard SHALL retornar códigos de status HTTP apropriados (401, 500, 400)
5. THE Dashboard SHALL incluir detalhes técnicos nos logs mas não expor informações sensíveis ao usuário

### Requirement 5

**User Story:** Como administrador de sistema, eu quero que o dashboard implemente CORS adequadamente, para que aplicações frontend possam fazer requisições de diferentes origens de forma segura.

#### Acceptance Criteria

1. THE Proxy_Service SHALL configurar headers CORS para permitir requisições do frontend
2. THE Proxy_Service SHALL aceitar requisições OPTIONS para preflight CORS
3. THE Proxy_Service SHALL configurar headers `Access-Control-Allow-Origin`, `Access-Control-Allow-Methods` e `Access-Control-Allow-Headers`
4. THE Dashboard SHALL permitir requisições de `http://localhost:4173` e `http://localhost:3000` em desenvolvimento
5. THE Proxy_Service SHALL configurar CORS de forma restritiva em produção baseado na variável de ambiente