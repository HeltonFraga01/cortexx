/**
 * Data Consistency Verification Tool
 * Task 20.4: Create data consistency verification tool
 * 
 * Compares data between SQLite and Supabase to identify differences.
 * Run with: node server/scripts/verify-data-consistency.js [--fix] [--table=name]
 * 
 * Options:
 *   --fix         Attempt to fix discrepancies (sync from primary to secondary)
 *   --table=name  Check specific table only
 *   --sample=N    Sample size for large tables (default: 100)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const CONFIG = {
  fix: process.argv.includes('--fix'),
  specificTable: process.argv.find(arg => arg.startsWith('--table='))?.split('=')[1],
  sampleSize: parseInt(process.argv.find(arg => arg.startsWith('--sample='))?.split('=')[1] || '100'),
  sqlitePath: process.env.SQLITE_DB_PATH || path.join(__dirname, '../../wuzapi.db'),
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  primaryBackend: process.env.USE_SUPABASE === 'true' ? 'supabase' : 'sqlite'
};

// Tables to verify with their key fields
const TABLES = [
  { name: 'branding_config', keyField: 'app_name', compareFields: ['logo_url', 'primary_color'] },
  { name: 'plans', keyField: 'name', compareFields: ['price_cents', 'status', 'quotas'] },
  { name: 'accounts', keyField: 'wuzapi_token', compareFields: ['name', 'status', 'settings'] },
  { name: 'agents', keyField: 'email', compareFields: ['name', 'role', 'status'] },
  { name: 'inboxes', keyField: 'name', compareFields: ['channel_type', 'status'] },
  { name: 'conversations', keyField: 'contact_jid', compareFields: ['status', 'unread_count'] },
  { name: 'outgoing_webhooks', keyField: 'url', compareFields: ['status', 'events'] }
];

let supabase, sqliteDb;

function initSupabase() {
  return createClient(CONFIG.supabaseUrl, CONFIG.supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function initSQLite() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(CONFIG.sqlitePath, sqlite3.OPEN_READONLY, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function sqliteQuery(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

async function tableExists(tableName) {
  const result = await sqliteQuery(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
    [tableName]
  );
  return result.length > 0;
}

/**
 * Generate hash for record comparison
 */
function hashRecord(record, fields) {
  const data = fields.map(f => JSON.stringify(record[f] || null)).join('|');
  return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Compare records between SQLite and Supabase
 */
async function compareTable(tableConfig) {
  const { name, keyField, compareFields } = tableConfig;
  
  console.log(`\n📊 Comparing ${name}...`);
  
  const result = {
    table: name,
    sqliteCount: 0,
    supabaseCount: 0,
    matching: 0,
    missingInSupabase: [],
    missingInSqlite: [],
    different: [],
    errors: []
  };
  
  try {
    // Check if table exists in SQLite
    if (!await tableExists(name)) {
      console.log(`  ⚠️ Table ${name} does not exist in SQLite`);
      result.errors.push('Table not found in SQLite');
      return result;
    }
    
    // Get SQLite records
    const sqliteRows = await sqliteQuery(`SELECT * FROM ${name} LIMIT ${CONFIG.sampleSize}`);
    result.sqliteCount = sqliteRows.length;
    
    // Get Supabase records
    const { data: supabaseRows, error } = await supabase
      .from(name)
      .select('*')
      .limit(CONFIG.sampleSize);
    
    if (error) {
      result.errors.push(`Supabase error: ${error.message}`);
      return result;
    }
    
    result.supabaseCount = supabaseRows?.length || 0;
    
    // Build lookup maps
    const sqliteMap = new Map();
    const supabaseMap = new Map();
    
    for (const row of sqliteRows) {
      const key = row[keyField];
      if (key) {
        sqliteMap.set(String(key), row);
      }
    }
    
    for (const row of supabaseRows || []) {
      const key = row[keyField];
      if (key) {
        supabaseMap.set(String(key), row);
      }
    }
    
    // Compare records
    for (const [key, sqliteRow] of sqliteMap) {
      const supabaseRow = supabaseMap.get(key);
      
      if (!supabaseRow) {
        result.missingInSupabase.push(key);
        continue;
      }
      
      // Compare field values
      const sqliteHash = hashRecord(sqliteRow, compareFields);
      const supabaseHash = hashRecord(supabaseRow, compareFields);
      
      if (sqliteHash !== supabaseHash) {
        result.different.push({
          key,
          differences: compareFields.filter(f => 
            JSON.stringify(sqliteRow[f]) !== JSON.stringify(supabaseRow[f])
          ).map(f => ({
            field: f,
            sqlite: sqliteRow[f],
            supabase: supabaseRow[f]
          }))
        });
      } else {
        result.matching++;
      }
    }
    
    // Find records only in Supabase
    for (const [key] of supabaseMap) {
      if (!sqliteMap.has(key)) {
        result.missingInSqlite.push(key);
      }
    }
    
    // Print summary
    const status = result.different.length === 0 && 
                   result.missingInSupabase.length === 0 && 
                   result.missingInSqlite.length === 0 ? '✅' : '⚠️';
    
    console.log(`  ${status} SQLite: ${result.sqliteCount}, Supabase: ${result.supabaseCount}`);
    console.log(`     Matching: ${result.matching}`);
    console.log(`     Missing in Supabase: ${result.missingInSupabase.length}`);
    console.log(`     Missing in SQLite: ${result.missingInSqlite.length}`);
    console.log(`     Different: ${result.different.length}`);
    
    // Show differences if any
    if (result.different.length > 0) {
      console.log('\n     Differences:');
      result.different.slice(0, 5).forEach(diff => {
        console.log(`       ${diff.key}:`);
        diff.differences.forEach(d => {
          console.log(`         ${d.field}: SQLite="${d.sqlite}" vs Supabase="${d.supabase}"`);
        });
      });
      if (result.different.length > 5) {
        console.log(`       ... and ${result.different.length - 5} more`);
      }
    }
    
  } catch (error) {
    result.errors.push(error.message);
    console.log(`  ❌ Error: ${error.message}`);
  }
  
  return result;
}

/**
 * Attempt to fix discrepancies
 */
async function fixDiscrepancies(results) {
  console.log('\n🔧 Attempting to fix discrepancies...\n');
  
  for (const result of results) {
    if (result.errors.length > 0) continue;
    
    const tableConfig = TABLES.find(t => t.name === result.table);
    if (!tableConfig) continue;
    
    // Fix missing in Supabase (copy from SQLite)
    if (result.missingInSupabase.length > 0 && CONFIG.primaryBackend === 'sqlite') {
      console.log(`  Syncing ${result.missingInSupabase.length} records to Supabase for ${result.table}...`);
      
      for (const key of result.missingInSupabase.slice(0, 10)) {
        try {
          const [row] = await sqliteQuery(
            `SELECT * FROM ${result.table} WHERE ${tableConfig.keyField} = ?`,
            [key]
          );
          
          if (row) {
            // Remove SQLite-specific fields
            delete row.id;
            
            const { error } = await supabase.from(result.table).insert(row);
            if (error) {
              console.log(`    ❌ Failed to sync ${key}: ${error.message}`);
            } else {
              console.log(`    ✅ Synced ${key}`);
            }
          }
        } catch (error) {
          console.log(`    ❌ Error syncing ${key}: ${error.message}`);
        }
      }
    }
    
    // Fix different records (update secondary from primary)
    if (result.different.length > 0) {
      console.log(`  Updating ${result.different.length} different records in ${result.table}...`);
      
      for (const diff of result.different.slice(0, 10)) {
        try {
          if (CONFIG.primaryBackend === 'sqlite') {
            // Update Supabase from SQLite
            const [row] = await sqliteQuery(
              `SELECT * FROM ${result.table} WHERE ${tableConfig.keyField} = ?`,
              [diff.key]
            );
            
            if (row) {
              const updateData = {};
              diff.differences.forEach(d => {
                updateData[d.field] = row[d.field];
              });
              
              const { error } = await supabase
                .from(result.table)
                .update(updateData)
                .eq(tableConfig.keyField, diff.key);
              
              if (error) {
                console.log(`    ❌ Failed to update ${diff.key}: ${error.message}`);
              } else {
                console.log(`    ✅ Updated ${diff.key}`);
              }
            }
          }
        } catch (error) {
          console.log(`    ❌ Error updating ${diff.key}: ${error.message}`);
        }
      }
    }
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Data Consistency Verification');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Primary Backend: ${CONFIG.primaryBackend}`);
  console.log(`  Fix Mode: ${CONFIG.fix ? 'ENABLED' : 'DISABLED'}`);
  console.log(`  Sample Size: ${CONFIG.sampleSize}`);
  console.log('═══════════════════════════════════════════════════════════════');
  
  try {
    sqliteDb = await initSQLite();
    console.log('✅ Connected to SQLite');
    
    supabase = initSupabase();
    console.log('✅ Connected to Supabase');
    
    const tablesToCheck = CONFIG.specificTable 
      ? TABLES.filter(t => t.name === CONFIG.specificTable)
      : TABLES;
    
    const results = [];
    
    for (const tableConfig of tablesToCheck) {
      const result = await compareTable(tableConfig);
      results.push(result);
    }
    
    // Fix discrepancies if requested
    if (CONFIG.fix) {
      await fixDiscrepancies(results);
    }
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════════════');
    
    const totalMatching = results.reduce((sum, r) => sum + r.matching, 0);
    const totalDifferent = results.reduce((sum, r) => sum + r.different.length, 0);
    const totalMissing = results.reduce((sum, r) => sum + r.missingInSupabase.length + r.missingInSqlite.length, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);
    
    console.log(`  Tables Checked: ${results.length}`);
    console.log(`  Matching Records: ${totalMatching}`);
    console.log(`  Different Records: ${totalDifferent}`);
    console.log(`  Missing Records: ${totalMissing}`);
    console.log(`  Errors: ${totalErrors}`);
    
    const allConsistent = totalDifferent === 0 && totalMissing === 0 && totalErrors === 0;
    console.log(`  Overall: ${allConsistent ? '✅ CONSISTENT' : '⚠️ INCONSISTENCIES FOUND'}`);
    console.log('═══════════════════════════════════════════════════════════════\n');
    
    process.exit(allConsistent ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    if (sqliteDb) sqliteDb.close();
  }
}

main().catch(console.error);
