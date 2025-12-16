# Exemplo: Criando Nova Integração Externa

Como implementar uma integração com serviços externos no WUZAPI Manager.

## 🎯 Objetivo

Criar uma integração com um serviço de CRM externo que:
- Sincroniza contatos automaticamente
- Envia dados de mensagens para o CRM
- Implementa retry e tratamento de erros
- Monitora performance e logs

## 📋 Cenário

Vamos integrar com um CRM fictício "SuperCRM" que possui:
- API REST para contatos
- Webhook para receber eventos
- Autenticação via API Key
- Rate limiting (100 req/min)

## 🔧 Implementação

### Passo 1: Cliente HTTP Base

🔧 **Criar** `server/integrations/superCrmClient.js`:
```javascript
const axios = require('axios');
const logger = require('../utils/logger');

class SuperCrmClient {
  constructor() {
    this.baseURL = process.env.SUPER_CRM_BASE_URL || 'https://api.supercrm.com/v1';
    this.apiKey = process.env.SUPER_CRM_API_KEY;
    this.timeout = 30000;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'WUZAPI-Manager/1.0'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info('SuperCRM Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          timestamp: new Date().toISOString()
        });
        return config;
      },
      (error) => {
        logger.error('SuperCRM Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info('SuperCRM Response', {
          status: response.status,
          url: response.config.url,
          duration: response.headers['x-response-time'] || 'unknown'
        });
        return response;
      },
      (error) => {
        logger.error('SuperCRM Response Error', {
          status: error.response?.status,
          message: error.message,
          url: error.config?.url
        });
        return Promise.reject(error);
      }
    );
  }
```  asy
nc request(method, endpoint, data = null, options = {}) {
    const config = {
      method,
      url: endpoint,
      ...options
    };

    if (data) {
      config.data = data;
    }

    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await this.client.request(config);
        return response.data;
      } catch (error) {
        lastError = error;
        
        // Não fazer retry para erros 4xx (exceto 429)
        if (error.response?.status >= 400 && 
            error.response?.status < 500 && 
            error.response?.status !== 429) {
          throw error;
        }

        if (attempt < this.retryAttempts) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(`SuperCRM retry attempt ${attempt}`, {
            endpoint,
            delay,
            error: error.message
          });
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // Métodos específicos do CRM
  async createContact(contactData) {
    return this.request('POST', '/contacts', {
      name: contactData.name,
      phone: contactData.phone,
      email: contactData.email,
      source: 'WUZAPI-Manager',
      created_at: new Date().toISOString()
    });
  }

  async updateContact(contactId, updates) {
    return this.request('PUT', `/contacts/${contactId}`, {
      ...updates,
      updated_at: new Date().toISOString()
    });
  }

  async getContact(phone) {
    return this.request('GET', `/contacts/search?phone=${phone}`);
  }

  async createActivity(contactId, activityData) {
    return this.request('POST', `/contacts/${contactId}/activities`, {
      type: 'whatsapp_message',
      description: activityData.message,
      direction: activityData.direction, // 'inbound' or 'outbound'
      timestamp: activityData.timestamp,
      metadata: {
        message_id: activityData.messageId,
        user_token: activityData.userToken
      }
    });
  }
}

module.exports = new SuperCrmClient();
```

### Passo 2: Serviço de Sincronização

🔧 **Criar** `server/services/crmSyncService.js`:
```javascript
const superCrmClient = require('../integrations/superCrmClient');
const logger = require('../utils/logger');

class CrmSyncService {
  constructor() {
    this.syncQueue = [];
    this.processing = false;
    this.batchSize = 10;
    this.processInterval = 5000; // 5 segundos
    
    this.startProcessor();
  }

  startProcessor() {
    setInterval(() => {
      if (!this.processing && this.syncQueue.length > 0) {
        this.processBatch();
      }
    }, this.processInterval);
  }

  async syncContact(contactData) {
    return new Promise((resolve, reject) => {
      this.syncQueue.push({
        type: 'contact',
        data: contactData,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }

  async syncMessage(messageData) {
    return new Promise((resolve, reject) => {
      this.syncQueue.push({
        type: 'message',
        data: messageData,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }
```