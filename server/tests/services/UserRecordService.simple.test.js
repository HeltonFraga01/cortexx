#!/usr/bin/env node

/**
 * Testes simplificados para UserRecordService
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const Database = require('../../database');
const UserRecordService = require('../../services/UserRecordService');

const TEST_DB_PATH = './test-user-record-simple.db';

// Limpar antes de começar
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

describe('UserRecordService - Simple Tests', () => {
  
  test('hasAccess should return true when user has access', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);
    
    const connection = {
      id: 1,
      assignedUsers: ['token123', 'token456']
    };

    const result = service.hasAccess(connection, 'token123');
    assert.strictEqual(result, true);
    
    await db.close();
  });

  test('hasAccess should return false when user does not have access', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);
    
    const connection = {
      id: 1,
      assignedUsers: ['token123']
    };

    const result = service.hasAccess(connection, 'token999');
    assert.strictEqual(result, false);
    
    await db.close();
  });

  test('getUserRecord should throw CONNECTION_NOT_FOUND for non-existent connection', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    await assert.rejects(
      async () => {
        await service.getUserRecord(99999, 'test-token');
      },
      (error) => {
        return error.code === 'CONNECTION_NOT_FOUND';
      }
    );
    
    await db.close();
  });

  test('fetchSQLiteRecord should find existing record', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    // Criar tabela e inserir dados
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        token TEXT,
        name TEXT
      )
    `);
    
    await db.query(`
      INSERT INTO users (token, name) VALUES (?, ?)
    `, ['mytoken', 'John']);

    const connection = {
      table_name: 'users',
      user_link_field: 'token'
    };

    const record = await service.fetchSQLiteRecord(connection, 'token', 'mytoken');
    
    assert.ok(record);
    assert.strictEqual(record.name, 'John');
    
    await db.close();
  });

  test('fetchSQLiteRecord should return null for non-existent record', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    await db.query(`
      CREATE TABLE IF NOT EXISTS users2 (
        id INTEGER PRIMARY KEY,
        token TEXT,
        name TEXT
      )
    `);

    const connection = {
      table_name: 'users2',
      user_link_field: 'token'
    };

    const record = await service.fetchSQLiteRecord(connection, 'token', 'nonexistent');
    
    assert.strictEqual(record, null);
    
    await db.close();
  });

  test('fetchSQLiteRecord should prevent SQL injection', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    const connection = {
      table_name: 'users; DROP TABLE users;--',
      user_link_field: 'token'
    };

    await assert.rejects(
      async () => {
        await service.fetchSQLiteRecord(connection, 'token', 'test');
      },
      (error) => {
        return error.message.includes('Invalid table name');
      }
    );
    
    await db.close();
  });

  test('fetchNocoDBRecord should validate required fields', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    const connection = {
      host: null,
      nocodb_token: 'token',
      nocodb_project_id: 'proj',
      nocodb_table_id: 'table'
    };

    await assert.rejects(
      async () => {
        await service.fetchNocoDBRecord(connection, 'field', 'token');
      },
      (error) => {
        return error.message.includes('host not configured');
      }
    );
    
    await db.close();
  });

  test('fetchSQLRecord should return simulated data for MySQL', async () => {
    const db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    const service = new UserRecordService(db);

    const connection = {
      type: 'MYSQL',
      host: 'localhost',
      username: 'user',
      password: 'pass',
      database: 'db',
      table_name: 'table'
    };

    const record = await service.fetchSQLRecord(connection, 'token', 'mytoken');
    
    assert.ok(record);
    assert.strictEqual(record.database_type, 'MYSQL');
    
    await db.close();
  });
});

// Limpar após testes
setTimeout(() => {
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
    } catch (err) {
      // Ignorar
    }
  }
}, 1000);
