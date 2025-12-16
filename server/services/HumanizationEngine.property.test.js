/**
 * Property-Based Tests for HumanizationEngine Service
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const HumanizationEngine = require('./HumanizationEngine');

describe('HumanizationEngine Property-Based Tests', () => {
  /**
   * Feature: disparador-review-cleanup, Property 11: Delay Distribution
   * Validates: Requirements 5.4
   * 
   * For any delay calculation with min and max bounds (both within valid range 5-300),
   * the result SHALL fall within [min*1000, max*1000] range.
   */
  describe('Property 11: Delay Distribution', () => {
    it('delay falls within bounds for all valid min/max combinations', () => {
      fc.assert(
        fc.property(
          // Generate min in valid range [5, 300]
          fc.integer({ min: 5, max: 300 }),
          // Generate max in valid range [5, 300]
          fc.integer({ min: 5, max: 300 }),
          (min, max) => {
            // Filter: min must be <= max for valid input
            if (min > max) {
              return true; // Skip invalid combinations
            }
            
            const delay = HumanizationEngine.calculateDelay(min, max);
            
            // Delay should be in milliseconds within [min*1000, max*1000]
            const minMs = min * 1000;
            const maxMs = max * 1000;
            
            return delay >= minMs && delay <= maxMs;
          }
        ),
        { numRuns: 100 } // Run 100 iterations as specified in design
      );
    });

    it('delay is always a positive integer in milliseconds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 300 }),
          fc.integer({ min: 5, max: 300 }),
          (min, max) => {
            if (min > max) {
              return true; // Skip invalid combinations
            }
            
            const delay = HumanizationEngine.calculateDelay(min, max);
            
            // Delay should be a positive integer
            return Number.isInteger(delay) && delay > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('delay distribution covers the range (not always returning same value)', () => {
      // For a given range, multiple calls should produce different values
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 295 }), // Leave room for max
          (min) => {
            const max = min + 5; // Ensure at least 5 second range
            
            const delays = new Set();
            for (let i = 0; i < 20; i++) {
              delays.add(HumanizationEngine.calculateDelay(min, max));
            }
            
            // Should have at least 2 different values (randomness)
            return delays.size >= 2;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
