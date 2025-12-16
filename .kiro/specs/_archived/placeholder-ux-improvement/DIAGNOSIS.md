# Diagnóstico: Placeholders em Formulários de Edição

## URL Analisada
`http://localhost:8080/user/database/4/edit/31`

## Componentes Envolvidos

### 1. DirectEditPage.tsx
**Localização**: `src/components/user/DirectEditPage.tsx`

**Função**: Página principal de edição de registros
- Recebe `connectionId` e `recordId` dos parâmetros da URL
- Busca dados da conexão via `databaseConnectionsService.getConnectionById()`
- Busca registro específico via `databaseConnectionsService.getUserTableRecordById()`
- Renderiza o componente `RecordForm` com os dados

### 2. RecordForm.tsx
**Localização**: `src/components/user/RecordForm.tsx`

**Função**: Formulário de edição de registros
- Recebe `connection` e `record` como props
- Para conexões NocoDB, busca metadados dos campos via `databaseService.getNocoDBColumns()`
- Renderiza campos usando `TypeAwareFieldInput` (quando há metadados) ou `Input` simples (fallback)
- **Linha 398**: Tinha `placeholder=""` (já estava correto ✅)

### 3. TypeAwareFieldInput.tsx
**Localização**: `src/components/user/TypeAwareFieldInput.tsx`

**Função**: Renderiza campos com tipos específicos baseado em metadados
- Recebe `FieldMetadata` com informações do tipo de campo
- Renderiza componentes específicos para cada tipo (Email, Phone, URL, Date, etc.)

## Problemas Encontrados

### ❌ Placeholders Incorretos

1. **TEXT** (linha 106):
   ```tsx
   placeholder={field.helperText || ''}
   ```
   - ❌ Usava helperText como placeholder
   - ✅ Corrigido: removido placeholder

2. **LONG_TEXT** (linha 116):
   ```tsx
   placeholder={field.helperText || ''}
   ```
   - ❌ Usava helperText como placeholder
   - ✅ Corrigido: removido placeholder

### ✅ Placeholders Corretos (Mantidos)

Estes placeholders foram mantidos porque indicam **formatos específicos**:

- **EMAIL**: `placeholder="email@exemplo.com"` ✅
- **PHONE**: `placeholder="(00) 00000-0000"` ✅
- **URL**: `placeholder="https://exemplo.com"` ✅
- **DATE**: `placeholder="Selecione uma data"` ✅
- **DATETIME**: `placeholder="Selecione data e hora"` ✅
- **TIME**: `placeholder="Selecione horário"` ✅
- **SELECT**: `placeholder="Selecione uma opção"` ✅
- **MULTI_SELECT**: `placeholder="Selecione opções"` ✅
- **NUMBER/DECIMAL/CURRENCY/PERCENT**: `placeholder=""` ✅

## Fluxo de Dados

```
URL: /user/database/4/edit/31
         ↓
DirectEditPage (recebe connectionId=4, recordId=31)
         ↓
Busca connection do banco SQLite local
         ↓
Busca record via API (NocoDB ou outro)
         ↓
RecordForm (recebe connection + record)
         ↓
Busca metadados dos campos (NocoDB columns)
         ↓
TypeAwareFieldInput (renderiza cada campo com tipo correto)
         ↓
Usuário vê formulário com campos tipados
```

## Origem dos Dados

### Connection (Banco SQLite Local)
- Tabela: `database_connections`
- Campos: `id`, `name`, `type`, `host`, `port`, `database`, `table_name`, `field_mappings`, etc.
- Serviço: `databaseConnectionsService.getConnectionById()`

### Record (API Externa - NocoDB)
- Endpoint: `/api/v2/tables/{tableId}/records/{recordId}`
- Autenticação: Token do NocoDB
- Serviço: `databaseConnectionsService.getUserTableRecordById()`

### Field Metadata (API NocoDB)
- Endpoint: `/api/v2/meta/tables/{tableId}/columns`
- Retorna: Tipo de campo, opções, validações, etc.
- Serviço: `databaseService.getNocoDBColumns()`
- Cache: `connectionCache` (evita requisições repetidas)

## Correções Aplicadas

### Arquivo: TypeAwareFieldInput.tsx

1. **Campo TEXT** (linha 100-109):
   ```diff
   - placeholder={field.helperText || ''}
   + // sem placeholder
   ```

2. **Campo LONG_TEXT** (linha 111-120):
   ```diff
   - placeholder={field.helperText || ''}
   + // sem placeholder
   ```

## Impacto

- ✅ Campos de texto simples agora aparecem vazios (sem placeholder)
- ✅ Helper text continua aparecendo abaixo do campo (quando configurado)
- ✅ Placeholders de formato (email, telefone, URL) mantidos
- ✅ Placeholders de seleção (date, select) mantidos
- ✅ Sem confusão visual: campo vazio é claramente vazio

## Testes Recomendados

1. Acessar `/user/database/4/edit/31`
2. Verificar que campos de texto aparecem vazios
3. Verificar que campos de email/telefone/URL mostram formato
4. Verificar que helper text aparece abaixo dos campos
5. Verificar que campos com dados do banco mostram os valores
6. Editar um campo e salvar
7. Verificar que "Alterações Detectadas" funciona corretamente

## Regra Aplicada

**Placeholders devem estar VAZIOS quando o campo não está recuperando dados do banco.**

Exceções apenas para:
- Formatos específicos (telefone, URL, email, chaves API)
- Campos de busca/seleção/filtro

Esta regra está documentada em `.kiro/steering/form-placeholders.md` e será aplicada automaticamente em novos desenvolvimentos.
