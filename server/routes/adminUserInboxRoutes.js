/**
 * Admin User Inbox Routes
 * 
 * Routes for admin to view user inboxes.
 */

const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');

logger.info('adminUserInboxRoutes module loaded');

/**
 * GET /api/admin/users/:userId/inboxes
 * Get all inboxes for a specific user (by owner_user_id or wuzapi_user_id)
 */
router.get('/:userId/inboxes', requireAdmin, async (req, res) => {
  logger.info('Admin user inboxes route hit', { userId: req.params.userId });
  try {
    const { userId } = req.params;
    const db = req.app.locals.db;

    // First, try to get the account for this user by owner_user_id
    let accountResult = await db.query(
      'SELECT id, name FROM accounts WHERE owner_user_id = ?',
      [userId]
    );

    let account = accountResult.rows[0];
    let inboxes = [];

    if (account) {
      // Get all inboxes for this account
      const inboxesResult = await db.query(
        `SELECT 
          i.id,
          i.account_id,
          i.name,
          i.description,
          i.channel_type,
          i.phone_number,
          i.wuzapi_token,
          i.wuzapi_user_id,
          i.wuzapi_connected,
          i.enable_auto_assignment,
          i.greeting_enabled,
          i.greeting_message,
          i.created_at,
          i.updated_at,
          (SELECT COUNT(*) FROM inbox_members WHERE inbox_id = i.id) as member_count
        FROM inboxes i
        WHERE i.account_id = ?
        ORDER BY i.created_at DESC`,
        [account.id]
      );

      inboxes = inboxesResult.rows;
    } else {
      // Try to find inboxes by wuzapi_user_id (WuzAPI user ID / hash)
      const inboxesResult = await db.query(
        `SELECT 
          i.id,
          i.account_id,
          i.name,
          i.description,
          i.channel_type,
          i.phone_number,
          i.wuzapi_token,
          i.wuzapi_user_id,
          i.wuzapi_connected,
          i.enable_auto_assignment,
          i.greeting_enabled,
          i.greeting_message,
          i.created_at,
          i.updated_at,
          (SELECT COUNT(*) FROM inbox_members WHERE inbox_id = i.id) as member_count
        FROM inboxes i
        WHERE i.wuzapi_user_id = ?
        ORDER BY i.created_at DESC`,
        [userId]
      );

      inboxes = inboxesResult.rows;

      // Get account info if we found inboxes
      if (inboxes.length > 0) {
        const accResult = await db.query(
          'SELECT id, name FROM accounts WHERE id = ?',
          [inboxes[0].account_id]
        );
        account = accResult.rows[0];
      }
    }

    const mappedInboxes = inboxes.map(row => ({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      channelType: row.channel_type,
      phoneNumber: row.phone_number,
      wuzapiToken: row.wuzapi_token,
      wuzapiUserId: row.wuzapi_user_id,
      wuzapiConnected: Boolean(row.wuzapi_connected),
      enableAutoAssignment: Boolean(row.enable_auto_assignment),
      greetingEnabled: Boolean(row.greeting_enabled),
      greetingMessage: row.greeting_message,
      memberCount: row.member_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

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
