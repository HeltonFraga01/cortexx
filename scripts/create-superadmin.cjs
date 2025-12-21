#!/usr/bin/env node

/**
 * Create Superadmin User in Supabase Auth
 * 
 * Usage:
 *   node scripts/create-superadmin.cjs
 */

const path = require('path');
const serverPath = path.join(__dirname, '../server');

// Load dotenv from server directory
require(path.join(serverPath, 'node_modules/dotenv')).config({ 
  path: path.join(serverPath, '.env') 
});

// Load supabase from server directory
const { createClient } = require(path.join(serverPath, 'node_modules/@supabase/supabase-js'));

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure server/.env has these variables set');
  process.exit(1);
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createSuperadmin() {
  const email = 'admin@cortex.online';
  const password = 'Admin@123456';
  const name = 'Cortex Admin';

  console.log('🚀 Creating Superadmin User in Supabase Auth');
  console.log(`   Email: ${email}`);
  console.log('');

  try {
    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError.message);
      process.exit(1);
    }

    const existingUser = existingUsers?.users?.find(u => u.email === email);
    
    if (existingUser) {
      console.log('⚠️ User already exists. Updating password...');
      
      // Update the user's password
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        {
          password: password,
          email_confirm: true,
          user_metadata: {
            role: 'superadmin',
            name: name
          }
        }
      );

      if (updateError) {
        console.error('❌ Error updating user:', updateError.message);
        process.exit(1);
      }

      console.log('✅ User password updated successfully!');
      console.log(`   User ID: ${updateData.user.id}`);
      return;
    }

    // Create new user
    const { data: authData, error: createError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'superadmin',
        name: name
      }
    });

    if (createError) {
      console.error('❌ Error creating user:', createError.message);
      process.exit(1);
    }

    console.log('✅ Superadmin created successfully!');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${authData.user.email}`);
    console.log(`   Role: ${authData.user.user_metadata?.role}`);
    console.log('');
    console.log('📝 Login credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);

  } catch (err) {
    console.error('❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

createSuperadmin();
