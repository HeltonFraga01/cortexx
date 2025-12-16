/**
 * Script para atualizar nomes de grupos existentes
 * Executa: node scripts/update-group-names.cjs <userToken>
 */

const axios = require('../server/node_modules/axios').default;
const sqlite3 = require('../server/node_modules/sqlite3').verbose();
const path = require('path');

const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
const DB_PATH = process.env.SQLITE_DB_PATH || path.join(__dirname, '../data/wuzapi.db');

async function fetchGroupName(groupJid, userToken) {
  try {
    const response = await axios({
      method: 'GET',
      url: `${WUZAPI_BASE_URL}/group/info`,
      headers: { 
        'Token': userToken,
        'Content-Type': 'application/json'
      },
      data: { GroupJID: groupJid },
      timeout: 10000
    });
    
    if (response.data && response.data.data && response.data.data.Name) {
      return response.data.data.Name;
    }
    return null;
  } catch (error) {
    console.error(`Erro ao buscar grupo ${groupJid}:`, error.message);
    return null;
  }
}

function dbAll(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(db, sql, params) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function main() {
  const userToken = process.argv[2];
  
  if (!userToken) {
    console.error('Uso: node scripts/update-group-names.cjs <userToken>');
    process.exit(1);
  }
  
  console.log('Conectando ao banco de dados:', DB_PATH);
  const db = new sqlite3.Database(DB_PATH);
  
  try {
    // Buscar todas as conversas de grupo
    const groups = await dbAll(db, `
      SELECT id, contact_jid, contact_name 
      FROM conversations 
      WHERE contact_jid LIKE '%@g.us'
      AND user_id = ?
    `, [userToken]);
    
    console.log(`Encontrados ${groups.length} grupos para atualizar`);
    
    let updated = 0;
    let failed = 0;
    
    for (const group of groups) {
      console.log(`\nProcessando: ${group.contact_name} (${group.contact_jid})`);
      
      const newName = await fetchGroupName(group.contact_jid, userToken);
      
      if (newName && newName !== group.contact_name) {
        await dbRun(db, 'UPDATE conversations SET contact_name = ? WHERE id = ?', [newName, group.id]);
        console.log(`  ✅ Atualizado: ${group.contact_name} -> ${newName}`);
        updated++;
      } else if (newName) {
        console.log(`  ⏭️ Nome já correto: ${newName}`);
      } else {
        console.log(`  ❌ Não foi possível obter o nome do grupo`);
        failed++;
      }
      
      // Pequeno delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n========================================`);
    console.log(`Total: ${groups.length} grupos`);
    console.log(`Atualizados: ${updated}`);
    console.log(`Falhas: ${failed}`);
    console.log(`Sem alteração: ${groups.length - updated - failed}`);
  } finally {
    db.close();
  }
}

main().catch(console.error);
