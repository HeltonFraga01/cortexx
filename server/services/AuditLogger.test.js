/**
 * Tests for AuditLogger Service
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const AuditLogger = require('./AuditLogger');

describe('AuditLogger', () => {
  let auditLogger;
  let mockDb;
  let insertedRows;
  let queryResults;

  beforeEach(() => {
    insertedRows = [];
    queryResults = { rows: [] };

    mockDb = {
      query: async (sql, params) => {
        if (sql.includes('INSERT INTO campaign_audit_logs')) {
          insertedRows.push({
            id: params[0],
            campaign_id: params[1],
            user_id: params[2],
            action: params[3],
            details: params[4],
            ip_address: params[5],
            user_agent: params[6]
          });
          return { changes: 1 };
        }
        if (sql.includes('SELECT')) {
          return queryResults;
        }
        if (sql.includes('DELETE')) {
          return { changes: 5 };
        }
        return { rows: [], changes: 0 };
      }
    };

    auditLogger = new AuditLogger(mockDb);
  });

  describe('constructor', () => {
    it('should create AuditLogger instance', () => {
      assert.ok(auditLogger);
      assert.strictEqual(auditLogger.db, mockDb);
    });
  });

  describe('log', () => {
    it('should create audit log entry with required fields', async () => {
      const id = await auditLogger.log({
        campaignId: 'campaign-123',
        userId: 'user-456',
        action: 'create'
      });

      assert.ok(id);
      assert.strictEqual(insertedRows.length, 1);
      assert.strictEqual(insertedRows[0].campaign_id, 'campaign-123');
      assert.strictEqual(insertedRows[0].user_id, 'user-456');
      assert.strictEqual(insertedRows[0].action, 'create');
    });

    it('should create audit log entry with all fields', async () => {
      const id = await auditLogger.log({
        campaignId: 'campaign-123',
        userId: 'user-456',
        action: 'pause',
        details: { reason: 'User requested' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0'
      });

      assert.ok(id);
      assert.strictEqual(insertedRows.length, 1);
      assert.strictEqual(insertedRows[0].action, 'pause');
      assert.strictEqual(insertedRows[0].ip_address, '192.168.1.1');
      assert.strictEqual(insertedRows[0].user_agent, 'Mozilla/5.0');
      assert.strictEqual(insertedRows[0].details, '{"reason":"User requested"}');
    });

    it('should throw error for missing campaignId', async () => {
      await assert.rejects(
        () => auditLogger.log({
          userId: 'user-456',
          action: 'create'
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for missing userId', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: 'campaign-123',
          action: 'create'
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for missing action', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: 'campaign-123',
          userId: 'user-456'
        }),
        /campaignId, userId, and action are required/
      );
    });

    it('should throw error for invalid action', async () => {
      await assert.rejects(
        () => auditLogger.log({
          campaignId: 'campaign-123',
          userId: 'user-456',
          action: 'invalid_action'
        }),
        /Invalid action/
      );
    });

    it('should accept all valid actions', async () => {
      const validActions = ['create', 'pause', 'resume', 'cancel', 'delete', 'update', 'start', 'complete', 'fail'];

      for (const action of validActions) {
        insertedRows = [];
        const id = await auditLogger.log({
          campaignId: 'campaign-123',
          userId: 'user-456',
          action
        });
        assert.ok(id);
        assert.strictEqual(insertedRows[0].action, action);
      }
    });
  });

  describe('getHistory', () => {
    it('should return empty array when no history', async () => {
      queryResults = { rows: [] };
      const history = await auditLogger.getHistory('campaign-123');
      assert.deepStrictEqual(history, []);
    });

    it('should return formatted history entries', async () => {
      queryResults = {
        rows: [
          {
            id: 'log-1',
            campaign_id: 'campaign-123',
            user_id: 'user-456',
            action: 'create',
            details: '{"name":"Test Campaign"}',
            ip_address: '192.168.1.1',
            user_agent: 'Mozilla/5.0',
            created_at: '2025-01-01T00:00:00Z'
          }
        ]
      };

      const history = await auditLogger.getHistory('campaign-123');

      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].id, 'log-1');
      assert.strictEqual(history[0].campaignId, 'campaign-123');
      assert.strictEqual(history[0].action, 'create');
      assert.deepStrictEqual(history[0].details, { name: 'Test Campaign' });
    });
  });

  describe('cleanup', () => {
    it('should return number of deleted entries', async () => {
      const deleted = await auditLogger.cleanup(30, 90);
      assert.strictEqual(deleted, 10); // 5 + 5 from mock
    });
  });

  describe('getStats', () => {
    it('should return statistics by action', async () => {
      queryResults = {
        rows: [
          { action: 'create', count: 10, first_at: '2025-01-01', last_at: '2025-01-10' },
          { action: 'pause', count: 5, first_at: '2025-01-02', last_at: '2025-01-08' }
        ]
      };

      const stats = await auditLogger.getStats();

      assert.strictEqual(stats.total, 15);
      assert.strictEqual(stats.byAction.create.count, 10);
      assert.strictEqual(stats.byAction.pause.count, 5);
    });
  });
});
