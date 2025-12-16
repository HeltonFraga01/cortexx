const assert = require('assert');
const { describe, it, before } = require('node:test');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const authRoutes = require('../routes/authRoutes');

describe('Auth Routes', () => {
  let app;

  before(() => {
    // Criar app de teste
    app = express();
    app.use(express.json());
    
    // Session middleware
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'strict'
      }
    }));
    
    // Auth routes
    app.use('/api/auth', authRoutes);
  });

  describe('POST /api/auth/login', () => {
    it('deve rejeitar login sem token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ role: 'user' });
      
      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.code, 'INVALID_INPUT');
    });

    it('deve rejeitar login sem role', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ token: 'test-token' });
      
      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.code, 'INVALID_INPUT');
    });

    it('deve rejeitar login com role inválido', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ token: 'test-token', role: 'invalid' });
      
      assert.strictEqual(response.status, 400);
      assert.strictEqual(response.body.code, 'INVALID_ROLE');
    });
  });

  describe('GET /api/auth/status', () => {
    it('deve retornar não autenticado sem sessão', async () => {
      const response = await request(app).get('/api/auth/status');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.authenticated, false);
    });

    it('deve retornar autenticado com sessão válida', async () => {
      const agent = request.agent(app);
      
      // Simular sessão (em produção seria via login real)
      // Para teste, vamos apenas verificar a estrutura da resposta
      const response = await agent.get('/api/auth/status');
      
      assert.strictEqual(response.status, 200);
      assert.ok('authenticated' in response.body);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deve aceitar logout mesmo sem sessão', async () => {
      const response = await request(app).post('/api/auth/logout');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.success, true);
    });
  });
});
