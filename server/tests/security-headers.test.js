const assert = require('assert');
const { describe, it, before } = require('node:test');
const request = require('supertest');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const { csrfProtection, getCsrfToken } = require('../middleware/csrf');

describe('Security Headers', () => {
  let app;

  before(() => {
    // Criar app de teste com configurações de segurança
    app = express();
    
    // Helmet
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
    
    // Session
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
    
    // CSRF
    app.use(csrfProtection);
    
    // Rotas de teste
    app.get('/test', (req, res) => {
      res.json({ message: 'OK' });
    });
    
    app.get('/api/auth/csrf-token', getCsrfToken);
  });

  describe('Helmet Security Headers', () => {
    it('deve incluir X-Content-Type-Options', async () => {
      const response = await request(app).get('/test');
      
      assert.ok(response.headers['x-content-type-options']);
      assert.strictEqual(response.headers['x-content-type-options'], 'nosniff');
    });

    it('deve incluir X-Frame-Options', async () => {
      const response = await request(app).get('/test');
      
      assert.ok(response.headers['x-frame-options']);
      assert.strictEqual(response.headers['x-frame-options'], 'SAMEORIGIN');
    });

    it('deve incluir X-XSS-Protection', async () => {
      const response = await request(app).get('/test');
      
      assert.ok(response.headers['x-xss-protection']);
    });

    it('deve incluir Strict-Transport-Security', async () => {
      const response = await request(app).get('/test');
      
      // Helmet adiciona HSTS por padrão
      assert.ok(response.headers['strict-transport-security']);
    });

    it('deve incluir Content-Security-Policy', async () => {
      const response = await request(app).get('/test');
      
      assert.ok(response.headers['content-security-policy']);
      assert.ok(response.headers['content-security-policy'].includes("default-src 'self'"));
    });
  });

  describe('Session Cookie Configuration', () => {
    it('deve configurar cookie de sessão com httpOnly', async () => {
      const agent = request.agent(app);
      const response = await agent.get('/api/auth/csrf-token');
      
      const cookies = response.headers['set-cookie'];
      assert.ok(cookies);
      
      const sessionCookie = cookies.find(c => c.includes('connect.sid'));
      assert.ok(sessionCookie);
      assert.ok(sessionCookie.includes('HttpOnly'));
    });

    it('deve configurar cookie de sessão com SameSite=Strict', async () => {
      const agent = request.agent(app);
      const response = await agent.get('/api/auth/csrf-token');
      
      const cookies = response.headers['set-cookie'];
      const sessionCookie = cookies.find(c => c.includes('connect.sid'));
      
      assert.ok(sessionCookie.includes('SameSite=Strict'));
    });
  });

  describe('CSRF Protection Active', () => {
    it('deve ter CSRF protection ativo', async () => {
      const agent = request.agent(app);
      
      // Obter token CSRF
      const response = await agent.get('/api/auth/csrf-token');
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.body.csrfToken);
    });
  });
});
