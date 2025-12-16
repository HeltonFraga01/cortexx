# Guia de Integração WUZAPI

Este guia completo documenta todos os métodos do WuzAPIClient e como integrar com a API WUZAPI no projeto WUZAPI Manager.

## Índice

- [Visão Geral](#visão-geral)
- [Configuração](#configuração)
- [Autenticação](#autenticação)
- [Cliente Backend (Node.js)](#cliente-backend-nodejs)
- [Cliente Frontend (TypeScript)](#cliente-frontend-typescript)
- [Métodos Disponíveis](#métodos-disponíveis)
- [Exemplos Práticos](#exemplos-práticos)
- [Tratamento de Erros](#tratamento-de-erros)
- [Diferenças com Evolution API](#diferenças-com-evolution-api)
- [Troubleshooting](#troubleshooting)

## Visão Geral

A WUZAPI é uma API para WhatsApp que permite:
- Gerenciar múltiplas instâncias/usuários
- Enviar e receber mensagens
- Gerenciar grupos e contatos
- Configurar webhooks
- Controlar status e presença

### Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   WUZAPI        │
│   (React/TS)    │◄──►│   (Node.js)     │◄──►│   (External)    │
│                 │    │                 │    │                 │
│ - WuzAPIService │    │ - WuzAPIClient  │    │ - WhatsApp API  │
│ - Components    │    │ - Routes        │    │ - Instances     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Configuração

### Variáveis de Ambiente

```bash
# .env
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
WUZAPI_TIMEOUT=10000
VITE_ADMIN_TOKEN=UeH7cZ2c1K3zVUBFi7SginSC
```

### Instalação de Dependências

```bash
# Backend
npm install axios

# Frontend
# Usa fetch nativo do browser
```

## Autenticação

A WUZAPI utiliza dois tipos de autenticação:

### 1. Token Administrativo
- **Header**: `Authorization: {admin_token}`
- **Uso**: Gerenciar usuários, estatísticas, configurações
- **Escopo**: Acesso total ao sistema

### 2. Token de Usuário
- **Header**: `token: {user_token}`
- **Uso**: Operações específicas do usuário (enviar mensagens, etc.)
- **Escopo**: Limitado aos recursos do usuário

## Cliente Backend (Node.js)

### Localização
- **Arquivo**: `server/utils/wuzapiClient.js`
- **Tipo**: Singleton (instância única)

### Configuração

```javascript
const wuzapiClient = require('../utils/wuzapiClient');

// Configurações automáticas via environment
console.log(wuzapiClient.getConfig());
// {
//   baseURL: 'https://wzapi.wasend.com.br',
//   timeout: 10000
// }
```

### Métodos Básicos

#### GET Request
```javascript
const response = await wuzapiClient.get('/health');
console.log(response);
// {
//   success: true,
//   status: 200,
//   data: { status: 'ok', uptime: '1h 30m' }
// }
```

#### POST Request
```javascript
const userData = {
  name: 'Nova Instância',
  token: 'abc123',
  webhook: 'https://meusite.com/webhook'
};

const response = await wuzapiClient.post('/admin/users', userData);
```

#### Admin Requests
```javascript
const adminToken = 'UeH7cZ2c1K3zVUBFi7SginSC';

// GET com token admin
const users = await wuzapiClient.getAdmin('/admin/users', adminToken);

// POST com token admin
const newUser = await wuzapiClient.postAdmin('/admin/users', userData, adminToken);
```

### Métodos Específicos

#### Verificar Saúde
```javascript
const isHealthy = await wuzapiClient.isHealthy();
console.log('API está funcionando:', isHealthy);
```

#### Criar Usuário
```javascript
const userData = {
  name: 'João Silva',
  token: 'user_token_123',
  webhook: 'https://meusite.com/webhook',
  events: 'Message,ReadReceipt'
};

const result = await wuzapiClient.createUser(userData, adminToken);
if (result.success) {
  console.log('Usuário criado:', result.data);
} else {
  console.error('Erro:', result.error);
}
```

#### Deletar Usuário
```javascript
// Deletar do banco (mantém sessão)
const result1 = await wuzapiClient.deleteUser('userId', adminToken);

// Deletar completamente (remove sessão)
const result2 = await wuzapiClient.deleteUserFull('userId', adminToken);
```

### Tratamento de Erros

```javascript
const response = await wuzapiClient.get('/endpoint');

if (!response.success) {
  switch (response.code) {
    case 'TIMEOUT':
      console.log('Timeout na requisição');
      break;
    case 'CONNECTION_ERROR':
      console.log('Erro de conexão');
      break;
    default:
      console.log('Erro:', response.error);
  }
}
```

## Cliente Frontend (TypeScript)

### Localização
- **Arquivo**: `src/services/wuzapi.ts`
- **Classe**: `WuzAPIService`

### Configuração

```typescript
import { WuzAPIService } from '@/services/wuzapi';

const wuzapi = new WuzAPIService();
```

### Métodos Administrativos

#### Listar Usuários
```typescript
try {
  const users = await wuzapi.getUsers();
  console.log('Usuários:', users);
} catch (error) {
  console.error('Erro ao buscar usuários:', error);
}
```

#### Criar Usuário
```typescript
const userData: CreateUserRequest = {
  name: 'Nova Instância',
  token: 'user_token_123',
  webhook: 'https://meusite.com/webhook',
  events: 'Message,ReadReceipt'
};

try {
  const newUser = await wuzapi.createUser(userData);
  console.log('Usuário criado:', newUser);
} catch (error) {
  console.error('Erro ao criar usuário:', error);
}
```

#### Obter Usuário Específico
```typescript
try {
  const user = await wuzapi.getUser('userId');
  console.log('Usuário:', user);
} catch (error) {
  console.error('Usuário não encontrado:', error);
}
```

### Métodos de Usuário

#### Status da Sessão
```typescript
const userToken = 'abc123def456';

try {
  const status = await wuzapi.getSessionStatus(userToken);
  console.log('Status:', status);
  // { connected: true, loggedIn: true }
} catch (error) {
  console.error('Erro ao obter status:', error);
}
```

#### Conectar Sessão
```typescript
const options = {
  Subscribe: ['Message', 'ReadReceipt'],
  Immediate: false
};

try {
  const result = await wuzapi.connectSession(userToken, options);
  console.log('Conectado:', result);
} catch (error) {
  console.error('Erro ao conectar:', error);
}
```

#### Obter QR Code
```typescript
try {
  const qrData = await wuzapi.getQRCode(userToken);
  console.log('QR Code:', qrData.QRCode);
  
  // Exibir QR Code
  const img = document.createElement('img');
  img.src = qrData.QRCode;
  document.body.appendChild(img);
} catch (error) {
  console.error('Erro ao obter QR Code:', error);
}
```

### Webhooks

#### Obter Configuração
```typescript
try {
  const webhook = await wuzapi.getWebhook(userToken);
  console.log('Webhook:', webhook);
} catch (error) {
  console.error('Erro ao obter webhook:', error);
}
```

#### Configurar Webhook
```typescript
const webhookUrl = 'https://meusite.com/webhook';
const events = ['Message', 'ReadReceipt', 'MessageStatus'];

try {
  const result = await wuzapi.setWebhook(userToken, webhookUrl, events);
  console.log('Webhook configurado:', result);
} catch (error) {
  console.error('Erro ao configurar webhook:', error);
}
```

### Envio de Mensagens

#### Mensagem de Texto
```typescript
const phone = '5511999999999';
const message = 'Olá! Esta é uma mensagem de teste.';

try {
  const result = await wuzapi.sendTextMessage(userToken, phone, message);
  console.log('Mensagem enviada:', result);
} catch (error) {
  console.error('Erro ao enviar mensagem:', error);
}
```

## Cliente Avançado (TypeScript)

### Localização
- **Arquivo**: `src/lib/wuzapi-client.ts`
- **Classe**: `WuzAPIClient`

### Configuração

```typescript
import { WuzAPIClient, createWuzAPIClient } from '@/lib/wuzapi-client';

const client = createWuzAPIClient({
  baseUrl: 'https://wzapi.wasend.com.br',
  adminToken: 'UeH7cZ2c1K3zVUBFi7SginSC',
  userToken: 'abc123def456' // opcional
});
```

### Métodos Avançados

#### Gerenciamento de Instâncias
```typescript
// Listar instâncias
const instances = await client.listInstances();

// Criar instância
const newInstance = await client.createInstance({
  name: 'minha-instancia',
  webhook: 'https://meusite.com/webhook'
});

// Conectar instância
await client.connectInstance('minha-instancia');

// Obter QR Code
const qr = await client.getInstanceQRCode('minha-instancia');
```

#### Envio de Mídia
```typescript
// Enviar imagem
await client.sendImageMessage({
  phone: '5511999999999',
  media: 'https://exemplo.com/imagem.jpg',
  caption: 'Legenda da imagem'
});

// Enviar documento
await client.sendDocumentMessage({
  phone: '5511999999999',
  media: 'https://exemplo.com/documento.pdf',
  filename: 'documento.pdf'
});

// Enviar localização
await client.sendLocationMessage({
  phone: '5511999999999',
  latitude: -23.5505,
  longitude: -46.6333,
  name: 'São Paulo',
  address: 'São Paulo, SP, Brasil'
});
```

#### Gerenciamento de Grupos
```typescript
// Listar grupos
const groups = await client.getGroups();

// Criar grupo
const newGroup = await client.createGroup({
  name: 'Meu Grupo',
  participants: ['5511999999999', '5511888888888']
});

// Adicionar participantes
await client.addGroupParticipants('groupId', {
  participants: ['5511777777777']
});

// Promover a admin
await client.promoteGroupParticipants('groupId', {
  participants: ['5511999999999']
});
```

#### Gerenciamento de Contatos
```typescript
// Listar contatos
const contacts = await client.getContacts();

// Obter contato específico
const contact = await client.getContact('5511999999999');

// Bloquear contato
await client.blockContact('5511999999999');

// Desbloquear contato
await client.unblockContact('5511999999999');
```

## Métodos Disponíveis

### Administrativos (Admin Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `listUsers()` | GET /admin/users | Lista todos os usuários |
| `createUser(payload)` | POST /admin/users | Cria novo usuário |
| `getUser(phone)` | GET /admin/users/{phone} | Obtém usuário específico |
| `updateUser(phone, payload)` | PUT /admin/users/{phone} | Atualiza usuário |
| `deleteUser(phone)` | DELETE /admin/users/{phone} | Remove usuário |
| `getStats()` | GET /admin/stats | Estatísticas do sistema |
| `getLogs(limit)` | GET /admin/logs | Logs do sistema |
| `restartSystem()` | POST /admin/restart | Reinicia sistema |

### Instâncias (Admin Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `listInstances()` | GET /instances | Lista instâncias |
| `createInstance(payload)` | POST /instances | Cria instância |
| `getInstance(name)` | GET /instances/{name} | Obtém instância |
| `deleteInstance(name)` | DELETE /instances/{name} | Remove instância |
| `connectInstance(name)` | POST /instances/{name}/connect | Conecta instância |
| `disconnectInstance(name)` | POST /instances/{name}/disconnect | Desconecta instância |
| `getInstanceQRCode(name)` | GET /instances/{name}/qr | QR Code da instância |

### Sessões (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `getUserStatus(phone)` | GET /session/status | Status da sessão |
| `connectUser(token)` | POST /session/connect | Conecta usuário |
| `disconnectUser(phone)` | POST /session/disconnect | Desconecta usuário |
| `getUserQRCode(token)` | GET /session/qr | QR Code do usuário |

### Mensagens (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `sendTextMessage(payload)` | POST /chat/send/text | Envia texto |
| `sendImageMessage(payload)` | POST /chat/send/image | Envia imagem |
| `sendVideoMessage(payload)` | POST /chat/send/video | Envia vídeo |
| `sendAudioMessage(payload)` | POST /chat/send/audio | Envia áudio |
| `sendDocumentMessage(payload)` | POST /chat/send/document | Envia documento |
| `sendLocationMessage(payload)` | POST /chat/send/location | Envia localização |
| `sendContactMessage(payload)` | POST /chat/send/contact | Envia contato |
| `sendReaction(payload)` | POST /chat/send/reaction | Envia reação |

### Chats (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `getChats()` | GET /chat/list | Lista chats |
| `getChatMessages(chatId)` | GET /chat/messages/{chatId} | Mensagens do chat |
| `markAsRead(chatId)` | POST /chat/read/{chatId} | Marca como lido |
| `archiveChat(chatId)` | POST /chat/archive/{chatId} | Arquiva chat |
| `unarchiveChat(chatId)` | POST /chat/unarchive/{chatId} | Desarquiva chat |

### Contatos (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `getContacts()` | GET /contact/list | Lista contatos |
| `getContact(phone)` | GET /contact/get/{phone} | Obtém contato |
| `blockContact(phone)` | POST /contact/block/{phone} | Bloqueia contato |
| `unblockContact(phone)` | POST /contact/unblock/{phone} | Desbloqueia contato |

### Grupos (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `getGroups()` | GET /group/list | Lista grupos |
| `createGroup(payload)` | POST /group/create | Cria grupo |
| `getGroup(groupId)` | GET /group/get/{groupId} | Obtém grupo |
| `updateGroup(groupId, payload)` | PUT /group/update/{groupId} | Atualiza grupo |
| `addGroupParticipants(groupId, payload)` | POST /group/add/{groupId} | Adiciona participantes |
| `removeGroupParticipants(groupId, payload)` | POST /group/remove/{groupId} | Remove participantes |
| `promoteGroupParticipants(groupId, payload)` | POST /group/promote/{groupId} | Promove participantes |
| `demoteGroupParticipants(groupId, payload)` | POST /group/demote/{groupId} | Remove admin |
| `leaveGroup(groupId)` | POST /group/leave/{groupId} | Sai do grupo |

### Webhooks (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `setWebhook(config)` | POST /webhook/set | Configura webhook |
| `getWebhook()` | GET /webhook/get | Obtém webhook |
| `removeWebhook()` | DELETE /webhook/remove | Remove webhook |

### Status e Presença (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `setPresence(payload)` | POST /user/presence | Define presença |
| `setStatus(payload)` | POST /status/set/text | Define status |

### Mídia (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `uploadMedia(payload)` | POST /media/upload | Upload de mídia |
| `getMediaUrl(mediaId)` | GET /media/get/{mediaId} | URL da mídia |

### Configurações (User Token)

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `getSettings()` | GET /settings/get | Obtém configurações |
| `updateSettings(settings)` | PUT /settings/update | Atualiza configurações |

## Exemplos Práticos

### 1. Fluxo Completo de Criação de Usuário

```typescript
// Backend (Node.js)
const wuzapiClient = require('../utils/wuzapiClient');

async function createCompleteUser(userData) {
  try {
    // 1. Criar usuário
    const createResult = await wuzapiClient.createUser(userData, adminToken);
    if (!createResult.success) {
      throw new Error(createResult.error);
    }
    
    console.log('Usuário criado:', createResult.data);
    
    // 2. Verificar se foi criado corretamente
    const userCheck = await wuzapiClient.getAdmin(`/admin/users/${userData.token}`, adminToken);
    if (userCheck.success) {
      console.log('Usuário verificado:', userCheck.data);
    }
    
    return createResult.data;
  } catch (error) {
    console.error('Erro no fluxo:', error);
    throw error;
  }
}
```

### 2. Monitoramento de Status de Usuários

```typescript
// Frontend (React)
import { WuzAPIService } from '@/services/wuzapi';

const useUserMonitoring = () => {
  const [users, setUsers] = useState<WuzAPIUser[]>([]);
  const [loading, setLoading] = useState(true);
  const wuzapi = new WuzAPIService();

  const checkUsersStatus = async () => {
    try {
      const usersList = await wuzapi.getUsers();
      
      // Verificar status de cada usuário
      const usersWithStatus = await Promise.all(
        usersList.map(async (user) => {
          try {
            const status = await wuzapi.getSessionStatus(user.token);
            return {
              ...user,
              currentStatus: status
            };
          } catch (error) {
            return {
              ...user,
              currentStatus: { connected: false, loggedIn: false }
            };
          }
        })
      );
      
      setUsers(usersWithStatus);
    } catch (error) {
      console.error('Erro ao monitorar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUsersStatus();
    const interval = setInterval(checkUsersStatus, 30000); // 30 segundos
    return () => clearInterval(interval);
  }, []);

  return { users, loading, refresh: checkUsersStatus };
};
```

### 3. Sistema de Envio de Mensagens em Lote

```typescript
// Cliente avançado
import { WuzAPIClient } from '@/lib/wuzapi-client';

class BulkMessageSender {
  private client: WuzAPIClient;
  
  constructor(config: WuzAPIAuthConfig) {
    this.client = new WuzAPIClient(config);
  }
  
  async sendBulkMessages(messages: Array<{
    phone: string;
    message: string;
    userToken: string;
  }>) {
    const results = [];
    
    for (const msg of messages) {
      try {
        // Definir token do usuário
        this.client.setUserToken(msg.userToken);
        
        // Enviar mensagem
        const result = await this.client.sendTextMessage({
          phone: msg.phone,
          message: msg.message
        });
        
        results.push({
          phone: msg.phone,
          success: result.success,
          messageId: result.data?.id,
          error: result.error
        });
        
        // Delay entre mensagens para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        results.push({
          phone: msg.phone,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
}
```

### 4. Webhook Handler

```javascript
// Backend - Webhook receiver
app.post('/webhook/wuzapi', (req, res) => {
  const { event, data } = req.body;
  
  switch (event) {
    case 'message':
      handleIncomingMessage(data);
      break;
      
    case 'connect':
      handleUserConnect(data);
      break;
      
    case 'disconnect':
      handleUserDisconnect(data);
      break;
      
    case 'qr':
      handleQRCodeUpdate(data);
      break;
      
    default:
      console.log('Evento não tratado:', event);
  }
  
  res.status(200).json({ success: true });
});

function handleIncomingMessage(data) {
  console.log('Nova mensagem:', data);
  
  // Processar mensagem
  // Salvar no banco
  // Enviar resposta automática se necessário
}

function handleUserConnect(data) {
  console.log('Usuário conectado:', data.phone);
  
  // Atualizar status no banco
  // Notificar frontend via WebSocket
}
```

## Tratamento de Erros

### Tipos de Erro Comuns

#### 1. Erros de Conexão
```typescript
if (response.code === 'CONNECTION_ERROR') {
  // WUZAPI indisponível
  console.log('Serviço temporariamente indisponível');
  // Implementar retry logic
}
```

#### 2. Erros de Timeout
```typescript
if (response.code === 'TIMEOUT') {
  // Requisição demorou muito
  console.log('Timeout na requisição');
  // Tentar novamente com timeout maior
}
```

#### 3. Erros de Autenticação
```typescript
if (response.status === 401) {
  // Token inválido
  console.log('Token expirado ou inválido');
  // Renovar token ou fazer logout
}
```

#### 4. Erros de Validação
```typescript
if (response.status === 400) {
  // Dados inválidos
  console.log('Dados enviados são inválidos:', response.error);
  // Validar dados antes de enviar
}
```

### Implementação de Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError;
}

// Uso
const result = await withRetry(async () => {
  return await wuzapi.getUsers();
}, 3, 1000);
```

## Diferenças com Evolution API

### Estrutura de Endpoints

| Funcionalidade | WUZAPI | Evolution API |
|----------------|--------|---------------|
| Criar instância | POST /instances | POST /instance/create |
| Conectar | POST /instances/{name}/connect | POST /instance/connect/{name} |
| Enviar texto | POST /chat/send/text | POST /message/sendText/{instance} |
| Webhook | POST /webhook/set | POST /webhook/{instance} |
| QR Code | GET /instances/{name}/qr | GET /instance/qrcode/{name} |

### Autenticação

| Aspecto | WUZAPI | Evolution API |
|---------|--------|---------------|
| Admin Token | Header: Authorization | Header: apikey |
| User Token | Header: token | Path parameter |
| Múltiplos usuários | Suporte nativo | Uma instância por vez |

### Formato de Resposta

#### WUZAPI
```json
{
  "success": true,
  "data": { ... },
  "message": "Operação realizada com sucesso"
}
```

#### Evolution API
```json
{
  "instance": {
    "instanceName": "name",
    "status": "open"
  }
}
```

### Webhooks

#### WUZAPI
```json
{
  "event": "message",
  "instance": "user_token",
  "data": {
    "from": "5511999999999",
    "body": "Mensagem recebida"
  }
}
```

#### Evolution API
```json
{
  "event": "messages.upsert",
  "instance": "instance_name",
  "data": {
    "key": { ... },
    "message": { ... }
  }
}
```

## Troubleshooting

### Problemas Comuns

#### 1. "Token administrativo inválido"
```bash
# Verificar token
echo $VITE_ADMIN_TOKEN

# Testar token
curl -H "Authorization: $VITE_ADMIN_TOKEN" \
     https://wzapi.wasend.com.br/admin/users
```

**Soluções:**
- Verificar se o token está correto
- Confirmar se não expirou
- Verificar se tem permissões administrativas

#### 2. "Timeout na comunicação com WuzAPI"
```javascript
// Aumentar timeout
const wuzapiClient = require('../utils/wuzapiClient');
wuzapiClient.timeout = 30000; // 30 segundos
```

**Soluções:**
- Aumentar timeout nas configurações
- Verificar conectividade de rede
- Implementar retry logic

#### 3. "Usuário não conectado"
```typescript
// Verificar status antes de enviar mensagem
const status = await wuzapi.getSessionStatus(userToken);
if (!status.connected || !status.loggedIn) {
  console.log('Usuário precisa conectar primeiro');
  // Mostrar QR Code ou reconectar
}
```

**Soluções:**
- Verificar status da sessão
- Reconectar usuário
- Gerar novo QR Code

#### 4. "Erro ao enviar mensagem"
```typescript
// Validar número de telefone
function validatePhone(phone: string): boolean {
  // Formato: 5511999999999 (país + área + número)
  const phoneRegex = /^55\d{10,11}$/;
  return phoneRegex.test(phone);
}

if (!validatePhone(phone)) {
  throw new Error('Formato de telefone inválido');
}
```

**Soluções:**
- Validar formato do telefone
- Verificar se o número existe no WhatsApp
- Confirmar se o usuário está conectado

### Debug e Logs

#### Habilitar Debug
```bash
# Backend
export DEBUG=wuzapi:*
export LOG_LEVEL=debug

# Logs detalhados
tail -f server/logs/wuzapi.log
```

#### Monitorar Requisições
```javascript
// Interceptar requisições
const originalRequest = wuzapiClient.request;
wuzapiClient.request = async function(...args) {
  console.log('WUZAPI Request:', args);
  const result = await originalRequest.apply(this, args);
  console.log('WUZAPI Response:', result);
  return result;
};
```

### Ferramentas de Teste

#### Postman Collection
```json
{
  "info": {
    "name": "WUZAPI Tests",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/health",
          "host": ["{{baseUrl}}"],
          "path": ["health"]
        }
      }
    },
    {
      "name": "List Users",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "{{adminToken}}"
          }
        ],
        "url": {
          "raw": "{{baseUrl}}/admin/users",
          "host": ["{{baseUrl}}"],
          "path": ["admin", "users"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "https://wzapi.wasend.com.br"
    },
    {
      "key": "adminToken",
      "value": "UeH7cZ2c1K3zVUBFi7SginSC"
    }
  ]
}
```

#### Script de Teste
```bash
#!/bin/bash

BASE_URL="https://wzapi.wasend.com.br"
ADMIN_TOKEN="UeH7cZ2c1K3zVUBFi7SginSC"

echo "Testando WUZAPI..."

# Health check
echo "1. Health check..."
curl -s "$BASE_URL/health" | jq '.status'

# List users
echo "2. Listando usuários..."
curl -s -H "Authorization: $ADMIN_TOKEN" \
     "$BASE_URL/admin/users" | jq '.data | length'

# Test user token
USER_TOKEN="abc123def456"
echo "3. Testando token de usuário..."
curl -s -H "token: $USER_TOKEN" \
     "$BASE_URL/session/status" | jq '.success'

echo "Testes concluídos!"
```

## Recursos Adicionais

### Documentação Oficial
- [WUZAPI Docs](https://wzapi.wasend.com.br/docs)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

### Exemplos no Repositório
- `server/tests/wuzapi-client.test.js` - Testes unitários
- `src/test/wuzapi.test.tsx` - Testes de integração
- `examples/` - Exemplos práticos

### Comunidade
- GitHub Issues para bugs
- Discussions para dúvidas
- Wiki para documentação adicional

---

**Última atualização**: 15 de Janeiro de 2024  
**Versão WUZAPI**: 2.0.0  
**Versão do Guia**: 1.0.0