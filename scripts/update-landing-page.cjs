#!/usr/bin/env node

/**
 * Script para atualizar a landing page customizada no banco de dados
 * 
 * Uso:
 *   node scripts/update-landing-page.js
 * 
 * Este script lê o arquivo homeCompativel.html e atualiza o campo
 * custom_home_html na tabela branding_config do banco de dados.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// Caminho do banco de dados
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '..', 'wuzapi.db');

// Caminho do arquivo HTML
const HTML_PATH = path.join(__dirname, '..', 'homeCompativel.html');

console.log('🚀 Iniciando atualização da landing page...');
console.log(`📁 Banco de dados: ${DB_PATH}`);
console.log(`📄 Arquivo HTML: ${HTML_PATH}`);

// Verificar se o arquivo HTML existe
if (!fs.existsSync(HTML_PATH)) {
  console.error(`❌ Erro: Arquivo ${HTML_PATH} não encontrado!`);
  process.exit(1);
}

// Ler o conteúdo do arquivo HTML
const htmlContent = fs.readFileSync(HTML_PATH, 'utf8');
console.log(`✅ Arquivo HTML lido com sucesso (${htmlContent.length} caracteres)`);

// Conectar ao banco de dados
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Erro ao conectar ao banco de dados:', err.message);
    process.exit(1);
  }
  console.log('✅ Conectado ao banco de dados');
});

// Criar tabela se não existir
const createTableSQL = `
  CREATE TABLE IF NOT EXISTS branding_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    custom_home_html TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`;

db.run(createTableSQL, (err) => {
  if (err) {
    console.error('❌ Erro ao criar tabela:', err.message);
    db.close();
    process.exit(1);
  }
  console.log('✅ Tabela branding_config verificada/criada');

  // Verificar se já existe uma configuração de branding
  db.get('SELECT id FROM branding_config ORDER BY id DESC LIMIT 1', [], (err, row) => {
    if (err) {
      console.error('❌ Erro ao verificar configuração existente:', err.message);
      db.close();
      process.exit(1);
    }

  if (row) {
    // Atualizar configuração existente
    console.log(`📝 Atualizando configuração existente (ID: ${row.id})...`);
    
    db.run(
      `UPDATE branding_config 
       SET custom_home_html = ?, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [htmlContent, row.id],
      function(err) {
        if (err) {
          console.error('❌ Erro ao atualizar configuração:', err.message);
          db.close();
          process.exit(1);
        }
        
        console.log('✅ Landing page atualizada com sucesso!');
        console.log(`📊 Linhas afetadas: ${this.changes}`);
        
        db.close((err) => {
          if (err) {
            console.error('❌ Erro ao fechar banco de dados:', err.message);
          }
          console.log('🎉 Processo concluído!');
          console.log('\n💡 Dica: Reinicie o servidor para ver as mudanças ou limpe o cache do navegador.');
        });
      }
    );
  } else {
    // Criar nova configuração
    console.log('📝 Criando nova configuração de branding...');
    
    db.run(
      `INSERT INTO branding_config (app_name, custom_home_html, created_at, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ['MeggaChat', htmlContent],
      function(err) {
        if (err) {
          console.error('❌ Erro ao criar configuração:', err.message);
          db.close();
          process.exit(1);
        }
        
        console.log('✅ Landing page criada com sucesso!');
        console.log(`📊 ID da nova configuração: ${this.lastID}`);
        
        db.close((err) => {
          if (err) {
            console.error('❌ Erro ao fechar banco de dados:', err.message);
          }
          console.log('🎉 Processo concluído!');
          console.log('\n💡 Dica: Reinicie o servidor para ver as mudanças ou limpe o cache do navegador.');
        });
      }
    );
  }
  });
});
