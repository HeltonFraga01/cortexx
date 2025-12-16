# Implementation Plan

- [x] 1. Criar estrutura base do sistema de validação
  - Criar diretório `server/validators/` para componentes de validação
  - Criar diretório `server/middleware/` para handlers de CORS e erro
  - Criar diretório `server/utils/` para cliente WuzAPI e logger
  - _Requirements: 1.1, 2.1, 3.1_

- [x] 2. Implementar cliente WuzAPI base
  - Criar `server/utils/wuzapiClient.js` com configuração de axios
  - Implementar timeout de 10 segundos e headers padrão
  - Configurar base URL da WuzAPI via variável de ambiente
  - _Requirements: 3.1, 3.4_

- [x] 3. Implementar SessionValidator para usuários comuns
  - Criar `server/validators/sessionValidator.js`
  - Implementar método `validateUserToken()` que chama `/session/status`
  - Tratar respostas 200 (válido) e 401 (inválido) da WuzAPI
  - Retornar dados estruturados de validação
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Implementar AdminValidator para tokens administrativos
  - Criar `server/validators/adminValidator.js`
  - Implementar método `validateAdminToken()` que chama `/admin/users`
  - Processar lista de usuários retornada pela WuzAPI
  - Validar permissões administrativas baseado na resposta
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Criar middleware de tratamento de erros
  - Criar `server/middleware/errorHandler.js`
  - Implementar mapeamento de erros da WuzAPI para códigos HTTP
  - Criar mensagens de erro user-friendly
  - Implementar logging de erros sem expor dados sensíveis
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 6. Implementar middleware CORS configurável
  - Criar `server/middleware/corsHandler.js`
  - Configurar origens permitidas por ambiente (dev/prod)
  - Implementar headers CORS apropriados
  - Suportar requisições OPTIONS para preflight
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Criar rotas de validação de sessão
  - Criar `server/routes/sessionRoutes.js`
  - Implementar rota `GET /api/session/status`
  - Integrar SessionValidator com tratamento de erros
  - Aplicar middleware CORS
  - _Requirements: 1.1, 1.4, 3.1_

- [x] 8. Criar rotas de validação administrativa
  - Criar `server/routes/adminRoutes.js`
  - Implementar rota `GET /api/admin/users`
  - Integrar AdminValidator com proxy de dados
  - Retornar dados da WuzAPI sem modificações
  - _Requirements: 2.1, 2.4, 2.5_

- [x] 9. Implementar sistema de logging estruturado
  - Criar `server/utils/logger.js`
  - Implementar logs de validação com timestamp e status
  - Mascarar tokens nos logs (apenas primeiros 8 caracteres)
  - Registrar tempo de resposta da WuzAPI
  - _Requirements: 3.5, 4.5_

- [x] 10. Integrar componentes no servidor principal
  - Atualizar `server/index.js` para usar novas rotas
  - Aplicar middlewares de CORS e erro globalmente
  - Configurar variáveis de ambiente necessárias
  - Remover implementações antigas de validação se existirem
  - _Requirements: 1.1, 2.1, 3.1, 5.1_

- [x] 11. Criar testes de integração
  - Criar testes para SessionValidator com tokens válidos/inválidos
  - Criar testes para AdminValidator com permissões corretas
  - Testar cenários de timeout e WuzAPI indisponível
  - Validar códigos de status HTTP retornados
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 12. Criar testes de CORS
  - Testar requisições OPTIONS para preflight
  - Validar headers CORS em diferentes ambientes
  - Testar origens permitidas e bloqueadas
  - Verificar configuração de credentials
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 13. Implementar testes de performance
  - Medir tempo de resposta das validações
  - Testar comportamento com timeout de 10 segundos
  - Validar logs de performance
  - Criar métricas de monitoramento
  - _Requirements: 3.4, 3.5_