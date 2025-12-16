# Plano de Implementação

- [x] 1. Configurar sistema de sessão e autenticação
  - Instalar dependências necessárias (express-session, connect-sqlite3, csurf, express-rate-limit, helmet)
  - Criar configuração de sessão em `server/middleware/session.js`
  - Criar middlewares de autenticação em `server/middleware/auth.js` (requireAuth, requireAdmin)
  - Criar migração para tabela de sessões em `server/migrations/004_create_sessions_table.js`
  - Gerar SESSION_SECRET e adicionar ao .env
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Implementar rotas de autenticação
  - Criar `server/routes/authRoutes.js` com endpoints de login, logout e status
  - Implementar validação de token admin via WuzAPI no login
  - Implementar validação de token user via WuzAPI no login
  - Criar sessão HTTP-only com role e token armazenados no servidor
  - Implementar destruição de sessão no logout
  - _Requisitos: 2.1, 2.2, 2.3, 2.5_

- [x] 3. Criar serviço de proxy WuzAPI
  - Criar `server/services/WuzAPIProxyService.js` com métodos proxyUserRequest e proxyAdminRequest
  - Implementar proxy que usa token da sessão para requisições de usuário
  - Implementar proxy que usa token admin do .env para requisições admin
  - Adicionar tratamento de erros e logging
  - Criar `server/routes/wuzapiProxyRoutes.js` com rotas /api/wuzapi/user/* e /api/wuzapi/admin/*
  - _Requisitos: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Remover fallback inseguro de autenticação
  - Modificar `server/database.js` método validateUserAndGetId()
  - Remover fallback que aceita token como userId direto
  - Implementar cache de sessões validadas com TTL de 5 minutos
  - Retornar erro 503 quando WuzAPI está indisponível
  - Adicionar re-validação de sessões cacheadas expiradas
  - _Requisitos: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Implementar rate limiting
  - Criar `server/middleware/rateLimiter.js` com três limiters
  - Configurar loginLimiter (5 tentativas por 15 minutos)
  - Configurar apiLimiter (100 requisições por minuto)
  - Configurar adminLimiter (50 requisições por minuto)
  - Adicionar handlers de erro com logging de segurança
  - _Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5_

ao 
  - Criar `server/middleware/csrf.js` com configuração CSRF
  - Implementar endpoint GET /api/auth/csrf-token
  - Criar error handler para erros CSRF
  - Adicionar logging de falhas de validação CSRF
  - Configurar CSRF para usar sessão ao invés de cookies
  - _Requisitos: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 7. Implementar logging de segurança
  - Criar `server/utils/securityLogger.js` com métodos especializados
  - Implementar logLoginAttempt para tentativas de login
  - Implementar logAdminAccess para acessos a endpoints admin
  - Implementar logUnauthorizedAccess para tentativas não autorizadas
  - Implementar logSuspiciousActivity para atividades suspeitas
  - Criar `server/middleware/securityLogging.js` com middlewares de logging
  - _Requisitos: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 8. Atualizar rotas existentes com middlewares de segurança
  - Adicionar requireAdmin a todas as rotas em `server/routes/adminRoutes.js`
  - Adicionar requireAuth a todas as rotas em `server/routes/userRoutes.js`
  - Remover validação de token inline das rotas (usar sessão)
  - Atualizar rotas para usar req.session.userToken ao invés de req.headers
  - Adicionar logging de segurança em rotas críticas
  - _Requisitos: 1.2, 2.4_

- [x] 9. Atualizar configuração do Express
  - Modificar `server/index.js` para incluir todos os middlewares de segurança
  - Adicionar helmet para security headers
  - Configurar CORS com credentials: true
  - Adicionar express-session antes de CSRF
  - Aplicar rate limiters nas rotas corretas
  - Adicionar error handlers de segurança
  - _Requisitos: 2.1, 2.2, 6.1, 7.1_

- [x] 10. Refatorar AuthContext do frontend
  - Modificar `src/contexts/AuthContext.tsx` para remover VITE_ADMIN_TOKEN
  - Implementar método login que chama /api/auth/login
  - Implementar método logout que chama /api/auth/logout
  - Implementar método checkAuth que chama /api/auth/status
  - Usar credentials: 'include' em todas as chamadas fetch
  - Remover armazenamento de tokens no estado do frontend
  - _Requisitos: 8.1, 8.3, 8.4_

- [x] 11. Refatorar API Client do frontend
  - Modificar `src/lib/api.ts` para usar URLs relativas
  - Adicionar credentials: 'include' em todas as requisições
  - Remover VITE_API_BASE_URL e usar '/api' diretamente
  - Implementar tratamento de erros 401 e 403
  - Adicionar suporte para CSRF token nos headers
  - _Requisitos: 8.3, 8.5_

- [x] 12. Refatorar serviços do frontend
  - Modificar `src/services/wuzapi.ts` para usar proxy do backend
  - Modificar `src/services/branding.ts` para usar proxy do backend
  - Modificar `src/services/table-permissions.ts` para usar proxy do backend
  - Remover todas as referências a VITE_ADMIN_TOKEN
  - Remover todas as referências a VITE_WUZAPI_BASE_URL
  - Atualizar chamadas para usar endpoints /api/wuzapi/*
  - _Requisitos: 8.1, 8.2, 8.5_

- [x] 13. Refatorar componentes admin do frontend
  - Modificar `src/components/admin/AdminOverview.tsx` para remover token
  - Modificar `src/components/admin/CustomLinksManager.tsx` para remover token
  - Modificar `src/components/admin/AdminSettings.tsx` para remover token
  - Modificar `src/components/admin/LandingPageEditor.tsx` para remover token
  - Atualizar todos os componentes para usar serviços refatorados
  - _Requisitos: 8.1, 8.4_

- [x] 14. Atualizar página de login
  - Modificar `src/pages/LoginPage.tsx` para usar novo fluxo de autenticação
  - Implementar formulário que envia token e role para /api/auth/login
  - Adicionar tratamento de erros de autenticação
  - Implementar redirecionamento após login bem-sucedido
  - Remover qualquer referência a tokens no código
  - _Requisitos: 2.1, 8.3_

- [x] 15. Limpar variáveis de ambiente
  - Remover VITE_ADMIN_TOKEN do arquivo .env
  - Remover VITE_WUZAPI_BASE_URL do arquivo .env
  - Verificar que WUZAPI_ADMIN_TOKEN está apenas em server/.env
  - Adicionar SESSION_SECRET ao server/.env
  - Atualizar documentação de variáveis de ambiente
  - _Requisitos: 1.1, 1.3, 8.1, 8.2_

- [x] 16. Criar testes de segurança
- [ ]* 16.1 Escrever testes de autenticação
  - Criar `server/tests/auth.test.js`
  - Testar login com token inválido (deve retornar 401)
  - Testar login com token válido (deve criar sessão)
  - Testar acesso sem sessão (deve retornar 401)
  - Testar logout (deve destruir sessão)
  - _Requisitos: 2.1, 2.2, 2.5_

- [ ]* 16.2 Escrever testes de autorização
  - Testar user tentando acessar endpoint admin (deve retornar 403)
  - Testar admin acessando endpoint admin (deve retornar 200)
  - Testar acesso a endpoints user com sessão user (deve retornar 200)
  - _Requisitos: 1.2, 2.4_

- [ ]* 16.3 Escrever testes de rate limiting
  - Testar 5 tentativas de login falhadas (5ª deve passar, 6ª deve retornar 429)
  - Testar rate limit de API geral
  - Testar rate limit de endpoints admin
  - _Requisitos: 6.1, 6.2, 6.3_

- [ ]* 16.4 Escrever testes de CSRF
  - Testar POST sem CSRF token (deve retornar 403)
  - Testar POST com CSRF token válido (deve retornar 200)
  - Testar CSRF token inválido (deve retornar 403)
  - _Requisitos: 7.2, 7.3_

- [ ]* 16.5 Escrever testes de integração frontend
  - Testar fluxo de login completo
  - Testar redirecionamento quando não autenticado
  - Testar chamadas de API com sessão
  - _Requisitos: 8.3, 8.4_

- [x] 17. Verificar e validar implementação
  - Executar todos os testes de segurança
  - Verificar que bundle do frontend não contém tokens
  - Testar manualmente login como admin e user
  - Verificar logs de segurança estão sendo gerados
  - Confirmar que rate limiting está funcionando
  - Validar que CSRF protection está ativo
  - Verificar que todas as rotas estão protegidas
  - _Requisitos: Todos_
