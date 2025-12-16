/**
 * Quick Validation Test
 * Testa rapidamente se a solução de validação de números está funcionando
 */

const test = require('node:test');
const assert = require('node:assert');
const {
  normalizePhoneNumber,
  validatePhoneFormat
} = require('../utils/phoneUtils');

test('Quick Validation - Brazilian Phone Numbers', async (t) => {
  await t.test('Cliente digita COM o 9 - Sistema normaliza', () => {
    const clientInput = '5531994974759'; // Cliente digita COM o 9
    const normalized = normalizePhoneNumber(clientInput);
    
    // Deve estar pronto para enviar à API
    assert.strictEqual(normalized, '5531994974759');
    assert.match(normalized, /^\d+$/); // Apenas dígitos
  });

  await t.test('Sistema normaliza números em qualquer formato', () => {
    const testCases = [
      { input: '5531994974759', expected: '5531994974759' },
      { input: '+55 31 99497-4759', expected: '5531994974759' },
      { input: '31994974759', expected: '5531994974759' },
      { input: '021994974759', expected: '5521994974759' },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = normalizePhoneNumber(input);
      assert.strictEqual(result, expected, `Falha para ${input}`);
    });
  });

  await t.test('Sistema valida formato brasileiro', () => {
    const validNumbers = [
      '5531994974759',
      '+55 31 99497-4759',
      '31994974759',
    ];

    validNumbers.forEach(phone => {
      const result = validatePhoneFormat(phone);
      assert.strictEqual(result.isValid, true, `Deveria ser válido: ${phone}`);
    });
  });

  await t.test('Sistema rejeita números inválidos', () => {
    const invalidNumbers = [
      '',
      '123',
      '5531894974759', // 9 dígitos mas não começa com 9
    ];

    invalidNumbers.forEach(phone => {
      const result = validatePhoneFormat(phone);
      assert.strictEqual(result.isValid, false, `Deveria ser inválido: ${phone}`);
    });
  });

  await t.test('Fluxo completo: Cliente → Preparação → Validação', () => {
    // 1. Cliente digita
    const clientInput = '+55 (31) 99497-4759';
    
    // 2. Sistema normaliza
    const normalized = normalizePhoneNumber(clientInput);
    assert.strictEqual(normalized, '5531994974759');
    
    // 3. Sistema valida
    const validation = validatePhoneFormat(normalized);
    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.normalized, '5531994974759');
  });
});
