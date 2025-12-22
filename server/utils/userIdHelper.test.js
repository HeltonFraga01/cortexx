/**
 * Tests for User ID Helper
 * 
 * Run with: cd server && npm test -- --grep "userIdHelper"
 * Or: node --test server/utils/userIdHelper.test.js
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock logger before importing the module
const mockLogger = {
  warn: () => {},
  debug: () => {},
  info: () => {},
  error: () => {}
};

// We need to mock the logger module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === './logger' || id === '../utils/logger') {
    return { logger: mockLogger };
  }
  return originalRequire.apply(this, arguments);
};

const {
  isUUID,
  isWuzapiHash,
  getFormat,
  validate,
  hashToUUID,
  uuidToHash,
  normalizeToUUID,
  normalizeToHash,
  areEqual
} = require('./userIdHelper');

// Restore original require after tests
process.on('exit', () => {
  Module.prototype.require = originalRequire;
});

describe('userIdHelper', () => {
  // Test data
  const validUUID = '12345678-1234-1234-1234-123456789012';
  const validHash = '12345678123412341234123456789012';
  const upperCaseUUID = '12345678-1234-1234-1234-123456789012'.toUpperCase();
  const upperCaseHash = '12345678123412341234123456789012'.toUpperCase();
  
  describe('isUUID', () => {
    it('should return true for valid UUID', () => {
      assert.strictEqual(isUUID(validUUID), true);
    });
    
    it('should return true for uppercase UUID', () => {
      assert.strictEqual(isUUID(upperCaseUUID), true);
    });
    
    it('should return false for hash format', () => {
      assert.strictEqual(isUUID(validHash), false);
    });
    
    it('should return false for null', () => {
      assert.strictEqual(isUUID(null), false);
    });
    
    it('should return false for undefined', () => {
      assert.strictEqual(isUUID(undefined), false);
    });
    
    it('should return false for empty string', () => {
      assert.strictEqual(isUUID(''), false);
    });
    
    it('should return false for invalid UUID', () => {
      assert.strictEqual(isUUID('not-a-uuid'), false);
      assert.strictEqual(isUUID('12345678-1234-1234-1234'), false);
      assert.strictEqual(isUUID('12345678-1234-1234-1234-12345678901'), false);
    });
  });
  
  describe('isWuzapiHash', () => {
    it('should return true for valid hash', () => {
      assert.strictEqual(isWuzapiHash(validHash), true);
    });
    
    it('should return true for uppercase hash', () => {
      assert.strictEqual(isWuzapiHash(upperCaseHash), true);
    });
    
    it('should return false for UUID format', () => {
      assert.strictEqual(isWuzapiHash(validUUID), false);
    });
    
    it('should return false for null', () => {
      assert.strictEqual(isWuzapiHash(null), false);
    });
    
    it('should return false for undefined', () => {
      assert.strictEqual(isWuzapiHash(undefined), false);
    });
    
    it('should return false for empty string', () => {
      assert.strictEqual(isWuzapiHash(''), false);
    });
    
    it('should return false for invalid hash', () => {
      assert.strictEqual(isWuzapiHash('not-a-hash'), false);
      assert.strictEqual(isWuzapiHash('1234567812341234123412345678901'), false); // 31 chars
      assert.strictEqual(isWuzapiHash('123456781234123412341234567890123'), false); // 33 chars
    });
  });
  
  describe('getFormat', () => {
    it('should return "uuid" for UUID format', () => {
      assert.strictEqual(getFormat(validUUID), 'uuid');
    });
    
    it('should return "hash" for hash format', () => {
      assert.strictEqual(getFormat(validHash), 'hash');
    });
    
    it('should return "unknown" for invalid format', () => {
      assert.strictEqual(getFormat('invalid'), 'unknown');
      assert.strictEqual(getFormat(null), 'unknown');
      assert.strictEqual(getFormat(''), 'unknown');
    });
  });
  
  describe('hashToUUID', () => {
    it('should convert hash to UUID format', () => {
      const result = hashToUUID(validHash);
      assert.strictEqual(result, validUUID);
    });
    
    it('should handle uppercase hash', () => {
      const result = hashToUUID(upperCaseHash);
      assert.strictEqual(result.toLowerCase(), validUUID.toLowerCase());
    });
    
    it('should throw for invalid hash', () => {
      assert.throws(() => hashToUUID('invalid'), /Invalid hash format/);
      assert.throws(() => hashToUUID(null), /Invalid hash format/);
    });
  });
  
  describe('uuidToHash', () => {
    it('should convert UUID to hash format', () => {
      const result = uuidToHash(validUUID);
      assert.strictEqual(result, validHash);
    });
    
    it('should handle uppercase UUID', () => {
      const result = uuidToHash(upperCaseUUID);
      assert.strictEqual(result.toLowerCase(), validHash.toLowerCase());
    });
    
    it('should throw for invalid UUID', () => {
      assert.throws(() => uuidToHash('invalid'), /Invalid UUID format/);
      assert.throws(() => uuidToHash(null), /Invalid UUID format/);
    });
  });
  
  describe('normalizeToUUID', () => {
    it('should return UUID as-is (lowercase)', () => {
      const result = normalizeToUUID(validUUID);
      assert.strictEqual(result, validUUID.toLowerCase());
    });
    
    it('should convert hash to UUID', () => {
      const result = normalizeToUUID(validHash);
      assert.strictEqual(result, validUUID.toLowerCase());
    });
    
    it('should handle uppercase input', () => {
      assert.strictEqual(normalizeToUUID(upperCaseUUID), validUUID.toLowerCase());
      assert.strictEqual(normalizeToUUID(upperCaseHash), validUUID.toLowerCase());
    });
    
    it('should return null for invalid input', () => {
      assert.strictEqual(normalizeToUUID('invalid'), null);
      assert.strictEqual(normalizeToUUID(null), null);
      assert.strictEqual(normalizeToUUID(''), null);
    });
  });
  
  describe('normalizeToHash', () => {
    it('should return hash as-is (lowercase)', () => {
      const result = normalizeToHash(validHash);
      assert.strictEqual(result, validHash.toLowerCase());
    });
    
    it('should convert UUID to hash', () => {
      const result = normalizeToHash(validUUID);
      assert.strictEqual(result, validHash.toLowerCase());
    });
    
    it('should handle uppercase input', () => {
      assert.strictEqual(normalizeToHash(upperCaseUUID), validHash.toLowerCase());
      assert.strictEqual(normalizeToHash(upperCaseHash), validHash.toLowerCase());
    });
    
    it('should return null for invalid input', () => {
      assert.strictEqual(normalizeToHash('invalid'), null);
      assert.strictEqual(normalizeToHash(null), null);
      assert.strictEqual(normalizeToHash(''), null);
    });
  });
  
  describe('areEqual', () => {
    it('should return true for same UUID', () => {
      assert.strictEqual(areEqual(validUUID, validUUID), true);
    });
    
    it('should return true for same hash', () => {
      assert.strictEqual(areEqual(validHash, validHash), true);
    });
    
    it('should return true for UUID and equivalent hash', () => {
      assert.strictEqual(areEqual(validUUID, validHash), true);
      assert.strictEqual(areEqual(validHash, validUUID), true);
    });
    
    it('should return true regardless of case', () => {
      assert.strictEqual(areEqual(validUUID, upperCaseUUID), true);
      assert.strictEqual(areEqual(validHash, upperCaseHash), true);
      assert.strictEqual(areEqual(validUUID, upperCaseHash), true);
    });
    
    it('should return false for different IDs', () => {
      const differentUUID = '00000000-0000-0000-0000-000000000000';
      const differentHash = '00000000000000000000000000000000';
      
      assert.strictEqual(areEqual(validUUID, differentUUID), false);
      assert.strictEqual(areEqual(validHash, differentHash), false);
      assert.strictEqual(areEqual(validUUID, differentHash), false);
    });
    
    it('should return false for invalid input', () => {
      assert.strictEqual(areEqual(validUUID, 'invalid'), false);
      assert.strictEqual(areEqual('invalid', validHash), false);
      assert.strictEqual(areEqual(null, validUUID), false);
      assert.strictEqual(areEqual(validHash, null), false);
    });
  });
  
  describe('validate', () => {
    it('should validate UUID correctly', () => {
      const result = validate(validUUID);
      
      assert.strictEqual(result.format, 'uuid');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.asUUID, validUUID.toLowerCase());
      assert.strictEqual(result.asHash, validHash.toLowerCase());
      assert.strictEqual(result.length, 36);
    });
    
    it('should validate hash correctly', () => {
      const result = validate(validHash);
      
      assert.strictEqual(result.format, 'hash');
      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.asUUID, validUUID.toLowerCase());
      assert.strictEqual(result.asHash, validHash.toLowerCase());
      assert.strictEqual(result.length, 32);
    });
    
    it('should handle invalid input', () => {
      const result = validate('invalid');
      
      assert.strictEqual(result.format, 'unknown');
      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.asUUID, null);
      assert.strictEqual(result.asHash, null);
    });
  });
});

// Run tests if executed directly
if (require.main === module) {
  console.log('Running userIdHelper tests...');
}
