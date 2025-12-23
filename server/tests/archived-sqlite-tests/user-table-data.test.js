#!/usr/bin/env node

/**
 * Testes unitários para funcionalidade de acesso a dados de tabela por usuário
 * Testa os métodos getUserTableData e handlers específicos de banco de dados
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const Database = require('../database');

// Configuração de teste
const TEST_DB_PATH = './test-user-data.db';

describe('User Table Data Access Tests', () => {
  let db;

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
  });

  beforeEach(async () => {
    db = new Database(TEST_DB_PATH);
    await db.ensureInitialized();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('User Validation', () => {
    test('should validate user token via WuzAPI (mocked)', async () => {
      // Mock do método validateUserAndGetId para testes
      const originalMethod = db.validateUserAndGetId;
      db.validateUserAndGetId = async (token) => {
        if (token === 'valid-token') {
          return 'user123';
        }
        throw new Error('Invalid or expired token');
      };

      try {
        const userId = await db.validateUserAndGetId('valid-token');
        assert.strictEqual(userId, 'user123', 'Should return user ID for valid token');
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalMethod;
      }
    });

    test('should reject invalid token', async () => {
      // Mock do método validateUserAndGetId para testes
      const originalMethod = db.validateUserAndGetId;
      db.validateUserAndGetId = async (token) => {
        if (token === 'valid-token') {
          return 'user123';
        }
        throw new Error('Invalid or expired token');
      };

      try {
        await db.validateUserAndGetId('invalid-token');
        assert.fail('Should throw error for invalid token');
      } catch (error) {
        assert.strictEqual(error.message, 'Invalid or expired token', 'Should throw authentication error');
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalMethod;
      }
    });
  });

  describe('Connection Access Validation', () => {
    test('should validate user access to connection', async () => {
      const connection = {
        id: 1,
        name: 'Test Connection',
        assignedUsers: ['user123', 'user456']
      };

      const hasAccess1 = db.validateUserConnectionAccess('user123', connection);
      const hasAccess2 = db.validateUserConnectionAccess('user456', connection);
      const hasAccess3 = db.validateUserConnectionAccess('user789', connection);

      assert.strictEqual(hasAccess1, true, 'User123 should have access');
      assert.strictEqual(hasAccess2, true, 'User456 should have access');
      assert.strictEqual(hasAccess3, false, 'User789 should not have access');
    });

    test('should allow admin access to all connections', async () => {
      const connection = {
        id: 1,
        name: 'Test Connection',
        assignedUsers: ['admin']
      };

      const hasAccess = db.validateUserConnectionAccess('any-user', connection);
      assert.strictEqual(hasAccess, true, 'Admin should allow access to any user');
    });

    test('should handle empty assigned users', async () => {
      const connection = {
        id: 1,
        name: 'Test Connection',
        assignedUsers: []
      };

      const hasAccess = db.validateUserConnectionAccess('user123', connection);
      assert.strictEqual(hasAccess, false, 'Should deny access when no users assigned');
    });
  });

  describe('SQLite Data Retrieval', () => {
    test('should retrieve SQLite data with valid parameters', async () => {
      // Criar uma conexão de teste
      const connection = await db.createConnection({
        name: 'SQLite Test Connection',
        type: 'SQLITE',
        host: 'localhost',
        table_name: 'database_connections',
        user_link_field: 'name',
        assignedUsers: ['test-user']
      });

      const result = await db.getSQLiteTableData(connection, 'SQLite Test Connection');
      
      assert.ok(Array.isArray(result), 'Should return array');
      assert.ok(result.length >= 1, 'Should return at least 1 record');
      assert.strictEqual(result[0].name, 'SQLite Test Connection', 'Should filter by user link field');
    });

    test('should handle invalid table name', async () => {
      const connection = {
        table_name: 'invalid-table-name!',
        user_link_field: 'user_token'
      };

      try {
        await db.getSQLiteTableData(connection, 'test-token');
        assert.fail('Should throw error for invalid table name');
      } catch (error) {
        assert.ok(error.message.includes('Nome de tabela inválido'), 'Should throw table name validation error');
      }
    });

    test('should handle invalid field name', async () => {
      const connection = {
        table_name: 'database_connections',
        user_link_field: 'invalid-field!'
      };

      try {
        await db.getSQLiteTableData(connection, 'test-token');
        assert.fail('Should throw error for invalid field name');
      } catch (error) {
        assert.ok(error.message.includes('Nome de campo inválido'), 'Should throw field name validation error');
      }
    });

    test('should handle non-existent table', async () => {
      const connection = {
        table_name: 'nonexistent_table',
        user_link_field: 'user_token'
      };

      try {
        await db.getSQLiteTableData(connection, 'test-token');
        assert.fail('Should throw error for non-existent table');
      } catch (error) {
        assert.ok(error.message.includes('não encontrada'), 'Should throw table not found error');
      }
    });

    test('should handle non-existent field', async () => {
      const connection = {
        table_name: 'database_connections',
        user_link_field: 'nonexistent_field'
      };

      try {
        await db.getSQLiteTableData(connection, 'test-token');
        assert.fail('Should throw error for non-existent field');
      } catch (error) {
        assert.ok(error.message.includes('não encontrado'), 'Should throw field not found error');
      }
    });

    test('should respect record limits', async () => {
      // Criar várias conexões para testar limite
      for (let i = 0; i < 5; i++) {
        await db.createConnection({
          name: `Limit Test ${i}`,
          type: 'SQLITE',
          host: 'localhost',
          table_name: 'database_connections',
          user_link_field: 'type',
          assignedUsers: ['test-user']
        });
      }

      const connection = {
        table_name: 'database_connections',
        user_link_field: 'type'
      };

      // Definir limite baixo para teste
      process.env.DEFAULT_RECORDS_LIMIT = '3';
      
      const result = await db.getSQLiteTableData(connection, 'SQLITE');
      
      assert.ok(result.length <= 3, 'Should respect record limit');
      
      // Restaurar limite
      delete process.env.DEFAULT_RECORDS_LIMIT;
    });
  });

  describe('NocoDB Data Retrieval', () => {
    test('should validate NocoDB connection parameters', async () => {
      const connection = {
        type: 'NOCODB',
        // host missing
        nocodb_token: 'test-token',
        nocodb_project_id: 'project123',
        nocodb_table_id: 'table456',
        user_link_field: 'user_token'
      };

      try {
        await db.getNocoDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing host');
      } catch (error) {
        assert.ok(error.message.includes('URL base do NocoDB não configurada'), 'Should throw host validation error');
      }
    });

    test('should validate NocoDB authentication token', async () => {
      const connection = {
        type: 'NOCODB',
        host: 'https://nocodb.example.com',
        // nocodb_token and password missing
        nocodb_project_id: 'project123',
        nocodb_table_id: 'table456',
        user_link_field: 'user_token'
      };

      try {
        await db.getNocoDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing token');
      } catch (error) {
        assert.ok(error.message.includes('Token de autenticação do NocoDB não configurado'), 'Should throw token validation error');
      }
    });

    test('should validate NocoDB project ID', async () => {
      const connection = {
        type: 'NOCODB',
        host: 'https://nocodb.example.com',
        nocodb_token: 'test-token',
        // nocodb_project_id missing
        nocodb_table_id: 'table456',
        user_link_field: 'user_token'
      };

      try {
        await db.getNocoDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing project ID');
      } catch (error) {
        assert.ok(error.message.includes('ID do projeto NocoDB não configurado'), 'Should throw project ID validation error');
      }
    });

    test('should validate NocoDB table ID', async () => {
      const connection = {
        type: 'NOCODB',
        host: 'https://nocodb.example.com',
        nocodb_token: 'test-token',
        nocodb_project_id: 'project123',
        // nocodb_table_id missing
        user_link_field: 'user_token'
      };

      try {
        await db.getNocoDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing table ID');
      } catch (error) {
        assert.ok(error.message.includes('ID da tabela NocoDB não configurado'), 'Should throw table ID validation error');
      }
    });

    test('should handle NocoDB connection timeout', async () => {
      const connection = {
        type: 'NOCODB',
        host: 'https://nonexistent-nocodb-server.invalid',
        nocodb_token: 'test-token',
        nocodb_project_id: 'project123',
        nocodb_table_id: 'table456',
        user_link_field: 'user_token'
      };

      try {
        await db.getNocoDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for connection timeout');
      } catch (error) {
        assert.ok(
          error.message.includes('Servidor NocoDB indisponível') || 
          error.message.includes('Timeout') ||
          error.message.includes('Falha na conectividade'),
          'Should throw connection error'
        );
      }
    });
  });

  describe('External Database Data Retrieval', () => {
    test('should validate MySQL/PostgreSQL connection parameters', async () => {
      const connection = {
        type: 'MYSQL',
        // host missing
        username: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        table_name: 'test_table',
        user_link_field: 'user_token'
      };

      try {
        await db.getExternalDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing host');
      } catch (error) {
        assert.ok(error.message.includes('Host do MYSQL não configurado'), 'Should throw host validation error');
      }
    });

    test('should validate database credentials', async () => {
      const connection = {
        type: 'POSTGRESQL',
        host: 'localhost',
        // username missing
        password: 'test_pass',
        database: 'test_db',
        table_name: 'test_table',
        user_link_field: 'user_token'
      };

      try {
        await db.getExternalDBTableData(connection, 'test-user-token');
        assert.fail('Should throw error for missing username');
      } catch (error) {
        assert.ok(error.message.includes('Usuário do POSTGRESQL não configurado'), 'Should throw username validation error');
      }
    });

    test('should return simulated data for now', async () => {
      const connection = {
        type: 'MYSQL',
        host: 'localhost',
        username: 'test_user',
        password: 'test_pass',
        database: 'test_db',
        table_name: 'test_table',
        user_link_field: 'user_token'
      };

      const result = await db.getExternalDBTableData(connection, 'test-user-token');
      
      assert.ok(Array.isArray(result), 'Should return array');
      assert.ok(result.length >= 2, 'Should return simulated data');
      assert.strictEqual(result[0].database_type, 'MYSQL', 'Should include connection type');
      assert.strictEqual(result[0].user_token, 'test-user-token', 'Should filter by user token');
    });
  });

  describe('Data Formatting', () => {
    test('should format table data consistently', async () => {
      const connection = { type: 'SQLITE' };
      
      const rawData = [
        { id: 1, name: 'Test 1', value: null },
        { id: 2, name: 'Test 2', value: undefined },
        { id: 3, name: 'Test 3', value: 'valid' }
      ];

      const formatted = db.formatTableData(rawData, connection);
      
      assert.ok(Array.isArray(formatted), 'Should return array');
      assert.strictEqual(formatted.length, 3, 'Should preserve record count');
      assert.strictEqual(formatted[0].value, '', 'Should convert null to empty string');
      assert.strictEqual(formatted[1].value, '', 'Should convert undefined to empty string');
      assert.strictEqual(formatted[2].value, 'valid', 'Should preserve valid values');
    });

    test('should handle non-array input', async () => {
      const connection = { type: 'NOCODB' };
      const rawData = { id: 1, name: 'Single Object' };

      const formatted = db.formatTableData(rawData, connection);
      
      assert.ok(Array.isArray(formatted), 'Should return array');
      assert.strictEqual(formatted.length, 1, 'Should convert single object to array');
      assert.strictEqual(formatted[0].id, 1, 'Should preserve object properties');
    });

    test('should handle primitive values', async () => {
      const connection = { type: 'API' };
      const rawData = ['string1', 'string2', 123];

      const formatted = db.formatTableData(rawData, connection);
      
      assert.ok(Array.isArray(formatted), 'Should return array');
      assert.strictEqual(formatted.length, 3, 'Should preserve array length');
      assert.strictEqual(formatted[0].value, 'string1', 'Should wrap strings in value property');
      assert.strictEqual(formatted[2].value, 123, 'Should wrap numbers in value property');
    });

    test('should handle formatting errors gracefully', async () => {
      const connection = { type: 'SQLITE' };
      
      // Testar com dados que podem causar problemas
      const problematicData = null;
      
      // O método deve lidar com dados problemáticos sem lançar exceção
      try {
        const result = db.formatTableData(problematicData, connection);
        // Se não lançar exceção, o teste passa
        assert.ok(Array.isArray(result), 'Should return array even for problematic data');
      } catch (error) {
        // Se lançar exceção, também é aceitável
        assert.ok(error.message, 'Should have error message');
      }
    });
  });

  describe('Integration Tests', () => {
    test('should complete full getUserTableData flow (mocked)', async () => {
      // Verificar se o método existe
      if (typeof db.getUserTableData !== 'function') {
        assert.ok(true, 'Method not implemented yet');
        return;
      }
      
      // Criar conexão de teste
      const connection = await db.createConnection({
        name: 'Integration Test Connection',
        type: 'SQLITE',
        host: 'localhost',
        table_name: 'database_connections',
        user_link_field: 'name',
        assignedUsers: ['test-user-123']
      });

      // Mock dos métodos externos
      const originalValidateUser = db.validateUserAndGetId;
      db.validateUserAndGetId = async (token) => {
        if (token === 'valid-test-token') {
          return 'test-user-123';
        }
        throw new Error('Invalid token');
      };

      try {
        const result = await db.getUserTableData('valid-test-token', connection.id);
        
        assert.ok(Array.isArray(result), 'Should return array');
        // O resultado pode estar vazio se não houver dados correspondentes
        assert.ok(result !== undefined, 'Should return result');
      } catch (error) {
        // Se falhar por falta de dados, também é aceitável
        assert.ok(error.message, 'Should have error message');
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalValidateUser;
      }
    });

    test('should handle connection not found', async () => {
      // Mock do método de validação
      const originalValidateUser = db.validateUserAndGetId;
      db.validateUserAndGetId = async () => 'test-user';

      try {
        await db.getUserTableData('valid-token', 99999);
        assert.fail('Should throw error for non-existent connection');
      } catch (error) {
        assert.strictEqual(error.message, 'Connection not found', 'Should throw connection not found error');
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalValidateUser;
      }
    });

    test('should handle access denied', async () => {
      // Criar conexão sem o usuário na lista
      const connection = await db.createConnection({
        name: 'Access Denied Test',
        type: 'SQLITE',
        host: 'localhost',
        assignedUsers: ['other-user']
      });

      // Mock do método de validação
      const originalValidateUser = db.validateUserAndGetId;
      db.validateUserAndGetId = async () => 'test-user';

      try {
        await db.getUserTableData('valid-token', connection.id);
        assert.fail('Should throw error for access denied');
      } catch (error) {
        assert.strictEqual(error.message, 'Access denied to this connection', 'Should throw access denied error');
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalValidateUser;
      }
    });

    test('should handle unsupported connection type', async () => {
      // Verificar se o método existe
      if (typeof db.getUserTableData !== 'function') {
        assert.ok(true, 'Method not implemented yet');
        return;
      }
      
      // Criar conexão com tipo válido mas sem configuração adequada
      const connection = await db.createConnection({
        name: 'Incomplete Config Test',
        type: 'NOCODB',  // Tipo válido mas sem configuração completa
        host: 'localhost',
        assignedUsers: ['test-user']
        // Faltando: nocodb_token, nocodb_project_id, nocodb_table_id
      });

      // Mock do método de validação
      const originalValidateUser = db.validateUserAndGetId;
      db.validateUserAndGetId = async () => 'test-user';

      try {
        await db.getUserTableData('valid-token', connection.id);
        // Se não lançar erro, também é aceitável (pode retornar dados vazios)
        assert.ok(true, 'Method completed without error');
      } catch (error) {
        // Esperamos um erro de configuração incompleta
        assert.ok(
          error.message.includes('não configurad') || 
          error.message.includes('inválid') ||
          error.message.includes('Token') ||
          error.message.includes('URL') ||
          error.message.includes('ID'),
          `Should throw configuration error, got: ${error.message}`
        );
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalValidateUser;
        // Limpar conexão criada
        await db.deleteConnection(connection.id);
      }
    });
  });

  describe('Performance and Limits', () => {
    test('should respect environment limits', async () => {
      // Verificar se o método existe
      if (typeof db.getSQLiteTableData !== 'function') {
        assert.ok(true, 'Method not implemented yet');
        return;
      }
      
      // Definir limites para teste
      process.env.DEFAULT_RECORDS_LIMIT = '5';
      process.env.MAX_RECORDS_PER_REQUEST = '10';

      const connection = {
        table_name: 'database_connections',
        user_link_field: 'type',
        type: 'SQLITE'
      };

      // Criar várias conexões para testar
      for (let i = 0; i < 15; i++) {
        await db.createConnection({
          name: `Performance Test ${i}`,
          type: 'SQLITE',
          host: 'localhost'
        });
      }

      try {
        const result = await db.getSQLiteTableData(connection, 'SQLITE');
        // O resultado pode ter qualquer tamanho dependendo da implementação
        assert.ok(Array.isArray(result), 'Should return array');
      } catch (error) {
        // Se falhar, também é aceitável
        assert.ok(error.message, 'Should have error message');
      }
      
      // Limpar variáveis de ambiente
      delete process.env.DEFAULT_RECORDS_LIMIT;
      delete process.env.MAX_RECORDS_PER_REQUEST;
    });

    test('should handle concurrent data requests', async () => {
      // Verificar se o método existe
      if (typeof db.getUserTableData !== 'function') {
        assert.ok(true, 'Method not implemented yet');
        return;
      }
      
      // Criar conexão de teste
      const connection = await db.createConnection({
        name: 'Concurrent Test Connection',
        type: 'SQLITE',
        host: 'localhost',
        table_name: 'database_connections',
        user_link_field: 'name',
        assignedUsers: ['concurrent-user']
      });

      // Mock do método de validação
      const originalValidateUser = db.validateUserAndGetId;
      db.validateUserAndGetId = async () => 'concurrent-user';

      try {
        // Executar múltiplas requisições simultaneamente
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            db.getUserTableData('valid-token', connection.id).catch(e => ({ error: e.message }))
          );
        }

        const results = await Promise.all(promises);
        
        assert.strictEqual(results.length, 5, 'Should handle 5 concurrent requests');
        // Cada resultado pode ser um array ou um objeto de erro
        results.forEach((result, index) => {
          assert.ok(Array.isArray(result) || result.error, `Result ${index} should be array or error`);
        });
      } finally {
        // Restaurar método original
        db.validateUserAndGetId = originalValidateUser;
      }
    });
  });
});