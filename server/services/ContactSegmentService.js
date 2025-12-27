/**
 * ContactSegmentService - Service for managing dynamic contact segments
 * 
 * Handles segment creation, evaluation, membership management, and templates.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Pre-built segment templates
const SEGMENT_TEMPLATES = [
  {
    key: 'inactive',
    name: 'Contatos Inativos',
    description: 'Contatos sem interação nos últimos 30 dias',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'is_active', operator: 'equals', value: false }
      ]
    }
  },
  {
    key: 'high_value',
    name: 'Clientes de Alto Valor',
    description: 'Contatos com LTV acima de R$ 1.000',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'lifetime_value_cents', operator: 'greater_than', value: 100000 }
      ]
    }
  },
  {
    key: 'new_leads',
    name: 'Novos Leads',
    description: 'Contatos criados nos últimos 7 dias',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'created_at', operator: 'greater_than', value: '{{7_days_ago}}' }
      ]
    }
  },
  {
    key: 'vip',
    name: 'Clientes VIP',
    description: 'Contatos com lead score VIP',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'lead_tier', operator: 'equals', value: 'vip' }
      ]
    }
  },
  {
    key: 'opted_out',
    name: 'Opt-Out',
    description: 'Contatos que optaram por não receber mensagens',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'bulk_messaging_opt_in', operator: 'equals', value: false }
      ]
    }
  },
  {
    key: 'with_credits',
    name: 'Com Créditos',
    description: 'Contatos com saldo de créditos positivo',
    conditions: {
      logic: 'AND',
      conditions: [
        { field: 'credit_balance', operator: 'greater_than', value: 0 }
      ]
    }
  }
];

class ContactSegmentService {
  /**
   * Create a new segment
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {string} name - Segment name
   * @param {Object} conditions - Segment conditions
   * @param {string} description - Optional description
   * @returns {Promise<Object>} Created segment
   */
  async createSegment(accountId, tenantId, name, conditions, description = null) {
    try {
      // Validate conditions structure
      this.validateConditions(conditions);

      const segmentData = {
        tenant_id: tenantId,
        account_id: accountId,
        name,
        description,
        conditions,
        is_template: false,
        member_count: 0
      };

      const { data, error } = await supabaseService.insert('contact_segments', segmentData);

      if (error) throw error;

      // Evaluate segment to populate members
      await this.evaluateSegment(data.id);

      logger.info('Segment created', { segmentId: data.id, accountId, name });

      return data;
    } catch (error) {
      logger.error('Failed to create segment', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Validate segment conditions structure
   * @param {Object} conditions - Conditions to validate
   */
  validateConditions(conditions) {
    if (!conditions || typeof conditions !== 'object') {
      throw new Error('INVALID_CONDITIONS');
    }

    if (!['AND', 'OR'].includes(conditions.logic)) {
      throw new Error('INVALID_LOGIC_OPERATOR');
    }

    if (!Array.isArray(conditions.conditions) || conditions.conditions.length === 0) {
      throw new Error('EMPTY_CONDITIONS');
    }

    for (const condition of conditions.conditions) {
      // Nested group
      if (condition.logic) {
        this.validateConditions(condition);
        continue;
      }

      // Simple condition
      if (!condition.field || !condition.operator) {
        throw new Error('INVALID_CONDITION_STRUCTURE');
      }

      const validOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in', 'not_in'];
      if (!validOperators.includes(condition.operator)) {
        throw new Error('INVALID_OPERATOR');
      }
    }
  }

  /**
   * Evaluate a segment and update membership
   * @param {string} segmentId - Segment UUID
   * @returns {Promise<{memberCount: number}>}
   */
  async evaluateSegment(segmentId) {
    try {
      // Get segment
      const segmentQueryFn = (query) => query
        .select('*')
        .eq('id', segmentId)
        .single();

      const { data: segment, error } = await supabaseService.queryAsAdmin('contact_segments', segmentQueryFn);

      if (error || !segment) {
        throw new Error('SEGMENT_NOT_FOUND');
      }

      // Build and execute query based on conditions
      const matchingContactIds = await this.findMatchingContacts(segment.account_id, segment.conditions);

      // Clear existing members
      const clearQueryFn = (query) => query
        .delete()
        .eq('segment_id', segmentId);

      await supabaseService.queryAsAdmin('contact_segment_members', clearQueryFn);

      // Add new members in batches
      const BATCH_SIZE = 100;
      for (let i = 0; i < matchingContactIds.length; i += BATCH_SIZE) {
        const batch = matchingContactIds.slice(i, i + BATCH_SIZE);
        const members = batch.map(contactId => ({
          segment_id: segmentId,
          contact_id: contactId
        }));

        if (members.length > 0) {
          const insertQueryFn = (query) => query.insert(members);
          await supabaseService.queryAsAdmin('contact_segment_members', insertQueryFn);
        }
      }

      // Update segment member count
      await supabaseService.update('contact_segments', segmentId, {
        member_count: matchingContactIds.length,
        last_evaluated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      logger.info('Segment evaluated', { segmentId, memberCount: matchingContactIds.length });

      return { memberCount: matchingContactIds.length };
    } catch (error) {
      logger.error('Failed to evaluate segment', { error: error.message, segmentId });
      throw error;
    }
  }

  /**
   * Find contacts matching conditions
   * @param {string} accountId - Account UUID
   * @param {Object} conditions - Segment conditions
   * @returns {Promise<string[]>} Matching contact IDs
   */
  async findMatchingContacts(accountId, conditions) {
    try {
      // Get all contacts for account
      const queryFn = (query) => query
        .select('id, lead_score, lead_tier, lifetime_value_cents, purchase_count, credit_balance, last_interaction_at, is_active, bulk_messaging_opt_in, custom_fields, created_at')
        .eq('account_id', accountId);

      const { data: contacts, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      // Filter contacts based on conditions
      const matchingIds = [];

      for (const contact of contacts || []) {
        if (this.evaluateConditions(contact, conditions)) {
          matchingIds.push(contact.id);
        }
      }

      return matchingIds;
    } catch (error) {
      logger.error('Failed to find matching contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Evaluate conditions against a contact
   * @param {Object} contact - Contact data
   * @param {Object} conditions - Conditions to evaluate
   * @returns {boolean}
   */
  evaluateConditions(contact, conditions) {
    const results = conditions.conditions.map(condition => {
      // Nested group
      if (condition.logic) {
        return this.evaluateConditions(contact, condition);
      }

      // Simple condition
      return this.evaluateSingleCondition(contact, condition);
    });

    if (conditions.logic === 'AND') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Evaluate a single condition against a contact
   * @param {Object} contact - Contact data
   * @param {Object} condition - Single condition
   * @returns {boolean}
   */
  evaluateSingleCondition(contact, condition) {
    let fieldValue;

    // Handle custom fields
    if (condition.field.startsWith('custom_fields.')) {
      const customFieldName = condition.field.replace('custom_fields.', '');
      fieldValue = contact.custom_fields?.[customFieldName];
    } else {
      fieldValue = contact[condition.field];
    }

    let conditionValue = condition.value;

    // Handle dynamic values
    if (typeof conditionValue === 'string') {
      if (conditionValue === '{{7_days_ago}}') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        conditionValue = date.toISOString();
      } else if (conditionValue === '{{30_days_ago}}') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        conditionValue = date.toISOString();
      }
    }

    switch (condition.operator) {
      case 'equals':
        return fieldValue === conditionValue;

      case 'not_equals':
        return fieldValue !== conditionValue;

      case 'greater_than':
        if (fieldValue === null || fieldValue === undefined) return false;
        return fieldValue > conditionValue;

      case 'less_than':
        if (fieldValue === null || fieldValue === undefined) return false;
        return fieldValue < conditionValue;

      case 'contains':
        if (typeof fieldValue !== 'string') return false;
        return fieldValue.toLowerCase().includes(String(conditionValue).toLowerCase());

      case 'in':
        if (!Array.isArray(conditionValue)) return false;
        return conditionValue.includes(fieldValue);

      case 'not_in':
        if (!Array.isArray(conditionValue)) return true;
        return !conditionValue.includes(fieldValue);

      default:
        return false;
    }
  }

  /**
   * Get segment members
   * @param {string} segmentId - Segment UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async getSegmentMembers(segmentId, options = {}) {
    try {
      const { page = 1, pageSize = 50 } = options;
      const offset = (page - 1) * pageSize;

      // Get member contact IDs
      const memberQueryFn = (query) => query
        .select('contact_id', { count: 'exact' })
        .eq('segment_id', segmentId)
        .range(offset, offset + pageSize - 1);

      const { data: members, count, error } = await supabaseService.queryAsAdmin(
        'contact_segment_members', 
        memberQueryFn
      );

      if (error) throw error;

      if (!members || members.length === 0) {
        return { data: [], total: count || 0, page, pageSize };
      }

      // Get contact details
      const contactIds = members.map(m => m.contact_id);
      const contactQueryFn = (query) => query
        .select('id, name, phone, lead_score, lead_tier, lifetime_value_cents')
        .in('id', contactIds);

      const { data: contacts } = await supabaseService.queryAsAdmin('contacts', contactQueryFn);

      return {
        data: contacts || [],
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to get segment members', { error: error.message, segmentId });
      throw error;
    }
  }

  /**
   * Update segment membership for a contact (called when contact changes)
   * @param {string} contactId - Contact UUID
   * @returns {Promise<void>}
   */
  async updateContactSegments(contactId) {
    try {
      // Get contact and its account
      const contactQueryFn = (query) => query
        .select('*')
        .eq('id', contactId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', contactQueryFn);

      if (error || !contact) {
        return;
      }

      // Get all segments for account
      const segmentQueryFn = (query) => query
        .select('id, conditions')
        .eq('account_id', contact.account_id);

      const { data: segments } = await supabaseService.queryAsAdmin('contact_segments', segmentQueryFn);

      for (const segment of segments || []) {
        const matches = this.evaluateConditions(contact, segment.conditions);

        // Check current membership
        const memberQueryFn = (query) => query
          .select('id')
          .eq('segment_id', segment.id)
          .eq('contact_id', contactId)
          .single();

        const { data: existingMember } = await supabaseService.queryAsAdmin(
          'contact_segment_members', 
          memberQueryFn
        );

        if (matches && !existingMember) {
          // Add to segment
          await supabaseService.insert('contact_segment_members', {
            segment_id: segment.id,
            contact_id: contactId
          });
        } else if (!matches && existingMember) {
          // Remove from segment
          const deleteQueryFn = (query) => query
            .delete()
            .eq('id', existingMember.id);

          await supabaseService.queryAsAdmin('contact_segment_members', deleteQueryFn);
        }
      }
    } catch (error) {
      logger.warn('Failed to update contact segments', { error: error.message, contactId });
    }
  }

  /**
   * Get all segments for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object[]>}
   */
  async getSegments(accountId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      const { data, error } = await supabaseService.queryAsAdmin('contact_segments', queryFn);

      if (error) throw error;

      return data || [];
    } catch (error) {
      logger.error('Failed to get segments', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a segment
   * @param {string} segmentId - Segment UUID
   * @param {string} accountId - Account UUID (for verification)
   * @param {Object} updates - Update data
   * @returns {Promise<Object>}
   */
  async updateSegment(segmentId, accountId, updates) {
    try {
      // Verify segment belongs to account
      const queryFn = (query) => query
        .select('id')
        .eq('id', segmentId)
        .eq('account_id', accountId)
        .single();

      const { data: existing, error: fetchError } = await supabaseService.queryAsAdmin(
        'contact_segments', 
        queryFn
      );

      if (fetchError || !existing) {
        throw new Error('SEGMENT_NOT_FOUND');
      }

      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.conditions !== undefined) {
        this.validateConditions(updates.conditions);
        updateData.conditions = updates.conditions;
      }

      const { data, error } = await supabaseService.update('contact_segments', segmentId, updateData);

      if (error) throw error;

      // Re-evaluate if conditions changed
      if (updates.conditions) {
        await this.evaluateSegment(segmentId);
      }

      logger.info('Segment updated', { segmentId, accountId });

      return data;
    } catch (error) {
      logger.error('Failed to update segment', { error: error.message, segmentId });
      throw error;
    }
  }

  /**
   * Delete a segment
   * @param {string} segmentId - Segment UUID
   * @param {string} accountId - Account UUID (for verification)
   * @returns {Promise<void>}
   */
  async deleteSegment(segmentId, accountId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('id', segmentId)
        .eq('account_id', accountId);

      const { error } = await supabaseService.queryAsAdmin('contact_segments', queryFn);

      if (error) throw error;

      logger.info('Segment deleted', { segmentId, accountId });
    } catch (error) {
      logger.error('Failed to delete segment', { error: error.message, segmentId });
      throw error;
    }
  }

  /**
   * Get pre-built segment templates
   * @returns {Object[]}
   */
  getPrebuiltTemplates() {
    return SEGMENT_TEMPLATES;
  }

  /**
   * Create segment from template
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {string} templateKey - Template key
   * @returns {Promise<Object>}
   */
  async createFromTemplate(accountId, tenantId, templateKey) {
    const template = SEGMENT_TEMPLATES.find(t => t.key === templateKey);

    if (!template) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }

    return this.createSegment(
      accountId, 
      tenantId, 
      template.name, 
      template.conditions, 
      template.description
    );
  }

  /**
   * Preview segment (evaluate without saving)
   * @param {string} accountId - Account UUID
   * @param {Object} conditions - Conditions to preview
   * @returns {Promise<{count: number, sample: Object[]}>}
   */
  async previewSegment(accountId, conditions) {
    try {
      this.validateConditions(conditions);

      const matchingIds = await this.findMatchingContacts(accountId, conditions);

      // Get sample contacts
      const sampleIds = matchingIds.slice(0, 10);
      let sample = [];

      if (sampleIds.length > 0) {
        const queryFn = (query) => query
          .select('id, name, phone, lead_score, lead_tier')
          .in('id', sampleIds);

        const { data } = await supabaseService.queryAsAdmin('contacts', queryFn);
        sample = data || [];
      }

      return {
        count: matchingIds.length,
        sample
      };
    } catch (error) {
      logger.error('Failed to preview segment', { error: error.message, accountId });
      throw error;
    }
  }
}

module.exports = new ContactSegmentService();
module.exports.ContactSegmentService = ContactSegmentService;
module.exports.SEGMENT_TEMPLATES = SEGMENT_TEMPLATES;
