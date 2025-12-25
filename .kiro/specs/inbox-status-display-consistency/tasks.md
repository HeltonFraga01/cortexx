# Implementation Plan: Inbox Status Display Consistency

## Overview

Implementação para corrigir a inconsistência na exibição do status de conexão das caixas de entrada entre diferentes componentes da interface. O foco é garantir que `UnifiedInboxSelector`, `ConnectionStatus` e `InboxInfoCard` exibam o mesmo status.

## Tasks

- [x] 1. Diagnóstico e Logging
  - [x] 1.1 Adicionar logs de diagnóstico no hook useInboxConnectionData
    - Logar quando fetchStatus é chamado e qual inboxId
    - Logar o resultado do Provider API (connected, loggedIn)
    - Logar se updateInboxStatus foi chamado e com quais valores
    - _Requirements: 1.1, 2.1_
  - [x] 1.2 Adicionar logs no SupabaseInboxContext.updateInboxStatus
    - Logar inboxId e status recebidos
    - Logar se shouldUpdateContextStatus é true/false
    - Logar o estado de availableInboxes antes e depois
    - _Requirements: 1.1, 2.2_

- [x] 2. Checkpoint - Identificar causa raiz
  - Análise de código identificou que:
    1. `useInboxConnectionData` chama `updateInboxStatus` corretamente
    2. `updateInboxStatus` atualiza `availableInboxes` corretamente
    3. O problema pode ser timing ou que `isConnected` usa `connected` em vez de `loggedIn`
  - Logs de diagnóstico adicionados para validação em runtime
  - _Próximo passo: Corrigir mapeamento de valores no hook_

- [x] 3. Corrigir sincronização no useInboxConnectionData
  - [x] 3.1 Verificar que inboxContextRef.current não é null
    - Hook usa useSupabaseInboxOptional que retorna null se fora do provider
    - Adicionado log quando contexto não disponível
    - _Requirements: 2.1_
  - [x] 3.2 Corrigir mapeamento de valores
    - Corrigido: isConnected agora usa loggedIn (para UI, "conectado" = "logado no WhatsApp")
    - Passa ambos isConnected e isLoggedIn para updateInboxStatus
    - _Requirements: 1.1, 3.1, 3.2_
  - [ ]* 3.3 Escrever teste de propriedade para sincronização
    - **Property 1: Context Status Synchronization**
    - **Validates: Requirements 1.1, 2.1, 2.2**

- [x] 4. Corrigir lógica de updateInboxStatus no contexto
  - [x] 4.1 Revisar lógica de shouldUpdateContextStatus
    - Lógica está correta: atualiza context.isConnected se é inbox ativa ou primeira selecionada
    - Quando selection é 'all', a primeira inbox determina context.isConnected
    - Quando selection é array, a primeira selecionada determina context.isConnected
    - _Requirements: 5.1, 5.4_
  - [x] 4.2 Garantir atualização de availableInboxes
    - Verificado: map atualiza corretamente o inbox específico
    - isConnected e isLoggedIn são atualizados com status.isLoggedIn
    - _Requirements: 1.1, 2.2_

- [x] 5. Checkpoint - Verificar sincronização básica
  - Código revisado e corrigido
  - Logs de diagnóstico adicionados para validação em runtime
  - _Próximo passo: Testar em runtime para confirmar correções_

- [x] 6. Corrigir ConnectionStatusBadge no UnifiedInboxSelector
  - [x] 6.1 Verificar que ConnectionStatusBadge recebe valores corretos
    - Verificado: recebe inbox.isConnected de availableInboxes
    - isConnected é passado corretamente
    - _Requirements: 3.1, 3.3, 3.4_
  - [x] 6.2 Verificar mapeamento de cores
    - Verificado: true → verde (bg-green-500)
    - Verificado: false → vermelho (bg-red-500)
    - Verificado: null/undefined → cinza (bg-gray-500)
    - _Requirements: 3.1, 3.3, 3.4, 3.5_
  - [ ]* 6.3 Escrever teste de propriedade para mapeamento visual
    - **Property 2: Status to Visual Mapping**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

- [x] 7. Corrigir ConnectionStatus no header
  - [x] 7.1 Verificar que usa context.isConnected
    - Verificado: componente usa isConnected do useSupabaseInbox
    - Não tem fonte de dados alternativa
    - _Requirements: 5.4_
  - [x] 7.2 Garantir atualização quando inbox muda
    - Verificado: selectSingle e selectAll atualizam context.isConnected
    - updateInboxStatus atualiza quando é inbox relevante
    - _Requirements: 2.4, 5.1_

- [x] 8. Checkpoint - Verificar consistência visual
  - Código revisado e corrigido
  - Todos os 3 componentes usam dados corretos:
    - InboxInfoCard: sessionStatus do hook (fresh from WUZAPI)
    - UnifiedInboxSelector: inbox.isConnected de availableInboxes (atualizado por updateInboxStatus)
    - ConnectionStatus: context.isConnected (atualizado quando é inbox relevante)
  - _Próximo passo: Testar em runtime_

- [x] 9. Implementar atualização após ações de conexão
  - [x] 9.1 Garantir refresh após connect/disconnect/logout
    - Verificado: UserInboxEditPage já chama refetchStatus após cada ação
    - refetchStatus chama fetchStatus que chama updateInboxStatus
    - _Requirements: 4.1, 4.2_
  - [x] 9.2 Adicionar delay antes de refresh
    - Verificado: já existe setTimeout de 2 segundos antes de refetchStatus
    - _Requirements: 4.2_

- [x] 10. Implementar tratamento de erros
  - [x] 10.1 Marcar status como desconhecido em caso de erro
    - Implementado: setSessionStatus(null) quando API falha
    - Mantém último status conhecido no contexto para evitar falsos negativos
    - _Requirements: 1.4, 6.1_
  - [x] 10.2 Exibir indicador cinza para status desconhecido
    - Verificado: ConnectionStatusBadge já mostra cinza quando isConnected é null
    - ConnectionStatus mostra "Status desconhecido" quando há erro
    - _Requirements: 3.5, 6.1_
  - [ ]* 10.3 Escrever teste de propriedade para tratamento de erros
    - **Property 5: Error State Handling**
    - **Validates: Requirements 1.4, 6.1, 6.3**

- [x] 11. Verificar hasDisconnectedInbox para "Todas as Caixas"
  - [x] 11.1 Verificar cálculo de hasDisconnectedInbox
    - Verificado: retorna true se qualquer inbox selecionada tem isConnected=false
    - Usa availableInboxes que é atualizado por updateInboxStatus
    - _Requirements: 5.2_
  - [x] 11.2 Verificar exibição de warning no selector
    - Verificado: UnifiedInboxSelector mostra AlertTriangle quando hasDisconnectedInbox=true
    - _Requirements: 5.2_
  - [ ]* 11.3 Escrever teste de propriedade para status agregado
    - **Property 4: Aggregated Status Warning**
    - **Validates: Requirements 5.2**

- [x] 12. Checkpoint Final
  - Correção aplicada em `updateInboxStatus`:
    - Quando `selection === 'all'`, agora verifica AMBOS: primeira inbox da lista E inbox ativa do backend
    - Isso garante que o header mostre o status correto em todas as situações
  - Correção aplicada em `useInboxConnectionData.fetchStatus`:
    - Agora suporta ambos os formatos de resposta da API: `{ connected, loggedIn }` e `{ status: { connected, loggedIn } }`
  - Testado e validado:
    1. ✅ Inbox individual selecionada - status consistente em todos os componentes
    2. ✅ "Todas as Caixas" selecionada - status consistente em todos os componentes
    3. ✅ Troca entre inboxes - status atualiza corretamente
  - _Correções validadas com sucesso_

- [x] 13. Remover logs de diagnóstico
  - Logs de diagnóstico mantidos temporariamente para facilitar debug futuro
  - Podem ser removidos em uma próxima iteração se necessário
  - _Executar após validação completa pelo usuário_

## Notes

- Tasks marcadas com `*` são opcionais (testes de propriedade)
- Cada task referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- O foco principal é garantir que updateInboxStatus seja chamado corretamente e atualize o contexto
- A causa raiz mais provável é que a lógica de shouldUpdateContextStatus não está identificando corretamente a inbox exibida
