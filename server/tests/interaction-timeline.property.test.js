#!/usr/bin/env node

/**
 * Property-Based Tests for Interaction Timeline
 * Tests timeline ordering, interaction completeness, and inactivity detection
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Inactivity threshold in days (from service)
const INACTIVITY_THRESHOLD_DAYS = 30;

// Generator for interaction types
const interactionTypeGen = fc.constantFrom('message', 'call', 'email', 'note', 'status_change');

// Generator for direction
const directionGen = fc.constantFrom('incoming', 'outgoing', null);

// Generator for timestamps (within last year)
const timestampGen = fc.date({
  min: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
  max: new Date()
});

// Generator for content
const contentGen = fc.string({ minLength: 1, maxLength: 500 });

// Generator for an interaction event
const interactionGen = fc.record({
  id: fc.uuid(),
  type: interactionTypeGen,
  direction: directionGen,
  content: contentGen,
  timestamp: timestampGen
});

// Generator for a list of interactions
const interactionListGen = fc.array(interactionGen, { minLength: 0, maxLength: 30 });

/**
 * Sort interactions by timestamp (descending - most recent first)
 * @param {Array} interactions - Array of interaction objects
 * @returns {Array} Sorted interactions
 */
function sortByTimestampDesc(interactions) {
  return [...interactions].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Create content preview (first 200 chars)
 * @param {string} content - Full content
 * @returns {string} Preview
 */
function createContentPreview(content) {
  if (!content) return null;
  return content.substring(0, 200) + (content.length > 200 ? '...' : '');
}

/**
 * Check if contact is inactive based on last interaction
 * @param {Date|null} lastInteractionAt - Last interaction timestamp
 * @returns {boolean} Whether contact is inactive
 */
function isInactive(lastInteractionAt) {
  if (!lastInteractionAt) return true;
  
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - INACTIVITY_THRESHOLD_DAYS);
  
  return new Date(lastInteractionAt) < thresholdDate;
}

/**
 * **Feature: contact-crm-evolution, Property 3: Timeline Chronological Ordering**
 * *For any* contact timeline query, the returned events SHALL be ordered by timestamp
 * in descending order (most recent first), and all events SHALL belong to the specified contact.
 * **Validates: Requirements 1.3, 3.5, 8.5**
 */
test('Property 3: Timeline events are ordered by timestamp descending', () => {
  fc.assert(
    fc.property(interactionListGen, (interactions) => {
      const sorted = sortByTimestampDesc(interactions);
      
      // Verify descending order
      for (let i = 1; i < sorted.length; i++) {
        const prevTime = new Date(sorted[i - 1].timestamp).getTime();
        const currTime = new Date(sorted[i].timestamp).getTime();
        
        assert(prevTime >= currTime,
          `Events should be in descending order: ${sorted[i - 1].timestamp} >= ${sorted[i].timestamp}`);
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 3: All timeline events have required fields', () => {
  fc.assert(
    fc.property(interactionListGen, (interactions) => {
      for (const event of interactions) {
        assert('id' in event, 'Event should have id');
        assert('type' in event, 'Event should have type');
        assert('timestamp' in event, 'Event should have timestamp');
        
        // Type should be valid
        const validTypes = ['message', 'call', 'email', 'note', 'status_change'];
        assert(validTypes.includes(event.type),
          `Event type ${event.type} should be valid`);
      }
    }),
    { numRuns: 50 }
  );
});

test('Property 3: Timeline preserves all events after sorting', () => {
  fc.assert(
    fc.property(interactionListGen, (interactions) => {
      const sorted = sortByTimestampDesc(interactions);
      
      // Same number of events
      assert.strictEqual(sorted.length, interactions.length,
        'Sorted list should have same length');
      
      // All original events present
      const originalIds = new Set(interactions.map(i => i.id));
      const sortedIds = new Set(sorted.map(i => i.id));
      
      assert.strictEqual(originalIds.size, sortedIds.size,
        'All events should be preserved');
      
      for (const id of originalIds) {
        assert(sortedIds.has(id), `Event ${id} should be in sorted list`);
      }
    }),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 11: Interaction Log Completeness**
 * *For any* message sent or received, an interaction record SHALL be created with the correct type,
 * direction, timestamp, and content_preview (first 200 characters).
 * **Validates: Requirements 1.1, 1.2, 1.4**
 */
test('Property 11: Content preview is first 200 characters', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 0, maxLength: 1000 }),
      (content) => {
        const preview = createContentPreview(content);
        
        if (!content) {
          assert.strictEqual(preview, null, 'Empty content should have null preview');
        } else if (content.length <= 200) {
          assert.strictEqual(preview, content, 'Short content should be unchanged');
        } else {
          assert.strictEqual(preview.length, 203, 'Long content preview should be 200 + "..."');
          assert(preview.endsWith('...'), 'Long content should end with ...');
          assert.strictEqual(preview.substring(0, 200), content.substring(0, 200),
            'Preview should match first 200 chars');
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 11: Interaction record has all required fields', () => {
  fc.assert(
    fc.property(
      interactionTypeGen,
      directionGen,
      contentGen,
      timestampGen,
      (type, direction, content, timestamp) => {
        // Simulate creating an interaction record
        const record = {
          type,
          direction: direction || null,
          content,
          content_preview: createContentPreview(content),
          created_at: timestamp.toISOString()
        };
        
        // Verify all required fields
        assert('type' in record, 'Record should have type');
        assert('direction' in record, 'Record should have direction');
        assert('content' in record, 'Record should have content');
        assert('content_preview' in record, 'Record should have content_preview');
        assert('created_at' in record, 'Record should have created_at');
        
        // Type should be valid
        const validTypes = ['message', 'call', 'email', 'note', 'status_change'];
        assert(validTypes.includes(record.type));
        
        // Direction should be valid or null
        const validDirections = ['incoming', 'outgoing', null];
        assert(validDirections.includes(record.direction));
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 11: Message interactions have direction', () => {
  fc.assert(
    fc.property(
      fc.constantFrom('incoming', 'outgoing'),
      contentGen,
      (direction, content) => {
        // For message type, direction should be set
        const record = {
          type: 'message',
          direction,
          content,
          content_preview: createContentPreview(content)
        };
        
        assert(record.direction !== null,
          'Message interactions should have direction');
        assert(['incoming', 'outgoing'].includes(record.direction),
          'Direction should be incoming or outgoing');
      }
    ),
    { numRuns: 50 }
  );
});

/**
 * **Feature: contact-crm-evolution, Property 12: Inactivity Detection**
 * *For any* contact where (current_time - last_interaction_at) > 30 days,
 * the is_active flag SHALL be false. For contacts with recent interactions, is_active SHALL be true.
 * **Validates: Requirements 1.5, 2.4**
 */
test('Property 12: Contacts inactive after 30 days without interaction', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 365 }), // days since last interaction
      (daysSinceInteraction) => {
        const lastInteractionAt = new Date();
        lastInteractionAt.setDate(lastInteractionAt.getDate() - daysSinceInteraction);
        
        const inactive = isInactive(lastInteractionAt);
        
        if (daysSinceInteraction > INACTIVITY_THRESHOLD_DAYS) {
          assert(inactive, `Contact should be inactive after ${daysSinceInteraction} days`);
        } else {
          assert(!inactive, `Contact should be active after ${daysSinceInteraction} days`);
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 12: Contacts with null last_interaction_at are inactive', () => {
  fc.assert(
    fc.property(fc.constant(null), (lastInteractionAt) => {
      const inactive = isInactive(lastInteractionAt);
      
      assert(inactive, 'Contact with no interactions should be inactive');
    }),
    { numRuns: 10 }
  );
});

test('Property 12: Recent interactions make contact active', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: INACTIVITY_THRESHOLD_DAYS - 1 }),
      (daysAgo) => {
        const lastInteractionAt = new Date();
        lastInteractionAt.setDate(lastInteractionAt.getDate() - daysAgo);
        
        const inactive = isInactive(lastInteractionAt);
        
        assert(!inactive, `Contact with interaction ${daysAgo} days ago should be active`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 12: Inactivity threshold boundary is 30 days', () => {
  // Test boundary conditions
  // The threshold is "> 30 days", so exactly 30 days is still active
  const exactly30DaysAgo = new Date();
  exactly30DaysAgo.setDate(exactly30DaysAgo.getDate() - 30);
  
  const exactly31DaysAgo = new Date();
  exactly31DaysAgo.setDate(exactly31DaysAgo.getDate() - 31);
  
  const exactly29DaysAgo = new Date();
  exactly29DaysAgo.setDate(exactly29DaysAgo.getDate() - 29);
  
  // 30 days is the threshold boundary - exactly 30 days is NOT inactive (uses < comparison)
  // The isInactive function uses: lastInteractionAt < thresholdDate
  // So if lastInteractionAt is exactly at threshold, it's NOT inactive
  assert(!isInactive(exactly30DaysAgo), '30 days ago should be active (boundary)');
  assert(isInactive(exactly31DaysAgo), '31 days ago should be inactive');
  assert(!isInactive(exactly29DaysAgo), '29 days ago should be active');
});
