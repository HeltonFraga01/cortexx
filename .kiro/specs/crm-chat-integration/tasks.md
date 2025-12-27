# Implementation Tasks

## Task 1: Enhance Contact Header with WhatsApp Avatar

### Description
Modificar o header do contato no `ContactDetailPage.tsx` para buscar e exibir o avatar real do WhatsApp.

### Files to Modify
- `src/components/features/crm/ContactDetailPage.tsx`
- `src/hooks/useChatApi.ts`

### Implementation Steps
1. Adicionar estado para `avatarUrl` e `isLoadingAvatar`
2. Criar função `contactJid` derivada do telefone
3. ~~Implementar `handleFetchAvatar` usando `chatApi.startConversation` + `chatApi.fetchConversationAvatar`~~
4. **CORRIGIDO**: Implementar `handleFetchAvatar` usando `chatApi.getContactAvatar(phone)` diretamente
5. Adicionar `getContactAvatar` ao hook `useChatApi`
6. Adicionar botão de refresh no avatar (similar ao ContactPanel)
7. Atualizar Avatar component para usar `avatarUrl` do estado
8. Adicionar feedback via toast (sucesso/erro/não disponível)

### Acceptance Criteria
- [x] Avatar do WhatsApp é buscado ao clicar no botão refresh
- [x] Botão de refresh permite buscar o avatar
- [x] Fallback para iniciais funciona quando avatar não disponível
- [x] Loading state exibido durante fetch
- [x] Toast feedback para sucesso/erro/não disponível

### Status: COMPLETE ✅

---

## Task 2: Create CRMContactAttributesSection Component

### Description
Criar componente para exibir e gerenciar atributos do contato no CRM.

### Files to Create
- `src/components/features/crm/CRMContactAttributesSection.tsx`

### Files to Modify
- `src/components/features/crm/index.ts` (export)

### Implementation Steps
1. Criar componente com props `contactJid: string`
2. Usar `useQuery` para buscar atributos via `chatApi.getContactAttributes`
3. Implementar lista de atributos com nome e valor
4. Adicionar formulário inline para novo atributo (Card-based, não Dialog)
5. Implementar edição inline de valores
6. Implementar deleção com `AlertDialog` de confirmação
7. Usar mutations com invalidação de cache

### Acceptance Criteria
- [x] Lista atributos existentes
- [x] Permite adicionar novo atributo (inline Card form)
- [x] Permite editar valor de atributo existente (inline)
- [x] Permite deletar atributo (com confirmação AlertDialog)
- [x] Loading e error states tratados

### Status: COMPLETE ✅

---

## Task 3: Create CRMContactNotesSection Component

### Description
Criar componente para exibir e gerenciar notas do contato no CRM.

### Files to Create
- `src/components/features/crm/CRMContactNotesSection.tsx`

### Files to Modify
- `src/components/features/crm/index.ts` (export)

### Implementation Steps
1. Criar componente com props `contactJid: string`
2. Usar `useQuery` para buscar notas via `chatApi.getContactNotes`
3. Implementar lista de notas com conteúdo e timestamp
4. Adicionar input para nova nota (inline, não Dialog)
5. Implementar deleção com `AlertDialog` de confirmação
6. Ordenar notas por data (mais recente primeiro)

### Acceptance Criteria
- [x] Lista notas existentes em ordem cronológica reversa
- [x] Permite adicionar nova nota (inline input)
- [x] Permite deletar nota (com confirmação AlertDialog)
- [x] Exibe timestamp formatado para cada nota
- [x] Loading e error states tratados

### Status: COMPLETE ✅

---

## Task 4: Create CRMPreviousConversationsSection Component

### Description
Criar componente para exibir conversas anteriores com o contato.

### Files to Create
- `src/components/features/crm/CRMPreviousConversationsSection.tsx`

### Files to Modify
- `src/components/features/crm/index.ts` (export)

### Implementation Steps
1. Criar componente com props `contactJid: string`, `onNavigate: (id: number) => void`
2. Usar `useQuery` para buscar conversas via `chatApi.getPreviousConversations`
3. Implementar lista de conversas com status badge, preview, timestamp
4. Adicionar click handler para navegar ao chat
5. Tratar caso de nenhuma conversa

### Acceptance Criteria
- [x] Lista conversas anteriores com status, preview e data
- [x] Click em conversa navega para `/user/chat?conversation={id}`
- [x] Exibe mensagem quando não há conversas
- [x] Loading e error states tratados

### Status: COMPLETE ✅

---

## Task 5: Integrate Chat Sections into ContactDetailPage

### Description
Integrar os novos componentes na aba "Visão Geral" do ContactDetailPage.

### Files to Modify
- `src/components/features/crm/ContactDetailPage.tsx`

### Implementation Steps
1. Importar os 3 novos componentes
2. Calcular `contactJid` a partir do telefone do contato
3. Adicionar seção "Integração Chat" na aba Overview
4. Renderizar `CRMContactAttributesSection` e `CRMContactNotesSection` lado a lado
5. Renderizar `CRMPreviousConversationsSection` abaixo
6. Implementar `handleNavigateToConversation` para navegação

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Lead Score Card          │ Metrics Card                    │
├─────────────────────────────────────────────────────────────┤
│ Contact Attributes       │ Contact Notes                   │
├─────────────────────────────────────────────────────────────┤
│ Previous Conversations (full width)                        │
├─────────────────────────────────────────────────────────────┤
│ Recent Timeline                                             │
└─────────────────────────────────────────────────────────────┘
```

### Acceptance Criteria
- [x] Seções de chat aparecem na aba Overview
- [x] Layout responsivo (2 colunas em desktop, 1 em mobile)
- [x] Navegação para chat funciona corretamente
- [x] Seções só carregam dados quando contactJid disponível

### Status: COMPLETE ✅

---

## Task 6: Add Active Conversation Indicator

### Description
Mostrar indicador visual quando o contato tem uma conversa ativa.

### Files to Modify
- `src/components/features/crm/ContactDetailPage.tsx`

### Implementation Steps
1. Buscar conversa ativa via `chatApi.startConversation` (não cria nova, apenas encontra)
2. Armazenar `activeConversation` no estado
3. Exibir badge "Conversa ativa" no header quando existir
4. Mostrar etiquetas e bot atribuído da conversa ativa (read-only)

### Acceptance Criteria
- [ ] Badge "Conversa ativa" aparece quando há conversa
- [ ] Etiquetas da conversa são exibidas (read-only)
- [ ] Bot atribuído é exibido (read-only)
- [ ] Sem indicador quando não há conversa ativa

**STATUS: DEFERRED** - Funcionalidade opcional, pode ser implementada em iteração futura.

---

## Task 7: Testing and Polish

### Description
Testar integração completa e fazer ajustes finais.

### Implementation Steps
1. Testar fluxo completo: abrir contato → ver atributos → adicionar nota → ver conversas
2. Verificar que dados sincronizam com o Chat Panel
3. Testar estados de loading e erro
4. Verificar responsividade em diferentes tamanhos de tela
5. Ajustar espaçamentos e alinhamentos conforme necessário

### Acceptance Criteria
- [ ] Todos os fluxos funcionam sem erros
- [ ] Dados aparecem consistentes entre CRM e Chat
- [ ] UI responsiva e polida
- [ ] Sem console errors ou warnings

---

## Dependencies

```
Task 1 (Avatar) ─────────────────────────────────────────┐
Task 2 (Attributes) ─────────────────────────────────────┼──▶ Task 5 (Integration) ──▶ Task 6 (Indicator) ──▶ Task 7 (Testing)
Task 3 (Notes) ──────────────────────────────────────────┤
Task 4 (Conversations) ──────────────────────────────────┘
```

Tasks 1-4 podem ser executadas em paralelo.
Task 5 depende de 2, 3, 4.
Task 6 depende de 5.
Task 7 depende de 6.
