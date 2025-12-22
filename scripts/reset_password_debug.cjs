const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

async function run() {
  console.log('Starting admin agent setup...');

  // 1. Load .env robustly
  try {
    const envPath = path.join(__dirname, '../server/.env');
    console.log('Loading .env from:', envPath);
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, 'utf8');
      envFile.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        if (line.startsWith('export ')) line = line.substring(7);
        
        const parts = line.split('=');
        if (parts.length < 2) return;
        
        const key = parts.shift().trim();
        let value = parts.join('=').trim();
        
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        
        if (key && value) {
          process.env[key] = value;
        }
      });
      console.log('Loaded .env successfully');
    } else {
      console.error('.env file not found at:', envPath);
    }
  } catch (e) {
    console.log('Error reading .env', e);
  }

  // 2. Initialize Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 3. Helper for hashing
  async function hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  try {
    // 4. Check/Create Account
    console.log('Checking accounts...');
    const { data: accounts, error: accountError } = await supabase
      .from('accounts')
      .select('id, name, status, tenant_id'); // Added status and tenant_id, removed limit(1)
      
    if (accountError) throw accountError;
    
    console.log(`\nFound ${accounts.length} accounts:`);
    accounts.forEach(a => console.log(`- ${a.name} (ID: ${a.id}, Status: ${a.status}, Tenant: ${a.tenant_id})`));

    let accountId;
    if (!accounts || accounts.length === 0) {
       console.log('No accounts found. Creating default account...');
       const { data: newAccount, error: createError } = await supabase
         .from('accounts')
         .insert({ name: 'Cortexx Default', status: 'active' })
         .select()
         .single();
         
       if (createError) throw createError;
       accountId = newAccount.id;
       console.log('Created account:', accountId);
    } else {
       // Find Cortexx account or fallback
       const targetAccountName = 'Cortexx - Principal';
       const acmeAccount = accounts.find(a => a.name === targetAccountName) || accounts[0];
       accountId = acmeAccount.id;
       console.log(`Using account: ${acmeAccount.name} (ID: ${accountId})`);
    }

    // 5. Create/Update Agent
    const email = 'admin@cortexx.com';
    const password = 'Admin@123456';
    const hash = await hashPassword(password);
    
    console.log(`Setting up agent ${email}...`);
    
    // Check if exists
    const { data: existingAgent } = await supabase
      .from('agents')
      .select('id, account_id')
      .eq('email', email)
      .single();

    if (existingAgent) {
        console.log('Agent exists. Resetting password...');
        const { error: updateError } = await supabase
          .from('agents')
          .update({ 
            password_hash: hash, 
            status: 'active',
            account_id: accountId, // Ensure it's in the valid account
            role: 'owner',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAgent.id);
          
        if (updateError) throw updateError;
        console.log('Password updated successfully.');
    } else {
        console.log('Creating new agent...');
        const { data: newAgent, error: createAgentError } = await supabase
          .from('agents')
          .insert({
            account_id: accountId,
            email: email,
            password_hash: hash,
            name: 'Admin User',
            role: 'owner',
            status: 'active'
          })
          .select()
          .single();
          
        if (createAgentError) throw createAgentError;
        console.log('Agent created successfully:', newAgent.id);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
