#!/usr/bin/env node

/**
 * Property-Based Tests for Custom Field Validation
 * Tests type-specific validation for custom fields
 * 
 * **Feature: contact-crm-evolution**
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');

// Valid field types from service
const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email', 'phone'];

// Generator for field types
const fieldTypeGen = fc.constantFrom(...FIELD_TYPES);

// Generator for valid numbers
const validNumberGen = fc.oneof(
  fc.integer(),
  fc.float({ noNaN: true, noDefaultInfinity: true })
);

// Generator for invalid number strings
const invalidNumberGen = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => isNaN(Number(s)) && s !== '');

// Generator for valid dates
const validDateGen = fc.date().map(d => d.toISOString());

// Generator for invalid dates
const invalidDateGen = fc.constantFrom('not-a-date', '2024-13-45', 'abc123', '');

// Generator for valid URLs
const validUrlGen = fc.webUrl();

// Generator for invalid URLs
const invalidUrlGen = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => {
    try { new URL(s); return false; } catch { return true; }
  });

// Generator for valid emails
const validEmailGen = fc.emailAddress();

// Generator for invalid emails
const invalidEmailGen = fc.string({ minLength: 1, maxLength: 50 })
  .filter(s => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

// Generator for valid phone numbers
const validPhoneGen = fc.stringMatching(/^[\d\s\-\+\(\)]{5,20}$/);

// Generator for invalid phone numbers
const invalidPhoneGen = fc.string({ minLength: 1, maxLength: 20 })
  .filter(s => !/^[\d\s\-\+\(\)]+$/.test(s));

// Generator for dropdown options
const dropdownOptionsGen = fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 });

/**
 * Validate a field value against its type
 * @param {string} fieldType - Field type
 * @param {any} value - Value to validate
 * @param {Object} options - Additional options (e.g., dropdown options)
 * @returns {{valid: boolean, error: string|null}}
 */
function validateFieldValue(fieldType, value, options = {}) {
  // Empty values are valid for non-required fields
  if (value === null || value === undefined || value === '') {
    return { valid: true, error: null };
  }

  switch (fieldType) {
    case 'number':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return { valid: false, error: 'Must be a number' };
      }
      if (options.min !== undefined && Number(value) < options.min) {
        return { valid: false, error: `Must be at least ${options.min}` };
      }
      if (options.max !== undefined && Number(value) > options.max) {
        return { valid: false, error: `Must be at most ${options.max}` };
      }
      break;

    case 'date':
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Must be a valid date' };
      }
      break;

    case 'dropdown':
      if (options.options && !options.options.includes(value)) {
        return { valid: false, error: `Must be one of: ${options.options.join(', ')}` };
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Must be true or false' };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        return { valid: false, error: 'Must be a valid URL' };
      }
      break;

    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { valid: false, error: 'Must be a valid email' };
      }
      break;

    case 'phone':
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (!phoneRegex.test(value)) {
        return { valid: false, error: 'Must be a valid phone number' };
      }
      break;

    case 'text':
      // Text is always valid
      break;
  }

  return { valid: true, error: null };
}

/**
 * **Feature: contact-crm-evolution, Property 8: Custom Field Type Validation**
 * *For any* custom field value, validation SHALL enforce the field's type constraints
 * (number, date, url, dropdown options).
 * **Validates: Requirements 6.1, 6.3**
 */
test('Property 8: Number fields accept valid numbers', () => {
  fc.assert(
    fc.property(validNumberGen, (value) => {
      const result = validateFieldValue('number', value);
      
      assert(result.valid, `Valid number ${value} should be accepted`);
      assert.strictEqual(result.error, null);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Number fields reject invalid values', () => {
  fc.assert(
    fc.property(invalidNumberGen, (value) => {
      const result = validateFieldValue('number', value);
      
      assert(!result.valid, `Invalid number "${value}" should be rejected`);
      assert(result.error !== null, 'Error message should be provided');
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Number fields enforce min/max constraints', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: 0, max: 100 }),
      fc.integer({ min: 100, max: 200 }),
      (value, min, max) => {
        const result = validateFieldValue('number', value, { min, max });
        
        if (value < min) {
          assert(!result.valid, `Value ${value} below min ${min} should be rejected`);
        } else if (value > max) {
          assert(!result.valid, `Value ${value} above max ${max} should be rejected`);
        } else {
          assert(result.valid, `Value ${value} within range should be accepted`);
        }
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 8: Date fields accept valid dates', () => {
  fc.assert(
    fc.property(validDateGen, (value) => {
      const result = validateFieldValue('date', value);
      
      assert(result.valid, `Valid date ${value} should be accepted`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Date fields reject invalid dates', () => {
  fc.assert(
    fc.property(invalidDateGen, (value) => {
      // Skip empty string as it's valid for non-required
      if (value === '') return;
      
      const result = validateFieldValue('date', value);
      
      assert(!result.valid, `Invalid date "${value}" should be rejected`);
    }),
    { numRuns: 20 }
  );
});

test('Property 8: URL fields accept valid URLs', () => {
  fc.assert(
    fc.property(validUrlGen, (value) => {
      const result = validateFieldValue('url', value);
      
      assert(result.valid, `Valid URL ${value} should be accepted`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: URL fields reject invalid URLs', () => {
  fc.assert(
    fc.property(invalidUrlGen, (value) => {
      const result = validateFieldValue('url', value);
      
      assert(!result.valid, `Invalid URL "${value}" should be rejected`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Email fields accept valid emails', () => {
  fc.assert(
    fc.property(validEmailGen, (value) => {
      const result = validateFieldValue('email', value);
      
      assert(result.valid, `Valid email ${value} should be accepted`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Email fields reject invalid emails', () => {
  fc.assert(
    fc.property(invalidEmailGen, (value) => {
      const result = validateFieldValue('email', value);
      
      assert(!result.valid, `Invalid email "${value}" should be rejected`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Phone fields accept valid phone numbers', () => {
  fc.assert(
    fc.property(validPhoneGen, (value) => {
      const result = validateFieldValue('phone', value);
      
      assert(result.valid, `Valid phone ${value} should be accepted`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Phone fields reject invalid phone numbers', () => {
  fc.assert(
    fc.property(invalidPhoneGen, (value) => {
      const result = validateFieldValue('phone', value);
      
      assert(!result.valid, `Invalid phone "${value}" should be rejected`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Dropdown fields accept valid options', () => {
  fc.assert(
    fc.property(dropdownOptionsGen, (options) => {
      // Pick a random valid option
      const validValue = options[0];
      const result = validateFieldValue('dropdown', validValue, { options });
      
      assert(result.valid, `Valid option "${validValue}" should be accepted`);
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Dropdown fields reject invalid options', () => {
  fc.assert(
    fc.property(
      dropdownOptionsGen,
      fc.string({ minLength: 1, maxLength: 20 }),
      (options, value) => {
        // Skip if value happens to be in options
        if (options.includes(value)) return;
        
        const result = validateFieldValue('dropdown', value, { options });
        
        assert(!result.valid, `Invalid option "${value}" should be rejected`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 8: Checkbox fields accept boolean values', () => {
  fc.assert(
    fc.property(fc.boolean(), (value) => {
      const result = validateFieldValue('checkbox', value);
      
      assert(result.valid, `Boolean ${value} should be accepted for checkbox`);
    }),
    { numRuns: 20 }
  );
});

test('Property 8: Checkbox fields reject non-boolean values', () => {
  fc.assert(
    fc.property(
      fc.oneof(
        fc.string({ minLength: 1 }), // Non-empty strings
        fc.integer()
      ),
      (value) => {
        const result = validateFieldValue('checkbox', value);
        
        assert(!result.valid, `Non-boolean "${value}" should be rejected for checkbox`);
      }
    ),
    { numRuns: 50 }
  );
});

test('Property 8: Text fields accept any string', () => {
  fc.assert(
    fc.property(fc.string(), (value) => {
      const result = validateFieldValue('text', value);
      
      assert(result.valid, 'Text fields should accept any string');
    }),
    { numRuns: 50 }
  );
});

test('Property 8: Empty values are valid for non-required fields', () => {
  fc.assert(
    fc.property(
      fieldTypeGen,
      fc.constantFrom(null, undefined, ''),
      (fieldType, value) => {
        const result = validateFieldValue(fieldType, value);
        
        assert(result.valid, `Empty value should be valid for ${fieldType}`);
      }
    ),
    { numRuns: 50 }
  );
});
