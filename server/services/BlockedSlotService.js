/**
 * Blocked Slot Service
 * 
 * Business logic for managing blocked time slots.
 * 
 * Requirements: 4.1, 4.4, 4.5 (CRM Contact Calendar)
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class BlockedSlotService {
  /**
   * Get blocked slots for an account within a date range
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} options - Query options
   * @param {Date} options.startDate - Start of date range
   * @param {Date} options.endDate - End of date range
   * @returns {Promise<Array>}
   */
  async getBlockedSlots(accountId, tenantId, options = {}) {
    try {
      const { startDate, endDate } = options;

      let query = SupabaseService.adminClient
        .from('blocked_slots')
        .select('*')
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: true });

      if (startDate) {
        query = query.gte('start_time', startDate.toISOString());
      }

      if (endDate) {
        query = query.lte('end_time', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching blocked slots', { error: error.message });
        throw new Error('Erro ao buscar horários bloqueados');
      }

      // Expand recurring slots if date range provided
      if (startDate && endDate && data) {
        return this.expandRecurringSlots(data, startDate, endDate);
      }

      return data || [];
    } catch (error) {
      logger.error('BlockedSlotService.getBlockedSlots error', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single blocked slot by ID
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} slotId - Slot ID
   * @returns {Promise<Object|null>}
   */
  async getBlockedSlotById(accountId, tenantId, slotId) {
    try {
      const { data, error } = await SupabaseService.adminClient
        .from('blocked_slots')
        .select('*')
        .eq('id', slotId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching blocked slot', { error: error.message, slotId });
        throw new Error('Erro ao buscar horário bloqueado');
      }

      return data;
    } catch (error) {
      logger.error('BlockedSlotService.getBlockedSlotById error', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a new blocked slot
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {Object} data - Blocked slot data
   * @returns {Promise<Object>}
   */
  async createBlockedSlot(accountId, tenantId, data) {
    try {
      const slotData = {
        account_id: accountId,
        tenant_id: tenantId,
        start_time: data.startTime,
        end_time: data.endTime,
        reason: data.reason || null,
        is_recurring: data.isRecurring || false,
        recurring_pattern: data.recurringPattern || null
      };

      const { data: slot, error } = await SupabaseService.adminClient
        .from('blocked_slots')
        .insert(slotData)
        .select()
        .single();

      if (error) {
        logger.error('Error creating blocked slot', { error: error.message });
        throw new Error('Erro ao criar horário bloqueado');
      }

      logger.info('Blocked slot created', { slotId: slot.id });
      return slot;
    } catch (error) {
      logger.error('BlockedSlotService.createBlockedSlot error', { error: error.message });
      throw error;
    }
  }

  /**
   * Update an existing blocked slot
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} slotId - Slot ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async updateBlockedSlot(accountId, tenantId, slotId, data) {
    try {
      const updateData = {};

      if (data.startTime !== undefined) updateData.start_time = data.startTime;
      if (data.endTime !== undefined) updateData.end_time = data.endTime;
      if (data.reason !== undefined) updateData.reason = data.reason;
      if (data.isRecurring !== undefined) updateData.is_recurring = data.isRecurring;
      if (data.recurringPattern !== undefined) updateData.recurring_pattern = data.recurringPattern;

      const { data: slot, error } = await SupabaseService.adminClient
        .from('blocked_slots')
        .update(updateData)
        .eq('id', slotId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating blocked slot', { error: error.message, slotId });
        throw new Error('Erro ao atualizar horário bloqueado');
      }

      logger.info('Blocked slot updated', { slotId });
      return slot;
    } catch (error) {
      logger.error('BlockedSlotService.updateBlockedSlot error', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete a blocked slot
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} slotId - Slot ID
   * @returns {Promise<void>}
   */
  async deleteBlockedSlot(accountId, tenantId, slotId) {
    try {
      const { error } = await SupabaseService.adminClient
        .from('blocked_slots')
        .delete()
        .eq('id', slotId)
        .eq('account_id', accountId)
        .eq('tenant_id', tenantId);

      if (error) {
        logger.error('Error deleting blocked slot', { error: error.message, slotId });
        throw new Error('Erro ao excluir horário bloqueado');
      }

      logger.info('Blocked slot deleted', { slotId });
    } catch (error) {
      logger.error('BlockedSlotService.deleteBlockedSlot error', { error: error.message });
      throw error;
    }
  }

  /**
   * Expand recurring slots into individual occurrences within a date range
   * @param {Array} slots - Array of blocked slots
   * @param {Date} startDate - Start of date range
   * @param {Date} endDate - End of date range
   * @returns {Array}
   */
  expandRecurringSlots(slots, startDate, endDate) {
    const expandedSlots = [];
    const rangeStart = new Date(startDate);
    const rangeEnd = new Date(endDate);

    for (const slot of slots) {
      if (!slot.is_recurring || !slot.recurring_pattern) {
        // Non-recurring slot - add as-is if within range
        const slotStart = new Date(slot.start_time);
        const slotEnd = new Date(slot.end_time);
        
        if (slotStart <= rangeEnd && slotEnd >= rangeStart) {
          expandedSlots.push(slot);
        }
        continue;
      }

      // Expand recurring slot
      const pattern = slot.recurring_pattern;
      const originalStart = new Date(slot.start_time);
      const originalEnd = new Date(slot.end_time);
      const duration = originalEnd.getTime() - originalStart.getTime();

      // Get time of day from original slot
      const startHour = originalStart.getHours();
      const startMinute = originalStart.getMinutes();

      if (pattern.type === 'daily') {
        // Generate daily occurrences
        let currentDate = new Date(rangeStart);
        currentDate.setHours(startHour, startMinute, 0, 0);

        while (currentDate <= rangeEnd) {
          const occurrenceEnd = new Date(currentDate.getTime() + duration);
          
          expandedSlots.push({
            ...slot,
            id: `${slot.id}_${currentDate.toISOString()}`,
            start_time: currentDate.toISOString(),
            end_time: occurrenceEnd.toISOString(),
            is_occurrence: true,
            parent_id: slot.id
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }
      } else if (pattern.type === 'weekly' && pattern.days) {
        // Generate weekly occurrences for specified days
        let currentDate = new Date(rangeStart);
        currentDate.setHours(startHour, startMinute, 0, 0);

        while (currentDate <= rangeEnd) {
          const dayOfWeek = currentDate.getDay();
          
          if (pattern.days.includes(dayOfWeek)) {
            const occurrenceEnd = new Date(currentDate.getTime() + duration);
            
            expandedSlots.push({
              ...slot,
              id: `${slot.id}_${currentDate.toISOString()}`,
              start_time: currentDate.toISOString(),
              end_time: occurrenceEnd.toISOString(),
              is_occurrence: true,
              parent_id: slot.id
            });
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      }
    }

    return expandedSlots;
  }

  /**
   * Check if a time range overlaps with any blocked slots
   * @param {string} accountId - Account ID
   * @param {string} tenantId - Tenant ID
   * @param {string} startTime - Start time
   * @param {string} endTime - End time
   * @returns {Promise<boolean>}
   */
  async isTimeBlocked(accountId, tenantId, startTime, endTime) {
    try {
      const start = new Date(startTime);
      const end = new Date(endTime);

      // Get all blocked slots that might overlap
      const slots = await this.getBlockedSlots(accountId, tenantId, {
        startDate: new Date(start.getTime() - 24 * 60 * 60 * 1000), // 1 day before
        endDate: new Date(end.getTime() + 24 * 60 * 60 * 1000) // 1 day after
      });

      // Check for overlaps
      for (const slot of slots) {
        const slotStart = new Date(slot.start_time);
        const slotEnd = new Date(slot.end_time);

        if (start < slotEnd && end > slotStart) {
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('BlockedSlotService.isTimeBlocked error', { error: error.message });
      throw error;
    }
  }
}

module.exports = new BlockedSlotService();
