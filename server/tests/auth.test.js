const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { requireAuth, requireAdmin, requireUser } = require('../middleware/auth');

describe('Authentication Middleware', () => {
  let app;

  beforeEach(() => {
    // Criar app de teste
    app = express();
    app.use(express.json());
    
    // Session middleware simples
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Rota para simular login
    app.post('/login', (req, res) => {
      req.session.userId = req.body.userId;
      req.session.role = req.body.role;
      res.json({ success: true });
    });
    
    // Rotas protegidas
    app.get('/protected', requireAuth, (req, res) => {
      res.json({ message: 'Authenticated' });
    });
    
    app.get('/admin-only', requireAdmin, (req, res) => {
      res.json({ message: 'Admin access' });
    });
    
    app.get('/user-only', requireUser, (req, res) => {
      res.json({ message: 'User access' });
    });
  });

  describe('requireAuth', () => {
    it('deve rejeitar requisição sem sessão', async () => {
      const response = await request(app).get('/protected');
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('deve aceitar requisição com sessão válida', async () => {
      const agent = request.agent(app);
      
      // Login
      await agent.post('/login').send({ userId: 'user123', role: 'user' });
      
      // Acessar rota protegida
      const response = await agent.get('/protected');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.message, 'Authenticated');
    });
  });

  describe('requireAdmin', () => {
    it('deve rejeitar requisição sem sessão', async () => {
      const response = await request(app).get('/admin-only');
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('deve rejeitar user tentando acessar endpoint admin', async () => {
      const agent = request.agent(app);
      
      // Login como user
      await agent.post('/login').send({ userId: 'user123', role: 'user' });
      
      // Tentar acessar endpoint admin
      const response = await agent.get('/admin-only');
      
      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.code, 'FORBIDDEN');
    });

    it('deve aceitar admin acessando endpoint admin', async () => {
      const agent = request.agent(app);
      
      // Login como admin
      await agent.post('/login').send({ userId: 'admin123', role: 'admin' });
      
      // Acessar endpoint admin
      const response = await agent.get('/admin-only');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.message, 'Admin access');
    });
  });

  describe('requireUser', () => {
    it('deve rejeitar requisição sem sessão', async () => {
      const response = await request(app).get('/user-only');
      
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('deve rejeitar admin tentando acessar endpoint user', async () => {
      const agent = request.agent(app);
      
      // Login como admin
      await agent.post('/login').send({ userId: 'admin123', role: 'admin' });
      
      // Tentar acessar endpoint user
      const response = await agent.get('/user-only');
      
      assert.strictEqual(response.status, 403);
      assert.strictEqual(response.body.code, 'FORBIDDEN');
    });

    it('deve aceitar user acessando endpoint user', async () => {
      const agent = request.agent(app);
      
      // Login como user
      await agent.post('/login').send({ userId: 'user123', role: 'user' });
      
      // Acessar endpoint user
      const response = await agent.get('/user-only');
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.message, 'User access');
    });
  });
});
