#!/usr/bin/env node

/**
 * Teste Simples da Migration 006
 */

const Database = require('./database');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-simple.db');

async function test() {
  console.log('🧪 Teste simples da migration 006\n');
  
  // Limpar banco anterior
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  
  try {
    console.log('1. Inicializando banco...');
    await db.init();
    console.log('✅ Banco inicializado\n');
    
    console.log('2. Executando migration 006...');
    const migration = require('./migrations/006_add_table_permissions.js');
    await migration.up(db);
    console.log('✅ Migration executada\n');
    
    console.log('3. Verificando tabela...');
    const checkTable = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='table_permissions'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('✅ Tabela table_permissions existe\n');
    } else {
      throw new Error('Tabela não encontrada');
    }
    
    console.log('4. Testando insert...');
    await db.query(`
      INSERT INTO table_permissions (user_id, table_name, can_read, can_write, can_delete)
      VALUES (?, ?, ?, ?, ?)
    `, ['user123', 'customers', 1, 1, 0]);
    console.log('✅ Insert funcionou\n');
    
    console.log('5. Testando select...');
    const result = await db.query(`
      SELECT * FROM table_permissions WHERE user_id = ?
    `, ['user123']);
    
    if (result.rows.length === 1) {
      console.log('✅ Select funcionou');
      console.log('   Dados:', result.rows[0]);
    } else {
      throw new Error('Select não retornou dados');
    }
    
    console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
    
    // Limpar
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    [TEST_DB_PATH + '-shm', TEST_DB_PATH + '-wal'].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
    process.exit(0);
  }
}

test();
