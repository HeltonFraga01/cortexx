/**
 * Property Tests for Legacy Cleanup Validation
 * 
 * Feature: legacy-cleanup-documentation-update
 * 
 * These tests validate that SQLite references have been properly removed
 * from the codebase after the migration to Supabase.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Feature: legacy-cleanup-documentation-update, Property 2: Consistência de tipos de conexão
 * Validates: Requirements 7.1, 7.2
 * 
 * For any interface or type that defines DatabaseConnection, the type field
 * must be a union type that includes only 'POSTGRES', 'MYSQL', 'NOCODB', and 'API' (without 'SQLITE').
 */
describe('Property 2: Database Connection Type Consistency', () => {
  it('should not include SQLITE in DatabaseConnection type definitions', () => {
    // Read the types file
    const typesPath = path.join(process.cwd(), 'src/lib/types.ts');
    const typesContent = fs.readFileSync(typesPath, 'utf-8');
    
    // Find DatabaseConnection interface and check for SQLITE
    const dbConnectionMatch = typesContent.match(/interface DatabaseConnection[\s\S]*?type:\s*([^;]+);/);
    
    expect(dbConnectionMatch).toBeTruthy();
    if (dbConnectionMatch) {
      const typeDefinition = dbConnectionMatch[1];
      expect(typeDefinition).not.toContain('SQLITE');
      expect(typeDefinition).toContain('POSTGRES');
      expect(typeDefinition).toContain('MYSQL');
      expect(typeDefinition).toContain('NOCODB');
      expect(typeDefinition).toContain('API');
    }
  });

  it('should not include SQLITE in database-connections service type definitions', () => {
    // Read the service file
    const servicePath = path.join(process.cwd(), 'src/services/database-connections.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    
    // Find DatabaseConnection interface and check for SQLITE
    const dbConnectionMatch = serviceContent.match(/interface DatabaseConnection[\s\S]*?type:\s*([^;]+);/);
    
    expect(dbConnectionMatch).toBeTruthy();
    if (dbConnectionMatch) {
      const typeDefinition = dbConnectionMatch[1];
      expect(typeDefinition).not.toContain('SQLITE');
    }
  });

  it('should not have testSQLiteConnection method in database-connections service', () => {
    const servicePath = path.join(process.cwd(), 'src/services/database-connections.ts');
    const serviceContent = fs.readFileSync(servicePath, 'utf-8');
    
    expect(serviceContent).not.toContain('testSQLiteConnection');
  });
});

/**
 * Feature: legacy-cleanup-documentation-update, Property 1: Ausência de referências SQLite em código de produção
 * Validates: Requirements 9.1
 * 
 * For any file in the project (excluding archived directories), the content
 * should not contain 'sqlite', 'SQLite', or 'SQLITE' in active code or configuration context.
 */
describe('Property 1: No SQLite References in Production Code', () => {
  const excludedPaths = [
    'server/migrations-sqlite-archived',
    'docs/archived',
    '.kiro/specs/_archived',
    'node_modules',
    '.git',
    'dist',
    'src/test/legacy-cleanup.test.ts' // This test file itself
  ];

  const shouldExclude = (filePath: string): boolean => {
    return excludedPaths.some(excluded => filePath.includes(excluded));
  };

  const getFilesRecursively = (dir: string, extensions: string[]): string[] => {
    const files: string[] = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        if (shouldExclude(fullPath)) continue;
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          files.push(...getFilesRecursively(fullPath, extensions));
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Ignore permission errors
    }
    
    return files;
  };

  it('should not have SQLite references in TypeScript source files', () => {
    const srcFiles = getFilesRecursively('src', ['.ts', '.tsx']);
    const violations: string[] = [];
    
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for SQLite references (case insensitive)
      if (/sqlite/i.test(content)) {
        violations.push(file);
      }
    }
    
    expect(violations).toEqual([]);
  });

  it('should not have SQLite references in backend JavaScript files', () => {
    const serverFiles = getFilesRecursively('server', ['.js']);
    const violations: string[] = [];
    
    // Patterns that indicate active SQLite usage (not just comments about removal)
    const activeSqlitePatterns = [
      /require\s*\(\s*['"].*sqlite/i,           // require('sqlite3') or similar
      /import.*sqlite/i,                         // import sqlite
      /new\s+sqlite/i,                           // new sqlite.Database()
      /\.run\s*\(\s*['"]CREATE TABLE/i,         // SQLite DDL
      /\.all\s*\(\s*['"]SELECT/i,               // SQLite queries
      /type:\s*['"]SQLITE['"]/,                 // type: 'SQLITE' in config
      /SQLITE_DB_PATH/,                          // SQLite env var usage
    ];
    
    // Patterns that are acceptable (comments about removal, migration scripts, etc.)
    const acceptablePatterns = [
      /\/\/.*sqlite.*removed/i,                  // Comment: SQLite removed
      /\/\/.*using supabase/i,                   // Comment: using Supabase
      /\/\*[\s\S]*?sqlite[\s\S]*?\*\//i,        // Block comments mentioning SQLite
      /migrate.*sqlite/i,                        // Migration scripts
      /verify.*sqlite/i,                         // Verification scripts
      /sqlite.*no longer supported/i,            // Error messages about deprecation
      /sqlite.*not supported/i,                  // Error messages about deprecation
    ];
    
    for (const file of serverFiles) {
      // Skip migration and verification scripts
      if (file.includes('/scripts/')) continue;
      // Skip test files (they may test legacy functionality or contain historical references)
      if (file.includes('/tests/')) continue;
      
      const content = fs.readFileSync(file, 'utf-8');
      
      // Check for SQLite references
      if (/sqlite/i.test(content)) {
        // Check if it's an active usage pattern
        const hasActiveUsage = activeSqlitePatterns.some(pattern => pattern.test(content));
        
        if (hasActiveUsage) {
          violations.push(file);
        }
      }
    }
    
    expect(violations).toEqual([]);
  });
});
