# Contact Import Selection Fix

## Problema

No componente ContactImporter do disparador, ao buscar e selecionar contatos em diferentes buscas, a seleção anterior era perdida. Por exemplo:
1. Buscar "mãe Clara" e selecionar
2. Limpar busca e buscar "Heitor Clara" e selecionar
3. Resultado: apenas "Heitor Clara" ficava selecionado, "mãe Clara" era desmarcado

## Causa Raiz

O checkbox "Selecionar Todos" estava substituindo toda a seleção (`setSelectedContacts(new Set(...))`) em vez de adicionar/remover apenas os contatos da página atual.

## Solução Implementada

Aplicada a mesma lógica usada em ContactsTable:

1. **toggleAll()**: Modificado para trabalhar com `paginatedContacts` (página atual) em vez de `filteredContacts` (todos filtrados)
   - Cria um novo Set a partir da seleção existente
   - Adiciona ou remove apenas os contatos da página atual
   - Preserva seleções de outras páginas/buscas

2. **Checkbox do Header**: Atualizado para refletir o estado da página atual
   - `checked`: Todos os contatos da página atual estão selecionados
   - `indeterminate`: Alguns (mas não todos) da página atual estão selecionados
   - `onCheckedChange`: Chama `toggleAll()` em vez de substituir toda a seleção

## Comportamento Esperado

- ✅ Buscar e selecionar contatos em múltiplas buscas mantém todas as seleções
- ✅ Checkbox do header reflete corretamente o estado da página atual
- ✅ Estado indeterminado quando apenas alguns contatos da página estão selecionados
- ✅ Seleção persiste ao mudar de página ou filtros
- ✅ Contador mostra total de contatos selecionados (não apenas da página atual)
- ✅ Contatos importados NÃO são selecionados automaticamente (usuário escolhe)
- ✅ Exceção: Contatos vindos da página de contatos mantêm seleção original

## Arquivos Modificados

- `src/components/disparador/ContactImporter.tsx`
  - Função `toggleAll()` 
  - Checkbox do header da tabela

## Referência

Implementação baseada em `src/components/contacts/ContactsTable.tsx` que já tinha essa lógica correta.
