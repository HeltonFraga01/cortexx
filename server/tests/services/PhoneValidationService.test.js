/**
 * Tests for PhoneValidationService
 * 
 * Validates that phone validation using WUZAPI /user/check endpoint
 * correctly handles Brazilian phone numbers with and without the "9" digit.
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  preparePhoneForValidation,
  validatePhoneWithAPI,
  validatePhonesWithAPI,
  clearCache,
  getCacheStats
} = require('../../services/PhoneValidationService');

// Mock simples do wuzapiClient
let mockWuzapiResponse = null;
let mockWuzapiError = null;

const mockWuzapiClient = {
  post: async () => {
    if (mockWuzapiError) throw mockWuzapiError;
    return mockWuzapiResponse;
  }
};

// Substituir o require do wuzapiClient
require.cache[require.resolve('../../utils/wuzapiClient')] = {
  exports: mockWuzapiClient
};

test('PhoneValidationService - preparePhoneForValidation', async (t) => {
  await t.test('Property 2: Preparation is idempotent', () => {
    const testCases = [
      '5531994974759',
      '31994974759',
      '021994974759',
      '+55 31 99497-4759',
      '5531994974759@s.whatsapp.net',
      '5531994974759@c.us',
    ];

    testCases.forEach(phone => {
      const prepared1 = preparePhoneForValidation(phone);
      const prepared2 = preparePhoneForValidation(prepared1);
      assert.strictEqual(prepared2, prepared1, `Idempotence failed for ${phone}`);
    });
  });

  await t.test('Property 3: Output contains only numeric characters', () => {
    const testCases = [
      '5531994974759',
      '+55 31 99497-4759',
      '(31) 99497-4759',
      '5531994974759@s.whatsapp.net',
    ];

    testCases.forEach(phone => {
      const prepared = preparePhoneForValidation(phone);
      assert.match(prepared, /^\d+$/, `Non-numeric output for ${phone}: ${prepared}`);
    });
  });

  await t.test('Property 4: Leading zero in DDD is removed', () => {
    const testCases = [
      { input: '55021994974759', expected: '5521994974759' },
      { input: '021994974759', expected: '5521994974759' },
      { input: '55011975705641', expected: '5511975705641' },
    ];

    testCases.forEach(({ input, expected }) => {
      const prepared = preparePhoneForValidation(input);
      assert.strictEqual(prepared, expected, `DDD zero removal failed for ${input}`);
    });
  });

  await t.test('Property 5: Already-normalized numbers are preserved', () => {
    const testCases = [
      '5531994974759',
      '5521975705641',
      '5511999999999',
    ];

    testCases.forEach(phone => {
      const prepared = preparePhoneForValidation(phone);
      assert.strictEqual(prepared, phone, `Normalization changed ${phone}`);
    });
  });

  await t.test('Property 1: Suffix removal is idempotent', () => {
    const testCases = [
      '5531994974759@s.whatsapp.net',
      '5531994974759@c.us',
      '5531994974759@lid',
    ];

    testCases.forEach(phone => {
      const prepared1 = preparePhoneForValidation(phone);
      const prepared2 = preparePhoneForValidation(prepared1);
      assert.strictEqual(prepared2, prepared1, `Suffix removal not idempotent for ${phone}`);
    });
  });
});

test('PhoneValidationService - validatePhoneWithAPI', async (t) => {
  await t.test('Property 1: Uses Query field from API response', async () => {
    clearCache();
    const userToken = 'test-token';
    const inputPhone = '5531994974759';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: true,
          Query: '553194974759',
          JID: '553194974759@s.whatsapp.net',
          VerifiedName: 'Test User'
        }]
      }
    };

    const result = await validatePhoneWithAPI(inputPhone, userToken);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.validatedPhone, '553194974759');
    assert.strictEqual(result.jid, '553194974759@s.whatsapp.net');
  });

  await t.test('Property 4: Rejects numbers with IsInWhatsapp: false', async () => {
    clearCache();
    const userToken = 'test-token';
    const inputPhone = '5531994974759';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: false,
          Query: '5531994974759',
          JID: '5531994974759@s.whatsapp.net'
        }]
      }
    };

    const result = await validatePhoneWithAPI(inputPhone, userToken);

    assert.strictEqual(result.isValid, false);
    assert(result.error.includes('não está registrado'));
    assert.strictEqual(result.validatedPhone, null);
  });

  await t.test('Property 3: Cache returns consistent results', async () => {
    clearCache();
    const userToken = 'test-token';
    const inputPhone = '5531994974759';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: true,
          Query: '553194974759',
          JID: '553194974759@s.whatsapp.net',
          VerifiedName: 'Test User'
        }]
      }
    };

    const result1 = await validatePhoneWithAPI(inputPhone, userToken);
    const result2 = await validatePhoneWithAPI(inputPhone, userToken);

    assert.deepStrictEqual(result1, result2);
  });

  await t.test('handles API errors gracefully', async () => {
    clearCache();
    const userToken = 'test-token';
    const inputPhone = '5531994974759';

    mockWuzapiResponse = {
      success: false,
      error: 'API Error',
      status: 500
    };

    const result = await validatePhoneWithAPI(inputPhone, userToken);

    assert.strictEqual(result.isValid, false);
    assert(result.error.includes('Erro na validação'));
  });

  await t.test('returns empty phone for empty input', async () => {
    clearCache();
    const result = await validatePhoneWithAPI('', 'test-token');

    assert.strictEqual(result.isValid, false);
    assert(result.error.includes('vazio'));
  });
});

test('PhoneValidationService - Brazilian Phone Number Scenarios', async (t) => {
  await t.test('handles Brazilian mobile with 9 digit', async () => {
    clearCache();
    const userToken = 'test-token';
    const clientInput = '5531994974759';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: true,
          Query: '553194974759',
          JID: '553194974759@s.whatsapp.net'
        }]
      }
    };

    const result = await validatePhoneWithAPI(clientInput, userToken);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.validatedPhone, '553194974759');
  });

  await t.test('handles formatted Brazilian number', async () => {
    clearCache();
    const userToken = 'test-token';
    const clientInput = '+55 (31) 99497-4759';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: true,
          Query: '553194974759',
          JID: '553194974759@s.whatsapp.net'
        }]
      }
    };

    const result = await validatePhoneWithAPI(clientInput, userToken);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.validatedPhone, '553194974759');
  });

  await t.test('handles number with WhatsApp suffix', async () => {
    clearCache();
    const userToken = 'test-token';
    const clientInput = '5531994974759@s.whatsapp.net';

    mockWuzapiResponse = {
      success: true,
      data: {
        Users: [{
          IsInWhatsapp: true,
          Query: '553194974759',
          JID: '553194974759@s.whatsapp.net'
        }]
      }
    };

    const result = await validatePhoneWithAPI(clientInput, userToken);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.validatedPhone, '553194974759');
  });
});
