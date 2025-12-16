#!/usr/bin/env node

/**
 * Testes de integração com SQLite
 * Testa operações completas de banco de dados com cenários reais
 */

const { test, describe, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Configuração de teste
const TEST_DB_PATH = './test-sqlite-integration.db';
const TEST_BACKUP_PATH = './test-sqlite-backup.db';

// Configurar variáveis de ambiente
process.env.NODE_ENV = 'test';
process.env.SQLITE_DB_PATH = TEST_DB_PATH;

describe('SQLite Integration Tests', () => {
  let db;

  before(async () => {
    // Limpar arquivos de teste
    [TEST_DB_PATH, TEST_BACKUP_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  after(async () => {
    if (db) {
      await db.close();
    }
    
    // Limpar arquivos de teste
    [TEST_DB_PATH, TEST_BACKUP_PATH].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  });

  beforeEach(async () => {
    const Database = require('../../database');
    db = new Database(TEST_DB_PATH);
    await db.init();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('Database Initialization and Schema', () => {
    test('should create all required tables', async () => {
      const { rows: tables } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(row => row.name);
      
      assert.ok(tableNames.includes('database_connections'), 'Should create database_connections table');
      assert.ok(tableNames.includes('system_metadata'), 'Should create system_metadata table');
      assert.ok(tableNames.includes('branding_config'), 'Should create branding_config table');
    });

    test('should create all required indexes', async () => {
      const { rows: indexes } = await db.query(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name"
      );
      
      const indexNames = indexes.map(row => row.name);
      
      // Verificar índices que realmente existem no schema atual
      assert.ok(indexNames.includes('idx_database_connections_type'), 'Should create type index');
      assert.ok(indexNames.includes('idx_database_connections_status'), 'Should create status index');
      assert.ok(indexNames.includes('idx_database_connections_created_at'), 'Should create created_at index');
      assert.ok(indexNames.includes('idx_database_connections_name'), 'Should create name index');
    });

    test('should set correct schema version', async () => {
      const { rows } = await db.query(
        "SELECT value FROM system_metadata WHERE key = 'schema_version'"
      );
      
      assert.strictEqual(rows.length, 1, 'Should have schema version record');
      assert.ok(parseInt(rows[0].value) >= 2, 'Schema version should be 2 or higher');
    });

    test('should have correct table structures', async () => {
      // Verificar que as tabelas existem e têm colunas
      const { rows: connColumns } = await db.query("PRAGMA table_info(database_connections)");
      assert.ok(connColumns.length > 0, 'database_connections should have columns');
      
      // Verificar estrutura da tabela branding_config
      const { rows: brandColumns } = await db.query("PRAGMA table_info(branding_config)");
      assert.ok(brandColumns.length > 0, 'branding_config should have columns');
    });
  });

  describe('Connection Management Integration', () => {
    test('should handle complete connection lifecycle', async () => {
      // Criar conexão
      const connectionData = {
        name: 'Integration Test Connection',
        type: 'API',
        host: 'localhost',
        port: 3000,
        database: 'test_db',
        username: 'test_user',
        password: 'test_pass',
        table_name: 'test_table',
        status: 'disconnected',
        assignedUsers: ['user1', 'user2'],
        fieldMappings: [
          { columnName: 'id', label: 'ID', visible: false, editable: false },
          { columnName: 'name', label: 'Name', visible: true, editable: true }
        ]
      };

      const created = await db.createConnection(connectionData);
      assert.ok(created.id, 'Should create connection with ID');
      
      // Buscar conexão
      const found = await db.getConnectionById(created.id);
      assert.ok(found, 'Should find created connection');
      assert.strictEqual(found.name, connectionData.name, 'Should preserve connection name');
      assert.deepStrictEqual(found.assignedUsers, connectionData.assignedUsers, 'Should preserve assigned users');
      
      // Atualizar conexão
      const updateData = {
        name: 'Updated Integration Connection',
        status: 'connected',
        assignedUsers: ['user1', 'user2', 'user3'],
        fieldMappings: [
          { columnName: 'id', label: 'ID', visible: false, editable: false },
          { columnName: 'name', label: 'Name', visible: true, editable: true },
          { columnName: 'email', label: 'Email', visible: true, editable: true }
        ]
      };

      await db.updateConnection(created.id, updateData);
      
      const updated = await db.getConnectionById(created.id);
      assert.strictEqual(updated.name, updateData.name, 'Should update connection name');
      assert.strictEqual(updated.status, updateData.status, 'Should update connection status');
      assert.deepStrictEqual(updated.assignedUsers, updateData.assignedUsers, 'Should update assigned users');
      assert.strictEqual(updated.fieldMappings.length, 3, 'Should update field mappings');
      
      // Atualizar apenas status
      const statusResult = await db.updateConnectionStatus(created.id, 'disconnected');
      assert.strictEqual(statusResult.status, 'disconnected', 'Should update status');
      
      const statusUpdated = await db.getConnectionById(created.id);
      assert.strictEqual(statusUpdated.status, 'disconnected', 'Should persist status update');
      
      // Deletar conexão
      const deleteResult = await db.deleteConnection(created.id);
      assert.strictEqual(deleteResult.changes, 1, 'Should delete one record');
      
      const deleted = await db.getConnectionById(created.id);
      assert.strictEqual(deleted, null, 'Should not find deleted connection');
    });

    test('should handle multiple connections with different types', async () => {
      const connections = [
        {
          name: 'SQLite Connection',
          type: 'SQLITE',
          host: 'localhost',
          table_name: 'sqlite_table',
          assignedUsers: ['user1']
        },
        {
          name: 'MySQL Connection',
          type: 'MYSQL',
          host: 'mysql.example.com',
          port: 3306,
          database: 'mysql_db',
          username: 'mysql_user',
          assignedUsers: ['user2']
        },
        {
          name: 'NocoDB Connection',
          type: 'NOCODB',
          host: 'https://nocodb.example.com',
          nocodb_token: 'nocodb-token',
          nocodb_project_id: 'project-123',
          nocodb_table_id: 'table-456',
          assignedUsers: ['user3']
        },
        {
          name: 'API Connection',
          type: 'API',
          host: 'api.example.com',
          assignedUsers: ['user4']
        }
      ];

      const createdIds = [];
      
      // Criar todas as conexões
      for (const conn of connections) {
        const created = await db.createConnection(conn);
        createdIds.push(created.id);
        assert.ok(created.id, `Should create ${conn.type} connection`);
      }

      // Buscar todas as conexões
      const allConnections = await db.getAllConnections();
      assert.ok(allConnections.length >= 4, 'Should have at least 4 connections');
      
      // Verificar tipos específicos
      const sqliteConn = allConnections.find(c => c.type === 'SQLITE');
      const mysqlConn = allConnections.find(c => c.type === 'MYSQL');
      const nocodbConn = allConnections.find(c => c.type === 'NOCODB');
      const apiConn = allConnections.find(c => c.type === 'API');
      
      assert.ok(sqliteConn, 'Should find SQLite connection');
      assert.ok(mysqlConn, 'Should find MySQL connection');
      assert.ok(nocodbConn, 'Should find NocoDB connection');
      assert.ok(apiConn, 'Should find API connection');
      
      // Verificar campos específicos por tipo
      assert.strictEqual(mysqlConn.port, 3306, 'MySQL connection should have port');
      assert.strictEqual(mysqlConn.database, 'mysql_db', 'MySQL connection should have database');
      assert.strictEqual(nocodbConn.nocodb_token, 'nocodb-token', 'NocoDB connection should have token');
      // Buscar a conexão SQLite específica que criamos
      const ourSqliteConn = allConnections.find(c => c.type === 'SQLITE' && c.name === 'SQLite Connection');
      assert.ok(ourSqliteConn, 'Should find our SQLite connection');
      assert.strictEqual(ourSqliteConn.table_name, 'sqlite_table', 'SQLite connection should have table name');
      
      // Limpar conexões criadas
      for (const id of createdIds) {
        await db.deleteConnection(id);
      }
    });

    test('should handle concurrent connection operations', async () => {
      const promises = [];
      
      // Criar 10 conexões simultaneamente
      for (let i = 0; i < 10; i++) {
        promises.push(
          db.createConnection({
            name: `Concurrent Connection ${i}`,
            type: 'API',
            host: `host${i}.example.com`,
            assignedUsers: [`user${i}`],
            fieldMappings: [
              { columnName: `field${i}`, label: `Field ${i}`, visible: true, editable: true }
            ]
          })
        );
      }

      const results = await Promise.all(promises);
      
      // Verificar se todas foram criadas
      results.forEach((result, index) => {
        assert.ok(result.id, `Connection ${index} should have ID`);
        assert.strictEqual(result.name, `Concurrent Connection ${index}`, `Connection ${index} should have correct name`);
      });

      // Verificar integridade dos dados
      const allConnections = await db.getAllConnections();
      const concurrentConnections = allConnections.filter(c => c.name.startsWith('Concurrent Connection'));
      
      assert.strictEqual(concurrentConnections.length, 10, 'Should have 10 concurrent connections');
      
      // Limpar conexões criadas
      for (const result of results) {
        await db.deleteConnection(result.id);
      }
    });
  });

  describe('Branding Configuration Integration', () => {
    test('should handle complete branding lifecycle', async () => {
      // Obter configuração inicial
      const initial = await db.getBrandingConfig();
      assert.strictEqual(initial.appName, 'WUZAPI', 'Should have default app name');
      
      // Atualizar configuração
      const updateData = {
        appName: 'Custom WUZAPI Manager',
        logoUrl: 'https://example.com/custom-logo.png',
        primaryColor: '#FF5733',
        secondaryColor: '#33FF57'
      };

      const updated = await db.updateBrandingConfig(updateData);
      assert.strictEqual(updated.appName, updateData.appName, 'Should update app name');
      assert.strictEqual(updated.logoUrl, updateData.logoUrl, 'Should update logo URL');
      assert.strictEqual(updated.primaryColor, updateData.primaryColor, 'Should update primary color');
      assert.strictEqual(updated.secondaryColor, updateData.secondaryColor, 'Should update secondary color');
      
      // Verificar persistência
      const persisted = await db.getBrandingConfig();
      assert.strictEqual(persisted.appName, updateData.appName, 'Should persist app name');
      assert.strictEqual(persisted.logoUrl, updateData.logoUrl, 'Should persist logo URL');
      assert.strictEqual(persisted.primaryColor, updateData.primaryColor, 'Should persist primary color');
      assert.strictEqual(persisted.secondaryColor, updateData.secondaryColor, 'Should persist secondary color');
      
      // Atualização parcial
      const partialUpdate = { appName: 'Partially Updated App' };
      const partialResult = await db.updateBrandingConfig(partialUpdate);
      
      assert.strictEqual(partialResult.appName, partialUpdate.appName, 'Should update app name');
      assert.strictEqual(partialResult.logoUrl, updateData.logoUrl, 'Should preserve logo URL');
      assert.strictEqual(partialResult.primaryColor, updateData.primaryColor, 'Should preserve primary color');
      assert.strictEqual(partialResult.secondaryColor, updateData.secondaryColor, 'Should preserve secondary color');
    });

    test('should validate branding data integrity', async () => {
      // Testar validação de nome da aplicação
      try {
        await db.updateBrandingConfig({ appName: '' });
        assert.fail('Should reject empty app name');
      } catch (error) {
        assert.ok(error.message.includes('entre 1 e 50 caracteres'), 'Should validate app name length');
      }

      // Testar validação de URL
      try {
        await db.updateBrandingConfig({ logoUrl: 'invalid-url' });
        assert.fail('Should reject invalid URL');
      } catch (error) {
        assert.ok(error.message.includes('URL do logo é inválida'), 'Should validate URL format');
      }

      // Testar validação de cor
      try {
        await db.updateBrandingConfig({ primaryColor: 'red' });
        assert.fail('Should reject invalid color format');
      } catch (error) {
        assert.ok(error.message.includes('formato #RRGGBB'), 'Should validate color format');
      }

      // Testar dados válidos
      const validData = {
        appName: 'Valid App Name',
        logoUrl: 'https://example.com/logo.png',
        primaryColor: '#FF5733',
        secondaryColor: '#33FF57'
      };

      const result = await db.updateBrandingConfig(validData);
      assert.ok(result, 'Should accept valid data');
    });
  });

  describe('JSON Data Handling Integration', () => {
    test('should handle complex JSON structures', async () => {
      const complexFieldMappings = [
        {
          columnName: 'user_profile',
          label: 'User Profile',
          visible: true,
          editable: false,
          metadata: {
            type: 'object',
            properties: {
              name: { type: 'string', required: true },
              email: { type: 'string', format: 'email' },
              preferences: {
                type: 'object',
                properties: {
                  theme: { type: 'string', enum: ['light', 'dark'] },
                  notifications: { type: 'boolean' }
                }
              }
            }
          },
          validation: {
            rules: [
              { field: 'name', required: true, minLength: 2 },
              { field: 'email', pattern: '^[^@]+@[^@]+\\.[^@]+$' }
            ]
          }
        },
        {
          columnName: 'tags',
          label: 'Tags',
          visible: true,
          editable: true,
          metadata: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 10
          }
        }
      ];

      const connection = await db.createConnection({
        name: 'Complex JSON Test',
        type: 'API',
        host: 'localhost',
        assignedUsers: ['user1', 'user2'],
        fieldMappings: complexFieldMappings
      });

      const retrieved = await db.getConnectionById(connection.id);
      
      // Verificar que os campos principais foram preservados
      assert.ok(Array.isArray(retrieved.fieldMappings), 'fieldMappings should be array');
      assert.strictEqual(retrieved.fieldMappings.length, 2, 'Should have 2 field mappings');
      assert.strictEqual(retrieved.fieldMappings[0].columnName, 'user_profile', 'Should preserve columnName');
      assert.strictEqual(retrieved.fieldMappings[0].label, 'User Profile', 'Should preserve label');
      assert.ok(retrieved.fieldMappings[0].metadata, 'Should preserve metadata object');
      assert.ok(retrieved.fieldMappings[0].metadata.properties, 'Should preserve nested properties');
      
      await db.deleteConnection(connection.id);
    });

    test('should handle JSON migration scenarios', async () => {
      // Inserir dados com JSON "corrompido" diretamente
      await db.query(
        `INSERT INTO database_connections (name, type, host, assigned_users, field_mappings) 
         VALUES (?, ?, ?, ?, ?)`,
        ['Migration Test', 'API', 'localhost', 'invalid json', 'also invalid']
      );

      // Executar migração
      const migrationResult = await db.migrateExistingJSONData();
      
      assert.ok(migrationResult.total >= 1, 'Should report migrated records');
      assert.ok(migrationResult.migrated >= 1, 'Should migrate at least one record');
      
      // Verificar se os dados foram corrigidos
      const connections = await db.getAllConnections();
      const migratedConnection = connections.find(c => c.name === 'Migration Test');
      
      assert.ok(migratedConnection, 'Should find migrated connection');
      assert.ok(Array.isArray(migratedConnection.assignedUsers), 'Should convert invalid JSON to array');
      assert.ok(Array.isArray(migratedConnection.fieldMappings), 'Should convert invalid JSON to array');
      
      await db.deleteConnection(migratedConnection.id);
    });
  });

  describe('Database Performance and Reliability', () => {
    test('should handle large datasets efficiently', async () => {
      const startTime = Date.now();
      const connections = [];
      
      // Criar 100 conexões
      for (let i = 0; i < 100; i++) {
        const connection = await db.createConnection({
          name: `Performance Test ${i}`,
          type: i % 4 === 0 ? 'SQLITE' : i % 4 === 1 ? 'MYSQL' : i % 4 === 2 ? 'NOCODB' : 'API',
          host: `host${i}.example.com`,
          assignedUsers: [`user${i}`, `user${i + 1}`],
          fieldMappings: Array.from({ length: 5 }, (_, j) => ({
            columnName: `field_${i}_${j}`,
            label: `Field ${i}-${j}`,
            visible: j % 2 === 0,
            editable: j % 3 === 0
          }))
        });
        connections.push(connection.id);
      }
      
      const creationTime = Date.now() - startTime;
      
      // Buscar todas as conexões
      const retrievalStart = Date.now();
      const allConnections = await db.getAllConnections();
      const retrievalTime = Date.now() - retrievalStart;
      
      assert.ok(allConnections.length >= 100, 'Should retrieve all connections');
      assert.ok(creationTime < 10000, `Creation should be reasonably fast (${creationTime}ms)`);
      assert.ok(retrievalTime < 1000, `Retrieval should be fast (${retrievalTime}ms)`);
      
      // Limpar dados de teste
      for (const id of connections) {
        await db.deleteConnection(id);
      }
    });

    test('should maintain data integrity under stress', async () => {
      const promises = [];
      const connectionIds = [];
      
      // Operações simultâneas: criar, atualizar, buscar
      for (let i = 0; i < 20; i++) {
        promises.push(
          db.createConnection({
            name: `Stress Test ${i}`,
            type: 'API',
            host: `host${i}`,
            assignedUsers: [`user${i}`]
          }).then(conn => {
            connectionIds.push(conn.id);
            return conn;
          })
        );
      }

      const createdConnections = await Promise.all(promises);
      
      // Operações de atualização simultâneas
      const updatePromises = createdConnections.map((conn, i) => 
        db.updateConnection(conn.id, {
          name: `Updated Stress Test ${i}`,
          status: i % 2 === 0 ? 'connected' : 'disconnected'
        })
      );

      await Promise.all(updatePromises);
      
      // Verificar integridade
      const finalConnections = await db.getAllConnections();
      const stressConnections = finalConnections.filter(c => c.name.includes('Stress Test'));
      
      assert.strictEqual(stressConnections.length, 20, 'Should maintain all connections');
      
      stressConnections.forEach((conn, i) => {
        assert.ok(conn.name.includes('Updated'), 'All connections should be updated');
        assert.ok(['connected', 'disconnected'].includes(conn.status), 'Should have valid status');
      });
      
      // Limpar dados de teste
      for (const id of connectionIds) {
        await db.deleteConnection(id);
      }
    });

    test('should handle database backup and restore', async () => {
      // Criar alguns dados de teste
      const testConnection = await db.createConnection({
        name: 'Backup Test Connection',
        type: 'API',
        host: 'backup.example.com',
        assignedUsers: ['backup-user']
      });

      await db.updateBrandingConfig({
        appName: 'Backup Test App',
        primaryColor: '#123456'
      });

      // Criar backup
      const backupPath = await db.createBackup(TEST_BACKUP_PATH);
      assert.strictEqual(backupPath, TEST_BACKUP_PATH, 'Should return backup path');
      assert.ok(fs.existsSync(TEST_BACKUP_PATH), 'Backup file should exist');
      
      const backupStats = fs.statSync(TEST_BACKUP_PATH);
      assert.ok(backupStats.size > 0, 'Backup should have content');
      
      // Verificar que o backup contém os dados
      const backupDb = new (require('../../database'))(TEST_BACKUP_PATH);
      await backupDb.init();
      
      const backupConnections = await backupDb.getAllConnections();
      const backupBranding = await backupDb.getBrandingConfig();
      
      assert.ok(backupConnections.find(c => c.name === 'Backup Test Connection'), 'Backup should contain test connection');
      assert.strictEqual(backupBranding.appName, 'Backup Test App', 'Backup should contain branding config');
      
      await backupDb.close();
      await db.deleteConnection(testConnection.id);
    });
  });

  describe('Database Statistics and Monitoring', () => {
    test('should provide accurate database statistics', async () => {
      // Criar alguns dados para estatísticas
      const connections = [];
      for (let i = 0; i < 5; i++) {
        const conn = await db.createConnection({
          name: `Stats Test ${i}`,
          type: 'API',
          host: `stats${i}.example.com`,
          assignedUsers: [`stats-user${i}`]
        });
        connections.push(conn.id);
      }

      const stats = await db.getDatabaseStats();
      
      assert.ok(typeof stats.pageCount === 'number', 'Should return page count');
      assert.ok(typeof stats.pageSize === 'number', 'Should return page size');
      assert.ok(typeof stats.databaseSize === 'number', 'Should return database size');
      assert.ok(typeof stats.recordCount === 'number', 'Should return record count');
      
      assert.ok(stats.pageCount > 0, 'Should have pages');
      assert.ok(stats.pageSize > 0, 'Should have page size');
      assert.ok(stats.databaseSize > 0, 'Should have database size');
      assert.ok(stats.recordCount >= 5, 'Should count test records');
      
      // Limpar dados de teste
      for (const id of connections) {
        await db.deleteConnection(id);
      }
    });
  });
});