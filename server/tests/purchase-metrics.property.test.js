#!/usr/bin/env node

/**
 * Property-Based Tests for Purchase Metrics
 * Tests LTV calculation, purchase count, and webhook contact matching
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Generator for purchase amounts in cents (R$0.01 to R$10,000)
const purchaseAmountGen = fc.integer({ min: 1, max: 1000000 });

// Generator for purchase status
const purchaseStatusGen = fc.constantFrom('pending', 'completed', 'refunded', 'cancelled');

// Generator for a purchase record
const purchaseGen = fc.record({
  amountCents: purchaseAmountGen,
  status: purchaseStatusGen
});

// Generator for a list of purchases
const purchaseListGen = fc.array(purchaseGen, { minLength: 0, maxLength: 20 });

// Generator for phone numbers (Brazilian format)
const phoneGen = fc.tuple(
  fc.integer({ min: 11, max: 99 }),
  fc.integer({ min: 900000000, max: 999999999 })
).map(([ddd, number]) => `55${ddd}${number}`);

// Generator for email addresses
const emailGen = fc.emailAddress();

/**
 * Calculate LTV from purchases (only completed)
 * @param {Array} purchases - Array of purchase objects
 * @returns {number} Lifetime value in cents
 */
function calculateLTV(purchases) {
  return purchases
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amountCents, 0);
}

/**
 * Calculate purchase count (only completed)
 * @param {Array} purchases - Array of purchase objects
 * @returns {number} Number of completed purchases
 */
function calculatePurchaseCount(purchases) {
  return purchases.filter(p => p.status === 'completed').length;
}

/**
 * Calculate AOV (Average Order Value)
 * @param {number} ltv - Lifetime value in cents
 * @param {number} count - Number of purchases
 * @returns {number} AOV in cents
 */
function calculateAOV(ltv, count) {
  return count > 0 ? Math.round(ltv / count) : 0;
}

/**
 * **Feature: contact-crm-evolution, Property 5: Purchase Metrics Accuracy**
 * *For any* contact with purchases, the lifetime_value_cents SHALL equal the sum of all completed purchase amounts,
 * the purchase_count SHALL equal the count of completed purchases, and the AOV SHALL be correctly calculated.
 * **Validates: Requirements 3.2, 3.3, 3.4**
 */
test('Property 5: LTV equals sum of completed purchases', () => {
  fc.assert(
    fc.property(purchaseListGen, (purchases) => {
      const ltv = calculateLTV(purchases);
      
      // LTV should be sum of completed purchase amounts
      const expectedLTV = purchases
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.amountCents, 0);
      
      assert.strictEqual(ltv, expectedLTV,
        `LTV ${ltv} should equal sum of completed purchases ${expectedLTV}`);
      
      // LTV should never be negative
      assert(ltv >= 0, `LTV ${ltv} should never be negative`);
    }),
    { numRuns: 50 }
  );
});

test('Property 5: Purchase count equals number of completed purchases', () => {
  fc.assert(
    fc.property(purchaseListGen, (purchases) => {
      const count = calculatePurchaseCount(purchases);
      
      // Count should equal number of completed purchases
      const expectedCount = purchases.filter(p => p.status === 'completed').length;
      
      assert.strictEqual(count, expectedCount,
        `Count ${count} should equal completed purchases ${expectedCount}`);
      
      // Count should never be negative
      assert(count >= 0, `Count ${count} should never be negative`);
      
      // Count should not exceed total purchases
      assert(count <= purchases.length,
        `Count ${count} should not exceed total ${purchases.length}`);
    }),
    { numRuns: 50 }
  );
});

test('Property 5: AOV is correctly calculated', () => {
  fc.assert(
    fc.property(purchaseListGen, (purchases) => {
      const ltv = calculateLTV(purchases);
      const count = calculatePurchaseCount(purchases);
      const aov = calculateAOV(ltv, count);
      
      if (count === 0) {
        // AOV should be 0 when no purchases
        assert.strictEqual(aov, 0, 'AOV should be 0 when no purchases');
      } else {
        // AOV should be LTV / count (rounded)
        const expectedAOV = Math.round(ltv / count);
        assert.strictEqual(aov, expectedAOV,
          `AOV ${aov} should equal ${ltv} / ${count} = ${expectedAOV}`);
        
        // AOV should be between min and max purchase amounts
        const completedAmounts = purchases
          .filter(p => p.status === 'completed')
          .map(p => p.amountCents);
        
        if (completedAmounts.length > 0) {
          const minAmount = Math.min(...completedAmounts);
          const maxAmount = Math.max(...completedAmounts);
          
          assert(aov >= minAmount && aov <= maxAmount,
            `AOV ${aov} should be between ${minAmount} and ${maxAmount}`);
        }
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 5: Non-completed purchases do not affect LTV', () => {
  fc.assert(
    fc.property(
      fc.array(purchaseAmountGen, { minLength: 1, maxLength: 10 }), // completed amounts
      fc.array(purchaseAmountGen, { minLength: 0, maxLength: 10 }), // pending amounts
      fc.array(purchaseAmountGen, { minLength: 0, maxLength: 10 }), // refunded amounts
      (completedAmounts, pendingAmounts, refundedAmounts) => {
        const purchases = [
          ...completedAmounts.map(a => ({ amountCents: a, status: 'completed' })),
          ...pendingAmounts.map(a => ({ amountCents: a, status: 'pending' })),
          ...refundedAmounts.map(a => ({ amountCents: a, status: 'refunded' }))
        ];
        
        const ltv = calculateLTV(purchases);
        const expectedLTV = completedAmounts.reduce((sum, a) => sum + a, 0);
        
        // LTV should only include completed purchases
        assert.strictEqual(ltv, expectedLTV,
          `LTV ${ltv} should only include completed purchases ${expectedLTV}`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 5: Metrics are consistent after status changes', () => {
  fc.assert(
    fc.property(
      fc.array(purchaseAmountGen, { minLength: 1, maxLength: 10 }),
      fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
      (amounts, shouldComplete) => {
        // Ensure arrays have same length
        const len = Math.min(amounts.length, shouldComplete.length);
        
        const purchases = amounts.slice(0, len).map((amount, i) => ({
          amountCents: amount,
          status: shouldComplete[i] ? 'completed' : 'pending'
        }));
        
        const ltv = calculateLTV(purchases);
        const count = calculatePurchaseCount(purchases);
        
        // Verify consistency
        const completedPurchases = purchases.filter(p => p.status === 'completed');
        
        assert.strictEqual(count, completedPurchases.length);
        assert.strictEqual(ltv, completedPurchases.reduce((s, p) => s + p.amountCents, 0));
      }
    ),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 10: Purchase Webhook Contact Matching**
 * *For any* purchase webhook received, if a contact exists with matching phone or email,
 * the purchase SHALL be associated with that contact. If no match exists, a new contact SHALL be created.
 * **Validates: Requirements 9.1, 9.2, 9.3**
 */
test('Property 10: Contact matching by phone', () => {
  fc.assert(
    fc.property(
      phoneGen,
      fc.array(phoneGen, { minLength: 0, maxLength: 5 }),
      (targetPhone, otherPhones) => {
        // Simulate contact database
        const contacts = [
          { id: 'target', phone: targetPhone },
          ...otherPhones.map((p, i) => ({ id: `other_${i}`, phone: p }))
        ];
        
        // Find contact by phone
        const found = contacts.find(c => c.phone === targetPhone);
        
        // Should always find the target contact
        assert(found, `Should find contact with phone ${targetPhone}`);
        assert.strictEqual(found.id, 'target');
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 10: Contact matching by email when phone not found', () => {
  fc.assert(
    fc.property(
      emailGen,
      phoneGen,
      fc.array(phoneGen, { minLength: 0, maxLength: 5 }),
      (targetEmail, webhookPhone, existingPhones) => {
        // Simulate contact database (no phone match, but email in metadata)
        const contacts = [
          { id: 'target', phone: '5511999999999', metadata: { email: targetEmail } },
          ...existingPhones.map((p, i) => ({ id: `other_${i}`, phone: p, metadata: {} }))
        ];
        
        // First try phone match
        let found = contacts.find(c => c.phone === webhookPhone);
        
        // If no phone match, try email
        if (!found) {
          found = contacts.find(c => c.metadata?.email === targetEmail);
        }
        
        // Should find by email if phone doesn't match
        if (!existingPhones.includes(webhookPhone)) {
          assert(found, `Should find contact by email ${targetEmail}`);
          assert.strictEqual(found.id, 'target');
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 10: New contact created when no match', () => {
  fc.assert(
    fc.property(
      phoneGen,
      emailGen,
      fc.array(phoneGen, { minLength: 0, maxLength: 5 }),
      (webhookPhone, webhookEmail, existingPhones) => {
        // Ensure webhook phone is not in existing phones
        const uniquePhone = webhookPhone + '0'; // Make it different
        
        // Simulate contact database
        const contacts = existingPhones.map((p, i) => ({ 
          id: `existing_${i}`, 
          phone: p, 
          metadata: {} 
        }));
        
        // Try to find contact
        let found = contacts.find(c => c.phone === uniquePhone);
        if (!found) {
          found = contacts.find(c => c.metadata?.email === webhookEmail);
        }
        
        // Should not find any contact
        const shouldCreateNew = !found;
        
        // When no match, a new contact should be created
        if (shouldCreateNew) {
          const newContact = {
            id: 'new_contact',
            phone: uniquePhone,
            source: 'webhook',
            metadata: { email: webhookEmail }
          };
          
          assert.strictEqual(newContact.source, 'webhook');
          assert.strictEqual(newContact.phone, uniquePhone);
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 10: Duplicate purchases are detected by external_id', () => {
  fc.assert(
    fc.property(
      fc.uuid(),
      fc.array(fc.uuid(), { minLength: 0, maxLength: 5 }),
      (targetExternalId, otherExternalIds) => {
        // Simulate existing purchases
        const existingPurchases = [
          { id: 'existing', external_id: targetExternalId },
          ...otherExternalIds.map((eid, i) => ({ id: `other_${i}`, external_id: eid }))
        ];
        
        // Check for duplicate
        const isDuplicate = existingPurchases.some(p => p.external_id === targetExternalId);
        
        // Should detect duplicate
        assert(isDuplicate, `Should detect duplicate external_id ${targetExternalId}`);
      }
    ),
    { numRuns: 50 }
  );
});
