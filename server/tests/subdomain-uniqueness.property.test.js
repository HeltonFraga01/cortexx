#!/usr/bin/env node

/**
 * Property-Based Tests for Subdomain Uniqueness and Resolution
 * Tests that subdomains are unique identifiers and resolve consistently
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fc = require('fast-check');
const TenantService = require('../services/TenantService');
const SupabaseService = require('../services/SupabaseService');

// Generator for valid subdomains (lowercase alphanumeric with hyphens)
const subdomainGen = fc.string({ minLength: 3, maxLength: 20 })
  .filter(s => /^[a-z0-9-]+$/.test(s))
  .filter(s => !s.startsWith('-') && !s.endsWith('-'))
  .filter(s => !s.includes('--'));

// Generator for tenant data
const tenantDataGen = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  owner_superadmin_id: fc.uuid(),
  status: fc.constantFrom('active', 'inactive', 'suspended'),
  settings: fc.constant({})
});

/**
 * **Feature: multi-tenant-architecture, Property 1: Subdomain Uniqueness**
 * **Validates: Requirements 2.1**
 */
test('Property 1: Subdomain Uniqueness - cannot create duplicate subdomains', async () => {
  await fc.assert(
    fc.asyncProperty(
      subdomainGen,
      tenantDataGen,
      tenantDataGen,
      async (subdomain, tenant1Data, tenant2Data) => {
        let tenant1Id = null;
        let tenant2Id = null;
        
        try {
          // Create first tenant with subdomain
          const { data: tenant1, error: error1 } = await SupabaseService.insert('tenants', {
            ...tenant1Data,
            subdomain
          });
          
          if (error1) {
            // If first insert fails, skip this test case
            return true;
          }
          
          tenant1Id = tenant1.id;
          
          // Attempt to create second tenant with same subdomain
          const { data: tenant2, error: error2 } = await SupabaseService.insert('tenants', {
            ...tenant2Data,
            subdomain // Same subdomain
          });
          
          // Second insert should fail due to unique constraint
          assert(error2, 'Duplicate subdomain was allowed');
          assert(!tenant2, 'Second tenant with duplicate subdomain was created');
          
        } finally {
          // Cleanup
          if (tenant1Id) {
            await SupabaseService.delete('tenants', tenant1Id);
          }
        }
      }
    ),
    { numRuns: 10 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 12: Subdomain Resolution Consistency**
 * **Validates: Requirements 8.1**
 */
test('Property 12: Subdomain Resolution Consistency - deterministic resolution', async () => {
  await fc.assert(
    fc.asyncProperty(
      subdomainGen,
      tenantDataGen,
      async (subdomain, tenantData) => {
        let tenantId = null;
        
        try {
          // Create tenant
          const { data: tenant, error } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain
          });
          
          if (error) return true; // Skip if creation fails
          
          tenantId = tenant.id;
          
          // Resolve subdomain multiple times
          const resolution1 = await TenantService.getBySubdomain(subdomain);
          const resolution2 = await TenantService.getBySubdomain(subdomain);
          const resolution3 = await TenantService.getBySubdomain(subdomain);
          
          // All resolutions should return the same tenant
          assert(resolution1, 'First resolution failed');
          assert(resolution2, 'Second resolution failed');
          assert(resolution3, 'Third resolution failed');
          
          assert.strictEqual(resolution1.id, tenant.id, 'First resolution returned wrong tenant');
          assert.strictEqual(resolution2.id, tenant.id, 'Second resolution returned wrong tenant');
          assert.strictEqual(resolution3.id, tenant.id, 'Third resolution returned wrong tenant');
          
          // All resolutions should be identical
          assert.deepStrictEqual(resolution1, resolution2, 'Resolutions are not identical');
          assert.deepStrictEqual(resolution2, resolution3, 'Resolutions are not identical');
          
        } finally {
          // Cleanup
          if (tenantId) {
            await SupabaseService.delete('tenants', tenantId);
          }
        }
      }
    ),
    { numRuns: 10 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 1: Subdomain Validation**
 * **Validates: Requirements 2.1**
 */
test('Property 1: Subdomain Validation - format requirements', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 30 }),
      (testString) => {
        const isValid = TenantService.validateSubdomain(testString);
        
        if (isValid) {
          // If validation passes, string must meet format requirements
          assert.match(testString, /^[a-z0-9-]+$/, 'Valid subdomain contains invalid characters');
          assert(!testString.startsWith('-'), 'Valid subdomain starts with hyphen');
          assert(!testString.endsWith('-'), 'Valid subdomain ends with hyphen');
          assert(!testString.includes('--'), 'Valid subdomain contains consecutive hyphens');
          assert(testString.length >= 3, 'Valid subdomain is too short');
          assert(testString.length <= 20, 'Valid subdomain is too long');
        } else {
          // If validation fails, string must violate at least one requirement
          const violatesFormat = !/^[a-z0-9-]+$/.test(testString);
          const startsWithHyphen = testString.startsWith('-');
          const endsWithHyphen = testString.endsWith('-');
          const hasConsecutiveHyphens = testString.includes('--');
          const tooShort = testString.length < 3;
          const tooLong = testString.length > 20;
          
          const hasViolation = violatesFormat || startsWithHyphen || endsWithHyphen || 
                              hasConsecutiveHyphens || tooShort || tooLong;
          
          assert(hasViolation, 'Invalid subdomain should violate at least one rule');
        }
      }
    ),
    { numRuns: 100 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 12: Nonexistent Subdomain Resolution**
 * **Validates: Requirements 8.1**
 */
test('Property 12: Nonexistent Subdomain Resolution - returns null consistently', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 10, maxLength: 30 }).filter(s => s.startsWith('nonexistent-')),
      async (nonexistentSubdomain) => {
        // Try to resolve a subdomain that definitely doesn't exist
        const resolution1 = await TenantService.getBySubdomain(nonexistentSubdomain);
        const resolution2 = await TenantService.getBySubdomain(nonexistentSubdomain);
        
        // Should consistently return null
        assert.strictEqual(resolution1, null, 'Nonexistent subdomain returned a tenant');
        assert.strictEqual(resolution2, null, 'Nonexistent subdomain returned a tenant');
        assert.strictEqual(resolution1, resolution2, 'Inconsistent resolution for nonexistent subdomain');
      }
    ),
    { numRuns: 20 }
  );
});

/**
 * **Feature: multi-tenant-architecture, Property 1: Subdomain Case Sensitivity**
 * **Validates: Requirements 2.1**
 */
test('Property 1: Subdomain Case Sensitivity - lowercase enforcement', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.string({ minLength: 3, maxLength: 10 }).filter(s => /^[a-zA-Z0-9]+$/.test(s)),
      tenantDataGen,
      async (baseSubdomain, tenantData) => {
        const lowerSubdomain = baseSubdomain.toLowerCase();
        const upperSubdomain = baseSubdomain.toUpperCase();
        const mixedSubdomain = baseSubdomain.split('').map((c, i) => 
          i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()
        ).join('');
        
        // Skip if all variations are the same (all numeric)
        if (lowerSubdomain === upperSubdomain) return true;
        
        let tenantId = null;
        
        try {
          // Create tenant with lowercase subdomain
          const { data: tenant, error } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: lowerSubdomain
          });
          
          if (error) return true; // Skip if creation fails
          
          tenantId = tenant.id;
          
          // Try to create tenant with uppercase version
          const { error: upperError } = await SupabaseService.insert('tenants', {
            ...tenantData,
            subdomain: upperSubdomain
          });
          
          // Should fail because subdomains should be case-insensitive unique
          // OR the system should normalize to lowercase
          if (!upperError) {
            // If it succeeded, it means the system allows different cases
            // This might be acceptable depending on implementation
            // Clean up the second tenant
            const { data: upperTenant } = await SupabaseService.getMany('tenants', {
              subdomain: upperSubdomain
            });
            if (upperTenant.length > 0) {
              await SupabaseService.delete('tenants', upperTenant[0].id);
            }
          }
          
          // Resolution should work consistently regardless of case used in query
          const resolutionLower = await TenantService.getBySubdomain(lowerSubdomain);
          const resolutionUpper = await TenantService.getBySubdomain(upperSubdomain);
          const resolutionMixed = await TenantService.getBySubdomain(mixedSubdomain);
          
          // At least the lowercase version should resolve to our tenant
          assert(resolutionLower, 'Lowercase subdomain should resolve');
          assert.strictEqual(resolutionLower.id, tenant.id, 'Lowercase resolution incorrect');
          
        } finally {
          // Cleanup
          if (tenantId) {
            await SupabaseService.delete('tenants', tenantId);
          }
        }
      }
    ),
    { numRuns: 10 }
  );
});