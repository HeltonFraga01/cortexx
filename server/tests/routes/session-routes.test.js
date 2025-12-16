#!/usr/bin/env node

/**
 * Testes unitários para rotas de sessão
 * Testa endpoints de validação de sessão com mocks para WuzAPI
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const fs = require('fs');

// Configuração de teste
const TEST_PORT = 3007;
const TEST_DB_PATH = './test-session-routes.db';
const TEST_USER_TOKEN = 'test-user-token-456';
const MOCK_WUZAPI_PORT = 8083;

// Configurar variáveis de ambiente
process.env.NODE_ENV = 'test';
process.env.PORT = TEST_PORT;
process.env.SQLITE_DB_PATH = TEST_DB_PATH;
process.env.WUZAPI_BASE_URL = `http://localhost:${MOCK_WUZAPI_PORT}`;
process.env.REQUEST_TIMEOUT = '5000';

describe('Session Routes Tests', () => {
  let server;
  let mockWuzAPI;
  let db;

  before(async () => {
    // Limpar arquivos de teste
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Configurar mock WuzAPI
    await setupMockWuzAPI();

    // Configurar banco de dados
    const Database = require('../../database');
    db = new Database(TEST_DB_PATH);
    await db.init();

    // Configurar servidor de teste
    await setupTestServer();
  });

  after(async () => {
    // Limpar recursos
    if (server) {
      server.close();
    }
    if (mockWuzAPI) {
      mockWuzAPI.close();
    }
    if (db) {
      await db.close();
    }
    
    // Limpar arquivos de teste
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('GET /api/session/status', () => {
    test('should return session status with valid token', async () => {
      const response = await makeRequest('GET', '/api/session/status', null, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for valid token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.ok(data.data, 'Should have data field');
      assert.ok(typeof data.data.Connected === 'boolean', 'Should have Connected status');
      assert.ok(typeof data.data.LoggedIn === 'boolean', 'Should have LoggedIn status');
    });

    test('should return 401 for invalid token', async () => {
      const response = await makeRequest('GET', '/api/session/status', null, {
        'token': 'invalid-token'
      });

      assert.strictEqual(response.statusCode, 401, 'Should return 401 for invalid token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
      assert.ok(data.error.includes('inválido'), 'Should return invalid token error');
    });

    test('should return 400 for missing token', async () => {
      const response = await makeRequest('GET', '/api/session/status');

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for missing token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });

    test('should return 400 for invalid token format', async () => {
      const response = await makeRequest('GET', '/api/session/status', null, {
        'token': 'short'
      });

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for invalid format');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
      assert.ok(data.error.includes('formato'), 'Should return format error');
    });
  });

  describe('GET /api/session/health', () => {
    test('should return health status', async () => {
      const response = await makeRequest('GET', '/api/session/health');

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.service, 'session-validation', 'Should identify service');
      assert.ok(data.data.wuzapi_connection, 'Should report WuzAPI connection status');
    });
  });

  describe('GET /api/session/token-info', () => {
    test('should return token information', async () => {
      const response = await makeRequest('GET', '/api/session/token-info', null, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.token_provided, true, 'Should detect token provided');
      assert.strictEqual(data.data.token_length, TEST_USER_TOKEN.length, 'Should report correct token length');
      assert.strictEqual(data.data.valid_format, true, 'Should validate token format');
      assert.ok(data.data.token_prefix, 'Should provide token prefix');
    });

    test('should handle missing token in token-info', async () => {
      const response = await makeRequest('GET', '/api/session/token-info');

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for missing token');
    });
  });

  describe('POST /api/session/connect', () => {
    test('should connect session with valid token', async () => {
      const response = await makeRequest('POST', '/api/session/connect', {}, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for successful connection');
      
      const data = JSON.parse(response.body);
      assert.ok(data.success !== false, 'Should not explicitly indicate failure');
    });

    test('should return error for invalid token in connect', async () => {
      const response = await makeRequest('POST', '/api/session/connect', {}, {
        'token': 'invalid-token'
      });

      assert.ok([401, 500].includes(response.statusCode), 'Should return error for invalid token');
    });
  });

  describe('POST /api/session/disconnect', () => {
    test('should disconnect session with valid token', async () => {
      const response = await makeRequest('POST', '/api/session/disconnect', {}, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for successful disconnection');
      
      const data = JSON.parse(response.body);
      assert.ok(data.success !== false, 'Should not explicitly indicate failure');
    });
  });

  describe('POST /api/session/logout', () => {
    test('should logout session with valid token', async () => {
      const response = await makeRequest('POST', '/api/session/logout', {}, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for successful logout');
      
      const data = JSON.parse(response.body);
      assert.ok(data.success !== false, 'Should not explicitly indicate failure');
    });
  });

  describe('GET /api/session/qr', () => {
    test('should get QR code with valid token', async () => {
      const response = await makeRequest('GET', '/api/session/qr', null, {
        'token': TEST_USER_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for QR request');
      
      const data = JSON.parse(response.body);
      assert.ok(data.qr || data.message, 'Should return QR data or message');
    });
  });

  describe('Error Handling', () => {
    test('should handle WuzAPI connection error', async () => {
      // Parar mock para simular erro de conexão
      mockWuzAPI.close();
      
      const response = await makeRequest('GET', '/api/session/status', null, {
        'token': TEST_USER_TOKEN
      });

      assert.ok([500, 504].includes(response.statusCode), 'Should handle connection error gracefully');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
      
      // Reconfigurar mock
      await setupMockWuzAPI();
    });

    test('should handle malformed request data', async () => {
      const response = await makeRequestRaw('POST', '/api/session/connect', 'invalid json', {
        'token': TEST_USER_TOKEN,
        'Content-Type': 'application/json'
      });

      assert.ok([400, 500].includes(response.statusCode), 'Should handle malformed JSON');
    });

    test('should validate token length limits', async () => {
      const shortToken = 'short';
      const longToken = 'a'.repeat(300);

      const shortResponse = await makeRequest('GET', '/api/session/status', null, {
        'token': shortToken
      });
      assert.strictEqual(shortResponse.statusCode, 400, 'Should reject short token');

      const longResponse = await makeRequest('GET', '/api/session/status', null, {
        'token': longToken
      });
      assert.strictEqual(longResponse.statusCode, 400, 'Should reject long token');
    });
  });

  // Funções auxiliares
  async function setupMockWuzAPI() {
    mockWuzAPI = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, token');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const token = req.headers.token;
      const url = req.url;
      const method = req.method;

      // Mock responses baseadas na URL e token
      if (token === TEST_USER_TOKEN) {
        if (url === '/session/status' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: {
              connected: true,
              loggedIn: true,
              jid: 'test@s.whatsapp.net'
            }
          }));
        } else if (url === '/session/connect' && method === 'POST') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Session connected'
          }));
        } else if (url === '/session/disconnect' && method === 'POST') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Session disconnected'
          }));
        } else if (url === '/session/logout' && method === 'POST') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            message: 'Session logged out'
          }));
        } else if (url === '/session/qr' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
          }));
        } else if (url === '/health' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
        }
      } else if (token === 'invalid-token') {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Token inválido' }));
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Token necessário' }));
      }
    });

    return new Promise((resolve) => {
      mockWuzAPI.listen(MOCK_WUZAPI_PORT, () => {
        console.log(`Mock WuzAPI server running on port ${MOCK_WUZAPI_PORT}`);
        resolve();
      });
    });
  }

  async function setupTestServer() {
    const app = express();
    app.use(express.json());

    // Importar e usar rotas
    const sessionRoutes = require('../../routes/sessionRoutes');
    app.use('/api/session', sessionRoutes);

    return new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`Test server running on port ${TEST_PORT}`);
        resolve();
      });
    });
  }

  function makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: TEST_PORT,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }

      req.end();
    });
  }

  function makeRequestRaw(method, path, rawData = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: TEST_PORT,
        path: path,
        method: method,
        headers: headers
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (rawData) {
        req.write(rawData);
      }

      req.end();
    });
  }
});