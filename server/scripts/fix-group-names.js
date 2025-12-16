#!/usr/bin/env node
/**
 * Fix Group Names Script
 * 
 * This script fixes existing group conversations that have incorrect names
 * (JID numbers, participant names, or empty names) by fetching the correct
 * group name from WUZAPI.
 * 
 * Requirements: 1.5, 3.3, 3.4 (group-name-display-fix)
 * 
 * Usage:
 *   cd server && node scripts/fix-group-names.js [--dry-run] [--user-token TOKEN]
 * 
 * Options:
 *   --dry-run       Show what would be fixed without making changes
 *   --user-token    Fix only conversations for a specific user token
 */

const axios = require('axios')
const path = require('path')

// Use the database abstraction
const db = require('../database')
const WUZAPI_BASE_URL = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br'

// Parse command line arguments
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const userTokenIndex = args.indexOf('--user-token')
const specificUserToken = userTokenIndex !== -1 ? args[userTokenIndex + 1] : null

/**
 * Check if a group name is invalid and needs to be fetched from WUZAPI
 * @param {string|null} name - The group name to validate
 * @returns {boolean} True if the name is invalid
 */
function isInvalidGroupName(name) {
  if (!name || name.trim().length === 0) return true
  if (/^\d+$/.test(name)) return true
  if (name.includes('@g.us')) return true
  if (/^Grupo \d+/.test(name)) return true
  return false
}

/**
 * Format a fallback group name from JID
 * @param {string} groupJid - Group JID
 * @returns {string} Formatted fallback name
 */
function formatFallbackGroupName(groupJid) {
  const groupNumber = groupJid.split('@')[0]
  const truncatedNumber = groupNumber.length > 8 
    ? groupNumber.substring(0, 8) + '...' 
    : groupNumber
  return `Grupo ${truncatedNumber}`
}

/**
 * Fetch group name from WUZAPI
 * @param {string} groupJid - Group JID
 * @param {string} userToken - User token for authentication
 * @returns {Promise<string>} Group name or formatted fallback
 */
async function fetchGroupName(groupJid, userToken) {
  try {
    // WUZAPI /group/info uses GET with GroupJID in JSON body
    // According to WUZAPI API docs: curl -s -X GET -H 'Token: ...' -H 'Content-Type: application/json' --data '{"GroupJID":"...@g.us"}' /group/info
    const response = await axios({
      method: 'GET',
      url: `${WUZAPI_BASE_URL}/group/info`,
      headers: { 
        'Token': userToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      data: { GroupJID: groupJid },
      timeout: 10000
    })
    
    if (response.data?.data?.Name && !isInvalidGroupName(response.data.data.Name)) {
      return response.data.data.Name
    }
    
    return formatFallbackGroupName(groupJid)
  } catch (error) {
    console.error(`  Error fetching group name for ${groupJid}: ${error.message}`)
    return formatFallbackGroupName(groupJid)
  }
}

/**
 * Main function to fix group names
 */
async function fixGroupNames() {
  console.log('=== Fix Group Names Script ===')
  console.log(`WUZAPI URL: ${WUZAPI_BASE_URL}`)
  console.log(`Dry run: ${dryRun}`)
  if (specificUserToken) {
    console.log(`User token filter: ${specificUserToken.substring(0, 8)}...`)
  }
  console.log('')

  // Initialize database connection
  await db.init()
  console.log('Database initialized')
  console.log('')

  try {
    // Find all group conversations with invalid names
    let sql = `
      SELECT id, user_id, contact_jid, contact_name
      FROM conversations
      WHERE contact_jid LIKE '%@g.us'
    `
    const params = []
    
    if (specificUserToken) {
      sql += ' AND user_id = ?'
      params.push(specificUserToken)
    }
    
    const { rows: conversations } = await db.query(sql, params)
    
    console.log(`Found ${conversations.length} group conversations`)
    
    // Filter to only invalid names
    const invalidConversations = conversations.filter(c => isInvalidGroupName(c.contact_name))
    
    console.log(`Found ${invalidConversations.length} conversations with invalid names`)
    console.log('')
    
    if (invalidConversations.length === 0) {
      console.log('No conversations need fixing!')
      return
    }
    
    // Group by user_id to batch API calls
    const byUser = {}
    for (const conv of invalidConversations) {
      if (!byUser[conv.user_id]) {
        byUser[conv.user_id] = []
      }
      byUser[conv.user_id].push(conv)
    }
    
    let fixed = 0
    let failed = 0
    
    for (const [userId, convs] of Object.entries(byUser)) {
      console.log(`Processing ${convs.length} conversations for user ${userId.substring(0, 8)}...`)
      
      for (const conv of convs) {
        console.log(`  [${conv.id}] ${conv.contact_jid}`)
        console.log(`    Current name: "${conv.contact_name || '(empty)'}"`)
        
        const newName = await fetchGroupName(conv.contact_jid, userId)
        console.log(`    New name: "${newName}"`)
        
        if (newName && newName !== conv.contact_name) {
          if (!dryRun) {
            await db.query('UPDATE conversations SET contact_name = ? WHERE id = ?', [newName, conv.id])
            console.log(`    ✓ Updated`)
          } else {
            console.log(`    [DRY RUN] Would update`)
          }
          fixed++
        } else {
          console.log(`    - No change needed`)
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    console.log('')
    console.log('=== Summary ===')
    console.log(`Total conversations checked: ${invalidConversations.length}`)
    console.log(`Fixed: ${fixed}`)
    console.log(`Failed/No change: ${invalidConversations.length - fixed}`)
    
    if (dryRun) {
      console.log('')
      console.log('This was a dry run. Run without --dry-run to apply changes.')
    }
    
  } catch (error) {
    console.error('Error:', error.message)
    throw error
  }
}

// Run the script
fixGroupNames().catch(error => {
  console.error('Script failed:', error)
  process.exit(1)
})
