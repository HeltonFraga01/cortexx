# Guia de Configuração NocoDB

Guia passo-a-passo para configurar conexões NocoDB no WUZAPI Manager.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Configuração no NocoDB](#configuração-no-nocodb)
- [Configuração no WUZAPI Manager](#configuração-no-wuzapi-manager)
- [Estrutura de Tabela Recomendada](#estrutura-de-tabela-recomendada)
- [Mapeamento de Campos](#mapeamento-de-campos)
- [Testes e Validação](#testes-e-validação)
- [Casos de Uso Comuns](#casos-de-uso-comuns)

## Pré-requisitos

### 1. Conta NocoDB
- Conta ativa no [NocoDB Cloud](https://app.nocodb.com) ou instância self-hosted
- Workspace criado
- Projeto/Base criado
- Tabela com dados configurada

### 2. Permissões Necessárias
- **Editor** ou **Owner** no projeto NocoDB
- Acesso à API (geração de tokens)
- Permissões de leitura/escrita na tabela

### 3. Estrutura Mínima da Tabela
- Campo de vinculação do usuário (ex: `wasendToken`)
- Campos de dados relevantes
- ID único para cada registro

## Configuração no NocoDB

### 1. Criar/Configurar Projeto

#### Acessar NocoDB
1. Acesse [app.nocodb.com](https://app.nocodb.com)
2. Faça login na sua conta
3. Selecione ou crie um workspace

#### Criar Projeto
1. Clique em "Create Project"
2. Escolha "Create from scratch" ou conecte um banco existente
3. Nomeie o projeto (ex: "WUZAPI Leads")
4. Configure as opções básicas

### 2. Configurar Tabela

#### Estrutura Recomendada
```sql
-- Exemplo de estrutura de tabela
CREATE TABLE leads (
  Id INTEGER PRIMARY KEY,
  wasendToken VARCHAR(255),  -- Campo de vinculação OBRIGATÓRIO
  nome VARCHAR(255),
  email VARCHAR(255),
  telefone VARCHAR(20),
  empresa VARCHAR(255),
  status VARCHAR(50) DEFAULT 'novo',
  observacoes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### Campos Obrigatórios
- **Id**: Chave primária (auto-incremento)
- **wasendToken**: Campo de vinculação do usuário (VARCHAR/TEXT)

#### Campos Recomendados
- **nome**: Nome do lead/cliente
- **telefone**: Número de telefone
- **email**: E-mail de contato
- **status**: Status do lead (novo, contatado, convertido, etc.)
- **created_at**: Data de criação
- **updated_at**: Data de atualização

### 3. Gerar Token de API

#### Via Interface Web
1. Clique no avatar do usuário (canto superior direito)
2. Selecione "Account Settings"
3. Vá para a aba "Tokens"
4. Clique em "Generate New Token"
5. Nomeie o token (ex: "WUZAPI Integration")
6. Copie o token gerado

#### Via API (Programático)
```bash
curl -X POST https://app.nocodb.com/api/v1/auth/user/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "sua_senha"
  }'
```

### 4. Obter IDs Necessários

#### Project ID
```bash
curl -H "xc-token: SEU_TOKEN" \
     https://app.nocodb.com/api/v1/db/meta/projects
```

#### Table ID
```bash
curl -H "xc-token: SEU_TOKEN" \
     https://app.nocodb.com/api/v1/db/meta/projects/PROJECT_ID/tables
```

## Configuração no WUZAPI Manager

### 1. Via Interface Web

#### Acessar Configurações
1. Faça login como administrador
2. Vá para "Configurações" → "Conexões de Banco"
3. Clique em "Nova Conexão"

#### Preencher Formulário
```
Nome: Leads NocoDB
Tipo: NocoDB
Host: https://app.nocodb.com
Token: nc_token_123456789abcdef
Project ID: p_abc123def456ghi789
Table ID: t_xyz789uvw012abc345
Campo de Vinculação: wasendToken
```

#### Testar Conexão
1. Clique em "Testar Conexão"
2. Aguarde validação
3. Verifique se status fica "Conectado"

### 2. Via API

#### Criar Conexão
```bash
curl -X POST http://localhost:3001/api/database-connections \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Leads NocoDB",
    "type": "NOCODB",
    "host": "https://app.nocodb.com",
    "nocodb_token": "nc_token_123456789abcdef",
    "nocodb_project_id": "p_abc123def456ghi789",
    "nocodb_table_id": "t_xyz789uvw012abc345",
    "user_link_field": "wasendToken"
  }'
```

#### Testar Conexão
```bash
curl -X PATCH http://localhost:3001/api/database-connections/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "testing"}'
```

### 3. Via Código

#### Backend
```javascript
const db = require('./database');

const connection = await db.createConnection({
  name: 'Leads NocoDB',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_123456789abcdef',
  nocodb_project_id: 'p_abc123def456ghi789',
  nocodb_table_id: 't_xyz789uvw012abc345',
  user_link_field: 'wasendToken',
  assignedUsers: ['all'] // Ou tokens específicos
});

console.log('Conexão criada:', connection);
```

#### Frontend
```typescript
import { databaseConnectionsService } from '@/services/database-connections';

const connection = await databaseConnectionsService.createConnection({
  name: 'Leads NocoDB',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_123456789abcdef',
  nocodb_project_id: 'p_abc123def456ghi789',
  nocodb_table_id: 't_xyz789uvw012abc345',
  user_link_field: 'wasendToken'
});
```

## Estrutura de Tabela Recomendada

### Para CRM/Leads
```javascript
const leadsTableStructure = {
  fields: [
    { name: 'Id', type: 'Number', primary: true },
    { name: 'wasendToken', type: 'SingleLineText', required: true },
    { name: 'nome', type: 'SingleLineText', required: true },
    { name: 'telefone', type: 'PhoneNumber' },
    { name: 'email', type: 'Email' },
    { name: 'empresa', type: 'SingleLineText' },
    { name: 'status', type: 'SingleSelect', options: ['novo', 'contatado', 'qualificado', 'convertido', 'perdido'] },
    { name: 'fonte', type: 'SingleSelect', options: ['whatsapp', 'site', 'indicacao', 'outros'] },
    { name: 'valor_estimado', type: 'Currency' },
    { name: 'observacoes', type: 'LongText' },
    { name: 'data_contato', type: 'DateTime' },
    { name: 'created_at', type: 'DateTime', default: 'now()' },
    { name: 'updated_at', type: 'DateTime', default: 'now()' }
  ]
};
```

### Para Atendimento/Tickets
```javascript
const ticketsTableStructure = {
  fields: [
    { name: 'Id', type: 'Number', primary: true },
    { name: 'wasendToken', type: 'SingleLineText', required: true },
    { name: 'numero_ticket', type: 'SingleLineText', unique: true },
    { name: 'cliente_nome', type: 'SingleLineText', required: true },
    { name: 'cliente_telefone', type: 'PhoneNumber', required: true },
    { name: 'assunto', type: 'SingleLineText', required: true },
    { name: 'descricao', type: 'LongText' },
    { name: 'prioridade', type: 'SingleSelect', options: ['baixa', 'media', 'alta', 'urgente'] },
    { name: 'status', type: 'SingleSelect', options: ['aberto', 'em_andamento', 'aguardando', 'resolvido', 'fechado'] },
    { name: 'categoria', type: 'SingleSelect', options: ['tecnico', 'comercial', 'suporte', 'outros'] },
    { name: 'atendente', type: 'SingleLineText' },
    { name: 'data_abertura', type: 'DateTime', default: 'now()' },
    { name: 'data_fechamento', type: 'DateTime' },
    { name: 'tempo_resposta', type: 'Duration' }
  ]
};
```

### Para E-commerce/Produtos
```javascript
const produtosTableStructure = {
  fields: [
    { name: 'Id', type: 'Number', primary: true },
    { name: 'wasendToken', type: 'SingleLineText', required: true },
    { name: 'codigo_produto', type: 'SingleLineText', unique: true },
    { name: 'nome', type: 'SingleLineText', required: true },
    { name: 'descricao', type: 'LongText' },
    { name: 'categoria', type: 'SingleSelect', options: ['eletronicos', 'roupas', 'casa', 'esportes', 'outros'] },
    { name: 'preco', type: 'Currency', required: true },
    { name: 'estoque', type: 'Number', default: 0 },
    { name: 'ativo', type: 'Checkbox', default: true },
    { name: 'imagem_url', type: 'URL' },
    { name: 'peso', type: 'Decimal' },
    { name: 'dimensoes', type: 'SingleLineText' },
    { name: 'created_at', type: 'DateTime', default: 'now()' },
    { name: 'updated_at', type: 'DateTime', default: 'now()' }
  ]
};
```

## Mapeamento de Campos

### Configuração Básica
```typescript
const fieldMappings: FieldMapping[] = [
  {
    columnName: 'nome',
    label: 'Nome Completo',
    visible: true,
    editable: true
  },
  {
    columnName: 'telefone',
    label: 'Telefone',
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
    columnName: 'status',
    label: 'Status do Lead',
    visible: true,
    editable: true
  },
  {
    columnName: 'created_at',
    label: 'Data de Criação',
    visible: true,
    editable: false
  },
  {
    columnName: 'wasendToken',
    label: 'Token',
    visible: false,
    editable: false
  }
];
```

### Aplicação Dinâmica
```typescript
// Gerar mapeamento automaticamente baseado na estrutura da tabela
async function generateFieldMappings(connection: DatabaseConnection): Promise<FieldMapping[]> {
  try {
    const columns = await databaseService.getNocoDBColumns(
      connection.host,
      connection.nocodb_token,
      connection.nocodb_table_id
    );

    return columns.map(column => ({
      columnName: column.column_name,
      label: column.title || column.column_name,
      visible: !['Id', 'wasendToken', 'created_at', 'updated_at'].includes(column.column_name),
      editable: !['Id', 'wasendToken', 'created_at', 'updated_at'].includes(column.column_name)
    }));

  } catch (error) {
    console.error('Erro ao gerar mapeamentos:', error);
    return [];
  }
}
```

## Testes e Validação

### Script de Teste Completo
```bash
#!/bin/bash

echo "=== Teste de Configuração NocoDB ==="

# Configurações
NOCODB_HOST="https://app.nocodb.com"
NOCODB_TOKEN="nc_token_123456789"
PROJECT_ID="p_abc123def456"
TABLE_ID="t_xyz789uvw012"

# 1. Testar conectividade
echo "1. Testando conectividade..."
if curl -s --connect-timeout 5 "$NOCODB_HOST" > /dev/null; then
    echo "✅ NocoDB acessível"
else
    echo "❌ NocoDB não acessível"
    exit 1
fi

# 2. Testar autenticação
echo "2. Testando autenticação..."
AUTH_TEST=$(curl -s -H "xc-token: $NOCODB_TOKEN" \
                 "$NOCODB_HOST/api/v1/db/meta/projects" | jq -r '.list[0].id // empty')

if [ -n "$AUTH_TEST" ]; then
    echo "✅ Token válido"
else
    echo "❌ Token inválido"
    exit 1
fi

# 3. Testar acesso ao projeto
echo "3. Testando acesso ao projeto..."
PROJECT_TEST=$(curl -s -H "xc-token: $NOCODB_TOKEN" \
                    "$NOCODB_HOST/api/v1/db/meta/projects/$PROJECT_ID" | jq -r '.id // empty')

if [ "$PROJECT_TEST" = "$PROJECT_ID" ]; then
    echo "✅ Projeto acessível"
else
    echo "❌ Projeto não encontrado"
    exit 1
fi

# 4. Testar acesso à tabela
echo "4. Testando acesso à tabela..."
TABLE_TEST=$(curl -s -H "xc-token: $NOCODB_TOKEN" \
                  "$NOCODB_HOST/api/v1/db/meta/tables/$TABLE_ID" | jq -r '.id // empty')

if [ "$TABLE_TEST" = "$TABLE_ID" ]; then
    echo "✅ Tabela acessível"
else
    echo "❌ Tabela não encontrada"
    exit 1
fi

# 5. Testar acesso aos dados
echo "5. Testando acesso aos dados..."
DATA_TEST=$(curl -s -H "xc-token: $NOCODB_TOKEN" \
                 "$NOCODB_HOST/api/v1/db/data/noco/$PROJECT_ID/$TABLE_ID?limit=1" | jq -r '.list // empty')

if [ "$DATA_TEST" != "null" ] && [ "$DATA_TEST" != "" ]; then
    echo "✅ Dados acessíveis"
else
    echo "⚠️ Nenhum dado encontrado (pode ser normal)"
fi

echo "=== Teste concluído com sucesso ==="
```

### Validação Programática
```typescript
// Função de validação completa
async function validateNocoDBSetup(connection: DatabaseConnection): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const result = {
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    // 1. Validar configurações básicas
    if (!connection.host) {
      result.errors.push('Host não configurado');
    }

    if (!connection.nocodb_token) {
      result.errors.push('Token não configurado');
    }

    if (!connection.nocodb_project_id) {
      result.errors.push('Project ID não configurado');
    }

    if (!connection.nocodb_table_id) {
      result.errors.push('Table ID não configurado');
    }

    if (result.errors.length > 0) {
      result.valid = false;
      return result;
    }

    // 2. Testar conectividade
    const api = axios.create({
      baseURL: connection.host,
      headers: { 'xc-token': connection.nocodb_token },
      timeout: 10000,
    });

    // 3. Testar autenticação
    try {
      await api.get('/api/v1/db/meta/projects');
    } catch (error) {
      if (error.response?.status === 401) {
        result.errors.push('Token de autenticação inválido');
      } else {
        result.errors.push(`Erro de autenticação: ${error.message}`);
      }
      result.valid = false;
      return result;
    }

    // 4. Verificar projeto
    try {
      const projectResponse = await api.get(`/api/v1/db/meta/projects/${connection.nocodb_project_id}`);
      if (!projectResponse.data?.id) {
        result.errors.push('Projeto não encontrado');
        result.valid = false;
        return result;
      }
    } catch (error) {
      result.errors.push('Projeto não acessível');
      result.valid = false;
      return result;
    }

    // 5. Verificar tabela
    try {
      const tableResponse = await api.get(`/api/v1/db/meta/tables/${connection.nocodb_table_id}`);
      const columns = tableResponse.data?.columns || [];
      
      // Verificar se tem campo de vinculação
      const userLinkField = connection.user_link_field || 'wasendToken';
      const hasUserField = columns.some(col => col.column_name === userLinkField);
      
      if (!hasUserField) {
        result.warnings.push(`Campo de vinculação '${userLinkField}' não encontrado na tabela`);
      }
      
      // Verificar se tem ID
      const hasIdField = columns.some(col => col.pk === true);
      if (!hasIdField) {
        result.warnings.push('Tabela não possui chave primária definida');
      }
      
    } catch (error) {
      result.errors.push('Tabela não acessível');
      result.valid = false;
      return result;
    }

    // 6. Testar acesso aos dados
    try {
      await api.get(
        `/api/v1/db/data/noco/${connection.nocodb_project_id}/${connection.nocodb_table_id}`,
        { params: { limit: 1 } }
      );
    } catch (error) {
      result.warnings.push('Não foi possível acessar dados da tabela');
    }

  } catch (error) {
    result.errors.push(`Erro geral: ${error.message}`);
    result.valid = false;
  }

  return result;
}

// Uso
const validation = await validateNocoDBSetup(connection);
if (!validation.valid) {
  console.error('Configuração inválida:', validation.errors);
} else if (validation.warnings.length > 0) {
  console.warn('Avisos:', validation.warnings);
} else {
  console.log('✅ Configuração válida!');
}
```

## Casos de Uso Comuns

### 1. Sistema de Leads/CRM

#### Configuração
```javascript
const crmConnection = {
  name: 'CRM Leads',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_crm_123',
  nocodb_project_id: 'p_crm_project',
  nocodb_table_id: 't_leads_table',
  user_link_field: 'wasendToken',
  fieldMappings: [
    { columnName: 'nome', label: 'Nome do Lead', visible: true, editable: true },
    { columnName: 'telefone', label: 'Telefone', visible: true, editable: true },
    { columnName: 'email', label: 'E-mail', visible: true, editable: true },
    { columnName: 'empresa', label: 'Empresa', visible: true, editable: true },
    { columnName: 'status', label: 'Status', visible: true, editable: true },
    { columnName: 'valor_estimado', label: 'Valor Estimado', visible: true, editable: true }
  ]
};
```

#### Uso no WhatsApp
```javascript
// Quando receber mensagem via webhook
app.post('/webhook/whatsapp', async (req, res) => {
  const { from, body } = req.body.data;
  
  // Criar lead automaticamente
  const leadData = {
    wasendToken: req.userToken,
    nome: 'Lead WhatsApp',
    telefone: from,
    status: 'novo',
    fonte: 'whatsapp',
    observacoes: `Primeira mensagem: ${body}`,
    data_contato: new Date().toISOString()
  };
  
  try {
    await databaseService.createUserTableRecord(
      req.userToken,
      crmConnection.id,
      leadData
    );
    
    console.log('Lead criado automaticamente:', leadData);
  } catch (error) {
    console.error('Erro ao criar lead:', error);
  }
});
```

### 2. Sistema de Atendimento

#### Configuração
```javascript
const supportConnection = {
  name: 'Sistema de Tickets',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_support_456',
  nocodb_project_id: 'p_support_project',
  nocodb_table_id: 't_tickets_table',
  user_link_field: 'wasendToken'
};
```

#### Fluxo de Atendimento
```javascript
// Criar ticket automaticamente
async function createTicketFromWhatsApp(userToken, messageData) {
  const ticketNumber = `TK${Date.now()}`;
  
  const ticketData = {
    wasendToken: userToken,
    numero_ticket: ticketNumber,
    cliente_nome: messageData.contact?.name || 'Cliente WhatsApp',
    cliente_telefone: messageData.from,
    assunto: 'Atendimento via WhatsApp',
    descricao: messageData.body,
    prioridade: 'media',
    status: 'aberto',
    categoria: 'suporte',
    data_abertura: new Date().toISOString()
  };

  try {
    const ticket = await databaseService.createUserTableRecord(
      userToken,
      supportConnection.id,
      ticketData
    );

    // Enviar confirmação para o cliente
    await wuzapi.sendTextMessage(
      userToken,
      messageData.from,
      `Seu ticket ${ticketNumber} foi criado com sucesso! Em breve entraremos em contato.`
    );

    return ticket;
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    throw error;
  }
}
```

### 3. Catálogo de Produtos

#### Configuração
```javascript
const catalogConnection = {
  name: 'Catálogo de Produtos',
  type: 'NOCODB',
  host: 'https://app.nocodb.com',
  nocodb_token: 'nc_token_catalog_789',
  nocodb_project_id: 'p_catalog_project',
  nocodb_table_id: 't_products_table',
  user_link_field: 'wasendToken'
};
```

#### Busca de Produtos
```javascript
// Buscar produtos por categoria
async function searchProducts(userToken, category = null, searchTerm = null) {
  try {
    let whereClause = `(wasendToken,eq,${userToken})`;
    
    if (category) {
      whereClause += ` and (categoria,eq,${category})`;
    }
    
    if (searchTerm) {
      whereClause += ` and (nome,like,%${searchTerm}%)`;
    }

    const api = axios.create({
      baseURL: catalogConnection.host,
      headers: { 'xc-token': catalogConnection.nocodb_token },
    });

    const response = await api.get(
      `/api/v1/db/data/noco/${catalogConnection.nocodb_project_id}/${catalogConnection.nocodb_table_id}`,
      {
        params: {
          where: whereClause,
          limit: 50
        }
      }
    );

    return response.data?.list || [];
  } catch (error) {
    console.error('Erro ao buscar produtos:', error);
    return [];
  }
}

// Enviar catálogo via WhatsApp
async function sendProductCatalog(userToken, clientPhone, category = null) {
  const products = await searchProducts(userToken, category);
  
  if (products.length === 0) {
    await wuzapi.sendTextMessage(
      userToken,
      clientPhone,
      'Desculpe, não encontramos produtos nesta categoria.'
    );
    return;
  }

  let catalogMessage = `📋 *Catálogo de Produtos*\n\n`;
  
  products.slice(0, 10).forEach((product, index) => {
    catalogMessage += `${index + 1}. *${product.nome}*\n`;
    catalogMessage += `   💰 R$ ${product.preco}\n`;
    if (product.descricao) {
      catalogMessage += `   📝 ${product.descricao.substring(0, 100)}...\n`;
    }
    catalogMessage += `   📦 Estoque: ${product.estoque}\n\n`;
  });

  if (products.length > 10) {
    catalogMessage += `... e mais ${products.length - 10} produtos.\n`;
  }

  catalogMessage += `\nPara mais informações, digite o número do produto.`;

  await wuzapi.sendTextMessage(userToken, clientPhone, catalogMessage);
}
```

---

**Próximos Passos**: Após configurar a conexão NocoDB, teste todas as operações CRUD e configure os webhooks para automação de processos.