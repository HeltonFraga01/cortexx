# Design Document

## Overview

Este documento descreve o design para corrigir a validação e formatação de números de telefone no sistema WUZAPI Manager. A solução usa a API `/user/check` da WUZAPI para validar números e obter o formato correto, eliminando a necessidade de lógica de normalização manual complexa.

## Architecture

### Current State

Atualmente, o sistema possui:
- `server/utils/phoneUtils.js`: Utilitários de validação e normalização manual
- Envio único em `server/routes/chatRoutes.js`: Funciona corretamente
- Envio em massa em `server/services/QueueManager.js`: Não valida corretamente
- Importação de contatos em `server/routes/contactImportRoutes.js`: Usa validação local

### Problem Analysis

O problema identificado é que:
1. O sistema tenta normalizar números manualmente, o que pode gerar formatos incorretos
2. A API WUZAPI já fornece o formato correto através do endpoint `/user/check`
3. O campo `Query` retornado pela API contém o número no formato exato esperado

### WUZAPI API Endpoints Relevantes

#### 1. `/user/check` - Validação de números
```json
// Request: POST /user/check
{ "Phone": ["5491155553934", "5491155553935"] }

// Response:
{
  "code": 200,
  "data": {
    "Users": [
      {
        "IsInWhatsapp": true,
        "JID": "5491155553934@s.whatsapp.net",
        "Query": "5491155553934",  // ← USAR ESTE PARA ENVIO
        "VerifiedName": "Company Name"
      },
      {
        "IsInWhatsapp": false,
        "JID": "5491155553935@s.whatsapp.net",
        "Query": "5491155553935",
        "VerifiedName": ""
      }
    ]
  }
}
```

#### 2. `/user/lid/{phone}` - Obter JID e LID
```json
// Request: GET /user/lid/5511999999999

// Response:
{
  "jid": "5511999999999@s.whatsapp.net",
  "lid": "1234567890@lid"
}
```

Este endpoint é útil quando precisamos resolver um LID para obter o número real.

#### 3. Webhooks - Estrutura do MessageInfo
Baseado no código fonte do WUZAPI (wmiau.go), a estrutura do webhook é:
```json
{
  "Info": {
    "Chat": "5511999999999@s.whatsapp.net",  // JID do chat
    "Sender": "5511999999999@s.whatsapp.net", // JID do remetente
    "IsFromMe": false,                        // Se é mensagem própria
    "IsGroup": false,                         // Se é grupo
    "ID": "3EB0C767D26A1B5F7C83",            // ID da mensagem
    "Timestamp": "2023-12-01T15:30:00Z",     // Timestamp
    "PushName": "João"                        // Nome do contato
  }
}
```

#### 4. Tipos de JID e como extrair o número

| Sufixo | Tipo | Como extrair número |
|--------|------|---------------------|
| `@s.whatsapp.net` | Chat individual | Usar `Info.Chat` |
| `@c.us` | Formato antigo | Usar `Info.Chat` |
| `@g.us` | Grupo | Usar `Info.Sender` (remetente) |
| `@lid` | Linked Device ID | Resolver via `/user/lid/{phone}` |

#### 5. Resolvendo LID para número real
Quando o Chat contém `@lid`, é necessário chamar a API para obter o número real:
```javascript
// Exemplo: Chat = "1234567890@lid"
const lidNumber = "1234567890";
const response = await wuzapiClient.get(`/user/lid/${lidNumber}`, userToken);
// Response: { jid: "5511999999999@s.whatsapp.net", lid: "1234567890@lid" }
const realPhone = response.jid.replace('@s.whatsapp.net', '');
```

### Solution Architecture

**Fluxo de Validação Brasileira:**

```
┌──────────────────────────────────────────────────────────────┐
│  Cliente digita: 5531994974759 (COM o 9 - padrão brasileiro) │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│         Sistema prepara para validação:                       │
│  • Remove sufixos WhatsApp (@s.whatsapp.net, @c.us, @lid)   │
│  • Remove caracteres não numéricos                            │
│  • Remove zero inicial do DDD (021 → 21)                     │
│  • Adiciona código 55 se não tiver                           │
│  Resultado: 5531994974759 (pronto para API)                  │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│         WUZAPI /user/check API (Fonte da Verdade)            │
│  Request: { Phone: ["5531994974759"] }                       │
│  Response: {                                                  │
│    Users: [{                                                  │
│      IsInWhatsapp: true,                                      │
│      Query: "553194974759"  ← SEM o 9 (WhatsApp reconhece)   │
│      JID: "553194974759@s.whatsapp.net"                      │
│    }]                                                         │
│  }                                                            │
│                                                               │
│  A API WUZAPI retorna o número EXATAMENTE como WhatsApp      │
│  o reconhece. Isso resolve o problema do 9 automaticamente!  │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────────────────┐
│  Sistema usa: 553194974759 (campo Query da API)              │
│  • Armazena no banco de dados                                │
│  • Envia para WUZAPI                                         │
│  • Cacheia para próximas validações                          │
└────────────────┬─────────────────────────────────────────────┘
                 │
                 ├──────────────┬──────────────┬───────────────┐
                 ▼              ▼              ▼               ▼
         ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
         │ Database │   │  WUZAPI  │   │  Display │   │  Cache   │
         │  Storage │   │   Send   │   │  Format  │   │  Store   │
         │553194... │   │553194... │   │+55 31... │   │553194... │
         └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

**Benefícios desta abordagem:**
- ✅ Cliente sempre digita COM o 9 (padrão brasileiro)
- ✅ Sistema descobre automaticamente o formato correto via API
- ✅ Funciona para qualquer país/formato de número
- ✅ Sem necessidade de lógica complexa de variações
- ✅ Cache evita chamadas repetidas à API

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. 
Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: API Query Field is Source of Truth
*For any* phone number validated through the WUZAPI `/user/check` endpoint, the system SHALL use the `Query` field from the API response as the authoritative phone number format for all subsequent operations (storage, sending, display).

**Validates: Requirements 1.2, 1.5**

### Property 2: Preparation Idempotence
*For any* phone number that has been prepared for validation (suffixes removed, non-numeric characters removed, DDD zero removed, country code added), preparing it again SHALL produce the same result.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 3: Cache Consistency
*For any* phone number that has been validated and cached, retrieving it from cache within the TTL window SHALL return the same validated result as the original API call.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 4: Invalid Numbers are Rejected
*For any* phone number where the WUZAPI `/user/check` endpoint returns `IsInWhatsapp: false`, the system SHALL reject the number and not attempt to send messages to it.

**Validates: Requirements 1.3**

### Property 5: Webhook Extraction Correctness
*For any* webhook event from WUZAPI, the extracted phone number SHALL match the actual sender/chat participant, correctly handling @s.whatsapp.net (individual), @g.us (group), and @lid (linked device) suffixes.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 6: LID Resolution
*For any* webhook event with Chat ending in @lid, the system SHALL resolve the LID to the actual phone number via the `/user/lid/{phone}` endpoint and use the resulting JID to extract the correct phone number.

**Validates: Requirements 4.3, 4.6**

### Property 7: Consistent Validation Across Flows
*For any* phone number, whether it comes from single message send, bulk campaign, or webhook, the validation and normalization process SHALL produce the same validated result.

**Validates: Requirements 2.1, 2.2**

## Components and Interfaces

### 1. Phone Validation Service (`server/services/PhoneValidationService.js`)

**New Service** para centralizar validação de números:

```javascript
const wuzapiClient = require('../utils/wuzapiClient');
const logger = require('../utils/logger');

// Cache simples em memória (pode ser melhorado com Redis)
const validationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Prepara número para validação (limpeza básica)
 */
function preparePhoneForValidation(phone) {
  if (!phone) return '';
  
  // Remove sufixos WhatsApp
  let prepared = phone.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, '');
  
  // Remove caracteres não numéricos
  prepared = prepared.replace(/\D/g, '');
  
  // Remove zero inicial do DDD (55021 → 5521, 021 → 21)
  if (prepared.startsWith('550')) {
    prepared = '55' + prepared.substring(3);
  } else if (prepared.startsWith('0')) {
    prepared = prepared.substring(1);
  }
  
  // Adiciona código do país se não tiver
  if (prepared.length === 10 || prepared.length === 11) {
    prepared = '55' + prepared;
  }
  
  return prepared;
}

/**
 * Valida número usando API WUZAPI /user/check
 * Retorna o número no formato correto (campo Query)
 */
async function validatePhone(phone, userToken) {
  const prepared = preparePhoneForValidation(phone);
  
  if (!prepared) {
    return { isValid: false, error: 'Número vazio' };
  }
  
  // Verifica cache
  const cacheKey = `${userToken}:${prepared}`;
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  try {
    const response = await wuzapiClient.post('/user/check', {
      Phone: prepared
    }, userToken);
    
    if (response.data?.Users?.[0]) {
      const user = response.data.Users[0];
      
      if (user.IsInWhatsapp) {
        const result = {
          isValid: true,
          validatedPhone: user.Query, // Número no formato correto
          jid: user.JID,
          name: user.VerifiedName || null
        };
        
        // Cacheia resultado
        validationCache.set(cacheKey, { result, timestamp: Date.now() });
        
        return result;
      } else {
        return { isValid: false, error: 'Número não está no WhatsApp' };
      }
    }
    
    return { isValid: false, error: 'Resposta inválida da API' };
  } catch (error) {
    logger.error('Phone validation failed', { phone: prepared, error: error.message });
    return { isValid: false, error: `Erro na validação: ${error.message}` };
  }
}

module.exports = {
  preparePhoneForValidation,
  validatePhone,
  clearCache: () => validationCache.clear()
};
```

### 2. Phone Utilities Module (`server/utils/phoneUtils.js`)

**Simplificado** - mantém apenas funções de preparação e extração:

```javascript
/**
 * Remove sufixos WhatsApp de um número
 */
function removeWhatsAppSuffix(phone) {
  if (!phone) return '';
  return phone.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, '');
}

/**
 * Remove caracteres não numéricos
 */
function sanitizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Extrai número de telefone de evento webhook WUZAPI
 * 
 * Estrutura do webhook (baseado no código fonte WUZAPI):
 * - Info.Chat: JID do chat (pode ser @s.whatsapp.net, @g.us, @lid)
 * - Info.Sender: JID do remetente (importante para grupos)
 * - Info.IsFromMe: Se a mensagem é do próprio usuário
 * - Info.IsGroup: Se é mensagem de grupo
 * 
 * Exemplos de sufixos WhatsApp:
 * - @s.whatsapp.net: Chat individual (número está no Chat)
 * - @g.us: Grupo (número do remetente está no Sender)
 * - @lid: Linked Device ID (precisa resolver via API /user/lid)
 * - @c.us: Formato antigo (deprecated, tratar como @s.whatsapp.net)
 * 
 * @param {Object} event - Evento webhook do WUZAPI
 * @param {Function} resolveLid - Função opcional para resolver LID via API
 * @returns {string} Número de telefone extraído (apenas dígitos)
 */
function extractPhoneFromWebhook(event, resolveLid = null) {
  const info = event?.Info;
  if (!info) {
    logger.warn('Webhook event missing Info field');
    return '';
  }
  
  let source = '';
  
  // Se Chat termina com @lid, precisa resolver via API
  if (info.Chat?.endsWith('@lid')) {
    if (resolveLid) {
      // Resolver LID via API /user/lid/{phone}
      const lidNumber = info.Chat.replace('@lid', '');
      source = resolveLid(lidNumber) || '';
    }
    if (!source) {
      logger.warn('Webhook with @lid Chat - needs resolution via /user/lid API', { 
        chat: info.Chat 
      });
      // Fallback: tentar usar Sender se disponível
      source = info.Sender || '';
    }
  } 
  // Se Chat termina com @g.us, é um grupo - usar Sender para o remetente
  else if (info.Chat?.endsWith('@g.us')) {
    source = info.Sender || '';
    if (!source) {
      logger.warn('Group message without Sender field', { chat: info.Chat });
    }
  }
  // Caso normal (@s.whatsapp.net ou @c.us): usar Chat
  else {
    source = info.Chat || '';
  }
  
  // Remove sufixo e retorna apenas dígitos
  return sanitizePhoneNumber(removeWhatsAppSuffix(source));
}

/**
 * Formata número para exibição visual
 */
function formatPhoneDisplay(phone) {
  const digits = sanitizePhoneNumber(phone);
  
  if (digits.length === 13) {
    // 55 21 9 7570 5641
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,5)} ${digits.slice(5,9)}-${digits.slice(9)}`;
  } else if (digits.length === 12) {
    // 55 21 7570 5641
    return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
  }
  
  return phone;
}

/**
 * Resolve um LID (Linked Device ID) para o número real via API WUZAPI
 * 
 * @param {string} lidNumber - Número do LID (sem sufixo @lid)
 * @param {string} userToken - Token do usuário WUZAPI
 * @returns {Promise<string|null>} Número real ou null se não encontrado
 */
async function resolveLidToPhone(lidNumber, userToken) {
  try {
    const response = await wuzapiClient.get(`/user/lid/${lidNumber}`, userToken);
    
    if (response.data?.jid) {
      // Extrai número do JID (ex: "5511999999999@s.whatsapp.net" -> "5511999999999")
      return response.data.jid.replace(/@s\.whatsapp\.net$/, '');
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to resolve LID to phone', { 
      lidNumber, 
      error: error.message 
    });
    return null;
  }
}

module.exports = {
  removeWhatsAppSuffix,
  sanitizePhoneNumber,
  extractPhoneFromWebhook,
  formatPhoneDisplay,
  resolveLidToPhone
};
```
