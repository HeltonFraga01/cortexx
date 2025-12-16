# Comparação: WUZAPI vs Evolution API

Este documento detalha as principais diferenças entre WUZAPI e Evolution API, facilitando a migração e integração.

## Índice

- [Visão Geral](#visão-geral)
- [Arquitetura](#arquitetura)
- [Autenticação](#autenticação)
- [Endpoints](#endpoints)
- [Formato de Dados](#formato-de-dados)
- [Webhooks](#webhooks)
- [Funcionalidades](#funcionalidades)
- [Migração](#migração)
- [Vantagens e Desvantagens](#vantagens-e-desvantagens)

## Visão Geral

### WUZAPI
- **Foco**: Multi-usuário nativo
- **Arquitetura**: Centralizada com gerenciamento de usuários
- **Autenticação**: Dupla (Admin + User tokens)
- **Instâncias**: Gerenciadas automaticamente por usuário

### Evolution API
- **Foco**: Instâncias independentes
- **Arquitetura**: Uma instância por conexão WhatsApp
- **Autenticação**: API Key por instância
- **Instâncias**: Criação e gerenciamento manual

## Arquitetura

### WUZAPI
```
┌─────────────────┐
│   WUZAPI API    │
├─────────────────┤
│ Admin Token     │ ← Gerencia usuários
├─────────────────┤
│ User 1 (token1) │ ← Instância WhatsApp 1
│ User 2 (token2) │ ← Instância WhatsApp 2
│ User 3 (token3) │ ← Instância WhatsApp 3
└─────────────────┘
```

### Evolution API
```
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Instance 1      │   │ Instance 2      │   │ Instance 3      │
│ (API Key 1)     │   │ (API Key 2)     │   │ (API Key 3)     │
│ WhatsApp 1      │   │ WhatsApp 2      │   │ WhatsApp 3      │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Autenticação

### WUZAPI

#### Admin Token
```bash
# Gerenciar usuários
curl -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
     https://wzapi.wasend.com.br/admin/users
```

#### User Token
```bash
# Operações do usuário
curl -H "token: abc123def456" \
     https://wzapi.wasend.com.br/session/status
```

### Evolution API

#### API Key Global
```bash
# Todas as operações
curl -H "apikey: B6D711FCDE4D4FD5936544120E713976" \
     https://evolution-api.com/instance/create
```

#### Por Instância
```bash
# Operações específicas da instância
curl -H "apikey: instance_specific_key" \
     https://evolution-api.com/message/sendText/myinstance
```

## Endpoints

### Criar Instância/Usuário

#### WUZAPI
```bash
POST /admin/users
Authorization: {admin_token}

{
  "name": "João Silva",
  "token": "user_token_123",
  "webhook": "https://meusite.com/webhook"
}
```

#### Evolution API
```bash
POST /instance/create
apikey: {api_key}

{
  "instanceName": "myinstance",
  "webhook": "https://meusite.com/webhook"
}
```

### Conectar WhatsApp

#### WUZAPI
```bash
POST /session/connect
token: {user_token}

{
  "Subscribe": ["Message"],
  "Immediate": true
}
```

#### Evolution API
```bash
POST /instance/connect/myinstance
apikey: {api_key}
```

### Obter QR Code

#### WUZAPI
```bash
GET /session/qr
token: {user_token}
```

#### Evolution API
```bash
GET /instance/qrcode/myinstance
apikey: {api_key}
```

### Enviar Mensagem

#### WUZAPI
```bash
POST /chat/send/text
token: {user_token}

{
  "phone": "5511999999999",
  "message": "Olá!"
}
```

#### Evolution API
```bash
POST /message/sendText/myinstance
apikey: {api_key}

{
  "number": "5511999999999",
  "text": "Olá!"
}
```

### Status da Sessão

#### WUZAPI
```bash
GET /session/status
token: {user_token}

# Resposta
{
  "success": true,
  "data": {
    "Connected": true,
    "LoggedIn": true
  }
}
```

#### Evolution API
```bash
GET /instance/connectionState/myinstance
apikey: {api_key}

# Resposta
{
  "instance": {
    "instanceName": "myinstance",
    "state": "open"
  }
}
```

## Formato de Dados

### Resposta de Sucesso

#### WUZAPI
```json
{
  "success": true,
  "code": 200,
  "data": {
    "id": "msg_123",
    "status": "sent"
  },
  "message": "Mensagem enviada com sucesso",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Evolution API
```json
{
  "key": {
    "remoteJid": "5511999999999@s.whatsapp.net",
    "fromMe": true,
    "id": "msg_123"
  },
  "message": {
    "conversation": "Olá!"
  },
  "messageTimestamp": 1642248600
}
```

### Resposta de Erro

#### WUZAPI
```json
{
  "success": false,
  "error": "Token inválido",
  "code": 401,
  "message": "Token de usuário expirado",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Evolution API
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key",
  "statusCode": 401
}
```

## Webhooks

### WUZAPI

#### Configuração
```bash
POST /webhook
token: {user_token}

{
  "webhook": "https://meusite.com/webhook",
  "events": ["Message", "ReadReceipt"],
  "subscribe": ["Message"]
}
```

#### Payload Recebido
```json
{
  "event": "message",
  "instance": "user_token_123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "id": "msg_123",
    "from": "5511999999999",
    "to": "5511888888888",
    "body": "Mensagem recebida",
    "type": "text",
    "timestamp": 1642248600
  }
}
```

### Evolution API

#### Configuração
```bash
POST /webhook/myinstance
apikey: {api_key}

{
  "url": "https://meusite.com/webhook",
  "events": ["messages.upsert", "connection.update"]
}
```

#### Payload Recebido
```json
{
  "event": "messages.upsert",
  "instance": "myinstance",
  "data": {
    "key": {
      "remoteJid": "5511999999999@s.whatsapp.net",
      "fromMe": false,
      "id": "msg_123"
    },
    "message": {
      "conversation": "Mensagem recebida"
    },
    "messageTimestamp": 1642248600
  }
}
```

## Funcionalidades

### Comparação de Recursos

| Funcionalidade | WUZAPI | Evolution API | Observações |
|----------------|--------|---------------|-------------|
| **Gerenciamento** |
| Multi-usuário | ✅ Nativo | ⚠️ Manual | WUZAPI gerencia automaticamente |
| Admin Dashboard | ✅ Integrado | ❌ Separado | WUZAPI tem painel admin |
| Estatísticas | ✅ Por usuário | ✅ Por instância | Ambos têm métricas |
| **Mensagens** |
| Texto | ✅ | ✅ | Ambos suportam |
| Mídia | ✅ | ✅ | Imagem, vídeo, áudio, documento |
| Localização | ✅ | ✅ | Coordenadas GPS |
| Contato | ✅ | ✅ | vCard |
| Reações | ✅ | ✅ | Emojis |
| **Grupos** |
| Criar grupo | ✅ | ✅ | Ambos suportam |
| Gerenciar participantes | ✅ | ✅ | Adicionar/remover |
| Administradores | ✅ | ✅ | Promover/rebaixar |
| **Avançado** |
| Webhooks | ✅ | ✅ | Eventos personalizáveis |
| Status/Presença | ✅ | ✅ | Online/offline |
| Backup/Restore | ❌ | ✅ | Evolution tem backup |
| Proxy | ✅ | ✅ | Suporte a proxy |

### Eventos de Webhook

#### WUZAPI
- `message` - Nova mensagem
- `connect` - Usuário conectado
- `disconnect` - Usuário desconectado
- `qr` - QR Code atualizado
- `ack` - Confirmação de entrega
- `typing` - Usuário digitando
- `presence` - Mudança de presença

#### Evolution API
- `messages.upsert` - Mensagem nova/atualizada
- `connection.update` - Status de conexão
- `qr.updated` - QR Code atualizado
- `messages.delete` - Mensagem deletada
- `groups.upsert` - Grupo criado/atualizado
- `contacts.upsert` - Contato atualizado

## Migração

### De Evolution API para WUZAPI

#### 1. Mapeamento de Conceitos
```javascript
// Evolution API
const instanceName = "myinstance";
const apiKey = "B6D711FCDE4D4FD5936544120E713976";

// WUZAPI equivalente
const userName = "myuser";
const adminToken = "UeH7cZ2c1K3zVUBFi7SginSC";
const userToken = "abc123def456";
```

#### 2. Migração de Endpoints
```javascript
// Função de migração
function migrateEndpoint(evolutionCall) {
  const migrations = {
    // Criar instância -> Criar usuário
    'POST /instance/create': 'POST /admin/users',
    
    // Conectar -> Conectar sessão
    'POST /instance/connect/{instance}': 'POST /session/connect',
    
    // QR Code
    'GET /instance/qrcode/{instance}': 'GET /session/qr',
    
    // Enviar mensagem
    'POST /message/sendText/{instance}': 'POST /chat/send/text',
    
    // Status
    'GET /instance/connectionState/{instance}': 'GET /session/status'
  };
  
  return migrations[evolutionCall] || evolutionCall;
}
```

#### 3. Migração de Dados
```javascript
// Evolution API payload
const evolutionPayload = {
  instanceName: "myinstance",
  webhook: "https://meusite.com/webhook"
};

// WUZAPI payload
const wuzapiPayload = {
  name: evolutionPayload.instanceName,
  token: generateUserToken(),
  webhook: evolutionPayload.webhook
};
```

#### 4. Migração de Webhooks
```javascript
// Evolution webhook handler
app.post('/webhook/evolution', (req, res) => {
  const { event, instance, data } = req.body;
  
  if (event === 'messages.upsert') {
    handleMessage(data);
  }
});

// WUZAPI webhook handler
app.post('/webhook/wuzapi', (req, res) => {
  const { event, instance, data } = req.body;
  
  if (event === 'message') {
    handleMessage(data);
  }
});
```

### De WUZAPI para Evolution API

#### 1. Separar Usuários em Instâncias
```javascript
// WUZAPI: Um usuário
const user = {
  name: "João Silva",
  token: "abc123",
  webhook: "https://meusite.com/webhook"
};

// Evolution: Uma instância
const instance = {
  instanceName: user.name.toLowerCase().replace(' ', '_'),
  webhook: user.webhook
};
```

#### 2. Migrar Autenticação
```javascript
// WUZAPI
const headers = {
  'Authorization': adminToken, // Para admin
  'token': userToken          // Para usuário
};

// Evolution API
const headers = {
  'apikey': apiKey            // Para tudo
};
```

## Vantagens e Desvantagens

### WUZAPI

#### ✅ Vantagens
- **Multi-usuário nativo**: Gerenciamento centralizado
- **Autenticação dupla**: Separação clara admin/usuário
- **API consistente**: Formato padronizado de resposta
- **Gerenciamento simplificado**: Menos configuração manual
- **Dashboard integrado**: Painel administrativo nativo

#### ❌ Desvantagens
- **Menos flexibilidade**: Estrutura mais rígida
- **Dependência do serviço**: Menos controle sobre instâncias
- **Documentação limitada**: Menos exemplos na comunidade
- **Backup manual**: Não tem sistema de backup automático

### Evolution API

#### ✅ Vantagens
- **Flexibilidade total**: Controle completo sobre instâncias
- **Backup/Restore**: Sistema de backup integrado
- **Comunidade ativa**: Mais exemplos e suporte
- **Self-hosted**: Pode ser hospedado localmente
- **Documentação extensa**: Muitos exemplos e casos de uso

#### ❌ Desvantagens
- **Complexidade**: Gerenciamento manual de instâncias
- **Escalabilidade**: Difícil gerenciar muitas instâncias
- **Inconsistência**: Formatos de resposta variados
- **Configuração**: Mais setup inicial necessário

## Casos de Uso Recomendados

### Use WUZAPI quando:
- Precisa gerenciar múltiplos usuários WhatsApp
- Quer um sistema centralizado e simplificado
- Foca em desenvolvimento rápido
- Precisa de separação clara admin/usuário
- Quer menos configuração manual

### Use Evolution API quando:
- Precisa de controle total sobre instâncias
- Quer hospedar localmente
- Tem requisitos específicos de backup
- Precisa de máxima flexibilidade
- Tem equipe técnica para gerenciar complexidade

## Exemplo de Implementação Híbrida

```javascript
// Adapter pattern para suportar ambas as APIs
class WhatsAppAdapter {
  constructor(type, config) {
    this.type = type;
    this.config = config;
    
    if (type === 'wuzapi') {
      this.client = new WuzAPIClient(config);
    } else if (type === 'evolution') {
      this.client = new EvolutionAPIClient(config);
    }
  }
  
  async sendMessage(phone, message) {
    if (this.type === 'wuzapi') {
      return await this.client.sendTextMessage({
        phone,
        message
      });
    } else {
      return await this.client.sendText(this.config.instance, {
        number: phone,
        text: message
      });
    }
  }
  
  async getStatus() {
    if (this.type === 'wuzapi') {
      return await this.client.getUserStatus();
    } else {
      return await this.client.getConnectionState(this.config.instance);
    }
  }
}

// Uso
const wuzapi = new WhatsAppAdapter('wuzapi', {
  baseUrl: 'https://wzapi.wasend.com.br',
  adminToken: 'admin_token',
  userToken: 'user_token'
});

const evolution = new WhatsAppAdapter('evolution', {
  baseUrl: 'https://evolution-api.com',
  apiKey: 'api_key',
  instance: 'myinstance'
});
```

---

**Conclusão**: Ambas as APIs têm seus méritos. WUZAPI é ideal para sistemas multi-usuário com gerenciamento centralizado, enquanto Evolution API oferece máxima flexibilidade e controle. A escolha depende dos requisitos específicos do projeto e da complexidade que você está disposto a gerenciar.