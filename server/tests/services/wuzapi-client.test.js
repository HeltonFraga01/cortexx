#!/usr/bin/env node

/**
 * Testes unitários para WuzAPIClient
 * Testa métodos de comunicação com WuzAPI usando mocks
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');

// Configuração de teste
const MOCK_WUZAPI_PORT = 8084;
const TEST_ADMIN_TOKEN = 'test-admin-token';
const TEST_USER_TOKEN = 'test-user-token';

// Configurar variáveis de ambiente
process.env.NODE_ENV = 'test';
process.env.WUZAPI_BASE_URL = `http://localhost:${MOCK_WUZAPI_PORT}`;
process.env.REQUEST_TIMEOUT = '5000';

describe('WuzAPIClient Service Tests', () => {
  let mockServer;
  let wuzapiClient;

  before(async () => {
    // Configurar mock server
    await setupMockServer();
    
    // Importar cliente após configurar variáveis de ambiente
    wuzapiClient = require('../../utils/wuzapiClient');
  });

  after(async () => {
    if (mockServer) {
      mockServer.close();
    }
  });

  describe('Configuration', () => {
    test('should have correct configuration', () => {
      const config = wuzapiClient.getConfig();
      
      assert.ok(config, 'Should return configuration object');
      assert.strictEqual(config.baseURL, `http://localhost:${MOCK_WUZAPI_PORT}`, 'Should use test base URL');
      assert.strictEqual(config.timeout, 5000, 'Should use test timeout');
    });
  });

  describe('GET Requests', () => {
    test('should make successful GET request', async () => {
      const response = await wuzapiClient.get('/test-endpoint');
      
      assert.strictEqual(response.success, true, 'Should indicate success');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(response.data, 'Should have response data');
    });

    test('should handle GET request with headers', async () => {
      const response = await wuzapiClient.get('/test-endpoint', {
        headers: { 'Custom-Header': 'test-value' }
      });
      
      assert.strictEqual(response.success, true, 'Should handle custom headers');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('should handle 404 error in GET request', async () => {
      const response = await wuzapiClient.get('/nonexistent-endpoint');
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.status, 404, 'Should return 404 status');
      assert.ok(response.error, 'Should have error message');
    });
  });

  describe('POST Requests', () => {
    test('should make successful POST request', async () => {
      const testData = { name: 'Test', value: 123 };
      const response = await wuzapiClient.post('/test-endpoint', testData);
      
      assert.strictEqual(response.success, true, 'Should indicate success');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(response.data, 'Should have response data');
    });

    test('should handle POST request with headers', async () => {
      const testData = { test: 'data' };
      const response = await wuzapiClient.post('/test-endpoint', testData, {
        headers: { 'Authorization': 'Bearer token' }
      });
      
      assert.strictEqual(response.success, true, 'Should handle authorization header');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('should handle validation error in POST request', async () => {
      const invalidData = { invalid: 'data' };
      const response = await wuzapiClient.post('/validation-error', invalidData);
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.status, 400, 'Should return 400 status');
      assert.ok(response.error, 'Should have error message');
    });
  });

  describe('DELETE Requests', () => {
    test('should make successful DELETE request', async () => {
      const response = await wuzapiClient.delete('/test-endpoint');
      
      assert.strictEqual(response.success, true, 'Should indicate success');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('should handle DELETE request with headers', async () => {
      const response = await wuzapiClient.delete('/test-endpoint', {
        headers: { 'Authorization': 'Bearer token' }
      });
      
      assert.strictEqual(response.success, true, 'Should handle authorization header');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });
  });

  describe('Admin Methods', () => {
    test('should make admin GET request', async () => {
      const response = await wuzapiClient.getAdmin('/admin/users', TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, true, 'Should indicate success');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
      assert.ok(response.data.users, 'Should return users data');
    });

    test('should make admin POST request', async () => {
      const userData = { name: 'New User', token: 'new-token' };
      const response = await wuzapiClient.postAdmin('/admin/users', userData, TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, true, 'Should indicate success');
      assert.strictEqual(response.status, 201, 'Should return 201 status');
      assert.ok(response.data, 'Should return created user data');
    });

    test('should handle unauthorized admin request', async () => {
      const response = await wuzapiClient.getAdmin('/admin/users', 'invalid-token');
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.status, 401, 'Should return 401 status');
    });
  });

  describe('User Management Methods', () => {
    test('should create user successfully', async () => {
      const userData = {
        name: 'Test User',
        token: 'test-user-token',
        webhook: 'https://example.com/webhook'
      };
      
      const response = await wuzapiClient.createUser(userData, TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, true, 'Should create user successfully');
      assert.strictEqual(response.status, 201, 'Should return 201 status');
      assert.ok(response.data, 'Should return user data');
    });

    test('should delete user from database', async () => {
      const response = await wuzapiClient.deleteUser('test-user-id', TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, true, 'Should delete user successfully');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('should delete user completely', async () => {
      const response = await wuzapiClient.deleteUserFull('test-user-id', TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, true, 'Should delete user completely');
      assert.strictEqual(response.status, 200, 'Should return 200 status');
    });

    test('should handle user not found error', async () => {
      const response = await wuzapiClient.deleteUser('nonexistent-user', TEST_ADMIN_TOKEN);
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.status, 404, 'Should return 404 status');
    });
  });

  describe('Health Check', () => {
    test('should check WuzAPI health', async () => {
      const isHealthy = await wuzapiClient.isHealthy();
      
      assert.strictEqual(isHealthy, true, 'Should report healthy status');
    });

    test('should handle unhealthy service', async () => {
      // Parar mock server temporariamente
      mockServer.close();
      
      const isHealthy = await wuzapiClient.isHealthy();
      
      assert.strictEqual(isHealthy, false, 'Should report unhealthy status');
      
      // Reconfigurar mock server
      await setupMockServer();
    });
  });

  describe('Error Handling', () => {
    test('should handle connection timeout', async () => {
      // Configurar cliente com timeout muito baixo
      const originalTimeout = process.env.REQUEST_TIMEOUT;
      process.env.REQUEST_TIMEOUT = '1';
      
      // Recriar cliente com novo timeout
      delete require.cache[require.resolve('../../utils/wuzapiClient')];
      const timeoutClient = require('../../utils/wuzapiClient');
      
      const response = await timeoutClient.get('/slow-endpoint');
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.code, 'TIMEOUT', 'Should indicate timeout error');
      
      // Restaurar timeout original
      process.env.REQUEST_TIMEOUT = originalTimeout;
    });

    test('should handle connection refused', async () => {
      // Parar mock server
      mockServer.close();
      
      const response = await wuzapiClient.get('/test-endpoint');
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.code, 'CONNECTION_ERROR', 'Should indicate connection error');
      
      // Reconfigurar mock server
      await setupMockServer();
    });

    test('should handle server error responses', async () => {
      const response = await wuzapiClient.get('/server-error');
      
      assert.strictEqual(response.success, false, 'Should indicate failure');
      assert.strictEqual(response.status, 500, 'Should return 500 status');
      assert.ok(response.error, 'Should have error message');
    });

    test('should handle malformed JSON responses', async () => {
      const response = await wuzapiClient.get('/malformed-json');
      
      // Should still handle the response gracefully
      assert.ok(response, 'Should return response object');
      assert.ok(typeof response.success === 'boolean', 'Should have success field');
    });
  });

  describe('Request/Response Validation', () => {
    test('should send correct Content-Type header', async () => {
      const response = await wuzapiClient.post('/validate-headers', { test: 'data' });
      
      assert.strictEqual(response.success, true, 'Should send correct headers');
      assert.strictEqual(response.data.contentType, 'application/json', 'Should send JSON content type');
    });

    test('should handle different response content types', async () => {
      const response = await wuzapiClient.get('/text-response');
      
      assert.strictEqual(response.success, true, 'Should handle text responses');
      assert.ok(response.data, 'Should have response data');
    });

    test('should preserve request data integrity', async () => {
      const complexData = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null_value: null
      };
      
      const response = await wuzapiClient.post('/echo-data', complexData);
      
      assert.strictEqual(response.success, true, 'Should handle complex data');
      assert.deepStrictEqual(response.data.receivedData, complexData, 'Should preserve data integrity');
    });
  });

  // Função auxiliar para configurar mock server
  async function setupMockServer() {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const url = req.url;
      const method = req.method;
      const authHeader = req.headers.authorization;

      // Simular delay para alguns endpoints
      if (url === '/slow-endpoint') {
        setTimeout(() => {
          res.writeHead(200);
          res.end(JSON.stringify({ message: 'Slow response' }));
        }, 100);
        return;
      }

      // Endpoints que requerem autenticação admin
      if (url.startsWith('/admin/')) {
        if (authHeader !== TEST_ADMIN_TOKEN) {
          res.writeHead(401);
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        if (url === '/admin/users' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            users: [
              { id: 'user1', name: 'User 1' },
              { id: 'user2', name: 'User 2' }
            ]
          }));
        } else if (url === '/admin/users' && method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            const userData = JSON.parse(body);
            res.writeHead(201);
            res.end(JSON.stringify({
              success: true,
              data: { id: 'new-user-id', ...userData }
            }));
          });
        } else if (url.startsWith('/admin/users/') && method === 'DELETE') {
          const userId = url.split('/')[3];
          if (userId === 'nonexistent-user') {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'User not found' }));
          } else {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: 'User deleted' }));
          }
        }
        return;
      }

      // Endpoints de teste gerais
      switch (url) {
        case '/test-endpoint':
          if (method === 'GET' || method === 'POST' || method === 'DELETE') {
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: 'Test response' }));
          }
          break;

        case '/nonexistent-endpoint':
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Not found' }));
          break;

        case '/validation-error':
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Validation failed' }));
          break;

        case '/server-error':
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Internal server error' }));
          break;

        case '/malformed-json':
          res.writeHead(200);
          res.end('{ invalid json response');
          break;

        case '/text-response':
          res.setHeader('Content-Type', 'text/plain');
          res.writeHead(200);
          res.end('Plain text response');
          break;

        case '/validate-headers':
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            data: {
              contentType: req.headers['content-type'],
              userAgent: req.headers['user-agent']
            }
          }));
          break;

        case '/echo-data':
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            const receivedData = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              data: { receivedData }
            }));
          });
          break;

        case '/health':
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
          break;

        default:
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    });

    return new Promise((resolve) => {
      mockServer.listen(MOCK_WUZAPI_PORT, () => {
        console.log(`Mock WuzAPI server running on port ${MOCK_WUZAPI_PORT}`);
        resolve();
      });
    });
  }
});