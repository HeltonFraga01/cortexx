#!/usr/bin/env node

/**
 * Testes unitários para rotas administrativas
 * Testa endpoints de administração com mocks para WuzAPI
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const fs = require('fs');

// Configuração de teste
const TEST_PORT = 3006;
const TEST_DB_PATH = './test-admin-routes.db';
const TEST_ADMIN_TOKEN = 'test-admin-token-123';
const MOCK_WUZAPI_PORT = 8082;

// Configurar variáveis de ambiente
process.env.NODE_ENV = 'test';
process.env.PORT = TEST_PORT;
process.env.SQLITE_DB_PATH = TEST_DB_PATH;
process.env.VITE_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.WUZAPI_BASE_URL = `http://localhost:${MOCK_WUZAPI_PORT}`;
process.env.REQUEST_TIMEOUT = '5000';

describe('Admin Routes Tests', () => {
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

  describe('GET /api/admin/users', () => {
    test('should return users list with valid admin token', async () => {
      const response = await makeRequest('GET', '/api/admin/users', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for valid admin token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.ok(Array.isArray(data.users), 'Should return users array');
      assert.ok(data.users.length >= 2, 'Should return mock users');
    });

    test('should return 401 for invalid admin token', async () => {
      const response = await makeRequest('GET', '/api/admin/users', null, {
        'Authorization': 'invalid-token'
      });

      assert.strictEqual(response.statusCode, 401, 'Should return 401 for invalid token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
      assert.ok(data.error.includes('inválido'), 'Should return invalid token error');
    });

    test('should return 400 for missing admin token', async () => {
      const response = await makeRequest('GET', '/api/admin/users');

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for missing token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });

    test('should filter connected users only', async () => {
      const response = await makeRequest('GET', '/api/admin/users?connected_only=true', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.ok(data.filtered_data, 'Should have filtered data');
      
      // Verificar se todos os usuários filtrados estão conectados
      data.filtered_data.forEach(user => {
        assert.strictEqual(user.connected, true, 'All filtered users should be connected');
      });
    });

    test('should include stats when requested', async () => {
      const response = await makeRequest('GET', '/api/admin/users?include_stats=true', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.ok(data.stats, 'Should include stats');
      assert.ok(typeof data.stats.total === 'number', 'Stats should have total count');
      assert.ok(typeof data.stats.connected === 'number', 'Stats should have connected count');
      assert.ok(typeof data.stats.logged_in === 'number', 'Stats should have logged in count');
    });
  });

  describe('GET /api/admin/stats', () => {
    test('should return user statistics', async () => {
      const response = await makeRequest('GET', '/api/admin/stats', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.ok(data.data, 'Should have data field');
      assert.ok(typeof data.data.total === 'number', 'Should have total count');
      assert.ok(typeof data.data.connected === 'number', 'Should have connected count');
    });
  });

  describe('GET /api/admin/health', () => {
    test('should return health status', async () => {
      const response = await makeRequest('GET', '/api/admin/health');

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.service, 'admin-validation', 'Should identify service');
      assert.ok(data.data.wuzapi_connection, 'Should report WuzAPI connection status');
    });
  });

  describe('GET /api/admin/users/:userId', () => {
    test('should return specific user', async () => {
      const response = await makeRequest('GET', '/api/admin/users/user1', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.id, 'user1', 'Should return correct user');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await makeRequest('GET', '/api/admin/users/nonexistent', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 404, 'Should return 404');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });
  });

  describe('POST /api/admin/users', () => {
    test('should create new user with valid data', async () => {
      const userData = {
        name: 'Test User Instance',
        token: 'new-user-token-123',
        webhook: 'https://example.com/webhook',
        events: 'All'
      };

      const response = await makeRequest('POST', '/api/admin/users', userData, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 201, 'Should return 201 for successful creation');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.ok(data.data, 'Should return created user data');
    });

    test('should return 400 for missing required fields', async () => {
      const userData = {
        name: 'Test User'
        // token missing
      };

      const response = await makeRequest('POST', '/api/admin/users', userData, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for missing fields');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });

    test('should return 409 for duplicate user token', async () => {
      const userData = {
        name: 'Duplicate User',
        token: 'existing-user-token'
      };

      const response = await makeRequest('POST', '/api/admin/users', userData, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 409, 'Should return 409 for duplicate token');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });
  });

  describe('DELETE /api/admin/users/:userId', () => {
    test('should delete user from database', async () => {
      const response = await makeRequest('DELETE', '/api/admin/users/user1', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for successful deletion');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.deletionType, 'database_only', 'Should indicate database-only deletion');
    });

    test('should return 404 for non-existent user', async () => {
      const response = await makeRequest('DELETE', '/api/admin/users/nonexistent', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 404, 'Should return 404');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
    });
  });

  describe('DELETE /api/admin/users/:userId/full', () => {
    test('should delete user completely', async () => {
      const response = await makeRequest('DELETE', '/api/admin/users/user2/full', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.strictEqual(response.statusCode, 200, 'Should return 200 for successful deletion');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, true, 'Response should indicate success');
      assert.strictEqual(data.data.deletionType, 'full', 'Should indicate full deletion');
    });
  });

  describe('Error Handling', () => {
    test('should handle WuzAPI timeout', async () => {
      // Configurar mock para simular timeout
      mockWuzAPI.close();
      
      const response = await makeRequest('GET', '/api/admin/users', null, {
        'Authorization': TEST_ADMIN_TOKEN
      });

      assert.ok([500, 504].includes(response.statusCode), 'Should handle timeout gracefully');
      
      const data = JSON.parse(response.body);
      assert.strictEqual(data.success, false, 'Response should indicate failure');
      
      // Reconfigurar mock
      await setupMockWuzAPI();
    });

    test('should handle malformed request data', async () => {
      const response = await makeRequestRaw('POST', '/api/admin/users', 'invalid json', {
        'Authorization': TEST_ADMIN_TOKEN,
        'Content-Type': 'application/json'
      });

      assert.strictEqual(response.statusCode, 400, 'Should return 400 for malformed JSON');
    });
  });

  // Funções auxiliares
  async function setupMockWuzAPI() {
    mockWuzAPI = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const token = req.headers.authorization;
      const url = req.url;
      const method = req.method;

      // Mock responses baseadas na URL e token
      if (token === TEST_ADMIN_TOKEN) {
        if (url === '/admin/users' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({
            success: true,
            users: [
              { id: 'user1', name: 'User 1', connected: true, loggedIn: true },
              { id: 'user2', name: 'User 2', connected: false, loggedIn: false },
              { id: 'user3', name: 'User 3', connected: true, loggedIn: false }
            ]
          }));
        } else if (url === '/admin/users' && method === 'POST') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            const userData = JSON.parse(body);
            if (userData.token === 'existing-user-token') {
              res.writeHead(409);
              res.end(JSON.stringify({ success: false, error: 'User already exists' }));
            } else {
              res.writeHead(201);
              res.end(JSON.stringify({
                success: true,
                data: { id: 'new-user-id', ...userData }
              }));
            }
          });
        } else if (url.startsWith('/admin/users/') && method === 'DELETE') {
          const userId = url.split('/')[3];
          if (userId === 'nonexistent') {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'User not found' }));
          } else {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              data: { message: 'User deleted', userId }
            }));
          }
        } else if (url.startsWith('/admin/users/') && method === 'GET') {
          const userId = url.split('/')[3];
          if (userId === 'nonexistent') {
            res.writeHead(404);
            res.end(JSON.stringify({ success: false, error: 'User not found' }));
          } else {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              data: { id: userId, name: `User ${userId}`, connected: true, loggedIn: true }
            }));
          }
        } else if (url === '/health' && method === 'GET') {
          res.writeHead(200);
          res.end(JSON.stringify({ status: 'ok' }));
        } else {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, error: 'Endpoint not found' }));
        }
      } else {
        res.writeHead(401);
        res.end(JSON.stringify({ success: false, error: 'Token inválido' }));
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
    const adminRoutes = require('../../routes/adminRoutes');
    app.use('/api/admin', adminRoutes);

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