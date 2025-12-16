/**
 * Configuration Validation Property Tests
 * Task 17.4: Write property test for configuration validation
 * 
 * Property 20: Configuration Validation
 * For any invalid Supabase configuration (missing URL or keys),
 * the system should fail fast with a clear error message.
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

// Store original env
let originalEnv;

describe('Configuration Validation Properties', () => {
  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Clear relevant env vars
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.DATABASE_BACKEND;
    delete process.env.SQLITE_DB_PATH;
    
    // Clear module cache to reload with new env
    delete require.cache[require.resolve('../../utils/configValidator')];
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });
  
  describe('Property 20: Configuration Validation', () => {
    it('should fail when SUPABASE_URL is missing for supabase backend', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-to-pass-validation-check-minimum-length';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-that-is-long-enough-to-pass-validation-check-minimum-length';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SUPABASE_URL')));
    });
    
    it('should fail when SUPABASE_SERVICE_ROLE_KEY is missing for supabase backend', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-to-pass-validation-check-minimum-length';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SUPABASE_SERVICE_ROLE_KEY')));
    });
    
    it('should fail when SUPABASE_ANON_KEY is missing for supabase backend', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-that-is-long-enough-to-pass-validation-check-minimum-length';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SUPABASE_ANON_KEY')));
    });
    
    it('should pass when all Supabase vars are set', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
    
    it('should fail when SQLITE_DB_PATH is missing for sqlite backend', () => {
      process.env.DATABASE_BACKEND = 'sqlite';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SQLITE_DB_PATH')));
    });
    
    it('should pass when SQLITE_DB_PATH is set for sqlite backend', () => {
      process.env.DATABASE_BACKEND = 'sqlite';
      process.env.SQLITE_DB_PATH = './data/test.db';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, true);
    });
    
    it('should fail when DATABASE_BACKEND is invalid', () => {
      process.env.DATABASE_BACKEND = 'invalid';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Invalid DATABASE_BACKEND')));
    });
    
    it('should default to sqlite backend when DATABASE_BACKEND is not set', () => {
      process.env.SQLITE_DB_PATH = './data/test.db';
      
      const { getDatabaseBackend } = require('../../utils/configValidator');
      const backend = getDatabaseBackend();
      
      assert.strictEqual(backend, 'sqlite');
    });
    
    it('should detect security issue when service key is exposed with VITE_ prefix', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY = 'exposed-service-key';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('SECURITY ERROR')));
    });
  });
  
  describe('Helper Functions', () => {
    it('isSupabaseConfigured should return true when all vars are set', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      
      const { isSupabaseConfigured } = require('../../utils/configValidator');
      assert.strictEqual(isSupabaseConfigured(), true);
    });
    
    it('isSupabaseConfigured should return false when any var is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      // Missing SUPABASE_SERVICE_ROLE_KEY
      
      const { isSupabaseConfigured } = require('../../utils/configValidator');
      assert.strictEqual(isSupabaseConfigured(), false);
    });
    
    it('isSqliteConfigured should return true when SQLITE_DB_PATH is set', () => {
      process.env.SQLITE_DB_PATH = './data/test.db';
      
      const { isSqliteConfigured } = require('../../utils/configValidator');
      assert.strictEqual(isSqliteConfigured(), true);
    });
    
    it('isSqliteConfigured should return false when SQLITE_DB_PATH is not set', () => {
      const { isSqliteConfigured } = require('../../utils/configValidator');
      assert.strictEqual(isSqliteConfigured(), false);
    });
    
    it('getSupabaseConfig should return config object when configured', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
      
      const { getSupabaseConfig } = require('../../utils/configValidator');
      const config = getSupabaseConfig();
      
      assert.deepStrictEqual(config, {
        url: 'https://test.supabase.co',
        anonKey: 'test-anon-key',
        serviceRoleKey: 'test-service-key',
      });
    });
    
    it('getSupabaseConfig should return null when not configured', () => {
      const { getSupabaseConfig } = require('../../utils/configValidator');
      const config = getSupabaseConfig();
      
      assert.strictEqual(config, null);
    });
  });
  
  describe('Warning Generation', () => {
    it('should warn when Supabase URL does not contain supabase.co', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://custom-domain.com';
      process.env.SUPABASE_ANON_KEY = 'test-anon-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key-that-is-long-enough-to-pass-validation-check-minimum-length-requirement-for-jwt-tokens';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.ok(result.warnings.some(w => w.includes('valid Supabase URL')));
    });
    
    it('should warn when keys appear too short', () => {
      process.env.DATABASE_BACKEND = 'supabase';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_ANON_KEY = 'short-key';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'short-key';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.ok(result.warnings.some(w => w.includes('too short')));
    });
    
    it('should warn when SQLite path does not end with .db', () => {
      process.env.DATABASE_BACKEND = 'sqlite';
      process.env.SQLITE_DB_PATH = './data/database';
      
      const { validateConfig } = require('../../utils/configValidator');
      const result = validateConfig({ exitOnError: false });
      
      assert.ok(result.warnings.some(w => w.includes('.db extension')));
    });
  });
});
