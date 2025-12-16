#!/usr/bin/env node

/**
 * Testes unitários para UserRecordService
 * Usa o Node.js built-in test runner
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const Database = require('../../database');
const UserRecordService = require('../../services/UserRecordService');

// Configuração de teste
const TEST_DB_PATH = './test-user-record-service.db';

describe('UserRecordService Tests', () => {
  let db;
  let service;
  let testConnectionId;
  const testUserToken = 'test-token-12345';

  // Limpar arquivos de teste antes de começar
  before(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Limpar arquivos de teste após todos os testes
  after(async () => {
    if (db && db.db) {
      await db.close();
    }
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (err) {
        // Ignorar erros
      }
    }
  });

  // Configurar banco de dados antes de cada teste
  beforeEach(async () => {
    // Limpar arquivo de teste se existir
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
    service = new UserRecordService(db);

    // Criar uma conexão de teste diretamente no banco (sem disparar teste automático)
    const sql = `
      INSERT INTO database_connections (
        name, type, host, port, database_name, username, password, 
        table_name, status, assigned_users, user_link_field, field_mappings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      'Test Connection',
      'SQLITE',
      'localhost',
      0,
      'test.db',
      '',
      '',
      'test_table',
      'connected',
      JSON.stringify([testUserToken]),
      'user_token',
      JSON.stringify([])
    ];
    const result = await db.query(sql, values);
    testConnectionId = result.lastID;
  });

  // Limpar banco de dados após cada teste
  afterEach(async () => {
    if (db && db.db) {
      await db.close();
    }
    db = null;
    
    // Aguardar um pouco para garantir que o arquivo foi liberado
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (fs.existsSync(TEST_DB_PATH)) {
      try {
        fs.unlinkSync(TEST_DB_PATH);
      } catch (err) {
        // Ignorar erros ao deletar arquivo de teste
      }
    }
  });

  describe('hasAccess()', () => {
    test('should return true when user token is in assignedUsers', async () => {
      const connection = {
        id: 1,
        assignedUsers: [testUserToken, 'other-token']
      };

      const hasAccess = service.hasAccess(connection, testUserToken);
      assert.strictEqual(hasAccess, true, 'User should have access');
    });

    test('should return false when user token is not in assignedUsers', async () => {
      const connection = {
        id: 1,
        assignedUsers: ['other-token-1', 'other-token-2']
      };

      const hasAccess = service.hasAccess(connection, testUserToken);
      assert.strictEqual(hasAccess, false, 'User should not have access');
    });

    test('should return false when assignedUsers is null or undefined', async () => {
      const connection1 = { id: 1, assignedUsers: null };
      const connection2 = { id: 2 };

      assert.strictEqual(service.hasAccess(connection1, testUserToken), false);
      assert.strictEqual(service.hasAccess(connection2, testUserToken), false);
    });
  });

  describe('getUserRecord() - Error Handling', () => {
    test('should throw CONNECTION_NOT_FOUND when connection does not exist', async () => {
      const nonExistentId = 99999;

      await assert.rejects(
        async () => {
          await service.getUserRecord(nonExistentId, testUserToken);
        },
        (error) => {
          assert.strictEqual(error.code, 'CONNECTION_NOT_FOUND');
          return true;
        }
      );
    });

    test('should throw UNAUTHORIZED when user does not have access', async () => {
      const unauthorizedToken = 'unauthorized-token';

      await assert.rejects(
        async () => {
          await service.getUserRecord(testConnectionId, unauthorizedToken);
        },
        (error) => {
          assert.strictEqual(error.code, 'UNAUTHORIZED');
          return true;
        }
      );
    });

    test('should throw INVALID_CONFIGURATION when user_link_field is not configured', async () => {
      // Criar conexão sem user_link_field diretamente no banco
      const sql = `
        INSERT INTO database_connections (
          name, type, host, port, database_name, table_name, status, assigned_users, user_link_field, field_mappings
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const values = [
        'No Link Field Connection',
        'SQLITE',
        'localhost',
        0,
        'test.db',
        'test_table',
        'connected',
        JSON.stringify([testUserToken]),
        null,
        JSON.stringify([])
      ];
      const result = await db.query(sql, values);

      await assert.rejects(
        async () => {
          await service.getUserRecord(result.lastID, testUserToken);
        },
        (error) => {
          assert.strictEqual(error.code, 'INVALID_CONFIGURATION');
          return true;
        }
      );
    });
  });

  describe('fetchSQLiteRecord()', () => {
    test('should find record when it exists', async () => {
      // Criar tabela de teste
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_token TEXT NOT NULL,
          name TEXT,
          email TEXT
        )
      `);

      // Inserir registro de teste
      await db.query(`
        INSERT INTO test_users (user_token, name, email)
        VALUES (?, ?, ?)
      `, [testUserToken, 'Test User', 'test@example.com']);

      const connection = {
        table_name: 'test_users',
        user_link_field: 'user_token'
      };

      const record = await service.fetchSQLiteRecord(connection, 'user_token', testUserToken);

      assert.ok(record, 'Record should be found');
      assert.strictEqual(record.user_token, testUserToken);
      assert.strictEqual(record.name, 'Test User');
    });

    test('should return null when record does not exist', async () => {
      // Criar tabela de teste
      await db.query(`
        CREATE TABLE IF NOT EXISTS test_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_token TEXT NOT NULL,
          name TEXT
        )
      `);

      const connection = {
        table_name: 'test_users',
        user_link_field: 'user_token'
      };

      const record = await service.fetchSQLiteRecord(connection, 'user_token', 'non-existent-token');

      assert.strictEqual(record, null, 'Should return null when record not found');
    });

    test('should throw error when table does not exist', async () => {
      const connection = {
        table_name: 'non_existent_table',
        user_link_field: 'user_token'
      };

      await assert.rejects(
        async () => {
          await service.fetchSQLiteRecord(connection, 'user_token', testUserToken);
        },
        (error) => {
          assert.match(error.message, /Table .* not found/i);
          return true;
        }
      );
    });

    test('should prevent SQL injection in table name', async () => {
      const connection = {
        table_name: 'test_users; DROP TABLE test_users;--',
        user_link_field: 'user_token'
      };

      await assert.rejects(
        async () => {
          await service.fetchSQLiteRecord(connection, 'user_token', testUserToken);
        },
        (error) => {
          assert.match(error.message, /Invalid table name/i);
          return true;
        }
      );
    });
  });

  describe('fetchNocoDBRecord() - Validation', () => {
    test('should throw error when host is not configured', async () => {
      const connection = {
        host: null,
        nocodb_token: 'test-token',
        nocodb_project_id: 'project1',
        nocodb_table_id: 'table1'
      };

      await assert.rejects(
        async () => {
          await service.fetchNocoDBRecord(connection, 'user_token', testUserToken);
        },
        (error) => {
          assert.match(error.message, /host not configured/i);
          return true;
        }
      );
    });

    test('should throw error when authentication token is not configured', async () => {
      const connection = {
        host: 'https://nocodb.example.com',
        nocodb_token: null,
        password: null,
        nocodb_project_id: 'project1',
        nocodb_table_id: 'table1'
      };

      await assert.rejects(
        async () => {
          await service.fetchNocoDBRecord(connection, 'user_token', testUserToken);
        },
        (error) => {
          assert.match(error.message, /authentication token not configured/i);
          return true;
        }
      );
    });
  });

  describe('fetchSQLRecord() - Validation', () => {
    test('should return simulated record for MySQL', async () => {
      const connection = {
        type: 'MYSQL',
        host: 'localhost',
        username: 'user',
        password: 'pass',
        database: 'testdb',
        table_name: 'users'
      };

      const record = await service.fetchSQLRecord(connection, 'user_token', testUserToken);

      assert.ok(record, 'Should return simulated record');
      assert.strictEqual(record.user_token, testUserToken);
      assert.strictEqual(record.database_type, 'MYSQL');
    });
  });

  describe('Integration - getUserRecord() with SQLite', () => {
    test('should successfully retrieve user record from SQLite', async () => {
      // Criar tabela de teste
      await db.query(`
        CREATE TABLE IF NOT EXISTS app_users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          api_token TEXT NOT NULL,
          username TEXT,
          email TEXT
        )
      `);

      // Inserir registro de teste
      await db.query(`
        INSERT INTO app_users (api_token, username, email)
        VALUES (?, ?, ?)
      `, [testUserToken, 'John Doe', 'john@example.com']);

      // Atualizar conexão para usar a tabela correta
      await db.query(`
        UPDATE database_connections 
        SET table_name = ?, user_link_field = ?
        WHERE id = ?
      `, ['app_users', 'api_token', testConnectionId]);

      const record = await service.getUserRecord(testConnectionId, testUserToken);

      assert.ok(record, 'Record should be found');
      assert.strictEqual(record.api_token, testUserToken);
      assert.strictEqual(record.username, 'John Doe');
    });
  });
});
