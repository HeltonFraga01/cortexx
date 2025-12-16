# Guia Prático de Implementação - WUZAPI

## 🎯 Para o Dev Júnior: Do Zero ao Funcionando

Este guia vai te ensinar exatamente como implementar cada funcionalidade do sistema WUZAPI, linha por linha.

---

## 1. Como Criar um Usuário (Passo a Passo Completo)

### Cenário
Você quer criar uma nova instância do WhatsApp no sistema.

### Frontend - Formulário de Criação

```typescript
// src/components/admin/CreateUserForm.tsx
import { useState } from 'react';
import { WuzAPIService } from '@/services/wuzapi';

const CreateUserForm = () => {
  // Estado do formulário
  const [formData, setFormData] = useState({
    name: '',           // Nome do usuário
    token: '',          // Token único (gerado automaticamente)
    webhook: '',        // URL do webhook
    events: 'Message'   // Eventos que o webhook vai receber
  });

  // Instância do serviço
  const wuzapi = new WuzAPIService();

  // Função para gerar token aleatório
  const generateToken = () => {
    // Gera um token único de 20 caracteres
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 20; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, token });
  };

  // Função de submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Validações
      if (!formData.name.trim()) {
        alert('Nome é obrigatório!');
        return;
      }

      if (!formData.token.trim()) {
        alert('Token é obrigatório! Clique em "Gerar Token"');
        return;
      }

      // Criar objeto de requisição
      const userData = {
        name: formData.name,
        token: formData.token,
        webhook: formData.webhook || undefined,  // Se vazio, não envia
        events: formData.events
      };

      // Fazer a requisição
      const newUser = await wuzapi.createUser(userData);

      alert(`Usuário criado com sucesso! ID: ${newUser.id}`);
      
      // Resetar formulário
      setFormData({ name: '', token: '', webhook: '', events: 'Message' });

    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      alert(`Erro: ${error.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Nome"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      
      <div>
        <input
          type="text"
          placeholder="Token"
          value={formData.token}
          onChange={(e) => setFormData({ ...formData, token: e.target.value })}
        />
        <button type="button" onClick={generateToken}>
          Gerar Token
        </button>
      </div>

      <input
        type="url"
        placeholder="Webhook URL (opcional)"
        value={formData.webhook}
        onChange={(e) => setFormData({ ...formData, webhook: e.target.value })}
      />

      <button type="submit">Criar Usuário</button>
    </form>
  );
};
```

### Backend - Serviço que Chama a API

```typescript
// src/services/wuzapi.ts
export class WuzAPIService {
  private baseUrl = '/api';  // Proxy interno

  async createUser(userData: CreateUserRequest): Promise<WuzAPIUser> {
    // Headers necessários
    const headers = {
      'Content-Type': 'application/json'
    };

    // Fazer requisição POST
    const response = await fetch(`${this.baseUrl}/admin/users`, {
      method: 'POST',
      credentials: 'include',  // Importante: inclui cookies de sessão
      headers,
      body: JSON.stringify(userData)  // Converte objeto para JSON
    });

    // Verificar se deu erro
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao criar usuário');
    }

    // Pegar resposta
    const result = await response.json();
    return result.data;  // Retorna objeto do usuário criado
  }
}
```

### Backend Proxy - Node.js

```javascript
// server/routes/wuzapiProxyRoutes.js
const express = require('express');
const router = express.Router();
const wuzapiClient = require('../utils/wuzapiClient');

// POST /api/admin/users - Criar usuário
router.post('/admin/users', async (req, res) => {
  try {
    const { name, token, webhook, events } = req.body;

    // Validações
    if (!name || !token) {
      return res.status(400).json({
        success: false,
        error: 'Nome e token são obrigatórios'
      });
    }

    // Token admin vem da ENV
    const adminToken = process.env.VITE_ADMIN_TOKEN;

    // Chamar WUZAPI
    const result = await wuzapiClient.createUser({
      name,
      token,
      webhook,
      events
    }, adminToken);

    // Retornar resposta
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.status || 500).json(result);
    }

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### Cliente WUZAPI - Requisição HTTP Real

```javascript
// server/utils/wuzapiClient.js
const axios = require('axios');

class WuzAPIClient {
  constructor() {
    this.baseURL = 'https://wzapi.wasend.com.br';
    this.timeout = 10000;
  }

  async createUser(userData, adminToken) {
    try {
      // Fazer POST para WUZAPI
      const response = await axios.post(
        `${this.baseURL}/admin/users`,
        userData,  // Body
        {
          headers: {
            'Authorization': adminToken,  // Header de autenticação
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        }
      );

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      // Tratar erros
      if (error.response) {
        return {
          success: false,
          status: error.response.status,
          error: error.response.data?.error || error.message
        };
      } else {
        return {
          success: false,
          status: 500,
          error: 'Erro de conexão com WUZAPI'
        };
      }
    }
  }
}

module.exports = new WuzAPIClient();
```

---

## 2. Como Conectar ao WhatsApp e Gerar QR Code

### Fluxo Visual

```
1. Usuário clica "Gerar QR Code"
   ↓
2. Frontend chama connectSession()
   ↓
3. Backend chama POST /session/connect
   ↓
4. WUZAPI inicializa sessão WhatsApp
   ↓
5. Frontend aguarda 1 segundo
   ↓
6. Frontend chama getQRCode()
   ↓
7. Backend chama GET /session/qr
   ↓
8. WUZAPI retorna QR em Base64
   ↓
9. Frontend exibe QR Code na tela
   ↓
10. Usuário escaneia com WhatsApp
   ↓
11. WhatsApp valida e conecta
   ↓
12. WUZAPI envia webhook "Connected"
```

### Código Frontend - Componente QR Code

```typescript
// src/components/QRCodeModal.tsx
import { useState } from 'react';
import { WuzAPIService } from '@/services/wuzapi';

interface Props {
  userToken: string;
  userName: string;
  onClose: () => void;
}

const QRCodeModal = ({ userToken, userName, onClose }: Props) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const wuzapi = new WuzAPIService();

  // Função principal para gerar QR
  const generateQR = async () => {
    try {
      setLoading(true);
      setError(null);

      // PASSO 1: Conectar sessão
      console.log('1. Conectando sessão...');
      await wuzapi.connectSession(userToken, {
        Subscribe: ['Message', 'ReadReceipt'],
        Immediate: false
      });

      // PASSO 2: Aguardar sessão inicializar
      console.log('2. Aguardando inicialização...');
      await sleep(1500);  // 1.5 segundos

      // PASSO 3: Obter QR Code
      console.log('3. Obtendo QR Code...');
      const qrData = await wuzapi.getQRCode(userToken);

      if (!qrData || !qrData.QRCode) {
        throw new Error('QR Code não foi gerado');
      }

      // PASSO 4: Exibir QR Code
      setQrCode(qrData.QRCode);
      console.log('4. QR Code recebido!');

      // PASSO 5: Verificar conexão a cada 3 segundos
      startStatusCheck();

    } catch (err) {
      console.error('Erro ao gerar QR:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Função auxiliar de sleep
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Verificar status periodicamente
  const startStatusCheck = () => {
    const interval = setInterval(async () => {
      try {
        const status = await wuzapi.getSessionStatus(userToken);
        
        if (status.loggedIn) {
          console.log('✅ Conectado!');
          setConnected(true);
          clearInterval(interval);
          
          // Fechar modal após 2 segundos
          setTimeout(onClose, 2000);
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 3000);  // A cada 3 segundos

    // Limpar após 2 minutos (timeout)
    setTimeout(() => clearInterval(interval), 120000);
  };

  return (
    <div className="modal">
      <h2>Conectar WhatsApp - {userName}</h2>

      {loading && <p>Gerando QR Code...</p>}
      
      {error && <p style={{ color: 'red' }}>Erro: {error}</p>}

      {!qrCode && !loading && !error && (
        <button onClick={generateQR}>Gerar QR Code</button>
      )}

      {qrCode && !connected && (
        <div>
          <img src={qrCode} alt="QR Code WhatsApp" style={{ width: 300 }} />
          <p>Escaneie com seu WhatsApp</p>
          <p style={{ fontSize: 12, color: 'gray' }}>
            Verificando conexão...
          </p>
        </div>
      )}

      {connected && (
        <div style={{ color: 'green' }}>
          <p>✅ Conectado com sucesso!</p>
          <p>Fechando...</p>
        </div>
      )}

      <button onClick={onClose}>Fechar</button>
    </div>
  );
};

export default QRCodeModal;
```

### Serviço - Métodos de Conexão

```typescript
// src/services/wuzapi.ts (continuação)

export class WuzAPIService {
  // Conectar sessão WhatsApp
  async connectSession(
    userToken: string, 
    options?: { Subscribe?: string[]; Immediate?: boolean }
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/session/connect`, {
      method: 'POST',
      headers: {
        'token': userToken,  // ⚠️ Importante: header 'token', não 'Authorization'
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(options || {})
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Falha ao conectar');
    }

    return response.json();
  }

  // Obter QR Code
  async getQRCode(userToken: string): Promise<{ QRCode: string }> {
    const response = await fetch(`${this.baseUrl}/session/qr`, {
      headers: {
        'token': userToken  // ⚠️ Header 'token'
      }
    });

    if (!response.ok) {
      throw new Error('Falha ao obter QR Code');
    }

    const data = await response.json();
    return data.data;  // { QRCode: "data:image/png;base64,..." }
  }

  // Verificar status da sessão
  async getSessionStatus(userToken: string): Promise<SessionStatus> {
    const response = await fetch(`${this.baseUrl}/session/status`, {
      headers: {
        'token': userToken
      }
    });

    if (!response.ok) {
      throw new Error('Falha ao verificar status');
    }

    const data = await response.json();
    return {
      connected: data.data.Connected || false,
      loggedIn: data.data.LoggedIn || false
    };
  }
}
```

---

## 3. Como Configurar Webhooks

### O que é um Webhook?

**Webhook** é uma URL no seu servidor que a WUZAPI vai chamar quando acontecer algum evento (mensagem recebida, status mudou, etc).

### Exemplo de Webhook Recebido

Quando alguém envia uma mensagem para o WhatsApp conectado, a WUZAPI faz um POST no seu webhook:

```http
POST https://seu-servidor.com/webhook
Content-Type: application/json

{
  "event": "Message",
  "user": "01K7MXQ1BKY9C5FATP50T86",
  "data": {
    "Info": {
      "ID": "3EB0C3F5F5B33C1E8B67D49E",
      "Timestamp": 1699999999,
      "FromMe": false,
      "Source": {
        "ChatJID": "5521987654321@s.whatsapp.net",
        "SenderJID": "5521987654321@s.whatsapp.net"
      }
    },
    "Message": {
      "conversation": "Olá! Preciso de ajuda"
    }
  }
}
```

### Frontend - Configurar Webhook

```typescript
// src/components/WebhookConfig.tsx
import { useState } from 'react';
import { WuzAPIService } from '@/services/wuzapi';

const WebhookConfig = ({ userToken }: { userToken: string }) => {
  const [webhook, setWebhook] = useState('');
  const [events, setEvents] = useState<string[]>(['Message']);
  const wuzapi = new WuzAPIService();

  // Eventos disponíveis
  const availableEvents = [
    'Message',           // Mensagem recebida
    'ReadReceipt',       // Mensagem lida
    'MessageStatus',     // Status da mensagem (enviada, entregue)
    'Connected',         // Usuário conectou
    'Disconnected',      // Usuário desconectou
    'QR',                // Novo QR Code disponível
    'LoggedOut',         // Logout do WhatsApp
    'Call',              // Chamada recebida
    'HistorySync',       // Sincronização de histórico
  ];

  const handleSave = async () => {
    try {
      if (!webhook) {
        alert('Digite a URL do webhook');
        return;
      }

      // Validar URL
      try {
        new URL(webhook);
      } catch {
        alert('URL inválida');
        return;
      }

      // Salvar configuração
      await wuzapi.setWebhook(userToken, webhook, events);
      
      alert('Webhook configurado com sucesso!');

    } catch (error) {
      alert(`Erro: ${error.message}`);
    }
  };

  const toggleEvent = (event: string) => {
    if (events.includes(event)) {
      setEvents(events.filter(e => e !== event));
    } else {
      setEvents([...events, event]);
    }
  };

  return (
    <div>
      <h3>Configurar Webhook</h3>
      
      <input
        type="url"
        placeholder="https://seu-servidor.com/webhook"
        value={webhook}
        onChange={(e) => setWebhook(e.target.value)}
      />

      <h4>Eventos para Receber:</h4>
      {availableEvents.map(event => (
        <label key={event}>
          <input
            type="checkbox"
            checked={events.includes(event)}
            onChange={() => toggleEvent(event)}
          />
          {event}
        </label>
      ))}

      <button onClick={handleSave}>Salvar Configuração</button>
    </div>
  );
};
```

### Backend - Receber Webhooks

```javascript
// server/routes/webhookReceiver.js
const express = require('express');
const router = express.Router();

// Endpoint que recebe webhooks da WUZAPI
router.post('/webhook/:userId', async (req, res) => {
  const { userId } = req.params;
  const { event, data } = req.body;

  console.log(`📩 Webhook recebido para ${userId}:`, event);

  try {
    // Processar conforme o tipo de evento
    switch (event) {
      case 'Message':
        await handleMessage(userId, data);
        break;

      case 'Connected':
        await handleConnection(userId, data);
        break;

      case 'ReadReceipt':
        await handleReadReceipt(userId, data);
        break;

      default:
        console.log(`Evento não tratado: ${event}`);
    }

    // Sempre responder 200 OK
    res.status(200).json({ success: true });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    // Mesmo com erro, retornar 200 para WUZAPI não reenviar
    res.status(200).json({ success: false, error: error.message });
  }
});

// Função para tratar mensagem recebida
async function handleMessage(userId, data) {
  const message = {
    id: data.Info.ID,
    from: data.Info.Source.ChatJID,
    timestamp: data.Info.Timestamp,
    body: data.Message.conversation || data.Message.extendedTextMessage?.text || '',
    fromMe: data.Info.FromMe
  };

  console.log(`💬 Mensagem de ${message.from}: ${message.body}`);

  // Salvar no banco de dados
  // await db.messages.insert({ userId, ...message });

  // Responder automaticamente?
  if (message.body.toLowerCase() === 'oi') {
    // await sendAutoReply(userId, message.from, 'Olá! Como posso ajudar?');
  }
}

// Função para tratar conexão
async function handleConnection(userId, data) {
  console.log(`✅ Usuário ${userId} conectou:`, data.jid);
  
  // Atualizar status no banco
  // await db.users.update(userId, { connected: true, jid: data.jid });
}

module.exports = router;
```

---

## 4. Como Enviar Mensagens

### Exemplo Simples

```typescript
// Enviar mensagem de texto
const sendMessage = async () => {
  const wuzapi = new WuzAPIService();
  
  try {
    const result = await wuzapi.sendTextMessage(
      'SEU-TOKEN-AQUI',           // Token do usuário
      '5511999998888',            // Número destino (formato internacional)
      'Olá! Esta é uma mensagem de teste.'  // Texto
    );

    console.log('Mensagem enviada!', result);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
};
```

### Implementação no Serviço

```typescript
// src/services/wuzapi.ts (continuação)

export class WuzAPIService {
  async sendTextMessage(
    userToken: string,
    phone: string,
    body: string,
    options?: any
  ): Promise<any> {
    // Normalizar número
    const normalizedPhone = this.normalizePhone(phone);

    const response = await fetch(`${this.baseUrl}/chat/send/text`, {
      method: 'POST',
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        Phone: normalizedPhone,  // Número no formato internacional
        Body: body,              // Texto da mensagem
        ...options               // Opções extras (quotedID, etc)
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Falha ao enviar mensagem');
    }

    return response.json();
  }

  // Normalizar número de telefone
  private normalizePhone(phone: string): string {
    // Remove tudo que não é número
    let cleaned = phone.replace(/\D/g, '');

    // Se começar com 0, remove
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }

    // Se não tiver código do país, adiciona Brasil (55)
    if (!cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }

    return cleaned;
  }
}
```

### Exemplos Avançados

```typescript
// Enviar com citação (reply)
await wuzapi.sendTextMessage(
  userToken,
  '5511999998888',
  'Respondendo sua mensagem!',
  { QuotedID: 'ID-DA-MENSAGEM-ORIGINAL' }
);

// Enviar imagem
await fetch(`${baseUrl}/chat/send/image`, {
  method: 'POST',
  headers: { 'token': userToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Phone: '5511999998888',
    Media: 'https://exemplo.com/imagem.jpg',
    Caption: 'Legenda da imagem'
  })
});

// Enviar documento
await fetch(`${baseUrl}/chat/send/document`, {
  method: 'POST',
  headers: { 'token': userToken, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    Phone: '5511999998888',
    Media: 'https://exemplo.com/documento.pdf',
    FileName: 'Relatório.pdf'
  })
});
```

---

## 5. Fluxo Completo de Uma Aplicação Real

### Estrutura de Pastas

```
meu-projeto/
├── frontend/
│   ├── src/
│   │   ├── services/
│   │   │   └── wuzapi.ts          # Cliente da API
│   │   ├── components/
│   │   │   ├── CreateUser.tsx      # Criar usuário
│   │   │   ├── QRCodeModal.tsx     # Gerar QR
│   │   │   └── SendMessage.tsx     # Enviar mensagem
│   │   └── App.tsx
│   └── package.json
│
└── backend/
    ├── routes/
    │   ├── wuzapiProxy.js          # Proxy para WUZAPI
    │   └── webhookReceiver.js      # Recebe webhooks
    ├── utils/
    │   └── wuzapiClient.js         # Cliente HTTP
    └── server.js
```

### Fluxo de Dados

```
CRIAR USUÁRIO:
[Usuário preenche form] 
  → [Frontend: CreateUser.tsx] 
  → [Frontend: wuzapi.createUser()] 
  → [Backend: POST /api/admin/users] 
  → [Backend: wuzapiClient.createUser()] 
  → [WUZAPI: POST /admin/users] 
  → [Resposta volta pelo mesmo caminho]

CONECTAR WHATSAPP:
[Usuário clica "Gerar QR"]
  → [Frontend: QRCodeModal.tsx]
  → [Frontend: wuzapi.connectSession()]
  → [Backend: POST /api/session/connect]
  → [WUZAPI: POST /session/connect]
  → [Aguarda 1s]
  → [Frontend: wuzapi.getQRCode()]
  → [Backend: GET /api/session/qr]
  → [WUZAPI: GET /session/qr]
  → [Exibe QR na tela]
  → [Usuário escaneia]
  → [WhatsApp valida]
  → [WUZAPI: POST webhook "Connected"]
  → [Backend: POST /webhook/:userId]
  → [Atualiza banco/UI]

ENVIAR MENSAGEM:
[Usuário digita e envia]
  → [Frontend: SendMessage.tsx]
  → [Frontend: wuzapi.sendTextMessage()]
  → [Backend: POST /api/chat/send/text]
  → [WUZAPI: POST /chat/send/text]
  → [WhatsApp envia]
  → [Mensagem entregue]
  → [WUZAPI: POST webhook "MessageStatus"]

RECEBER MENSAGEM:
[Alguém manda mensagem]
  → [WhatsApp recebe]
  → [WUZAPI: POST webhook "Message"]
  → [Backend: POST /webhook/:userId]
  → [Processa mensagem]
  → [Salva no banco]
  → [Notifica frontend via WebSocket]
  → [UI atualiza]
```

---

## 6. Tratamento de Erros Completo

```typescript
// src/utils/errorHandler.ts

export class WuzAPIErrorHandler {
  static handle(error: any): string {
    const message = error.message?.toLowerCase() || '';

    // Erros de autenticação
    if (message.includes('401') || message.includes('unauthorized')) {
      return '🔐 Token inválido ou expirado. Verifique suas credenciais.';
    }

    // Usuário não encontrado
    if (message.includes('404') || message.includes('not found')) {
      return '❌ Usuário não encontrado. Ele pode ter sido removido.';
    }

    // Dados inválidos
    if (message.includes('400') || message.includes('bad request')) {
      return '⚠️ Dados inválidos. Verifique os campos e tente novamente.';
    }

    // Sessão não iniciada
    if (message.includes('session')) {
      return '📱 Sessão WhatsApp não iniciada. Gere o QR Code primeiro.';
    }

    // Timeout
    if (message.includes('timeout')) {
      return '⏱️ Tempo esgotado. Tente novamente.';
    }

    // Erro de conexão
    if (message.includes('network') || message.includes('fetch')) {
      return '🌐 Problema de conexão. Verifique sua internet.';
    }

    // Erro genérico
    return `❌ Erro: ${error.message}`;
  }
}

// Uso:
try {
  await wuzapi.createUser(userData);
} catch (error) {
  const friendlyMessage = WuzAPIErrorHandler.handle(error);
  alert(friendlyMessage);
}
```

---

## 7. Checklist para Dev Júnior

### ✅ Antes de Começar
- [ ] Entendi o que é a WUZAPI
- [ ] Sei a diferença entre Admin Token e User Token
- [ ] Conheço os principais endpoints
- [ ] Entendi o fluxo de QR Code

### ✅ Implementando Criação de Usuário
- [ ] Criei formulário no frontend
- [ ] Implementei validações
- [ ] Adicionei gerador de token
- [ ] Testei erro de campos vazios
- [ ] Testei criação com sucesso

### ✅ Implementando Conexão WhatsApp
- [ ] Criei componente de QR Code
- [ ] Implementei connectSession()
- [ ] Implementei getQRCode()
- [ ] Adicionei verificação de status
- [ ] Testei fluxo completo

### ✅ Implementando Webhooks
- [ ] Criei endpoint para receber
- [ ] Implementei handlers de eventos
- [ ] Testei recebimento de mensagem
- [ ] Adicionei logs para debug

### ✅ Implementando Envio de Mensagens
- [ ] Implementei sendTextMessage()
- [ ] Adicionei normalização de número
- [ ] Testei envio bem-sucedido
- [ ] Tratei erros corretamente

---

## 8. Dicas e Boas Práticas

### 🎯 Dica 1: Sempre Normalize Números
```typescript
// ❌ Errado
sendMessage(token, '(11) 99999-8888', 'Oi');

// ✅ Correto
sendMessage(token, '5511999998888', 'Oi');
```

### 🎯 Dica 2: Aguarde Antes de Pegar QR
```typescript
// ❌ Errado - QR pode não estar pronto
await connectSession(token);
const qr = await getQRCode(token);  // ⚠️ Pode falhar

// ✅ Correto
await connectSession(token);
await sleep(1500);  // Aguarda 1.5s
const qr = await getQRCode(token);  // ✅ OK
```

### 🎯 Dica 3: Sempre Responda 200 OK no Webhook
```javascript
// ❌ Errado
router.post('/webhook', (req, res) => {
  processMessage(req.body);
  res.status(500).json({ error: 'Falhou' });  // WUZAPI vai reenviar!
});

// ✅ Correto
router.post('/webhook', (req, res) => {
  processMessage(req.body).catch(console.error);
  res.status(200).json({ success: true });  // Sempre 200!
});
```

### 🎯 Dica 4: Use Try-Catch em Tudo
```typescript
// Sempre proteja chamadas de API
const createUser = async () => {
  try {
    const user = await wuzapi.createUser(data);
    showSuccess('Usuário criado!');
  } catch (error) {
    showError(WuzAPIErrorHandler.handle(error));
  }
};
```

---

## Conclusão

Agora você tem conhecimento completo para implementar WUZAPI do zero! 🚀

**Próximos passos**:
1. Crie um usuário de teste
2. Conecte seu WhatsApp
3. Configure um webhook
4. Envie sua primeira mensagem
5. Receba e processe mensagens

**Recursos adicionais**:
- Documentação completa: `documentacao-completa-api.md`
- Guia de integração: `integration-guide.md`
- Código fonte: `src/services/wuzapi.ts`
