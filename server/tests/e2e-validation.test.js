#!/usr/bin/env node

/**
 * End-to-End Validation Tests for SQLite Backend
 * Tests database operations and validation logic
 * 
 * NOTE: These tests focus on database layer validation
 * without requiring a running HTTP server
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Import application components
const Database = require('../database');

// Test configuration
const TEST_DB_PATH = './test-e2e-validation.db';

// Mock environment variables for testing
process.env.SQLITE_DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

describe('End-to-End Database Validation with SQLite', () => {
  let db;

  // Clean up test files before starting
  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Clean up test files after all tests
  after(async () => {
    if (db) {
      await db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  describe('Database Initialization', () => {
    test('should initialize SQLite database successfully', async () => {
      db = new Database(TEST_DB_PATH);
      await db.init();
      
      assert.ok(fs.existsSync(TEST_DB_PATH), 'Database file should be created');
      assert.ok(db.isInitialized, 'Database should be initialized');
      
      // Verify database structure
      const { rows: tables } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      
      const tableNames = tables.map(row => row.name);
      assert.ok(tableNames.includes('database_connections'), 'Should have database_connections table');
      assert.ok(tableNames.includes('system_metadata'), 'Should have system_metadata table');
    });
  });

  describe('Database Connection Management', () => {
    let testConnectionId;

    test('should create database connection', async () => {
      const connectionData = {
        name: 'Test API Connection',
        type: 'API',
        host: 'localhost',
        port: 3000,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        table_name: 'test_table',
        status: 'connected',
        assignedUsers: ['user1', 'user2'],
        fieldMappings: [
          { columnName: 'id', label: 'ID', visible: false, editable: false },
          { columnName: 'name', label: 'Name', visible: true, editable: true }
        ]
      };

      const result = await db.createConnection(connectionData);
      
      assert.ok(result.id, 'Should return connection ID');
      assert.strictEqual(result.name, connectionData.name, 'Should have correct name');
      
      testConnectionId = result.id;
    });

    test('should get all database connections', async () => {
      const connections = await db.getAllConnections();
      
      assert.ok(Array.isArray(connections), 'Should return array of connections');
      assert.ok(connections.length > 0, 'Should have at least one connection');
      
      // Verify JSON data is properly parsed
      const connection = connections.find(c => c.id === testConnectionId);
      assert.ok(connection, 'Should find test connection');
      assert.ok(Array.isArray(connection.assignedUsers), 'assignedUsers should be array');
      assert.ok(Array.isArray(connection.fieldMappings), 'fieldMappings should be array');
    });

    test('should get specific database connection by ID', async () => {
      const connection = await db.getConnectionById(testConnectionId);
      
      assert.ok(connection, 'Should return connection');
      assert.strictEqual(connection.id, testConnectionId, 'Should return correct connection');
      assert.strictEqual(connection.name, 'Test API Connection', 'Should have correct name');
    });

    test('should update database connection', async () => {
      const updateData = {
        name: 'Updated Test Connection',
        type: 'MYSQL',
        host: 'updated-host',
        port: 3306,
        status: 'disconnected',
        assignedUsers: ['user1', 'user2', 'user3'],
        fieldMappings: [
          { columnName: 'id', label: 'ID', visible: false, editable: false },
          { columnName: 'name', label: 'Name', visible: true, editable: true },
          { columnName: 'email', label: 'Email', visible: true, editable: true }
        ]
      };

      await db.updateConnection(testConnectionId, updateData);
      
      // Verify update
      const updatedConnection = await db.getConnectionById(testConnectionId);
      
      assert.strictEqual(updatedConnection.name, updateData.name, 'Name should be updated');
      assert.strictEqual(updatedConnection.type, updateData.type, 'Type should be updated');
      assert.deepStrictEqual(updatedConnection.assignedUsers, updateData.assignedUsers, 'Assigned users should be updated');
      assert.strictEqual(updatedConnection.fieldMappings.length, 3, 'Should have 3 field mappings');
    });

    test('should update connection status', async () => {
      const result = await db.updateConnectionStatus(testConnectionId, 'connected');
      
      assert.strictEqual(result.status, 'connected', 'Status should be updated');
      
      // Verify status update
      const connection = await db.getConnectionById(testConnectionId);
      assert.strictEqual(connection.status, 'connected', 'Status should be persisted');
    });

    test('should handle non-existent connection ID gracefully', async () => {
      const connection = await db.getConnectionById(99999);
      assert.strictEqual(connection, null, 'Should return null for non-existent ID');
    });

    test('should delete database connection', async () => {
      const result = await db.deleteConnection(testConnectionId);
      
      assert.strictEqual(result.changes, 1, 'Should delete one record');
      
      // Verify deletion
      const connection = await db.getConnectionById(testConnectionId);
      assert.strictEqual(connection, null, 'Connection should be deleted');
    });
  });

  describe('JSON Data Handling', () => {
    test('should validate JSON data handling in SQLite', async () => {
      // Create connection with complex JSON data
      const complexData = {
        name: 'JSON Validation Test',
        type: 'API',
        host: 'localhost',
        assignedUsers: ['user1', 'user2', 'user3'],
        fieldMappings: [
          { 
            columnName: 'complex_field', 
            label: 'Complex Field', 
            visible: true, 
            editable: false,
            metadata: { type: 'string', required: true, maxLength: 255 }
          }
        ]
      };

      const created = await db.createConnection(complexData);
      
      // Retrieve and verify JSON data integrity
      const retrievedConnection = await db.getConnectionById(created.id);
      
      assert.deepStrictEqual(retrievedConnection.assignedUsers, complexData.assignedUsers, 'Should preserve assigned users');
      assert.strictEqual(retrievedConnection.fieldMappings.length, 1, 'Should preserve field mappings count');
      assert.deepStrictEqual(retrievedConnection.fieldMappings[0].metadata, complexData.fieldMappings[0].metadata, 'Should preserve nested JSON objects');
      
      // Clean up
      await db.deleteConnection(created.id);
    });

    test('should handle concurrent database operations', async () => {
      const promises = [];
      
      // Create multiple connections simultaneously
      for (let i = 0; i < 5; i++) {
        promises.push(
          db.createConnection({
            name: `Concurrent Test ${i}`,
            type: 'API',
            host: `host${i}`,
            assignedUsers: [`user${i}`]
          })
        );
      }

      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach((result, index) => {
        assert.ok(result.id, `Connection ${index} should be created successfully`);
      });
      
      // Clean up created connections
      for (const result of results) {
        await db.deleteConnection(result.id);
      }
    });
  });

  describe('Branding Configuration', () => {
    test('should get default branding configuration', async () => {
      const config = await db.getBrandingConfig();
      
      assert.ok(config, 'Should return branding configuration');
      assert.strictEqual(config.appName, 'WUZAPI', 'Should have default app name');
    });

    test('should update branding configuration', async () => {
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
    });

    test('should validate branding data', async () => {
      // Test invalid app name
      try {
        await db.updateBrandingConfig({ appName: '' });
        assert.fail('Should throw error for empty app name');
      } catch (error) {
        assert.ok(error.message.includes('entre 1 e 50 caracteres'), 'Should validate app name length');
      }

      // Test invalid URL
      try {
        await db.updateBrandingConfig({ logoUrl: 'not-a-valid-url' });
        assert.fail('Should throw error for invalid URL');
      } catch (error) {
        assert.ok(error.message.includes('URL do logo é inválida'), 'Should validate URL format');
      }

      // Test invalid color format
      try {
        await db.updateBrandingConfig({ primaryColor: 'red' });
        assert.fail('Should throw error for invalid color format');
      } catch (error) {
        assert.ok(error.message.includes('formato #RRGGBB'), 'Should validate color format');
      }
    });
  });

  describe('Database Statistics', () => {
    test('should provide database statistics', async () => {
      const stats = await db.getDatabaseStats();
      
      assert.ok(typeof stats.pageCount === 'number', 'Should return page count');
      assert.ok(typeof stats.pageSize === 'number', 'Should return page size');
      assert.ok(typeof stats.databaseSize === 'number', 'Should return database size');
      assert.ok(stats.pageCount > 0, 'Should have pages');
      assert.ok(stats.pageSize > 0, 'Should have page size');
    });
  });
});
