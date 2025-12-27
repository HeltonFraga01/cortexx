/**
 * User Appointment Routes
 * 
 * Handles appointment, service, and blocked slot management for CRM calendar.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 7.1 (CRM Contact Calendar)
 * 
 * IMPORTANT: Static routes (e.g., /services, /calendar-events) MUST be defined
 * BEFORE parameterized routes (e.g., /:id) to avoid route conflicts.
 */

const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const { validateSupabaseToken } = require('../middleware/supabaseAuth');
const { z } = require('zod');

// Services
const AppointmentService = require('../services/AppointmentService');
const AppointmentServiceTypeService = require('../services/AppointmentServiceTypeService');
const BlockedSlotService = require('../services/BlockedSlotService');
const SupabaseService = require('../services/SupabaseService');

// Validators
const {
  validateAppointment,
  validateService,
  validateBlockedSlot,
  validateStatusTransition
} = require('../validators/appointmentValidator');

// ==================== VALIDATION SCHEMAS ====================

const appointmentQuerySchema = z.object({
  contactId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  statuses: z.string().optional(),
  serviceId: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50)
});

const calendarEventsQuerySchema = z.object({
  contactId: z.string().uuid().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  types: z.string().optional() // comma-separated: appointment,scheduled_message,campaign,blocked
});

const statusUpdateSchema = z.object({
  status: z.enum(['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show']),
  reason: z.string().max(500).optional()
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Get account context from request
 */
async function getAccountContext(req) {
  if (req.user?.id) {
    const queryFn = (query) => query
      .select('id, tenant_id')
      .eq('owner_user_id', req.user.id)
      .single();

    const { data: account } = await SupabaseService.queryAsAdmin('accounts', queryFn);
    if (account) {
      return { accountId: account.id, tenantId: account.tenant_id };
    }
  }
  return null;
}

/**
 * Verify contact belongs to account
 */
async function verifyContactOwnership(contactId, accountId) {
  const queryFn = (query) => query
    .select('id')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .single();

  const { data, error } = await SupabaseService.queryAsAdmin('contacts', queryFn);
  return !error && !!data;
}

// ==================== STATIC ROUTES (MUST COME FIRST) ====================
// These routes have fixed paths and must be defined before /:id routes

/**
 * GET /api/user/appointments/check-availability
 * Check if a time slot is available
 */
router.get('/check-availability', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const { startTime, endTime, excludeId } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: 'startTime and endTime are required'
      });
    }

    const isAvailable = await AppointmentService.checkSlotAvailability(
      context.accountId,
      context.tenantId,
      startTime,
      endTime,
      excludeId
    );

    res.json({ success: true, data: { available: isAvailable } });
  } catch (error) {
    logger.error('Error checking availability', {
      error: error.message,
      endpoint: '/api/user/appointments/check-availability'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/appointments/calendar-events
 * Get unified calendar events (appointments + scheduled messages + campaigns + blocked)
 */
router.get('/calendar-events', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const query = calendarEventsQuerySchema.parse(req.query);
    const types = query.types ? query.types.split(',') : ['appointment', 'blocked'];
    const events = [];

    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);

    // Get appointments
    if (types.includes('appointment')) {
      const options = {
        startDate,
        endDate,
        page: 1,
        limit: 500 // Get all for calendar view
      };

      let appointmentResult;
      if (query.contactId) {
        if (!await verifyContactOwnership(query.contactId, context.accountId)) {
          return res.status(404).json({ success: false, error: 'Contact not found' });
        }
        appointmentResult = await AppointmentService.getContactAppointments(
          context.accountId,
          context.tenantId,
          query.contactId,
          options
        );
      } else {
        appointmentResult = await AppointmentService.getAppointments(
          context.accountId,
          context.tenantId,
          options
        );
      }

      for (const apt of appointmentResult.data) {
        events.push({
          id: apt.id,
          type: 'appointment',
          title: apt.title,
          start: apt.start_time,
          end: apt.end_time,
          color: apt.service?.color || '#3b82f6',
          status: apt.status,
          data: apt
        });
      }
    }

    // Get blocked slots
    if (types.includes('blocked')) {
      const blockedSlots = await BlockedSlotService.getBlockedSlots(
        context.accountId,
        context.tenantId,
        { startDate, endDate }
      );

      for (const slot of blockedSlots) {
        events.push({
          id: slot.id,
          type: 'blocked',
          title: slot.reason || 'Bloqueado',
          start: slot.start_time,
          end: slot.end_time,
          color: '#6b7280',
          status: 'blocked',
          data: slot
        });
      }
    }

    // TODO: Add scheduled_message and campaign types when integrating with existing systems

    // Sort by start time
    events.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json({ success: true, data: events });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching calendar events', {
      error: error.message,
      endpoint: '/api/user/appointments/calendar-events'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SERVICE ROUTES (STATIC PATHS) ====================

/**
 * GET /api/user/appointments/services
 * List appointment services
 */
router.get('/services', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const activeOnly = req.query.activeOnly === 'true';
    const services = await AppointmentServiceTypeService.getServices(
      context.accountId,
      context.tenantId,
      { activeOnly }
    );

    res.json({ success: true, data: services });
  } catch (error) {
    logger.error('Error fetching services', {
      error: error.message,
      endpoint: '/api/user/appointments/services'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/appointments/services
 * Create appointment service
 */
router.post('/services', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validation = validateService(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.message,
        details: validation.errors
      });
    }

    const service = await AppointmentServiceTypeService.createService(
      context.accountId,
      context.tenantId,
      req.body
    );

    res.status(201).json({ success: true, data: service });
  } catch (error) {
    logger.error('Error creating service', {
      error: error.message,
      endpoint: '/api/user/appointments/services'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/appointments/services/:id
 * Update appointment service
 */
router.put('/services/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const service = await AppointmentServiceTypeService.updateService(
      context.accountId,
      context.tenantId,
      req.params.id,
      req.body
    );

    res.json({ success: true, data: service });
  } catch (error) {
    logger.error('Error updating service', {
      error: error.message,
      serviceId: req.params.id,
      endpoint: '/api/user/appointments/services/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/appointments/services/:id
 * Delete appointment service (soft delete)
 */
router.delete('/services/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    await AppointmentServiceTypeService.deleteService(
      context.accountId,
      context.tenantId,
      req.params.id
    );

    res.json({ success: true, message: 'Service deleted' });
  } catch (error) {
    logger.error('Error deleting service', {
      error: error.message,
      serviceId: req.params.id,
      endpoint: '/api/user/appointments/services/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== BLOCKED SLOT ROUTES (STATIC PATHS) ====================

/**
 * GET /api/user/appointments/blocked-slots
 * List blocked slots
 */
router.get('/blocked-slots', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const options = {
      startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate) : undefined
    };

    const slots = await BlockedSlotService.getBlockedSlots(
      context.accountId,
      context.tenantId,
      options
    );

    res.json({ success: true, data: slots });
  } catch (error) {
    logger.error('Error fetching blocked slots', {
      error: error.message,
      endpoint: '/api/user/appointments/blocked-slots'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/appointments/blocked-slots
 * Create blocked slot
 */
router.post('/blocked-slots', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validation = validateBlockedSlot(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.message,
        details: validation.errors
      });
    }

    const slot = await BlockedSlotService.createBlockedSlot(
      context.accountId,
      context.tenantId,
      req.body
    );

    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    logger.error('Error creating blocked slot', {
      error: error.message,
      endpoint: '/api/user/appointments/blocked-slots'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/appointments/blocked-slots/:id
 * Delete blocked slot
 */
router.delete('/blocked-slots/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    await BlockedSlotService.deleteBlockedSlot(
      context.accountId,
      context.tenantId,
      req.params.id
    );

    res.json({ success: true, message: 'Blocked slot deleted' });
  } catch (error) {
    logger.error('Error deleting blocked slot', {
      error: error.message,
      slotId: req.params.id,
      endpoint: '/api/user/appointments/blocked-slots/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== APPOINTMENT ROUTES (PARAMETERIZED - MUST COME LAST) ====================

/**
 * GET /api/user/appointments
 * List appointments with filters
 */
router.get('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const query = appointmentQuerySchema.parse(req.query);

    // If contactId provided, verify ownership
    if (query.contactId) {
      if (!await verifyContactOwnership(query.contactId, context.accountId)) {
        return res.status(404).json({ success: false, error: 'Contact not found' });
      }
    }

    const options = {
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      statuses: query.statuses ? query.statuses.split(',') : undefined,
      serviceId: query.serviceId,
      page: query.page,
      limit: query.limit
    };

    let result;
    if (query.contactId) {
      result = await AppointmentService.getContactAppointments(
        context.accountId,
        context.tenantId,
        query.contactId,
        options
      );
    } else {
      result = await AppointmentService.getAppointments(
        context.accountId,
        context.tenantId,
        options
      );
    }

    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit)
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Error fetching appointments', {
      error: error.message,
      endpoint: '/api/user/appointments'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/appointments
 * Create new appointment
 */
router.post('/', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    // Validate input
    const validation = validateAppointment(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.message,
        details: validation.errors
      });
    }

    // Verify contact ownership
    if (!await verifyContactOwnership(req.body.contactId, context.accountId)) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }

    const appointment = await AppointmentService.createAppointment(
      context.accountId,
      context.tenantId,
      req.body
    );

    res.status(201).json({ success: true, data: appointment });
  } catch (error) {
    if (error.message === 'SLOT_UNAVAILABLE') {
      return res.status(409).json({
        success: false,
        error: 'SLOT_UNAVAILABLE',
        message: 'O horário selecionado não está disponível'
      });
    }
    logger.error('Error creating appointment', {
      error: error.message,
      endpoint: '/api/user/appointments'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/user/appointments/:id
 * Get single appointment
 */
router.get('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const appointment = await AppointmentService.getAppointmentById(
      context.accountId,
      context.tenantId,
      req.params.id
    );

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    res.json({ success: true, data: appointment });
  } catch (error) {
    logger.error('Error fetching appointment', {
      error: error.message,
      appointmentId: req.params.id,
      endpoint: '/api/user/appointments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/user/appointments/:id
 * Update appointment
 */
router.put('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const appointment = await AppointmentService.updateAppointment(
      context.accountId,
      context.tenantId,
      req.params.id,
      req.body
    );

    res.json({ success: true, data: appointment });
  } catch (error) {
    if (error.message === 'APPOINTMENT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }
    if (error.message === 'SLOT_UNAVAILABLE') {
      return res.status(409).json({
        success: false,
        error: 'SLOT_UNAVAILABLE',
        message: 'O horário selecionado não está disponível'
      });
    }
    logger.error('Error updating appointment', {
      error: error.message,
      appointmentId: req.params.id,
      endpoint: '/api/user/appointments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/user/appointments/:id
 * Delete appointment
 */
router.delete('/:id', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    await AppointmentService.deleteAppointment(
      context.accountId,
      context.tenantId,
      req.params.id
    );

    res.json({ success: true, message: 'Appointment deleted' });
  } catch (error) {
    logger.error('Error deleting appointment', {
      error: error.message,
      appointmentId: req.params.id,
      endpoint: '/api/user/appointments/:id'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/user/appointments/:id/status
 * Update appointment status
 */
router.post('/:id/status', validateSupabaseToken, async (req, res) => {
  try {
    const context = await getAccountContext(req);
    if (!context) {
      return res.status(401).json({ success: false, error: 'Account not found' });
    }

    const validated = statusUpdateSchema.parse(req.body);

    // Get current appointment to validate transition
    const current = await AppointmentService.getAppointmentById(
      context.accountId,
      context.tenantId,
      req.params.id
    );

    if (!current) {
      return res.status(404).json({ success: false, error: 'Appointment not found' });
    }

    // Validate status transition
    const transitionValid = validateStatusTransition(current.status, validated.status);
    if (!transitionValid.valid) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TRANSITION',
        message: transitionValid.message
      });
    }

    const appointment = await AppointmentService.updateStatus(
      context.accountId,
      context.tenantId,
      req.params.id,
      validated.status,
      validated.reason
    );

    res.json({ success: true, data: appointment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Invalid input', details: error.errors });
    }
    logger.error('Error updating appointment status', {
      error: error.message,
      appointmentId: req.params.id,
      endpoint: '/api/user/appointments/:id/status'
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
