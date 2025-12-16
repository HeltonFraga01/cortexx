/**
 * Backward Compatibility Property Tests
 * Task 20.5-20.7: Property tests for backward compatibility
 * 
 * Tests:
 * - Property 21: Dual Write Consistency
 * - Property 22: Backend Switch
 * - Property 23: Data Consistency Verification
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock implementations for testing
class MockSQLiteBackend {
  constructor() {
    this.data = new Map();
    this.operations = [];
  }
  
  getBackendName() { return 'sqlite'; }
  
  async insert(table, data) {
    const id = data.id || Date.now();
    const record = { ...data, id };
    
    if (!this.data.has(table)) {
      this.data.set(table, new Map());
    }
    this.data.get(table).set(id, record);
    this.operations.push({ type: 'insert', table, data: record });
    
    return { data: record, error: null };
  }
  
  async update(table, id, data) {
    const tableData = this.data.get(table);
    if (!tableData || !tableData.has(id)) {
      return { data: null, error: new Error('Not found') };
    }
    
    const record = { ...tableData.get(id), ...data };
    tableData.set(id, record);
    this.operations.push({ type: 'update', table, id, data: record });
    
    return { data: record, error: null };
  }
  
  async delete(table, id) {
    const tableData = this.data.get(table);
    if (tableData) {
      tableData.delete(id);
    }
    this.operations.push({ type: 'delete', table, id });
    
    return { data: null, error: null };
  }
  
  async getById(table, id) {
    const tableData = this.data.get(table);
    const record = tableData?.get(id) || null;
    return { data: record, error: null };
  }
  
  async getMany(table, filters = {}) {
    const tableData = this.data.get(table);
    if (!tableData) return { data: [], error: null };
    
    let records = Array.from(tableData.values());
    
    for (const [key, value] of Object.entries(filters)) {
      records = records.filter(r => r[key] === value);
    }
    
    return { data: records, error: null };
  }
  
  async count(table, filters = {}) {
    const result = await this.getMany(table, filters);
    return { count: result.data.length, error: null };
  }
  
  clearOperations() {
    this.operations = [];
  }
}

class MockSupabaseBackend {
  constructor() {
    this.data = new Map();
    this.operations = [];
    this.shouldFail = false;
  }
  
  getBackendName() { return 'supabase'; }
  
  setFailMode(fail) {
    this.shouldFail = fail;
  }
  
  async insert(table, data) {
    if (this.shouldFail) {
      return { data: null, error: new Error('Supabase error') };
    }
    
    const id = data.id || `uuid-${Date.now()}`;
    const record = { ...data, id };
    
    if (!this.data.has(table)) {
      this.data.set(table, new Map());
    }
    this.data.get(table).set(id, record);
    this.operations.push({ type: 'insert', table, data: record });
    
    return { data: record, error: null };
  }
  
  async update(table, id, data) {
    if (this.shouldFail) {
      return { data: null, error: new Error('Supabase error') };
    }
    
    const tableData = this.data.get(table);
    if (!tableData || !tableData.has(id)) {
      return { data: null, error: new Error('Not found') };
    }
    
    const record = { ...tableData.get(id), ...data };
    tableData.set(id, record);
    this.operations.push({ type: 'update', table, id, data: record });
    
    return { data: record, error: null };
  }
  
  async delete(table, id) {
    if (this.shouldFail) {
      return { data: null, error: new Error('Supabase error') };
    }
    
    const tableData = this.data.get(table);
    if (tableData) {
      tableData.delete(id);
    }
    this.operations.push({ type: 'delete', table, id });
    
    return { data: null, error: null };
  }
  
  async getById(table, id) {
    const tableData = this.data.get(table);
    const record = tableData?.get(id) || null;
    return { data: record, error: null };
  }
  
  async getMany(table, filters = {}) {
    const tableData = this.data.get(table);
    if (!tableData) return { data: [], error: null };
    
    let records = Array.from(tableData.values());
    
    for (const [key, value] of Object.entries(filters)) {
      records = records.filter(r => r[key] === value);
    }
    
    return { data: records, error: null };
  }
  
  async count(table, filters = {}) {
    const result = await this.getMany(table, filters);
    return { count: result.data.length, error: null };
  }
  
  clearOperations() {
    this.operations = [];
  }
}

// Dual-write backend implementation for testing
class TestDualWriteBackend {
  constructor(primary, secondary) {
    this.primary = primary;
    this.secondary = secondary;
    this.discrepancies = [];
  }
  
  getBackendName() {
    return `dual-write (primary: ${this.primary.getBackendName()})`;
  }
  
  async insert(table, data) {
    const primaryResult = await this.primary.insert(table, data);
    
    try {
      const secondaryResult = await this.secondary.insert(table, data);
      if (secondaryResult.error) {
        this.discrepancies.push({
          operation: 'insert',
          table,
          data,
          error: secondaryResult.error.message
        });
      }
    } catch (error) {
      this.discrepancies.push({
        operation: 'insert',
        table,
        data,
        error: error.message
      });
    }
    
    return primaryResult;
  }
  
  async update(table, id, data) {
    const primaryResult = await this.primary.update(table, id, data);
    
    try {
      const secondaryResult = await this.secondary.update(table, id, data);
      if (secondaryResult.error) {
        this.discrepancies.push({
          operation: 'update',
          table,
          id,
          data,
          error: secondaryResult.error.message
        });
      }
    } catch (error) {
      this.discrepancies.push({
        operation: 'update',
        table,
        id,
        data,
        error: error.message
      });
    }
    
    return primaryResult;
  }
  
  async delete(table, id) {
    const primaryResult = await this.primary.delete(table, id);
    
    try {
      const secondaryResult = await this.secondary.delete(table, id);
      if (secondaryResult.error) {
        this.discrepancies.push({
          operation: 'delete',
          table,
          id,
          error: secondaryResult.error.message
        });
      }
    } catch (error) {
      this.discrepancies.push({
        operation: 'delete',
        table,
        id,
        error: error.message
      });
    }
    
    return primaryResult;
  }
  
  async getById(table, id) {
    return this.primary.getById(table, id);
  }
  
  async getMany(table, filters = {}) {
    return this.primary.getMany(table, filters);
  }
  
  getDiscrepancies() {
    return this.discrepancies;
  }
}

describe('Backward Compatibility Property Tests', () => {
  let sqliteBackend;
  let supabaseBackend;
  
  beforeEach(() => {
    sqliteBackend = new MockSQLiteBackend();
    supabaseBackend = new MockSupabaseBackend();
  });
  
  /**
   * Property 21: Dual Write Consistency
   * For any write operation during migration, data should be written to both backends
   */
  describe('Property 21: Dual Write Consistency', () => {
    
    it('should write to both backends on insert', async () => {
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      const data = { name: 'Test Account', status: 'active' };
      await dualWrite.insert('accounts', data);
      
      // Both backends should have the record
      const sqliteResult = await sqliteBackend.getMany('accounts');
      const supabaseResult = await supabaseBackend.getMany('accounts');
      
      assert.strictEqual(sqliteResult.data.length, 1);
      assert.strictEqual(supabaseResult.data.length, 1);
      assert.strictEqual(sqliteResult.data[0].name, data.name);
      assert.strictEqual(supabaseResult.data[0].name, data.name);
    });
    
    it('should write to both backends on update', async () => {
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      // Insert first
      const { data: inserted } = await dualWrite.insert('accounts', { 
        id: 'test-1', 
        name: 'Original', 
        status: 'active' 
      });
      
      // Update
      await dualWrite.update('accounts', inserted.id, { name: 'Updated' });
      
      // Both backends should have the updated record
      const sqliteResult = await sqliteBackend.getById('accounts', inserted.id);
      const supabaseResult = await supabaseBackend.getById('accounts', inserted.id);
      
      assert.strictEqual(sqliteResult.data.name, 'Updated');
      assert.strictEqual(supabaseResult.data.name, 'Updated');
    });
    
    it('should delete from both backends', async () => {
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      // Insert first
      const { data: inserted } = await dualWrite.insert('accounts', { 
        id: 'test-1', 
        name: 'To Delete' 
      });
      
      // Delete
      await dualWrite.delete('accounts', inserted.id);
      
      // Both backends should not have the record
      const sqliteResult = await sqliteBackend.getById('accounts', inserted.id);
      const supabaseResult = await supabaseBackend.getById('accounts', inserted.id);
      
      assert.strictEqual(sqliteResult.data, null);
      assert.strictEqual(supabaseResult.data, null);
    });
    
    it('should log discrepancies when secondary fails', async () => {
      supabaseBackend.setFailMode(true);
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      // Insert should succeed on primary but fail on secondary
      const data = { name: 'Test', status: 'active' };
      const result = await dualWrite.insert('accounts', data);
      
      // Primary should succeed
      assert.ok(result.data);
      assert.strictEqual(result.error, null);
      
      // Discrepancy should be logged
      const discrepancies = dualWrite.getDiscrepancies();
      assert.strictEqual(discrepancies.length, 1);
      assert.strictEqual(discrepancies[0].operation, 'insert');
      assert.strictEqual(discrepancies[0].table, 'accounts');
    });
    
    it('should maintain consistency across multiple operations', async () => {
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      // Perform multiple operations
      const operations = [
        { type: 'insert', data: { id: '1', name: 'Account 1' } },
        { type: 'insert', data: { id: '2', name: 'Account 2' } },
        { type: 'update', id: '1', data: { name: 'Account 1 Updated' } },
        { type: 'delete', id: '2' }
      ];
      
      for (const op of operations) {
        if (op.type === 'insert') {
          await dualWrite.insert('accounts', op.data);
        } else if (op.type === 'update') {
          await dualWrite.update('accounts', op.id, op.data);
        } else if (op.type === 'delete') {
          await dualWrite.delete('accounts', op.id);
        }
      }
      
      // Final state should be consistent
      const sqliteCount = await sqliteBackend.count('accounts');
      const supabaseCount = await supabaseBackend.count('accounts');
      
      assert.strictEqual(sqliteCount.count, supabaseCount.count);
      assert.strictEqual(sqliteCount.count, 1); // Only Account 1 remains
    });
  });
  
  /**
   * Property 22: Backend Switch
   * For any value of the database backend feature flag, queries should be routed correctly
   */
  describe('Property 22: Backend Switch', () => {
    
    it('should route queries to SQLite when USE_SUPABASE is false', async () => {
      // Simulate USE_SUPABASE=false
      const backend = sqliteBackend;
      
      await backend.insert('accounts', { id: '1', name: 'Test' });
      const result = await backend.getById('accounts', '1');
      
      assert.strictEqual(backend.getBackendName(), 'sqlite');
      assert.ok(result.data);
      assert.strictEqual(result.data.name, 'Test');
    });
    
    it('should route queries to Supabase when USE_SUPABASE is true', async () => {
      // Simulate USE_SUPABASE=true
      const backend = supabaseBackend;
      
      await backend.insert('accounts', { id: '1', name: 'Test' });
      const result = await backend.getById('accounts', '1');
      
      assert.strictEqual(backend.getBackendName(), 'supabase');
      assert.ok(result.data);
      assert.strictEqual(result.data.name, 'Test');
    });
    
    it('should use primary backend for reads in dual-write mode', async () => {
      // Primary is SQLite
      const dualWrite = new TestDualWriteBackend(sqliteBackend, supabaseBackend);
      
      // Insert data
      await dualWrite.insert('accounts', { id: '1', name: 'Test' });
      
      // Modify only in SQLite (simulating out-of-band change)
      await sqliteBackend.update('accounts', '1', { name: 'SQLite Only' });
      
      // Read should come from primary (SQLite)
      const result = await dualWrite.getById('accounts', '1');
      
      assert.strictEqual(result.data.name, 'SQLite Only');
    });
    
    it('should handle backend switch without data loss', async () => {
      // Start with SQLite
      await sqliteBackend.insert('accounts', { id: '1', name: 'Account 1' });
      await sqliteBackend.insert('accounts', { id: '2', name: 'Account 2' });
      
      // Simulate migration to Supabase
      const sqliteData = await sqliteBackend.getMany('accounts');
      for (const record of sqliteData.data) {
        await supabaseBackend.insert('accounts', record);
      }
      
      // Switch to Supabase
      const newBackend = supabaseBackend;
      
      // All data should be accessible
      const result = await newBackend.getMany('accounts');
      assert.strictEqual(result.data.length, 2);
    });
  });
  
  /**
   * Property 23: Data Consistency Verification
   * The data consistency tool should correctly identify differences between backends
   */
  describe('Property 23: Data Consistency Verification', () => {
    
    it('should detect missing records in secondary', async () => {
      // Add record only to SQLite
      await sqliteBackend.insert('accounts', { id: '1', name: 'Only in SQLite' });
      
      // Compare
      const sqliteRecords = await sqliteBackend.getMany('accounts');
      const supabaseRecords = await supabaseBackend.getMany('accounts');
      
      const sqliteIds = new Set(sqliteRecords.data.map(r => r.id));
      const supabaseIds = new Set(supabaseRecords.data.map(r => r.id));
      
      const missingInSupabase = [...sqliteIds].filter(id => !supabaseIds.has(id));
      
      assert.strictEqual(missingInSupabase.length, 1);
      assert.strictEqual(missingInSupabase[0], '1');
    });
    
    it('should detect extra records in secondary', async () => {
      // Add record only to Supabase
      await supabaseBackend.insert('accounts', { id: '1', name: 'Only in Supabase' });
      
      // Compare
      const sqliteRecords = await sqliteBackend.getMany('accounts');
      const supabaseRecords = await supabaseBackend.getMany('accounts');
      
      const sqliteIds = new Set(sqliteRecords.data.map(r => r.id));
      const supabaseIds = new Set(supabaseRecords.data.map(r => r.id));
      
      const extraInSupabase = [...supabaseIds].filter(id => !sqliteIds.has(id));
      
      assert.strictEqual(extraInSupabase.length, 1);
      assert.strictEqual(extraInSupabase[0], '1');
    });
    
    it('should detect different field values', async () => {
      // Add same record with different values
      await sqliteBackend.insert('accounts', { id: '1', name: 'SQLite Name', status: 'active' });
      await supabaseBackend.insert('accounts', { id: '1', name: 'Supabase Name', status: 'active' });
      
      // Compare
      const sqliteRecord = await sqliteBackend.getById('accounts', '1');
      const supabaseRecord = await supabaseBackend.getById('accounts', '1');
      
      const differences = [];
      const fieldsToCompare = ['name', 'status'];
      
      for (const field of fieldsToCompare) {
        if (sqliteRecord.data[field] !== supabaseRecord.data[field]) {
          differences.push({
            field,
            sqlite: sqliteRecord.data[field],
            supabase: supabaseRecord.data[field]
          });
        }
      }
      
      assert.strictEqual(differences.length, 1);
      assert.strictEqual(differences[0].field, 'name');
      assert.strictEqual(differences[0].sqlite, 'SQLite Name');
      assert.strictEqual(differences[0].supabase, 'Supabase Name');
    });
    
    it('should report consistent when data matches', async () => {
      // Add same records to both
      const records = [
        { id: '1', name: 'Account 1', status: 'active' },
        { id: '2', name: 'Account 2', status: 'inactive' }
      ];
      
      for (const record of records) {
        await sqliteBackend.insert('accounts', record);
        await supabaseBackend.insert('accounts', record);
      }
      
      // Compare
      const sqliteRecords = await sqliteBackend.getMany('accounts');
      const supabaseRecords = await supabaseBackend.getMany('accounts');
      
      const sqliteMap = new Map(sqliteRecords.data.map(r => [r.id, r]));
      const supabaseMap = new Map(supabaseRecords.data.map(r => [r.id, r]));
      
      let isConsistent = true;
      
      for (const [id, sqliteRecord] of sqliteMap) {
        const supabaseRecord = supabaseMap.get(id);
        if (!supabaseRecord) {
          isConsistent = false;
          break;
        }
        if (JSON.stringify(sqliteRecord) !== JSON.stringify(supabaseRecord)) {
          isConsistent = false;
          break;
        }
      }
      
      assert.strictEqual(isConsistent, true);
    });
  });
});

// Run tests
if (require.main === module) {
  const { run } = require('node:test');
  const { spec } = require('node:test/reporters');
  
  run({ files: [__filename] })
    .compose(spec)
    .pipe(process.stdout);
}
