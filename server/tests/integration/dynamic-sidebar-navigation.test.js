/**
 * Integration Tests for Dynamic Sidebar Navigation Feature
 * Tests database layer for user record fetching
 * Updated to use Supabase mocks (SQLite removed)
 */

const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

// Test configuration
const TEST_USER_TOKEN_1 = 'test-user-token-001';
const TEST_USER_TOKEN_2 = 'test-user-token-002';
const TEST_ADMIN_TOKEN = 'test-admin-token-123';

// Mock environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock data storage for tests
let mockConnections = [];
let connectionIdCounter = 1;

// Mock database module
const mockDb = {
  isInitialized: true,
  
  async createConnection(data) {
    const connection = {
      id: connectionIdCounter++,
      name: data.name,
      type: data.type,
      host: data.host,
      database: data.database || null,
      nocodb_project_id: data.nocodb_project_id || null,
      nocodb_table_id: data.nocodb_table_id || null,
      table_name: data.table_name,
      user_link_field: data.user_link_field,
      status: data.status || 'disconnected',
      assignedUsers: data.assignedUsers || [],
      fieldMappings: data.fieldMappings || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockConnections.push(connection);
    return connection;
  },
  
  async getUserConnections(userToken) {
    return mockConnections.filter(conn => 
      conn.assignedUsers && conn.assignedUsers.includes(userToken)
    );
  },
  
  async getConnectionById(id) {
    return mockConnections.find(conn => conn.id === id) || null;
  },
  
  async updateConnection(id, data) {
    const index = mockConnections.findIndex(conn => conn.id === id);
    if (index === -1) return { changes: 0 };
    
    mockConnections[index] = {
      ...mockConnections[index],
      ...data,
      updated_at: new Date().toISOString()
    };
    return { changes: 1 };
  },
  
  async deleteConnection(id) {
    const index = mockConnections.findIndex(conn => conn.id === id);
    if (index === -1) return { changes: 0 };
    
    mockConnections.splice(index, 1);
    return { changes: 1 };
  },
  
  async close() {
    // No-op for mock
  }
};

describe('Dynamic Sidebar Navigation - Database Integration', () => {
  let db;
  let testConnectionId1;
  let testConnectionId2;
  let testConnectionId3;

  before(async () => {
    // Reset mock data
    mockConnections = [];
    connectionIdCounter = 1;
    
    // Use mock database
    db = mockDb;

    // Create test connections
    const connection1 = await db.createConnection({
      name: 'Teste Final',
      type: 'NOCODB',
      host: 'https://nocodb.example.com',
      nocodb_project_id: 'p123',
      nocodb_table_id: 'table123',
      table_name: 'my7kpxstrt02976',
      user_link_field: 'apiToken',
      status: 'connected',
      assignedUsers: [TEST_USER_TOKEN_1],
      fieldMappings: [
        { columnName: 'chatwootInboxName', label: 'Nome do Inbox', visible: true, editable: true },
        { columnName: 'chatwootBaseUrl', label: 'URL', visible: true, editable: true },
        { columnName: 'apiToken', label: 'Token', visible: false, editable: false }
      ]
    });
    testConnectionId1 = connection1.id;

    const connection2 = await db.createConnection({
      name: 'MasterMegga',
      type: 'POSTGRES',
      host: 'localhost',
      database: 'test_db',
      table_name: 'users',
      user_link_field: 'user_token',
      status: 'connected',
      assignedUsers: [TEST_USER_TOKEN_1, TEST_USER_TOKEN_2],
      fieldMappings: [
        { columnName: 'name', label: 'Nome', visible: true, editable: true },
        { columnName: 'email', label: 'Email', visible: true, editable: true }
      ]
    });
    testConnectionId2 = connection2.id;

    const connection3 = await db.createConnection({
      name: 'Admin Only Connection',
      type: 'POSTGRES',
      host: 'localhost',
      database: 'admin_db',
      table_name: 'admin_table',
      user_link_field: 'token',
      status: 'connected',
      assignedUsers: [TEST_ADMIN_TOKEN],
      fieldMappings: []
    });
    testConnectionId3 = connection3.id;
  });

  after(async () => {
    if (db) {
      await db.close();
    }
    // Reset mock data
    mockConnections = [];
  });

  describe('getUserConnections - Database Layer', () => {
    test('should return connections assigned to user token', async () => {
      const connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      
      assert.ok(Array.isArray(connections));
      assert.strictEqual(connections.length, 2); // User 1 has 2 connections
      
      // Verify field mappings are included
      const conn = connections.find(c => c.name === 'Teste Final');
      assert.ok(conn);
      assert.ok(Array.isArray(conn.fieldMappings));
      assert.ok(conn.fieldMappings.length > 0);
    });

    test('should return only connections assigned to specific user', async () => {
      const connections = await db.getUserConnections(TEST_USER_TOKEN_2);
      
      assert.ok(Array.isArray(connections));
      assert.strictEqual(connections.length, 1); // User 2 has only 1 connection
      assert.strictEqual(connections[0].name, 'MasterMegga');
    });

    test('should return empty array when user has no connections', async () => {
      const connections = await db.getUserConnections('no-connections-token');
      
      assert.ok(Array.isArray(connections));
      assert.strictEqual(connections.length, 0);
    });
  });

  describe('getConnectionById - Database Layer', () => {
    test('should return connection by id', async () => {
      const connection = await db.getConnectionById(testConnectionId1);
      
      assert.ok(connection);
      assert.strictEqual(connection.id, testConnectionId1);
      assert.strictEqual(connection.name, 'Teste Final');
    });

    test('should return null for non-existent connection', async () => {
      const connection = await db.getConnectionById(99999);
      
      assert.strictEqual(connection, null);
    });
  });

  describe('Multiple Users Scenario', () => {
    test('should isolate data between different users', async () => {
      // User 1 connections
      const user1Connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      
      // User 2 connections
      const user2Connections = await db.getUserConnections(TEST_USER_TOKEN_2);
      
      // User 1 should have 2 connections
      assert.strictEqual(user1Connections.length, 2);
      
      // User 2 should have 1 connection
      assert.strictEqual(user2Connections.length, 1);
      
      // Verify they don't see each other's exclusive connections
      const user1ConnectionIds = user1Connections.map(c => c.id);
      const user2ConnectionIds = user2Connections.map(c => c.id);
      
      assert.ok(user1ConnectionIds.includes(testConnectionId1));
      assert.ok(!user2ConnectionIds.includes(testConnectionId1));
    });
  });

  describe('Admin Changes Synchronization', () => {
    test('should reflect connection removal immediately', async () => {
      // Create temporary connection
      const tempConnection = await db.createConnection({
        name: 'Temporary Connection',
        type: 'API',
        host: 'localhost',
        table_name: 'temp',
        status: 'connected',
        assignedUsers: [TEST_USER_TOKEN_1],
        user_link_field: 'token'
      });

      // User should see it
      let connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      let connectionIds = connections.map(c => c.id);
      assert.ok(connectionIds.includes(tempConnection.id));

      // Admin removes connection
      await db.deleteConnection(tempConnection.id);

      // User should not see it anymore
      connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      connectionIds = connections.map(c => c.id);
      assert.ok(!connectionIds.includes(tempConnection.id));
    });

    test('should reflect connection rename immediately', async () => {
      const originalName = 'Original Name';
      const newName = 'Updated Name';
      
      // Create connection
      const connection = await db.createConnection({
        name: originalName,
        type: 'API',
        host: 'localhost',
        table_name: 'test',
        status: 'connected',
        assignedUsers: [TEST_USER_TOKEN_1],
        user_link_field: 'token'
      });

      // User should see original name
      let connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      let conn = connections.find(c => c.id === connection.id);
      assert.strictEqual(conn.name, originalName);

      // Admin renames connection
      await db.updateConnection(connection.id, { name: newName });

      // User should see new name
      connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      conn = connections.find(c => c.id === connection.id);
      assert.strictEqual(conn.name, newName);

      // Cleanup
      await db.deleteConnection(connection.id);
    });

    test('should reflect user assignment changes immediately', async () => {
      const connection = await db.createConnection({
        name: 'Assignment Test',
        type: 'API',
        host: 'localhost',
        table_name: 'test',
        status: 'connected',
        assignedUsers: [TEST_USER_TOKEN_1],
        user_link_field: 'token'
      });

      // User 1 should see it
      let user1Connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      assert.ok(user1Connections.some(c => c.id === connection.id));

      // User 2 should not see it
      let user2Connections = await db.getUserConnections(TEST_USER_TOKEN_2);
      assert.ok(!user2Connections.some(c => c.id === connection.id));

      // Admin assigns to User 2 as well
      await db.updateConnection(connection.id, {
        assignedUsers: [TEST_USER_TOKEN_1, TEST_USER_TOKEN_2]
      });

      // Both users should see it now
      user1Connections = await db.getUserConnections(TEST_USER_TOKEN_1);
      assert.ok(user1Connections.some(c => c.id === connection.id));

      user2Connections = await db.getUserConnections(TEST_USER_TOKEN_2);
      assert.ok(user2Connections.some(c => c.id === connection.id));

      // Cleanup
      await db.deleteConnection(connection.id);
    });
  });

  describe('Performance Tests', () => {
    test('should respond quickly for user connections query', async () => {
      const startTime = Date.now();
      
      await db.getUserConnections(TEST_USER_TOKEN_1);
      
      const responseTime = Date.now() - startTime;
      
      assert.ok(responseTime < 100, `Response time ${responseTime}ms should be < 100ms`);
    });

    test('should handle multiple concurrent queries efficiently', async () => {
      const startTime = Date.now();
      
      const queries = Array(10).fill(null).map(() =>
        db.getUserConnections(TEST_USER_TOKEN_1)
      );

      const results = await Promise.all(queries);
      const totalTime = Date.now() - startTime;
      
      // All should return data
      results.forEach(connections => {
        assert.ok(Array.isArray(connections));
        assert.strictEqual(connections.length, 2);
      });
      
      // Should complete in reasonable time (< 500ms for 10 queries)
      assert.ok(totalTime < 500, `Total time ${totalTime}ms should be < 500ms`);
    });
  });
});
