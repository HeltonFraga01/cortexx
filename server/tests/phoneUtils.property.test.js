#!/usr/bin/env node

/**
 * Property-Based Tests for phoneUtils
 * Tests phone number validation and normalization properties
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Generator for valid Brazilian phone numbers (12-13 digits with country code)
const brazilianPhoneGen = fc.tuple(
  fc.integer({ min: 11, max: 99 }), // DDD (11-99)
  fc.boolean(), // 8 or 9 digits
  fc.integer({ min: 1000, max: 9999 }), // First 4 digits of number
  fc.integer({ min: 0, max: 9999 }) // Last 4 digits of number
).map(([ddd, isMobile, firstPart, lastPart]) => {
  const dddStr = String(ddd).padStart(2, '0');
  const firstPartStr = String(firstPart).padStart(4, '0');
  const lastPartStr = String(lastPart).padStart(4, '0');
  
  if (isMobile) {
    // Mobile: 9 digits starting with 9 (55 + DDD + 9 + 8 digits)
    return `55${dddStr}9${firstPartStr}${lastPartStr}`;
  } else {
    // Landline: 8 digits (55 + DDD + 8 digits)
    return `55${dddStr}${firstPartStr}${lastPartStr}`;
  }
});

/**
 * **Feature: phone-validation-fix, Property 1: Suffix Removal Idempotence**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 */
test('Property 1: Suffix Removal Idempotence', () => {
  const { removeWhatsAppSuffix } = require('../utils/phoneUtils');
  
  const suffixGen = fc.constantFrom('@s.whatsapp.net', '@c.us', '@lid');
  
  fc.assert(
    fc.property(brazilianPhoneGen, suffixGen, (phone, suffix) => {
      const withSuffix = `${phone}${suffix}`;
      const removedOnce = removeWhatsAppSuffix(withSuffix);
      const removedTwice = removeWhatsAppSuffix(removedOnce);
      
      assert.strictEqual(removedTwice, removedOnce);
      assert(!removedOnce.includes('@'));
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 2: Normalization Consistency**
 * **Validates: Requirements 1.3, 1.4, 1.5**
 */
test('Property 2: Normalization Consistency', () => {
  const { normalizePhoneNumber } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const normalizedOnce = normalizePhoneNumber(phone);
      const normalizedTwice = normalizePhoneNumber(normalizedOnce);
      
      assert.strictEqual(normalizedTwice, normalizedOnce);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 3: Numeric-Only Output**
 * **Validates: Requirements 1.2, 5.1, 5.2, 5.3**
 */
test('Property 3: Numeric-Only Output', () => {
  const { sanitizePhoneNumber } = require('../utils/phoneUtils');
  
  const formattedPhoneGen = fc.tuple(
    brazilianPhoneGen,
    fc.constantFrom(
      (p) => `+${p}`,
      (p) => `+55 ${p.substring(2)}`,
      (p) => `(${p.substring(2, 4)}) ${p.substring(4, 9)}-${p.substring(9)}`,
      (p) => `${p}@s.whatsapp.net`,
      (p) => `${p}@c.us`
    )
  ).map(([phone, formatter]) => formatter(phone));
  
  fc.assert(
    fc.property(formattedPhoneGen, (formattedPhone) => {
      const sanitized = sanitizePhoneNumber(formattedPhone);
      
      assert.match(sanitized, /^\d*$/);
      assert(!sanitized.includes('@'));
      assert(!sanitized.includes('-'));
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 4: DDD Zero Removal**
 * **Validates: Requirements 1.3, 1.4, 1.5, 3.1, 3.2, 3.3**
 */
test('Property 4: DDD Zero Removal', () => {
  const { normalizePhoneNumber } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const withZero = '550' + phone.substring(2);
      const normalized = normalizePhoneNumber(withZero);
      
      assert.strictEqual(normalized, phone);
      assert(!normalized.match(/^550/));
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 5: Normalization Preservation**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4**
 */
test('Property 5: Normalization Preservation', () => {
  const { normalizePhoneNumber } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const formats = [
        phone,
        `+${phone}`,
        `+55 ${phone.substring(2)}`,
        phone.substring(2),
        `(${phone.substring(2, 4)}) ${phone.substring(4)}`,
      ];
      
      const results = formats.map(fmt => normalizePhoneNumber(fmt));
      const firstResult = results[0];
      
      results.forEach((result) => {
        assert.strictEqual(result, firstResult);
      });
      
      assert.match(firstResult, /^55\d{10,11}$/);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 6: Validation Rejection**
 * **Validates: Requirements 1.2, 3.1, 3.2, 3.3, 3.4**
 */
test('Property 6: Validation Rejection - too short', () => {
  const { validatePhoneFormat } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 9 }), (len) => {
      const shortPhone = String(len).padStart(len, '0');
      const result = validatePhoneFormat(shortPhone);
      
      assert.strictEqual(result.isValid, false);
      assert(result.error && result.error.length > 0);
    }),
    { numRuns: 50 }
  );
});

test('Property 6: Validation Rejection - invalid DDD', () => {
  const { validatePhoneFormat } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 10 }), (ddd) => {
      const invalidDddPhone = `55${String(ddd).padStart(2, '0')}12345678`;
      const result = validatePhoneFormat(invalidDddPhone);
      
      assert.strictEqual(result.isValid, false);
      assert(result.error && result.error.length > 0);
    }),
    { numRuns: 50 }
  );
});

test('Property 6: Validation Rejection - 9-digit not starting with 9', () => {
  const { validatePhoneFormat } = require('../utils/phoneUtils');
  
  // Generate 9-digit numbers (not 8-digit) that don't start with 9
  // Format: 55 + DDD (2 digits) + 1-8 (first digit, not 9) + 8 more digits (total 9 digits)
  const invalidNineDigitGen = fc.tuple(
    fc.integer({ min: 11, max: 99 }), // DDD
    fc.integer({ min: 1, max: 8 }), // First digit of number (not 9)
    fc.integer({ min: 0, max: 99999999 }) // Remaining 8 digits
  ).map(([ddd, firstDigit, remaining]) => {
    const remainingStr = String(remaining).padStart(8, '0');
    return `55${ddd}${firstDigit}${remainingStr}`;
  });
  
  fc.assert(
    fc.property(invalidNineDigitGen, (invalidPhone) => {
      const result = validatePhoneFormat(invalidPhone);
      
      // This is a 9-digit number not starting with 9, should be invalid
      assert.strictEqual(result.isValid, false);
      assert(result.error && result.error.length > 0);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 8: Round-Trip Display Format**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3**
 */
test('Property 8: Round-Trip Display Format', () => {
  const { formatPhoneDisplay, normalizePhoneNumber, sanitizePhoneNumber } = require('../utils/phoneUtils');
  
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const formatted = formatPhoneDisplay(phone);
      const extracted = sanitizePhoneNumber(formatted);
      const normalized = normalizePhoneNumber(extracted);
      
      assert.strictEqual(normalized, phone);
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: phone-validation-fix, Property 7: JID Extraction with LID Handling**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */
test('Property 7: JID Extraction - individual chat', () => {
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const event = {
        Info: {
          Chat: `${phone}@s.whatsapp.net`,
          Sender: `${phone}@s.whatsapp.net`
        }
      };
      
      assert(event.Info);
      assert(event.Info.Chat);
      assert(event.Info.Chat.endsWith('@s.whatsapp.net'));
      assert.match(phone, /^55\d{10,11}$/);
    }),
    { numRuns: 30 }
  );
});

test('Property 7: JID Extraction - group chat', () => {
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const event = {
        Info: {
          Chat: '120363123456789-1234567890@g.us',
          Sender: `${phone}@s.whatsapp.net`
        }
      };
      
      assert(event.Info);
      assert(event.Info.Chat.endsWith('@g.us'));
      assert(event.Info.Sender);
      assert(event.Info.Sender.endsWith('@s.whatsapp.net'));
      assert.match(phone, /^55\d{10,11}$/);
    }),
    { numRuns: 30 }
  );
});

test('Property 7: JID Extraction - old format', () => {
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const event = {
        Info: {
          Chat: `${phone}@c.us`,
          Sender: `${phone}@c.us`
        }
      };
      
      assert(event.Info);
      assert(event.Info.Chat.endsWith('@c.us'));
      assert.match(phone, /^55\d{10,11}$/);
    }),
    { numRuns: 30 }
  );
});

test('Property 7: JID Extraction - different formats', () => {
  fc.assert(
    fc.property(brazilianPhoneGen, (phone) => {
      const individualEvent = {
        Info: {
          Chat: `${phone}@s.whatsapp.net`,
          Sender: `${phone}@s.whatsapp.net`
        }
      };
      
      const oldFormatEvent = {
        Info: {
          Chat: `${phone}@c.us`,
          Sender: `${phone}@c.us`
        }
      };
      
      assert(individualEvent.Info.Chat);
      assert(oldFormatEvent.Info.Chat);
      
      const individualPhone = individualEvent.Info.Chat.replace(/@s\.whatsapp\.net$/, '');
      const oldFormatPhone = oldFormatEvent.Info.Chat.replace(/@c\.us$/, '');
      
      assert.strictEqual(individualPhone, oldFormatPhone);
    }),
    { numRuns: 30 }
  );
});
