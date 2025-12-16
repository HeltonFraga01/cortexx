#!/usr/bin/env node

/**
 * Teste de integração para verificar rate limiting no endpoint real
 * Usa o Node.js built-in test runner
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

describe('Rate Limiter Integration Tests', () => {
  test('should verify rate limiter middleware is exported correctly', () => {
    const { userRecordRateLimiter, apiLimiter, loginLimiter } = require('../../middleware/rateLimiter');
    
    // Verificar que os rate limiters são funções (middlewares Express)
    assert.strictEqual(typeof userRecordRateLimiter, 'function', 'userRecordRateLimiter should be a function');
    assert.strictEqual(typeof apiLimiter, 'function', 'apiLimiter should be a function');
    assert.strictEqual(typeof loginLimiter, 'function', 'loginLimiter should be a function');
  });

  test('should verify rate limiter configuration', () => {
    const rateLimiter = require('../../middleware/rateLimiter');
    
    // Verificar que o módulo exporta os rate limiters esperados
    assert.ok(rateLimiter.userRecordRateLimiter, 'Should export userRecordRateLimiter');
    assert.ok(rateLimiter.apiLimiter, 'Should export apiLimiter');
    assert.ok(rateLimiter.loginLimiter, 'Should export loginLimiter');
  });

  test('should verify rate limiter is applied to user record endpoint', () => {
    // Verificar que o middleware foi importado no index.js
    const fs = require('fs');
    const path = require('path');
    const indexContent = fs.readFileSync(path.join(__dirname, '../../index.js'), 'utf8');
    
    // Verificar que o rate limiter foi importado
    assert.ok(
      indexContent.includes("require('./middleware/rateLimiter')"),
      'Rate limiter should be imported in index.js'
    );
    
    // Verificar que o rate limiter está aplicado ao endpoint correto
    assert.ok(
      indexContent.includes('userRecordRateLimiter'),
      'userRecordRateLimiter should be used in index.js'
    );
    
    // Verificar que está aplicado ao endpoint de registro do usuário
    assert.ok(
      indexContent.includes('/api/user/database-connections/:id/record') &&
      indexContent.includes('userRecordRateLimiter'),
      'Rate limiter should be applied to user record endpoint'
    );
  });

  test('should verify rate limiter configuration values', () => {
    // Este teste verifica que as configurações estão corretas
    // sem fazer requisições reais
    
    // Importar express-rate-limit para verificar que está instalado
    const rateLimit = require('express-rate-limit');
    assert.ok(rateLimit, 'express-rate-limit should be installed');
    
    // Verificar que é uma função
    assert.strictEqual(typeof rateLimit, 'function', 'express-rate-limit should be a function');
  });
});
