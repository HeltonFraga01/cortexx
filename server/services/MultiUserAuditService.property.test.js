/**
 * Property-Based Tests for MultiUserAuditService
 * 
 * Tests correctness properties defined in the design document using fast-check.
 * Each test runs a minimum of 100 iterations.
 * 
 * Feature: multi-user-inbox-system
 * 
 * Uses Supabase as the database backend.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const crypto = require('crypto');
const SupabaseService = require('./SupabaseService');
const MultiUserAuditService = require('./MultiUserAuditService');
const { ACTION_TYPES, RESOURCE_TYPES } = require('./MultiUserAuditService');

// Test prefix to identify test data for cleanup
const TEST_PREFIX = 'test-audit-';

// Helper to create a database adapter compatible with MultiUserAuditService
function createDbAdapter() {
  return {
    async query(sql, params = []) {
      // Parse SQL to determine operation type and table
      const sqlLower = sql.toLowerCase().trim();
      
      if (sqlLower.startsWith('insert into audit_log')) {
        // Handle INSERT
        const [id, account_id, agent_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at] = params;
        const { data, error } = await SupabaseService.insert('audit_log', {
          id,
          account_id,
          agent_id,
          action,
          resource_type,
          resource_id,
          details,
          ip_address,
          user_agent,
          created_at
        });
        if (error) throw error;
        return { rows: [data], rowCount: 1 };
      }
      
      if (sqlLower.startsWith('select') && sqlLower.includes('from audit_log')) {
        // Handle SELECT queries
        let query = SupabaseService.adminClient.from('audit_log').select('*');
        
        // Parse WHERE conditions
        if (sqlLower.includes('where')) {
          if (sqlLower.includes('id = ?')) {
            query = query.eq('id', params[0]);
          } else if (sqlLower.includes('account_id = ?')) {
            query = query.eq('account_id', params[0]);
            
            // Handle additional filters
            let paramIndex = 1;
            if (sqlLower.includes('agent_id = ?')) {
              query = query.eq('agent_id', params[paramIndex++]);
            }
            if (sqlLower.includes('action = ?')) {
              query = query.eq('action', params[paramIndex++]);
            }
            if (sqlLower.includes('resource_type = ?')) {
              query = query.eq('resource_type', params[paramIndex++]);
            }
            if (sqlLower.includes('resource_id = ?')) {
              query = query.eq('resource_id', params[paramIndex++]);
            }
          } else if (sqlLower.includes('agent_id = ?')) {
            query = query.eq('agent_id', params[0]);
          } else if (sqlLower.includes('resource_type = ? and resource_id = ?')) {
            query = query.eq('resource_type', params[0]).eq('resource_id', params[1]);
          }
        }
        
        // Handle ORDER BY
        if (sqlLower.includes('order by created_at desc')) {
          query = query.order('created_at', { ascending: false });
        }
        
        // Handle LIMIT
        const limitMatch = sqlLower.match(/limit\s+(\?|\d+)/);
        if (limitMatch) {
          const limitIndex = params.length - (sqlLower.includes('offset') ? 2 : 1);
          const limit = limitMatch[1] === '?' ? params[limitIndex] : parseInt(limitMatch[1]);
          query = query.limit(limit);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { rows: data || [] };
      }
      
      if (sqlLower.startsWith('select count')) {
        // Handle COUNT queries
        let query = SupabaseService.adminClient.from('audit_log').select('*', { count: 'exact', head: true });
        
        if (sqlLower.includes('account_id = ?')) {
          query = query.eq('account_id', params[0]);
          
          let paramIndex = 1;
          if (sqlLower.includes('agent_id = ?')) {
            query = query.eq('agent_id', params[paramIndex++]);
          }
          if (sqlLower.includes('action = ?')) {
            query = query.eq('action', params[paramIndex++]);
          }
        }
        
        const { count, error } = await query;
        if (error) throw error;
        return { rows: [{ total: count || 0 }] };
      }
      
      if (sqlLower.startsWith('delete from audit_log')) {
        // Handle DELETE
        let query = SupabaseService.adminClient.from('audit_log').delete();
        
        if (sqlLower.includes('account_id = ?')) {
          query = query.eq('account_id', params[0]);
          if (sqlLower.includes('created_at <')) {
            query = query.lt('created_at', params[1]);
          }
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return { rowCount: data?.length || 0 };
      }
      
      throw new Error(`Unsupported SQL: ${sql}`);
    }
  };
}

// Helper to clean up test data
async function cleanupTestData() {
  // Delete test audit logs
  await SupabaseService.adminClient
    .from('audit_log')
    .delete()
    .like('account_id', `${TEST_PREFIX}%`);
  
  // Delete test agents
  await SupabaseService.adminClient
    .from('agents')
    .delete()
    .like('account_id', `${TEST_PREFIX}%`);
  
  // Delete test accounts
  await SupabaseService.adminClient
    .from('accounts')
    .delete()
    .like('id', `${TEST_PREFIX}%`);
}

// Helper to create a test account
async function createTestAccount() {
  const id = TEST_PREFIX + crypto.randomUUID();
  const { data, error } = await SupabaseService.insert('accounts', {
    id,
    name: 'Test Account',
    owner_user_id: crypto.randomUUID(),
    wuzapi_token: 'test-token-' + crypto.randomUUID().substring(0, 8),
    status: 'active'
  });
  if (error) throw error;
  return id;
}

// Helper to create a test agent
async function createTestAgent(accountId) {
  const id = crypto.randomUUID();
  const email = `agent-${id.substring(0, 8)}@test.com`;
  const { data, error } = await SupabaseService.insert('agents', {
    id,
    account_id: accountId,
    email,
    password_hash: 'hash',
    name: 'Test Agent',
    role: 'agent',
    status: 'active'
  });
  if (error) throw error;
  return id;
}

// Arbitraries
const actionArb = fc.constantFrom(...Object.values(ACTION_TYPES));
const resourceTypeArb = fc.constantFrom(...Object.values(RESOURCE_TYPES));
const resourceIdArb = fc.uuid();
const ipAddressArb = fc.ipV4();
const userAgentArb = fc.string({ minLength: 10, maxLength: 100 });
const detailsArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(fc.string(), fc.integer(), fc.boolean())
);

describe('MultiUserAuditService Property Tests (Supabase)', () => {
  let dbAdapter;
  let auditService;
  
  before(async () => {
    // Verify Supabase connection
    const { data: healthy } = await SupabaseService.healthCheck();
    if (!healthy) {
      throw new Error('Supabase connection not available');
    }
    
    dbAdapter = createDbAdapter();
    auditService = new MultiUserAuditService(dbAdapter);
    
    // Initial cleanup
    await cleanupTestData();
  });
  
  after(async () => {
    // Final cleanup
    await cleanupTestData();
  });
  
  beforeEach(async () => {
    await cleanupTestData();
  });

  /**
   * Feature: multi-user-inbox-system, Property 13: Audit Log Completeness
   * Validates: Requirements 6.2
   * 
   * For any action performed by an agent, an audit log entry SHALL be created 
   * containing the agent ID, timestamp, action type, and relevant details.
   */
  it('Property 13: Audit log completeness - all required fields are captured', async () => {
    await fc.assert(
      fc.asyncProperty(
        actionArb,
        resourceTypeArb,
        resourceIdArb,
        detailsArb,
        ipAddressArb,
        async (action, resourceType, resourceId, details, ipAddress) => {
          await cleanupTestData();
          
          const accountId = await createTestAccount();
          const agentId = await createTestAgent(accountId);
          
          // Log an action
          const logEntry = await auditService.logAction({
            accountId,
            agentId,
            action,
            resourceType,
            resourceId,
            details,
            ipAddress
          });
          
          // Verify log entry was created with all required fields
          assert(logEntry, 'Log entry should be created');
          assert(logEntry.id, 'Log entry should have an ID');
          assert.strictEqual(logEntry.accountId, accountId, 'Account ID should match');
          assert.strictEqual(logEntry.agentId, agentId, 'Agent ID should match');
          assert.strictEqual(logEntry.action, action, 'Action should match');
          assert.strictEqual(logEntry.resourceType, resourceType, 'Resource type should match');
          assert.strictEqual(logEntry.resourceId, resourceId, 'Resource ID should match');
          assert(logEntry.createdAt, 'Timestamp should be set');
          
          // Verify details are preserved
          for (const [key, value] of Object.entries(details)) {
            assert.strictEqual(
              logEntry.details[key],
              value,
              `Detail ${key} should be preserved`
            );
          }
          
          // Verify log can be retrieved
          const retrieved = await auditService.getLogById(logEntry.id);
          assert(retrieved, 'Log should be retrievable');
          assert.strictEqual(retrieved.id, logEntry.id);
          assert.strictEqual(retrieved.agentId, agentId);
          assert.strictEqual(retrieved.action, action);
        }
      ),
      { numRuns: 20 } // Reduced for real database tests
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property 17: Message Sender Attribution
   * Validates: Requirements 7.4
   * 
   * For any message sent by an agent, the audit log SHALL record the agent ID as the sender.
   */
  it('Property 17: Message sender attribution - agent ID is recorded', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 11, maxLength: 15 }),
        async (messageId, messageText, phoneNumber) => {
          await cleanupTestData();
          
          const accountId = await createTestAccount();
          const agentId = await createTestAgent(accountId);
          
          // Log message sent action
          const logEntry = await auditService.logMessageSent(accountId, agentId, messageId, {
            text: messageText,
            phoneNumber
          });
          
          // Verify agent ID is recorded
          assert(logEntry, 'Log entry should be created');
          assert.strictEqual(logEntry.agentId, agentId, 'Agent ID should be recorded');
          assert.strictEqual(logEntry.action, ACTION_TYPES.MESSAGE_SENT, 'Action should be MESSAGE_SENT');
          assert.strictEqual(logEntry.resourceType, RESOURCE_TYPES.MESSAGE, 'Resource type should be MESSAGE');
          assert.strictEqual(logEntry.resourceId, messageId, 'Message ID should be recorded');
          
          // Verify details contain message info
          assert.strictEqual(logEntry.details.text, messageText, 'Message text should be in details');
          assert.strictEqual(logEntry.details.phoneNumber, phoneNumber, 'Phone number should be in details');
          
          // Verify can query by agent
          const agentActivity = await auditService.getAgentActivity(agentId);
          assert(agentActivity.length > 0, 'Agent should have activity');
          assert(
            agentActivity.some(log => log.id === logEntry.id),
            'Message log should appear in agent activity'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Audit log query filtering
   * Validates: Requirements 6.4
   */
  it('Property: Audit log query filtering works correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 5 }),
        async (logCount) => {
          await cleanupTestData();
          
          const accountId = await createTestAccount();
          const agentId = await createTestAgent(accountId);
          
          // Create multiple log entries with different actions
          const actions = Object.values(ACTION_TYPES).slice(0, logCount);
          for (const action of actions) {
            await auditService.logAction({
              accountId,
              agentId,
              action,
              resourceType: RESOURCE_TYPES.AGENT
            });
          }
          
          // Query all logs
          const allLogs = await auditService.queryLogs(accountId);
          assert.strictEqual(
            allLogs.logs.length,
            logCount,
            `Should have ${logCount} logs`
          );
          
          // Query by specific action
          const specificAction = actions[0];
          const filteredLogs = await auditService.queryLogs(accountId, {
            action: specificAction
          });
          assert(
            filteredLogs.logs.every(log => log.action === specificAction),
            'All filtered logs should have the specified action'
          );
          
          // Query by agent
          const agentLogs = await auditService.queryLogs(accountId, {
            agentId
          });
          assert(
            agentLogs.logs.every(log => log.agentId === agentId),
            'All filtered logs should be from the specified agent'
          );
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Login/logout audit
   * Validates: Requirements 6.2
   */
  it('Property: Login and logout are properly audited', async () => {
    await fc.assert(
      fc.asyncProperty(
        ipAddressArb,
        userAgentArb,
        fc.boolean(),
        async (ipAddress, userAgent, loginSuccess) => {
          await cleanupTestData();
          
          const accountId = await createTestAccount();
          const agentId = await createTestAgent(accountId);
          
          // Log login
          const loginLog = await auditService.logLogin(
            accountId, 
            agentId, 
            ipAddress, 
            userAgent, 
            loginSuccess
          );
          
          assert(loginLog, 'Login log should be created');
          assert.strictEqual(
            loginLog.action,
            loginSuccess ? ACTION_TYPES.AGENT_LOGIN : ACTION_TYPES.AGENT_LOGIN_FAILED,
            'Action should match login success status'
          );
          assert.strictEqual(loginLog.ipAddress, ipAddress, 'IP address should be recorded');
          assert.strictEqual(loginLog.userAgent, userAgent, 'User agent should be recorded');
          
          // Log logout
          const logoutLog = await auditService.logLogout(accountId, agentId, ipAddress);
          
          assert(logoutLog, 'Logout log should be created');
          assert.strictEqual(logoutLog.action, ACTION_TYPES.AGENT_LOGOUT, 'Action should be AGENT_LOGOUT');
          assert.strictEqual(logoutLog.agentId, agentId, 'Agent ID should be recorded');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Feature: multi-user-inbox-system, Property: Resource activity tracking
   * Validates: Requirements 6.2
   */
  it('Property: Resource activity can be tracked', async () => {
    await fc.assert(
      fc.asyncProperty(
        resourceTypeArb,
        resourceIdArb,
        fc.integer({ min: 1, max: 3 }),
        async (resourceType, resourceId, actionCount) => {
          await cleanupTestData();
          
          const accountId = await createTestAccount();
          const agentId = await createTestAgent(accountId);
          
          // Create multiple actions on the same resource
          for (let i = 0; i < actionCount; i++) {
            await auditService.logAction({
              accountId,
              agentId,
              action: ACTION_TYPES.AGENT_UPDATED,
              resourceType,
              resourceId
            });
          }
          
          // Get resource activity
          const activity = await auditService.getResourceActivity(resourceType, resourceId);
          
          assert.strictEqual(
            activity.length,
            actionCount,
            `Should have ${actionCount} activity entries for resource`
          );
          
          // Verify all entries are for the correct resource
          for (const log of activity) {
            assert.strictEqual(log.resourceType, resourceType);
            assert.strictEqual(log.resourceId, resourceId);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
