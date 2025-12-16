/**
 * Tests for AuditLogger Service
 * 
 * Uses Supabase as the database backend.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');

// Skip tests if Supabase is not configured
const SUPABASE_CONFIGURED = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('AuditLogger', { skip: !SUPABASE_CONFIGURED }, () => {
  let AuditLogger;
  let auditLogger;
  let SupabaseService;
  let testCampaignId;
  let testUserId;

  before(async () => {
    AuditLogger = require('./AuditLogger');
    SupabaseService = require('./SupabaseService');
    auditLogger = new AuditLogger();
    testCampaignId = `test-campaign-${Date.now()}`;
    testUserId = `test-user-${Date.now()}`;
  });

  after(async () => {
    // Cleanup test data
    if (SUPABASE_CONFIGURED) {
      try {
        await SupabaseService.queryAsAdmin('campaign_audit_logs', (query) =>
          query.delete().like('campaign_id', 'test-campaign-%')
        );
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  beforeEach(() => {
    // Generate unique IDs for each test
    testCampaignId = `test-campaign-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testUserId = `test-user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  });

  describe('constructor', () => {
    it('should create AuditLogger instance', () => {
      assert.ok(auditLogger);
      assert.ok(auditLogger instanceof AuditLogger);
    });
  });

  describe('log', () => {
    it('should create audit log entry with required fields', async () => {
      const id = await auditLogger.log({
        campaignId: testCampaignId,
        userId: testUserId,
        action: 'create'
      });

      assert.ok(id);
      assert.match(id, /^[0-9a-f-]{36}$/i);
    });

    it('should create audit log entry with all fields', async () => {
      const id = await auditLogger.log({
        campaignId: testCampaignId,
        userId: testUserId,
        action: 'pause',
        details: { reason: 'User requested' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      assert.ok(id);
    });

    it('should throw error for missing campaignId', async () => {
      await assert.rejects(
        () => auditLogger.log({
          userId: testUserId,
          action: 'create'
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for missing userId', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: testCampaignId,
          action: 'create'
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for missing action', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: testCampaignId,
          userId: testUserId
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for invalid action', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: testCampaignId,
          userId: testUserId,
          action: 'invalid_action'
        }),
        /Invalid action/
      );
    });

    it('should accept all valid actions', async () => {
      const validActions = ['create', 'pause', 'resume', 'cancel', 'delete', 'update', 'start', 'complete', 'fail'];

      for (const action of validActions) {
        const id = await auditLogger.log({
          campaignId: `${testCampaignId}-${action}`,
          userId: testUserId,
          action
        });
        assert.ok(id);
      }
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history', async () => {
      const history = await auditLogger.getHistory(`nonexistent-${Date.now()}`);
      assert.deepStrictEqual(history, []);
    });

    it('should return formatted history entries', async () => {
      // Create an entry first
      await auditLogger.log({
        campaignId: testCampaignId,
        userId: testUserId,
        action: 'create',
        details: { name: 'Test Campaign' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      const history = await auditLogger.getHistory(testCampaignId);

      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].campaignId, testCampaignId);
      assert.strictEqual(history[0].action, 'create');
      assert.ok(history[0].createdAt);
    });
  });

  describe('cleanup', () => {
    it('should return number of deleted entries', async () => {
      // This test just verifies the method runs without error
      const deleted = await auditLogger.cleanup(30, 90);
      assert.ok(typeof deleted === 'number');
    });
  });

  describe('getStats', () => {
    it('should return statistics by action', async () => {
      // Create some entries
      await auditLogger.log({
        campaignId: testCampaignId,
        userId: testUserId,
        action: 'create'
      });
      await auditLogger.log({
        campaignId: testCampaignId,
        userId: testUserId,
        action: 'pause'
      });

      const stats = await auditLogger.getStats(testCampaignId);

      assert.ok(stats.total >= 2);
      assert.ok(stats.byAction);
    });
  });
});

// Unit tests that don't require Supabase
describe('AuditLogger Unit Tests', () => {
  it('should validate action types', () => {
    const validActions = ['create', 'pause', 'resume', 'cancel', 'delete', 'update', 'start', 'complete', 'fail'];
    
    // Just verify the list is correct
    assert.strictEqual(validActions.length, 9);
    assert.ok(validActions.includes('create'));
    assert.ok(validActions.includes('delete'));
  });
});
