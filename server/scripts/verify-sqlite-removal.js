#!/usr/bin/env node

/**
 * SQLite Removal Verification Script
 * 
 * Verifies that SQLite has been completely removed from the codebase.
 * Checks:
 * 1. No SQLite files exist
 * 2. No SQLite imports in code
 * 3. No SQLite in package.json
 * 4. No SQLite env vars in .env files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '../..');
const SERVER_DIR = path.join(__dirname, '..');

const errors = [];
const warnings = [];

console.log('🔍 SQLite Removal Verification\n');
console.log('='.repeat(50));

// 1. Check no SQLite core files exist
console.log('\n📁 Checking SQLite core files...');

const sqliteFiles = [
  'server/config/sqlite.js',
  'server/services/DatabaseBackend.js'
];

for (const file of sqliteFiles) {
  const fullPath = path.join(ROOT_DIR, file);
  if (fs.existsSync(fullPath)) {
    errors.push(`SQLite file still exists: ${file}`);
  } else {
    console.log(`  ✅ ${file} - removed`);
  }
}

// Check database.js - it should be a compatibility layer now
const databaseJsPath = path.join(SERVER_DIR, 'database.js');
if (fs.existsSync(databaseJsPath)) {
  const content = fs.readFileSync(databaseJsPath, 'utf8');
  if (content.includes('better-sqlite3') || content.includes("require('sqlite3')")) {
    errors.push('server/database.js still contains SQLite imports');
  } else if (content.includes('SupabaseService')) {
    console.log('  ✅ server/database.js - converted to Supabase compatibility layer');
  } else {
    warnings.push('server/database.js exists but unclear if converted');
  }
}

// 2. Check no SQLite imports in JS files
console.log('\n📦 Checking for SQLite imports...');

try {
  // Exclude patterns for grep
  const excludePatterns = [
    'migrations-sqlite-archived',
    'verify-sqlite-removal.js',
    'migrate-to-supabase.js',
    'verify-migration.js',
    'verify-data-consistency.js'
  ].join('\\|');

  // Check for better-sqlite3 imports
  const betterSqliteResult = execSync(
    `grep -r "require.*better-sqlite3" server/ --include="*.js" 2>/dev/null | grep -v "${excludePatterns}" || true`,
    { cwd: ROOT_DIR, encoding: 'utf8' }
  ).trim();
  
  if (betterSqliteResult) {
    const files = betterSqliteResult.split('\n').filter(Boolean);
    for (const file of files) {
      errors.push(`better-sqlite3 import found: ${file.split(':')[0]}`);
    }
  } else {
    console.log('  ✅ No better-sqlite3 imports found');
  }

  // Check for sqlite3 imports (excluding connect-sqlite3 which is session store)
  const sqlite3Result = execSync(
    `grep -r "require.*sqlite3" server/ --include="*.js" 2>/dev/null | grep -v "${excludePatterns}" | grep -v "connect-sqlite3" || true`,
    { cwd: ROOT_DIR, encoding: 'utf8' }
  ).trim();
  
  if (sqlite3Result) {
    const files = sqlite3Result.split('\n').filter(Boolean);
    for (const file of files) {
      errors.push(`sqlite3 import found: ${file.split(':')[0]}`);
    }
  } else {
    console.log('  ✅ No sqlite3 imports found');
  }
} catch (error) {
  warnings.push(`Could not check imports: ${error.message}`);
}

// 3. Check package.json
console.log('\n📋 Checking package.json...');

const packageJsonPath = path.join(SERVER_DIR, 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  
  if (pkg.dependencies?.['better-sqlite3']) {
    errors.push('better-sqlite3 still in dependencies');
  } else {
    console.log('  ✅ better-sqlite3 not in dependencies');
  }
  
  if (pkg.dependencies?.['sqlite3']) {
    errors.push('sqlite3 still in dependencies');
  } else {
    console.log('  ✅ sqlite3 not in dependencies');
  }
  
  if (pkg.devDependencies?.['better-sqlite3']) {
    errors.push('better-sqlite3 still in devDependencies');
  }
  
  if (pkg.devDependencies?.['sqlite3']) {
    errors.push('sqlite3 still in devDependencies');
  }
}

// 4. Check .env files
console.log('\n🔐 Checking environment files...');

const envFiles = [
  '.env.example',
  '.env.docker.example',
  '.env.production.example',
  'server/.env.example'
];

for (const envFile of envFiles) {
  const fullPath = path.join(ROOT_DIR, envFile);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    
    // Check for SQLITE_ variables
    const sqliteVars = content.match(/^SQLITE_[A-Z_]+=.*/gm);
    if (sqliteVars && sqliteVars.length > 0) {
      errors.push(`SQLITE_ variables found in ${envFile}: ${sqliteVars.join(', ')}`);
    }
    
    // Check for USE_SUPABASE (should be removed as Supabase is now the only option)
    if (content.includes('USE_SUPABASE=')) {
      warnings.push(`USE_SUPABASE flag found in ${envFile} (should be removed)`);
    }
    
    // Check for DUAL_WRITE_MODE
    if (content.includes('DUAL_WRITE_MODE=')) {
      warnings.push(`DUAL_WRITE_MODE flag found in ${envFile} (should be removed)`);
    }
    
    // Check for DATABASE_BACKEND
    if (content.includes('DATABASE_BACKEND=')) {
      warnings.push(`DATABASE_BACKEND flag found in ${envFile} (should be removed)`);
    }
  }
}

if (errors.filter(e => e.includes('.env')).length === 0) {
  console.log('  ✅ No SQLITE_ variables in .env files');
}

// 5. Check for .db files
console.log('\n🗄️ Checking for .db files...');

try {
  const dbFiles = execSync(
    `find . -name "*.db" -o -name "*.db-shm" -o -name "*.db-wal" 2>/dev/null | grep -v node_modules || true`,
    { cwd: ROOT_DIR, encoding: 'utf8' }
  ).trim();
  
  if (dbFiles) {
    const files = dbFiles.split('\n').filter(Boolean);
    for (const file of files) {
      warnings.push(`Database file found: ${file}`);
    }
  } else {
    console.log('  ✅ No .db files found');
  }
} catch (error) {
  // Ignore errors from find command
}

// 6. Check migrations directory
console.log('\n📂 Checking migrations...');

const migrationsDir = path.join(SERVER_DIR, 'migrations');
const archivedMigrationsDir = path.join(SERVER_DIR, 'migrations-sqlite-archived');

if (fs.existsSync(migrationsDir)) {
  const files = fs.readdirSync(migrationsDir);
  if (files.length > 0) {
    warnings.push(`Active migrations directory has ${files.length} files`);
  }
}

if (fs.existsSync(archivedMigrationsDir)) {
  console.log('  ✅ SQLite migrations archived to migrations-sqlite-archived/');
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 VERIFICATION SUMMARY\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All checks passed! SQLite has been successfully removed.\n');
  process.exit(0);
}

if (errors.length > 0) {
  console.log(`❌ ERRORS (${errors.length}):`);
  for (const error of errors) {
    console.log(`   • ${error}`);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log(`⚠️  WARNINGS (${warnings.length}):`);
  for (const warning of warnings) {
    console.log(`   • ${warning}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.log('❌ Verification FAILED - please fix the errors above.\n');
  process.exit(1);
} else {
  console.log('⚠️  Verification passed with warnings.\n');
  process.exit(0);
}
