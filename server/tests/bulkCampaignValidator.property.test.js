/**
 * Property-Based Tests for bulkCampaignValidator
 * 
 * Uses fast-check for property-based testing to verify correctness properties
 * that should hold across all valid inputs.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { isValidPhoneNumber, validateFutureDate } = require('../validators/bulkCampaignValidator');

describe('bulkCampaignValidator Property-Based Tests', () => {
  /**
   * Feature: disparador-review-cleanup, Property 12: Phone Number Validation
   * Validates: Requirements 6.3
   * 
   * For any valid phone number format (10-15 digits, with or without country code),
   * validation SHALL accept the number.
   */
  describe('Property 12: Phone Number Validation', () => {
    // Arbitrary for valid digit count (10-15)
    const validDigitCountArb = fc.integer({ min: 10, max: 15 });

    it('accepts phone numbers with 10-15 digits', () => {
      fc.assert(
        fc.property(
          validDigitCountArb,
          (digitCount) => {
            // Generate a phone number with exactly digitCount digits
            const phone = '1'.repeat(digitCount);
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts phone numbers with spaces between digits', () => {
      fc.assert(
        fc.property(
          validDigitCountArb,
          fc.integer({ min: 1, max: 5 }), // number of spaces to insert
          (digitCount, spaceCount) => {
            // Generate base phone number
            const digits = '1'.repeat(digitCount);
            
            // Insert spaces at random positions
            let phone = digits;
            for (let i = 0; i < spaceCount && phone.length > 2; i++) {
              const pos = Math.floor(phone.length / 2);
              phone = phone.slice(0, pos) + ' ' + phone.slice(pos);
            }
            
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });


    it('accepts phone numbers with dashes', () => {
      fc.assert(
        fc.property(
          validDigitCountArb,
          (digitCount) => {
            // Generate phone number with dashes (common format)
            const digits = '1'.repeat(digitCount);
            // Insert dashes at typical positions
            let phone = digits;
            if (digitCount >= 10) {
              phone = digits.slice(0, 2) + '-' + digits.slice(2, 6) + '-' + digits.slice(6);
            }
            
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts phone numbers with parentheses', () => {
      fc.assert(
        fc.property(
          validDigitCountArb,
          (digitCount) => {
            // Generate phone number with parentheses (area code format)
            const digits = '1'.repeat(digitCount);
            // Format like (XX) XXXXX-XXXX
            let phone = digits;
            if (digitCount >= 10) {
              phone = '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
            }
            
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects phone numbers with less than 10 digits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 9 }),
          (digitCount) => {
            const phone = '1'.repeat(digitCount);
            const result = isValidPhoneNumber(phone);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects phone numbers with more than 15 digits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 16, max: 25 }),
          (digitCount) => {
            const phone = '1'.repeat(digitCount);
            const result = isValidPhoneNumber(phone);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects phone numbers containing letters', () => {
      fc.assert(
        fc.property(
          validDigitCountArb,
          fc.integer({ min: 0, max: 9 }), // position to insert letter
          fc.constantFrom('a', 'b', 'c', 'A', 'B', 'C', 'x', 'X'),
          (digitCount, insertPos, letter) => {
            const digits = '1'.repeat(digitCount);
            const pos = Math.min(insertPos, digits.length);
            const phone = digits.slice(0, pos) + letter + digits.slice(pos);
            
            const result = isValidPhoneNumber(phone);
            return result === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects empty strings', () => {
      const result = isValidPhoneNumber('');
      assert.strictEqual(result, false);
    });

    it('rejects strings with only spaces', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (spaceCount) => {
            const phone = ' '.repeat(spaceCount);
            const result = isValidPhoneNumber(phone);
            return result === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('accepts Brazilian phone formats (11 digits with country code)', () => {
      // Brazilian format: +55 (XX) XXXXX-XXXX = 13 digits
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 99 }), // DDD (area code)
          fc.integer({ min: 90000, max: 99999 }), // first part
          fc.integer({ min: 0, max: 9999 }), // second part
          (ddd, first, second) => {
            const phone = `55${ddd}${first}${second.toString().padStart(4, '0')}`;
            // This should be 13 digits (55 + 2 + 5 + 4)
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts international formats with various digit counts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 3 }), // country code length
          fc.integer({ min: 7, max: 12 }), // local number length
          (countryCodeLen, localLen) => {
            const totalDigits = countryCodeLen + localLen;
            // Only test if total is within valid range
            if (totalDigits < 10 || totalDigits > 15) return true;
            
            const countryCode = '1'.repeat(countryCodeLen);
            const localNumber = '2'.repeat(localLen);
            const phone = countryCode + localNumber;
            
            const result = isValidPhoneNumber(phone);
            return result === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });


  /**
   * Feature: disparador-review-cleanup, Property 13: Future Date Validation
   * Validates: Requirements 6.4
   * 
   * For any scheduled campaign, the scheduledAt date SHALL be validated to be in the future.
   * Past dates SHALL be rejected.
   */
  describe('Property 13: Future Date Validation', () => {
    // Fixed reference date for deterministic testing
    const referenceDate = new Date('2025-06-15T12:00:00.000Z');
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;

    it('accepts dates that are in the future (within 1 year)', () => {
      fc.assert(
        fc.property(
          // Generate offset in milliseconds: 1 minute to 364 days in the future
          fc.integer({ min: 60 * 1000, max: 364 * 24 * 60 * 60 * 1000 }),
          (offsetMs) => {
            const futureDate = new Date(referenceDate.getTime() + offsetMs);
            const result = validateFutureDate(futureDate.toISOString(), referenceDate);
            return result.valid === true && result.errors.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects dates that are in the past', () => {
      fc.assert(
        fc.property(
          // Generate offset in milliseconds: 1 minute to 10 years in the past
          fc.integer({ min: 60 * 1000, max: 10 * 365 * 24 * 60 * 60 * 1000 }),
          (offsetMs) => {
            const pastDate = new Date(referenceDate.getTime() - offsetMs);
            const result = validateFutureDate(pastDate.toISOString(), referenceDate);
            return result.valid === false && 
                   result.errors.some(e => e.includes('passado'));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects dates that are exactly at the reference time', () => {
      const result = validateFutureDate(referenceDate.toISOString(), referenceDate);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('passado')));
    });

    it('rejects dates more than 1 year in the future', () => {
      fc.assert(
        fc.property(
          // Generate offset: 1 year + 1 day to 5 years in the future
          fc.integer({ min: oneYearMs + 24 * 60 * 60 * 1000, max: 5 * oneYearMs }),
          (offsetMs) => {
            const farFutureDate = new Date(referenceDate.getTime() + offsetMs);
            const result = validateFutureDate(farFutureDate.toISOString(), referenceDate);
            return result.valid === false && 
                   result.errors.some(e => e.includes('1 ano'));
          }
        ),
        { numRuns: 100 }
      );
    });

    it('accepts dates at the boundary (just under 1 year)', () => {
      // 364 days, 23 hours, 59 minutes in the future
      const almostOneYear = 364 * 24 * 60 * 60 * 1000 + 23 * 60 * 60 * 1000 + 59 * 60 * 1000;
      const boundaryDate = new Date(referenceDate.getTime() + almostOneYear);
      const result = validateFutureDate(boundaryDate.toISOString(), referenceDate);
      assert.strictEqual(result.valid, true);
    });

    it('rejects invalid date strings', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('not-a-date'),
            fc.constant('2025-13-45'), // invalid month/day
            fc.constant('abc123'),
            fc.constant('invalid-date-format'),
            fc.constant('99/99/9999'),
            fc.constant('hello world'),
            // Generate random alphanumeric strings
            fc.string({ minLength: 5, maxLength: 20 }).filter(s => isNaN(new Date(s).getTime()))
          ),
          (invalidDate) => {
            const result = validateFutureDate(invalidDate, referenceDate);
            // Should either be invalid date or past date error
            return result.valid === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('rejects null and undefined values', () => {
      const nullResult = validateFutureDate(null, referenceDate);
      assert.strictEqual(nullResult.valid, false);
      assert.ok(nullResult.errors.some(e => e.includes('obrigatória')));

      const undefinedResult = validateFutureDate(undefined, referenceDate);
      assert.strictEqual(undefinedResult.valid, false);
      assert.ok(undefinedResult.errors.some(e => e.includes('obrigatória')));
    });

    it('accepts Date objects as input', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60 * 1000, max: 364 * 24 * 60 * 60 * 1000 }),
          (offsetMs) => {
            const futureDate = new Date(referenceDate.getTime() + offsetMs);
            // Pass Date object directly instead of ISO string
            const result = validateFutureDate(futureDate, referenceDate);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles various valid ISO date formats', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 364 }), // days in future
          fc.integer({ min: 0, max: 23 }), // hours
          fc.integer({ min: 0, max: 59 }), // minutes
          fc.integer({ min: 0, max: 59 }), // seconds
          (days, hours, minutes, seconds) => {
            const futureDate = new Date(referenceDate);
            futureDate.setDate(futureDate.getDate() + days);
            futureDate.setHours(hours, minutes, seconds, 0);
            
            // Only test if still in valid range
            if (futureDate <= referenceDate) return true;
            if (futureDate > new Date(referenceDate.getTime() + oneYearMs)) return true;
            
            const result = validateFutureDate(futureDate.toISOString(), referenceDate);
            return result.valid === true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
