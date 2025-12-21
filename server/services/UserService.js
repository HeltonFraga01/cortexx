/**
 * UserService - Service for managing independent user accounts
 * 
 * Handles user CRUD operations, authentication, inbox linking, and permissions.
 * Independent users don't require WUZAPI token or inbox configuration.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.5, 3.6, 4.3, 4.4, 4.5, 7.6
 */

const { logger } = require('../utils/logger');
const crypto = require('crypto');
const supabaseService = require('./SupabaseService');

// Lock duration after failed login attempts (15 minutes)
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

// Default permissions for new users
const DEFAULT_USER_PERMISSIONS = [
  'profile:view',
  'profile:edit',
  'settings:view'
];

class UserService {
  /**
   * Hash a password using crypto.scrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password in format salt:hash
   */
  async hashPassword(password) {
    return new Promise((resolve, reject) => {
      const salt = crypto.randomBytes(16).toString('hex');
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      });
    });
  }

  /**
   * Verify a password against a hash
   * @param {string} password - Plain text password
   * @param {string} hash - Stored hash in format salt:hash
   * @returns {Promise<boolean>} True if password matches
   */
  async verifyPassword(password, hash) {
    return new Promise((resolve, reject) => {
      const [salt, key] = hash.split(':');
      if (!salt || !key) {
        resolve(false);
        return;
      }
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        resolve(key === derivedKey.toString('hex'));
      });
    });
  }

  // ==================== USER CRUD ====================

  /**
   * Create a new independent user
   * @param {string} tenantId - Tenant UUID
   * @param {Object} data - User data (email, password, name, avatarUrl)
   * @returns {Promise<Object>} Created user
   */
  async createUser(tenantId, data) {
    try {
      // Validate required fields
      if (!data.email || !data.password || !data.name) {
        throw new Error('MISSING_REQUIRED_FIELDS');
      }

      // Check if email already exists in tenant
      const existingUser = await this.getUserByEmail(data.email, tenantId);
      if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS');
      }

      // Hash password
      const passwordHash = await this.hashPassword(data.password);

      const userData = {
        tenant_id: tenantId,
        email: data.email.toLowerCase().trim(),
        password_hash: passwordHash,
        name: data.name.trim(),
        avatar_url: data.avatarUrl || null,
        status: data.status || 'active',
        permissions: data.permissions || DEFAULT_USER_PERMISSIONS,
        failed_login_attempts: 0,
        locked_until: null
      };

      const { data: user, error } = await supabaseService.insert('users', userData);

      if (error) {
        logger.error('Failed to create user', { error: error.message, tenantId });
        throw error;
      }

      logger.info('User created', { 
        userId: user.id, 
        tenantId, 
        email: data.email 
      });

      return this.formatUser(user);
    } catch (error) {
      logger.error('Failed to create user', { 
        error: error.message, 
        tenantId,
        email: data.email 
      });
      throw error;
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User UUID
   * @param {string} [tenantId] - Optional tenant ID for validation
   * @returns {Promise<Object|null>} User or null
   */
  async getUserById(userId, tenantId = null) {
    try {
      const { data: user, error } = await supabaseService.getById('users', userId);

      if (error) {
        if (error.code === 'ROW_NOT_FOUND') {
          return null;
        }
        throw error;
      }

      if (!user) {
        return null;
      }

      // Validate tenant if provided
      if (tenantId && user.tenant_id !== tenantId) {
        logger.warn('Cross-tenant user access attempt', {
          userId,
          userTenantId: user.tenant_id,
          requestedTenantId: tenantId
        });
        return null;
      }

      return this.formatUser(user);
    } catch (error) {
      logger.error('Failed to get user by ID', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user by email within tenant
   * @param {string} email - User email
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} User or null
   */
  async getUserByEmail(email, tenantId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase().trim())
        .single();

      const { data: user, error } = await supabaseService.queryAsAdmin('users', queryFn);

      if (error) {
        if (error.code === 'PGRST116') { // No rows returned
          return null;
        }
        throw error;
      }

      return user ? this.formatUser(user) : null;
    } catch (error) {
      logger.error('Failed to get user by email', { error: error.message, email, tenantId });
      throw error;
    }
  }

  /**
   * Get user with password hash for authentication
   * @param {string} email - User email
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object|null>} User with password hash or null
   */
  async getUserForAuth(email, tenantId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('email', email.toLowerCase().trim())
        .single();

      const { data: user, error } = await supabaseService.queryAsAdmin('users', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      if (!user) {
        return null;
      }

      return {
        ...this.formatUser(user),
        passwordHash: user.password_hash,
        failedLoginAttempts: user.failed_login_attempts,
        lockedUntil: user.locked_until
      };
    } catch (error) {
      logger.error('Failed to get user for auth', { error: error.message, email, tenantId });
      throw error;
    }
  }


  /**
   * Authenticate user with email/password
   * @param {string} email - User email
   * @param {string} password - Plain password
   * @param {string} tenantId - Tenant UUID
   * @returns {Promise<Object>} Auth result with user data
   */
  async authenticateUser(email, password, tenantId) {
    try {
      const user = await this.getUserForAuth(email, tenantId);

      if (!user) {
        return { success: false, error: 'USER_NOT_FOUND' };
      }

      // Check if user is inactive
      if (user.status === 'inactive') {
        return { success: false, error: 'USER_INACTIVE' };
      }

      // Check if user is locked
      if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
        return { 
          success: false, 
          error: 'USER_LOCKED',
          lockedUntil: user.lockedUntil
        };
      }

      // Verify password
      const isValid = await this.verifyPassword(password, user.passwordHash);

      if (!isValid) {
        // Record failed login attempt
        await this.recordFailedLogin(user.id);
        return { success: false, error: 'INVALID_CREDENTIALS' };
      }

      // Reset failed login attempts on successful login
      await this.resetFailedLogins(user.id);

      // Update last login timestamp
      await this.updateLastLogin(user.id);

      // Remove sensitive data before returning
      delete user.passwordHash;
      delete user.failedLoginAttempts;
      delete user.lockedUntil;

      logger.info('User authenticated successfully', { 
        userId: user.id, 
        tenantId,
        email 
      });

      return { 
        success: true, 
        user,
        role: 'user'
      };
    } catch (error) {
      logger.error('Authentication failed', { error: error.message, email, tenantId });
      throw error;
    }
  }

  /**
   * List users for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} [filters] - Optional filters (status, limit, offset)
   * @returns {Promise<Object[]>} List of users
   */
  async listUsers(tenantId, filters = {}) {
    try {
      const queryFn = (query) => {
        let q = query.select('*').eq('tenant_id', tenantId);

        if (filters.status) {
          q = q.eq('status', filters.status);
        }

        q = q.order('created_at', { ascending: false });

        if (filters.limit) {
          q = q.limit(filters.limit);
        }

        if (filters.offset) {
          q = q.range(filters.offset, filters.offset + (filters.limit || 10) - 1);
        }

        return q;
      };

      const { data: users, error } = await supabaseService.queryAsAdmin('users', queryFn);

      if (error) {
        throw error;
      }

      return (users || []).map(row => this.formatUser(row));
    } catch (error) {
      logger.error('Failed to list users', { error: error.message, tenantId });
      throw error;
    }
  }

  /**
   * Update user
   * @param {string} userId - User UUID
   * @param {Object} data - Update data
   * @param {string} [tenantId] - Optional tenant ID for validation
   * @returns {Promise<Object>} Updated user
   */
  async updateUser(userId, data, tenantId = null) {
    try {
      const user = await this.getUserById(userId, tenantId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const updates = {};

      if (data.name !== undefined) {
        updates.name = data.name.trim();
      }

      if (data.avatarUrl !== undefined) {
        updates.avatar_url = data.avatarUrl;
      }

      if (data.status !== undefined) {
        updates.status = data.status;
      }

      if (Object.keys(updates).length === 0) {
        return user;
      }

      updates.updated_at = new Date().toISOString();

      const { data: updatedUser, error } = await supabaseService.update('users', userId, updates);

      if (error) {
        throw error;
      }

      logger.info('User updated', { userId });

      return this.formatUser(updatedUser);
    } catch (error) {
      logger.error('Failed to update user', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update user password
   * @param {string} userId - User UUID
   * @param {string} newPassword - New password
   * @param {boolean} [invalidateSessions=true] - Whether to invalidate sessions
   * @returns {Promise<void>}
   */
  async updatePassword(userId, newPassword, invalidateSessions = true) {
    try {
      const passwordHash = await this.hashPassword(newPassword);

      const { error } = await supabaseService.update('users', userId, {
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      if (invalidateSessions) {
        await this.invalidateUserSessions(userId);
      }

      logger.info('User password updated', { userId });
    } catch (error) {
      logger.error('Failed to update password', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Deactivate user and invalidate sessions
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async deactivateUser(userId) {
    try {
      const { error } = await supabaseService.update('users', userId, {
        status: 'inactive',
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      // Invalidate all sessions for this user
      await this.invalidateUserSessions(userId);

      logger.info('User deactivated', { userId });
    } catch (error) {
      logger.error('Failed to deactivate user', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Activate user
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Updated user
   */
  async activateUser(userId) {
    try {
      const { data: user, error } = await supabaseService.update('users', userId, {
        status: 'active',
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      logger.info('User activated', { userId });

      return this.formatUser(user);
    } catch (error) {
      logger.error('Failed to activate user', { error: error.message, userId });
      throw error;
    }
  }


  // ==================== INBOX LINKING ====================

  /**
   * Link user to inbox
   * @param {string} userId - User UUID
   * @param {string} inboxId - Inbox UUID
   * @param {boolean} [isPrimary=false] - Whether this is the primary inbox
   * @returns {Promise<Object>} Created link
   */
  async linkInbox(userId, inboxId, isPrimary = false) {
    try {
      // Get user to validate tenant
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Get inbox to validate tenant
      const { data: inbox, error: inboxError } = await supabaseService.getById('inboxes', inboxId);
      if (inboxError || !inbox) {
        throw new Error('INBOX_NOT_FOUND');
      }

      // Get account to check tenant
      const { data: account, error: accountError } = await supabaseService.getById('accounts', inbox.account_id);
      if (accountError || !account) {
        throw new Error('INBOX_NOT_FOUND');
      }

      // Validate inbox belongs to same tenant
      if (account.tenant_id !== user.tenantId) {
        logger.warn('Cross-tenant inbox linking attempt', {
          userId,
          userTenantId: user.tenantId,
          inboxTenantId: account.tenant_id
        });
        throw new Error('INBOX_TENANT_MISMATCH');
      }

      // Check if already linked
      const existingLink = await this.getUserInboxLink(userId, inboxId);
      if (existingLink) {
        throw new Error('INBOX_ALREADY_LINKED');
      }

      // If setting as primary, unset other primary inboxes
      if (isPrimary) {
        await this.unsetPrimaryInbox(userId);
      }

      const linkData = {
        user_id: userId,
        inbox_id: inboxId,
        is_primary: isPrimary
      };

      const { data: link, error } = await supabaseService.insert('user_inboxes', linkData);

      if (error) {
        throw error;
      }

      logger.info('Inbox linked to user', { userId, inboxId, isPrimary });

      return this.formatUserInbox(link);
    } catch (error) {
      logger.error('Failed to link inbox', { error: error.message, userId, inboxId });
      throw error;
    }
  }

  /**
   * Unlink user from inbox
   * @param {string} userId - User UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<void>}
   */
  async unlinkInbox(userId, inboxId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('user_id', userId)
        .eq('inbox_id', inboxId);

      const { error } = await supabaseService.queryAsAdmin('user_inboxes', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Inbox unlinked from user', { userId, inboxId });
    } catch (error) {
      logger.error('Failed to unlink inbox', { error: error.message, userId, inboxId });
      throw error;
    }
  }

  /**
   * Get user's linked inboxes
   * @param {string} userId - User UUID
   * @returns {Promise<Object[]>} List of inboxes with link info
   */
  async getUserInboxes(userId) {
    try {
      const queryFn = (query) => query
        .select(`
          *,
          inboxes (
            id,
            name,
            channel_type,
            phone_number,
            status
          )
        `)
        .eq('user_id', userId)
        .order('is_primary', { ascending: false });

      const { data: links, error } = await supabaseService.queryAsAdmin('user_inboxes', queryFn);

      if (error) {
        throw error;
      }

      return (links || []).map(link => ({
        ...this.formatUserInbox(link),
        inbox: link.inboxes ? {
          id: link.inboxes.id,
          name: link.inboxes.name,
          channelType: link.inboxes.channel_type,
          phoneNumber: link.inboxes.phone_number,
          status: link.inboxes.status
        } : null
      }));
    } catch (error) {
      logger.error('Failed to get user inboxes', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user has any linked inbox
   * @param {string} userId - User UUID
   * @returns {Promise<boolean>} True if user has at least one inbox
   */
  async hasLinkedInbox(userId) {
    try {
      const { count, error } = await supabaseService.count('user_inboxes', { user_id: userId });

      if (error) {
        throw error;
      }

      return count > 0;
    } catch (error) {
      logger.error('Failed to check linked inbox', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user's primary inbox
   * @param {string} userId - User UUID
   * @returns {Promise<Object|null>} Primary inbox or null
   */
  async getPrimaryInbox(userId) {
    try {
      const queryFn = (query) => query
        .select(`
          *,
          inboxes (*)
        `)
        .eq('user_id', userId)
        .eq('is_primary', true)
        .single();

      const { data: link, error } = await supabaseService.queryAsAdmin('user_inboxes', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return link?.inboxes || null;
    } catch (error) {
      logger.error('Failed to get primary inbox', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user-inbox link
   * @param {string} userId - User UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<Object|null>} Link or null
   */
  async getUserInboxLink(userId, inboxId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('user_id', userId)
        .eq('inbox_id', inboxId)
        .single();

      const { data: link, error } = await supabaseService.queryAsAdmin('user_inboxes', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return link ? this.formatUserInbox(link) : null;
    } catch (error) {
      logger.error('Failed to get user inbox link', { error: error.message, userId, inboxId });
      throw error;
    }
  }

  /**
   * Unset primary inbox for user
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async unsetPrimaryInbox(userId) {
    try {
      const queryFn = (query) => query
        .update({ is_primary: false })
        .eq('user_id', userId)
        .eq('is_primary', true);

      await supabaseService.queryAsAdmin('user_inboxes', queryFn);
    } catch (error) {
      logger.error('Failed to unset primary inbox', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Set inbox as primary
   * @param {string} userId - User UUID
   * @param {string} inboxId - Inbox UUID
   * @returns {Promise<void>}
   */
  async setPrimaryInbox(userId, inboxId) {
    try {
      // First unset all primary
      await this.unsetPrimaryInbox(userId);

      // Then set the new primary
      const queryFn = (query) => query
        .update({ is_primary: true })
        .eq('user_id', userId)
        .eq('inbox_id', inboxId);

      await supabaseService.queryAsAdmin('user_inboxes', queryFn);

      logger.info('Primary inbox set', { userId, inboxId });
    } catch (error) {
      logger.error('Failed to set primary inbox', { error: error.message, userId, inboxId });
      throw error;
    }
  }


  // ==================== PERMISSIONS ====================

  /**
   * Update user permissions
   * @param {string} userId - User UUID
   * @param {string[]} permissions - Permission list
   * @param {string} [adminId] - Admin who made the change (for audit)
   * @returns {Promise<Object>} Updated user
   */
  async updatePermissions(userId, permissions, adminId = null) {
    try {
      const user = await this.getUserById(userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      const oldPermissions = user.permissions;

      const { data: updatedUser, error } = await supabaseService.update('users', userId, {
        permissions,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }

      // Log permission change to audit log
      await this.logPermissionChange(userId, oldPermissions, permissions, adminId);

      logger.info('User permissions updated', { userId, permissions });

      return this.formatUser(updatedUser);
    } catch (error) {
      logger.error('Failed to update permissions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get user permissions
   * @param {string} userId - User UUID
   * @returns {Promise<string[]>} List of permissions
   */
  async getUserPermissions(userId) {
    try {
      const user = await this.getUserById(userId);
      return user?.permissions || [];
    } catch (error) {
      logger.error('Failed to get user permissions', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Check if user has a specific permission
   * @param {string} userId - User UUID
   * @param {string} permission - Permission to check
   * @returns {Promise<boolean>} True if user has permission
   */
  async hasPermission(userId, permission) {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission) || permissions.includes('*');
  }

  /**
   * Log permission change to audit log
   * @param {string} userId - User UUID
   * @param {string[]} oldPermissions - Previous permissions
   * @param {string[]} newPermissions - New permissions
   * @param {string} [adminId] - Admin who made the change
   * @returns {Promise<void>}
   */
  async logPermissionChange(userId, oldPermissions, newPermissions, adminId = null) {
    try {
      const auditData = {
        admin_user_id: adminId || 'system',
        action: 'UPDATE_PERMISSIONS',
        resource_type: 'user',
        resource_id: userId,
        details: {
          old_permissions: oldPermissions,
          new_permissions: newPermissions,
          added: newPermissions.filter(p => !oldPermissions.includes(p)),
          removed: oldPermissions.filter(p => !newPermissions.includes(p))
        }
      };

      await supabaseService.insert('admin_audit_log', auditData);
    } catch (error) {
      logger.error('Failed to log permission change', { error: error.message, userId });
      // Don't throw - audit logging failure shouldn't break the operation
    }
  }

  // ==================== LOGIN ATTEMPT TRACKING ====================

  /**
   * Record failed login attempt
   * @param {string} userId - User UUID
   * @returns {Promise<Object>} Updated attempt info
   */
  async recordFailedLogin(userId) {
    try {
      const queryFn = (query) => query
        .select('failed_login_attempts')
        .eq('id', userId)
        .single();

      const { data: result, error: fetchError } = await supabaseService.queryAsAdmin('users', queryFn);

      if (fetchError) {
        throw fetchError;
      }

      const currentAttempts = result?.failed_login_attempts || 0;
      const newAttempts = currentAttempts + 1;

      // Lock account after MAX_FAILED_ATTEMPTS
      let lockedUntil = null;
      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        lockedUntil = new Date(Date.now() + LOCK_DURATION_MS).toISOString();
      }

      const { error: updateError } = await supabaseService.update('users', userId, {
        failed_login_attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: new Date().toISOString()
      });

      if (updateError) {
        throw updateError;
      }

      logger.warn('Failed login attempt recorded', { 
        userId, 
        attempts: newAttempts, 
        locked: !!lockedUntil 
      });

      return { attempts: newAttempts, lockedUntil };
    } catch (error) {
      logger.error('Failed to record failed login', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Reset failed login attempts
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async resetFailedLogins(userId) {
    try {
      const { error } = await supabaseService.update('users', userId, {
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to reset failed logins', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update last login timestamp
   * @param {string} userId - User UUID
   * @returns {Promise<void>}
   */
  async updateLastLogin(userId) {
    try {
      const { error } = await supabaseService.update('users', userId, {
        last_login_at: new Date().toISOString()
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      logger.error('Failed to update last login', { error: error.message, userId });
      // Don't throw - this is not critical
    }
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Invalidate all sessions for a user
   * @param {string} userId - User UUID
   * @param {string} [exceptSessionId] - Session ID to keep active
   * @returns {Promise<void>}
   */
  async invalidateUserSessions(userId, exceptSessionId = null) {
    try {
      const queryFn = (query) => {
        let q = query.delete().eq('user_id', userId);
        if (exceptSessionId) {
          q = q.neq('id', exceptSessionId);
        }
        return q;
      };

      await supabaseService.queryAsAdmin('user_sessions', queryFn);

      logger.info('User sessions invalidated', { userId, exceptSessionId });
    } catch (error) {
      logger.error('Failed to invalidate sessions', { error: error.message, userId });
      throw error;
    }
  }

  // ==================== STATISTICS ====================

  /**
   * Get user count for a tenant
   * @param {string} tenantId - Tenant UUID
   * @param {Object} [filters] - Optional filters
   * @returns {Promise<number>} User count
   */
  async countUsers(tenantId, filters = {}) {
    try {
      const filterObj = { tenant_id: tenantId };
      if (filters.status) {
        filterObj.status = filters.status;
      }

      const { count, error } = await supabaseService.count('users', filterObj);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error('Failed to get user count', { error: error.message, tenantId });
      throw error;
    }
  }

  // ==================== PASSWORD RESET ====================

  /**
   * Generate password reset token
   * @param {string} userId - User UUID
   * @returns {Promise<string>} Reset token
   */
  async generatePasswordResetToken(userId) {
    try {
      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

      // Store token in user record (or a separate table in production)
      // For simplicity, we'll use a JSON field approach
      const { error } = await supabaseService.update('users', userId, {
        password_reset_token: token,
        password_reset_expires: expiresAt,
        updated_at: new Date().toISOString()
      });

      if (error) {
        // If column doesn't exist, log and return token anyway
        logger.warn('Could not store reset token in DB', { error: error.message, userId });
      }

      return token;
    } catch (error) {
      logger.error('Failed to generate reset token', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Reset password using token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Result with success status
   */
  async resetPasswordWithToken(token, newPassword) {
    try {
      // Find user with this token
      const queryFn = (query) => query
        .select('*')
        .eq('password_reset_token', token)
        .single();

      const { data: user, error } = await supabaseService.queryAsAdmin('users', queryFn);

      if (error || !user) {
        return { success: false, error: 'INVALID_TOKEN' };
      }

      // Check if token is expired
      if (user.password_reset_expires && new Date(user.password_reset_expires) < new Date()) {
        return { success: false, error: 'TOKEN_EXPIRED' };
      }

      // Hash new password
      const passwordHash = await this.hashPassword(newPassword);

      // Update password and clear reset token
      const { error: updateError } = await supabaseService.update('users', user.id, {
        password_hash: passwordHash,
        password_reset_token: null,
        password_reset_expires: null,
        failed_login_attempts: 0,
        locked_until: null,
        updated_at: new Date().toISOString()
      });

      if (updateError) {
        throw updateError;
      }

      // Invalidate all sessions
      await this.invalidateUserSessions(user.id);

      logger.info('Password reset completed', { userId: user.id });

      return { success: true, userId: user.id };
    } catch (error) {
      logger.error('Failed to reset password', { error: error.message });
      throw error;
    }
  }

  // ==================== FORMATTERS ====================

  /**
   * Format user row from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted user
   */
  formatUser(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      avatarUrl: row.avatar_url,
      status: row.status,
      permissions: row.permissions || [],
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format user inbox link from database
   * @param {Object} row - Database row
   * @returns {Object} Formatted link
   */
  formatUserInbox(row) {
    return {
      id: row.id,
      userId: row.user_id,
      inboxId: row.inbox_id,
      isPrimary: row.is_primary,
      createdAt: row.created_at
    };
  }
}

module.exports = new UserService();
