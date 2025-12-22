const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '/Users/heltonfraga/Documents/Develop/Cortexx/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function run() {
  const email = 'cortexx4@cortexx.com';
  const password = 'Admin@123456';
  
  console.log(`Resetting password for ${email}...`);
  
  try {
    const hash = await hashPassword(password);
    
    // Update first matching agent
    const { data: agents, error: fetchError } = await supabase
      .from('agents')
      .select('id')
      .eq('email', email)
      .limit(1);
      
    if (fetchError) throw fetchError;
    if (!agents.length) throw new Error('Agent not found');
    
    const agentId = agents[0].id;
    
    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        password_hash: hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId);
      
    if (updateError) throw updateError;
    
    console.log(`Password reset success for agent ${agentId}`);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
