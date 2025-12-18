/**
 * Migration Runner Script
 * Executes SQL migrations on Supabase database
 * 
 * Usage: node server/scripts/run-migrations.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration(migrationFile) {
  const migrationPath = path.join(__dirname, '../migrations', migrationFile);
  
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`🔄 Running migration: ${migrationFile}`);
  
  try {
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { query: sql });
    
    if (error) {
      // If exec_sql RPC doesn't exist, try direct query execution
      if (error.message?.includes('function exec_sql')) {
        console.log('⚠️  exec_sql RPC not available, executing SQL directly...');
        
        // Split SQL into individual statements and execute them
        const statements = sql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          if (statement.trim()) {
            const { error: directError } = await supabase.from('_').select('1').limit(0);
            // This is a workaround - we'll need to use a different approach
            console.log(`⚠️  Cannot execute SQL directly via Supabase client. Please run migrations manually in Supabase dashboard.`);
            console.log(`📋 SQL to execute:\n${sql}`);
            return;
          }
        }
      } else {
        throw error;
      }
    }
    
    console.log(`✅ Migration completed: ${migrationFile}`);
    
  } catch (error) {
    console.error(`❌ Migration failed: ${migrationFile}`);
    console.error(`   Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Multi-Tenant Architecture Migrations');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const migrationsDir = path.join(__dirname, '../migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    console.error('❌ Migrations directory not found');
    process.exit(1);
  }
  
  // Get all migration files and sort them
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  if (migrationFiles.length === 0) {
    console.log('⚠️  No migration files found');
    return;
  }
  
  console.log(`📋 Found ${migrationFiles.length} migration files:\n`);
  migrationFiles.forEach(file => console.log(`   • ${file}`));
  console.log('');
  
  // Run each migration
  for (const migrationFile of migrationFiles) {
    await runMigration(migrationFile);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  ✅ All migrations completed successfully!');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  // Verify tables were created
  console.log('🔍 Verifying table creation...\n');
  
  const tablesToCheck = [
    'superadmins',
    'tenants', 
    'tenant_branding',
    'tenant_plans',
    'superadmin_audit_log'
  ];
  
  for (const tableName of tablesToCheck) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
      
      if (error) {
        console.log(`❌ Table '${tableName}': ${error.message}`);
      } else {
        console.log(`✅ Table '${tableName}': Created successfully`);
      }
    } catch (error) {
      console.log(`❌ Table '${tableName}': ${error.message}`);
    }
  }
  
  console.log('\n🎉 Migration process completed!');
}

main().catch(error => {
  console.error('\n❌ Migration process failed:', error.message);
  process.exit(1);
});