# Implementation Plan: Inbox Connection Sync

## Overview

Este plano implementa a sincronização dos dados de conexão quando o usuário altera a caixa de entrada selecionada. A implementação segue a ordem: backend → hook → componentes → testes.

## Tasks

- [x] 1. Criar endpoints de API para dados de conexão por inbox
  - [x] 1.1 Criar rota GET /api/user/inbox/:inboxId/connection
    - Retornar dados de conexão (token, instance, phoneNumber, jid)
    - Validar que o usuário tem acesso à inbox
    - _Requirements: 1.1, 1.2, 1.4_

  - [x] 1.2 Criar rota GET /api/user/inbox/:inboxId/status
    - Retornar status da sessão WhatsApp (connected, loggedIn, qrCode)
    - Usar wuzapiClient para buscar status
    - _Requirements: 1.3_

  - [x] 1.3 Criar rota GET /api/user/inbox/:inboxId/webhook
    - Retornar configuração de webhook da inbox
    - _Requirements: 1.1_

- [x] 2. Criar hook useInboxConnectionData
  - [x] 2.1 Implementar hook com estado de loading, error e data
    - Aceitar inboxId como parâmetro
    - Carregar dados quando inboxId mudar
    - _Requirements: 1.1, 2.1, 2.2_

  - [x] 2.2 Implementar função refetch para atualização manual
    - Permitir refresh após ações de controle
    - _Requirements: 4.4_

  - [x] 2.3 Implementar tratamento de erros
    - Exibir mensagem apropriada em caso de falha
    - _Requirements: 2.3_

  - [ ]* 2.4 Escrever property test para sincronização de dados
    - **Property 1: Dados sincronizados com inbox selecionada**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 3. Checkpoint - Verificar hook funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Atualizar UserOverview para usar contexto de inbox
  - [x] 4.1 Integrar SupabaseInboxContext no UserOverview
    - Obter activeInbox do contexto
    - Reagir a mudanças de inbox
    - _Requirements: 1.1_

  - [x] 4.2 Usar useInboxConnectionData para carregar dados
    - Passar inboxId do contexto para o hook
    - Exibir loading durante carregamento
    - _Requirements: 2.1, 2.2_

  - [x] 4.3 Atualizar UserInfoCardModern com dados da inbox
    - Passar dados do hook para o componente
    - Exibir nome, foto, token da inbox selecionada
    - _Requirements: 1.2, 1.4_

  - [x] 4.4 Atualizar ConnectionControlCardModern com inboxId
    - Passar inboxId para garantir ações na inbox correta
    - Atualizar handlers para usar token da inbox
    - _Requirements: 1.5, 4.1, 4.2, 4.3_

  - [ ]* 4.5 Escrever property test para ações na inbox correta
    - **Property 4: Ações executadas na inbox correta**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 1.5**

- [x] 5. Checkpoint - Verificar sincronização funcionando
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implementar persistência de seleção
  - [x] 6.1 Garantir persistência entre abas Dashboard/Conexão
    - Usar estado do contexto (já implementado)
    - Verificar que seleção não é perdida ao navegar
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 Verificar persistência após reload
    - Usar saveInboxSelection do contexto
    - Restaurar seleção ao carregar página
    - _Requirements: 3.3_

  - [ ]* 6.3 Escrever property tests para persistência
    - **Property 2: Persistência de seleção entre navegações**
    - **Property 3: Persistência de seleção após reload**
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [x] 7. Atualizar componentes de controle
  - [x] 7.1 Modificar handlers de conexão para usar inbox selecionada
    - handleConnect deve usar token da inbox ativa
    - handleDisconnect deve usar token da inbox ativa
    - handleLogout deve usar token da inbox ativa
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 7.2 Atualizar fetchSessionStatus para inbox específica
    - Buscar status da inbox selecionada, não do usuário
    - _Requirements: 1.3, 4.4_

  - [x] 7.3 Atualizar fetchWebhookConfig para inbox específica
    - Buscar webhook da inbox selecionada
    - _Requirements: 1.1_

- [x] 8. Checkpoint final - Verificar fluxo completo
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 9. Escrever testes de integração
  - [ ]* 9.1 Teste E2E: mudança de inbox atualiza dados
    - Selecionar inbox → Verificar dados atualizados
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 9.2 Teste E2E: ações executadas na inbox correta
    - Selecionar inbox → Executar ação → Verificar inbox afetada
    - _Requirements: 4.1, 4.2, 4.3_

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Property tests validam propriedades universais de corretude
- Unit tests validam exemplos específicos e edge cases
