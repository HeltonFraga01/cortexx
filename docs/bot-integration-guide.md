# Guia de Integração de Bots Externos

Este documento explica como integrar automações e bots externos com o sistema WUZAPI Manager para que as mensagens enviadas apareçam no histórico de conversas.

> **✅ Atualização:** Os endpoints `/api/bot/*` foram configurados para não exigir CSRF token, permitindo integração direta de bots externos sem necessidade de autenticação adicional além do token WUZAPI.

> **✅ Suporte a URL e Base64:** Os endpoints de mídia (imagem, vídeo, áudio, documento, sticker) agora aceitam tanto **URLs públicas** quanto **dados em base64**. O sistema converte automaticamente URLs para o formato base64 exigido pelo WUZAPI. Isso facilita a integração com serviços que fornecem URLs de mídia (como n8n, Make, etc.).

## Problema

Quando um bot externo envia mensagens diretamente via API WUZAPI, essas mensagens **não aparecem automaticamente** no histórico do sistema. Isso acontece porque:

1. O WUZAPI não gera eventos de webhook para mensagens enviadas via sua API REST
2. Apenas mensagens que passam pelo WhatsApp WebSocket (recebidas ou enviadas pelo app nativo) geram eventos

## Solução

O sistema oferece um **Endpoint Proxy** que resolve esse problema. Ao enviar mensagens através deste endpoint, elas são:

1. Encaminhadas para o WUZAPI
2. Registradas automaticamente no histórico local
3. Marcadas com `sender_type: 'bot'` para identificação
4. Transmitidas via WebSocket para atualização em tempo real

---

## Endpoints Disponíveis

### 1. Enviar Mensagem de Texto

```http
POST /api/bot/send/text
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Body": "Olá! Esta é uma mensagem do bot.",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário (formato: DDI + DDD + número) ou JID de grupo |
| `Body` | string | Sim | Conteúdo da mensagem |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída (evita loops) |
| `bot_name` | string | Não | Nome do bot para exibição |

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "message": "Mensagem enviada e registrada com sucesso",
  "data": {
    "messageId": "3EB0ABC123...",
    "localId": 456,
    "conversationId": 123,
    "wuzapiResponse": { ... }
  }
}
```

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/text \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Body": "Olá! Esta é uma mensagem automática.",
    "skip_webhook": true,
    "bot_name": "Bot de Atendimento"
  }'
```

---

### 2. Enviar Imagem

```http
POST /api/bot/send/image
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Image": "https://exemplo.com/imagem.jpg",
  "Caption": "Legenda da imagem",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário ou JID de grupo |
| `Image` | string | Sim | URL da imagem ou base64 |
| `Caption` | string | Não | Legenda da imagem |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída |
| `bot_name` | string | Não | Nome do bot para exibição |

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/image \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Image": "https://exemplo.com/produto.jpg",
    "Caption": "Confira nosso novo produto!",
    "skip_webhook": true
  }'
```

---

### 3. Enviar Áudio

```http
POST /api/bot/send/audio
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Audio": "https://exemplo.com/audio.ogg",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário ou JID de grupo |
| `Audio` | string | Sim | URL do áudio ou base64 (formato OGG recomendado) |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída |
| `bot_name` | string | Não | Nome do bot para exibição |

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/audio \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Audio": "https://exemplo.com/mensagem.ogg",
    "skip_webhook": true
  }'
```

---

### 4. Enviar Documento

```http
POST /api/bot/send/document
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Document": "https://exemplo.com/arquivo.pdf",
  "FileName": "relatorio.pdf",
  "Caption": "Segue o relatório solicitado",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário ou JID de grupo |
| `Document` | string | Sim | URL do documento ou base64 |
| `FileName` | string | Não | Nome do arquivo para exibição |
| `Caption` | string | Não | Legenda do documento |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída |
| `bot_name` | string | Não | Nome do bot para exibição |

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/document \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Document": "https://exemplo.com/contrato.pdf",
    "FileName": "contrato_2025.pdf",
    "Caption": "Contrato para assinatura",
    "skip_webhook": true
  }'
```

---

### 5. Enviar Vídeo

```http
POST /api/bot/send/video
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Video": "https://exemplo.com/video.mp4",
  "Caption": "Assista nosso tutorial",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário ou JID de grupo |
| `Video` | string | Sim | URL do vídeo ou base64 (formato MP4 recomendado) |
| `Caption` | string | Não | Legenda do vídeo |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída |
| `bot_name` | string | Não | Nome do bot para exibição |

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/video \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Video": "https://exemplo.com/tutorial.mp4",
    "Caption": "Tutorial de uso do sistema",
    "skip_webhook": true
  }'
```

---

### 6. Enviar Sticker

```http
POST /api/bot/send/sticker
```

**Headers:**
| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `token` | Sim | Token do usuário WUZAPI |
| `bot-id` | Não | ID do bot para tracking |
| `Content-Type` | Sim | `application/json` |

**Body:**
```json
{
  "Phone": "5531999999999",
  "Sticker": "https://exemplo.com/sticker.webp",
  "skip_webhook": false,
  "bot_name": "Meu Bot"
}
```

**Parâmetros:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `Phone` | string | Sim | Número do destinatário ou JID de grupo |
| `Sticker` | string | Sim | URL do sticker ou base64 (formato WebP) |
| `skip_webhook` | boolean | Não | Se `true`, não dispara webhooks de saída |
| `bot_name` | string | Não | Nome do bot para exibição |

**Exemplo cURL:**
```bash
curl -X POST http://localhost:3000/api/bot/send/sticker \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "bot-id: 123" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Sticker": "https://exemplo.com/figurinha.webp",
    "skip_webhook": true
  }'
```

---

## Enviando para Grupos

Para enviar mensagens para grupos, use o JID do grupo no campo `Phone`:

```json
{
  "Phone": "120363045348537212@g.us",
  "Body": "Mensagem para o grupo"
}
```

O sistema detecta automaticamente se é um grupo pelo formato do JID (`@g.us`).

---

## Identificação de Mensagens de Bot

Mensagens enviadas via endpoint proxy são automaticamente marcadas com:

- `direction`: `"outgoing"`
- `sender_type`: `"bot"`
- `sender_bot_id`: ID do bot (se fornecido via header `bot-id`)
- `status`: `"sent"`

Na interface, essas mensagens aparecem com um indicador visual diferenciado.

---

## Evitando Loops de Webhook

Se seu bot recebe webhooks do sistema e envia mensagens de volta, use `skip_webhook: true` para evitar loops infinitos:

```json
{
  "Phone": "5531999999999",
  "Body": "Resposta automática",
  "skip_webhook": true
}
```

---

## Códigos de Erro

| Código | Erro | Descrição |
|--------|------|-----------|
| 400 | Bad Request | Parâmetros inválidos (Phone ou Body ausentes) |
| 400 | Invalid Phone Number | Número de telefone inválido |
| 401 | Unauthorized | Token não fornecido ou inválido |
| 408 | Request Timeout | Timeout na comunicação com WUZAPI |
| 500 | Internal Server Error | Erro interno do servidor |
| 503 | Service Unavailable | WUZAPI indisponível |

---

## Exemplos de Integração

### Node.js (axios)

```javascript
const axios = require('axios');

async function sendBotMessage(phone, message) {
  try {
    const response = await axios.post('http://localhost:3000/api/bot/send/text', {
      Phone: phone,
      Body: message,
      skip_webhook: true,
      bot_name: 'Meu Bot Node.js'
    }, {
      headers: {
        'token': process.env.WUZAPI_TOKEN,
        'bot-id': '1',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('Mensagem enviada:', response.data);
    return response.data;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
    throw error;
  }
}

// Uso
sendBotMessage('5531999999999', 'Olá! Como posso ajudar?');
```

### Python (requests)

```python
import requests
import os

def send_bot_message(phone: str, message: str) -> dict:
    url = "http://localhost:3000/api/bot/send/text"
    
    headers = {
        "token": os.environ.get("WUZAPI_TOKEN"),
        "bot-id": "1",
        "Content-Type": "application/json"
    }
    
    payload = {
        "Phone": phone,
        "Body": message,
        "skip_webhook": True,
        "bot_name": "Meu Bot Python"
    }
    
    response = requests.post(url, json=payload, headers=headers, timeout=15)
    response.raise_for_status()
    
    return response.json()

# Uso
result = send_bot_message("5531999999999", "Olá! Como posso ajudar?")
print(result)
```

### PHP (cURL)

```php
<?php

function sendBotMessage(string $phone, string $message): array {
    $url = "http://localhost:3000/api/bot/send/text";
    
    $payload = json_encode([
        "Phone" => $phone,
        "Body" => $message,
        "skip_webhook" => true,
        "bot_name" => "Meu Bot PHP"
    ]);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => [
            "token: " . getenv("WUZAPI_TOKEN"),
            "bot-id: 1",
            "Content-Type: application/json"
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        throw new Exception("Erro ao enviar mensagem: " . $response);
    }
    
    return json_decode($response, true);
}

// Uso
$result = sendBotMessage("5531999999999", "Olá! Como posso ajudar?");
print_r($result);
```

---

## Fluxo de Integração Recomendado

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Bot Externo   │────▶│  /api/bot/send/* │────▶│   WUZAPI    │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Banco de Dados  │
                        │  (chat_messages) │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │    WebSocket     │
                        │  (tempo real)    │
                        └──────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │    Interface     │
                        │   (atendente)    │
                        └──────────────────┘
```

---

## Deduplicação de Mensagens

O sistema implementa deduplicação automática por `message_id`. Se a mesma mensagem for enviada duas vezes (por exemplo, via webhook e via proxy), apenas uma cópia será armazenada.

---

## Problemas Comuns

### Erro: "Rota não encontrada" (404)

**Causa:** As rotas de bot proxy não estão registradas no servidor.

**Solução:**

1. **Verifique se o servidor foi reiniciado:** Após atualizar o código, reinicie o servidor Node.js:
   ```bash
   npm run server:dev
   ```

2. **Verifique se as rotas estão registradas:** O arquivo `server/index.js` deve conter:
   ```javascript
   const botProxyRoutes = require('./routes/botProxyRoutes');
   // ...
   app.use('/api/bot', botProxyRoutes);
   ```

3. **URL correta:** Certifique-se de que está usando a URL completa:
   ```bash
   # ✅ Correto
   http://localhost:3000/api/bot/send/text
   
   # ❌ Errado
   http://localhost:3000/bot/send/text
   ```

**Nota:** Os endpoints `/api/bot/send/text` e `/api/bot/send/image` estão configurados para não exigir CSRF token, permitindo integração direta de bots externos.

### Erro: "Unauthorized"

**Causa:** Token WUZAPI inválido ou não fornecido.

**Solução:**
1. Verifique se o token está correto
2. Certifique-se de que o header `token` está sendo enviado
3. Teste o token diretamente no WUZAPI:

```bash
curl -X GET https://wzapi.wasend.com.br/session/status \
  -H "token: SEU_TOKEN"
```

### Erro: "Invalid Phone Number"

**Causa:** Formato do número de telefone incorreto.

**Solução:**
- Use apenas números: `5531999999999` (DDI + DDD + número)
- Não use: `+`, `-`, `(`, `)`, espaços
- Para grupos, use o JID completo: `120363045348537212@g.us`

### Mensagens não aparecem no histórico

**Causa:** Pode ser um problema de sincronização ou WebSocket.

**Solução:**
1. Verifique os logs do servidor: `server/logs/app-*.log`
2. Procure por: `"Bot proxy: Message sent and stored"`
3. Verifique se o `conversationId` foi criado
4. Recarregue a página da interface

---

## Teste Rápido

Para testar rapidamente a integração, use o script de teste fornecido:

```bash
# 1. Edite o script e configure seu token
nano docs/bot-integration-test.sh

# 2. Torne o script executável
chmod +x docs/bot-integration-test.sh

# 3. Execute o teste
./docs/bot-integration-test.sh
```

O script irá:
- Enviar uma mensagem de teste
- Verificar a resposta
- Diagnosticar erros comuns
- Fornecer próximos passos

---

## Suporte

Para dúvidas ou problemas com a integração, verifique:

1. **Logs do servidor**: `server/logs/app-*.log`
2. **Token válido**: Certifique-se de que o token WUZAPI está correto
3. **Formato do telefone**: Use apenas números (DDI + DDD + número)
4. **Conexão WUZAPI**: Verifique se a instância está conectada
5. **Proteção CSRF**: Verifique se os endpoints `/api/bot/*` estão nas exceções

