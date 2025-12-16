# Advanced View Builder - API Documentation

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estruturas de Dados](#estruturas-de-dados)
3. [Endpoints](#endpoints)
4. [Exemplos](#exemplos)
5. [Validação](#validação)

---

## Visão Geral

Esta documentação descreve as estruturas de dados e endpoints da API relacionados ao Advanced View Builder.

**Base URL**: `/api`

**Autenticação**: Bearer token via header `Authorization` ou `token`

---

## Estruturas de Dados

### FieldMapping

Configuração de mapeamento de campos.

```typescript
interface FieldMapping {
  columnName: string;        // Nome da coluna no banco
  label: string;             // Rótulo amigável
  visible: boolean;          // Se o campo é visível
  editable: boolean;         // Se o campo é editável
  showInCard?: boolean;      // Se aparece em cards Kanban
  helperText?: string;       // Texto de ajuda (máx 500 chars)
}
```

**Validação:**
- `columnName`: obrigatório, string não vazia
- `label`: obrigatório, string não vazia
- `helperText`: opcional, máximo 500 caracteres

---

### ViewConfiguration

Configuração de visualizações avançadas.

```typescript
interface ViewConfiguration {
  calendar?: CalendarViewConfig;
  kanban?: KanbanViewConfig;
}

interface CalendarViewConfig {
  enabled: boolean;
  dateField?: string;  // Nome da coluna de data
}

interface KanbanViewConfig {
  enabled: boolean;
  statusField?: string;  // Nome da coluna de status
}
```

**Validação:**
- Se `calendar.enabled = true`, `dateField` é obrigatório
- Se `kanban.enabled = true`, `statusField` é obrigatório
- `dateField` deve ser do tipo Date/DateTime
- `statusField` deve existir na tabela

---

### DatabaseConnection

Configuração completa de conexão.

```typescript
interface DatabaseConnection {
  id?: number;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assignedUsers: string[];
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  user_link_field?: string;
  fieldMappings?: FieldMapping[];
  viewConfiguration?: ViewConfiguration;  // NOVO
  created_at?: string;
  updated_at?: string;
}
```

---

## Endpoints

### 1. Listar Conexões

```http
GET /api/database-connections
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Conexão Principal",
      "type": "NOCODB",
      "fieldMappings": [...],
      "viewConfiguration": {
        "calendar": {
          "enabled": true,
          "dateField": "created_at"
        },
        "kanban": {
          "enabled": true,
          "statusField": "status"
        }
      }
    }
  ],
  "count": 1
}
```

---

### 2. Buscar Conexão por ID

```http
GET /api/database-connections/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Conexão Principal",
    "viewConfiguration": {...}
  }
}
```

---

### 3. Criar Conexão

```http
POST /api/database-connections
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Nova Conexão",
  "type": "NOCODB",
  "host": "https://nocodb.example.com",
  "port": 443,
  "database": "project_id",
  "username": "",
  "password": "",
  "table_name": "table_id",
  "nocodb_token": "token_here",
  "nocodb_project_id": "project_id",
  "nocodb_table_id": "table_id",
  "assignedUsers": ["user1", "user2"],
  "fieldMappings": [
    {
      "columnName": "name",
      "label": "Nome",
      "visible": true,
      "editable": true,
      "showInCard": true,
      "helperText": "Digite seu nome completo"
    }
  ],
  "viewConfiguration": {
    "calendar": {
      "enabled": true,
      "dateField": "created_at"
    },
    "kanban": {
      "enabled": true,
      "statusField": "status"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Conexão criada com sucesso",
  "data": {
    "id": 2,
    ...
  }
}
```

**Erros:**
```json
{
  "success": false,
  "error": "Configuração de visualização inválida",
  "errors": [
    "calendar.dateField é obrigatório quando calendar está habilitado"
  ]
}
```

---

### 4. Atualizar Conexão

```http
PUT /api/database-connections/:id
Content-Type: application/json
```

**Request Body:** (mesmo formato do POST)

**Response:**
```json
{
  "success": true,
  "message": "Conexão atualizada com sucesso",
  "data": {...}
}
```

---

### 5. Deletar Conexão

```http
DELETE /api/database-connections/:id
```

**Response:**
```json
{
  "success": true,
  "message": "Conexão deletada com sucesso"
}
```

---

## Exemplos

### Exemplo 1: Habilitar apenas Calendar

```json
{
  "viewConfiguration": {
    "calendar": {
      "enabled": true,
      "dateField": "event_date"
    }
  }
}
```

### Exemplo 2: Habilitar apenas Kanban

```json
{
  "viewConfiguration": {
    "kanban": {
      "enabled": true,
      "statusField": "stage"
    }
  }
}
```

### Exemplo 3: Habilitar ambos

```json
{
  "viewConfiguration": {
    "calendar": {
      "enabled": true,
      "dateField": "due_date"
    },
    "kanban": {
      "enabled": true,
      "statusField": "status"
    }
  }
}
```

### Exemplo 4: Desabilitar visualizações

```json
{
  "viewConfiguration": {
    "calendar": {
      "enabled": false
    },
    "kanban": {
      "enabled": false
    }
  }
}
```

ou simplesmente:

```json
{
  "viewConfiguration": null
}
```

---

## Validação

### Regras de Validação

**FieldMappings:**
- ✅ `columnName` e `label` são obrigatórios
- ✅ `helperText` máximo 500 caracteres
- ✅ `visible`, `editable`, `showInCard` devem ser booleanos

**ViewConfiguration:**
- ✅ Se `calendar.enabled = true`, `dateField` é obrigatório
- ✅ Se `kanban.enabled = true`, `statusField` é obrigatório
- ✅ Campos devem existir na tabela (validado no backend)
- ✅ `dateField` deve ser tipo Date/DateTime (validado no backend)

### Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 400 | Dados inválidos |
| 404 | Conexão não encontrada |
| 500 | Erro interno do servidor |

### Mensagens de Erro Comuns

```json
{
  "error": "Configuração de visualização inválida",
  "errors": [
    "calendar.dateField é obrigatório quando calendar está habilitado",
    "Campo de data 'invalid_field' não encontrado na tabela",
    "Campo 'text_field' não é do tipo Date/DateTime (tipo atual: SingleLineText)"
  ]
}
```

---

## Migração de Dados

### Schema do Banco

```sql
ALTER TABLE database_connections 
ADD COLUMN view_configuration TEXT DEFAULT NULL;
```

### Formato JSON no Banco

```json
{
  "calendar": {
    "enabled": true,
    "dateField": "created_at"
  },
  "kanban": {
    "enabled": true,
    "statusField": "status"
  }
}
```

---

## Compatibilidade

**Backward Compatibility:**
- ✅ Conexões sem `viewConfiguration` funcionam normalmente
- ✅ `viewConfiguration = null` é válido
- ✅ Apenas visualização de Formulário é exibida se não configurado

**Forward Compatibility:**
- ✅ Novos campos podem ser adicionados sem quebrar código existente
- ✅ Campos desconhecidos são ignorados

---

## Notas de Implementação

### Frontend

```typescript
// Verificar se Calendar está disponível
const calendarAvailable = 
  connection.viewConfiguration?.calendar?.enabled &&
  connection.viewConfiguration?.calendar?.dateField;

// Verificar se Kanban está disponível
const kanbanAvailable = 
  connection.viewConfiguration?.kanban?.enabled &&
  connection.viewConfiguration?.kanban?.statusField;
```

### Backend

```javascript
// Parsing de view_configuration
const viewConfig = JSON.parse(row.view_configuration || 'null');

// Validação
const { valid, errors } = validateViewConfiguration(viewConfig, columns);
if (!valid) {
  return res.status(400).json({ error: errors });
}
```

---

**Versão da API**: 1.0.0  
**Última atualização**: 2025-11-07
