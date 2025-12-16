#!/usr/bin/env node

/**
 * Script de Migrations Automáticas
 * Executa todas as migrations pendentes no banco de dados
 */

const path = require('path');
const fs = require('fs');

// Importar Database wrapper
const Database = require('../database');

const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../wuzapi.db');

console.log('🔧 Iniciando sistema de migrations...');
console.log('📁 Banco de dados:', DB_PATH);

// Verificar se banco existe
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Banco de dados não encontrado:', DB_PATH);
  console.log('ℹ️  O banco será criado automaticamente na primeira inicialização do servidor');
  process.exit(0);
}

async function runMigrations() {
  const db = new Database(DB_PATH);
  
  try {
    console.log('');
    console.log('🔄 Conectando ao banco de dados...');
    await db.init();
    console.log('✅ Conectado com sucesso');
    console.log('');

    // Buscar todos os arquivos de migration
    const migrationsDir = __dirname;
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => /^\d{3}_.*\.js$/.test(file))
      .sort();

    console.log(`📋 Encontradas ${migrationFiles.length} migrations:`);
    migrationFiles.forEach(file => console.log(`   - ${file}`));
    console.log('');

    // Criar tabela de controle de migrations se não existir
    await db.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Verificar quais migrations já foram executadas
    const { rows: executedMigrations } = await db.query(
      'SELECT name FROM migrations ORDER BY id'
    );
    const executedNames = new Set(executedMigrations.map(m => m.name));

    console.log('🔍 Verificando migrations pendentes...');
    console.log('');

    let executedCount = 0;
    let skippedCount = 0;

    // Executar migrations pendentes
    for (const file of migrationFiles) {
      const migrationName = file.replace('.js', '');
      
      if (executedNames.has(migrationName)) {
        console.log(`⏭️  ${migrationName} - já executada`);
        skippedCount++;
        continue;
      }

      try {
        console.log(`🔄 Executando ${migrationName}...`);
        
        const migration = require(path.join(migrationsDir, file));
        
        if (typeof migration.up !== 'function') {
          console.warn(`⚠️  ${migrationName} - não possui método 'up', pulando`);
          continue;
        }

        // Executar migration
        await migration.up(db);
        
        // Registrar como executada
        await db.query(
          'INSERT INTO migrations (name) VALUES (?)',
          [migrationName]
        );
        
        console.log(`✅ ${migrationName} - concluída`);
        executedCount++;
        
      } catch (error) {
        console.error(`❌ ${migrationName} - erro:`, error.message);
        console.error('   Stack:', error.stack);
        throw error;
      }
    }

    console.log('');
    console.log('📊 Resumo:');
    console.log(`   ✅ Executadas: ${executedCount}`);
    console.log(`   ⏭️  Já existentes: ${skippedCount}`);
    console.log(`   📋 Total: ${migrationFiles.length}`);
    console.log('');
    
    if (executedCount > 0) {
      console.log('✅ Migrations executadas com sucesso!');
    } else {
      console.log('ℹ️  Nenhuma migration pendente');
    }
    
    // Fechar conexão
    if (db.db) {
      db.db.close();
    }
    
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('❌ Erro durante execução das migrations:', error.message);
    console.error('Stack:', error.stack);
    
    // Fechar conexão
    if (db.db) {
      db.db.close();
    }
    
    process.exit(1);
  }
}

// Executar
runMigrations();
