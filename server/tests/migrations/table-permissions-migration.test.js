#!/usr/bin/env node

/**
 * Script de Teste da Migration 006 - Table Permissions
 * 
 * Este script testa se a migration de table_permissions está funcionando corretamente
 */

const Database = require('./database');
const { logger } = require('./utils/logger');
const path = require('path');
const fs = require('fs');

// Usar banco de teste
const TEST_DB_PATH = path.join(__dirname, 'test-table-permissions.db');

async function testTablePermissionsMigration() {
  console.log('🧪 Iniciando teste da migration 006 - Table Permissions...\n');
  
  let db;
  
  try {
    // Remover banco de teste se existir
    if (fs.existsSync(TEST_DB_PATH)) {
      console.log('🗑️ Removendo banco de teste anterior...');
      fs.unlinkSync(TEST_DB_PATH);
    }
    
    // Criar novo banco de teste
    console.log('📦 Criando banco de teste...');
    db = new Database(TEST_DB_PATH);
    await db.init();
    console.log('✅ Banco de teste criado\n');
    
    // Teste 1: Executar migration 006
    console.log('📝 Teste 1: Executar migration 006');
    console.log('─'.repeat(60));
    
    const migration = require('./migrations/006_add_table_permissions.js');
    await migration.up(db);
    
    console.log('✅ Teste 1 passou!\n');
    
    // Teste 2: Verificar se a tabela foi criada
    console.log('📝 Teste 2: Verificar se a tabela table_permissions foi criada');
    console.log('─'.repeat(60));
    
    const checkTable = await db.query(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name='table_permissions'
    `);
    
    if (checkTable.rows[0].count === 1) {
      console.log('✅ Tabela table_permissions criada com sucesso');
    } else {
      throw new Error('❌ Tabela table_permissions não foi criada');
    }
    
    console.log('✅ Teste 2 passou!\n');
    
    // Teste 3: Verificar estrutura da tabela
    console.log('📝 Teste 3: Verificar estrutura da tabela');
    console.log('─'.repeat(60));
    
    // Use a wrapper query to get PRAGMA results as SELECT
    const tableInfo = await db.query(`SELECT * FROM pragma_table_info('table_permissions')`);
    console.log('📊 Estrutura da tabela table_permissions:');
    
    const expectedColumns = [
      'id', 'user_id', 'table_name', 'can_read', 'can_write', 'can_delete',
      'created_at', 'updated_at'
    ];
    
    const actualColumns = tableInfo.rows.map(col => col.name);
    
    for (const expectedCol of expectedColumns) {
      if (actualColumns.includes(expectedCol)) {
        console.log(`   ✅ ${expectedCol}`);
      } else {
        throw new Error(`❌ Coluna ${expectedCol} não encontrada`);
      }
    }
    
    console.log('✅ Teste 3 passou!\n');
    
    // Teste 4: Verificar índices
    console.log('📝 Teste 4: Verificar índices');
    console.log('─'.repeat(60));
    
    const indexes = await db.query(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='table_permissions'
    `);
    
    const expectedIndexes = [
      'idx_table_permissions_user_id',
      'idx_table_permissions_table_name',
      'idx_table_permissions_composite'
    ];
    
    const actualIndexes = indexes.rows.map(idx => idx.name);
    
    for (const expectedIdx of expectedIndexes) {
      if (actualIndexes.includes(expectedIdx)) {
        console.log(`   ✅ ${expectedIdx}`);
      } else {
        throw new Error(`❌ Índice ${expectedIdx} não encontrado`);
      }
    }
    
    console.log('✅ Teste 4 passou!\n');
    
    // Teste 5: Verificar constraint UNIQUE
    console.log('📝 Teste 5: Verificar constraint UNIQUE (user_id, table_name)');
    console.log('─'.repeat(60));
    
    // Inserir primeiro registro
    await db.query(`
      INSERT INTO table_permissions (user_id, table_name, can_read, can_write, can_delete)
      VALUES ('user123', 'customers', 1, 1, 0)
    `);
    console.log('   ✅ Primeiro registro inserido');
    
    // Tentar inserir registro duplicado (deve falhar)
    try {
      await db.query(`
        INSERT INTO table_permissions (user_id, table_name, can_read, can_write, can_delete)
        VALUES ('user123', 'customers', 1, 0, 0)
      `);
      throw new Error('❌ Constraint UNIQUE não está funcionando');
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        console.log('   ✅ Constraint UNIQUE funcionando corretamente');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Teste 5 passou!\n');
    
    // Teste 6: Testar idempotência (executar migration novamente)
    console.log('📝 Teste 6: Testar idempotência da migration');
    console.log('─'.repeat(60));
    
    await migration.up(db);
    console.log('   ✅ Migration executada novamente sem erros');
    
    console.log('✅ Teste 6 passou!\n');
    
    // Teste 7: Testar rollback (down)
    console.log('📝 Teste 7: Testar rollback da migration');
    console.log('─'.repeat(60));
    
    await migration.down(db);
    console.log('   ✅ Rollback executado');
    
    // Verificar se tabela foi removida
    const checkTableAfterDown = await db.query(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='table' AND name='table_permissions'
    `);
    
    if (checkTableAfterDown.rows[0].count === 0) {
      console.log('   ✅ Tabela removida com sucesso');
    } else {
      throw new Error('❌ Tabela não foi removida no rollback');
    }
    
    // Verificar se índices foram removidos
    const checkIndexesAfterDown = await db.query(`
      SELECT COUNT(*) as count 
      FROM sqlite_master 
      WHERE type='index' AND tbl_name='table_permissions'
    `);
    
    if (checkIndexesAfterDown.rows[0].count === 0) {
      console.log('   ✅ Índices removidos com sucesso');
    } else {
      throw new Error('❌ Índices não foram removidos no rollback');
    }
    
    console.log('✅ Teste 7 passou!\n');
    
    // Sucesso!
    console.log('═'.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('═'.repeat(60));
    console.log('');
    console.log('✅ Migration 006 está funcionando corretamente');
    console.log('✅ Tabela table_permissions criada com estrutura correta');
    console.log('✅ Índices criados para performance');
    console.log('✅ Constraint UNIQUE funcionando');
    console.log('✅ Migration é idempotente');
    console.log('✅ Rollback funcionando corretamente');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('═'.repeat(60));
    console.error('❌ TESTE FALHOU!');
    console.error('═'.repeat(60));
    console.error('');
    console.error('Erro:', error.message);
    console.error('');
    
    if (error.stack) {
      console.error('Stack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
    
  } finally {
    // Limpar
    if (db) {
      await db.close();
    }
    
    // Remover banco de teste
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
      console.log('🗑️ Banco de teste removido');
    }
    
    // Remover arquivos temporários do SQLite
    [TEST_DB_PATH + '-shm', TEST_DB_PATH + '-wal'].forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
  }
}

// Executar testes
testTablePermissionsMigration().catch(error => {
  console.error('❌ Erro fatal:', error.message);
  process.exit(1);
});
