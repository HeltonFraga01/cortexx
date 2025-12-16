# Guia de Integração NocoDB

Este guia completo documenta como configurar e usar a integração NocoDB no projeto WUZAPI Manager.

## Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Estrutura de Dados](#estrutura-de-dados)
- [Implementação Backend](#implementação-backend)
- [Implementação Frontend](#implementação-frontend)
- [Mapeamento de Campos](#mapeamento-de-campos)
- [Operações CRUD](#operações-crud)
- [Autenticação e Segurança](#autenticação-e-segurança)
- [Troubleshooting](#troubleshooting)
- [Exemplos Práticos](#exemplos-práticos)

## Visão Geral

### O que é NocoDB?
NocoDB é uma plataforma que transforma qualquer banco de dados em uma interface de planilha inteligente, fornecendo APIs REST/GraphQL automáticas.

### Integração no WUZAPI Manager
- **Objetivo**: Permitir que usuários conectem suas bases NocoDB para armazenar e gerenciar dados
- **Funcionalidades**: CRUD completo, filtros por usuário, mapeamento de campos
- **Segurança**: Isolamento de dados por token de usuário

### Arquitetura
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   NocoDB        │
│   (React/TS)    │◄──►│   (Node.js)     │◄──►│   (External)    │
│                 │    │                 │    │                 │
│ - Connection UI │    │ - Database.js   │    │ - REST API      │
│ - Data Tables   │    │ - Validation    │    │ - Projects      │
│ - CRUD Forms    │    │ - Error Handle  │    │ - Tables        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuração

### Variáveis de Ambiente

```bash
# .env
NOCODB_TIMEOUT=15000
DEFAULT_RECORDS_LIMIT=100
MAX_RECORDS_PER_REQUEST=1000
```

### Configuração de Conexão

#### Dados Obrigatórios
- **Host**: URL base do NocoDB (ex: `https://app.nocodb.com`)
- **Token**: Token de autenticação (`xc-token`)
- **Project ID**: ID do projeto/workspace
- **Table ID**: ID da tabela específica

#### Dados Opcionais
- **User Link Field**: Campo que vincula registros ao usuário (padrão: `wasendToken`)
- **Field Mappings**: Mapeamento personalizado de campos

### Exemplo de Configuração
```javascript
const nocodbConnection = {
  name: 'Leads NocoDB',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_123456789',
  nocodb_project_id: 'p_abc123def456',
  nocodb_table_id: 't_xyz789uvw012',
  user_link_field: 'wasendToken',
  status: 'connected'
};
```

## Estrutura de Dados

### Tabela database_connections
```sql
CREATE TABLE database_connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT CHECK(type = 'NOCODB'),
  host TEXT NOT NULL,
  nocodb_token TEXT,
  nocodb_project_id TEXT,
  nocodb_table_id TEXT,
  user_link_field TEXT,
  field_mappings TEXT DEFAULT '[]',
  status TEXT DEFAULT 'disconnected',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Interface TypeScript
```typescript
interface DatabaseConnection {
  id?: number;
  name: string;
  type: 'NOCODB';
  host: string;
  nocodb_token: string;
  nocodb_project_id: string;
  nocodb_table_id: string;
  user_link_field?: string;
  fieldMappings?: FieldMapping[];
  status: 'connected' | 'disconnected' | 'error' | 'testing';
}

interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
}
```## I
mplementação Backend

### Classe Database - Métodos NocoDB

#### Teste de Conexão
```javascript
async testNocoDBConnection(connection) {
  try {
    const axios = require('axios');
    const testApi = axios.create({
      baseURL: connection.host,
      headers: {
        'xc-token': connection.nocodb_token || connection.password || '',
      },
      timeout: 10000,
    });

    // Testar com a API do NocoDB
    await testApi.get(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
      { params: { limit: 1 } }
    );

    return true;
  } catch (error) {
    logger.warn('⚠️ Falha no teste NocoDB:', error.message);
    return false;
  }
}
```

#### Buscar Dados da Tabela
```javascript
async getNocoDBTableData(connection, userToken) {
  try {
    // Validações
    if (!connection.host) {
      throw new Error('URL base do NocoDB não configurada');
    }
    
    if (!connection.nocodb_token) {
      throw new Error('Token de autenticação do NocoDB não configurado');
    }

    const axios = require('axios');
    const projectId = connection.nocodb_project_id || connection.database;
    const tableId = connection.nocodb_table_id || connection.table_name;
    const userLinkField = connection.user_link_field || 'wasendToken';
    
    const nocoApi = axios.create({
      baseURL: connection.host,
      headers: {
        'xc-token': connection.nocodb_token,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Filtrar dados pelo token do usuário
    const response = await nocoApi.get(
      `/api/v1/db/data/noco/${projectId}/${tableId}`,
      {
        params: { 
          limit: 100,
          where: `(${userLinkField},eq,${userToken})`
        },
      }
    );

    const data = response.data?.list || response.data || [];
    
    logger.info('✅ Dados NocoDB recuperados:', { 
      projectId, 
      tableId, 
      recordCount: data.length
    });

    return data;

  } catch (error) {
    // Tratamento específico de erros
    if (error.response?.status === 401) {
      throw new Error('Token de autenticação NocoDB inválido');
    } else if (error.response?.status === 404) {
      throw new Error('Projeto ou tabela não encontrados no NocoDB');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Servidor NocoDB indisponível');
    }
    
    throw new Error(`Falha na API NocoDB: ${error.message}`);
  }
}
```

### Rotas da API

#### Listar Conexões do Usuário
```javascript
// GET /api/user/database-connections
app.get('/api/user/database-connections', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const connections = await db.getUserConnections(userToken);
    
    res.json({
      success: true,
      data: connections,
      count: connections.length
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
});
```

#### Buscar Dados da Tabela
```javascript
// GET /api/user/database-connections/:id/data
app.get('/api/user/database-connections/:id/data', verifyUserToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userToken = req.userToken;
    
    const data = await db.getUserTableData(userToken, parseInt(id));
    
    res.json({
      success: true,
      data: data,
      metadata: {
        totalRecords: data.length,
        connectionId: parseInt(id),
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    let statusCode = 500;
    
    if (error.message.includes('Connection not found')) {
      statusCode = 404;
    } else if (error.message.includes('Access denied')) {
      statusCode = 403;
    } else if (error.message.includes('Invalid or expired token')) {
      statusCode = 401;
    }
    
    res.status(statusCode).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
```

## Implementação Frontend

### Serviço NocoDBService

#### Configuração Básica
```typescript
export class NocoDBService {
  private api: AxiosInstance;
  private baseURL: string;
  private token: string;
  private projectId: string;
  private tableId: string;

  constructor(
    baseURL: string = 'https://nocodb.wasend.com.br',
    token: string = 'WgklOl_iKz8i54X1YPh-Jq_VnBQTV0VN693_y8jw',
    projectId: string = 'pu8znrvha2vlha9',
    tableId: string = 'm2t976te0cowtfu'
  ) {
    this.baseURL = baseURL;
    this.token = token;
    this.projectId = projectId;
    this.tableId = tableId;

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'xc-token': this.token,
        'Content-Type': 'application/json',
      },
    });
  }
}
```

#### Operações CRUD
```typescript
// Buscar configuração do usuário
async getUserConfig(wasendToken: string): Promise<UserConfig | null> {
  try {
    const response = await this.api.get(
      `/api/v1/db/data/noco/${this.projectId}/${this.tableId}`,
      {
        params: {
          where: `(wasendToken,eq,${wasendToken})`,
          limit: 1,
        },
      }
    );

    if (response.data?.list?.length > 0) {
      return response.data.list[0];
    }

    return null;
  } catch (error) {
    console.error('Erro ao buscar configuração:', error);
    throw new Error('Falha ao carregar configurações do NocoDB');
  }
}

// Atualizar configuração
async updateUserConfig(rowId: number, data: Partial<UserConfig>): Promise<UserConfig> {
  try {
    const { Id, wasendToken, ...updateData } = data;

    const response = await this.api.patch(
      `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/${rowId}`,
      updateData
    );

    return response.data;
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    throw new Error('Falha ao salvar configurações no NocoDB');
  }
}

// Criar nova configuração
async createUserConfig(data: UserConfig): Promise<UserConfig> {
  try {
    const response = await this.api.post(
      `/api/v1/db/data/noco/${this.projectId}/${this.tableId}`,
      data
    );

    return response.data;
  } catch (error) {
    console.error('Erro ao criar configuração:', error);
    throw new Error('Falha ao criar configurações no NocoDB');
  }
}
```

### Serviço DatabaseConnectionsService

#### Métodos Específicos do NocoDB
```typescript
// Testar conexão NocoDB
async testNocoDBConnection(connection: DatabaseConnection): Promise<{ success: boolean; error?: string }> {
  try {
    const testApi = axios.create({
      baseURL: connection.host,
      headers: {
        'xc-token': connection.nocodb_token || connection.password || '',
      },
      timeout: 10000,
    });

    await testApi.get(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
      { params: { limit: 1 } }
    );

    return { success: true };
  } catch (error: any) {
    return { 
      success: false, 
      error: error.response?.data?.message || error.message || 'Erro de conexão com NocoDB' 
    };
  }
}

// Buscar workspaces
async getNocoDBWorkspaces(baseURL: string, token: string): Promise<Array<{id: string, title: string}>> {
  try {
    const api = axios.create({
      baseURL,
      headers: { 'xc-token': token },
      timeout: 10000,
    });

    const response = await api.get('/api/v1/db/meta/workspaces');
    return response.data.list || [];
  } catch (error: any) {
    throw new Error('Erro ao buscar workspaces do NocoDB');
  }
}

// Buscar projetos
async getNocoDBProjects(baseURL: string, token: string, workspaceId?: string): Promise<Array<{id: string, title: string}>> {
  try {
    const api = axios.create({
      baseURL,
      headers: { 'xc-token': token },
      timeout: 10000,
    });

    const endpoint = workspaceId 
      ? `/api/v1/db/meta/workspaces/${workspaceId}/bases`
      : '/api/v1/db/meta/projects';

    const response = await api.get(endpoint);
    return response.data.list || response.data || [];
  } catch (error: any) {
    throw new Error('Erro ao buscar projetos do NocoDB');
  }
}

// Buscar tabelas
async getNocoDBTables(baseURL: string, token: string, projectId: string): Promise<Array<{id: string, title: string, table_name: string}>> {
  try {
    const api = axios.create({
      baseURL,
      headers: { 'xc-token': token },
      timeout: 10000,
    });

    const response = await api.get(`/api/v1/db/meta/projects/${projectId}/tables`);
    return response.data.list || [];
  } catch (error: any) {
    throw new Error('Erro ao buscar tabelas do NocoDB');
  }
}
```

## Mapeamento de Campos

### Estrutura FieldMapping
```typescript
interface FieldMapping {
  columnName: string;  // Nome da coluna no NocoDB
  label: string;       // Label amigável para exibição
  visible: boolean;    // Se deve ser exibido na interface
  editable: boolean;   // Se pode ser editado pelo usuário
}
```

### Exemplo de Uso
```typescript
const fieldMappings: FieldMapping[] = [
  {
    columnName: 'nome',
    label: 'Nome Completo',
    visible: true,
    editable: true
  },
  {
    columnName: 'email',
    label: 'E-mail',
    visible: true,
    editable: true
  },
  {
    columnName: 'telefone',
    label: 'Telefone',
    visible: true,
    editable: false
  },
  {
    columnName: 'created_at',
    label: 'Data de Criação',
    visible: true,
    editable: false
  }
];
```

### Aplicação no Frontend
```typescript
// Componente de tabela de dados
const DataTable = ({ connection, data, fieldMappings }) => {
  const visibleFields = fieldMappings.filter(field => field.visible);
  
  return (
    <table>
      <thead>
        <tr>
          {visibleFields.map(field => (
            <th key={field.columnName}>{field.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(row => (
          <tr key={row.Id}>
            {visibleFields.map(field => (
              <td key={field.columnName}>
                {field.editable ? (
                  <input 
                    value={row[field.columnName]} 
                    onChange={(e) => updateField(row.Id, field.columnName, e.target.value)}
                  />
                ) : (
                  <span>{row[field.columnName]}</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

## Operações CRUD

### Create (Criar)
```typescript
async createRecord(connectionId: number, data: Record<string, any>): Promise<any> {
  const userToken = localStorage.getItem('userToken');
  
  const response = await fetch(`/api/user/database-connections/${connectionId}/data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      ...data,
      wasendToken: userToken // Vincular ao usuário
    })
  });
  
  if (!response.ok) {
    throw new Error('Erro ao criar registro');
  }
  
  return response.json();
}
```

### Read (Ler)
```typescript
async getTableData(connectionId: number): Promise<any[]> {
  const userToken = localStorage.getItem('userToken');
  
  const response = await fetch(`/api/user/database-connections/${connectionId}/data`, {
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao buscar dados');
  }
  
  const result = await response.json();
  return result.data || [];
}
```

### Update (Atualizar)
```typescript
async updateRecord(connectionId: number, recordId: string, data: Record<string, any>): Promise<any> {
  const userToken = localStorage.getItem('userToken');
  
  const response = await fetch(`/api/user/database-connections/${connectionId}/data/${recordId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error('Erro ao atualizar registro');
  }
  
  return response.json();
}
```

### Delete (Deletar)
```typescript
async deleteRecord(connectionId: number, recordId: string): Promise<void> {
  const userToken = localStorage.getItem('userToken');
  
  const response = await fetch(`/api/user/database-connections/${connectionId}/data/${recordId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  if (!response.ok) {
    throw new Error('Erro ao deletar registro');
  }
}
```

## Autenticação e Segurança

### Isolamento de Dados por Usuário

#### Backend - Filtro Automático
```javascript
// Filtrar dados pelo token do usuário logado
const response = await nocoApi.get(
  `/api/v1/db/data/noco/${projectId}/${tableId}`,
  {
    params: { 
      limit: finalLimit,
      where: `(${userLinkField},eq,${userToken})` // Filtro de segurança
    },
  }
);
```

#### Validação de Token
```javascript
const verifyUserToken = async (req, res, next) => {
  let userToken = null;
  
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  } else if (tokenHeader) {
    userToken = tokenHeader;
  }
  
  if (!userToken) {
    return res.status(401).json({
      error: 'Token não fornecido'
    });
  }
  
  req.userToken = userToken;
  next();
};
```

### Configuração de Permissões

#### Campo de Vinculação
- **Padrão**: `wasendToken`
- **Função**: Vincular registros ao usuário específico
- **Segurança**: Impede acesso cruzado entre usuários

#### Validação de Acesso
```javascript
// Verificar se o usuário tem acesso à conexão
const connection = await db.getConnectionById(connectionId);
const assignedUsers = JSON.parse(connection.assigned_users || '[]');

if (!assignedUsers.includes(userToken) && !assignedUsers.includes('all')) {
  throw new Error('Access denied: User not assigned to this connection');
}
```##
 Troubleshooting

### Problemas Comuns

#### 1. "Token de autenticação NocoDB inválido"

**Sintomas:**
- Erro 401 ao testar conexão
- Falha ao buscar dados

**Soluções:**
```javascript
// Verificar token
console.log('Token NocoDB:', connection.nocodb_token);

// Testar token manualmente
curl -H "xc-token: YOUR_TOKEN" \
     https://app.nocodb.com/api/v1/db/meta/projects
```

**Obter novo token:**
1. Acesse NocoDB
2. Vá em Account Settings
3. Gere novo API Token
4. Atualize a conexão

#### 2. "Projeto ou tabela não encontrados"

**Sintomas:**
- Erro 404 ao acessar dados
- Mensagem "Resource not found"

**Soluções:**
```javascript
// Verificar IDs
console.log('Project ID:', connection.nocodb_project_id);
console.log('Table ID:', connection.nocodb_table_id);

// Listar projetos disponíveis
const projects = await databaseService.getNocoDBProjects(baseURL, token);
console.log('Projetos disponíveis:', projects);

// Listar tabelas do projeto
const tables = await databaseService.getNocoDBTables(baseURL, token, projectId);
console.log('Tabelas disponíveis:', tables);
```

#### 3. "Servidor NocoDB indisponível"

**Sintomas:**
- Erro ECONNREFUSED
- Timeout na conexão

**Soluções:**
```javascript
// Verificar conectividade
const testConnection = async (baseURL) => {
  try {
    const response = await fetch(baseURL + '/api/v1/db/meta/projects', {
      method: 'HEAD',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    console.error('Conectividade falhou:', error.message);
    return false;
  }
};

// Verificar URL
console.log('Base URL:', connection.host);
const isReachable = await testConnection(connection.host);
console.log('Servidor acessível:', isReachable);
```

#### 4. "Nenhum dado retornado"

**Sintomas:**
- Array vazio mesmo com dados na tabela
- Filtro não funciona

**Soluções:**
```javascript
// Verificar campo de vinculação
console.log('User Link Field:', connection.user_link_field);
console.log('User Token:', userToken);

// Testar sem filtro (apenas para debug)
const response = await nocoApi.get(
  `/api/v1/db/data/noco/${projectId}/${tableId}`,
  { params: { limit: 5 } } // Sem filtro where
);
console.log('Dados sem filtro:', response.data);

// Verificar se campo existe na tabela
const columns = await databaseService.getNocoDBColumns(baseURL, token, tableId);
const hasUserField = columns.some(col => col.column_name === connection.user_link_field);
console.log('Campo de usuário existe:', hasUserField);
```

### Scripts de Diagnóstico

#### Teste Completo de Conexão
```javascript
async function diagnoseNocoDBConnection(connection) {
  const results = {
    connectivity: false,
    authentication: false,
    projectAccess: false,
    tableAccess: false,
    dataAccess: false,
    errors: []
  };

  try {
    // 1. Teste de conectividade
    const response = await fetch(connection.host, { method: 'HEAD', timeout: 5000 });
    results.connectivity = response.ok;
    
    if (!results.connectivity) {
      results.errors.push('Servidor não acessível');
      return results;
    }

    // 2. Teste de autenticação
    const api = axios.create({
      baseURL: connection.host,
      headers: { 'xc-token': connection.nocodb_token },
      timeout: 10000,
    });

    try {
      await api.get('/api/v1/db/meta/projects');
      results.authentication = true;
    } catch (error) {
      if (error.response?.status === 401) {
        results.errors.push('Token de autenticação inválido');
      } else {
        results.errors.push(`Erro de autenticação: ${error.message}`);
      }
      return results;
    }

    // 3. Teste de acesso ao projeto
    try {
      await api.get(`/api/v1/db/meta/projects/${connection.nocodb_project_id}`);
      results.projectAccess = true;
    } catch (error) {
      if (error.response?.status === 404) {
        results.errors.push('Projeto não encontrado');
      } else {
        results.errors.push(`Erro de acesso ao projeto: ${error.message}`);
      }
      return results;
    }

    // 4. Teste de acesso à tabela
    try {
      await api.get(`/api/v1/db/meta/tables/${connection.nocodb_table_id}`);
      results.tableAccess = true;
    } catch (error) {
      if (error.response?.status === 404) {
        results.errors.push('Tabela não encontrada');
      } else {
        results.errors.push(`Erro de acesso à tabela: ${error.message}`);
      }
      return results;
    }

    // 5. Teste de acesso aos dados
    try {
      const dataResponse = await api.get(
        `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
        { params: { limit: 1 } }
      );
      results.dataAccess = true;
      
      console.log('Estrutura dos dados:', {
        hasData: Array.isArray(dataResponse.data?.list),
        recordCount: dataResponse.data?.list?.length || 0,
        sampleRecord: dataResponse.data?.list?.[0] || null
      });
      
    } catch (error) {
      results.errors.push(`Erro de acesso aos dados: ${error.message}`);
    }

  } catch (error) {
    results.errors.push(`Erro geral: ${error.message}`);
  }

  return results;
}

// Uso
const diagnosis = await diagnoseNocoDBConnection(connection);
console.log('Diagnóstico completo:', diagnosis);
```

#### Monitor de Performance
```javascript
class NocoDBMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalTime: 0,
      slowRequests: 0
    };
  }

  async monitorRequest(operation, requestFn) {
    const startTime = Date.now();
    this.metrics.requests++;

    try {
      const result = await requestFn();
      const duration = Date.now() - startTime;
      this.metrics.totalTime += duration;

      if (duration > 5000) { // 5 segundos
        this.metrics.slowRequests++;
        console.warn(`Requisição lenta NocoDB (${operation}): ${duration}ms`);
      }

      console.log(`NocoDB ${operation}: ${duration}ms`);
      return result;

    } catch (error) {
      this.metrics.errors++;
      const duration = Date.now() - startTime;
      
      console.error(`Erro NocoDB ${operation} (${duration}ms):`, error.message);
      throw error;
    }
  }

  getStats() {
    const avgTime = this.metrics.requests > 0 
      ? this.metrics.totalTime / this.metrics.requests 
      : 0;
      
    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests) * 100 
      : 0;

    return {
      totalRequests: this.metrics.requests,
      totalErrors: this.metrics.errors,
      averageTime: Math.round(avgTime),
      errorRate: Math.round(errorRate * 100) / 100,
      slowRequests: this.metrics.slowRequests
    };
  }
}

// Uso
const monitor = new NocoDBMonitor();

const data = await monitor.monitorRequest('getUserData', async () => {
  return await nocoDBService.getUserConfig(userToken);
});

console.log('Estatísticas NocoDB:', monitor.getStats());
```

## Exemplos Práticos

### 1. Configuração Completa de Conexão

```typescript
// Frontend - Formulário de configuração
const NocoDBConnectionForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    host: 'https://app.nocodb.com',
    nocodb_token: '',
    nocodb_project_id: '',
    nocodb_table_id: '',
    user_link_field: 'wasendToken'
  });

  const [projects, setProjects] = useState([]);
  const [tables, setTables] = useState([]);
  const [testing, setTesting] = useState(false);

  // Buscar projetos quando token for inserido
  const handleTokenChange = async (token) => {
    setFormData(prev => ({ ...prev, nocodb_token: token }));
    
    if (token && formData.host) {
      try {
        const projectsList = await databaseService.getNocoDBProjects(formData.host, token);
        setProjects(projectsList);
      } catch (error) {
        toast.error('Erro ao buscar projetos: ' + error.message);
      }
    }
  };

  // Buscar tabelas quando projeto for selecionado
  const handleProjectChange = async (projectId) => {
    setFormData(prev => ({ ...prev, nocodb_project_id: projectId }));
    
    if (projectId && formData.nocodb_token) {
      try {
        const tablesList = await databaseService.getNocoDBTables(
          formData.host, 
          formData.nocodb_token, 
          projectId
        );
        setTables(tablesList);
      } catch (error) {
        toast.error('Erro ao buscar tabelas: ' + error.message);
      }
    }
  };

  // Testar conexão
  const testConnection = async () => {
    setTesting(true);
    try {
      const result = await databaseService.testNocoDBConnection(formData);
      if (result.success) {
        toast.success('Conexão testada com sucesso!');
      } else {
        toast.error('Falha no teste: ' + result.error);
      }
    } catch (error) {
      toast.error('Erro no teste: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <form>
      <input
        placeholder="Nome da conexão"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
      />
      
      <input
        placeholder="URL do NocoDB"
        value={formData.host}
        onChange={(e) => setFormData(prev => ({ ...prev, host: e.target.value }))}
      />
      
      <input
        placeholder="Token de autenticação"
        value={formData.nocodb_token}
        onChange={(e) => handleTokenChange(e.target.value)}
      />
      
      <select
        value={formData.nocodb_project_id}
        onChange={(e) => handleProjectChange(e.target.value)}
      >
        <option value="">Selecione um projeto</option>
        {projects.map(project => (
          <option key={project.id} value={project.id}>
            {project.title}
          </option>
        ))}
      </select>
      
      <select
        value={formData.nocodb_table_id}
        onChange={(e) => setFormData(prev => ({ ...prev, nocodb_table_id: e.target.value }))}
      >
        <option value="">Selecione uma tabela</option>
        {tables.map(table => (
          <option key={table.id} value={table.id}>
            {table.title}
          </option>
        ))}
      </select>
      
      <input
        placeholder="Campo de vinculação do usuário"
        value={formData.user_link_field}
        onChange={(e) => setFormData(prev => ({ ...prev, user_link_field: e.target.value }))}
      />
      
      <button type="button" onClick={testConnection} disabled={testing}>
        {testing ? 'Testando...' : 'Testar Conexão'}
      </button>
    </form>
  );
};
```

### 2. Interface de Dados com CRUD

```typescript
// Componente de tabela de dados NocoDB
const NocoDBDataTable = ({ connectionId }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState(null);

  // Carregar dados
  const loadData = async () => {
    try {
      setLoading(true);
      const tableData = await databaseService.getUserTableData(
        localStorage.getItem('userToken'), 
        connectionId
      );
      setData(tableData);
    } catch (error) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Criar registro
  const createRecord = async (newData) => {
    try {
      await databaseService.createUserTableRecord(
        localStorage.getItem('userToken'),
        connectionId,
        newData
      );
      toast.success('Registro criado com sucesso!');
      loadData(); // Recarregar dados
    } catch (error) {
      toast.error('Erro ao criar registro: ' + error.message);
    }
  };

  // Atualizar registro
  const updateRecord = async (recordId, updatedData) => {
    try {
      await databaseService.updateUserTableRecord(
        localStorage.getItem('userToken'),
        connectionId,
        recordId,
        updatedData
      );
      toast.success('Registro atualizado com sucesso!');
      setEditingRow(null);
      loadData(); // Recarregar dados
    } catch (error) {
      toast.error('Erro ao atualizar registro: ' + error.message);
    }
  };

  // Deletar registro
  const deleteRecord = async (recordId) => {
    if (!confirm('Tem certeza que deseja deletar este registro?')) return;
    
    try {
      await databaseService.deleteUserTableRecord(
        localStorage.getItem('userToken'),
        connectionId,
        recordId
      );
      toast.success('Registro deletado com sucesso!');
      loadData(); // Recarregar dados
    } catch (error) {
      toast.error('Erro ao deletar registro: ' + error.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [connectionId]);

  if (loading) {
    return <div>Carregando dados...</div>;
  }

  return (
    <div>
      <button onClick={() => setEditingRow('new')}>
        Novo Registro
      </button>
      
      <table>
        <thead>
          <tr>
            {data.length > 0 && Object.keys(data[0]).map(key => (
              <th key={key}>{key}</th>
            ))}
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {editingRow === 'new' && (
            <NewRecordRow 
              onSave={createRecord}
              onCancel={() => setEditingRow(null)}
            />
          )}
          
          {data.map(row => (
            <tr key={row.Id}>
              {Object.entries(row).map(([key, value]) => (
                <td key={key}>
                  {editingRow === row.Id ? (
                    <input 
                      defaultValue={value}
                      onBlur={(e) => updateRecord(row.Id, { [key]: e.target.value })}
                    />
                  ) : (
                    <span>{value}</span>
                  )}
                </td>
              ))}
              <td>
                {editingRow === row.Id ? (
                  <button onClick={() => setEditingRow(null)}>Salvar</button>
                ) : (
                  <>
                    <button onClick={() => setEditingRow(row.Id)}>Editar</button>
                    <button onClick={() => deleteRecord(row.Id)}>Deletar</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### 3. Hook Personalizado para NocoDB

```typescript
// Hook para gerenciar dados NocoDB
const useNocoDBData = (connectionId: number) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const userToken = localStorage.getItem('userToken');

  // Carregar dados
  const loadData = useCallback(async () => {
    if (!connectionId || !userToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await databaseService.getUserTableData(userToken, connectionId);
      setData(result);
    } catch (err) {
      setError(err.message);
      console.error('Erro ao carregar dados NocoDB:', err);
    } finally {
      setLoading(false);
    }
  }, [connectionId, userToken]);

  // Criar registro
  const createRecord = useCallback(async (recordData) => {
    if (!connectionId || !userToken) return;

    try {
      await databaseService.createUserTableRecord(userToken, connectionId, recordData);
      await loadData(); // Recarregar dados
      return { success: true };
    } catch (err) {
      console.error('Erro ao criar registro:', err);
      return { success: false, error: err.message };
    }
  }, [connectionId, userToken, loadData]);

  // Atualizar registro
  const updateRecord = useCallback(async (recordId, recordData) => {
    if (!connectionId || !userToken) return;

    try {
      await databaseService.updateUserTableRecord(userToken, connectionId, recordId, recordData);
      await loadData(); // Recarregar dados
      return { success: true };
    } catch (err) {
      console.error('Erro ao atualizar registro:', err);
      return { success: false, error: err.message };
    }
  }, [connectionId, userToken, loadData]);

  // Deletar registro
  const deleteRecord = useCallback(async (recordId) => {
    if (!connectionId || !userToken) return;

    try {
      await databaseService.deleteUserTableRecord(userToken, connectionId, recordId);
      await loadData(); // Recarregar dados
      return { success: true };
    } catch (err) {
      console.error('Erro ao deletar registro:', err);
      return { success: false, error: err.message };
    }
  }, [connectionId, userToken, loadData]);

  // Carregar dados automaticamente
  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    loading,
    error,
    loadData,
    createRecord,
    updateRecord,
    deleteRecord,
    hasData: data.length > 0
  };
};

// Uso do hook
const MyComponent = ({ connectionId }) => {
  const { 
    data, 
    loading, 
    error, 
    createRecord, 
    updateRecord, 
    deleteRecord 
  } = useNocoDBData(connectionId);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;

  return (
    <div>
      <h3>Dados NocoDB ({data.length} registros)</h3>
      {/* Renderizar dados */}
    </div>
  );
};
```

---

**Conclusão**: Esta documentação fornece um guia completo para integração NocoDB no WUZAPI Manager, cobrindo desde configuração básica até implementações avançadas com tratamento de erros e monitoramento de performance.