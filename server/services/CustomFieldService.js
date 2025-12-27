/**
 * CustomFieldService - Service for managing custom field definitions and values
 * 
 * Handles custom field creation, validation, and contact field management.
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.5 (Contact CRM Evolution)
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Valid field types
const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox', 'url', 'email', 'phone'];

class CustomFieldService {
  /**
   * Create a custom field definition
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} fieldData - Field definition data
   * @returns {Promise<Object>} Created field definition
   */
  async createFieldDefinition(accountId, tenantId, fieldData) {
    try {
      // Validate field type
      if (!FIELD_TYPES.includes(fieldData.fieldType)) {
        throw new Error('INVALID_FIELD_TYPE');
      }

      // Validate name format (alphanumeric and underscore only)
      if (!/^[a-z][a-z0-9_]*$/.test(fieldData.name)) {
        throw new Error('INVALID_FIELD_NAME');
      }

      // Check for duplicate name
      const existingQueryFn = (query) => query
        .select('id')
        .eq('account_id', accountId)
        .eq('name', fieldData.name)
        .single();

      const { data: existing } = await supabaseService.queryAsAdmin(
        'custom_field_definitions', 
        existingQueryFn
      );

      if (existing) {
        throw new Error('FIELD_NAME_EXISTS');
      }

      // Get max display order
      const orderQueryFn = (query) => query
        .select('display_order')
        .eq('account_id', accountId)
        .order('display_order', { ascending: false })
        .limit(1);

      const { data: maxOrderData } = await supabaseService.queryAsAdmin(
        'custom_field_definitions', 
        orderQueryFn
      );

      const nextOrder = (maxOrderData?.[0]?.display_order || 0) + 1;

      // Create field definition
      const definition = {
        tenant_id: tenantId,
        account_id: accountId,
        name: fieldData.name,
        label: fieldData.label,
        field_type: fieldData.fieldType,
        options: fieldData.options || null,
        is_required: fieldData.isRequired || false,
        is_searchable: fieldData.isSearchable !== false,
        display_order: fieldData.displayOrder ?? nextOrder,
        default_value: fieldData.defaultValue || null,
        validation_rules: fieldData.validationRules || null
      };

      const { data, error } = await supabaseService.insert('custom_field_definitions', definition);

      if (error) throw error;

      logger.info('Custom field created', { 
        fieldId: data.id, 
        accountId, 
        name: fieldData.name 
      });

      return this.formatFieldDefinition(data);
    } catch (error) {
      logger.error('Failed to create custom field', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get all field definitions for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object[]>}
   */
  async getFieldDefinitions(accountId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .order('display_order', { ascending: true });

      const { data, error } = await supabaseService.queryAsAdmin('custom_field_definitions', queryFn);

      if (error) throw error;

      return (data || []).map(f => this.formatFieldDefinition(f));
    } catch (error) {
      logger.error('Failed to get field definitions', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a field definition
   * @param {string} fieldId - Field definition UUID
   * @param {string} accountId - Account UUID (for verification)
   * @param {Object} updates - Update data
   * @returns {Promise<Object>}
   */
  async updateFieldDefinition(fieldId, accountId, updates) {
    try {
      // Verify field belongs to account
      const queryFn = (query) => query
        .select('*')
        .eq('id', fieldId)
        .eq('account_id', accountId)
        .single();

      const { data: existing, error: fetchError } = await supabaseService.queryAsAdmin(
        'custom_field_definitions', 
        queryFn
      );

      if (fetchError || !existing) {
        throw new Error('FIELD_NOT_FOUND');
      }

      // Build update object
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (updates.label !== undefined) updateData.label = updates.label;
      if (updates.options !== undefined) updateData.options = updates.options;
      if (updates.isRequired !== undefined) updateData.is_required = updates.isRequired;
      if (updates.isSearchable !== undefined) updateData.is_searchable = updates.isSearchable;
      if (updates.displayOrder !== undefined) updateData.display_order = updates.displayOrder;
      if (updates.defaultValue !== undefined) updateData.default_value = updates.defaultValue;
      if (updates.validationRules !== undefined) updateData.validation_rules = updates.validationRules;

      const { data, error } = await supabaseService.update('custom_field_definitions', fieldId, updateData);

      if (error) throw error;

      logger.info('Custom field updated', { fieldId, accountId });

      return this.formatFieldDefinition(data);
    } catch (error) {
      logger.error('Failed to update custom field', { error: error.message, fieldId });
      throw error;
    }
  }

  /**
   * Delete a field definition
   * @param {string} fieldId - Field definition UUID
   * @param {string} accountId - Account UUID (for verification)
   * @returns {Promise<void>}
   */
  async deleteFieldDefinition(fieldId, accountId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('id', fieldId)
        .eq('account_id', accountId);

      const { error } = await supabaseService.queryAsAdmin('custom_field_definitions', queryFn);

      if (error) throw error;

      logger.info('Custom field deleted', { fieldId, accountId });
    } catch (error) {
      logger.error('Failed to delete custom field', { error: error.message, fieldId });
      throw error;
    }
  }

  /**
   * Validate a field value against its definition
   * @param {Object} fieldDef - Field definition
   * @param {any} value - Value to validate
   * @returns {{valid: boolean, error: string|null}}
   */
  validateFieldValue(fieldDef, value) {
    // Check required
    if (fieldDef.is_required && (value === null || value === undefined || value === '')) {
      return { valid: false, error: `${fieldDef.label} is required` };
    }

    // Skip validation for empty non-required fields
    if (value === null || value === undefined || value === '') {
      return { valid: true, error: null };
    }

    // Type-specific validation
    switch (fieldDef.field_type) {
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return { valid: false, error: `${fieldDef.label} must be a number` };
        }
        // Check min/max from validation rules
        if (fieldDef.validation_rules) {
          const num = Number(value);
          if (fieldDef.validation_rules.min !== undefined && num < fieldDef.validation_rules.min) {
            return { valid: false, error: `${fieldDef.label} must be at least ${fieldDef.validation_rules.min}` };
          }
          if (fieldDef.validation_rules.max !== undefined && num > fieldDef.validation_rules.max) {
            return { valid: false, error: `${fieldDef.label} must be at most ${fieldDef.validation_rules.max}` };
          }
        }
        break;

      case 'date':
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return { valid: false, error: `${fieldDef.label} must be a valid date` };
        }
        break;

      case 'dropdown':
        if (fieldDef.options && !fieldDef.options.includes(value)) {
          return { valid: false, error: `${fieldDef.label} must be one of: ${fieldDef.options.join(', ')}` };
        }
        break;

      case 'checkbox':
        if (typeof value !== 'boolean') {
          return { valid: false, error: `${fieldDef.label} must be true or false` };
        }
        break;

      case 'url':
        try {
          new URL(value);
        } catch {
          return { valid: false, error: `${fieldDef.label} must be a valid URL` };
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { valid: false, error: `${fieldDef.label} must be a valid email` };
        }
        break;

      case 'phone':
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value)) {
          return { valid: false, error: `${fieldDef.label} must be a valid phone number` };
        }
        break;

      case 'text':
        // Check pattern from validation rules
        if (fieldDef.validation_rules?.pattern) {
          const regex = new RegExp(fieldDef.validation_rules.pattern);
          if (!regex.test(value)) {
            return { valid: false, error: `${fieldDef.label} format is invalid` };
          }
        }
        break;
    }

    return { valid: true, error: null };
  }

  /**
   * Set a custom field value for a contact
   * @param {string} contactId - Contact UUID
   * @param {string} fieldName - Field name
   * @param {any} value - Field value
   * @returns {Promise<Object>} Updated custom_fields
   */
  async setContactCustomField(contactId, fieldName, value) {
    try {
      // Get contact and its account
      const contactQueryFn = (query) => query
        .select('id, account_id, custom_fields')
        .eq('id', contactId)
        .single();

      const { data: contact, error: contactError } = await supabaseService.queryAsAdmin(
        'contacts', 
        contactQueryFn
      );

      if (contactError || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Get field definition
      const fieldQueryFn = (query) => query
        .select('*')
        .eq('account_id', contact.account_id)
        .eq('name', fieldName)
        .single();

      const { data: fieldDef, error: fieldError } = await supabaseService.queryAsAdmin(
        'custom_field_definitions', 
        fieldQueryFn
      );

      if (fieldError || !fieldDef) {
        throw new Error('FIELD_NOT_FOUND');
      }

      // Validate value
      const validation = this.validateFieldValue(fieldDef, value);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Update custom_fields JSONB
      const customFields = contact.custom_fields || {};
      customFields[fieldName] = value;

      await supabaseService.update('contacts', contactId, {
        custom_fields: customFields,
        updated_at: new Date().toISOString()
      });

      logger.info('Custom field value set', { contactId, fieldName });

      return customFields;
    } catch (error) {
      logger.error('Failed to set custom field value', { error: error.message, contactId, fieldName });
      throw error;
    }
  }

  /**
   * Set multiple custom field values for a contact
   * @param {string} contactId - Contact UUID
   * @param {Object} fields - Object with field names and values
   * @returns {Promise<Object>} Updated custom_fields
   */
  async setContactCustomFields(contactId, fields) {
    try {
      // Get contact and its account
      const contactQueryFn = (query) => query
        .select('id, account_id, custom_fields')
        .eq('id', contactId)
        .single();

      const { data: contact, error: contactError } = await supabaseService.queryAsAdmin(
        'contacts', 
        contactQueryFn
      );

      if (contactError || !contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Get all field definitions for account
      const fieldDefs = await this.getFieldDefinitions(contact.account_id);
      const fieldDefMap = new Map(fieldDefs.map(f => [f.name, f]));

      // Validate all fields
      const errors = [];
      for (const [fieldName, value] of Object.entries(fields)) {
        const fieldDef = fieldDefMap.get(fieldName);
        if (!fieldDef) {
          errors.push(`Unknown field: ${fieldName}`);
          continue;
        }

        const validation = this.validateFieldValue(fieldDef, value);
        if (!validation.valid) {
          errors.push(validation.error);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join('; '));
      }

      // Update custom_fields JSONB
      const customFields = { ...(contact.custom_fields || {}), ...fields };

      await supabaseService.update('contacts', contactId, {
        custom_fields: customFields,
        updated_at: new Date().toISOString()
      });

      logger.info('Custom fields updated', { contactId, fieldCount: Object.keys(fields).length });

      return customFields;
    } catch (error) {
      logger.error('Failed to set custom fields', { error: error.message, contactId });
      throw error;
    }
  }

  /**
   * Search contacts by custom field value
   * @param {string} accountId - Account UUID
   * @param {string} fieldName - Field name
   * @param {any} value - Value to search for
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number}>}
   */
  async searchByCustomField(accountId, fieldName, value, options = {}) {
    try {
      const { page = 1, pageSize = 50 } = options;
      const offset = (page - 1) * pageSize;

      // Build JSONB query
      const searchObj = {};
      searchObj[fieldName] = value;

      const queryFn = (query) => query
        .select('*', { count: 'exact' })
        .eq('account_id', accountId)
        .contains('custom_fields', searchObj)
        .range(offset, offset + pageSize - 1);

      const { data, count, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) throw error;

      return {
        data: data || [],
        total: count || 0,
        page,
        pageSize
      };
    } catch (error) {
      logger.error('Failed to search by custom field', { error: error.message, accountId, fieldName });
      throw error;
    }
  }

  /**
   * Reorder field definitions
   * @param {string} accountId - Account UUID
   * @param {Object[]} orderUpdates - Array of { id, displayOrder }
   * @returns {Promise<void>}
   */
  async reorderFields(accountId, orderUpdates) {
    try {
      for (const update of orderUpdates) {
        await supabaseService.update('custom_field_definitions', update.id, {
          display_order: update.displayOrder,
          updated_at: new Date().toISOString()
        });
      }

      logger.info('Custom fields reordered', { accountId, count: orderUpdates.length });
    } catch (error) {
      logger.error('Failed to reorder fields', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Format field definition for API response
   * @param {Object} field - Raw field definition
   * @returns {Object}
   */
  formatFieldDefinition(field) {
    return {
      id: field.id,
      name: field.name,
      label: field.label,
      fieldType: field.field_type,
      options: field.options,
      isRequired: field.is_required,
      isSearchable: field.is_searchable,
      displayOrder: field.display_order,
      defaultValue: field.default_value,
      validationRules: field.validation_rules,
      createdAt: field.created_at,
      updatedAt: field.updated_at
    };
  }
}

module.exports = new CustomFieldService();
module.exports.CustomFieldService = CustomFieldService;
module.exports.FIELD_TYPES = FIELD_TYPES;
