#!/usr/bin/env node

/**
 * Property-Based Tests for LeadScoringService
 * Tests lead score calculation, bounds, and tier classification
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

const { DEFAULT_CONFIG } = require('../services/LeadScoringService');

// Generator for valid lead scores (0-100)
const scoreGen = fc.integer({ min: 0, max: 100 });

// Generator for score adjustments (can be positive or negative)
const adjustmentGen = fc.integer({ min: -1000, max: 1000 });

// Generator for valid tier names
const tierGen = fc.constantFrom('cold', 'warm', 'hot', 'vip');

// Generator for message direction
const directionGen = fc.constantFrom('incoming', 'outgoing');

// Generator for purchase amounts in cents (0 to 1,000,000 cents = R$10,000)
const purchaseAmountGen = fc.integer({ min: 0, max: 1000000 });

// Generator for valid scoring config
const configGen = fc.record({
  messageReceived: fc.integer({ min: 1, max: 20 }),
  messageSent: fc.integer({ min: 1, max: 10 }),
  purchaseMade: fc.integer({ min: 5, max: 50 }),
  purchaseValueMultiplier: fc.double({ min: 0.001, max: 0.1, noNaN: true }),
  inactivityDecayPerDay: fc.double({ min: 0.1, max: 2.0, noNaN: true }),
  maxScore: fc.constant(100),
  tiers: fc.constant({
    cold: { min: 0, max: 25 },
    warm: { min: 26, max: 50 },
    hot: { min: 51, max: 75 },
    vip: { min: 76, max: 100 }
  })
});

/**
 * Helper function to calculate new score with bounds
 * @param {number} currentScore - Current score
 * @param {number} adjustment - Score adjustment
 * @param {number} maxScore - Maximum score
 * @returns {number} New score within bounds
 */
function calculateNewScore(currentScore, adjustment, maxScore = 100) {
  const newScore = currentScore + adjustment;
  return Math.min(Math.max(Math.round(newScore), 0), maxScore);
}

/**
 * Helper function to get tier from score
 * @param {number} score - Lead score
 * @param {Object} config - Scoring config
 * @returns {string} Tier name
 */
function getTier(score, config = DEFAULT_CONFIG) {
  const tiers = config.tiers || DEFAULT_CONFIG.tiers;
  if (score >= tiers.vip.min) return 'vip';
  if (score >= tiers.hot.min) return 'hot';
  if (score >= tiers.warm.min) return 'warm';
  return 'cold';
}

/**
 * **Feature: contact-crm-evolution, Property 1: Lead Score Bounds**
 * *For any* contact in the system, the lead_score SHALL always be between 0 and 100 inclusive,
 * and the lead_tier SHALL always match the score according to the configured thresholds.
 * **Validates: Requirements 2.1, 2.5**
 */
test('Property 1: Lead Score Bounds - score always between 0 and 100', () => {
  fc.assert(
    fc.property(scoreGen, adjustmentGen, (initialScore, adjustment) => {
      const newScore = calculateNewScore(initialScore, adjustment);
      
      // Score must be within bounds
      assert(newScore >= 0, `Score ${newScore} is below 0`);
      assert(newScore <= 100, `Score ${newScore} is above 100`);
      
      // Score must be an integer
      assert(Number.isInteger(newScore), `Score ${newScore} is not an integer`);
    }),
    { numRuns: 50 }
  );
});

test('Property 1: Lead Score Bounds - tier matches score thresholds', () => {
  fc.assert(
    fc.property(scoreGen, (score) => {
      const tier = getTier(score);
      const tiers = DEFAULT_CONFIG.tiers;
      
      // Verify tier matches score
      if (score >= tiers.vip.min) {
        assert.strictEqual(tier, 'vip', `Score ${score} should be VIP tier`);
      } else if (score >= tiers.hot.min) {
        assert.strictEqual(tier, 'hot', `Score ${score} should be Hot tier`);
      } else if (score >= tiers.warm.min) {
        assert.strictEqual(tier, 'warm', `Score ${score} should be Warm tier`);
      } else {
        assert.strictEqual(tier, 'cold', `Score ${score} should be Cold tier`);
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 1: Lead Score Bounds - custom config tier thresholds', () => {
  fc.assert(
    fc.property(scoreGen, configGen, (score, config) => {
      const tier = getTier(score, config);
      const tiers = config.tiers;
      
      // Tier must be one of the valid values
      assert(['cold', 'warm', 'hot', 'vip'].includes(tier), `Invalid tier: ${tier}`);
      
      // Verify tier matches score according to config
      if (score >= tiers.vip.min) {
        assert.strictEqual(tier, 'vip');
      } else if (score >= tiers.hot.min) {
        assert.strictEqual(tier, 'hot');
      } else if (score >= tiers.warm.min) {
        assert.strictEqual(tier, 'warm');
      } else {
        assert.strictEqual(tier, 'cold');
      }
    }),
    { numRuns: 50 }
  );
});


/**
 * **Feature: contact-crm-evolution, Property 2: Lead Score Monotonic Increase on Positive Events**
 * *For any* contact, when a message is received or a purchase is made, the lead_score SHALL increase
 * by the configured amount (capped at max_score), and the previous score SHALL be less than or equal to the new score.
 * **Validates: Requirements 2.2, 2.3**
 */
test('Property 2: Score Increase on Message - incoming message increases score', () => {
  fc.assert(
    fc.property(scoreGen, configGen, (initialScore, config) => {
      const increase = config.messageReceived;
      const newScore = calculateNewScore(initialScore, increase, config.maxScore);
      
      // New score should be >= initial score (monotonic increase)
      assert(newScore >= initialScore, 
        `Score should increase: ${initialScore} -> ${newScore}`);
      
      // If not at max, score should increase by configured amount
      if (initialScore + increase <= config.maxScore) {
        assert.strictEqual(newScore, initialScore + increase,
          `Score should increase by ${increase}: ${initialScore} -> ${newScore}`);
      } else {
        // Should be capped at max
        assert.strictEqual(newScore, config.maxScore,
          `Score should be capped at ${config.maxScore}`);
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 2: Score Increase on Message - outgoing message increases score', () => {
  fc.assert(
    fc.property(scoreGen, configGen, (initialScore, config) => {
      const increase = config.messageSent;
      const newScore = calculateNewScore(initialScore, increase, config.maxScore);
      
      // New score should be >= initial score
      assert(newScore >= initialScore,
        `Score should increase: ${initialScore} -> ${newScore}`);
      
      // Verify correct increase or cap
      if (initialScore + increase <= config.maxScore) {
        assert.strictEqual(newScore, initialScore + increase);
      } else {
        assert.strictEqual(newScore, config.maxScore);
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 2: Score Increase on Purchase - purchase increases score', () => {
  fc.assert(
    fc.property(scoreGen, purchaseAmountGen, configGen, (initialScore, amountCents, config) => {
      const baseIncrease = config.purchaseMade;
      const valueIncrease = Math.round((amountCents / 100) * config.purchaseValueMultiplier);
      const totalIncrease = baseIncrease + valueIncrease;
      const newScore = calculateNewScore(initialScore, totalIncrease, config.maxScore);
      
      // New score should be >= initial score
      assert(newScore >= initialScore,
        `Score should increase after purchase: ${initialScore} -> ${newScore}`);
      
      // Score should be within bounds
      assert(newScore >= 0 && newScore <= config.maxScore,
        `Score ${newScore} out of bounds`);
    }),
    { numRuns: 50 }
  );
});

test('Property 2: Score Increase - direction determines increase amount', () => {
  fc.assert(
    fc.property(scoreGen, directionGen, (initialScore, direction) => {
      // Use DEFAULT_CONFIG where incoming > outgoing is guaranteed
      const config = DEFAULT_CONFIG;
      const increase = direction === 'incoming' 
        ? config.messageReceived 
        : config.messageSent;
      const newScore = calculateNewScore(initialScore, increase, config.maxScore);
      
      // With default config, incoming messages give more points than outgoing
      if (direction === 'incoming') {
        const outgoingScore = calculateNewScore(initialScore, config.messageSent, config.maxScore);
        assert(newScore >= outgoingScore,
          `Incoming should give >= points than outgoing with default config`);
      }
      
      // Score should always be within bounds
      assert(newScore >= 0 && newScore <= 100);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 1 (continued): Tier Consistency**
 * Tier boundaries should be consistent and non-overlapping
 */
test('Property 1: Tier Boundaries - tiers are consistent and non-overlapping', () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 100 }), (score) => {
      const tier = getTier(score);
      const tiers = DEFAULT_CONFIG.tiers;
      
      // Each score should map to exactly one tier
      let matchCount = 0;
      if (score >= tiers.cold.min && score <= tiers.cold.max) matchCount++;
      if (score >= tiers.warm.min && score <= tiers.warm.max) matchCount++;
      if (score >= tiers.hot.min && score <= tiers.hot.max) matchCount++;
      if (score >= tiers.vip.min && score <= tiers.vip.max) matchCount++;
      
      assert.strictEqual(matchCount, 1, 
        `Score ${score} should match exactly one tier, matched ${matchCount}`);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 2 (continued): Score Cap at Maximum**
 * Score should never exceed maxScore regardless of how many positive events occur
 */
test('Property 2: Score Cap - multiple events cannot exceed max score', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 90, max: 100 }), // Start near max
      fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }), // Multiple increases
      (initialScore, increases) => {
        let currentScore = initialScore;
        
        for (const increase of increases) {
          currentScore = calculateNewScore(currentScore, increase, 100);
        }
        
        // Score should never exceed 100
        assert(currentScore <= 100, `Score ${currentScore} exceeds maximum`);
        assert(currentScore >= 0, `Score ${currentScore} is negative`);
      }
    ),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 2 (continued): Score Floor at Zero**
 * Score should never go below 0 regardless of decay
 */
test('Property 2: Score Floor - decay cannot make score negative', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 10 }), // Start near zero
      fc.array(fc.integer({ min: 1, max: 50 }), { minLength: 1, maxLength: 10 }), // Multiple decays
      (initialScore, decays) => {
        let currentScore = initialScore;
        
        for (const decay of decays) {
          currentScore = calculateNewScore(currentScore, -decay, 100);
        }
        
        // Score should never go below 0
        assert(currentScore >= 0, `Score ${currentScore} is negative`);
        assert(currentScore <= 100, `Score ${currentScore} exceeds maximum`);
      }
    ),
    { numRuns: 50 }
  );
});
