# Fix: Tabela Selecionada Não Aparece ao Editar Conexão NocoDB

## Problema Reportado

**URL**: `http://localhost:8080/admin/databases/edit/3`

**Sintoma**: Ao editar uma conexão NocoDB existente, o dropdown "Tabela" aparece vazio, mesmo que a conexão tenha uma tabela configurada.

**Evidência Visual**:
- Campo "Projeto/Base": Mostra "WaSend" ✅
- Campo "Tabela": Aparece vazio ❌
- "Configuração Válida" mostra: `Table: m2t976te0cowlfu` ✅

## Diagnóstico

### Componente Afetado
**Arquivo**: `src/components/admin/DatabaseConnectionForm.tsx`

### Fluxo Esperado ao Editar

1. Usuário acessa `/admin/databases/edit/3`
2. `useParams()` captura `id=3`
3. `loadConnection(3)` é chamado
4. Busca conexão do banco SQLite local
5. Preenche `formData` com dados da conexão
6. Define `selectedProject` e `selectedTable`
7. **PROBLEMA**: Não carrega as listas de projetos e tabelas
8. Dropdowns aparecem vazios

### Código Problemático (Antes)

```typescript
const loadConnection = async (connectionId: number) => {
  setLoading(true);
  try {
    const connection = await databaseConnectionsService.getConnectionById(connectionId);
    if (connection) {
      setFormData(connection);
      
      if (connection.type === 'NOCODB') {
        // ❌ Define os valores selecionados
        setSelectedProject(connection.nocodb_project_id || connection.database || '');
        setSelectedTable(connection.nocodb_table_id || connection.table_name || '');
        
        // ❌ MAS NÃO CARREGA AS LISTAS!
        // Resultado: dropdowns vazios, valores não aparecem
      }
    }
  } catch (error: any) {
    console.error('Erro ao carregar conexão:', error);
    toast.error('Erro ao carregar conexão');
    navigate('/admin/databases');
  } finally {
    setLoading(false);
  }
};
```

### Por Que Acontecia?

O componente `Select` do shadcn/ui precisa que:
1. O `value` esteja definido (✅ estava)
2. A lista de `SelectItem` contenha o valor (❌ não estava)

Sem a lista de tabelas carregada, o `Select` não consegue renderizar o item correspondente ao `value`, então aparece vazio.

## Solução Implementada

### Código Corrigido (Depois)

```typescript
const loadConnection = async (connectionId: number) => {
  setLoading(true);
  try {
    const connection = await databaseConnectionsService.getConnectionById(connectionId);
    if (connection) {
      setFormData(connection);
      
      if (connection.type === 'NOCODB') {
        const projectId = connection.nocodb_project_id || connection.database || '';
        const tableId = connection.nocodb_table_id || connection.table_name || '';
        
        setSelectedProject(projectId);
        setSelectedTable(tableId);
        
        // ✅ CARREGAR LISTAS PARA POPULAR OS DROPDOWNS
        if (connection.host && connection.nocodb_token) {
          // Carregar workspaces
          try {
            const workspaceList = await databaseConnectionsService.getNocoDBWorkspaces(
              connection.host,
              connection.nocodb_token
            );
            setWorkspaces(workspaceList);
          } catch (error) {
            console.error('Erro ao carregar workspaces:', error);
            setWorkspaces([]);
          }
          
          // Carregar projetos
          try {
            const projectList = await databaseConnectionsService.getNocoDBProjects(
              connection.host,
              connection.nocodb_token
            );
            setProjects(projectList);
          } catch (error) {
            console.error('Erro ao carregar projetos:', error);
            setProjects([]);
          }
          
          // Carregar tabelas do projeto selecionado
          if (projectId) {
            try {
              const tableList = await databaseConnectionsService.getNocoDBTables(
                connection.host,
                connection.nocodb_token,
                projectId
              );
              setTables(tableList);
            } catch (error) {
              console.error('Erro ao carregar tabelas:', error);
              setTables([]);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('Erro ao carregar conexão:', error);
    toast.error('Erro ao carregar conexão');
    navigate('/admin/databases');
  } finally {
    setLoading(false);
  }
};
```

### O Que Mudou?

1. ✅ Carrega lista de workspaces (se disponível)
2. ✅ Carrega lista de projetos
3. ✅ Carrega lista de tabelas do projeto selecionado
4. ✅ Popula os dropdowns antes de definir os valores
5. ✅ Usa try-catch individual para cada chamada (não falha tudo se uma falhar)

## Fluxo Corrigido

```
Usuário acessa /admin/databases/edit/3
         ↓
loadConnection(3) é chamado
         ↓
Busca conexão do SQLite (id=3)
         ↓
connection.type === 'NOCODB'?
         ↓ SIM
Define selectedProject e selectedTable
         ↓
Carrega workspaces (API NocoDB)
         ↓
Carrega projetos (API NocoDB)
         ↓
Carrega tabelas do projeto (API NocoDB)
         ↓
Popula dropdowns com as listas
         ↓
Select renderiza o valor selecionado ✅
```

## Dados Envolvidos

### Connection (SQLite Local)
```json
{
  "id": 3,
  "name": "MasterMegga",
  "type": "NOCODB",
  "host": "https://nocodb.wasend.com.br",
  "nocodb_token": "***",
  "nocodb_project_id": "pu8znrvha2viha9",
  "nocodb_table_id": "m2t976te0cowlfu",
  "database": "pu8znrvha2viha9",
  "table_name": "m2t976te0cowlfu"
}
```

### API Calls
1. **GET Workspaces**: `/api/v1/db/meta/workspaces`
2. **GET Projects**: `/api/v1/db/meta/projects`
3. **GET Tables**: `/api/v2/meta/bases/{projectId}/tables`

## Impacto

### Antes da Correção
- ❌ Dropdown "Tabela" aparece vazio
- ❌ Usuário não consegue ver qual tabela está selecionada
- ❌ Usuário pode pensar que precisa selecionar novamente
- ❌ Pode causar perda de configuração ao salvar

### Depois da Correção
- ✅ Dropdown "Tabela" mostra a tabela selecionada
- ✅ Usuário vê claramente qual tabela está configurada
- ✅ Pode trocar de tabela se necessário
- ✅ Configuração preservada corretamente

## Testes Recomendados

1. ✅ Acessar `/admin/databases/edit/3`
2. ✅ Verificar que dropdown "Projeto/Base" mostra "WaSend"
3. ✅ Verificar que dropdown "Tabela" mostra o nome da tabela
4. ✅ Verificar que "Configuração Válida" mostra Project e Table corretos
5. ✅ Trocar de tabela e salvar
6. ✅ Editar novamente e verificar que nova tabela aparece

## Arquivos Modificados

- `src/components/admin/DatabaseConnectionForm.tsx` (função `loadConnection`)

## Commits Relacionados

- Fix: Carregar listas de projetos e tabelas ao editar conexão NocoDB
- Resolve problema de dropdown vazio na edição de conexões

## Notas Técnicas

- Cada chamada de API tem seu próprio try-catch para não falhar tudo se uma falhar
- Workspaces são opcionais (alguns NocoDB não usam)
- Projetos e tabelas são obrigatórios para o dropdown funcionar
- O loading state já existente cobre o tempo de carregamento
