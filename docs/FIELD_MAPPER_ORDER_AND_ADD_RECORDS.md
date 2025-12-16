# Mapeador de Campos - Ordem de Exibição e Adicionar Registros

## Resumo das Melhorias

### 1. Ordem de Exibição no Mapeador de Campos

Adicionada funcionalidade para controlar a ordem de exibição dos campos no formulário do usuário.

#### Funcionalidades:
- **Nova coluna "Ordem"** no Mapeador de Campos
- **Botões de setas** (↑ ↓) para reordenar campos
- **Numeração visual** mostrando a posição atual de cada campo
- **Persistência automática** da ordem configurada
- **Aplicação automática** da ordem no formulário do usuário

#### Localização:
- **Admin**: `/admin/databases/edit/{id}` → Aba "Avançado" → Seção "Mapeador de Campos"
- **Usuário**: A ordem configurada é aplicada automaticamente no formulário

#### Como Usar:
1. Acesse a edição de uma conexão de banco de dados
2. Vá para a aba "Configurações Avançadas"
3. Na seção "Mapeador de Campos", use as setas para reordenar
4. A ordem será salva automaticamente
5. Os usuários verão os campos na ordem configurada

---

### 2. Adicionar Novos Registros (Múltiplos Registros)

Quando um usuário tem múltiplos registros vinculados, agora ele pode adicionar novos registros além de editar os existentes.

#### Funcionalidades:
- **Botão "Adicionar Registro"** visível quando há múltiplos registros
- **Diálogo de criação** com formulário inteligente
- **Preenchimento automático**:
  - Campos não editáveis ficam vazios (serão preenchidos pelo banco)
  - Campo de vínculo do usuário é preenchido automaticamente com o token
  - Apenas campos editáveis são solicitados ao usuário
- **Validação de campos obrigatórios**
- **Respeita a ordem de exibição** configurada no Mapeador de Campos
- **Feedback visual** com mensagens de sucesso/erro

#### Localização:
- **UserDatabase**: `/user/database` → Botão "Adicionar" no cabeçalho do card
- **UserDatabaseView**: `/user/database/{connectionId}` → Botão "Adicionar Registro" no topo

#### Como Funciona:

**Cenário 1: Usuário com 1 registro**
- Não mostra botão de adicionar
- Usuário edita diretamente seu único registro

**Cenário 2: Usuário com múltiplos registros**
- Mostra botão "Adicionar Registro"
- Usuário pode criar novos registros
- Usuário pode editar registros existentes

#### Campos Preenchidos Automaticamente:
1. **Campo de vínculo** (`user_link_field`): Preenchido com o token do usuário
2. **Campos não editáveis**: Deixados vazios para o banco preencher com valores padrão
3. **Campos editáveis**: Solicitados ao usuário no formulário

---

## Arquivos Modificados

### Admin
- `src/components/admin/DatabaseAdvancedTab.tsx`
  - Adicionada coluna "Ordem" na tabela
  - Implementados botões de reordenação
  - Adicionada função `handleMoveField()`
  - Atualizada legenda com explicação da ordem

### Usuário
- `src/components/user/RecordForm.tsx`
  - Adicionada ordenação dos campos visíveis por `displayOrder`
  
- `src/components/user/AddRecordDialog.tsx` (NOVO)
  - Componente de diálogo para adicionar registros
  - Formulário com validação
  - Preenchimento automático de campos especiais
  
- `src/components/user/UserDatabase.tsx`
  - Adicionado botão "Adicionar"
  - Integrado `AddRecordDialog`
  - Adicionada função `handleAddSuccess()`
  
- `src/components/user/UserDatabaseView.tsx`
  - Adicionado botão "Adicionar Registro" (condicional)
  - Integrado `AddRecordDialog`
  - Detecta múltiplos registros automaticamente

---

## Estrutura de Dados

### FieldMapping (atualizado)
```typescript
interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
  showInCard?: boolean;
  helperText?: string;
  displayOrder?: number;  // NOVO
}
```

### Ordem de Exibição
- Campos são ordenados por `displayOrder` (crescente)
- Se `displayOrder` não existir, usa a posição no array
- Ordem é mantida em todas as visualizações do usuário

---

## Fluxo de Criação de Registro

```
1. Usuário clica em "Adicionar Registro"
   ↓
2. Sistema abre diálogo com formulário
   ↓
3. Sistema preenche automaticamente:
   - Campo de vínculo com token do usuário
   - Campos não editáveis ficam vazios
   ↓
4. Usuário preenche campos editáveis
   ↓
5. Sistema valida campos obrigatórios
   ↓
6. Sistema envia para API: POST /api/user/database-connections/:id/records
   ↓
7. Backend cria registro no NocoDB
   ↓
8. Sistema recarrega lista de registros
   ↓
9. Usuário vê mensagem de sucesso
```

---

## Validações

### No Formulário de Adição:
- ✅ Todos os campos editáveis são obrigatórios
- ✅ Campos não editáveis não são validados (preenchidos pelo banco)
- ✅ Campo de vínculo é preenchido automaticamente
- ✅ Mensagens de erro específicas por campo

### No Mapeador de Campos:
- ✅ Ordem é mantida ao salvar
- ✅ Campos podem ser reordenados livremente
- ✅ Primeira posição não pode subir
- ✅ Última posição não pode descer

---

## Exemplos de Uso

### Exemplo 1: CRM de Vendas
**Configuração Admin:**
- Campo `user_token` → Não editável (vínculo)
- Campo `cliente_nome` → Editável, Ordem 1
- Campo `valor_venda` → Editável, Ordem 2
- Campo `data_criacao` → Não editável (auto)

**Experiência do Usuário:**
1. Usuário vê lista de suas vendas
2. Clica em "Adicionar Registro"
3. Preenche apenas: `cliente_nome` e `valor_venda`
4. Sistema preenche automaticamente: `user_token` e `data_criacao`

### Exemplo 2: Sistema de Tickets
**Configuração Admin:**
- Campo `usuario_id` → Não editável (vínculo)
- Campo `titulo` → Editável, Ordem 1
- Campo `descricao` → Editável, Ordem 2
- Campo `status` → Editável, Ordem 3
- Campo `criado_em` → Não editável (auto)

**Experiência do Usuário:**
1. Usuário vê seus tickets
2. Clica em "Adicionar Registro"
3. Preenche: `titulo`, `descricao`, `status`
4. Sistema vincula automaticamente ao usuário

---

## Notas Técnicas

### Performance
- Reordenação é instantânea (apenas troca posições no array)
- Não requer chamadas à API durante reordenação
- Salva automaticamente ao trocar de aba ou salvar conexão

### Compatibilidade
- ✅ Funciona com conexões NocoDB existentes
- ✅ Campos sem `displayOrder` recebem ordem automática
- ✅ Não quebra formulários existentes
- ✅ Retrocompatível com versões anteriores

### Segurança
- ✅ Campo de vínculo sempre preenchido pelo sistema
- ✅ Usuário não pode modificar campos não editáveis
- ✅ Validação no backend garante integridade
- ✅ Token do usuário validado antes de criar registro

---

## Testes Recomendados

### Teste 1: Ordem de Campos
1. Configure ordem personalizada no admin
2. Acesse como usuário
3. Verifique se campos aparecem na ordem correta

### Teste 2: Adicionar Registro
1. Configure conexão com múltiplos registros
2. Acesse como usuário
3. Clique em "Adicionar Registro"
4. Preencha formulário
5. Verifique se registro foi criado corretamente

### Teste 3: Preenchimento Automático
1. Configure campo de vínculo
2. Adicione novo registro como usuário
3. Verifique no NocoDB se campo de vínculo foi preenchido

### Teste 4: Validação
1. Tente criar registro sem preencher campos obrigatórios
2. Verifique se mensagens de erro aparecem
3. Preencha campos e verifique se cria com sucesso

---

## Sistema de Paginação

### Implementado ✅
- **Controle de itens por página**: 5, 10, 20, 50 ou 100 registros
- **Navegação completa**: Primeira, Anterior, Próxima, Última página
- **Indicadores visuais**: Página atual, total de páginas, registros exibidos
- **Reset automático**: Volta para página 1 ao filtrar ou trocar conexão
- **Performance otimizada**: Renderiza apenas registros visíveis

### Localização
- **UserDatabase**: `/user/database` → Controles de paginação no rodapé da tabela

### Detalhes
Veja documentação completa em: `docs/PAGINATION_IMPLEMENTATION.md`

---

## Próximas Melhorias Sugeridas

1. **Paginação no servidor**: Buscar apenas página atual da API
2. **Edição em lote**: Editar múltiplos registros de uma vez
3. **Duplicar registro**: Criar novo registro baseado em existente
4. **Campos condicionais**: Mostrar/ocultar campos baseado em valores
5. **Validações customizadas**: Regex, min/max, etc.
6. **Upload de arquivos**: Suporte para campos de arquivo
7. **Campos relacionados**: Suporte para foreign keys
