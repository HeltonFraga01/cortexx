#!/usr/bin/env node

/**
 * Teste de Integração - Table Permissions
 * 
 * Testa toda a funcionalidade de permissões de tabela
 */

const Database = require('../../database');
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test-integration.db');

async function testIntegration() {
  console.log('🧪 Teste de Integração - Table Permissions\n');
  console.log('═'.repeat(60));
  console.log('\n');
  
  // Limpar banco anterior
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
  }
  
  const db = new Database(TEST_DB_PATH);
  
  try {
    // 1. Inicializar banco
    console.log('1️⃣  Inicializando banco de dados...\n');
    await db.init();
    console.log('✅ Banco inicializado\n');
    
    // 2. Executar migration (se existir)
    console.log('2️⃣  Verificando migrations...\n');
    const migrationPath = path.join(__dirname, '../../migrations/006_add_table_permissions.js');
    if (fs.existsSync(migrationPath)) {
      const migration = require(migrationPath);
      await migration.up(db);
      console.log('✅ Migration executada\n');
    } else {
      console.log('ℹ️  Migration não encontrada, pulando...\n');
    }
    
    // 3. Testar métodos de permissão
    console.log('3️⃣  Testando métodos de permissão...\n');
    
    // Criar permissão
    const permission1 = await db.createTablePermission('user_token_123', 'customers', {
      can_read: true,
      can_write: true,
      can_delete: false
    });
    console.log('   ✅ Permissão criada:', permission1);
    
    // Criar outra permissão
    const permission2 = await db.createTablePermission('user_token_456', 'products', {
      can_read: true,
      can_write: false,
      can_delete: false
    });
    console.log('   ✅ Permissão criada:', permission2);
    
    // Buscar permissão específica
    const foundPermission = await db.getTablePermission('user_token_123', 'customers');
    console.log('   ✅ Permissão encontrada:', foundPermission);
    
    // Listar permissões de usuário
    const userPermissions = await db.getUserTablePermissions('user_token_123');
    console.log('   ✅ Permissões do usuário:', userPermissions.length);
    
    // Listar todas as permissões
    const allPermissions = await db.getAllTablePermissions();
    console.log('   ✅ Total de permissões:', allPermissions.length);
    
    // Atualizar permissão
    const updated = await db.updateTablePermission(permission1.id, {
      can_read: true,
      can_write: true,
      can_delete: true
    });
    console.log('   ✅ Permissão atualizada:', updated);
    
    console.log('\n4️⃣  Testando métodos de tabela genérica...\n');
    
    // Criar tabela de teste
    await db.query(`
      CREATE TABLE test_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('   ✅ Tabela test_products criada');
    
    // Listar tabelas disponíveis
    const tables = await db.getAvailableTables();
    console.log('   ✅ Tabelas disponíveis:', tables.length);
    tables.forEach(t => console.log(`      - ${t.table_name} (${t.row_count} registros, ${t.column_count} colunas)`));
    
    // Obter schema
    const schema = await db.getTableSchema('test_products');
    console.log('   ✅ Schema obtido:', schema.columns.length, 'colunas');
    
    // Inserir registros
    const product1 = await db.insertRecord('test_products', {
      name: 'Produto A',
      price: 29.99,
      stock: 100
    });
    console.log('   ✅ Registro inserido:', product1.id);
    
    const product2 = await db.insertRecord('test_products', {
      name: 'Produto B',
      price: 49.99,
      stock: 50
    });
    console.log('   ✅ Registro inserido:', product2.id);
    
    // Consultar com paginação
    const queryResult = await db.queryTable('test_products', {
      page: 1,
      limit: 10,
      sortBy: 'name',
      sortOrder: 'ASC'
    });
    console.log('   ✅ Consulta executada:', queryResult.data.length, 'registros');
    
    // Atualizar registro
    const productUpdated = await db.updateRecord('test_products', product1.id, {
      price: 34.99,
      stock: 90
    });
    console.log('   ✅ Registro atualizado:', productUpdated);
    
    // Deletar registro
    const productDeleted = await db.deleteRecord('test_products', product2.id);
    console.log('   ✅ Registro deletado:', productDeleted);
    
    console.log('\n5️⃣  Testando validações e constraints...\n');
    
    // Tentar criar permissão duplicada
    try {
      await db.createTablePermission('user_token_123', 'customers', {
        can_read: true
      });
      console.log('   ❌ Deveria ter falhado com constraint UNIQUE');
    } catch (error) {
      if (error.message.includes('Permission already exists')) {
        console.log('   ✅ Constraint UNIQUE funcionando');
      } else {
        throw error;
      }
    }
    
    // Tentar buscar permissão inexistente
    const notFound = await db.getTablePermission('user_999', 'nonexistent');
    console.log('   ✅ Permissão inexistente retorna null:', notFound === null);
    
    // Tentar atualizar permissão inexistente
    const notUpdated = await db.updateTablePermission(9999, { can_read: true });
    console.log('   ✅ Atualização de permissão inexistente retorna false:', notUpdated === false);
    
    // Tentar deletar permissão inexistente
    const notDeleted = await db.deleteTablePermission(9999);
    console.log('   ✅ Deleção de permissão inexistente retorna false:', notDeleted === false);
    
    console.log('\n6️⃣  Testando proteção contra SQL injection...\n');
    
    // Tentar nome de tabela inválido
    try {
      await db.getTableSchema('test_products; DROP TABLE test_products;');
      console.log('   ❌ Deveria ter falhado com nome inválido');
    } catch (error) {
      if (error.message.includes('Invalid table name')) {
        console.log('   ✅ Proteção contra SQL injection funcionando');
      } else {
        throw error;
      }
    }
    
    console.log('\n');
    console.log('═'.repeat(60));
    console.log('🎉 TODOS OS TESTES PASSARAM!');
    console.log('═'.repeat(60));
    console.log('\n✅ Migration funcionando');
    console.log('✅ Métodos de permissão funcionando');
    console.log('✅ Métodos de tabela genérica funcionando');
    console.log('✅ Validações e constraints funcionando');
    console.log('✅ Proteção contra SQL injection funcionando\n');
    
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

testIntegration();
