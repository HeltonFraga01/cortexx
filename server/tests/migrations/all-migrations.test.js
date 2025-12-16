#!/usr/bin/env node

/**
 * Teste de Todas as Migrations (incluindo 006)
 */

const Database = require('./database');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-all-migrations.db');

async function runAllMigrations(database) {
  const migrationsDir = path.join(__dirname, 'migrations');
  
  if (!fs.existsSync(migrationsDir)) {
    throw new Error('Diretório de migrations não encontrado');
  }
  
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.match(/^\d{3}_.*\.js$/))
    .sort();
  
  console.log(`📋 Encontradas ${migrationFiles.length} migrations\n`);
  
  for (const file of migrationFiles) {
    const migrationPath = path.join(migrationsDir, file);
    const migration = require(migrationPath);
    
    if (typeof migration.up === 'function') {
      try {
        console.log(`🔄 Executando: ${file}`);
        await migration.up(database);
        console.log(`✅ ${file} concluída\n`);
      } catch (error) {
        if (error.message && error.message.includes('duplicate column')) {
          console.log(`ℹ️  ${file} já aplicada\n`);
        } else {
          throw error;
        }
      }
    }
  }
}

async function test() {
  console.log('🧪 Teste de Todas as Migrations\n');
  console.log('═'.repeat(60));
  console.log('\n');
  
  // Limpar banco anterior
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  
  try {
    console.log('1️⃣  Inicializando banco de dados...\n');
    await db.init();
    console.log('✅ Banco inicializado\n');
    
    console.log('2️⃣  Executando todas as migrations...\n');
    await runAllMigrations(db);
    console.log('✅ Todas as migrations executadas\n');
    
    console.log('3️⃣  Verificando tabela table_permissions...\n');
    
    // Verificar se tabela existe
    const checkTable = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='table_permissions'
    `);
    
    if (checkTable.rows.length === 0) {
      throw new Error('Tabela table_permissions não foi criada');
    }
    console.log('   ✅ Tabela table_permissions existe');
    
    // Verificar índices
    const checkIndexes = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='table_permissions'
    `);
    
    const expectedIndexes = [
      'idx_table_permissions_user_id',
      'idx_table_permissions_table_name',
      'idx_table_permissions_composite'
    ];
    
    const actualIndexes = checkIndexes.rows.map(idx => idx.name);
    
    for (const expectedIdx of expectedIndexes) {
      if (actualIndexes.includes(expectedIdx)) {
        console.log(`   ✅ Índice ${expectedIdx}`);
      } else {
        throw new Error(`Índice ${expectedIdx} não encontrado`);
      }
    }
    
    console.log('\n4️⃣  Testando operações CRUD...\n');
    
    // Insert
    await db.query(`
      INSERT INTO table_permissions (user_id, table_name, can_read, can_write, can_delete)
      VALUES (?, ?, ?, ?, ?)
    `, ['admin', 'users', 1, 1, 1]);
    console.log('   ✅ INSERT funcionando');
    
    // Select
    const selectResult = await db.query(`
      SELECT * FROM table_permissions WHERE user_id = ?
    `, ['admin']);
    
    if (selectResult.rows.length === 1) {
      console.log('   ✅ SELECT funcionando');
    } else {
      throw new Error('SELECT não retornou dados esperados');
    }
    
    // Update
    await db.query(`
      UPDATE table_permissions 
      SET can_delete = ? 
      WHERE user_id = ? AND table_name = ?
    `, [0, 'admin', 'users']);
    console.log('   ✅ UPDATE funcionando');
    
    // Verificar update
    const verifyUpdate = await db.query(`
      SELECT can_delete FROM table_permissions 
      WHERE user_id = ? AND table_name = ?
    `, ['admin', 'users']);
    
    if (verifyUpdate.rows[0].can_delete === 0) {
      console.log('   ✅ UPDATE verificado');
    } else {
      throw new Error('UPDATE não funcionou corretamente');
    }
    
    // Delete
    await db.query(`
      DELETE FROM table_permissions 
      WHERE user_id = ? AND table_name = ?
    `, ['admin', 'users']);
    console.log('   ✅ DELETE funcionando');
    
    // Verificar delete
    const verifyDelete = await db.query(`
      SELECT COUNT(*) as count FROM table_permissions 
      WHERE user_id = ? AND table_name = ?
    `, ['admin', 'users']);
    
    if (verifyDelete.rows[0].count === 0) {
      console.log('   ✅ DELETE verificado');
    } else {
      throw new Error('DELETE não funcionou corretamente');
    }
    
    console.log('\n5️⃣  Testando constraint UNIQUE...\n');
    
    // Inserir registro
    await db.query(`
      INSERT INTO table_permissions (user_id, table_name, can_read)
      VALUES (?, ?, ?)
    `, ['user1', 'products', 1]);
    console.log('   ✅ Primeiro registro inserido');
    
    // Tentar inserir duplicado
    try {
      await db.query(`
        INSERT INTO table_permissions (user_id, table_name, can_read)
        VALUES (?, ?, ?)
      `, ['user1', 'products', 1]);
      throw new Error('Constraint UNIQUE não está funcionando');
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log('   ✅ Constraint UNIQUE funcionando');
      } else {
        throw error;
      }
    }
    
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('🎉 SUCESSO! Todos os testes passaram!');
    console.log('═'.repeat(60));
    console.log('\n✅ Migration 006 integrada com sucesso');
    console.log('✅ Tabela table_permissions criada');
    console.log('✅ Índices criados para performance');
    console.log('✅ Operações CRUD funcionando');
    console.log('✅ Constraints funcionando corretamente\n');
    
  } catch (error) {
    console.error('\n');
    console.error('═'.repeat(60));
    console.error('❌ TESTE FALHOU!');
    console.error('═'.repeat(60));
    console.error('\nErro:', error.message);
    console.error('\n', error.stack);
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
