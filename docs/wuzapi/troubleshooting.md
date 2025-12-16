# Troubleshooting WUZAPI

Guia completo para resolução de problemas com a integração WUZAPI.

## Índice

- [Problemas de Conexão](#problemas-de-conexão)
- [Erros de Autenticação](#erros-de-autenticação)
- [Problemas de Sessão](#problemas-de-sessão)
- [Erros de Envio de Mensagens](#erros-de-envio-de-mensagens)
- [Problemas de Webhook](#problemas-de-webhook)
- [Erros de QR Code](#erros-de-qr-code)
- [Performance e Timeout](#performance-e-timeout)
- [Logs e Debug](#logs-e-debug)
- [Ferramentas de Diagnóstico](#ferramentas-de-diagnóstico)

## Problemas de Conexão

### 1. "Não foi possível conectar com a WuzAPI"

#### Sintomas
```json
{
  "success": false,
  "error": "Não foi possível conectar com a WuzAPI",
  "code": "CONNECTION_ERROR"
}
```

#### Causas Possíveis
- WUZAPI está offline
- Problemas de rede/firewall
- URL base incorreta
- DNS não resolve

#### Soluções

##### Verificar Status da WUZAPI
```bash
# Teste básico de conectividade
curl -I https://wzapi.wasend.com.br/health

# Teste com timeout
curl --connect-timeout 10 https://wzapi.wasend.com.br/health
```

##### Verificar Configuração
```javascript
// Backend
console.log('WUZAPI Base URL:', process.env.WUZAPI_BASE_URL);
console.log('Timeout:', process.env.REQUEST_TIMEOUT);

// Testar conectividade
const wuzapiClient = require('../utils/wuzapiClient');
const isHealthy = await wuzapiClient.isHealthy();
console.log('WUZAPI está funcionando:', isHealthy);
```

##### Verificar DNS e Rede
```bash
# Resolver DNS
nslookup wzapi.wasend.com.br

# Teste de conectividade
ping wzapi.wasend.com.br

# Teste de porta
telnet wzapi.wasend.com.br 443
```

### 2. "Timeout na requisição para WuzAPI"

#### Sintomas
```json
{
  "success": false,
  "error": "Timeout na requisição para WuzAPI",
  "code": "TIMEOUT"
}
```

#### Soluções

##### Aumentar Timeout
```javascript
// Backend - wuzapiClient.js
const wuzapiClient = require('../utils/wuzapiClient');
wuzapiClient.timeout = 30000; // 30 segundos

// Ou via environment
process.env.REQUEST_TIMEOUT = '30000';
```

##### Implementar Retry Logic
```javascript
async function withRetry(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000; // Backoff exponencial
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Uso
const result = await withRetry(async () => {
  return await wuzapiClient.getUsers();
});
```

## Erros de Autenticação

### 1. "Token administrativo inválido ou expirado"

#### Sintomas
```json
{
  "success": false,
  "error": "Token administrativo inválido ou expirado",
  "code": 401
}
```

#### Soluções

##### Verificar Token
```bash
# Verificar se token está definido
echo $VITE_ADMIN_TOKEN

# Testar token diretamente
curl -H "Authorization: $VITE_ADMIN_TOKEN" \
     https://wzapi.wasend.com.br/admin/users
```

##### Validar Formato
```javascript
function validateAdminToken(token) {
  if (!token) {
    return { valid: false, error: 'Token não fornecido' };
  }
  
  if (token.length < 10) {
    return { valid: false, error: 'Token muito curto' };
  }
  
  // Verificar caracteres especiais problemáticos
  if (token.includes(' ') || token.includes('\n')) {
    return { valid: false, error: 'Token contém caracteres inválidos' };
  }
  
  return { valid: true };
}

const validation = validateAdminToken(process.env.VITE_ADMIN_TOKEN);
if (!validation.valid) {
  console.error('Token inválido:', validation.error);
}
```

### 2. "Token de usuário inválido"

#### Sintomas
```json
{
  "success": false,
  "error": "Token de usuário inválido",
  "code": 401
}
```

#### Soluções

##### Verificar Token do Usuário
```javascript
// Frontend
const userToken = localStorage.getItem('userToken');
if (!userToken) {
  console.error('Token de usuário não encontrado');
  // Redirecionar para login
}

// Testar token
try {
  const status = await wuzapi.getSessionStatus(userToken);
  console.log('Token válido, status:', status);
} catch (error) {
  console.error('Token inválido:', error);
  // Limpar token e redirecionar
  localStorage.removeItem('userToken');
}
```

##### Renovar Token
```javascript
// Se o token expirou, criar novo usuário ou reconectar
async function renewUserToken(oldToken) {
  try {
    // Tentar obter informações do usuário
    const user = await wuzapi.getUser(oldToken);
    
    // Se não conseguir, criar novo
    if (!user) {
      const newUser = await wuzapi.createUser({
        name: 'Usuário Renovado',
        token: generateNewToken(),
        webhook: 'https://meusite.com/webhook'
      });
      
      return newUser.token;
    }
    
    return oldToken;
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    throw error;
  }
}
```

## Problemas de Sessão

### 1. "Usuário não conectado"

#### Sintomas
- Status: `{ connected: false, loggedIn: false }`
- Erro ao enviar mensagens
- QR Code não aparece

#### Soluções

##### Verificar Status da Sessão
```javascript
async function checkAndConnect(userToken) {
  try {
    const status = await wuzapi.getSessionStatus(userToken);
    console.log('Status atual:', status);
    
    if (!status.connected) {
      console.log('Usuário não conectado, iniciando conexão...');
      
      const connectResult = await wuzapi.connectSession(userToken, {
        Subscribe: ['Message', 'ReadReceipt'],
        Immediate: false
      });
      
      console.log('Resultado da conexão:', connectResult);
      
      // Aguardar um pouco e verificar novamente
      setTimeout(async () => {
        const newStatus = await wuzapi.getSessionStatus(userToken);
        console.log('Novo status:', newStatus);
      }, 5000);
    }
    
  } catch (error) {
    console.error('Erro ao verificar/conectar:', error);
  }
}
```

##### Forçar Reconexão
```javascript
async function forceReconnect(userToken) {
  try {
    // 1. Desconectar primeiro
    await wuzapi.disconnectSession(userToken);
    console.log('Desconectado');
    
    // 2. Aguardar um pouco
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 3. Conectar novamente
    const result = await wuzapi.connectSession(userToken);
    console.log('Reconectado:', result);
    
    return result;
  } catch (error) {
    console.error('Erro na reconexão:', error);
    throw error;
  }
}
```

### 2. "QR Code não carrega"

#### Sintomas
- Endpoint `/session/qr` retorna erro
- QR Code vazio ou inválido
- Timeout ao obter QR Code

#### Soluções

##### Verificar Estado da Sessão
```javascript
async function getQRCodeSafely(userToken) {
  try {
    // 1. Verificar se precisa de QR Code
    const status = await wuzapi.getSessionStatus(userToken);
    
    if (status.loggedIn) {
      console.log('Usuário já está logado, QR Code não necessário');
      return null;
    }
    
    if (!status.connected) {
      console.log('Usuário não conectado, conectando primeiro...');
      await wuzapi.connectSession(userToken);
      
      // Aguardar conexão
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // 2. Obter QR Code
    const qrData = await wuzapi.getQRCode(userToken);
    
    if (!qrData.QRCode) {
      throw new Error('QR Code vazio');
    }
    
    return qrData.QRCode;
    
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    
    // Tentar reconectar e obter novamente
    try {
      await forceReconnect(userToken);
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const qrData = await wuzapi.getQRCode(userToken);
      return qrData.QRCode;
    } catch (retryError) {
      console.error('Erro na segunda tentativa:', retryError);
      throw retryError;
    }
  }
}
```

##### Validar QR Code
```javascript
function validateQRCode(qrCode) {
  if (!qrCode) {
    return { valid: false, error: 'QR Code vazio' };
  }
  
  if (!qrCode.startsWith('data:image/')) {
    return { valid: false, error: 'QR Code não é uma imagem válida' };
  }
  
  if (qrCode.length < 100) {
    return { valid: false, error: 'QR Code muito pequeno' };
  }
  
  return { valid: true };
}

// Uso
const qrCode = await getQRCodeSafely(userToken);
const validation = validateQRCode(qrCode);

if (!validation.valid) {
  console.error('QR Code inválido:', validation.error);
  // Tentar obter novamente
}
```

## Erros de Envio de Mensagens

### 1. "Falha ao enviar mensagem"

#### Sintomas
```json
{
  "success": false,
  "error": "Failed to send message",
  "code": 400
}
```

#### Soluções

##### Validar Dados da Mensagem
```javascript
function validateMessageData(phone, message) {
  const errors = [];
  
  // Validar telefone
  if (!phone) {
    errors.push('Telefone é obrigatório');
  } else if (!/^55\d{10,11}$/.test(phone)) {
    errors.push('Formato de telefone inválido (use: 5511999999999)');
  }
  
  // Validar mensagem
  if (!message) {
    errors.push('Mensagem é obrigatória');
  } else if (message.length > 4096) {
    errors.push('Mensagem muito longa (máximo 4096 caracteres)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Uso
const validation = validateMessageData(phone, message);
if (!validation.valid) {
  console.error('Dados inválidos:', validation.errors);
  return;
}
```

##### Verificar Status Antes de Enviar
```javascript
async function sendMessageSafely(userToken, phone, message) {
  try {
    // 1. Validar dados
    const validation = validateMessageData(phone, message);
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }
    
    // 2. Verificar se usuário está conectado e logado
    const status = await wuzapi.getSessionStatus(userToken);
    
    if (!status.connected || !status.loggedIn) {
      throw new Error('Usuário não está conectado ao WhatsApp');
    }
    
    // 3. Enviar mensagem
    const result = await wuzapi.sendTextMessage(userToken, phone, message);
    
    console.log('Mensagem enviada:', result);
    return result;
    
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    throw error;
  }
}
```

### 2. "Número não existe no WhatsApp"

#### Sintomas
- Mensagem não é entregue
- Status permanece como "pending"
- Erro específico sobre número inválido

#### Soluções

##### Verificar Número no WhatsApp
```javascript
async function checkWhatsAppNumber(userToken, phone) {
  try {
    // Tentar obter informações do contato
    const contact = await wuzapi.getContact(phone, userToken);
    
    if (contact && contact.success) {
      return {
        exists: true,
        contact: contact.data
      };
    }
    
    return { exists: false };
    
  } catch (error) {
    console.log('Não foi possível verificar o número:', error);
    return { exists: false, error: error.message };
  }
}

// Uso antes de enviar mensagem
const numberCheck = await checkWhatsAppNumber(userToken, phone);
if (!numberCheck.exists) {
  console.warn('Número pode não existir no WhatsApp:', phone);
  // Decidir se continua ou não
}
```

## Problemas de Webhook

### 1. "Webhook não recebe eventos"

#### Sintomas
- Webhook configurado mas não recebe dados
- Eventos não chegam no endpoint
- Timeout no webhook

#### Soluções

##### Verificar Configuração do Webhook
```javascript
async function checkWebhookConfig(userToken) {
  try {
    const webhook = await wuzapi.getWebhook(userToken);
    console.log('Configuração atual:', webhook);
    
    if (!webhook.webhook) {
      console.error('Webhook não configurado');
      return false;
    }
    
    // Testar se URL é acessível
    const response = await fetch(webhook.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });
    
    console.log('Teste de webhook:', response.status);
    return response.ok;
    
  } catch (error) {
    console.error('Erro ao verificar webhook:', error);
    return false;
  }
}
```

##### Configurar Webhook Corretamente
```javascript
async function setupWebhook(userToken, webhookUrl) {
  try {
    const config = {
      webhook: webhookUrl,
      events: [
        'Message',
        'ReadReceipt', 
        'MessageStatus',
        'Connect',
        'Disconnect'
      ],
      subscribe: ['Message'] // Eventos principais
    };
    
    const result = await wuzapi.setWebhook(userToken, config.webhook, config.events);
    console.log('Webhook configurado:', result);
    
    // Verificar se foi configurado corretamente
    const verification = await wuzapi.getWebhook(userToken);
    console.log('Verificação:', verification);
    
    return result;
    
  } catch (error) {
    console.error('Erro ao configurar webhook:', error);
    throw error;
  }
}
```

##### Implementar Webhook Handler Robusto
```javascript
// Backend - webhook handler
app.post('/webhook/wuzapi', (req, res) => {
  try {
    const { event, instance, data, timestamp } = req.body;
    
    console.log('Webhook recebido:', {
      event,
      instance,
      timestamp,
      dataKeys: Object.keys(data || {})
    });
    
    // Validar payload
    if (!event || !instance) {
      console.error('Payload inválido:', req.body);
      return res.status(400).json({ error: 'Payload inválido' });
    }
    
    // Processar evento
    switch (event) {
      case 'message':
        handleIncomingMessage(instance, data);
        break;
        
      case 'connect':
        handleUserConnect(instance, data);
        break;
        
      case 'disconnect':
        handleUserDisconnect(instance, data);
        break;
        
      default:
        console.log('Evento não tratado:', event);
    }
    
    // Responder rapidamente
    res.status(200).json({ success: true, received: true });
    
  } catch (error) {
    console.error('Erro no webhook handler:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
});

function handleIncomingMessage(instance, data) {
  console.log(`Mensagem de ${instance}:`, data);
  
  // Processar mensagem de forma assíncrona
  setImmediate(() => {
    processMessage(instance, data);
  });
}

async function processMessage(instance, data) {
  try {
    // Salvar no banco de dados
    await saveMessage(instance, data);
    
    // Enviar resposta automática se necessário
    if (shouldAutoReply(data)) {
      await sendAutoReply(instance, data);
    }
    
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
  }
}
```

## Performance e Timeout

### 1. "Requisições muito lentas"

#### Sintomas
- Timeouts frequentes
- Resposta lenta da API
- Interface travando

#### Soluções

##### Implementar Cache
```javascript
class WuzAPICache {
  constructor(ttl = 300000) { // 5 minutos
    this.cache = new Map();
    this.ttl = ttl;
  }
  
  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }
  
  clear() {
    this.cache.clear();
  }
}

const cache = new WuzAPICache();

// Uso com cache
async function getUsersWithCache() {
  const cacheKey = 'users_list';
  let users = cache.get(cacheKey);
  
  if (!users) {
    users = await wuzapi.getUsers();
    cache.set(cacheKey, users);
  }
  
  return users;
}
```

##### Otimizar Requisições
```javascript
// Fazer requisições em paralelo quando possível
async function loadDashboardData() {
  try {
    const [users, stats, health] = await Promise.all([
      wuzapi.getUsers(),
      wuzapi.getStats(),
      wuzapi.getHealth()
    ]);
    
    return { users, stats, health };
    
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    throw error;
  }
}

// Implementar debounce para evitar muitas requisições
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Uso
const debouncedSearch = debounce(async (query) => {
  const results = await searchUsers(query);
  updateUI(results);
}, 500);
```

## Logs e Debug

### Habilitar Debug Detalhado

#### Backend
```javascript
// wuzapiClient.js - adicionar logging
class WuzAPIClient {
  async request(endpoint, options = {}) {
    const startTime = Date.now();
    
    console.log('WUZAPI Request:', {
      endpoint,
      method: options.method || 'GET',
      timestamp: new Date().toISOString()
    });
    
    try {
      const response = await this.client.request(endpoint, options);
      const duration = Date.now() - startTime;
      
      console.log('WUZAPI Response:', {
        endpoint,
        status: response.status,
        duration: `${duration}ms`,
        success: response.data?.success
      });
      
      return response;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.error('WUZAPI Error:', {
        endpoint,
        error: error.message,
        duration: `${duration}ms`,
        code: error.code
      });
      
      throw error;
    }
  }
}
```

#### Frontend
```javascript
// Interceptar requisições fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  const [url, options] = args;
  
  console.log('Fetch Request:', {
    url,
    method: options?.method || 'GET',
    headers: options?.headers,
    timestamp: new Date().toISOString()
  });
  
  const startTime = Date.now();
  
  try {
    const response = await originalFetch(...args);
    const duration = Date.now() - startTime;
    
    console.log('Fetch Response:', {
      url,
      status: response.status,
      duration: `${duration}ms`
    });
    
    return response;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error('Fetch Error:', {
      url,
      error: error.message,
      duration: `${duration}ms`
    });
    
    throw error;
  }
};
```

## Ferramentas de Diagnóstico

### Script de Diagnóstico Completo

```bash
#!/bin/bash

echo "=== Diagnóstico WUZAPI ==="
echo "Data: $(date)"
echo

# 1. Verificar conectividade
echo "1. Testando conectividade..."
if curl -s --connect-timeout 5 https://wzapi.wasend.com.br/health > /dev/null; then
    echo "✅ WUZAPI está acessível"
else
    echo "❌ WUZAPI não está acessível"
fi

# 2. Testar DNS
echo
echo "2. Testando DNS..."
if nslookup wzapi.wasend.com.br > /dev/null 2>&1; then
    echo "✅ DNS resolve corretamente"
else
    echo "❌ Problema com DNS"
fi

# 3. Testar token admin
echo
echo "3. Testando token administrativo..."
ADMIN_TOKEN="${VITE_ADMIN_TOKEN:-UeH7cZ2c1K3zVUBFi7SginSC}"

if curl -s -H "Authorization: $ADMIN_TOKEN" \
        https://wzapi.wasend.com.br/admin/users | grep -q "success"; then
    echo "✅ Token administrativo válido"
else
    echo "❌ Token administrativo inválido"
fi

# 4. Verificar variáveis de ambiente
echo
echo "4. Verificando configuração..."
echo "WUZAPI_BASE_URL: ${WUZAPI_BASE_URL:-'não definido'}"
echo "REQUEST_TIMEOUT: ${REQUEST_TIMEOUT:-'não definido'}"
echo "VITE_ADMIN_TOKEN: ${VITE_ADMIN_TOKEN:0:10}... (${#VITE_ADMIN_TOKEN} chars)"

# 5. Testar endpoints principais
echo
echo "5. Testando endpoints principais..."

endpoints=(
    "/health"
    "/admin/health"
    "/session/health"
)

for endpoint in "${endpoints[@]}"; do
    if curl -s "https://wzapi.wasend.com.br$endpoint" | grep -q "ok\|healthy"; then
        echo "✅ $endpoint"
    else
        echo "❌ $endpoint"
    fi
done

echo
echo "=== Fim do diagnóstico ==="
```

### Monitor de Performance

```javascript
// performance-monitor.js
class WuzAPIMonitor {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalTime: 0,
      slowRequests: 0
    };
    
    this.slowThreshold = 5000; // 5 segundos
  }
  
  recordRequest(duration, success) {
    this.metrics.requests++;
    this.metrics.totalTime += duration;
    
    if (!success) {
      this.metrics.errors++;
    }
    
    if (duration > this.slowThreshold) {
      this.metrics.slowRequests++;
      console.warn(`Requisição lenta: ${duration}ms`);
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
  
  reset() {
    this.metrics = {
      requests: 0,
      errors: 0,
      totalTime: 0,
      slowRequests: 0
    };
  }
}

const monitor = new WuzAPIMonitor();

// Integrar com cliente WUZAPI
const originalRequest = wuzapiClient.request;
wuzapiClient.request = async function(...args) {
  const startTime = Date.now();
  
  try {
    const result = await originalRequest.apply(this, args);
    const duration = Date.now() - startTime;
    
    monitor.recordRequest(duration, result.success);
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    monitor.recordRequest(duration, false);
    throw error;
  }
};

// Relatório periódico
setInterval(() => {
  const stats = monitor.getStats();
  console.log('WUZAPI Performance Stats:', stats);
  
  if (stats.errorRate > 10) {
    console.warn('Taxa de erro alta:', stats.errorRate + '%');
  }
  
  if (stats.averageTime > 3000) {
    console.warn('Tempo médio alto:', stats.averageTime + 'ms');
  }
}, 60000); // A cada minuto
```

---

**Dica**: Mantenha este guia atualizado conforme novos problemas são identificados e resolvidos. Documente sempre as soluções que funcionaram para facilitar troubleshooting futuro.