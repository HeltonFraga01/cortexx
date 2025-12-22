/**
 * Admin User Inbox Routes
 * 
 * Routes for admin to view user inboxes.
 * 
 * When no account/inbox exists in Supabase for a WUZAPI user,
 * this route creates them on-the-fly to ensure the admin can
 * always see and manage inboxes for all WUZAPI users.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
const wuzapiClient = require('../utils/wuzapiClient');
const { normalizeToUUID } = require('../utils/userIdHelper');

logger.info('adminUserInboxRoutes module loaded');

/**
 * Get or create account and inbox for a WUZAPI user
 * @param {string} userId - WUZAPI user ID
 * @param {string} userToken - WUZAPI user token
 * @param {string} userName - WUZAPI user name
 * @returns {Promise<{account: Object, inbox: Object}>}
 */
async function getOrCreateAccountAndInbox(userId, userToken, userName) {
  // Use helper to normalize to UUID format
  const uuidUserId = normalizeToUUID(userId) || userId;

  // Try to find existing account by owner_user_id
  let { data: accounts } = await SupabaseService.getMany('accounts', { owner_user_id: uuidUserId });
  let account = accounts?.[0];

  // If not found, try by wuzapi_token
  if (!account) {
    const { data: accountsByToken } = await SupabaseService.getMany('accounts', { wuzapi_token: userToken });
    account = accountsByToken?.[0];
  }

  // If still not found, create the account
  if (!account) {
    const now = new Date().toISOString();
    const accountId = crypto.randomUUID();
    
    const { data: newAccount, error: createError } = await SupabaseService.insert('accounts', {
      id: accountId,
      name: `Account - ${userName}`,
      owner_user_id: uuidUserId,
      wuzapi_token: userToken,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      status: 'active',
      settings: {
        maxAgents: 10,
        maxInboxes: 5,
        maxTeams: 5,
        features: ['messaging', 'webhooks', 'contacts']
      },
      created_at: now,
      updated_at: now
    });

    if (createError) {
      logger.error('Failed to create account for WUZAPI user', { userId, error: createError.message });
      throw createError;
    }

    account = newAccount;
    logger.info('Account created for WUZAPI user', { accountId: account.id, userId, userName });
  }

  // Now check for inbox
  let { data: inboxes } = await SupabaseService.getMany('inboxes', { account_id: account.id });
  let inbox = inboxes?.[0];

  // If no inbox exists, create one
  if (!inbox) {
    const now = new Date().toISOString();
    const inboxId = crypto.randomUUID();

    const { data: newInbox, error: inboxError } = await SupabaseService.insert('inboxes', {
      id: inboxId,
      account_id: account.id,
      name: `WhatsApp ${userName}`,
      channel_type: 'whatsapp',
      enable_auto_assignment: true,
      greeting_enabled: false,
      greeting_message: null,
      wuzapi_token: userToken,
      status: 'active',
      settings: { wuzapi_user_id: userId },
      created_at: now,
      updated_at: now
    });

    if (inboxError) {
      logger.error('Failed to create inbox for WUZAPI user', { userId, accountId: account.id, error: inboxError.message });
      throw inboxError;
    }

    inbox = newInbox;
    logger.info('Inbox created for WUZAPI user', { inboxId: inbox.id, accountId: account.id, userId, userName });
  }

  return { account, inbox };
}

/**
 * GET /api/admin/users/:userId/inboxes
 * Get all inboxes for a specific user (by owner_user_id or wuzapi_user_id or wuzapi_token)
 * If no account/inbox exists, creates them on-the-fly
 */
router.get('/:userId/inboxes', requireAdmin, async (req, res) => {
  logger.info('Admin user inboxes route hit', { userId: req.params.userId });
  try {
    const { userId } = req.params;

    let account = null;
    let inboxes = [];

    // Use helper to normalize to UUID format
    const uuidUserId = normalizeToUUID(userId) || userId;

    // First, try to get the account for this user by owner_user_id
    const { data: accountData } = await SupabaseService.getMany('accounts', { owner_user_id: uuidUserId });
    
    if (accountData && accountData.length > 0) {
      account = accountData[0];
    } else {
      // Try to find account by wuzapi_token (the userId might be a wuzapi token)
      const { data: accountByToken } = await SupabaseService.getMany('accounts', { wuzapi_token: userId });
      
      if (accountByToken && accountByToken.length > 0) {
        account = accountByToken[0];
      }
    }

    // If account found, get its inboxes
    if (account) {
      const { data: inboxData } = await SupabaseService.getMany('inboxes', { account_id: account.id }, {
        orderBy: 'created_at',
        ascending: false
      });
      
      if (inboxData) {
        inboxes = inboxData;
      }
    } else {
      // No account found - try to get WUZAPI user info and create account/inbox
      try {
        const adminToken = process.env.WUZAPI_ADMIN_TOKEN;
        if (adminToken) {
          const wuzapiResult = await wuzapiClient.getUser(userId, adminToken);
          
          if (wuzapiResult.success && wuzapiResult.data) {
            const wuzapiUser = wuzapiResult.data;
            const { account: newAccount, inbox: newInbox } = await getOrCreateAccountAndInbox(
              wuzapiUser.id || userId,
              wuzapiUser.token || userId,
              wuzapiUser.name || 'Usuário'
            );
            
            account = newAccount;
            inboxes = [newInbox];
          }
        }
      } catch (wuzapiError) {
        logger.warn('Could not fetch WUZAPI user to create account/inbox', { 
          userId, 
          error: wuzapiError.message 
        });
        // Continue without creating - will return empty inboxes
      }
    }

    // Get member count for each inbox
    for (const inbox of inboxes) {
      const { count } = await SupabaseService.count('inbox_members', { inbox_id: inbox.id });
      inbox.member_count = count || 0;
    }

    const mappedInboxes = inboxes.map(row => {
      const settings = row.settings || {};
      return {
        id: row.id,
        accountId: row.account_id,
        name: row.name,
        description: settings.description || null,
        channelType: row.channel_type,
        phoneNumber: row.phone_number,
        wuzapiToken: row.wuzapi_token,
        wuzapiUserId: settings.wuzapi_user_id || null,
        wuzapiConnected: Boolean(settings.wuzapi_connected || row.status === 'active'),
        enableAutoAssignment: Boolean(row.enable_auto_assignment),
        greetingEnabled: Boolean(row.greeting_enabled),
        greetingMessage: row.greeting_message,
        memberCount: row.member_count || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    logger.info('Admin fetched user inboxes', {
      adminId: req.session.userId,
      targetUserId: userId,
      accountId: account?.id,
      inboxCount: mappedInboxes.length,
      endpoint: `/api/admin/users/${userId}/inboxes`
    });

    res.json({
      success: true,
      data: mappedInboxes,
      account: account ? {
        id: account.id,
        name: account.name
      } : null
    });
  } catch (error) {
    logger.error('Failed to fetch user inboxes', {
      adminId: req.session.userId,
      targetUserId: req.params.userId,
      error: error.message,
      endpoint: `/api/admin/users/${req.params.userId}/inboxes`
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
