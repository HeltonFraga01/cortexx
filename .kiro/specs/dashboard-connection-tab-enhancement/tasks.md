# Implementation Plan: Dashboard Connection Tab Enhancement

## Overview

Implementar o aprimoramento da aba "Conexão" do Dashboard do usuário, replicando o layout e funcionalidades da página de edição de inbox.

## Tasks

- [x] 1. Adicionar estados e handlers necessários no UserOverview
  - Adicionar estado `copiedField` para controle de feedback de cópia
  - Adicionar estado `loadingAction` para ações rápidas (qr, refresh)
  - Implementar handler `handleCopy` para copiar texto para clipboard
  - Implementar handler `handleGenerateQRQuick` para ação rápida de QR
  - _Requirements: 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Substituir InboxInfoCard por layout inline completo
  - [x] 2.1 Criar estrutura do card com 3 colunas (Avatar, Info, Ações)
    - Card com header "Informações da Conexão"
    - Layout flex responsivo (coluna em mobile, linha em desktop)
    - _Requirements: 1.1, 3.1_
  
  - [x] 2.2 Implementar seção de Avatar
    - Avatar com tamanho 24x24 (h-24 w-24)
    - Fallback com ícone User quando avatar não disponível
    - Botão "Carregar foto" quando logado e sem avatar
    - _Requirements: 1.2, 1.3_
  
  - [x] 2.3 Implementar seção de Informações Principais
    - Nome da inbox com badge de status (Logado/Conectado/Offline)
    - ID da inbox com botão de copiar
    - JID WhatsApp (quando disponível) com botão de copiar
    - Token de acesso com botão de copiar
    - Descrição do status atual
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 3.2, 3.3_
  
  - [x] 2.4 Implementar seção de Ações Rápidas
    - Botão "Gerar QR Code" com ícone QrCode
    - Botão "Atualizar Status" com ícone RefreshCw
    - Botão "Configurações" que navega para página de edição
    - Loading states nos botões durante ações
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2_

- [x] 3. Garantir sincronização de status correta
  - Usar sessionStatus como fonte de verdade quando disponível
  - Fallback para connectionData.isLoggedIn quando sessionStatus é null
  - Manter polling de 10 segundos existente
  - **FIX APPLIED:** Adicionado fallback `connectionData.isLoggedIn` em todos os lugares que verificam status de login
  - _Requirements: 5.1, 5.3, 5.4_

- [x] 4. Checkpoint - Validação visual
  - Verificar layout responsivo em diferentes tamanhos de tela
  - Comparar visualmente com página de edição de inbox
  - Testar todos os botões de copiar
  - Testar navegação para página de configurações
  - **VALIDATED:** Dashboard agora mostra "Logado" igual à página de edição

- [ ]* 5. Escrever testes de propriedade
  - [ ]* 5.1 Property test para Status Badge Rendering
    - **Property 1: Status Badge Rendering**
    - Gerar combinações de (connected, loggedIn)
    - Verificar badge correto para cada combinação
    - **Validates: Requirements 1.7, 3.2**
  
  - [ ]* 5.2 Property test para Data Source Priority
    - **Property 2: Data Source Priority**
    - Gerar cenários com/sem sessionStatus
    - Verificar que sessionStatus tem prioridade
    - **Validates: Requirements 5.1, 5.4**

- [x] 6. Checkpoint Final
  - Verificar TypeScript sem erros ✓
  - Testar fluxo completo de conexão ✓
  - Validar consistência visual com página de edição ✓
  - **COMPLETED:** Build passou, Dashboard e Edit page mostram mesmo status

## Notes

- Tasks marcadas com `*` são opcionais e podem ser puladas para MVP mais rápido
- O layout deve ser idêntico ao usado em `UserInboxEditPage.tsx`
- Reutilizar os mesmos ícones e classes CSS da página de edição
- Manter compatibilidade com o `ConnectionControlCard` existente

## Fix Applied (2024-12-24)

O problema era que o Dashboard usava `sessionStatus?.loggedIn ?? false` sem fallback para `connectionData.isLoggedIn`, enquanto a página de edição usava `sessionStatus?.loggedIn ?? connectionData?.isLoggedIn ?? false`.

Correções aplicadas em `UserOverview.tsx`:
1. Badge de status: `sessionStatus?.loggedIn ?? connectionData.isLoggedIn ?? false`
2. Avatar fallback class: mesma lógica
3. Botão "Carregar foto": mesma lógica
4. Texto de descrição do status: mesma lógica
5. ConnectionControlCard props: mesma lógica

## Fix Applied (2024-12-24) - Avatar não carregava

O problema era que o Dashboard usava `connectionData.profilePicture` (do banco de dados) enquanto a página de edição usava um estado local `avatarUrl` preenchido diretamente pela API do WUZAPI.

Correções aplicadas em `UserOverview.tsx`:
1. Adicionado estado `avatarUrl` para armazenar URL do avatar
2. Atualizado `fetchUserAvatar` para usar `setAvatarUrl(avatarData.URL)` em vez de `refetchConnection()`
3. Atualizado Avatar para usar `avatarUrl || connectionData.profilePicture`
4. Adicionado efeito para resetar `avatarUrl` quando inbox muda
5. Atualizado efeito de auto-load do avatar para incluir fallback `connectionData?.isLoggedIn`
