const assert = require('assert');
const { describe, it, before } = require('node:test');
const request = require('supertest');
const express = require('express');
const session = require('express-session');
const { csrfProtection, getCsrfToken, csrfErrorHandler } = require('../middleware/csrf');

describe('CSRF Protection', () => {
  let app;
  let agent;

  before(() => {
    // Criar app de teste com session em memória
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Session middleware simples (em memória para testes)
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false, // false para testes
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000
      }
    }));
    
    // CSRF protection
    app.use(csrfProtection);
    
    // Endpoint para obter token
    app.get('/api/auth/csrf-token', getCsrfToken);
    
    // Endpoint de teste que requer CSRF
    app.post('/api/test', (req, res) => {
      res.json({ success: true, message: 'CSRF token válido' });
    });
    
    // CSRF error handler
    app.use(csrfErrorHandler);
    
    // Error handler genérico
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
    
    // Criar agent para manter cookies entre requisições
    agent = request.agent(app);
  });

  it('deve retornar token CSRF no endpoint /api/auth/csrf-token', async () => {
    const response = await agent.get('/api/auth/csrf-token');
    
    assert.strictEqual(response.status, 200);
    assert.ok(response.body.csrfToken);
    assert.strictEqual(typeof response.body.csrfToken, 'string');
  });

  it('deve rejeitar POST sem token CSRF', async () => {
    const response = await agent
      .post('/api/test')
      .send({ data: 'test' });
    
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.code, 'CSRF_VALIDATION_FAILED');
  });

  it('deve aceitar POST com token CSRF válido', async () => {
    // Obter token CSRF
    const csrfResponse = await agent.get('/api/auth/csrf-token');
    const csrfToken = csrfResponse.body.csrfToken;
    
    // Fazer POST com token
    const response = await agent
      .post('/api/test')
      .set('CSRF-Token', csrfToken)
      .send({ data: 'test' });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
  });

  it('deve rejeitar POST com token CSRF inválido', async () => {
    const response = await agent
      .post('/api/test')
      .set('CSRF-Token', 'token-invalido')
      .send({ data: 'test' });
    
    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.body.code, 'CSRF_VALIDATION_FAILED');
  });

  it('deve aceitar POST com token CSRF no body (_csrf)', async () => {
    // Obter token CSRF
    const csrfResponse = await agent.get('/api/auth/csrf-token');
    const csrfToken = csrfResponse.body.csrfToken;
    
    // Fazer POST com token no body
    const response = await agent
      .post('/api/test')
      .send({ 
        data: 'test',
        _csrf: csrfToken 
      });
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
  });

  it('não deve requerer CSRF em requisições GET', async () => {
    // GET não requer CSRF
    const response = await agent.get('/api/auth/csrf-token');
    
    assert.strictEqual(response.status, 200);
  });
});
