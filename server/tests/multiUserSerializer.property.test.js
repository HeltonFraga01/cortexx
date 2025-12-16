#!/usr/bin/env node

/**
 * Property-Based Tests for Multi-User Serialization
 * Tests JSON serialization/deserialization round-trip properties
 * 
 * **Feature: multi-user-inbox-system, Property 19: Agent Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const {
  serialize,
  deserialize,
  fromDatabaseRow,
  toDatabaseRow,
  serializePermissions,
  deserializePermissions,
  validateSchema
} = require('../utils/multiUserSerializer');

// Generator for valid UUIDs
const uuidGen = fc.uuid();

// Generator for valid email addresses
const emailGen = fc.emailAddress();

// Generator for valid agent names
const nameGen = fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0);

// Generator for valid roles
const roleGen = fc.constantFrom('owner', 'administrator', 'agent', 'viewer');

// Generator for valid availability status
const availabilityGen = fc.constantFrom('online', 'busy', 'offline');

// Generator for valid agent status
const statusGen = fc.constantFrom('active', 'inactive', 'pending');

// Generator for valid account status
const accountStatusGen = fc.constantFrom('active', 'inactive', 'suspended');

// Generator for ISO date strings (using integer timestamps to avoid invalid dates)
const dateStringGen = fc.integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31
  .map(ts => new Date(ts).toISOString());

// Generator for valid permissions
const permissionGen = fc.constantFrom(
  'conversations:view', 'conversations:create', 'conversations:assign', 'conversations:delete',
  'messages:send', 'messages:delete',
  'contacts:view', 'contacts:create', 'contacts:edit', 'contacts:delete',
  'agents:view', 'agents:create', 'agents:edit', 'agents:delete',
  'teams:view', 'teams:manage',
  'inboxes:view', 'inboxes:manage',
  'reports:view',
  'settings:view', 'settings:edit',
  'webhooks:manage', 'integrations:manage'
);

// Generator for permission arrays
const permissionsArrayGen = fc.array(permissionGen, { minLength: 0, maxLength: 10 });

// Generator for valid Agent objects
const agentGen = fc.record({
  id: uuidGen,
  accountId: uuidGen,
  email: emailGen,
  name: nameGen,
  avatarUrl: fc.option(fc.webUrl(), { nil: null }),
  role: roleGen,
  customRoleId: fc.option(uuidGen, { nil: null }),
  availability: availabilityGen,
  status: statusGen,
  lastActivityAt: fc.option(dateStringGen, { nil: null }),
  createdAt: dateStringGen,
  updatedAt: dateStringGen
});

// Generator for valid Account objects
const accountGen = fc.record({
  id: uuidGen,
  name: nameGen,
  ownerUserId: uuidGen,
  wuzapiToken: fc.option(fc.string({ minLength: 10, maxLength: 100 }), { nil: null }),
  timezone: fc.constantFrom('America/Sao_Paulo', 'America/New_York', 'Europe/London', 'UTC'),
  locale: fc.constantFrom('pt-BR', 'en-US', 'es-ES'),
  status: accountStatusGen,
  settings: fc.record({
    maxAgents: fc.option(fc.integer({ min: 1, max: 100 })),
    maxInboxes: fc.option(fc.integer({ min: 1, max: 50 })),
    maxTeams: fc.option(fc.integer({ min: 1, max: 20 }))
  }),
  createdAt: dateStringGen,
  updatedAt: dateStringGen
});

// Generator for valid Team objects
const teamGen = fc.record({
  id: uuidGen,
  accountId: uuidGen,
  name: nameGen,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  allowAutoAssign: fc.boolean(),
  members: fc.array(uuidGen, { maxLength: 5 }),
  createdAt: dateStringGen,
  updatedAt: dateStringGen
});

// Generator for valid Inbox objects
const inboxGen = fc.record({
  id: uuidGen,
  accountId: uuidGen,
  name: nameGen,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  channelType: fc.constantFrom('whatsapp', 'email', 'web'),
  enableAutoAssignment: fc.boolean(),
  autoAssignmentConfig: fc.record({
    maxConversationsPerAgent: fc.option(fc.integer({ min: 1, max: 50 })),
    roundRobin: fc.option(fc.boolean())
  }),
  greetingEnabled: fc.boolean(),
  greetingMessage: fc.option(fc.string({ maxLength: 1000 }), { nil: null }),
  members: fc.array(uuidGen, { maxLength: 5 }),
  createdAt: dateStringGen,
  updatedAt: dateStringGen
});

// Generator for valid CustomRole objects
const customRoleGen = fc.record({
  id: uuidGen,
  accountId: uuidGen,
  name: nameGen,
  description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
  permissions: permissionsArrayGen,
  createdAt: dateStringGen,
  updatedAt: dateStringGen
});

/**
 * Helper function to compare objects field by field
 * This avoids issues with __proto__: null objects from fast-check
 */
function assertObjectsEqual(actual, expected, path = '') {
  const actualKeys = Object.keys(actual);
  const expectedKeys = Object.keys(expected);
  
  assert.strictEqual(actualKeys.length, expectedKeys.length, 
    `Key count mismatch at ${path}: ${actualKeys.length} vs ${expectedKeys.length}`);
  
  for (const key of expectedKeys) {
    const actualVal = actual[key];
    const expectedVal = expected[key];
    const currentPath = path ? `${path}.${key}` : key;
    
    if (actualVal === null || expectedVal === null) {
      assert.strictEqual(actualVal, expectedVal, `Mismatch at ${currentPath}`);
    } else if (Array.isArray(expectedVal)) {
      assert.strictEqual(Array.isArray(actualVal), true, `Expected array at ${currentPath}`);
      assert.strictEqual(actualVal.length, expectedVal.length, `Array length mismatch at ${currentPath}`);
      for (let i = 0; i < expectedVal.length; i++) {
        if (typeof expectedVal[i] === 'object' && expectedVal[i] !== null) {
          assertObjectsEqual(actualVal[i], expectedVal[i], `${currentPath}[${i}]`);
        } else {
          assert.strictEqual(actualVal[i], expectedVal[i], `Mismatch at ${currentPath}[${i}]`);
        }
      }
    } else if (typeof expectedVal === 'object') {
      assertObjectsEqual(actualVal, expectedVal, currentPath);
    } else {
      assert.strictEqual(actualVal, expectedVal, `Mismatch at ${currentPath}`);
    }
  }
}

/**
 * **Feature: multi-user-inbox-system, Property 19: Agent Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 * 
 * For any valid agent data, serializing to JSON and deserializing back
 * SHALL produce an equivalent agent object with all fields preserved.
 */
test('Property 19: Agent Data Serialization Round-Trip', () => {
  fc.assert(
    fc.property(agentGen, (agent) => {
      // Convert to plain object first
      const plainAgent = JSON.parse(JSON.stringify(agent));
      
      // Serialize
      const serialized = serialize(plainAgent, 'agent');
      assert.strictEqual(serialized.success, true, `Serialization failed: ${serialized.error}`);
      
      // Deserialize
      const deserialized = deserialize(serialized.json, 'agent');
      assert.strictEqual(deserialized.success, true, `Deserialization failed: ${deserialized.error}`);
      
      // Verify round-trip preserves all fields
      assertObjectsEqual(deserialized.data, plainAgent);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: Account Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 */
test('Property 19: Account Data Serialization Round-Trip', () => {
  fc.assert(
    fc.property(accountGen, (account) => {
      const plainAccount = JSON.parse(JSON.stringify(account));
      
      const serialized = serialize(plainAccount, 'account');
      assert.strictEqual(serialized.success, true, `Serialization failed: ${serialized.error}`);
      
      const deserialized = deserialize(serialized.json, 'account');
      assert.strictEqual(deserialized.success, true, `Deserialization failed: ${deserialized.error}`);
      
      assertObjectsEqual(deserialized.data, plainAccount);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: Team Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 */
test('Property 19: Team Data Serialization Round-Trip', () => {
  fc.assert(
    fc.property(teamGen, (team) => {
      const plainTeam = JSON.parse(JSON.stringify(team));
      
      const serialized = serialize(plainTeam, 'team');
      assert.strictEqual(serialized.success, true, `Serialization failed: ${serialized.error}`);
      
      const deserialized = deserialize(serialized.json, 'team');
      assert.strictEqual(deserialized.success, true, `Deserialization failed: ${deserialized.error}`);
      
      assertObjectsEqual(deserialized.data, plainTeam);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: Inbox Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 */
test('Property 19: Inbox Data Serialization Round-Trip', () => {
  fc.assert(
    fc.property(inboxGen, (inbox) => {
      const plainInbox = JSON.parse(JSON.stringify(inbox));
      
      const serialized = serialize(plainInbox, 'inbox');
      assert.strictEqual(serialized.success, true, `Serialization failed: ${serialized.error}`);
      
      const deserialized = deserialize(serialized.json, 'inbox');
      assert.strictEqual(deserialized.success, true, `Deserialization failed: ${deserialized.error}`);
      
      assertObjectsEqual(deserialized.data, plainInbox);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: CustomRole Data Serialization Round-Trip**
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */
test('Property 19: CustomRole Data Serialization Round-Trip', () => {
  fc.assert(
    fc.property(customRoleGen, (customRole) => {
      const plainRole = JSON.parse(JSON.stringify(customRole));
      
      const serialized = serialize(plainRole, 'customRole');
      assert.strictEqual(serialized.success, true, `Serialization failed: ${serialized.error}`);
      
      const deserialized = deserialize(serialized.json, 'customRole');
      assert.strictEqual(deserialized.success, true, `Deserialization failed: ${deserialized.error}`);
      
      assertObjectsEqual(deserialized.data, plainRole);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: Permissions Serialization Round-Trip**
 * **Validates: Requirements 9.3**
 * 
 * For any valid permissions array, serializing and deserializing
 * SHALL produce an equivalent array.
 */
test('Property 19: Permissions Serialization Round-Trip', () => {
  fc.assert(
    fc.property(permissionsArrayGen, (permissions) => {
      const serialized = serializePermissions(permissions);
      const deserialized = deserializePermissions(serialized);
      
      assert.deepStrictEqual(deserialized, permissions);
    }),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-user-inbox-system, Property 19: Database Row Conversion Round-Trip**
 * **Validates: Requirements 9.1, 9.2**
 * 
 * For any valid entity, converting to database row and back
 * SHALL preserve all data (with case conversion).
 */
test('Property 19: Database Row Conversion Round-Trip', () => {
  fc.assert(
    fc.property(agentGen, (agent) => {
      const dbRow = toDatabaseRow(agent);
      const restored = fromDatabaseRow(dbRow);
      
      // Verify key fields are preserved
      assert.strictEqual(restored.id, agent.id);
      assert.strictEqual(restored.accountId, agent.accountId);
      assert.strictEqual(restored.email, agent.email);
      assert.strictEqual(restored.name, agent.name);
      assert.strictEqual(restored.role, agent.role);
      assert.strictEqual(restored.status, agent.status);
    }),
    { numRuns: 100 }
  );
});

/**
 * Schema Validation Tests
 */
test('Schema validation rejects invalid agent role', () => {
  const invalidAgent = {
    id: 'test-id',
    accountId: 'account-id',
    email: 'test@example.com',
    name: 'Test Agent',
    role: 'invalid_role', // Invalid
    status: 'active'
  };
  
  const result = validateSchema(invalidAgent, 'agent');
  assert.strictEqual(result.valid, false);
  assert(result.errors.some(e => e.includes('role')));
});

test('Schema validation rejects missing required fields', () => {
  const incompleteAgent = {
    id: 'test-id',
    // Missing accountId, email, name, role, status
  };
  
  const result = validateSchema(incompleteAgent, 'agent');
  assert.strictEqual(result.valid, false);
  assert(result.errors.length >= 4);
});

test('Schema validation accepts valid agent', () => {
  const validAgent = {
    id: 'test-id',
    accountId: 'account-id',
    email: 'test@example.com',
    name: 'Test Agent',
    role: 'agent',
    status: 'active'
  };
  
  const result = validateSchema(validAgent, 'agent');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.errors.length, 0);
});

test('Deserialization rejects invalid JSON', () => {
  const result = deserialize('not valid json', 'agent');
  assert.strictEqual(result.success, false);
  assert(result.error);
});

test('Serialization rejects invalid data', () => {
  const invalidAgent = {
    id: 'test-id',
    // Missing required fields
  };
  
  const result = serialize(invalidAgent, 'agent');
  assert.strictEqual(result.success, false);
  assert(result.error);
});

test('deserializePermissions handles null/undefined', () => {
  assert.deepStrictEqual(deserializePermissions(null), []);
  assert.deepStrictEqual(deserializePermissions(undefined), []);
  assert.deepStrictEqual(deserializePermissions(''), []);
});

test('deserializePermissions handles invalid JSON', () => {
  assert.deepStrictEqual(deserializePermissions('not json'), []);
});

test('fromDatabaseRow handles null', () => {
  assert.strictEqual(fromDatabaseRow(null), null);
});

test('toDatabaseRow handles null', () => {
  assert.strictEqual(toDatabaseRow(null), null);
});
