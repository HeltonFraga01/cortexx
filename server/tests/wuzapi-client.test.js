#!/usr/bin/env node

/**
 * Testes unitários para o WuzAPIClient
 * Verifica se os métodos de deleção existem e têm as assinaturas corretas
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

// Configurar variáveis de ambiente para teste
process.env.WUZAPI_BASE_URL = 'http://localhost:8080'; // Mock WuzAPI URL
process.env.REQUEST_TIMEOUT = '5000';
process.env.NODE_ENV = 'test';

const wuzapiClient = require('../utils/wuzapiClient');

describe('WuzAPIClient Deletion Methods Tests', () => {
  
  describe('Method Existence and Signatures', () => {
    test('should have deleteUser method', () => {
      assert.ok(typeof wuzapiClient.deleteUser === 'function', 'deleteUser should be a function');
      assert.strictEqual(wuzapiClient.deleteUser.length, 2, 'deleteUser should accept 2 parameters (userId, adminToken)');
    });

    test('should have deleteUserFull method', () => {
      assert.ok(typeof wuzapiClient.deleteUserFull === 'function', 'deleteUserFull should be a function');
      assert.strictEqual(wuzapiClient.deleteUserFull.length, 2, 'deleteUserFull should accept 2 parameters (userId, adminToken)');
    });

    test('should have delete method', () => {
      assert.ok(typeof wuzapiClient.delete === 'function', 'delete should be a function');
      assert.strictEqual(wuzapiClient.delete.length, 1, 'delete should accept 1 required parameter (endpoint) and 1 optional (options)');
    });
  });

  describe('Method Return Format', () => {
    test('deleteUser should return a Promise', () => {
      const result = wuzapiClient.deleteUser('test-user', 'test-token');
      assert.ok(result instanceof Promise, 'deleteUser should return a Promise');
      
      // Clean up the promise to avoid unhandled rejection
      result.catch(() => {});
    });

    test('deleteUserFull should return a Promise', () => {
      const result = wuzapiClient.deleteUserFull('test-user', 'test-token');
      assert.ok(result instanceof Promise, 'deleteUserFull should return a Promise');
      
      // Clean up the promise to avoid unhandled rejection
      result.catch(() => {});
    });
  });

  describe('Configuration', () => {
    test('should have correct configuration', () => {
      const config = wuzapiClient.getConfig();
      assert.ok(config, 'Should return configuration object');
      assert.ok(config.baseURL, 'Should have baseURL configured');
      assert.ok(config.timeout, 'Should have timeout configured');
      assert.strictEqual(config.baseURL, 'http://localhost:8080', 'Should use test base URL');
      assert.strictEqual(config.timeout, 5000, 'Should use test timeout');
    });
  });
});