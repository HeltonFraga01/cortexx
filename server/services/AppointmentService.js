/**
 * Appointment Service
 * 
 * Business logic for appointments, including CRUD operations,
 * slot availability checking, and recurring appointment generation.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.1 (CRM Contact Calendar)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AppointmentService {
  /**
   * Get appointments for a contact within a date range
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} contactId - Contact ID
   * @param {Object} options - Query options
   * @param {Date} options.startDate - Start of date range
   * @param {Date} options.endDate - End of date range
   * @param {string[]} options.statuses - Filter by statuses
   * @param {number} options.page - Page number
   * @param {number} options.limit - Items per page
   * @returns {Promise<{data: Array, total: number}>}
   */
  async getContactAppointments(accountId, tenantId, contactId, options = {}) {
    try {
      const { startDate, endDate, statuses, page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;

      let query = SupabaseService.adminClient
        .from('appointments')
        .select(`
          *,
          service:appointment_services(*),
          financial_record:appointment_financial_records(*)
        `, { count: 'exact' })
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('end_time', endDate.toISOString());
      }

      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching appointments', { error: error.message, contactId });
        throw new Error('Erro ao buscar agendamentos');
      }

      return {
        data: data || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('AppointmentService.getContactAppointments error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all appointments for an account within a date range
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Array, total: number}>}
   */
  async getAppointments(accountId, tenantId, options = {}) {
    try {
      const { startDate, endDate, statuses, serviceId, page = 1, limit = 50 } = options;
      const offset = (page - 1) * limit;

      let query = SupabaseService.adminClient
        .from('appointments')
        .select(`
          *,
          service:appointment_services(*),
          financial_record:appointment_financial_records(*),
          contact:contacts(id, name, phone, avatar_url)
        `, { count: 'exact' })
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: true })
        .range(offset, offset + limit - 1);

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('end_time', endDate.toISOString());
      }

      if (statuses && statuses.length > 0) {
        query = query.in('status', statuses);
      }

      if (serviceId) {
        query = query.eq('service_id', serviceId);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching appointments', { error: error.message });
        throw new Error('Erro ao buscar agendamentos');
      }

      return {
        data: data || [],
        total: count || 0
      };
    } catch (error) {
      logger.error('AppointmentService.getAppointments error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single appointment by ID
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>}
   */
  async getAppointmentById(accountId, tenantId, appointmentId) {
    try {
      const { data, error } = await SupabaseService.adminClient
        .from('appointments')
        .select(`
          *,
          service:appointment_services(*),
          financial_record:appointment_financial_records(*),
          contact:contacts(id, name, phone, avatar_url)
        `)
        .eq('id', appointmentId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching appointment', { error: error.message, appointmentId });
        throw new Error('Erro ao buscar agendamento');
      }

      return data;
    } catch (error) {
      logger.error('AppointmentService.getAppointmentById error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new appointment
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} data - Appointment data
   * @returns {Promise<Object>}
   */
  async createAppointment(accountId, tenantId, data) {
    try {
      // Check slot availability
      const isAvailable = await this.checkSlotAvailability(
        accountId,
        tenantId,
        data.startTime,
        data.endTime
      );

      if (!isAvailable) {
        throw new Error('SLOT_UNAVAILABLE');
      }

      // Create appointment
      const appointmentData = {
        account_id: accountId,
        tenant_id: tenantId,
        contact_id: data.contactId,
        service_id: data.serviceId || null,
        title: data.title,
        description: data.description || null,
        start_time: data.startTime,
        end_time: data.endTime,
        status: 'scheduled',
        price_cents: data.priceCents || 0,
        notes: data.notes || null,
        recurring_parent_id: data.recurringParentId || null,
        recurring_pattern: data.recurringPattern || null
      };

      const { data: appointment, error } = await SupabaseService.adminClient
        .from('appointments')
        .insert(appointmentData)
        .select(`
          *,
          service:appointment_services(*),
          contact:contacts(id, name, phone, avatar_url)
        `)
        .single();

      if (error) {
        logger.error('Error creating appointment', { error: error.message });
        throw new Error('Erro ao criar agendamento');
      }

      // Create financial record if price > 0
      if (data.priceCents && data.priceCents > 0) {
        await this._createFinancialRecord(accountId, tenantId, appointment.id, data.priceCents);
      }

      // Handle recurring appointments
      if (data.recurringPattern && !data.recurringParentId) {
        await this._generateRecurringAppointments(accountId, tenantId, appointment, data.recurringPattern);
      }

      logger.info('Appointment created', { appointmentId: appointment.id, contactId: data.contactId });
      return appointment;
    } catch (error) {
      logger.error('AppointmentService.createAppointment error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing appointment
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} appointmentId - Appointment ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async updateAppointment(accountId, tenantId, appointmentId, data) {
    try {
      // Check if appointment exists
      const existing = await this.getAppointmentById(accountId, tenantId, appointmentId);
      if (!existing) {
        throw new Error('APPOINTMENT_NOT_FOUND');
      }

      // If changing time, check availability
      if (data.startTime || data.endTime) {
        const startTime = data.startTime || existing.start_time;
        const endTime = data.endTime || existing.end_time;
        
        const isAvailable = await this.checkSlotAvailability(
          accountId,
          tenantId,
          startTime,
          endTime,
          appointmentId
        );

        if (!isAvailable) {
          throw new Error('SLOT_UNAVAILABLE');
        }
      }

      // Build update object
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.startTime !== undefined) updateData.start_time = data.startTime;
      if (data.endTime !== undefined) updateData.end_time = data.endTime;
      if (data.serviceId !== undefined) updateData.service_id = data.serviceId;
      if (data.priceCents !== undefined) updateData.price_cents = data.priceCents;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.cancellationReason !== undefined) updateData.cancellation_reason = data.cancellationReason;

      const { data: appointment, error } = await SupabaseService.adminClient
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          service:appointment_services(*),
          financial_record:appointment_financial_records(*),
          contact:contacts(id, name, phone, avatar_url)
        `)
        .single();

      if (error) {
        logger.error('Error updating appointment', { error: error.message, appointmentId });
        throw new Error('Erro ao atualizar agendamento');
      }

      // Update financial record if price changed
      if (data.priceCents !== undefined && data.priceCents !== existing.price_cents) {
        await this._updateFinancialRecord(accountId, tenantId, appointmentId, data.priceCents);
      }

      logger.info('Appointment updated', { appointmentId });
      return appointment;
    } catch (error) {
      logger.error('AppointmentService.updateAppointment error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update appointment status
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} appointmentId - Appointment ID
   * @param {string} status - New status
   * @param {string} reason - Cancellation reason (optional)
   * @returns {Promise<Object>}
   */
  async updateStatus(accountId, tenantId, appointmentId, status, reason = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'cancelled' && reason) {
        updateData.cancellation_reason = reason;
      }

      const { data: appointment, error } = await SupabaseService.adminClient
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .select(`
          *,
          service:appointment_services(*),
          financial_record:appointment_financial_records(*)
        `)
        .single();

      if (error) {
        logger.error('Error updating appointment status', { error: error.message, appointmentId });
        throw new Error('Erro ao atualizar status');
      }

      logger.info('Appointment status updated', { appointmentId, status });
      return appointment;
    } catch (error) {
      logger.error('AppointmentService.updateStatus error', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete an appointment
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<void>}
   */
  async deleteAppointment(accountId, tenantId, appointmentId) {
    try {
      const { error } = await SupabaseService.adminClient
        .from('appointments')
        .delete()
        .eq('id', appointmentId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Error deleting appointment', { error: error.message, appointmentId });
        throw new Error('Erro ao excluir agendamento');
      }

      logger.info('Appointment deleted', { appointmentId });
    } catch (error) {
      logger.error('AppointmentService.deleteAppointment error', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a time slot is available
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} startTime - Start time
   * @param {string} endTime - End time
   * @param {string} excludeId - Appointment ID to exclude (for updates)
   * @returns {Promise<boolean>}
   */
  async checkSlotAvailability(accountId, tenantId, startTime, endTime, excludeId = null) {
    try {
      // Check for overlapping appointments
      let appointmentQuery = SupabaseService.adminClient
        .from('appointments')
        .select('id')
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .not('status', 'eq', 'cancelled')
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

      if (excludeId) {
        appointmentQuery = appointmentQuery.neq('id', excludeId);
      }

      const { data: appointments, error: appointmentError } = await appointmentQuery;

      if (appointmentError) {
        logger.error('Error checking appointment availability', { error: appointmentError.message });
        throw new Error('Erro ao verificar disponibilidade');
      }

      if (appointments && appointments.length > 0) {
        return false;
      }

      // Check for blocked slots
      const { data: blockedSlots, error: blockedError } = await SupabaseService.adminClient
        .from('blocked_slots')
        .select('id')
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

      if (blockedError) {
        logger.error('Error checking blocked slots', { error: blockedError.message });
        throw new Error('Erro ao verificar disponibilidade');
      }

      if (blockedSlots && blockedSlots.length > 0) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('AppointmentService.checkSlotAvailability error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create financial record for appointment
   * @private
   */
  async _createFinancialRecord(accountId, tenantId, appointmentId, amountCents) {
    try {
      const { error } = await SupabaseService.adminClient
        .from('appointment_financial_records')
        .insert({
          account_id: accountId,
          tenant_id: tenantId,
          appointment_id: appointmentId,
          amount_cents: amountCents,
          payment_status: 'pending'
        });

      if (error) {
        logger.error('Error creating financial record', { error: error.message, appointmentId });
      }
    } catch (error) {
      logger.error('AppointmentService._createFinancialRecord error', { error: error.message });
    }
  }

  /**
   * Update financial record for appointment
   * @private
   */
  async _updateFinancialRecord(accountId, tenantId, appointmentId, amountCents) {
    try {
      // Check if record exists
      const { data: existing } = await SupabaseService.adminClient
        .from('appointment_financial_records')
        .select('id')
        .eq('appointment_id', appointmentId)
        .single();

      if (existing) {
        // Update existing
        await SupabaseService.adminClient
          .from('appointment_financial_records')
          .update({
            amount_cents: amountCents,
            updated_at: new Date().toISOString()
          })
          .eq('appointment_id', appointmentId);
      } else if (amountCents > 0) {
        // Create new
        await this._createFinancialRecord(accountId, tenantId, appointmentId, amountCents);
      }
    } catch (error) {
      logger.error('AppointmentService._updateFinancialRecord error', { error: error.message });
    }
  }

  /**
   * Generate recurring appointments
   * @private
   */
  async _generateRecurringAppointments(accountId, tenantId, parentAppointment, pattern) {
    try {
      const { type, interval = 1, endDate } = pattern;
      const maxOccurrences = 52; // Max 1 year of weekly or 52 monthly
      
      const startDate = new Date(parentAppointment.start_time);
      const appointmentEndDate = new Date(parentAppointment.end_time);
      const duration = appointmentEndDate.getTime() - startDate.getTime();
      
      const patternEndDate = endDate ? new Date(endDate) : new Date(startDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      
      let currentDate = new Date(startDate);
      let count = 0;

      while (count < maxOccurrences) {
        // Move to next occurrence
        if (type === 'weekly') {
          currentDate.setDate(currentDate.getDate() + (7 * interval));
        } else if (type === 'monthly') {
          currentDate.setMonth(currentDate.getMonth() + interval);
        }

        // Check if we've passed the end date
        if (currentDate > patternEndDate) {
          break;
        }

        const newEndDate = new Date(currentDate.getTime() + duration);

        // Check availability before creating
        const isAvailable = await this.checkSlotAvailability(
          accountId,
          tenantId,
          currentDate.toISOString(),
          newEndDate.toISOString()
        );

        if (isAvailable) {
          await SupabaseService.adminClient
            .from('appointments')
            .insert({
              account_id: accountId,
              tenant_id: tenantId,
              contact_id: parentAppointment.contact_id,
              service_id: parentAppointment.service_id,
              title: parentAppointment.title,
              description: parentAppointment.description,
              start_time: currentDate.toISOString(),
              end_time: newEndDate.toISOString(),
              status: 'scheduled',
              price_cents: parentAppointment.price_cents,
              notes: parentAppointment.notes,
              recurring_parent_id: parentAppointment.id,
              recurring_pattern: pattern
            });
        }

        count++;
      }

      logger.info('Recurring appointments generated', { 
        parentId: parentAppointment.id, 
        count 
      });
    } catch (error) {
      logger.error('AppointmentService._generateRecurringAppointments error', { error: error.message });
    }
  }
}

module.exports = new AppointmentService();
