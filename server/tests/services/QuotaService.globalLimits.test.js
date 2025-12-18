/**
 * QuotaService Global Limits Validation Tests
 * Tests for multi-tenant global limit validation
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');
const QuotaService = require('../../services/QuotaService');

describe('QuotaService - Global Limits Validation', () => {
  let quotaService;

  // Mock database (minimal for this test)
  const mockDb = {
    query: async () => ({ rows: [] })
  };

  test('should allow quotas within global limits', async () => {
    quotaService = new QuotaService(mockDb);

    const validQuotas = {
      max_agents: 50,
      max_connections: 100,
      max_messages_per_day: 10000,
      max_inboxes: 25
    };

    const result = await quotaService.validateAgainstGlobalLimits(validQuotas);
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test('should reject quotas that exceed global limits', async () => {
    quotaService = new QuotaService(mockDb);

    const invalidQuotas = {
      max_agents: 2000, // Exceeds global limit of 1000
      max_connections: 50,
      max_messages_per_day: 200000, // Exceeds global limit of 100000
      max_inboxes: 25
    };

    const result = await quotaService.validateAgainstGlobalLimits(invalidQuotas);
    
    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.violations.length, 2);
    
    // Check specific violations
    const agentViolation = result.violations.find(v => v.quotaType === 'max_agents');
    assert.strictEqual(agentViolation.value, 2000);
    assert.strictEqual(agentViolation.maxAllowed, 1000);
    
    const messageViolation = result.violations.find(v => v.quotaType === 'max_messages_per_day');
    assert.strictEqual(messageViolation.value, 200000);
    assert.strictEqual(messageViolation.maxAllowed, 100000);
  });

  test('should handle empty quotas object', async () => {
    quotaService = new QuotaService(mockDb);

    const result = await quotaService.validateAgainstGlobalLimits({});
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.violations.length, 0);
  });

  test('should ignore unknown quota types', async () => {
    quotaService = new QuotaService(mockDb);

    const quotasWithUnknown = {
      max_agents: 50,
      unknown_quota_type: 999999, // Should be ignored
      max_connections: 100
    };

    const result = await quotaService.validateAgainstGlobalLimits(quotasWithUnknown);
    
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.violations.length, 0);
  });
});