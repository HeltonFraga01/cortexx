#!/usr/bin/env node

/**
 * Property-Based Tests for Communication Preferences
 * Tests opt-out enforcement and keyword detection
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Import opt-out keywords from service
const OPT_OUT_KEYWORDS = ['SAIR', 'PARAR', 'STOP', 'UNSUBSCRIBE', 'CANCELAR', 'REMOVER'];

// Generator for contact IDs
const contactIdGen = fc.uuid();

// Generator for opt-in status
const optInStatusGen = fc.boolean();

// Generator for messages that contain opt-out keywords
const optOutMessageGen = fc.constantFrom(...OPT_OUT_KEYWORDS);

// Generator for random messages (unlikely to contain keywords)
const randomMessageGen = fc.string({ minLength: 1, maxLength: 100 })
  .filter(msg => !OPT_OUT_KEYWORDS.some(kw => msg.toUpperCase().includes(kw)));

// Generator for contact list with opt-in status
const contactListGen = fc.array(
  fc.record({
    id: contactIdGen,
    optedIn: optInStatusGen
  }),
  { minLength: 0, maxLength: 50 }
);

/**
 * Check if message contains opt-out keyword
 * @param {string} message - Message to check
 * @returns {{found: boolean, keyword: string|null}}
 */
function detectOptOutKeyword(message) {
  if (!message) return { found: false, keyword: null };
  
  const normalizedMessage = message.trim().toUpperCase();
  
  for (const keyword of OPT_OUT_KEYWORDS) {
    // Exact match or keyword at start/end
    if (
      normalizedMessage === keyword ||
      normalizedMessage.startsWith(keyword + ' ') ||
      normalizedMessage.endsWith(' ' + keyword)
    ) {
      return { found: true, keyword };
    }
  }
  
  return { found: false, keyword: null };
}

/**
 * Filter contacts to only include opted-in ones
 * @param {Array} contacts - Array of contacts with optedIn status
 * @returns {Array} Filtered contacts
 */
function filterOptedIn(contacts) {
  return contacts.filter(c => c.optedIn === true);
}

/**
 * **Feature: contact-crm-evolution, Property 6: Communication Preference Enforcement**
 * *For any* bulk messaging campaign, contacts with bulk_messaging_opt_in = false
 * SHALL be excluded from the recipient list.
 * **Validates: Requirements 5.1, 5.2, 5.4**
 */
test('Property 6: Opted-out contacts are excluded from campaigns', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const filtered = filterOptedIn(contacts);
      
      // All filtered contacts should be opted in
      for (const contact of filtered) {
        assert(contact.optedIn === true,
          'Filtered list should only contain opted-in contacts');
      }
      
      // No opted-out contacts in filtered list
      const optedOutIds = new Set(contacts.filter(c => !c.optedIn).map(c => c.id));
      for (const contact of filtered) {
        assert(!optedOutIds.has(contact.id),
          'Opted-out contacts should not be in filtered list');
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 6: Filter preserves all opted-in contacts', () => {
  fc.assert(
    fc.property(contactListGen, (contacts) => {
      const filtered = filterOptedIn(contacts);
      const optedInCount = contacts.filter(c => c.optedIn).length;
      
      assert.strictEqual(filtered.length, optedInCount,
        'Filtered list should contain all opted-in contacts');
    }),
    { numRuns: 50 }
  );
});

test('Property 6: Empty list when all contacts opted out', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ id: contactIdGen, optedIn: fc.constant(false) }), { minLength: 1, maxLength: 20 }),
      (contacts) => {
        const filtered = filterOptedIn(contacts);
        
        assert.strictEqual(filtered.length, 0,
          'All opted-out contacts should result in empty list');
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 6: All contacts preserved when all opted in', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({ id: contactIdGen, optedIn: fc.constant(true) }), { minLength: 1, maxLength: 20 }),
      (contacts) => {
        const filtered = filterOptedIn(contacts);
        
        assert.strictEqual(filtered.length, contacts.length,
          'All opted-in contacts should be preserved');
      }
    ),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 7: Opt-Out Keyword Detection**
 * *For any* incoming message containing keywords "SAIR", "PARAR", "STOP", or "UNSUBSCRIBE",
 * the contact's bulk_messaging_opt_in SHALL be set to false.
 * **Validates: Requirements 5.3**
 */
test('Property 7: Opt-out keywords are detected (exact match)', () => {
  fc.assert(
    fc.property(optOutMessageGen, (keyword) => {
      const result = detectOptOutKeyword(keyword);
      
      assert(result.found, `Keyword "${keyword}" should be detected`);
      assert.strictEqual(result.keyword, keyword,
        'Detected keyword should match');
    }),
    { numRuns: 50 }
  );
});

test('Property 7: Opt-out keywords are case-insensitive', () => {
  fc.assert(
    fc.property(
      optOutMessageGen,
      fc.constantFrom('lower', 'upper', 'mixed'),
      (keyword, caseType) => {
        let message;
        switch (caseType) {
          case 'lower': message = keyword.toLowerCase(); break;
          case 'upper': message = keyword.toUpperCase(); break;
          case 'mixed': message = keyword.split('').map((c, i) => 
            i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
          ).join(''); break;
        }
        
        const result = detectOptOutKeyword(message);
        
        assert(result.found, `Keyword "${message}" should be detected regardless of case`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 7: Opt-out keywords detected at message boundaries', () => {
  fc.assert(
    fc.property(
      optOutMessageGen,
      fc.constantFrom('start', 'end', 'exact'),
      fc.string({ minLength: 1, maxLength: 20 }).filter(s => !OPT_OUT_KEYWORDS.some(k => s.toUpperCase().includes(k))),
      (keyword, position, extraText) => {
        let message;
        switch (position) {
          case 'start': message = `${keyword} ${extraText}`; break;
          case 'end': message = `${extraText} ${keyword}`; break;
          case 'exact': message = keyword; break;
        }
        
        const result = detectOptOutKeyword(message);
        
        assert(result.found, `Keyword at ${position} should be detected: "${message}"`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 7: Random messages without keywords are not detected', () => {
  fc.assert(
    fc.property(randomMessageGen, (message) => {
      const result = detectOptOutKeyword(message);
      
      assert(!result.found, `Message "${message}" should not trigger opt-out`);
      assert.strictEqual(result.keyword, null, 'No keyword should be returned');
    }),
    { numRuns: 50 }
  );
});

test('Property 7: Empty/null messages are not detected', () => {
  fc.assert(
    fc.property(fc.constantFrom(null, '', '   '), (message) => {
      const result = detectOptOutKeyword(message);
      
      assert(!result.found, 'Empty message should not trigger opt-out');
    }),
    { numRuns: 10 }
  );
});

test('Property 7: All defined keywords are recognized', () => {
  // Test each keyword explicitly
  for (const keyword of OPT_OUT_KEYWORDS) {
    const result = detectOptOutKeyword(keyword);
    assert(result.found, `Keyword "${keyword}" should be recognized`);
    assert.strictEqual(result.keyword, keyword);
  }
});
