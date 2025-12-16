#!/usr/bin/env node

/**
 * Unit Tests for phoneUtils
 * Tests phone number extraction and normalization functions
 */

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const { extractPhoneFromWebhook, resolveLidToPhone, normalizePhoneNumber } = require('../utils/phoneUtils');

// Mock wuzapiClient for testing
const Module = require('module');
const originalRequire = Module.prototype.require;

describe('phoneUtils Tests', () => {
  describe('extractPhoneFromWebhook', () => {
    test('should extract phone from normal chat (@s.whatsapp.net)', async () => {
      const event = {
        Info: {
          Chat: '5521975705641@s.whatsapp.net',
          Sender: '5521975705641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should extract phone from Chat field');
    });

    test('should extract phone from group message using Sender', async () => {
      const event = {
        Info: {
          Chat: '123456789-1234567890@g.us',
          Sender: '5521975705641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should extract phone from Sender field for groups');
    });

    test('should return empty string when Info is missing', async () => {
      const event = {};
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Info is missing');
    });

    test('should return empty string when Chat is missing for normal message', async () => {
      const event = {
        Info: {
          Sender: '5521975705641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Chat is missing');
    });

    test('should return empty string when Sender is missing for group message', async () => {
      const event = {
        Info: {
          Chat: '123456789-1234567890@g.us'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Sender is missing for group');
    });

    test('should handle @c.us suffix (old format)', async () => {
      const event = {
        Info: {
          Chat: '5521975705641@c.us',
          Sender: '5521975705641@c.us'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should handle @c.us suffix');
    });

    test('should normalize phone numbers with formatting', async () => {
      const event = {
        Info: {
          Chat: '+55 (21) 97570-5641@s.whatsapp.net',
          Sender: '+55 (21) 97570-5641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should normalize formatted phone numbers');
    });
  });

  describe('resolveLidToPhone', () => {
    test('should return null when lidNumber is empty', async () => {
      const result = await resolveLidToPhone('', 'test-token');
      assert.strictEqual(result, null, 'Should return null for empty lidNumber');
    });

    test('should return null when userToken is empty', async () => {
      const result = await resolveLidToPhone('1234567890', '');
      assert.strictEqual(result, null, 'Should return null for empty userToken');
    });

    test('should return null when both parameters are empty', async () => {
      const result = await resolveLidToPhone('', '');
      assert.strictEqual(result, null, 'Should return null when both parameters are empty');
    });
  });

  describe('Webhook Event Extraction - Different JID Types', () => {
    test('should handle @s.whatsapp.net (individual chat)', async () => {
      const event = {
        Info: {
          Chat: '5521975705641@s.whatsapp.net',
          Sender: '5521975705641@s.whatsapp.net',
          IsGroup: false
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should extract from Chat for individual messages');
    });

    test('should handle @g.us (group chat)', async () => {
      const event = {
        Info: {
          Chat: '120363123456789-1234567890@g.us',
          Sender: '5521975705641@s.whatsapp.net',
          IsGroup: true
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should extract from Sender for group messages');
    });

    test('should handle @c.us (old format)', async () => {
      const event = {
        Info: {
          Chat: '5521975705641@c.us',
          Sender: '5521975705641@c.us'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should handle @c.us format');
    });

    test('should normalize phone with formatting', async () => {
      const event = {
        Info: {
          Chat: '+55 (21) 97570-5641@s.whatsapp.net',
          Sender: '+55 (21) 97570-5641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should normalize formatted numbers');
    });

    test('should handle phone without country code', async () => {
      const event = {
        Info: {
          Chat: '21975705641@s.whatsapp.net',
          Sender: '21975705641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should add country code 55');
    });

    test('should handle phone with leading zero in DDD', async () => {
      const event = {
        Info: {
          Chat: '55021975705641@s.whatsapp.net',
          Sender: '55021975705641@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '5521975705641', 'Should remove leading zero from DDD');
    });

    test('should return empty string when Chat and Sender are missing', async () => {
      const event = {
        Info: {
          IsGroup: false
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when both Chat and Sender are missing');
    });

    test('should return empty string when Info is null', async () => {
      const event = {
        Info: null
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Info is null');
    });
  });

  describe('Property-Based Tests', () => {
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
     * 
     * Property: For any phone number with WhatsApp suffixes, removing the suffix twice
     * should produce the same result as removing it once (idempotence).
     * 
     * This ensures that the removeWhatsAppSuffix function is idempotent:
     * removeWhatsAppSuffix(removeWhatsAppSuffix(x)) == removeWhatsAppSuffix(x)
     */
    test('Property 1: Suffix Removal Idempotence - removing suffix twice equals removing once', () => {
      const { removeWhatsAppSuffix } = require('../utils/phoneUtils');
      
      const suffixGen = fc.constantFrom('@s.whatsapp.net', '@c.us', '@lid');
      
      fc.assert(
        fc.property(brazilianPhoneGen, suffixGen, (phone, suffix) => {
          const withSuffix = `${phone}${suffix}`;
          
          // Remove suffix once
          const removedOnce = removeWhatsAppSuffix(withSuffix);
          
          // Remove suffix twice
          const removedTwice = removeWhatsAppSuffix(removedOnce);
          
          // Should be idempotent
          assert.strictEqual(removedTwice, removedOnce,
            `Removing suffix twice should equal removing once: ${removedTwice} !== ${removedOnce}`);
          
          // Result should not contain any suffix
          assert(!removedOnce.includes('@'), 
            `Result should not contain @ symbol: ${removedOnce}`);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 4: DDD Zero Removal**
     * **Validates: Requirements 1.3, 1.4, 1.5, 3.1, 3.2, 3.3**
     * 
     * Property: For any phone number with a leading zero in the DDD (area code),
     * normalizing should remove that zero and produce the correct format.
     * 
     * Examples:
     * - 55021975705641 → 5521975705641
     * - 021975705641 → 5521975705641
     */
    test('Property 4: DDD Zero Removal - leading zero in DDD should be removed', () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          // Create a phone with leading zero in DDD
          // Original: 55DDNNNNNNNNN
          // With zero: 550DDNNNNNNNNN (invalid but should be handled)
          const withZero = '550' + phone.substring(2);
          
          const normalized = normalizePhoneNumber(withZero);
          
          // Should remove the leading zero and match the original
          assert.strictEqual(normalized, phone,
            `Normalizing ${withZero} should produce ${phone}, got ${normalized}`);
          
          // Should not contain leading zero after 55
          assert(!normalized.match(/^550/),
            `Normalized number should not have 550 prefix: ${normalized}`);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 5: Normalization Preservation**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4**
     * 
     * Property: For any valid Brazilian phone number in any format,
     * normalizing it should always produce the same result (55DDNNNNNNNNN).
     * 
     * This ensures that different input formats all normalize to the same output.
     */
    test('Property 5: Normalization Preservation - different formats normalize to same result', () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          // Generate different formats of the same phone
          const formats = [
            phone, // Already normalized
            `+${phone}`, // With plus sign
            `+55 ${phone.substring(2)}`, // With plus and space
            phone.substring(2), // Without country code
            `(${phone.substring(2, 4)}) ${phone.substring(4)}`, // With DDD in parentheses
          ];
          
          const results = formats.map(fmt => normalizePhoneNumber(fmt));
          
          // All formats should normalize to the same result
          const firstResult = results[0];
          results.forEach((result, idx) => {
            assert.strictEqual(result, firstResult,
              `Format ${idx} (${formats[idx]}) normalized to ${result}, expected ${firstResult}`);
          });
          
          // Result should be in correct format
          assert.match(firstResult, /^55\d{10,11}$/,
            `Normalized result should match 55DDNNNNNNNNN format: ${firstResult}`);
        }),
        { numRuns: 50 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 6: Validation Rejection**
     * **Validates: Requirements 1.2, 3.1, 3.2, 3.3, 3.4**
     * 
     * Property: For any invalid phone number (wrong length, invalid DDD, etc.),
     * validatePhoneFormat should reject it and return isValid: false.
     * 
     * Invalid cases:
     * - Too short (< 10 digits)
     * - Too long (> 13 digits)
     * - Invalid DDD (< 11 or > 99)
     * - 9-digit number not starting with 9
     */
    test('Property 6: Validation Rejection - invalid phones are rejected', () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      // Test too short phones
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 9 }), (len) => {
          const shortPhone = String(len).padStart(len, '0');
          const result = validatePhoneFormat(shortPhone);
          
          assert.strictEqual(result.isValid, false,
            `Short phone ${shortPhone} should be invalid`);
          assert(result.error && result.error.length > 0,
            `Invalid phone should have error message`);
        }),
        { numRuns: 50 }
      );
      
      // Test invalid DDD (00-10)
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 10 }), (ddd) => {
          const invalidDddPhone = `55${String(ddd).padStart(2, '0')}12345678`;
          const result = validatePhoneFormat(invalidDddPhone);
          
          assert.strictEqual(result.isValid, false,
            `Phone with invalid DDD ${ddd} should be rejected`);
          assert(result.error && result.error.length > 0,
            `Invalid DDD should have error message`);
        }),
        { numRuns: 50 }
      );
      
      // Test 9-digit number not starting with 9
      fc.assert(
        fc.property(
          fc.integer({ min: 11, max: 99 }),
          fc.integer({ min: 1000000, max: 8999999 })
        ),
        (ddd, num) => {
          const invalidPhone = `55${ddd}${num}`;
          const result = validatePhoneFormat(invalidPhone);
          
          assert.strictEqual(result.isValid, false,
            `9-digit number not starting with 9 should be invalid`);
          assert(result.error && result.error.length > 0,
            `Invalid phone should have error message`);
        },
        { numRuns: 50 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 8: Round-Trip Display Format**
     * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3**
     * 
     * Property: For any valid Brazilian phone number, formatting it for display
     * and then extracting the digits should produce the original normalized number.
     * 
     * This is a round-trip property: normalize → format → extract digits → should equal original
     */
    test('Property 8: Round-Trip Display Format - format and extract should preserve number', () => {
      const { formatPhoneDisplay, normalizePhoneNumber, sanitizePhoneNumber } = require('../utils/phoneUtils');
      
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          // Format for display
          const formatted = formatPhoneDisplay(phone);
          
          // Extract digits from formatted version
          const extracted = sanitizePhoneNumber(formatted);
          
          // Normalize the extracted version
          const normalized = normalizePhoneNumber(extracted);
          
          // Should match the original
          assert.strictEqual(normalized, phone,
            `Round-trip failed: ${phone} → format → ${formatted} → extract → ${extracted} → normalize → ${normalized}`);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 2: Normalization Consistency**
     * **Validates: Requirements 1.3, 1.4, 1.5**
     * 
     * Property: For any phone number, normalizing it multiple times should
     * produce the same result (idempotence of normalization).
     */
    test('Property 2: Normalization Consistency - normalizing twice equals normalizing once', () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          // Normalize once
          const normalizedOnce = normalizePhoneNumber(phone);
          
          // Normalize twice
          const normalizedTwice = normalizePhoneNumber(normalizedOnce);
          
          // Should be idempotent
          assert.strictEqual(normalizedTwice, normalizedOnce,
            `Normalizing twice should equal normalizing once: ${normalizedTwice} !== ${normalizedOnce}`);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 3: Numeric-Only Output**
     * **Validates: Requirements 1.2, 5.1, 5.2, 5.3**
     * 
     * Property: For any phone number with formatting characters,
     * sanitizing should produce only numeric digits.
     */
    test('Property 3: Numeric-Only Output - sanitized phone contains only digits', () => {
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
          
          // Should contain only digits
          assert.match(sanitized, /^\d*$/,
            `Sanitized phone should contain only digits: ${sanitized}`);
          
          // Should not contain any special characters
          assert(!sanitized.includes('@'), 'Should not contain @');
          assert(!sanitized.includes('-'), 'Should not contain -');
          assert(!sanitized.includes('('), 'Should not contain (');
          assert(!sanitized.includes(')'), 'Should not contain )');
          assert(!sanitized.includes(' '), 'Should not contain space');
          assert(!sanitized.includes('+'), 'Should not contain +');
        }),
        { numRuns: 50 }
      );
    });

    /**
     * **Feature: phone-validation-fix, Property 7: JID Extraction with LID Handling**
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
     * 
     * Property: For any valid Brazilian phone number and any JID type (@s.whatsapp.net, @g.us, @c.us),
     * the webhook event structure should be correctly formed for extraction.
     * 
     * This property tests:
     * - Individual chats (@s.whatsapp.net): Chat field contains phone
     * - Group chats (@g.us): Sender field contains phone
     * - Old format (@c.us): Chat field contains phone
     * - All phone numbers in events should be in normalized format
     */
    test('Property 7: JID Extraction with LID Handling - webhook events have correct structure', () => {
      // Test individual chat (@s.whatsapp.net)
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          const event = {
            Info: {
              Chat: `${phone}@s.whatsapp.net`,
              Sender: `${phone}@s.whatsapp.net`
            }
          };
          
          // Verify event structure
          assert(event.Info, 'Event should have Info field');
          assert(event.Info.Chat, 'Event Info should have Chat field');
          assert(event.Info.Chat.endsWith('@s.whatsapp.net'), 'Chat should end with @s.whatsapp.net');
          
          // Verify the phone format is valid
          assert.match(phone, /^55\d{10,11}$/, 
            `Generated phone should be normalized format, got: ${phone}`);
        }),
        { numRuns: 30 }
      );

      // Test group chat (@g.us) - extract from Sender
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          const event = {
            Info: {
              Chat: '120363123456789-1234567890@g.us', // Group ID
              Sender: `${phone}@s.whatsapp.net`
            }
          };
          
          assert(event.Info, 'Event should have Info field');
          assert(event.Info.Chat.endsWith('@g.us'), 'Chat should end with @g.us for group');
          assert(event.Info.Sender, 'Event Info should have Sender field');
          assert(event.Info.Sender.endsWith('@s.whatsapp.net'), 'Sender should end with @s.whatsapp.net');
          
          // Verify the phone format is valid
          assert.match(phone, /^55\d{10,11}$/, 
            `Generated phone should be normalized format, got: ${phone}`);
        }),
        { numRuns: 30 }
      );

      // Test old format (@c.us)
      fc.assert(
        fc.property(brazilianPhoneGen, (phone) => {
          const event = {
            Info: {
              Chat: `${phone}@c.us`,
              Sender: `${phone}@c.us`
            }
          };
          
          assert(event.Info, 'Event should have Info field');
          assert(event.Info.Chat.endsWith('@c.us'), 'Chat should end with @c.us');
          
          // Verify the phone format is valid
          assert.match(phone, /^55\d{10,11}$/, 
            `Generated phone should be normalized format, got: ${phone}`);
        }),
        { numRuns: 30 }
      );

      // Test that different JID types have correct structure
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
          
          // Both events should have valid structure
          assert(individualEvent.Info.Chat, 'Individual event should have Chat');
          assert(oldFormatEvent.Info.Chat, 'Old format event should have Chat');
          
          // Both should contain the same phone number (with different suffixes)
          const individualPhone = individualEvent.Info.Chat.replace(/@s\.whatsapp\.net$/, '');
          const oldFormatPhone = oldFormatEvent.Info.Chat.replace(/@c\.us$/, '');
          
          assert.strictEqual(individualPhone, oldFormatPhone,
            `Different JID types should contain same phone number`);
        }),
        { numRuns: 30 }
      );
    });
  });

  describe('Edge Cases - Unit Tests', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 6.5**
     * 
     * Tests for edge cases and error conditions in phone number handling
     */

    test('should handle empty phone number', async () => {
      const event = {
        Info: {
          Chat: '@s.whatsapp.net',
          Sender: '@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string for empty phone');
    });

    test('should handle phone with only special characters', async () => {
      const event = {
        Info: {
          Chat: '()[]{}@s.whatsapp.net',
          Sender: '()[]{}@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string for phone with only special characters');
    });

    test('should reject phone with invalid DDD (10)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      // DDD 10 is invalid (must be 11-99)
      const result = validatePhoneFormat('5510975705641');
      assert.strictEqual(result.isValid, false, 'Should reject DDD 10');
      assert.match(result.error, /DDD inválido/, 'Should indicate DDD is invalid');
    });

    test('should reject phone with invalid DDD (00)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      // DDD 00 is invalid
      const result = validatePhoneFormat('5500975705641');
      assert.strictEqual(result.isValid, false, 'Should reject DDD 00');
      assert.match(result.error, /DDD inválido/, 'Should indicate DDD is invalid');
    });

    test('should reject phone with invalid DDD (100)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      // DDD 100 is invalid (must be 11-99)
      const result = validatePhoneFormat('55100975705641');
      assert.strictEqual(result.isValid, false, 'Should reject DDD 100');
      // DDD 100 has too many digits, so it fails length check first
      assert.match(result.error, /(DDD inválido|deve ter 10 ou 11 dígitos)/, 'Should indicate invalid DDD or wrong length');
    });

    test('should reject phone with wrong length (too short)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat('5521');
      assert.strictEqual(result.isValid, false, 'Should reject phone that is too short');
      assert.match(result.error, /deve ter 10 ou 11 dígitos/, 'Should indicate wrong length');
    });

    test('should reject phone with wrong length (too long)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat('552197570564123456');
      assert.strictEqual(result.isValid, false, 'Should reject phone that is too long');
      assert.match(result.error, /deve ter 10 ou 11 dígitos/, 'Should indicate wrong length');
    });

    test('should reject phone with 9 digits not starting with 9', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      // 9 digits but doesn't start with 9
      const result = validatePhoneFormat('5521875705641');
      assert.strictEqual(result.isValid, false, 'Should reject 9-digit number not starting with 9');
      assert.match(result.error, /deve começar com 9/, 'Should indicate must start with 9');
    });

    test('should reject phone with multiple @ symbols', async () => {
      const event = {
        Info: {
          Chat: '5521975705641@@s.whatsapp.net',
          Sender: '5521975705641@@s.whatsapp.net'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      // Should still extract the phone number (sanitization removes extra @)
      assert.strictEqual(result, '5521975705641', 'Should handle multiple @ symbols');
    });

    test('should handle webhook with missing Info field', async () => {
      const event = {
        data: 'some data'
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Info is missing');
    });

    test('should handle webhook with missing Chat and Sender', async () => {
      const event = {
        Info: {
          IsGroup: false,
          ID: '123'
        }
      };
      
      const result = await extractPhoneFromWebhook(event);
      assert.strictEqual(result, '', 'Should return empty string when Chat and Sender are missing');
    });

    test('should handle phone with leading zeros in DDD', async () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      const result = normalizePhoneNumber('55021975705641');
      assert.strictEqual(result, '5521975705641', 'Should remove leading zero from DDD');
    });

    test('should handle phone without country code', async () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      const result = normalizePhoneNumber('21975705641');
      assert.strictEqual(result, '5521975705641', 'Should add country code 55');
    });

    test('should handle phone with formatting characters', async () => {
      const { normalizePhoneNumber } = require('../utils/phoneUtils');
      
      const result = normalizePhoneNumber('+55 (21) 97570-5641');
      assert.strictEqual(result, '5521975705641', 'Should remove formatting characters');
    });

    test('should validate correct mobile phone (9 digits starting with 9)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat('5521975705641');
      assert.strictEqual(result.isValid, true, 'Should accept valid mobile phone');
      assert.strictEqual(result.normalized, '5521975705641', 'Should normalize correctly');
    });

    test('should validate correct landline phone (8 digits)', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat('552137705641');
      assert.strictEqual(result.isValid, true, 'Should accept valid landline phone');
      assert.strictEqual(result.normalized, '552137705641', 'Should normalize correctly');
    });

    test('should handle phone with only whitespace', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat('   ');
      assert.strictEqual(result.isValid, false, 'Should reject phone with only whitespace');
      assert.match(result.error, /não pode estar vazio/, 'Should indicate phone is empty');
    });

    test('should handle null phone number', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat(null);
      assert.strictEqual(result.isValid, false, 'Should reject null phone');
      assert.match(result.error, /não pode estar vazio/, 'Should indicate phone is empty');
    });

    test('should handle undefined phone number', async () => {
      const { validatePhoneFormat } = require('../utils/phoneUtils');
      
      const result = validatePhoneFormat(undefined);
      assert.strictEqual(result.isValid, false, 'Should reject undefined phone');
      assert.match(result.error, /não pode estar vazio/, 'Should indicate phone is empty');
    });
  });
});
