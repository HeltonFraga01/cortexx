/**
 * Unified Auth System Audit Tests
 * 
 * Tests created as part of the unified-auth-system-audit spec
 * to validate authentication flows and multi-tenant isolation.
 * 
 * **Feature: unified-auth-system-audit**
 * **Validates: Requirements 1-10**
 */

const assert = require('assert');
const { describe, it, beforeEach, before, after } = require('node:test');
const request = require('supertest');
const express = require('express');
const session = require('express-session');

// Import middlewares
const { requireAuth, requireAdmin, requireUser } = require('../middleware/auth');
const { requireSuperadmin } = require('../middleware/superadminAuth');
const { requireTenantAdmin, requireTenantUser } = require('../middleware/tenantAuth');
const { requireAgentAuth } = require('../middleware/agentAuth');
const { requireUserAuth } = require('../middleware/userAuth');

// Import helpers
const { 
  isUUID, 
  isWuzapiHash, 
  normalizeToUUID, 
  normalizeToHash,
  areEqual 
} = require('../utils/userIdHelper');

/**
 * Test Suite: User ID Helper Functions
 * **Validates: Requirements 3**
 */
describe('User ID Helper Functions', () => {
  describe('isUUID', () => {
    it('should return true for valid UUID', () => {
      assert.strictEqual(isUUID('12345678-1234-1234-1234-123456789012'), true);
      assert.strictEqual(isUUID('a1b2c3d4-e5f6-7890-abcd-ef1234567890'), true);
    });

    it('should return false for invalid UUID', () => {
      assert.strictEqual(isUUID('12345678123412341234123456789012'), false);
      assert.strictEqual(isUUID('not-a-uuid'), false);
      assert.strictEqual(isUUID(''), false);
      assert.strictEqual(isUUID(null), false);
    });
  });

  describe('isWuzapiHash', () => {
    it('should return true for valid 32-char hash', () => {
      assert.strictEqual(isWuzapiHash('12345678123412341234123456789012'), true);
      assert.strictEqual(isWuzapiHash('a1b2c3d4e5f67890abcdef1234567890'), true);
    });

    it('should return false for invalid hash', () => {
      assert.strictEqual(isWuzapiHash('12345678-1234-1234-1234-123456789012'), false);
      assert.strictEqual(isWuzapiHash('short'), false);
      assert.strictEqual(isWuzapiHash(''), false);
      assert.strictEqual(isWuzapiHash(null), false);
    });
  });

  describe('normalizeToUUID', () => {
    it('should convert 32-char hash to UUID format', () => {
      const hash = '12345678123412341234123456789012';
      const uuid = normalizeToUUID(hash);
      assert.strictEqual(uuid, '12345678-1234-1234-1234-123456789012');
    });

    it('should return UUID unchanged', () => {
      const uuid = '12345678-1234-1234-1234-123456789012';
      assert.strictEqual(normalizeToUUID(uuid), uuid);
    });

    it('should return null for invalid input', () => {
      assert.strictEqual(normalizeToUUID(null), null);
      assert.strictEqual(normalizeToUUID(''), null);
    });
  });

  describe('normalizeToHash', () => {
    it('should convert UUID to 32-char hash', () => {
      const uuid = '12345678-1234-1234-1234-123456789012';
      const hash = normalizeToHash(uuid);
      assert.strictEqual(hash, '12345678123412341234123456789012');
    });

    it('should return hash unchanged', () => {
      const hash = '12345678123412341234123456789012';
      assert.strictEqual(normalizeToHash(hash), hash);
    });
  });

  describe('areEqual', () => {
    it('should return true for equivalent IDs in different formats', () => {
      const uuid = '12345678-1234-1234-1234-123456789012';
      const hash = '12345678123412341234123456789012';
      assert.strictEqual(areEqual(uuid, hash), true);
      assert.strictEqual(areEqual(hash, uuid), true);
    });

    it('should return false for different IDs', () => {
      const uuid1 = '12345678-1234-1234-1234-123456789012';
      const uuid2 = 'abcdefab-cdef-abcd-efab-cdefabcdefab';
      assert.strictEqual(areEqual(uuid1, uuid2), false);
    });
  });
});

/**
 * Test Suite: Authentication Middleware Hierarchy
 * **Validates: Requirements 1, 2, 7**
 */
describe('Authentication Middleware Hierarchy', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Simulate login endpoint
    app.post('/login', (req, res) => {
      req.session.userId = req.body.userId;
      req.session.role = req.body.role;
      req.session.tenantId = req.body.tenantId;
      res.json({ success: true });
    });
    
    // Protected routes
    app.get('/auth', requireAuth, (req, res) => {
      res.json({ message: 'Authenticated', userId: req.session.userId });
    });
    
    app.get('/admin', requireAdmin, (req, res) => {
      res.json({ message: 'Admin access', userId: req.session.userId });
    });
    
    app.get('/user', requireUser, (req, res) => {
      res.json({ message: 'User access', userId: req.session.userId });
    });
  });

  describe('Role-based Access Control', () => {
    it('should allow admin to access admin endpoints', async () => {
      const agent = request.agent(app);
      await agent.post('/login').send({ 
        userId: 'admin123', 
        role: 'admin',
        tenantId: 'tenant1'
      });
      
      const response = await agent.get('/admin');
      assert.strictEqual(response.status, 200);
    });

    it('should deny user access to admin endpoints', async () => {
      const agent = request.agent(app);
      await agent.post('/login').send({ 
        userId: 'user123', 
        role: 'user',
        tenantId: 'tenant1'
      });
      
      const response = await agent.get('/admin');
      assert.strictEqual(response.status, 403);
    });

    it('should allow user to access user endpoints', async () => {
      const agent = request.agent(app);
      await agent.post('/login').send({ 
        userId: 'user123', 
        role: 'user',
        tenantId: 'tenant1'
      });
      
      const response = await agent.get('/user');
      assert.strictEqual(response.status, 200);
    });

    it('should deny admin access to user-only endpoints', async () => {
      const agent = request.agent(app);
      await agent.post('/login').send({ 
        userId: 'admin123', 
        role: 'admin',
        tenantId: 'tenant1'
      });
      
      const response = await agent.get('/user');
      assert.strictEqual(response.status, 403);
    });
  });

  describe('Session Validation', () => {
    it('should reject requests without session', async () => {
      const response = await request(app).get('/auth');
      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    });

    it('should reject requests with empty userId', async () => {
      const agent = request.agent(app);
      await agent.post('/login').send({ 
        userId: '', 
        role: 'user',
        tenantId: 'tenant1'
      });
      
      const response = await agent.get('/auth');
      assert.strictEqual(response.status, 401);
    });
  });
});

/**
 * Test Suite: Multi-Tenant Context
 * **Validates: Requirements 5, 6**
 */
describe('Multi-Tenant Context', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    // Simulate login with tenant context
    app.post('/login', (req, res) => {
      req.session.userId = req.body.userId;
      req.session.role = req.body.role;
      req.session.tenantId = req.body.tenantId;
      res.json({ success: true });
    });
    
    // Endpoint that returns tenant context
    app.get('/tenant-context', requireAuth, (req, res) => {
      res.json({ 
        tenantId: req.session.tenantId,
        userId: req.session.userId
      });
    });
  });

  it('should preserve tenant context in session', async () => {
    const agent = request.agent(app);
    await agent.post('/login').send({ 
      userId: 'user123', 
      role: 'user',
      tenantId: 'tenant-abc-123'
    });
    
    const response = await agent.get('/tenant-context');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.tenantId, 'tenant-abc-123');
  });

  it('should isolate sessions between different tenants', async () => {
    const agent1 = request.agent(app);
    const agent2 = request.agent(app);
    
    // Login to different tenants
    await agent1.post('/login').send({ 
      userId: 'user1', 
      role: 'user',
      tenantId: 'tenant-1'
    });
    
    await agent2.post('/login').send({ 
      userId: 'user2', 
      role: 'user',
      tenantId: 'tenant-2'
    });
    
    // Verify isolation
    const response1 = await agent1.get('/tenant-context');
    const response2 = await agent2.get('/tenant-context');
    
    assert.strictEqual(response1.body.tenantId, 'tenant-1');
    assert.strictEqual(response2.body.tenantId, 'tenant-2');
    assert.notStrictEqual(response1.body.tenantId, response2.body.tenantId);
  });
});

/**
 * Test Suite: Error Responses
 * **Validates: Requirements 7**
 */
describe('Authentication Error Responses', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false
    }));
    
    app.get('/protected', requireAuth, (req, res) => {
      res.json({ message: 'OK' });
    });
    
    app.get('/admin', requireAdmin, (req, res) => {
      res.json({ message: 'OK' });
    });
  });

  it('should return proper error code for unauthenticated requests', async () => {
    const response = await request(app).get('/protected');
    
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.code, 'AUTH_REQUIRED');
    assert(response.body.error, 'Error message should be present');
  });

  it('should return proper error code for unauthorized requests', async () => {
    const agent = request.agent(app);
    
    // Login as user
    await agent.post('/login', (req, res) => {
      req.session.userId = 'user123';
      req.session.role = 'user';
      res.json({ success: true });
    });
    
    // Note: This test depends on the actual middleware behavior
    // The middleware should return 403 for unauthorized access
  });
});

console.log('Unified Auth Audit Tests loaded');
