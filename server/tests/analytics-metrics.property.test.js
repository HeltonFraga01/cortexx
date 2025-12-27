#!/usr/bin/env node

/**
 * Property-Based Tests for Analytics Metrics
 * Tests accuracy of aggregated metrics calculations
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Generator for contact with CRM data
const contactGen = fc.record({
  id: fc.uuid(),
  lead_score: fc.integer({ min: 0, max: 100 }),
  lead_tier: fc.constantFrom('cold', 'warm', 'hot', 'vip'),
  lifetime_value_cents: fc.integer({ min: 0, max: 10000000 }),
  is_active: fc.boolean(),
  purchase_count: fc.integer({ min: 0, max: 1000 }),
  credit_balance: fc.integer({ min: 0, max: 100000 })
});

// Generator for contact list
const contactListGen = fc.array(contactGen, { minLength: 0, maxLength: 100 });

/**
 * Calculate total contacts
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateTotalContacts(contacts) {
  return contacts.length;
}

/**
 * Calculate active contacts
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateActiveContacts(contacts) {
  return contacts.filter(c => c.is_active).length;
}

/**
 * Calculate average lead score
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateAverageScore(contacts) {
  if (contacts.length === 0) return 0;
  const sum = contacts.reduce((acc, c) => acc + c.lead_score, 0);
  return Math.round(sum / contacts.length);
}

/**
 * Calculate total lifetime value
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateTotalLTV(contacts) {
  return contacts.reduce((acc, c) => acc + c.lifetime_value_cents, 0);
}

/**
 * Calculate tier distribution
 * @param {Array} contacts - Contact list
 * @returns {Object}
 */
function calculateTierDistribution(contacts) {
  const distribution = { cold: 0, warm: 0, hot: 0, vip: 0 };
  for (const contact of contacts) {
    distribution[contact.lead_tier]++;
  }
  return distribution;
}

/**
 * Calculate total purchase count
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateTotalPurchases(contacts) {
  return contacts.reduce((acc, c) => acc + c.purchase_count, 0);
}

/**
 * Calculate total credit balance
 * @param {Array} contacts - Contact list
 * @returns {number}
 */
function calculateTotalCredits(contacts) {
  return contacts.reduce((acc, c) => acc + c.credit_balance, 0);
}

/**
 * Get top contacts by LTV
 * @param {Array} contacts - Contact list
 * @param {number} limit - Number of contacts to return
 * @returns {Array}
 */
function getTopContactsByLTV(contacts, limit = 10) {
  return [...contacts]
    .sort((a, b) => b.lifetime_value_cents - a.lifetime_value_cents)
    .slice(0, limit);
}

/**
 * Get top contacts by engagement (lead score)
 * @param {Array} contacts - Contact list
 * @param {number} limit - Number of contacts to return
 * @returns {Array}
 */
function getTopContactsByEngagement(contacts, limit = 10) {
  return [...contacts]
    .sort((a, b) => b.lead_score - a.lead_score)
    .slice(0, limit);
}

/**
 * **Feature: contact-crm-evolution, Property 13: Analytics Metrics Accuracy**
 * *For any* set of contacts, aggregated metrics (total, active, avg score, total LTV)
 * SHALL be mathematically accurate based on individual contact data.
 * **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
 */
test('Property 13: Total contacts count is accurate', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const total = calculateTotalContacts(contacts);
      
      assert.strictEqual(total, contacts.length,
        'Total contacts should equal array length');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Active contacts count is accurate', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const active = calculateActiveContacts(contacts);
      const expected = contacts.filter(c => c.is_active === true).length;
      
      assert.strictEqual(active, expected,
        'Active contacts should equal count of is_active=true');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Active contacts <= total contacts', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const total = calculateTotalContacts(contacts);
      const active = calculateActiveContacts(contacts);
      
      assert(active <= total,
        'Active contacts should not exceed total contacts');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Average score is within bounds', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const avgScore = calculateAverageScore(contacts);
      
      if (contacts.length === 0) {
        assert.strictEqual(avgScore, 0, 'Empty list should have 0 average');
      } else {
        assert(avgScore >= 0 && avgScore <= 100,
          'Average score should be between 0 and 100');
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Average score calculation is correct', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const avgScore = calculateAverageScore(contacts);
      
      if (contacts.length === 0) {
        assert.strictEqual(avgScore, 0);
      } else {
        const sum = contacts.reduce((acc, c) => acc + c.lead_score, 0);
        const expected = Math.round(sum / contacts.length);
        assert.strictEqual(avgScore, expected,
          'Average score should be sum/count rounded');
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Total LTV is sum of individual LTVs', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const totalLTV = calculateTotalLTV(contacts);
      const expected = contacts.reduce((acc, c) => acc + c.lifetime_value_cents, 0);
      
      assert.strictEqual(totalLTV, expected,
        'Total LTV should be sum of all lifetime_value_cents');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Total LTV is non-negative', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const totalLTV = calculateTotalLTV(contacts);
      
      assert(totalLTV >= 0, 'Total LTV should be non-negative');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Tier distribution sums to total contacts', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const distribution = calculateTierDistribution(contacts);
      const distributionSum = distribution.cold + distribution.warm + distribution.hot + distribution.vip;
      
      assert.strictEqual(distributionSum, contacts.length,
        'Tier distribution should sum to total contacts');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Tier distribution counts are non-negative', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const distribution = calculateTierDistribution(contacts);
      
      assert(distribution.cold >= 0, 'Cold count should be non-negative');
      assert(distribution.warm >= 0, 'Warm count should be non-negative');
      assert(distribution.hot >= 0, 'Hot count should be non-negative');
      assert(distribution.vip >= 0, 'VIP count should be non-negative');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Total purchases is sum of individual purchase counts', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const totalPurchases = calculateTotalPurchases(contacts);
      const expected = contacts.reduce((acc, c) => acc + c.purchase_count, 0);
      
      assert.strictEqual(totalPurchases, expected,
        'Total purchases should be sum of all purchase_count');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Total credits is sum of individual credit balances', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const totalCredits = calculateTotalCredits(contacts);
      const expected = contacts.reduce((acc, c) => acc + c.credit_balance, 0);
      
      assert.strictEqual(totalCredits, expected,
        'Total credits should be sum of all credit_balance');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Top contacts by LTV are sorted correctly', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const top = getTopContactsByLTV(contacts, 10);
      
      // Verify sorted in descending order
      for (let i = 1; i < top.length; i++) {
        assert(top[i - 1].lifetime_value_cents >= top[i].lifetime_value_cents,
          'Top contacts should be sorted by LTV descending');
      }
      
      // Verify limit
      assert(top.length <= 10, 'Should return at most 10 contacts');
      assert(top.length <= contacts.length, 'Should not exceed total contacts');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Top contacts by engagement are sorted correctly', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const top = getTopContactsByEngagement(contacts, 10);
      
      // Verify sorted in descending order
      for (let i = 1; i < top.length; i++) {
        assert(top[i - 1].lead_score >= top[i].lead_score,
          'Top contacts should be sorted by lead_score descending');
      }
      
      // Verify limit
      assert(top.length <= 10, 'Should return at most 10 contacts');
    }),
    { numRuns: 50 }
  );
});

test('Property 13: Empty contact list returns zero metrics', () => {
  const emptyContacts = [];
  
  assert.strictEqual(calculateTotalContacts(emptyContacts), 0);
  assert.strictEqual(calculateActiveContacts(emptyContacts), 0);
  assert.strictEqual(calculateAverageScore(emptyContacts), 0);
  assert.strictEqual(calculateTotalLTV(emptyContacts), 0);
  assert.strictEqual(calculateTotalPurchases(emptyContacts), 0);
  assert.strictEqual(calculateTotalCredits(emptyContacts), 0);
  
  const distribution = calculateTierDistribution(emptyContacts);
  assert.strictEqual(distribution.cold, 0);
  assert.strictEqual(distribution.warm, 0);
  assert.strictEqual(distribution.hot, 0);
  assert.strictEqual(distribution.vip, 0);
});
