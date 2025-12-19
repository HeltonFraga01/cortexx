#!/usr/bin/env node
/**
 * Script para resetar senha do Superadmin
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcrypt');
const SupabaseService = require('../services/SupabaseService');

async function resetPassword(email, newPassword) {
  console.log('\n🔐 Resetando senha do Superadmin\n');
  console.log('='.repeat(50));
  
  try {
    // Verificar se superadmin existe
    const { data: superadmin, error: findError } = await SupabaseService.adminClient
      .from('superadmins')
      .select('id, email, name')
      .eq('email', email)
      .single();

    if (findError || !superadmin) {
      console.log('❌ Superadmin não encontrado com email:', email);
      process.exit(1);
    }

    console.log('✅ Superadmin encontrado:', superadmin.name);

    // Gerar novo hash
    console.log('🔄 Gerando novo hash de senha...');
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar no banco
    console.log('💾 Atualizando senha no banco de dados...');
    const { error: updateError } = await SupabaseService.adminClient
      .from('superadmins')
      .update({ 
        password_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', superadmin.id);

    if (updateError) {
      console.log('❌ Erro ao atualizar senha:', updateError.message);
      process.exit(1);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ SENHA ATUALIZADA COM SUCESSO!');
    console.log('='.repeat(50));
    console.log(`
📋 Detalhes:
   Email:  ${superadmin.email}
   Nome:   ${superadmin.name}
   
🔗 Acesso:
   URL:    http://localhost:8080/login (aba Administrador)
           http://localhost:3001/superadmin/login
   
   Use o email e a nova senha para fazer login.
`);

  } catch (e) {
    console.log('❌ Exceção:', e.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Parse arguments
const args = process.argv.slice(2);
let email = null;
let password = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--email' && args[i + 1]) {
    email = args[++i];
  } else if (args[i] === '--password' && args[i + 1]) {
    password = args[++i];
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Resetar Senha do Superadmin

Uso:
  node reset-superadmin-password.js --email <email> --password <nova-senha>

Opções:
  --email <email>       Email do superadmin
  --password <senha>    Nova senha (mínimo 8 caracteres)
  --help, -h            Mostrar esta ajuda
`);
    process.exit(0);
  }
}

if (!email || !password) {
  console.log('❌ Email e senha são obrigatórios');
  console.log('   Use: node reset-superadmin-password.js --email <email> --password <senha>');
  process.exit(1);
}

if (password.length < 8) {
  console.log('❌ Senha deve ter no mínimo 8 caracteres');
  process.exit(1);
}

resetPassword(email, password);
