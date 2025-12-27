/**
 * Appointment Service Type Service
 * 
 * Business logic for managing service types (e.g., consultation, meeting).
 * 
 * Requirements: 3.1 (CRM Contact Calendar)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AppointmentServiceTypeService {
  /**
   * Get all services for an account
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @param {boolean} options.activeOnly - Only return active services
   * @returns {Promise<Array>}
   */
  async getServices(accountId, tenantId, options = {}) {
    try {
      const { activeOnly = false } = options;

      let query = SupabaseService.adminClient
        .from('appointment_services')
        .select('*')
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .order('name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching services', { error: error.message });
        throw new Error('Erro ao buscar serviços');
      }

      return data || [];
    } catch (error) {
      logger.error('AppointmentServiceTypeService.getServices error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single service by ID
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<Object|null>}
   */
  async getServiceById(accountId, tenantId, serviceId) {
    try {
      const { data, error } = await SupabaseService.adminClient
        .from('appointment_services')
        .select('*')
        .eq('id', serviceId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching service', { error: error.message, serviceId });
        throw new Error('Erro ao buscar serviço');
      }

      return data;
    } catch (error) {
      logger.error('AppointmentServiceTypeService.getServiceById error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new service
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} data - Service data
   * @returns {Promise<Object>}
   */
  async createService(accountId, tenantId, data) {
    try {
      const serviceData = {
        account_id: accountId,
        tenant_id: tenantId,
        name: data.name,
        description: data.description || null,
        default_duration_minutes: data.defaultDurationMinutes || 60,
        default_price_cents: data.defaultPriceCents || 0,
        color: data.color || '#3b82f6',
        is_active: true
      };

      const { data: service, error } = await SupabaseService.adminClient
        .from('appointment_services')
        .insert(serviceData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating service', { error: error.message });
        throw new Error('Erro ao criar serviço');
      }

      logger.info('Service created', { serviceId: service.id, name: data.name });
      return service;
    } catch (error) {
      logger.error('AppointmentServiceTypeService.createService error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing service
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} serviceId - Service ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async updateService(accountId, tenantId, serviceId, data) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.defaultDurationMinutes !== undefined) updateData.default_duration_minutes = data.defaultDurationMinutes;
      if (data.defaultPriceCents !== undefined) updateData.default_price_cents = data.defaultPriceCents;
      if (data.color !== undefined) updateData.color = data.color;
      if (data.isActive !== undefined) updateData.is_active = data.isActive;

      const { data: service, error } = await SupabaseService.adminClient
        .from('appointment_services')
        .update(updateData)
        .eq('id', serviceId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating service', { error: error.message, serviceId });
        throw new Error('Erro ao atualizar serviço');
      }

      logger.info('Service updated', { serviceId });
      return service;
    } catch (error) {
      logger.error('AppointmentServiceTypeService.updateService error', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a service (soft delete by setting is_active = false)
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<void>}
   */
  async deleteService(accountId, tenantId, serviceId) {
    try {
      // Soft delete - set is_active to false
      const { error } = await SupabaseService.adminClient
        .from('appointment_services')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', serviceId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Error deleting service', { error: error.message, serviceId });
        throw new Error('Erro ao excluir serviço');
      }

      logger.info('Service deleted (soft)', { serviceId });
    } catch (error) {
      logger.error('AppointmentServiceTypeService.deleteService error', { error: error.message });
      throw error;
    }
  }

  /**
   * Hard delete a service (permanent)
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} serviceId - Service ID
   * @returns {Promise<void>}
   */
  async hardDeleteService(accountId, tenantId, serviceId) {
    try {
      const { error } = await SupabaseService.adminClient
        .from('appointment_services')
        .delete()
        .eq('id', serviceId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Error hard deleting service', { error: error.message, serviceId });
        throw new Error('Erro ao excluir serviço permanentemente');
      }

      logger.info('Service hard deleted', { serviceId });
    } catch (error) {
      logger.error('AppointmentServiceTypeService.hardDeleteService error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new AppointmentServiceTypeService();
