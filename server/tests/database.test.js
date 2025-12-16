#!/usr/bin/env node

/**
 * Testes unitários para a camada de banco de dados SQLite
 * Usa o Node.js built-in test runner
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Configuração de teste
const TEST_DB_PATH = path.join(__dirname, '../test-database.db');

// Limpar arquivos de teste
function cleanupTestFiles() {
  const files = [TEST_DB_PATH, TEST_DB_PATH + '-wal', TEST_DB_PATH + '-shm'];
  files.forEach(file => {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (e) { /* ignore */ }
  });
}

describe('SQLite Database Layer Tests', () => {
  let db;
  let Database;

  before(async () => {
    cleanupTestFiles();
    Database = require('../database');
  });

  after(async () => {
    try {
      if (db && db.isInitialized) {
        await db.close();
      }
    } catch (e) {
      // Ignore close errors
    }
    cleanupTestFiles();
  });

  describe('Database Initialization', () => {
    test('should create new database successfully', async () => {
      db = new Database(TEST_DB_PATH);
      await db.init();
      
      assert.ok(fs.existsSync(TEST_DB_PATH), 'Database file should be created');
      assert.ok(db.isInitialized, 'Database should be marked as initialized');
    });

    test('should create required tables', async () => {
      const { rows } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('system_metadata', 'database_connections', 'branding_config')"
      );
      
      assert.ok(rows.length >= 3, 'Should create required tables');
    });

    test('should set schema version to 2', async () => {
      const { rows } = await db.query(
        "SELECT value FROM system_metadata WHERE key = 'schema_version'"
      );
      
      assert.strictEqual(rows.length, 1, 'Schema version should be set');
      assert.strictEqual(rows[0].value, '2', 'Schema version should be 2');
    });
  });

  describe('CRUD Operations', () => {
    test('should create connection successfully', async () => {
      const connectionData = {
        name: 'Test Connection',
        type: 'API',
        host: 'localhost',
        port: 3000,
        assignedUsers: ['user1', 'user2'],
        fieldMappings: [
          { columnName: 'id', label: 'ID', visible: false, editable: false }
        ]
      };

      const result = await db.createConnection(connectionData);
      
      assert.ok(result.id, 'Should return connection ID');
      assert.strictEqual(result.name, connectionData.name, 'Should preserve name');
      assert.strictEqual(result.status, 'disconnected', 'Should have initial status as disconnected');
    });

    test('should get connection by ID', async () => {
      const connectionData = {
        name: 'Test Get Connection',
        type: 'MYSQL',
        host: 'localhost',
        assignedUsers: ['user3']
      };

      const created = await db.createConnection(connectionData);
      const found = await db.getConnectionById(created.id);
      
      assert.ok(found, 'Should find connection');
      assert.strictEqual(found.id, created.id, 'Should have correct ID');
      assert.strictEqual(found.name, connectionData.name, 'Should have correct name');
    });

    test('should return null for non-existent connection', async () => {
      const found = await db.getConnectionById(99999);
      assert.strictEqual(found, null, 'Should return null for non-existent ID');
    });

    test('should get all connections', async () => {
      const connections = await db.getAllConnections();
      
      assert.ok(Array.isArray(connections), 'Should return array');
      assert.ok(connections.length >= 2, 'Should have at least 2 connections');
    });

    test('should update connection', async () => {
      const original = await db.createConnection({
        name: 'Original Name',
        type: 'API',
        host: 'original-host',
        assignedUsers: ['user1']
      });

      const updateData = {
        name: 'Updated Name',
        type: 'MYSQL',
        host: 'updated-host',
        assignedUsers: ['user1', 'user2']
      };

      await db.updateConnection(original.id, updateData);
      const updated = await db.getConnectionById(original.id);
      
      assert.strictEqual(updated.name, updateData.name, 'Name should be updated');
      assert.strictEqual(updated.type, updateData.type, 'Type should be updated');
    });

    test('should delete connection', async () => {
      const connection = await db.createConnection({
        name: 'To Delete',
        type: 'API',
        host: 'localhost'
      });

      await db.deleteConnection(connection.id);
      const found = await db.getConnectionById(connection.id);
      
      assert.strictEqual(found, null, 'Connection should be deleted');
    });
  });

  describe('getUserConnections', () => {
    test('should return connections for user token', async () => {
      const userToken = 'test-user-token-unique-' + Date.now();
      
      await db.createConnection({
        name: 'User Connection 1',
        type: 'API',
        host: 'localhost',
        assignedUsers: [userToken]
      });

      await db.createConnection({
        name: 'User Connection 2',
        type: 'MYSQL',
        host: 'localhost',
        assignedUsers: [userToken, 'other-user']
      });

      const connections = await db.getUserConnections(userToken);
      
      assert.ok(Array.isArray(connections), 'Should return array');
      assert.strictEqual(connections.length, 2, 'Should find exactly 2 connections');
      assert.ok(connections.every(c => 
        c.assignedUsers && c.assignedUsers.includes(userToken)
      ), 'All connections should be assigned to user');
    });

    test('should return empty array for user with no connections', async () => {
      const connections = await db.getUserConnections('non-existent-user-token-' + Date.now());
      
      assert.ok(Array.isArray(connections), 'Should return array');
      assert.strictEqual(connections.length, 0, 'Should be empty');
    });
  });

  describe('JSON Data Handling', () => {
    test('should handle valid JSON data', async () => {
      const connection = await db.createConnection({
        name: 'JSON Test',
        type: 'API',
        host: 'localhost',
        assignedUsers: ['user1', 'user2'],
        fieldMappings: [{ columnName: 'test', label: 'Test', visible: true }]
      });

      const found = await db.getConnectionById(connection.id);
      
      assert.ok(Array.isArray(found.assignedUsers), 'assignedUsers should be array');
      assert.ok(Array.isArray(found.fieldMappings), 'fieldMappings should be array');
    });

    test('should handle null and undefined values', async () => {
      const connection = await db.createConnection({
        name: 'Null Test',
        type: 'API',
        host: 'localhost',
        assignedUsers: null,
        fieldMappings: undefined
      });

      const found = await db.getConnectionById(connection.id);
      
      assert.ok(Array.isArray(found.assignedUsers), 'assignedUsers should default to array');
      assert.ok(Array.isArray(found.fieldMappings), 'fieldMappings should default to array');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid SQL queries', async () => {
      try {
        await db.query('INVALID SQL QUERY');
        assert.fail('Should throw error for invalid SQL');
      } catch (error) {
        assert.ok(error.message.includes('syntax error') || error.message.includes('SQLITE'), 
          'Should throw SQL error');
      }
    });
  });
});
