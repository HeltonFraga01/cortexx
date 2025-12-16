# Documento de Requisitos

## Introdução

Esta especificação aborda vulnerabilidades críticas de segurança identificadas na auditoria de segurança do WUZAPI Manager datada de 16 de novembro de 2025. A auditoria revelou uma vulnerabilidade CRÍTICA onde o token de administrador está exposto no bundle do frontend, permitindo que qualquer atacante obtenha acesso administrativo completo ao sistema. Esta spec foca em implementar padrões de autenticação seguros para eliminar esta vulnerabilidade e fortalecer a postura geral de segurança.

## Glossário

- **Sistema_Autenticacao**: O mecanismo que verifica a identidade do usuário e gerencia credenciais de acesso
- **Gerenciador_Sessao**: Componente server-side que cria, valida e destrói sessões de usuário
- **Cookie_HTTP_Only**: Uma flag de cookie que previne acesso via JavaScript, protegendo contra ataques XSS
- **Token_Admin**: Uma credencial que concede privilégios administrativos completos ao sistema WUZAPI
- **Token_Usuario**: Uma credencial que concede acesso de nível de usuário ao sistema WUZAPI
- **WuzAPI**: Serviço externo de API do WhatsApp Business usado para validação de autenticação
- **Bundle_Frontend**: O código JavaScript compilado entregue ao navegador do cliente
- **Proxy_Backend**: Componente server-side que encaminha requisições para APIs externas sem expor credenciais

## Requisitos

### Requisito 1

**História de Usuário:** Como administrador de segurança, eu quero que as credenciais de admin nunca sejam expostas no código do frontend, para que atacantes não possam obter acesso administrativo não autorizado ao inspecionar o bundle client-side.

#### Critérios de Aceitação

1. QUANDO O Sistema_Autenticacao inicializa, O Bundle_Frontend NÃO DEVE conter nenhum token de admin ou credenciais
2. QUANDO um usuário tenta acessar funcionalidade administrativa, O Sistema_Autenticacao DEVE validar credenciais através de verificação de sessão server-side apenas
3. QUANDO o bundle do frontend é inspecionado, O Sistema_Autenticacao DEVE garantir que nenhuma variável de ambiente contendo credenciais sensíveis esteja acessível
4. ONDE operações administrativas são necessárias, O Proxy_Backend DEVE usar credenciais armazenadas no servidor para comunicar com APIs externas
5. QUANDO um admin faz login, O Gerenciador_Sessao DEVE criar um cookie de sessão HTTP-only que armazena o role de admin sem expor tokens

### Requisito 2

**História de Usuário:** Como administrador de sistema, eu quero que toda autenticação use padrões seguros baseados em sessão, para que as credenciais dos usuários sejam protegidas e não possam ser interceptadas ou manipuladas por atacantes.

#### Critérios de Aceitação

1. QUANDO um usuário submete credenciais de login, O Sistema_Autenticacao DEVE validá-las contra o serviço WuzAPI
2. SE as credenciais são válidas, ENTÃO O Gerenciador_Sessao DEVE criar uma sessão server-side com um cookie HTTP-only
3. QUANDO uma sessão é criada, O Gerenciador_Sessao DEVE armazenar o role do usuário e token de forma segura no servidor
4. ENQUANTO uma sessão está ativa, O Sistema_Autenticacao DEVE validar cada requisição usando o cookie de sessão
5. QUANDO uma sessão expira ou o usuário faz logout, O Gerenciador_Sessao DEVE destruir a sessão e limpar o cookie

### Requisito 3

**História de Usuário:** Como desenvolvedor, eu quero que todas as chamadas de API externas sejam proxiadas através do backend, para que URLs de API e credenciais nunca sejam expostas no código do frontend.

#### Critérios de Aceitação

1. QUANDO o frontend precisa chamar a WuzAPI, O Proxy_Backend DEVE receber a requisição e encaminhá-la com credenciais server-side
2. O Bundle_Frontend NÃO DEVE conter nenhuma URL de API externa ou base URLs
3. QUANDO o Proxy_Backend encaminha uma requisição, O Proxy_Backend DEVE usar o token do usuário autenticado da sessão server-side
4. SE o serviço WuzAPI está indisponível, ENTÃO O Proxy_Backend DEVE retornar um erro 503 sem expor detalhes internos
5. QUANDO proxiando requisições, O Proxy_Backend DEVE validar que o usuário requisitante tem permissão para a operação

### Requisito 4

**História de Usuário:** Como administrador de segurança, eu quero que o sistema remova fallbacks de autenticação inseguros, para que falhas de autenticação sejam tratadas de forma segura sem aceitar tokens arbitrários.

#### Critérios de Aceitação

1. QUANDO a autenticação WuzAPI falha, O Sistema_Autenticacao DEVE retornar um erro de autenticação
2. O Sistema_Autenticacao NÃO DEVE aceitar strings arbitrárias como identificadores de usuário válidos
3. QUANDO a WuzAPI está indisponível, O Sistema_Autenticacao DEVE retornar um erro 503 de serviço indisponível
4. ONDE cache de autenticação é implementado, O Sistema_Autenticacao DEVE cachear apenas sessões de usuário validadas com tempo de vida máximo de 5 minutos
5. QUANDO uma sessão cacheada expira, O Sistema_Autenticacao DEVE re-validar credenciais com a WuzAPI antes de permitir acesso

### Requisito 5

**História de Usuário:** Como administrador de sistema, eu quero logging de segurança abrangente para todas as tentativas de autenticação, para que eu possa detectar e responder a potenciais ameaças de segurança.

#### Critérios de Aceitação

1. QUANDO um usuário tenta fazer login, O Sistema_Autenticacao DEVE registrar a tentativa com timestamp, endereço IP e nome de usuário
2. SE uma tentativa de login falha, ENTÃO O Sistema_Autenticacao DEVE registrar a falha com motivo e IP de origem
3. QUANDO um endpoint admin é acessado, O Sistema_Autenticacao DEVE registrar a tentativa de acesso com identidade do usuário e recurso solicitado
4. ENQUANTO monitorando logs de segurança, O Sistema_Autenticacao DEVE fornecer entradas de log estruturadas que incluem níveis de severidade
5. QUANDO atividade suspeita é detectada, O Sistema_Autenticacao DEVE registrar contexto detalhado para análise de segurança

### Requisito 6

**História de Usuário:** Como administrador de sistema, eu quero rate limiting em endpoints de autenticação, para que ataques de força bruta sejam prevenidos e o sistema permaneça disponível para usuários legítimos.

#### Critérios de Aceitação

1. QUANDO um cliente faz requisições de login, O Sistema_Autenticacao DEVE limitar tentativas a 5 por janela de 15 minutos por endereço IP
2. SE o limite de taxa é excedido, ENTÃO O Sistema_Autenticacao DEVE retornar um erro 429 com informação de retry-after
3. QUANDO rate limiting está ativo, O Sistema_Autenticacao DEVE permitir que usuários legítimos tentem novamente após a janela expirar
4. ONDE endpoints de API são expostos, O Sistema_Autenticacao DEVE aplicar um limite geral de taxa de 100 requisições por minuto por IP
5. QUANDO limites de taxa são configurados, O Sistema_Autenticacao DEVE armazenar estado de rate limit em um armazenamento persistente que sobrevive a reinicializações do servidor

### Requisito 7

**História de Usuário:** Como desenvolvedor, eu quero proteção CSRF em todas as operações que alteram estado, para que atacantes não possam enganar usuários autenticados a realizar ações indesejadas.

#### Critérios de Aceitação

1. QUANDO uma sessão é criada, O Sistema_Autenticacao DEVE gerar um token CSRF único
2. QUANDO o frontend faz uma requisição que altera estado, O Sistema_Autenticacao DEVE requerer um token CSRF válido nos headers da requisição
3. SE um token CSRF está faltando ou é inválido, ENTÃO O Sistema_Autenticacao DEVE rejeitar a requisição com um erro 403
4. ONDE tokens CSRF são usados, O Sistema_Autenticacao DEVE rotacionar tokens após cada operação bem-sucedida que altera estado
5. QUANDO um token CSRF é validado, O Sistema_Autenticacao DEVE garantir que ele corresponde à sessão atual

### Requisito 8

**História de Usuário:** Como administrador de segurança, eu quero que todo o código de autenticação do frontend seja refatorado para usar padrões baseados em sessão, para que nenhum componente tente usar credenciais expostas.

#### Critérios de Aceitação

1. O Bundle_Frontend DEVE remover todas as referências a VITE_ADMIN_TOKEN do código fonte
2. O Bundle_Frontend DEVE remover todas as referências a VITE_WUZAPI_BASE_URL do código fonte
3. QUANDO componentes precisam de autenticação, O Bundle_Frontend DEVE usar chamadas de API baseadas em sessão com credentials: 'include'
4. ONDE funcionalidade administrativa é necessária, O Bundle_Frontend DEVE chamar endpoints do backend que validam sessões de admin
5. QUANDO fazendo chamadas de API, O Bundle_Frontend DEVE usar URLs relativas que são proxiadas através do backend
