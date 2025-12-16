# Guia de Operações CRUD - NocoDB

Documentação completa para operações Create, Read, Update e Delete com NocoDB no WUZAPI Manager.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Configuração Inicial](#configuração-inicial)
- [Operação CREATE](#operação-create)
- [Operação READ](#operação-read)
- [Operação UPDATE](#operação-update)
- [Operação DELETE](#operação-delete)
- [Padrões de Implementação](#padrões-de-implementação)
- [Tratamento de Erros](#tratamento-de-erros)
- [Validações](#validações)
- [Performance](#performance)
- [Exemplos Práticos](#exemplos-práticos)

## Visão Geral

### Arquitetura CRUD
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   NocoDB API    │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Create    │◄┼────┼►│createRecord │◄┼────┼►│    POST     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │    Read     │◄┼────┼►│  getData    │◄┼────┼►│     GET     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Update    │◄┼────┼►│updateRecord │◄┼────┼►│    PATCH    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Delete    │◄┼────┼►│deleteRecord │◄┼────┼►│   DELETE    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Fluxo de Segurança
1. **Autenticação**: Validação do token do usuário
2. **Autorização**: Verificação de acesso à conexão
3. **Filtro**: Isolamento de dados por usuário
4. **Validação**: Verificação de dados de entrada
5. **Execução**: Operação na API NocoDB
6. **Auditoria**: Log da operação realizada

## Configuração Inicial

### Estrutura de Conexão
```javascript
const connection = {
  id: 1,
  name: 'Base de Leads',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_123456789',
  nocodb_project_id: 'p_abc123def456',
  nocodb_table_id: 't_xyz789uvw012',
  user_link_field: 'wasendToken',
  status: 'connected'
};
```### 
Cliente API NocoDB
```javascript
const createNocoDBClient = (connection) => {
  return axios.create({
    baseURL: connection.host,
    headers: {
      'xc-token': connection.nocodb_token,
      'Content-Type': 'application/json'
    },
    timeout: 15000
  });
};
```

## Operação CREATE

### Backend Implementation
```javascript
async createNocoDBRecord(connection, recordData, userToken) {
  try {
    // 1. Validar dados de entrada
    const validatedData = this.validateRecordData(recordData);
    
    // 2. Adicionar campo de vinculação do usuário
    validatedData[connection.user_link_field || 'wasendToken'] = userToken;
    
    // 3. Criar cliente API
    const nocoApi = createNocoDBClient(connection);
    
    // 4. Executar criação
    const response = await nocoApi.post(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
      validatedData
    );
    
    // 5. Log da operação
    logger.info('✅ Registro NocoDB criado:', {
      connectionId: connection.id,
      recordId: response.data.Id,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    return response.data;
    
  } catch (error) {
    logger.error('❌ Erro ao criar registro NocoDB:', {
      error: error.message,
      connectionId: connection.id,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    throw this.handleNocoDBError(error, 'CREATE');
  }
}
```

### Frontend Implementation
```typescript
const createRecord = async (connectionId: number, data: Record<string, any>) => {
  try {
    const userToken = localStorage.getItem('userToken');
    
    const response = await fetch(`/api/user/database-connections/${connectionId}/data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao criar registro');
    }
    
    const result = await response.json();
    return result.data;
    
  } catch (error) {
    console.error('Erro ao criar registro:', error);
    throw error;
  }
};
```

### Exemplo de Uso
```javascript
// Criar lead de vendas
const leadData = {
  nome: 'João Silva',
  email: 'joao@example.com',
  telefone: '+5511999999999',
  empresa: 'Empresa ABC',
  status: 'novo',
  fonte: 'whatsapp',
  observacoes: 'Interessado em nossos produtos'
};

const newLead = await createRecord(connectionId, leadData);
console.log('Lead criado:', newLead);
```

## Operação READ

### Backend Implementation
```javascript
async getNocoDBTableData(connection, userToken) {
  try {
    // 1. Validar parâmetros
    if (!connection.host || !connection.nocodb_token) {
      throw new Error('Configuração de conexão incompleta');
    }
    
    // 2. Configurar limites
    const limit = parseInt(process.env.DEFAULT_RECORDS_LIMIT) || 100;
    const userLinkField = connection.user_link_field || 'wasendToken';
    
    // 3. Criar cliente API
    const nocoApi = createNocoDBClient(connection);
    
    // 4. Executar consulta com filtro de usuário
    const response = await nocoApi.get(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
      {
        params: { 
          limit: limit,
          where: `(${userLinkField},eq,${userToken})`
        }
      }
    );
    
    const data = response.data?.list || response.data || [];
    
    // 5. Log da operação
    logger.info('✅ Dados NocoDB recuperados:', {
      connectionId: connection.id,
      recordCount: data.length,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    return data;
    
  } catch (error) {
    logger.error('❌ Erro ao buscar dados NocoDB:', {
      error: error.message,
      connectionId: connection.id,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    throw this.handleNocoDBError(error, 'READ');
  }
}
```

### Frontend Implementation
```typescript
const getTableData = async (connectionId: number): Promise<any[]> => {
  try {
    const userToken = localStorage.getItem('userToken');
    
    const response = await fetch(`/api/user/database-connections/${connectionId}/data`, {
      headers: {
        'Authorization': `Bearer ${userToken}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar dados');
    }
    
    const result = await response.json();
    return result.data || [];
    
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
    throw error;
  }
};
```

### Consultas Avançadas
```javascript
// Buscar com filtros adicionais
const getFilteredData = async (connection, userToken, filters = {}) => {
  const userLinkField = connection.user_link_field || 'wasendToken';
  let whereClause = `(${userLinkField},eq,${userToken})`;
  
  // Adicionar filtros adicionais
  if (filters.status) {
    whereClause += ` and (status,eq,${filters.status})`;
  }
  
  if (filters.dateFrom) {
    whereClause += ` and (created_at,gte,${filters.dateFrom})`;
  }
  
  if (filters.search) {
    whereClause += ` and (nome,like,%${filters.search}%)`;
  }
  
  const nocoApi = createNocoDBClient(connection);
  
  const response = await nocoApi.get(
    `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
    {
      params: { 
        where: whereClause,
        limit: filters.limit || 100,
        offset: filters.offset || 0,
        sort: filters.sort || '-created_at'
      }
    }
  );
  
  return response.data?.list || [];
};
```

## Operação UPDATE

### Backend Implementation
```javascript
async updateNocoDBRecord(connection, recordId, recordData, userToken) {
  try {
    // 1. Validar dados de entrada
    const validatedData = this.validateRecordData(recordData);
    
    // 2. Remover campos que não devem ser atualizados
    delete validatedData.Id;
    delete validatedData[connection.user_link_field || 'wasendToken'];
    delete validatedData.created_at;
    
    // 3. Criar cliente API
    const nocoApi = createNocoDBClient(connection);
    
    // 4. Verificar se o registro pertence ao usuário
    await this.verifyRecordOwnership(connection, recordId, userToken);
    
    // 5. Executar atualização
    const response = await nocoApi.patch(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`,
      validatedData
    );
    
    // 6. Log da operação
    logger.info('✅ Registro NocoDB atualizado:', {
      connectionId: connection.id,
      recordId: recordId,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    return response.data;
    
  } catch (error) {
    logger.error('❌ Erro ao atualizar registro NocoDB:', {
      error: error.message,
      connectionId: connection.id,
      recordId: recordId,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    throw this.handleNocoDBError(error, 'UPDATE');
  }
}
```

### Verificação de Propriedade
```javascript
async verifyRecordOwnership(connection, recordId, userToken) {
  const nocoApi = createNocoDBClient(connection);
  const userLinkField = connection.user_link_field || 'wasendToken';
  
  try {
    const response = await nocoApi.get(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`
    );
    
    const record = response.data;
    
    if (!record || record[userLinkField] !== userToken) {
      throw new Error('Registro não encontrado ou acesso negado');
    }
    
    return true;
    
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error('Registro não encontrado');
    }
    throw error;
  }
}
```

### Frontend Implementation
```typescript
const updateRecord = async (
  connectionId: number, 
  recordId: string, 
  data: Record<string, any>
): Promise<any> => {
  try {
    const userToken = localStorage.getItem('userToken');
    
    const response = await fetch(
      `/api/user/database-connections/${connectionId}/data/${recordId}`, 
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify(data)
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao atualizar registro');
    }
    
    const result = await response.json();
    return result.data;
    
  } catch (error) {
    console.error('Erro ao atualizar registro:', error);
    throw error;
  }
};
```

## Operação DELETE

### Backend Implementation
```javascript
async deleteNocoDBRecord(connection, recordId, userToken) {
  try {
    // 1. Criar cliente API
    const nocoApi = createNocoDBClient(connection);
    
    // 2. Verificar se o registro pertence ao usuário
    await this.verifyRecordOwnership(connection, recordId, userToken);
    
    // 3. Executar deleção
    const response = await nocoApi.delete(
      `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}/${recordId}`
    );
    
    // 4. Log da operação
    logger.info('✅ Registro NocoDB deletado:', {
      connectionId: connection.id,
      recordId: recordId,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    return { success: true, recordId: recordId };
    
  } catch (error) {
    logger.error('❌ Erro ao deletar registro NocoDB:', {
      error: error.message,
      connectionId: connection.id,
      recordId: recordId,
      userToken: userToken.substring(0, 8) + '...'
    });
    
    throw this.handleNocoDBError(error, 'DELETE');
  }
}
```

### Frontend Implementation
```typescript
const deleteRecord = async (connectionId: number, recordId: string): Promise<void> => {
  try {
    const userToken = localStorage.getItem('userToken');
    
    const response = await fetch(
      `/api/user/database-connections/${connectionId}/data/${recordId}`, 
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`
        }
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao deletar registro');
    }
    
  } catch (error) {
    console.error('Erro ao deletar registro:', error);
    throw error;
  }
};
```

### Deleção com Confirmação
```typescript
const deleteRecordWithConfirmation = async (
  connectionId: number, 
  recordId: string, 
  recordName?: string
): Promise<boolean> => {
  const confirmMessage = recordName 
    ? `Tem certeza que deseja deletar "${recordName}"?`
    : 'Tem certeza que deseja deletar este registro?';
    
  if (!confirm(confirmMessage)) {
    return false;
  }
  
  try {
    await deleteRecord(connectionId, recordId);
    return true;
  } catch (error) {
    alert('Erro ao deletar registro: ' + error.message);
    return false;
  }
};
```

## Padrões de Implementação

### Service Layer Pattern
```typescript
class NocoDBCRUDService {
  constructor(private connectionId: number) {}
  
  async create(data: Record<string, any>) {
    return await createRecord(this.connectionId, data);
  }
  
  async read(filters?: Record<string, any>) {
    return await getTableData(this.connectionId, filters);
  }
  
  async update(recordId: string, data: Record<string, any>) {
    return await updateRecord(this.connectionId, recordId, data);
  }
  
  async delete(recordId: string) {
    return await deleteRecord(this.connectionId, recordId);
  }
  
  async findById(recordId: string) {
    const data = await this.read({ id: recordId });
    return data.find(record => record.Id === recordId) || null;
  }
}
```

### Repository Pattern
```typescript
interface NocoDBRepository<T> {
  create(entity: Partial<T>): Promise<T>;
  findAll(filters?: Record<string, any>): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  update(id: string, entity: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

class LeadsRepository implements NocoDBRepository<Lead> {
  constructor(private service: NocoDBCRUDService) {}
  
  async create(lead: Partial<Lead>): Promise<Lead> {
    const data = await this.service.create(lead);
    return this.mapToLead(data);
  }
  
  async findAll(filters?: Record<string, any>): Promise<Lead[]> {
    const data = await this.service.read(filters);
    return data.map(item => this.mapToLead(item));
  }
  
  // ... outros métodos
  
  private mapToLead(data: any): Lead {
    return {
      id: data.Id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      status: data.status,
      createdAt: new Date(data.created_at)
    };
  }
}
```

## Tratamento de Erros

### Mapeamento de Erros NocoDB
```javascript
handleNocoDBError(error, operation) {
  const errorMap = {
    400: 'Dados inválidos fornecidos',
    401: 'Token de autenticação inválido ou expirado',
    403: 'Sem permissão para acessar este recurso',
    404: 'Registro ou recurso não encontrado',
    409: 'Conflito - registro já existe',
    422: 'Dados não processáveis - verifique os campos obrigatórios',
    429: 'Muitas requisições - tente novamente em alguns segundos',
    500: 'Erro interno do servidor NocoDB',
    502: 'Servidor NocoDB indisponível',
    503: 'Serviço NocoDB temporariamente indisponível',
    504: 'Timeout na conexão com NocoDB'
  };
  
  if (error.response) {
    const status = error.response.status;
    const message = errorMap[status] || `Erro HTTP ${status}`;
    
    logger.error(`Erro NocoDB ${operation}:`, {
      status,
      message,
      data: error.response.data
    });
    
    throw new Error(`${operation} falhou: ${message}`);
  }
  
  if (error.code === 'ECONNREFUSED') {
    throw new Error(`${operation} falhou: Servidor NocoDB indisponível`);
  }
  
  if (error.code === 'ETIMEDOUT') {
    throw new Error(`${operation} falhou: Timeout na conexão`);
  }
  
  throw new Error(`${operation} falhou: ${error.message}`);
}
```

### Retry Logic
```javascript
async executeWithRetry(operation, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Retry apenas para erros temporários
      if (this.isRetryableError(error)) {
        logger.warn(`Tentativa ${attempt} falhou, tentando novamente em ${delay}ms:`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Backoff exponencial
      } else {
        throw error;
      }
    }
  }
}

isRetryableError(error) {
  const retryableCodes = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'];
  const retryableStatuses = [429, 502, 503, 504];
  
  return retryableCodes.includes(error.code) || 
         retryableStatuses.includes(error.response?.status);
}
```

## Validações

### Validação de Dados de Entrada
```javascript
validateRecordData(data) {
  const validated = {};
  const errors = [];
  
  // Validar tipos de dados
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      continue; // Permitir valores nulos
    }
    
    // Validações específicas por tipo de campo
    if (key === 'email' && value) {
      if (!this.isValidEmail(value)) {
        errors.push(`Email inválido: ${value}`);
        continue;
      }
    }
    
    if (key === 'telefone' && value) {
      if (!this.isValidPhone(value)) {
        errors.push(`Telefone inválido: ${value}`);
        continue;
      }
    }
    
    // Sanitizar strings
    if (typeof value === 'string') {
      validated[key] = value.trim();
    } else {
      validated[key] = value;
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Dados inválidos: ${errors.join(', ')}`);
  }
  
  return validated;
}

isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

isValidPhone(phone) {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
}
```

### Validação de Schema
```javascript
const recordSchema = {
  nome: { type: 'string', required: true, maxLength: 255 },
  email: { type: 'email', required: false, maxLength: 255 },
  telefone: { type: 'phone', required: false, maxLength: 20 },
  status: { type: 'enum', values: ['novo', 'contatado', 'qualificado', 'convertido'], default: 'novo' },
  observacoes: { type: 'string', required: false, maxLength: 1000 }
};

validateAgainstSchema(data, schema) {
  const validated = {};
  const errors = [];
  
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    
    // Verificar campo obrigatório
    if (rules.required && (value === null || value === undefined || value === '')) {
      errors.push(`Campo obrigatório: ${field}`);
      continue;
    }
    
    // Aplicar valor padrão
    if ((value === null || value === undefined) && rules.default !== undefined) {
      validated[field] = rules.default;
      continue;
    }
    
    if (value !== null && value !== undefined) {
      // Validar tipo
      if (!this.validateFieldType(value, rules.type)) {
        errors.push(`Tipo inválido para ${field}: esperado ${rules.type}`);
        continue;
      }
      
      // Validar comprimento
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${field} muito longo: máximo ${rules.maxLength} caracteres`);
        continue;
      }
      
      // Validar enum
      if (rules.values && !rules.values.includes(value)) {
        errors.push(`Valor inválido para ${field}: deve ser um de ${rules.values.join(', ')}`);
        continue;
      }
      
      validated[field] = value;
    }
  }
  
  if (errors.length > 0) {
    throw new Error(`Validação falhou: ${errors.join(', ')}`);
  }
  
  return validated;
}
```

## Performance

### Otimizações de Consulta
```javascript
// Paginação eficiente
const getPaginatedData = async (connection, userToken, page = 1, pageSize = 50) => {
  const offset = (page - 1) * pageSize;
  const userLinkField = connection.user_link_field || 'wasendToken';
  
  const nocoApi = createNocoDBClient(connection);
  
  const response = await nocoApi.get(
    `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
    {
      params: {
        where: `(${userLinkField},eq,${userToken})`,
        limit: pageSize,
        offset: offset,
        sort: '-created_at' // Ordenar por mais recente
      }
    }
  );
  
  const data = response.data?.list || [];
  
  return {
    data,
    pagination: {
      page,
      pageSize,
      total: data.length,
      hasMore: data.length === pageSize
    }
  };
};
```

### Cache de Dados
```javascript
class NocoDBCache {
  constructor(ttl = 300000) { // 5 minutos
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  generateKey(connectionId, userToken, operation, params = {}) {
    const paramsStr = JSON.stringify(params);
    return `${connectionId}:${userToken.substring(0, 8)}:${operation}:${paramsStr}`;
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }
  
  set(key, data) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.ttl
    });
  }
  
  invalidate(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Uso do cache
const cache = new NocoDBCache();

const getCachedData = async (connection, userToken) => {
  const cacheKey = cache.generateKey(connection.id, userToken, 'read');
  
  let data = cache.get(cacheKey);
  if (data) {
    logger.info('Cache hit para dados NocoDB');
    return data;
  }
  
  data = await getNocoDBTableData(connection, userToken);
  cache.set(cacheKey, data);
  
  return data;
};
```

### Batch Operations
```javascript
// Criação em lote
const createMultipleRecords = async (connection, records, userToken) => {
  const batchSize = 10;
  const results = [];
  
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const batchPromises = batch.map(record => 
      createNocoDBRecord(connection, record, userToken)
    );
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Pequena pausa entre lotes para não sobrecarregar a API
      if (i + batchSize < records.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error) {
      logger.error(`Erro no lote ${i}-${i + batchSize}:`, error.message);
      throw error;
    }
  }
  
  return results;
};
```

## Exemplos Práticos

### Sistema de CRM Completo
```typescript
class CRMService {
  constructor(private connectionId: number) {
    this.crudService = new NocoDBCRUDService(connectionId);
  }
  
  // Criar lead a partir de mensagem WhatsApp
  async createLeadFromWhatsApp(messageData: WhatsAppMessage): Promise<Lead> {
    const leadData = {
      nome: messageData.contact?.name || 'Lead WhatsApp',
      telefone: messageData.from,
      fonte: 'whatsapp',
      status: 'novo',
      primeira_mensagem: messageData.body,
      data_primeiro_contato: new Date().toISOString()
    };
    
    return await this.crudService.create(leadData);
  }
  
  // Atualizar status do lead
  async updateLeadStatus(leadId: string, newStatus: string, observacoes?: string): Promise<Lead> {
    const updateData: any = { 
      status: newStatus,
      updated_at: new Date().toISOString()
    };
    
    if (observacoes) {
      updateData.observacoes = observacoes;
    }
    
    return await this.crudService.update(leadId, updateData);
  }
  
  // Buscar leads por status
  async getLeadsByStatus(status: string): Promise<Lead[]> {
    return await this.crudService.read({ status });
  }
  
  // Converter lead em cliente
  async convertLead(leadId: string, clienteData: any): Promise<void> {
    // Atualizar status do lead
    await this.updateLeadStatus(leadId, 'convertido', 'Lead convertido em cliente');
    
    // Criar registro de cliente (em outra tabela/conexão)
    // await this.clienteService.create(clienteData);
  }
  
  // Relatório de conversão
  async getConversionReport(dateFrom: string, dateTo: string) {
    const allLeads = await this.crudService.read({
      dateFrom,
      dateTo
    });
    
    const statusCount = allLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {});
    
    const conversionRate = statusCount.convertido 
      ? (statusCount.convertido / allLeads.length) * 100 
      : 0;
    
    return {
      totalLeads: allLeads.length,
      statusCount,
      conversionRate: Math.round(conversionRate * 100) / 100
    };
  }
}
```

### Hook React para CRUD
```typescript
const useNocoDBCRUD = (connectionId: number) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const crudService = useMemo(() => new NocoDBCRUDService(connectionId), [connectionId]);
  
  const loadData = useCallback(async (filters?: Record<string, any>) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await crudService.read(filters);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [crudService]);
  
  const createRecord = useCallback(async (recordData: Record<string, any>) => {
    try {
      const newRecord = await crudService.create(recordData);
      setData(prev => [newRecord, ...prev]);
      return { success: true, data: newRecord };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [crudService]);
  
  const updateRecord = useCallback(async (recordId: string, recordData: Record<string, any>) => {
    try {
      const updatedRecord = await crudService.update(recordId, recordData);
      setData(prev => prev.map(item => 
        item.Id === recordId ? updatedRecord : item
      ));
      return { success: true, data: updatedRecord };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [crudService]);
  
  const deleteRecord = useCallback(async (recordId: string) => {
    try {
      await crudService.delete(recordId);
      setData(prev => prev.filter(item => item.Id !== recordId));
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  }, [crudService]);
  
  useEffect(() => {
    if (connectionId) {
      loadData();
    }
  }, [connectionId, loadData]);
  
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
```

---

**Conclusão**: Este guia fornece padrões completos para implementação de operações CRUD com NocoDB, incluindo tratamento de erros, validações, otimizações de performance e exemplos práticos de uso.