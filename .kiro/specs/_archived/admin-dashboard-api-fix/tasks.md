# Implementation Plan

- [x] 1. Criar rota backend `/api/admin/dashboard-stats`
  - Adicionar nova rota GET em `server/routes/adminRoutes.js`
  - Implementar lógica de agregação de dados da WuzAPI
  - Calcular estatísticas (total, conectados, logados)
  - Incluir informações de sistema (uptime, versão, memória)
  - Implementar tratamento de erros apropriado
  - Adicionar logging estruturado com Winston
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 4.1, 4.2, 4.3, 4.4_

- [x] 2. Atualizar componente AdminOverview para usar nova API
  - Modificar `src/components/admin/AdminOverview.tsx`
  - Remover código de fallback antigo (WuzAPIService direto)
  - Implementar chamada para `/api/admin/dashboard-stats`
  - Adicionar tratamento de erros com toast notifications
  - Manter atualização automática a cada 30 segundos
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ]* 3. Adicionar testes para a nova rota
  - Criar arquivo `server/routes/adminRoutes.test.js` se não existir
  - Testar resposta com token válido (200)
  - Testar resposta sem sessão válida (401)
  - Testar resposta quando WuzAPI está indisponível (503)
  - Testar cálculo correto de estatísticas
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ]* 4. Adicionar testes para o componente AdminOverview
  - Criar arquivo `src/components/admin/AdminOverview.test.tsx` se não existir
  - Testar exibição de loading state
  - Testar exibição de estatísticas após carregamento
  - Testar exibição de erro quando API falha
  - Testar atualização automática a cada 30 segundos
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 5. Validar solução em ambiente de desenvolvimento
  - Iniciar servidor backend e frontend
  - Fazer login como administrador
  - Verificar que dashboard carrega sem erros 401
  - Verificar que estatísticas são exibidas corretamente
  - Verificar que dados atualizam automaticamente
  - Verificar logs do servidor para confirmar ausência de erros
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_
