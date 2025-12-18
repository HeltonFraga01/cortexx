#!/usr/bin/env node
/**
 * Script para criar o primeiro Superadmin
 * 
 * Uso:
 *   node server/scripts/create-superadmin.js --email admin@cortexx.online --password SuaSenhaSegura123 --name "Admin Principal"
 * 
 * Ou interativamente:
 *   node server/scripts/create-superadmin.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const readline = require('readline');
const bcrypt = require('bcrypt');
const SupabaseService = require('../services/SupabaseService');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      result.email = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      result.password = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      result.name = args[++i];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Criar Superadmin - WUZAPI Manager

Uso:
  node create-superadmin.js [opções]

Opções:
  --email <email>       Email do superadmin (obrigatório)
  --password <senha>    Senha do superadmin (mínimo 8 caracteres)
  --name <nome>         Nome do superadmin
  --help, -h            Mostrar esta ajuda

Exemplos:
  node create-superadmin.js --email admin@cortexx.online --password MinhaS3nha! --name "Admin"
  node create-superadmin.js  # Modo interativo
      `);
      process.exit(0);
    }
  }
  
  return result;
}

// Create readline interface for interactive mode
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

// Prompt for input
function prompt(rl, question, hidden = false) {
  return new Promise((resolve) => {
    if (hidden) {
      // For password input, we can't easily hide it in Node.js without external libs
      // Just warn the user
      process.stdout.write(question);
      rl.question('', (answer) => {
        resolve(answer);
      });
    } else {
      rl.question(question, resolve);
    }
  });
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate password strength
function isValidPassword(password) {
  return password && password.length >= 8;
}

// Main function
async function main() {
  console.log('\n🔐 WUZAPI Manager - Criar Superadmin\n');
  console.log('=' .repeat(50));
  
  // Check Supabase connection
  console.log('\n📡 Verificando conexão com Supabase...');
  
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados no .env');
    process.exit(1);
  }
  
  try {
    const { data, error } = await SupabaseService.healthCheck();
    if (error) throw error;
    console.log('✅ Conexão com Supabase OK\n');
  } catch (error) {
    console.error('❌ Erro ao conectar com Supabase:', error.message);
    process.exit(1);
  }
  
  // Get arguments or prompt interactively
  const args = parseArgs();
  let email = args.email;
  let password = args.password;
  let name = args.name;
  
  const rl = createReadline();
  
  try {
    // Get email
    if (!email) {
      email = await prompt(rl, '📧 Email do superadmin: ');
    }
    
    if (!isValidEmail(email)) {
      console.error('❌ Email inválido');
      process.exit(1);
    }
    
    // Check if email already exists
    const { data: existing } = await SupabaseService.adminClient
      .from('superadmins')
      .select('id, email')
      .eq('email', email)
      .single();
    
    if (existing) {
      console.error(`❌ Já existe um superadmin com o email: ${email}`);
      process.exit(1);
    }
    
    // Get password
    if (!password) {
      console.log('🔑 Senha (mínimo 8 caracteres):');
      password = await prompt(rl, '   > ');
    }
    
    if (!isValidPassword(password)) {
      console.error('❌ Senha deve ter no mínimo 8 caracteres');
      process.exit(1);
    }
    
    // Get name
    if (!name) {
      name = await prompt(rl, '👤 Nome do superadmin (opcional, Enter para pular): ');
      if (!name) {
        name = email.split('@')[0]; // Use email prefix as default name
      }
    }
    
    rl.close();
    
    // Create superadmin
    console.log('\n🔄 Criando superadmin...');
    
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const { data: superadmin, error } = await SupabaseService.adminClient
      .from('superadmins')
      .insert({
        email,
        password_hash,
        name,
        status: 'active'
      })
      .select('id, email, name, status, created_at')
      .single();
    
    if (error) {
      console.error('❌ Erro ao criar superadmin:', error.message);
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ SUPERADMIN CRIADO COM SUCESSO!');
    console.log('='.repeat(50));
    console.log(`
📋 Detalhes:
   ID:     ${superadmin.id}
   Email:  ${superadmin.email}
   Nome:   ${superadmin.name}
   Status: ${superadmin.status}
   Criado: ${new Date(superadmin.created_at).toLocaleString('pt-BR')}

🔗 Acesso:
   URL:    http://superadmin.cortexx.local:5173 (desenvolvimento)
           https://superadmin.cortexx.online (produção)
   
   Use o email e senha configurados para fazer login.
`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
