#!/usr/bin/env node
/**
 * Script to fix group names in batch
 * 
 * This script finds all group conversations with invalid names (fallback format)
 * and fetches the correct names from WUZAPI API.
 * 
 * Usage: node server/scripts/fix-group-names-batch.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const axios = require('axios');
const Database = require('../database');

const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

/**
 * Check if a group name is invalid and needs to be fetched
 */
function isInvalidGroupName(name) {
  if (!name || name.trim().length === 0) return true;
  if (/^\d+$/.test(name)) return true;
  if (name.includes('@g.us')) return true;
  if (/^Grupo \d+/.test(name)) return true;
  return false;
}

/**
 * Fetch group name from WUZAPI
 */
async function fetchGroupName(groupJid, userToken) {
  try {
    const url = new URL(`${WUZAPI_BASE_URL}/group/info`);
    url.searchParams.set('groupJID', groupJid);
    
    const response = await axios({
      method: 'GET',
      url: url.toString(),
      headers: {
        'Token': userToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: { GroupJID: groupJid },
      timeout: 15000
    });
    
    const groupName = response.data?.data?.Name || response.data?.Name;
    
    if (groupName && !isInvalidGroupName(groupName)) {
      return { success: true, name: groupName };
    }
    
    return { success: false, error: 'Invalid name returned' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔧 Starting group name fix script...\n');
  
  const db = new Database();
  
  // Find all group conversations with invalid names
  const { rows: groups } = await db.query(`
    SELECT c.id, c.user_id, c.contact_jid, c.contact_name
    FROM conversations c
    WHERE c.contact_jid LIKE '%@g.us'
      AND (
        c.contact_name IS NULL 
        OR c.contact_name = ''
        OR c.contact_name LIKE 'Grupo %'
        OR c.contact_name GLOB '[0-9]*'
      )
  `);
  
  console.log(`📋 Found ${groups.length} groups with invalid names\n`);
  
  if (groups.length === 0) {
    console.log('✅ All group names are valid!');
    process.exit(0);
  }
  
  let fixed = 0;
  let failed = 0;
  
  for (const group of groups) {
    console.log(`\n🔍 Processing: ${group.contact_jid}`);
    console.log(`   Current name: "${group.contact_name || '(empty)'}"`);
    
    const result = await fetchGroupName(group.contact_jid, group.user_id);
    
    if (result.success) {
      // Update the database
      await db.query(`
        UPDATE conversations 
        SET contact_name = ?, name_source = 'api', name_updated_at = ?
        WHERE id = ?
      `, [result.name, new Date().toISOString(), group.id]);
      
      console.log(`   ✅ Fixed: "${result.name}"`);
      fixed++;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      failed++;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`📊 Summary:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📋 Total: ${groups.length}`);
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
