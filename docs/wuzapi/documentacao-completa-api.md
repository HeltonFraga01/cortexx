# Documentação Técnica Completa - API WUZAPI para WhatsApp

## 📋 Índice

1. [Introdução](#introdução)
2. [Arquitetura da API](#arquitetura-da-api)
3. [Autenticação](#autenticação)
4. [Fluxo Completo: Criação de Conta](#fluxo-completo-criação-de-conta)
5. [Fluxo Completo: Conexão WhatsApp](#fluxo-completo-conexão-whatsapp)
6. [Fluxo Completo: QR Code](#fluxo-completo-qr-code)
7. [Explicação das Telas](#explicação-das-telas)
8. [Referência de Endpoints](#referência-de-endpoints)
9. [Exemplos Práticos](#exemplos-práticos)

---

## Introdução

A **WUZAPI** é uma API RESTful para integração com WhatsApp Multi-Device. Ela permite criar múltiplas instâncias/usuários, enviar mensagens, receber webhooks e gerenciar conexões.

### URL Base
```
https://wzapi.wasend.com.br
```

### Principais Características
- ✅ Múltiplas instâncias simultâneas
- ✅ Webhooks para eventos em tempo real
- ✅ Autenticação via QR Code
- ✅ Envio de mensagens (texto, mídia, documentos)
- ✅ Gerenciamento de grupos e contatos

---

## Arquitetura da API

```
┌─────────────────────┐
│   Frontend React    │
│   (WaSendGO UI)     │
└──────────┬──────────┘
           │ HTTP/HTTPS
           ▼
┌─────────────────────┐
│   Backend Node.js   │
│   (Proxy Layer)     │
└──────────┬──────────┘
           │ HTTP/HTTPS
           ▼
┌─────────────────────┐
│   WUZAPI Server     │
│   (WhatsApp API)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   WhatsApp Servers  │
└─────────────────────┘
```

### Camadas

1. **Frontend (React)**: Interface do usuário
2. **Backend (Node.js)**: Proxy que adiciona autenticação e segurança
3. **WUZAPI**: Servidor que gerencia conexões WhatsApp
4. **WhatsApp**: Servidores oficiais do WhatsApp

---

## Autenticação

A WUZAPI utiliza **dois tipos de tokens**:

### 1️⃣ Admin Token (Token Administrativo)

**Propósito**: Gerenciar usuários e configurações do sistema

**Header**:
```
Authorization: UeH7cZ2c1K3zVUBFi7SginSC
```

**Usado em**:
- Criar usuários
- Listar todos os usuários
- Deletar usuários
- Configurações globais

### 2️⃣ User Token (Token de Usuário)

**Propósito**: Operações específicas de cada instância WhatsApp

**Header**:
```
token: 01K7MXQ1BKY9C5FATP50T86
```

**Usado em**:
- Conectar sessão WhatsApp
- Obter QR Code
- Enviar mensagens
- Configurar webhook do usuário
- Verificar status da sessão

---

## Fluxo Completo: Criação de Conta

### Passo 1: Clicar em "Novo Usuário"

O administrador clica no botão **"Novo Usuário"** na interface.

### Passo 2: Preencher Formulário

**Campos necessários**:
- **Nome**: Identificação do usuário (ex: "HeltonFraga")
- **Token**: Token único gerado (ex: "01K7MXQ1BKY9C5FATP50T86")
- **Webhook URL**: URL para receber eventos (opcional)
- **Eventos**: Quais eventos o webhook receberá

### Passo 3: Chamada ao Endpoint

**Endpoint**: `POST /admin/users`

**Headers**:
```http
Authorization: UeH7cZ2c1K3zVUBFi7SginSC
Content-Type: application/json
```

**Body (Exemplo)**:
```json
{
  "name": "HeltonFraga",
  "token": "01K7MXQ1BKY9C5FATP50T86",
  "webhook": "https://webhooks.wasend.com.br/webhook/558f9601-5396-424c-bd4f-4b29d7a503c8",
  "events": "Message"
}
```

**Por que é assim?**
- `name`: Para identificar visualmente o usuário no painel
- `token`: Será usado para todas as operações dessa instância WhatsApp
- `webhook`: URL onde a WUZAPI enviará notificações de eventos
- `events`: Filtra quais eventos serão enviados ao webhook

### Passo 4: Resposta da API

**Success (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "3eaffa6b496a8dd63a79bd7facd8ca6c5",
    "name": "HeltonFraga",
    "token": "01K7MXQ1BKY9C5FATP50T86",
    "webhook": "https://webhooks.wasend.com.br/webhook/558f9601-5396-424c-bd4f-4b29d7a503c8",
    "events": "Message",
    "connected": false,
    "loggedIn": false,
    "jid": "",
    "qrcode": "",
    "expiration": 0
  }
}
```

**Explicação dos campos retornados**:
- `id`: ID único gerado pelo servidor
- `connected`: Indica se há conexão ativa com WUZAPI
- `loggedIn`: Indica se está autenticado no WhatsApp
- `jid`: Phone number no formato WhatsApp (ex: "5531949474759:50@s.whatsapp.net")
- `qrcode`: Base64 do QR Code (vazio até gerar)
- `expiration`: Timestamp de expiração da sessão

### Passo 5: Usuário Criado

O usuário agora aparece na lista com status **"Offline"** (não conectado).

---

## Fluxo Completo: Conexão WhatsApp

### Passo 1: Abrir Painel do Usuário

O administrador clica em **"Editar"** no usuário desejado.

### Passo 2: Visualizar Status Atual

**Endpoint de Status**: `GET /session/status`

**Headers**:
```http
token: 01K7MXQ1BKY9C5FATP50T86
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "data": {
    "Connected": false,
    "LoggedIn": false
  }
}
```

**Estados possíveis**:
- `Connected: false, LoggedIn: false` = Offline (nunca conectou)
- `Connected: true, LoggedIn: false` = Conectado mas não autenticado (aguardando QR)
- `Connected: true, LoggedIn: true` = 🟢 Logado e funcionando

### Passo 3: Iniciar Conexão

O usuário clica em **"Gerar QR Code"** ou o sistema chama automaticamente.

**Endpoint**: `POST /session/connect`

**Headers**:
```http
token: 01K7MXQ1BKY9C5FATP50T86
Content-Type: application/json
```

**Body** (opcional):
```json
{
  "Subscribe": ["Message", "ReadReceipt"],
  "Immediate": false
}
```

**Explicação**:
- `Subscribe`: Eventos que a sessão vai processar
- `Immediate`: Se `true`, conecta imediatamente sem esperar

**Response**:
```json
{
  "success": true,
  "message": "Session connecting"
}
```

---

## Fluxo Completo: QR Code

### Passo 1: Solicitar QR Code

Após conectar a sessão, é necessário gerar o QR Code.

**Endpoint**: `GET /session/qr`

**Headers**:
```http
token: 01K7MXQ1BKY9C5FATP50T86
Content-Type: application/json
```

**Response**:
```json
{
  "success": true,
  "data": {
    "QRCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEA..."
  }
}
```

### Passo 2: Exibir QR Code

O frontend recebe o QR Code em **Base64** e exibe na tela:

```javascript
<img src={qrData.QRCode} alt="QR Code WhatsApp" />
```

**Como funciona o QR Code?**

1. WUZAPI cria uma sessão WhatsApp
2. WhatsApp gera um código único de pareamento
3. WUZAPI converte em QR Code (imagem)
4. Usuário escaneia com WhatsApp no celular
5. WhatsApp autentica e vincula a sessão

### Passo 3: Escanear QR Code

O usuário:
1. Abre WhatsApp no celular
2. Vai em **Dispositivos Conectados** → **Conectar um dispositivo**
3. Escaneia o QR Code exibido

### Passo 4: Conexão Estabelecida

**O que acontece?**

1. WhatsApp valida o QR Code
2. Envia confirmação para WUZAPI
3. WUZAPI atualiza status: `LoggedIn: true`
4. **Webhook é disparado** (evento "Connected")

**Webhook recebido**:
```json
{
  "event": "Connected",
  "data": {
    "user": "01K7MXQ1BKY9C5FATP50T86",
    "jid": "5531949474759:50@s.whatsapp.net",
    "name": "HeltonFraga"
  }
}
```

### Passo 5: Status Atualizado

O painel agora mostra:
- **Status**: 🟢 Logado / Conectado
- **JID WhatsApp**: `5531949474759:50@s.whatsapp.net`
- **Mensagens Enviadas**: 3

---

## Explicação das Telas

### Tela 1: Gerenciar Usuários

![Tela de Usuários](file:///Users/heltonfraga/.gemini/antigravity/brain/1736ddeb-0c7b-4ec1-8804-fdff3edce5eb/uploaded_image_0_1763651840672.png)

**O que mostra**: Lista todos os usuários cadastrados

**Colunas**:
- **Usuário**: Nome da instância
- **Status**: Logado (verde), Offline (cinza)
- **Token**: Primeiros 8 caracteres do token
- **JID WhatsApp**: Número conectado ou "Não conectado"
- **Eventos**: Eventos configurados no webhook
- **Ações**: Botão "Editar"

**Chamadas de API ao carregar**:
```javascript
GET /api/admin/users
Authorization: UeH7cZ2c1K3zVUBFi7SginSC
```

**Atualização**: A cada 30 segundos ou ao clicar em "Refresh"

---

### Tela 2: Editar Usuário - Informações Básicas

![Editar Usuário](file:///Users/heltonfraga/.gemini/antigravity/brain/1736ddeb-0c7b-4ec1-8804-fdff3edce5eb/uploaded_image_1_1763651840672.png)

**Seção: Informações Básicas**

**Campos**:
- **Nome**: Nome do usuário (editável)
- **Token**: Token de acesso (somente leitura)
- **Status da Conexão**: Badge verde "Logado e Ativo"
- **JID WhatsApp**: Número conectado

**Seção: Configurações de Webhook**

**Campos**:
- **URL do Webhook**: Onde eventos serão enviados
- **Eventos do Webhook**: Link para configurar

**API ao salvar**:
```javascript
POST /api/webhook
token: 01K7MXQ1BKY9C5FATP50T86
{
  "webhook": "https://webhooks.wasend.com.br/webhook/558f9601-5396...",
  "events": ["Message"],
  "active": true
}
```

---

### Tela 3: Eventos do Webhook

![Eventos Webhook](file:///Users/heltonfraga/.gemini/antigravity/brain/1736ddeb-0c7b-4ec1-8804-fdff3edce5eb/uploaded_image_2_1763651840672.png)

**O que configura**: Quais eventos o webhook vai receber

**Eventos disponíveis**:
- `Message` - Nova mensagem recebida
- `ReadReceipt` - Confirmação de leitura
- `Connected` - Usuário conectou
- `Disconnected` - Usuário desconectou
- `QR` - Novo QR Code gerado
- `LoggedOut` - Usuário fez logout
- E muitos outros...

**Como funciona**:
1. Marcar checkboxes dos eventos desejados
2. Sistema envia array de eventos na atualização
3. WUZAPI só notifica webhook dos eventos selecionados

**Exemplo de evento Message recebido**:
```json
{
  "event": "Message",
  "user": "01K7MXQ1BKY9C5FATP50T86",
  "data": {
    "from": "5521987654321@s.whatsapp.net",
    "body": "Olá!",
    "timestamp": 1699999999,
    "id": "3EB0B4D5F5B33C1E8B67"
  }
}
```

---

### Tela 4: Informações do Usuário

![Info Usuário](file:///Users/heltonfraga/.gemini/antigravity/brain/1736ddeb-0c7b-4ec1-8804-fdff3edce5eb/uploaded_image_3_1763651840672.png)

**Painel de Informações**:
- **Nome**: HeltonFraga
- **ID do Usuário**: 3eaffa6b496a8dd63a79bd7facd8ca6c5
- **Token de Acesso**: `01K7MXQ1BKY9C5FATP50T86` (com botões copiar/ocultar)
- **Status da Conexão**: 🟢 Logado - Pronto para enviar mensagens
- **Mensagens Enviadas**: 3 mensagens enviadas hoje
- **Webhook**: Configurado - 1 evento

**Controle de Conexão**:
- **Atualizar Status**: Verifica estado atual
- **Desconectar**: Desconecta sessão (mantém no banco)
- **Logout WhatsApp**: Faz logout completo

---

### Tela 5: Controle de Conexão

![Controle Conexão](file:///Users/heltonfraga/.gemini/antigravity/brain/1736ddeb-0c7b-4ec1-8804-fdff3edce5eb/uploaded_image_4_1763651840672.png)

**Ações disponíveis**:

**1. Atualizar Status**
```javascript
GET /session/status
token: 01K7MXQ1BKY9C5FATP50T86
```

**2. Desconectar**
```javascript
POST /session/disconnect
token: 01K7MXQ1BKY9C5FATP50T86
```
Efeito: Desconecta mas mantém sessão salva

**3. Logout WhatsApp**
```javascript
POST /session/logout
token: 01K7MXQ1BKY9C5FATP50T86
```
Efeito: Faz logout completo, precisa escanear QR novamente

---

## Referência de Endpoints

### Endpoints Administrativos

| Endpoint | Método | Autenticação | Descrição |
|----------|--------|--------------|-----------|
| `/admin/users` | GET | Admin Token | Lista todos os usuários |
| `/admin/users` | POST | Admin Token | Cria novo usuário |
| `/admin/users/{id}` | GET | Admin Token | Obtém usuário específico |
| `/admin/users/{id}` | DELETE | Admin Token | Remove usuário do DB |
| `/admin/users/{id}/full` | DELETE | Admin Token | Remove usuário completamente |

### Endpoints de Sessão

| Endpoint | Método | Autenticação | Descrição |
|----------|--------|--------------|-----------|
| `/session/status` | GET | User Token | Verifica status da sessão |
| `/session/connect` | POST | User Token | Conecta sessão WhatsApp |
| `/session/disconnect` | POST | User Token | Desconecta sessão |
| `/session/logout` | POST | User Token | Faz logout do WhatsApp |
| `/session/qr` | GET | User Token | Obtém QR Code |

### Endpoints de Webhook

| Endpoint | Método | Autenticação | Descrição |
|----------|--------|--------------|-----------|
| `/webhook` | GET | User Token | Obtém config do webhook |
| `/webhook` | POST | User Token | Configura webhook |

### Endpoints de Mensagens

| Endpoint | Método | Autenticação | Descrição |
|----------|--------|--------------|-----------|
| `/chat/send/text` | POST | User Token | Envia mensagem de texto |
| `/chat/send/image` | POST | User Token | Envia imagem |
| `/chat/send/document` | POST | User Token | Envia documento |

---

## Exemplos Práticos

### Exemplo 1: Criar Usuário Completo

```bash
curl -X POST https://wzapi.wasend.com.br/admin/users \
  -H "Authorization: UeH7cZ2c1K3zVUBFi7SginSC" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "MeuBot",
    "token": "meu-token-secreto-123",
    "webhook": "https://meusite.com/webhook",
    "events": "Message,ReadReceipt"
  }'
```

### Exemplo 2: Conectar e Obter QR Code

```javascript
// 1. Conectar sessão
const connectResponse = await fetch('https://wzapi.wasend.com.br/session/connect', {
  method: 'POST',
  headers: {
    'token': 'meu-token-secreto-123',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    Subscribe: ['Message'],
    Immediate: false
  })
});

// 2. Aguardar 1 segundo
await new Promise(r => setTimeout(r, 1000));

// 3. Obter QR Code
const qrResponse = await fetch('https://wzapi.wasend.com.br/session/qr', {
  headers: {
    'token': 'meu-token-secreto-123'
  }
});

const qrData = await qrResponse.json();
console.log('QR Code:', qrData.data.QRCode);

// 4. Exibir na tela
document.getElementById('qr').src = qrData.data.QRCode;
```

### Exemplo 3: Enviar Mensagem

```javascript
const sendMessage = async () => {
  const response = await fetch('https://wzapi.wasend.com.br/chat/send/text', {
    method: 'POST',
    headers: {
      'token': 'meu-token-secreto-123',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      Phone: '5511999998888',  // Número no formato internacional
      Body: 'Olá! Mensagem via API'
    })
  });
  
  const result = await response.json();
  console.log('Mensagem enviada:', result);
};
```

### Exemplo 4: Receber Webhook

```javascript
// Servidor Node.js para receber webhooks
app.post('/webhook', (req, res) => {
  const { event, data } = req.body;
  
  if (event === 'Message') {
    console.log('Nova mensagem de:', data.from);
    console.log('Conteúdo:', data.body);
    
    // Responder automaticamente
    // ... código para enviar resposta
  }
  
  res.status(200).json({ success: true });
});
```

---

## Normalização de Números

**Importante**: Números de telefone devem estar no formato internacional:

```
✅ Correto: 5511999998888
❌ Errado: (11) 99999-8888
❌ Errado: 11999998888
```

**Regras**:
- Sempre começar com código do país (Brasil = 55)
- Incluir DDD sem zero
- Incluir número com 9 dígitos (celular)
- Sem espaços, parênteses ou hífens

---

## Conclusão

Esta documentação cobriu:
- ✅ Como criar usuários na API
- ✅ Como estabelecer conexão WhatsApp
- ✅ Como gerar e usar QR Code
- ✅ Como configurar webhooks
- ✅ Explicação de todas as telas
- ✅ Referência completa de endpoints

Para mais detalhes técnicos, consulte também:
- `integration-guide.md` - Guia de integração completo
- Código fonte em `src/services/wuzapi.ts`
