/**
 * AutomationService - Service for managing admin automation settings
 * 
 * Handles global settings, bot templates, default labels, canned responses,
 * and automation application to new users.
 * 
 * Migrated to use SupabaseService directly instead of raw SQL queries.
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AutomationService {
  constructor(db) {
    this.db = db;
  }

  // ==================== Global Settings ====================

  async getGlobalSettings() {
    try {
      const { data: rows, error } = await SupabaseService.getMany('global_settings', {}, {
        orderBy: 'key',
        ascending: true
      });

      if (error) {
        logger.error('Failed to get global settings from Supabase', { error: error.message });
        throw error;
      }

      const settings = {
        automationsEnabled: { bot: false, labels: false, cannedResponses: false, webhooks: false },
        defaultBotTemplateId: null,
        defaultWebhookUrl: null,
        defaultWebhookEvents: [],
        auditLogRetentionDays: 90
      };

      for (const row of (rows || [])) {
        const value = typeof row.value === 'object' ? row.value : row.value;
        switch (row.key) {
          case 'automation.bot.enabled':
            settings.automationsEnabled.bot = value === true || value === 'true';
            break;
          case 'automation.bot.defaultTemplateId':
            settings.defaultBotTemplateId = value === null || value === 'null' ? null : value;
            break;
          case 'automation.labels.enabled':
            settings.automationsEnabled.labels = value === true || value === 'true';
            break;
          case 'automation.cannedResponses.enabled':
            settings.automationsEnabled.cannedResponses = value === true || value === 'true';
            break;
          case 'automation.webhooks.enabled':
            settings.automationsEnabled.webhooks = value === true || value === 'true';
            break;
          case 'automation.webhooks.defaultUrl':
            settings.defaultWebhookUrl = value === null || value === 'null' ? null : value;
            break;
          case 'automation.webhooks.defaultEvents':
            settings.defaultWebhookEvents = Array.isArray(value) ? value : [];
            break;
          case 'automation.auditLog.retentionDays':
            settings.auditLogRetentionDays = parseInt(value, 10) || 90;
            break;
        }
      }
      return settings;
    } catch (error) {
      logger.error('Failed to get global settings', { error: error.message });
      throw error;
    }
  }

  async updateGlobalSettings(updates) {
    try {
      const settingsMap = [];
      if (updates.automationsEnabled) {
        if (typeof updates.automationsEnabled.bot === 'boolean') {
          settingsMap.push({ key: 'automation.bot.enabled', value: updates.automationsEnabled.bot });
        }
        if (typeof updates.automationsEnabled.labels === 'boolean') {
          settingsMap.push({ key: 'automation.labels.enabled', value: updates.automationsEnabled.labels });
        }
        if (typeof updates.automationsEnabled.cannedResponses === 'boolean') {
          settingsMap.push({ key: 'automation.cannedResponses.enabled', value: updates.automationsEnabled.cannedResponses });
        }
        if (typeof updates.automationsEnabled.webhooks === 'boolean') {
          settingsMap.push({ key: 'automation.webhooks.enabled', value: updates.automationsEnabled.webhooks });
        }
      }
      if (updates.defaultBotTemplateId !== undefined) {
        settingsMap.push({ key: 'automation.bot.defaultTemplateId', value: updates.defaultBotTemplateId });
      }
      if (updates.defaultWebhookUrl !== undefined) {
        settingsMap.push({ key: 'automation.webhooks.defaultUrl', value: updates.defaultWebhookUrl });
      }
      if (updates.defaultWebhookEvents !== undefined) {
        settingsMap.push({ key: 'automation.webhooks.defaultEvents', value: updates.defaultWebhookEvents });
      }
      if (updates.auditLogRetentionDays !== undefined) {
        settingsMap.push({ key: 'automation.auditLog.retentionDays', value: updates.auditLogRetentionDays });
      }

      for (const setting of settingsMap) {
        const { data: existing } = await SupabaseService.getMany('global_settings', { key: setting.key });
        if (existing && existing.length > 0) {
          await SupabaseService.adminClient.from('global_settings')
            .update({ value: setting.value, updated_at: new Date().toISOString() })
            .eq('key', setting.key);
        } else {
          await SupabaseService.insert('global_settings', { key: setting.key, value: setting.value });
        }
      }
      logger.info('Global settings updated', { updatedKeys: settingsMap.map(s => s.key) });
      return this.getGlobalSettings();
    } catch (error) {
      logger.error('Failed to update global settings', { error: error.message });
      throw error;
    }
  }

  // ==================== Bot Templates ====================

  async getBotTemplates() {
    try {
      const { data: rows, error } = await SupabaseService.getMany('bot_templates', {}, { orderBy: 'created_at', ascending: false });
      if (error) throw error;
      return (rows || []).map(this.transformBotTemplate);
    } catch (error) {
      logger.error('Failed to get bot templates', { error: error.message });
      throw error;
    }
  }

  async getBotTemplateById(id) {
    try {
      const { data, error } = await SupabaseService.getById('bot_templates', id);
      if (error) {
        if (error.code === 'ROW_NOT_FOUND') return null;
        throw error;
      }
      return data ? this.transformBotTemplate(data) : null;
    } catch (error) {
      logger.error('Failed to get bot template', { id, error: error.message });
      throw error;
    }
  }

  async createBotTemplate(data) {
    const { name, description, outgoingUrl, includeHistory = false, chatwootUserId = null, chatwootInboxId = null, inboxAssignments = [] } = data;
    if (!name || !name.trim()) throw new Error('Bot template name is required');
    if (!outgoingUrl || !outgoingUrl.trim()) throw new Error('Outgoing URL is required');
    try { new URL(outgoingUrl); } catch { throw new Error('Invalid outgoing URL format'); }

    try {
      const { data: created, error } = await SupabaseService.insert('bot_templates', {
        name: name.trim(),
        description: description || null,
        default_config: { outgoing_url: outgoingUrl.trim(), include_history: includeHistory },
        chatwoot_account_id: chatwootUserId,
        chatwoot_inbox_id: chatwootInboxId,
        inbox_assignments: inboxAssignments || []
      });
      if (error) throw error;
      logger.info('Bot template created', { id: created.id, name });
      return this.transformBotTemplate(created);
    } catch (error) {
      logger.error('Failed to create bot template', { error: error.message });
      throw error;
    }
  }

  async updateBotTemplate(id, data) {
    const template = await this.getBotTemplateById(id);
    if (!template) throw new Error('Bot template not found');
    const updates = {};
    if (data.name !== undefined) {
      if (!data.name || !data.name.trim()) throw new Error('Bot template name is required');
      updates.name = data.name.trim();
    }
    if (data.description !== undefined) updates.description = data.description;
    if (data.outgoingUrl !== undefined) {
      if (!data.outgoingUrl || !data.outgoingUrl.trim()) throw new Error('Outgoing URL is required');
      try { new URL(data.outgoingUrl); } catch { throw new Error('Invalid outgoing URL format'); }
      updates.default_config = { ...(template.defaultConfig || {}), outgoing_url: data.outgoingUrl.trim() };
    }
    if (data.includeHistory !== undefined) {
      updates.default_config = { ...(updates.default_config || template.defaultConfig || {}), include_history: data.includeHistory };
    }
    if (data.chatwootUserId !== undefined) updates.chatwoot_account_id = data.chatwootUserId || null;
    if (data.chatwootInboxId !== undefined) updates.chatwoot_inbox_id = data.chatwootInboxId || null;
    if (data.inboxAssignments !== undefined) updates.inbox_assignments = data.inboxAssignments || [];
    if (Object.keys(updates).length === 0) return template;
    updates.updated_at = new Date().toISOString();
    try {
      const { data: updated, error } = await SupabaseService.update('bot_templates', id, updates);
      if (error) throw error;
      logger.info('Bot template updated', { id });
      return this.transformBotTemplate(updated);
    } catch (error) {
      logger.error('Failed to update bot template', { id, error: error.message });
      throw error;
    }
  }


  async deleteBotTemplate(id) {
    const template = await this.getBotTemplateById(id);
    if (!template) throw new Error('Bot template not found');
    if (template.isSystem) throw new Error('Cannot delete a system bot template');
    try {
      const { error } = await SupabaseService.delete('bot_templates', id);
      if (error) throw error;
      logger.info('Bot template deleted', { id });
    } catch (error) {
      logger.error('Failed to delete bot template', { id, error: error.message });
      throw error;
    }
  }

  async setDefaultBotTemplate(id) {
    const template = await this.getBotTemplateById(id);
    if (!template) throw new Error('Bot template not found');
    try {
      await this.updateGlobalSettings({ defaultBotTemplateId: id });
      logger.info('Bot template set as default', { id });
      return template;
    } catch (error) {
      logger.error('Failed to set default bot template', { id, error: error.message });
      throw error;
    }
  }

  transformBotTemplate(row) {
    if (!row) return null;
    const defaultConfig = row.default_config || {};
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      outgoingUrl: defaultConfig.outgoing_url || null,
      includeHistory: Boolean(defaultConfig.include_history),
      isSystem: Boolean(row.is_system),
      botType: row.bot_type || 'webhook',
      chatwootUserId: row.chatwoot_account_id || null,
      chatwootInboxId: row.chatwoot_inbox_id || null,
      defaultConfig,
      inboxAssignments: Array.isArray(row.inbox_assignments) ? row.inbox_assignments : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  async getBotTemplatesForInboxes(inboxIds) {
    if (!inboxIds || inboxIds.length === 0) return [];
    try {
      const { data: rows, error } = await SupabaseService.getMany('bot_templates', {}, { orderBy: 'created_at', ascending: false });
      if (error) throw error;
      return (rows || []).filter(t => (t.inbox_assignments || []).some(a => inboxIds.includes(a.inboxId)))
        .map(t => ({
          id: t.id, name: t.name, description: t.description,
          outgoingUrl: (t.default_config || {}).outgoing_url,
          includeHistory: Boolean((t.default_config || {}).include_history),
          isSystem: Boolean(t.is_system),
          inboxAssignments: (t.inbox_assignments || []).filter(a => inboxIds.includes(a.inboxId))
        }));
    } catch (error) {
      logger.error('Failed to get bot templates for inboxes', { inboxIds, error: error.message });
      throw error;
    }
  }


  // ==================== Default Labels ====================

  async getDefaultLabels() {
    try {
      const { data: rows, error } = await SupabaseService.getMany('default_labels', {}, { orderBy: 'created_at', ascending: true });
      if (error) throw error;
      return (rows || []).map(this.transformDefaultLabel);
    } catch (error) {
      logger.error('Failed to get default labels', { error: error.message });
      throw error;
    }
  }

  async getDefaultLabelById(id) {
    try {
      const { data, error } = await SupabaseService.getById('default_labels', id);
      if (error) { if (error.code === 'ROW_NOT_FOUND') return null; throw error; }
      return data ? this.transformDefaultLabel(data) : null;
    } catch (error) {
      logger.error('Failed to get default label', { id, error: error.message });
      throw error;
    }
  }

  async createDefaultLabel(data) {
    const { name, color } = data;
    if (!name || !name.trim()) throw new Error('Label name is required');
    if (!color || !color.trim()) throw new Error('Label color is required');
    try {
      const { data: created, error } = await SupabaseService.insert('default_labels', { title: name.trim(), color: color.trim() });
      if (error) throw error;
      logger.info('Default label created', { id: created.id, name });
      return this.transformDefaultLabel(created);
    } catch (error) {
      logger.error('Failed to create default label', { error: error.message });
      throw error;
    }
  }

  async updateDefaultLabel(id, data) {
    const label = await this.getDefaultLabelById(id);
    if (!label) throw new Error('Default label not found');
    const updates = {};
    if (data.name !== undefined) { if (!data.name || !data.name.trim()) throw new Error('Label name is required'); updates.title = data.name.trim(); }
    if (data.color !== undefined) { if (!data.color || !data.color.trim()) throw new Error('Label color is required'); updates.color = data.color.trim(); }
    if (Object.keys(updates).length === 0) return label;
    try {
      const { data: updated, error } = await SupabaseService.update('default_labels', id, updates);
      if (error) throw error;
      logger.info('Default label updated', { id });
      return this.transformDefaultLabel(updated);
    } catch (error) {
      logger.error('Failed to update default label', { id, error: error.message });
      throw error;
    }
  }


  async deleteDefaultLabel(id) {
    const label = await this.getDefaultLabelById(id);
    if (!label) throw new Error('Default label not found');
    try {
      const { error } = await SupabaseService.delete('default_labels', id);
      if (error) throw error;
      logger.info('Default label deleted', { id });
    } catch (error) {
      logger.error('Failed to delete default label', { id, error: error.message });
      throw error;
    }
  }

  transformDefaultLabel(row) {
    if (!row) return null;
    return { id: row.id, name: row.title, color: row.color, createdAt: row.created_at };
  }

  // ==================== Default Canned Responses ====================

  async getDefaultCannedResponses() {
    try {
      const { data: rows, error } = await SupabaseService.getMany('default_canned_responses', {}, { orderBy: 'created_at', ascending: true });
      if (error) throw error;
      return (rows || []).map(this.transformDefaultCannedResponse);
    } catch (error) {
      logger.error('Failed to get default canned responses', { error: error.message });
      throw error;
    }
  }

  async getDefaultCannedResponseById(id) {
    try {
      const { data, error } = await SupabaseService.getById('default_canned_responses', id);
      if (error) { if (error.code === 'ROW_NOT_FOUND') return null; throw error; }
      return data ? this.transformDefaultCannedResponse(data) : null;
    } catch (error) {
      logger.error('Failed to get default canned response', { id, error: error.message });
      throw error;
    }
  }

  async createDefaultCannedResponse(data) {
    const { shortcut, content } = data;
    if (!shortcut || !shortcut.trim()) throw new Error('Shortcut is required');
    if (!content || !content.trim()) throw new Error('Content is required');
    try {
      const { data: created, error } = await SupabaseService.insert('default_canned_responses', { short_code: shortcut.trim(), content: content.trim() });
      if (error) throw error;
      logger.info('Default canned response created', { id: created.id, shortcut });
      return this.transformDefaultCannedResponse(created);
    } catch (error) {
      logger.error('Failed to create default canned response', { error: error.message });
      throw error;
    }
  }


  async updateDefaultCannedResponse(id, data) {
    const response = await this.getDefaultCannedResponseById(id);
    if (!response) throw new Error('Default canned response not found');
    const updates = {};
    if (data.shortcut !== undefined) { if (!data.shortcut || !data.shortcut.trim()) throw new Error('Shortcut is required'); updates.short_code = data.shortcut.trim(); }
    if (data.content !== undefined) { if (!data.content || !data.content.trim()) throw new Error('Content is required'); updates.content = data.content.trim(); }
    if (Object.keys(updates).length === 0) return response;
    try {
      const { data: updated, error } = await SupabaseService.update('default_canned_responses', id, updates);
      if (error) throw error;
      logger.info('Default canned response updated', { id });
      return this.transformDefaultCannedResponse(updated);
    } catch (error) {
      logger.error('Failed to update default canned response', { id, error: error.message });
      throw error;
    }
  }

  async deleteDefaultCannedResponse(id) {
    const response = await this.getDefaultCannedResponseById(id);
    if (!response) throw new Error('Default canned response not found');
    try {
      const { error } = await SupabaseService.delete('default_canned_responses', id);
      if (error) throw error;
      logger.info('Default canned response deleted', { id });
    } catch (error) {
      logger.error('Failed to delete default canned response', { id, error: error.message });
      throw error;
    }
  }

  transformDefaultCannedResponse(row) {
    if (!row) return null;
    return { id: row.id, shortcut: row.short_code, content: row.content, createdAt: row.created_at };
  }

  // ==================== Automation Application ====================

  async applyAutomationsToNewUser(userId, auditLogService) {
    const results = { bot: { applied: false, error: null }, labels: { applied: false, count: 0, error: null }, cannedResponses: { applied: false, count: 0, error: null }, webhooks: { applied: false, error: null } };
    try {
      const settings = await this.getGlobalSettings();
      if (settings.automationsEnabled.bot && settings.defaultBotTemplateId) {
        try {
          const template = await this.getBotTemplateById(settings.defaultBotTemplateId);
          if (template) { await this.createBotForUser(userId, template); results.bot.applied = true; }
        } catch (error) { results.bot.error = error.message; logger.error('Failed to apply default bot', { userId, error: error.message }); }
      }
      if (settings.automationsEnabled.labels) {
        try {
          const defaultLabels = await this.getDefaultLabels();
          for (const label of defaultLabels) { await this.createLabelForUser(userId, label); results.labels.count++; }
          if (defaultLabels.length > 0) results.labels.applied = true;
        } catch (error) { results.labels.error = error.message; logger.error('Failed to apply default labels', { userId, error: error.message }); }
      }
      if (settings.automationsEnabled.cannedResponses) {
        try {
          const defaultResponses = await this.getDefaultCannedResponses();
          for (const response of defaultResponses) { await this.createCannedResponseForUser(userId, response); results.cannedResponses.count++; }
          if (defaultResponses.length > 0) results.cannedResponses.applied = true;
        } catch (error) { results.cannedResponses.error = error.message; logger.error('Failed to apply default canned responses', { userId, error: error.message }); }
      }
      if (settings.automationsEnabled.webhooks && settings.defaultWebhookUrl) {
        try { await this.createWebhookForUser(userId, settings.defaultWebhookUrl, settings.defaultWebhookEvents); results.webhooks.applied = true; }
        catch (error) { results.webhooks.error = error.message; logger.error('Failed to apply default webhook', { userId, error: error.message }); }
      }
      logger.info('Automations applied to new user', { userId, results });
      return results;
    } catch (error) {
      logger.error('Failed to apply automations to new user', { userId, error: error.message });
      throw error;
    }
  }

  async createBotForUser(userId, template) {
    try {
      await SupabaseService.insert('agent_bots', {
        account_id: userId, name: template.name, description: template.description,
        outgoing_url: template.outgoingUrl, bot_type: template.botType || 'webhook',
        bot_config: template.defaultConfig || {}, include_history: template.includeHistory, status: 'active'
      });
      logger.info('Bot created for user from template', { userId, templateId: template.id });
    } catch (error) { logger.error('Failed to create bot for user', { userId, error: error.message }); throw error; }
  }

  async createLabelForUser(userId, defaultLabel) {
    try {
      await SupabaseService.insert('labels', { account_id: userId, title: defaultLabel.name, color: defaultLabel.color });
    } catch (error) { logger.error('Failed to create label for user', { userId, error: error.message }); throw error; }
  }

  async createCannedResponseForUser(userId, defaultResponse) {
    try {
      await SupabaseService.insert('canned_responses', { account_id: userId, short_code: defaultResponse.shortcut, content: defaultResponse.content });
    } catch (error) { logger.error('Failed to create canned response for user', { userId, error: error.message }); throw error; }
  }


  async createWebhookForUser(userId, webhookUrl, events) {
    try {
      const { data: existingWebhooks } = await SupabaseService.getMany('outgoing_webhooks', { account_id: userId });
      if (existingWebhooks && existingWebhooks.length > 0) { logger.info('User already has webhook configured, skipping', { userId }); return; }
      await SupabaseService.insert('outgoing_webhooks', { account_id: userId, name: 'Default Webhook', url: webhookUrl, events: events || [], status: 'active' });
      logger.info('Webhook created for user from default settings', { userId, webhookUrl, events });
    } catch (error) { logger.error('Failed to create webhook for user', { userId, error: error.message }); throw error; }
  }

  async applyAutomationsToExistingUsers(userIds, automationTypes, auditLogService) {
    const result = { totalUsers: userIds.length, successCount: 0, failureCount: 0, failures: [] };
    for (const userId of userIds) {
      try {
        const userResult = await this.applyAutomationsToNewUser(userId, auditLogService);
        const anyApplied = userResult.bot.applied || userResult.labels.applied || userResult.cannedResponses.applied || userResult.webhooks.applied;
        if (anyApplied) result.successCount++; else { result.failureCount++; result.failures.push({ userId, error: 'No automations applied' }); }
      } catch (error) { result.failureCount++; result.failures.push({ userId, error: error.message }); }
    }
    logger.info('Bulk automation applied', { totalUsers: result.totalUsers, successCount: result.successCount, failureCount: result.failureCount });
    return result;
  }

  // ==================== Export/Import ====================

  async exportConfiguration() {
    try {
      return {
        version: '1.0.0', exportedAt: new Date().toISOString(),
        globalSettings: await this.getGlobalSettings(),
        botTemplates: await this.getBotTemplates(),
        defaultLabels: await this.getDefaultLabels(),
        defaultCannedResponses: await this.getDefaultCannedResponses()
      };
    } catch (error) { logger.error('Failed to export configuration', { error: error.message }); throw error; }
  }

  validateConfiguration(config) {
    const errors = [];
    if (!config || typeof config !== 'object') return { valid: false, errors: ['Invalid configuration format'] };
    if (!config.version) errors.push('Missing version field');
    if (config.botTemplates && Array.isArray(config.botTemplates)) {
      config.botTemplates.forEach((t, i) => {
        if (!t.name) errors.push(`Bot template ${i + 1}: name is required`);
        if (!t.outgoingUrl) errors.push(`Bot template ${i + 1}: outgoingUrl is required`);
        else { try { new URL(t.outgoingUrl); } catch { errors.push(`Bot template ${i + 1}: invalid outgoingUrl format`); } }
      });
    }
    if (config.defaultLabels && Array.isArray(config.defaultLabels)) {
      config.defaultLabels.forEach((l, i) => { if (!l.name) errors.push(`Default label ${i + 1}: name is required`); if (!l.color) errors.push(`Default label ${i + 1}: color is required`); });
    }
    if (config.defaultCannedResponses && Array.isArray(config.defaultCannedResponses)) {
      config.defaultCannedResponses.forEach((r, i) => { if (!r.shortcut) errors.push(`Default canned response ${i + 1}: shortcut is required`); if (!r.content) errors.push(`Default canned response ${i + 1}: content is required`); });
    }
    return { valid: errors.length === 0, errors };
  }


  async importConfiguration(config) {
    const validation = this.validateConfiguration(config);
    if (!validation.valid) throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    const result = { globalSettings: false, botTemplates: { imported: 0, skipped: 0 }, defaultLabels: { imported: 0, skipped: 0 }, defaultCannedResponses: { imported: 0, skipped: 0 } };
    try {
      if (config.globalSettings) { await this.updateGlobalSettings(config.globalSettings); result.globalSettings = true; }
      if (config.botTemplates && Array.isArray(config.botTemplates)) {
        for (const t of config.botTemplates) {
          try { await this.createBotTemplate({ name: t.name, description: t.description, outgoingUrl: t.outgoingUrl, includeHistory: t.includeHistory }); result.botTemplates.imported++; }
          catch { result.botTemplates.skipped++; }
        }
      }
      if (config.defaultLabels && Array.isArray(config.defaultLabels)) {
        for (const l of config.defaultLabels) {
          try { await this.createDefaultLabel({ name: l.name, color: l.color }); result.defaultLabels.imported++; }
          catch { result.defaultLabels.skipped++; }
        }
      }
      if (config.defaultCannedResponses && Array.isArray(config.defaultCannedResponses)) {
        for (const r of config.defaultCannedResponses) {
          try { await this.createDefaultCannedResponse({ shortcut: r.shortcut, content: r.content }); result.defaultCannedResponses.imported++; }
          catch { result.defaultCannedResponses.skipped++; }
        }
      }
      logger.info('Configuration imported', { result });
      return result;
    } catch (error) { logger.error('Failed to import configuration', { error: error.message }); throw error; }
  }
}

module.exports = AutomationService;
