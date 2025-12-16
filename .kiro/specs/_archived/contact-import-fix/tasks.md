# Implementation Tasks

## ✅ Completed

- [x] 1. Corrigir função toggleAll()
  - Alterar de `filteredContacts` para `paginatedContacts`
  - Criar novo Set a partir da seleção existente
  - Adicionar/remover apenas contatos da página atual
  - Preservar seleções de outras páginas

- [x] 2. Atualizar checkbox do header
  - Implementar estado `checked` baseado em `paginatedContacts`
  - Adicionar estado `indeterminate` para seleção parcial
  - Conectar `onCheckedChange` ao `toggleAll()`
  - Adicionar `aria-label` para acessibilidade

- [x] 3. Remover seleção automática ao importar
  - Comentar `setSelectedContacts` em `handleWuzapiImport`
  - Comentar `setSelectedContacts` em `handleCSVUpload`
  - Comentar `setSelectedContacts` em `handleManualImport`
  - Manter seleção apenas quando vem de `preSelectedContacts` (sessionStorage)

- [x] 4. Documentar correção
  - Criar requirements.md explicando o problema
  - Documentar causa raiz e solução
  - Referenciar implementação em ContactsTable

## Validação

- [x] Buscar "mãe Clara" e selecionar
- [x] Buscar "Heitor Clara" e selecionar
- [x] Verificar que ambos permanecem selecionados
- [x] Verificar contador total de selecionados
- [x] Verificar estado do checkbox em diferentes páginas
