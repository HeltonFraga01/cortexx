#!/usr/bin/env node

/**
 * Testes básicos para as rotas de deleção administrativas
 * Verifica se as rotas existem e respondem adequadamente
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');

// Configurar variáveis de ambiente para teste
process.env.WUZAPI_BASE_URL = 'http://localhost:8080';
process.env.REQUEST_TIMEOUT = '5000';
process.env.NODE_ENV = 'test';

describe('Admin Deletion Routes Tests', () => {
  
  describe('Route Registration', () => {
    test('should register DELETE /users/:userId route', () => {
      const adminRoutes = require('../routes/adminRoutes');
      
      // Verificar se o router foi criado
      assert.ok(adminRoutes, 'Admin routes should be exported');
      assert.ok(typeof adminRoutes === 'function', 'Admin routes should be a router function');
      
      // Verificar se as rotas estão registradas (através da stack)
      const routes = adminRoutes.stack || [];
      const deleteRoutes = routes.filter(layer => 
        layer.route && 
        layer.route.methods.delete && 
        layer.route.path.includes(':userId')
      );
      
      assert.ok(deleteRoutes.length >= 1, 'Should have at least one DELETE route with :userId parameter');
    });

    test('should register DELETE /users/:userId/full route', () => {
      const adminRoutes = require('../routes/adminRoutes');
      
      const routes = adminRoutes.stack || [];
      const fullDeleteRoutes = routes.filter(layer => 
        layer.route && 
        layer.route.methods.delete && 
        layer.route.path.includes(':userId/full')
      );
      
      assert.ok(fullDeleteRoutes.length >= 1, 'Should have DELETE route for full user deletion');
    });
  });

  describe('Route Structure', () => {
    test('should have proper middleware chain for deletion routes', () => {
      const adminRoutes = require('../routes/adminRoutes');
      
      const routes = adminRoutes.stack || [];
      const deleteRoutes = routes.filter(layer => 
        layer.route && 
        layer.route.methods.delete
      );
      
      deleteRoutes.forEach(route => {
        // Verificar se a rota tem pelo menos um handler
        assert.ok(route.route.stack.length > 0, 'DELETE routes should have handlers');
        
        // Verificar se o path está correto
        const path = route.route.path;
        assert.ok(
          path.includes(':userId'), 
          `DELETE route path should include :userId parameter, got: ${path}`
        );
      });
    });
  });
});