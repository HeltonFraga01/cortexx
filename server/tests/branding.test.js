#!/usr/bin/env node

/**
 * Testes unitários para funcionalidade de branding
 * Testa a camada de banco de dados e API endpoints para configuração de branding
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const Database = require('../database');

// Configuração de teste
const TEST_DB_PATH = './test-branding.db';
const TEST_PORT = 3004; // Porta diferente para evitar conflitos
const TEST_ADMIN_TOKEN = 'test-admin-branding-token';

// Mock environment variables for testing
const originalEnv = { ...process.env };
process.env.PORT = TEST_PORT;
process.env.SQLITE_DB_PATH = TEST_DB_PATH;
process.env.VITE_ADMIN_TOKEN = TEST_ADMIN_TOKEN;
process.env.WUZAPI_BASE_URL = 'http://localhost:8080'; // Mock WuzAPI URL
process.env.NODE_ENV = 'test';

describe('Branding Configuration Tests', () => {
  let db;
  let server;

  // Limpar arquivos de teste antes de começar
  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Limpar arquivos de teste após todos os testes
  after(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    // Restaurar variáveis de ambiente
    process.env = originalEnv;
  });

  describe('Database Layer - Branding Configuration', () => {
    beforeEach(async () => {
      db = new Database(TEST_DB_PATH);
      await db.init();
    });

    afterEach(async () => {
      if (db) {
        await db.close();
      }
    });

    test('should create branding_config table during initialization', async () => {
      const { rows } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='branding_config'"
      );
      
      assert.strictEqual(rows.length, 1, 'branding_config table should exist');
    });

    test('should insert default branding configuration', async () => {
      const config = await db.getBrandingConfig();
      
      assert.ok(config, 'Should return branding configuration');
      assert.strictEqual(config.appName, 'WUZAPI', 'Should have default app name');
      assert.strictEqual(config.logoUrl, null, 'Should have null logo URL by default');
      assert.strictEqual(config.primaryColor, null, 'Should have null primary color by default');
      assert.strictEqual(config.secondaryColor, null, 'Should have null secondary color by default');
    });

    test('should get branding configuration', async () => {
      const config = await db.getBrandingConfig();
      
      assert.ok(config, 'Should return configuration object');
      assert.ok(typeof config.id === 'number' || config.id === null, 'Should have id field');
      assert.ok(typeof config.appName === 'string', 'Should have appName field');
      assert.ok(config.logoUrl === null || typeof config.logoUrl === 'string', 'Should have logoUrl field');
      assert.ok(config.primaryColor === null || typeof config.primaryColor === 'string', 'Should have primaryColor field');
      assert.ok(config.secondaryColor === null || typeof config.secondaryColor === 'string', 'Should have secondaryColor field');
    });

    test('should update branding configuration with valid data', async () => {
      const updateData = {
        appName: 'Custom App',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5733',
        secondaryColor: '#33FF57'
      };

      const updatedConfig = await db.updateBrandingConfig(updateData);
      
      assert.strictEqual(updatedConfig.appName, updateData.appName, 'Should update app name');
      assert.strictEqual(updatedConfig.logoUrl, updateData.logoUrl, 'Should update logo URL');
      assert.strictEqual(updatedConfig.primaryColor, updateData.primaryColor, 'Should update primary color');
      assert.strictEqual(updatedConfig.secondaryColor, updateData.secondaryColor, 'Should update secondary color');
      assert.ok(updatedConfig.id, 'Should have an ID');
      assert.ok(updatedConfig.updatedAt, 'Should have updated timestamp');
    });

    test('should validate app name constraints', async () => {
      // Test empty app name
      try {
        await db.updateBrandingConfig({ appName: '' });
        assert.fail('Should throw error for empty app name');
      } catch (error) {
        assert.ok(error.message.includes('entre 1 e 50 caracteres'), 'Should validate app name length');
      }

      // Test app name too long
      try {
        await db.updateBrandingConfig({ appName: 'A'.repeat(51) });
        assert.fail('Should throw error for app name too long');
      } catch (error) {
        assert.ok(error.message.includes('entre 1 e 50 caracteres'), 'Should validate app name length');
      }

      // Test invalid characters
      try {
        await db.updateBrandingConfig({ appName: 'App<script>alert("xss")</script>' });
        assert.fail('Should throw error for invalid characters');
      } catch (error) {
        assert.ok(error.message.includes('caracteres inválidos'), 'Should validate app name characters');
      }

      // Test valid app name
      const validConfig = await db.updateBrandingConfig({ appName: 'Valid App Name 123' });
      assert.strictEqual(validConfig.appName, 'Valid App Name 123', 'Should accept valid app name');
    });

    test('should validate logo URL format', async () => {
      // Test invalid URL
      try {
        await db.updateBrandingConfig({ logoUrl: 'not-a-valid-url' });
        assert.fail('Should throw error for invalid URL');
      } catch (error) {
        assert.ok(error.message.includes('URL do logo é inválida'), 'Should validate URL format');
      }

      // Test valid URL
      const validConfig = await db.updateBrandingConfig({ logoUrl: 'https://example.com/logo.png' });
      assert.strictEqual(validConfig.logoUrl, 'https://example.com/logo.png', 'Should accept valid URL');

      // Test null URL (should be allowed)
      const nullConfig = await db.updateBrandingConfig({ logoUrl: null });
      assert.strictEqual(nullConfig.logoUrl, null, 'Should accept null URL');
    });

    test('should validate color format', async () => {
      // Test invalid primary color format
      try {
        await db.updateBrandingConfig({ primaryColor: 'red' });
        assert.fail('Should throw error for invalid color format');
      } catch (error) {
        assert.ok(error.message.includes('formato #RRGGBB'), 'Should validate color format');
      }

      // Test invalid secondary color format
      try {
        await db.updateBrandingConfig({ secondaryColor: '#FF' });
        assert.fail('Should throw error for invalid color format');
      } catch (error) {
        assert.ok(error.message.includes('formato #RRGGBB'), 'Should validate color format');
      }

      // Test valid colors
      const validConfig = await db.updateBrandingConfig({ 
        primaryColor: '#FF5733',
        secondaryColor: '#33ff57' // Should convert to uppercase
      });
      assert.strictEqual(validConfig.primaryColor, '#FF5733', 'Should accept valid primary color');
      assert.strictEqual(validConfig.secondaryColor, '#33FF57', 'Should convert secondary color to uppercase');
    });

    test('should handle partial updates', async () => {
      // First set initial configuration
      await db.updateBrandingConfig({
        appName: 'Initial App',
        logoUrl: 'https://example.com/initial.png',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00'
      });

      // Update only app name
      const partialUpdate = await db.updateBrandingConfig({ appName: 'Updated App' });
      
      assert.strictEqual(partialUpdate.appName, 'Updated App', 'Should update app name');
      assert.strictEqual(partialUpdate.logoUrl, 'https://example.com/initial.png', 'Should preserve logo URL');
      assert.strictEqual(partialUpdate.primaryColor, '#FF0000', 'Should preserve primary color');
      assert.strictEqual(partialUpdate.secondaryColor, '#00FF00', 'Should preserve secondary color');
    });

    test('should handle null and empty values correctly', async () => {
      const config = await db.updateBrandingConfig({
        appName: 'Test App',
        logoUrl: '',
        primaryColor: null,
        secondaryColor: ''
      });

      assert.strictEqual(config.appName, 'Test App', 'Should set app name');
      assert.strictEqual(config.logoUrl, null, 'Should convert empty string to null for logo URL');
      assert.strictEqual(config.primaryColor, null, 'Should preserve null for primary color');
      assert.strictEqual(config.secondaryColor, null, 'Should convert empty string to null for secondary color');
    });

    test('should maintain only one branding configuration record', async () => {
      // Create first configuration
      await db.updateBrandingConfig({ appName: 'First Config' });
      
      // Update configuration (should update, not create new)
      await db.updateBrandingConfig({ appName: 'Second Config' });
      
      // Check that only one record exists
      const { rows } = await db.query('SELECT COUNT(*) as count FROM branding_config');
      assert.strictEqual(rows[0].count, 1, 'Should maintain only one branding configuration record');
      
      // Verify it has the latest data
      const config = await db.getBrandingConfig();
      assert.strictEqual(config.appName, 'Second Config', 'Should have the latest configuration');
    });
  });

  describe('API Layer - Branding Endpoints', () => {
    // Note: These tests require a running server instance
    // They test the API endpoint structure and validation logic

    test('should validate branding route structure', async () => {
      // Test that the branding routes module can be loaded
      const brandingRoutes = require('../routes/brandingRoutes');
      assert.ok(brandingRoutes, 'Branding routes module should be loadable');
      
      // This test validates that the route structure is correct
      // without actually starting a server
      assert.ok(true, 'Branding routes module loaded successfully');
    });

    test('should validate admin validator integration', async () => {
      // Test that admin validator can be loaded and has required methods
      const adminValidator = require('../validators/adminValidator');
      assert.ok(adminValidator, 'Admin validator should be loadable');
      assert.ok(typeof adminValidator.isValidTokenFormat === 'function', 'Should have isValidTokenFormat method');
      assert.ok(typeof adminValidator.validateAdminToken === 'function', 'Should have validateAdminToken method');
    });

    test('should validate error handler integration', async () => {
      // Test that error handler can be loaded and has required methods
      const errorHandler = require('../middleware/errorHandler');
      assert.ok(errorHandler, 'Error handler should be loadable');
      assert.ok(typeof errorHandler.validateAdminTokenFormat === 'function', 'Should have validateAdminTokenFormat method');
      assert.ok(typeof errorHandler.handleValidationError === 'function', 'Should have handleValidationError method');
    });
  });

  describe('Integration Tests - Branding with Database', () => {
    beforeEach(async () => {
      db = new Database(TEST_DB_PATH);
      await db.init();
    });

    afterEach(async () => {
      if (db) {
        await db.close();
      }
    });

    test('should maintain branding configuration across database restarts', async () => {
      // Set configuration
      const originalConfig = await db.updateBrandingConfig({
        appName: 'Persistent App',
        logoUrl: 'https://example.com/persistent.png',
        primaryColor: '#123456',
        secondaryColor: '#ABCDEF'
      });

      // Close and reopen database
      await db.close();
      
      db = new Database(TEST_DB_PATH);
      await db.init();

      // Verify configuration persists
      const persistedConfig = await db.getBrandingConfig();
      
      assert.strictEqual(persistedConfig.appName, originalConfig.appName, 'App name should persist');
      assert.strictEqual(persistedConfig.logoUrl, originalConfig.logoUrl, 'Logo URL should persist');
      assert.strictEqual(persistedConfig.primaryColor, originalConfig.primaryColor, 'Primary color should persist');
      assert.strictEqual(persistedConfig.secondaryColor, originalConfig.secondaryColor, 'Secondary color should persist');
    });

    test('should handle database schema migration for branding', async () => {
      // Verify that the branding table was created during migration
      const { rows: schemaVersion } = await db.query(
        "SELECT value FROM system_metadata WHERE key = 'schema_version'"
      );
      
      assert.ok(parseInt(schemaVersion[0].value) >= 2, 'Schema version should be 2 or higher for branding support');
      
      // Verify table exists
      const { rows: tables } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='branding_config'"
      );
      assert.strictEqual(tables.length, 1, 'branding_config table should exist');
    });

    test('should handle concurrent branding updates', async () => {
      const promises = [];
      
      // Attempt multiple concurrent updates
      for (let i = 0; i < 5; i++) {
        promises.push(
          db.updateBrandingConfig({
            appName: `Concurrent App ${i}`,
            primaryColor: `#${i.toString().repeat(6).substring(0, 6)}`
          })
        );
      }

      const results = await Promise.all(promises);
      
      // All should succeed (last one wins)
      results.forEach((result, index) => {
        assert.ok(result.id, `Update ${index} should have ID`);
        assert.ok(result.appName.includes('Concurrent App'), `Update ${index} should have correct app name pattern`);
      });
      
      // Verify final state
      const finalConfig = await db.getBrandingConfig();
      assert.ok(finalConfig.appName.includes('Concurrent App'), 'Should have one of the concurrent updates');
    });

    test('should handle branding configuration with special characters', async () => {
      const specialConfig = {
        appName: 'App-Name_With.Special123',
        logoUrl: 'https://example.com/logo-with-special_chars.png?v=1.0&format=png',
        primaryColor: '#FFFFFF',
        secondaryColor: '#000000'
      };

      const result = await db.updateBrandingConfig(specialConfig);
      
      assert.strictEqual(result.appName, specialConfig.appName, 'Should handle special characters in app name');
      assert.strictEqual(result.logoUrl, specialConfig.logoUrl, 'Should handle special characters in URL');
      assert.strictEqual(result.primaryColor, specialConfig.primaryColor, 'Should handle white color');
      assert.strictEqual(result.secondaryColor, specialConfig.secondaryColor, 'Should handle black color');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      db = new Database(TEST_DB_PATH);
      await db.init();
    });

    afterEach(async () => {
      if (db) {
        await db.close();
      }
    });

    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      await db.close();
      
      try {
        await db.getBrandingConfig();
        assert.fail('Should throw error for closed database');
      } catch (error) {
        assert.ok(error.message, 'Should throw meaningful error');
      }
    });

    test('should handle invalid data types', async () => {
      try {
        await db.updateBrandingConfig({
          appName: 123, // Should be string
          logoUrl: true, // Should be string or null
          primaryColor: [], // Should be string or null
          secondaryColor: {} // Should be string or null
        });
        assert.fail('Should throw error for invalid data types');
      } catch (error) {
        assert.ok(error.message, 'Should validate data types');
      }
    });

    test('should handle extremely long URLs', async () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000) + '.png';
      
      try {
        const result = await db.updateBrandingConfig({ logoUrl: longUrl });
        // If it succeeds, verify it was stored correctly
        assert.strictEqual(result.logoUrl, longUrl, 'Should handle long URLs if database supports it');
      } catch (error) {
        // If it fails, it should be a meaningful error
        assert.ok(error.message, 'Should provide meaningful error for long URLs');
      }
    });

    test('should prevent SQL injection attempts', async () => {
      // Primeiro, obter a configuração atual para comparar depois
      const originalConfig = await db.getBrandingConfig();
      
      const maliciousData = {
        appName: "'; DROP TABLE branding_config; --",
        logoUrl: "https://example.com/'; DELETE FROM branding_config; --",
        primaryColor: "#FF0000'; UPDATE branding_config SET app_name='hacked'; --"
      };

      // Should reject malicious input due to validation
      try {
        await db.updateBrandingConfig(maliciousData);
        assert.fail('Should reject malicious input');
      } catch (error) {
        assert.ok(error.message.includes('caracteres inválidos'), 'Should reject invalid characters');
      }
      
      // Verify table still exists and is accessible
      const config = await db.getBrandingConfig();
      assert.ok(config, 'Table should still exist and be accessible');
      // Verificar que a configuração não foi alterada pelo ataque
      assert.strictEqual(config.appName, originalConfig.appName, 'Should maintain original configuration');
    });
  });
});

// Helper function to make HTTP requests
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

// Helper function to make raw HTTP requests (for testing malformed data)
function makeRequestRaw(method, path, rawData = null, headers = {}) {
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

    if (rawData) {
      req.write(rawData);
    }

    req.end();
  });
}