/**
 * Appointment Validator
 * 
 * Validações para agendamentos, serviços e slots bloqueados
 * Requirements: 2.1, 6.1 (CRM Contact Calendar)
 */

const { logger } = require('../utils/logger');

// Status válidos para agendamentos
const VALID_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'];

// Status válidos para pagamento
const VALID_PAYMENT_STATUSES = ['pending', 'paid', 'refunded'];

// Tipos de recorrência válidos
const VALID_RECURRING_TYPES = ['weekly', 'monthly'];

// Tipos de recorrência para slots bloqueados
const VALID_BLOCKED_RECURRING_TYPES = ['daily', 'weekly'];

/**
 * Valida dados de criação de agendamento
 * @param {Object} data - Dados do agendamento
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateAppointment(data) {
  const errors = [];
  
  // Validar campos obrigatórios
  if (!data.contactId || typeof data.contactId !== 'string') {
    errors.push('ID do contato é obrigatório');
  }
  
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    errors.push('Título é obrigatório');
  }
  
  if (data.title && data.title.length > 255) {
    errors.push('Título não pode ter mais de 255 caracteres');
  }
  
  // Validar datas
  if (!data.startTime) {
    errors.push('Data/hora de início é obrigatória');
  } else {
    const startDate = new Date(data.startTime);
    if (isNaN(startDate.getTime())) {
      errors.push('Data/hora de início inválida');
    }
  }
  
  if (!data.endTime) {
    errors.push('Data/hora de término é obrigatória');
  } else {
    const endDate = new Date(data.endTime);
    if (isNaN(endDate.getTime())) {
      errors.push('Data/hora de término inválida');
    }
  }
  
  // Validar que end > start
  if (data.startTime && data.endTime) {
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate <= startDate) {
        errors.push('Data/hora de término deve ser posterior ao início');
      }
    }
  }
  
  // Validar campos opcionais
  if (data.serviceId && typeof data.serviceId !== 'string') {
    errors.push('ID do serviço deve ser uma string');
  }
  
  if (data.description && data.description.length > 2000) {
    errors.push('Descrição não pode ter mais de 2000 caracteres');
  }
  
  if (data.priceCents !== undefined) {
    if (typeof data.priceCents !== 'number' || data.priceCents < 0) {
      errors.push('Preço deve ser um número não negativo');
    }
  }
  
  if (data.notes && data.notes.length > 2000) {
    errors.push('Notas não podem ter mais de 2000 caracteres');
  }
  
  // Validar padrão de recorrência
  if (data.recurringPattern) {
    const patternValidation = validateRecurringPattern(data.recurringPattern);
    if (!patternValidation.valid) {
      errors.push(...patternValidation.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida dados de atualização de agendamento
 * @param {Object} data - Dados para atualizar
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateAppointmentUpdate(data) {
  const errors = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('Dados de atualização são obrigatórios');
    return { valid: false, errors };
  }
  
  // Validar título se fornecido
  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Título deve ser uma string não vazia');
    } else if (data.title.length > 255) {
      errors.push('Título não pode ter mais de 255 caracteres');
    }
  }
  
  // Validar datas se fornecidas
  if (data.startTime !== undefined) {
    const startDate = new Date(data.startTime);
    if (isNaN(startDate.getTime())) {
      errors.push('Data/hora de início inválida');
    }
  }
  
  if (data.endTime !== undefined) {
    const endDate = new Date(data.endTime);
    if (isNaN(endDate.getTime())) {
      errors.push('Data/hora de término inválida');
    }
  }
  
  // Validar que end > start se ambos fornecidos
  if (data.startTime && data.endTime) {
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate <= startDate) {
        errors.push('Data/hora de término deve ser posterior ao início');
      }
    }
  }
  
  // Validar status se fornecido
  if (data.status !== undefined) {
    if (!VALID_APPOINTMENT_STATUSES.includes(data.status)) {
      errors.push(`Status inválido. Valores permitidos: ${VALID_APPOINTMENT_STATUSES.join(', ')}`);
    }
  }
  
  // Validar preço se fornecido
  if (data.priceCents !== undefined) {
    if (typeof data.priceCents !== 'number' || data.priceCents < 0) {
      errors.push('Preço deve ser um número não negativo');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida transição de status
 * @param {string} currentStatus - Status atual
 * @param {string} newStatus - Novo status
 * @returns {Object} { valid: boolean, error: string }
 */
function validateStatusTransition(currentStatus, newStatus) {
  // Validar que ambos são status válidos
  if (!VALID_APPOINTMENT_STATUSES.includes(currentStatus)) {
    return { valid: false, error: 'Status atual inválido' };
  }
  
  if (!VALID_APPOINTMENT_STATUSES.includes(newStatus)) {
    return { valid: false, error: `Status inválido. Valores permitidos: ${VALID_APPOINTMENT_STATUSES.join(', ')}` };
  }
  
  // Definir transições permitidas
  const allowedTransitions = {
    'scheduled': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled', 'no_show'],
    'completed': [], // Status final
    'cancelled': [], // Status final
    'no_show': []    // Status final
  };
  
  const allowed = allowedTransitions[currentStatus] || [];
  
  if (!allowed.includes(newStatus)) {
    return {
      valid: false,
      error: `Não é possível mudar de "${currentStatus}" para "${newStatus}". Transições permitidas: ${allowed.join(', ') || 'nenhuma'}`
    };
  }
  
  return { valid: true };
}

/**
 * Valida padrão de recorrência
 * @param {Object} pattern - Padrão de recorrência
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateRecurringPattern(pattern) {
  const errors = [];
  
  if (!pattern || typeof pattern !== 'object') {
    errors.push('Padrão de recorrência deve ser um objeto');
    return { valid: false, errors };
  }
  
  // Validar tipo
  if (!pattern.type || !VALID_RECURRING_TYPES.includes(pattern.type)) {
    errors.push(`Tipo de recorrência inválido. Valores permitidos: ${VALID_RECURRING_TYPES.join(', ')}`);
  }
  
  // Validar intervalo
  if (pattern.interval !== undefined) {
    if (typeof pattern.interval !== 'number' || pattern.interval < 1 || pattern.interval > 12) {
      errors.push('Intervalo deve ser um número entre 1 e 12');
    }
  }
  
  // Validar data de término
  if (pattern.endDate) {
    const endDate = new Date(pattern.endDate);
    if (isNaN(endDate.getTime())) {
      errors.push('Data de término da recorrência inválida');
    } else if (endDate < new Date()) {
      errors.push('Data de término da recorrência não pode ser no passado');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida dados de serviço
 * @param {Object} data - Dados do serviço
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateService(data) {
  const errors = [];
  
  // Validar nome
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome do serviço é obrigatório');
  }
  
  if (data.name && data.name.length > 255) {
    errors.push('Nome do serviço não pode ter mais de 255 caracteres');
  }
  
  // Validar duração
  if (data.defaultDurationMinutes !== undefined) {
    if (typeof data.defaultDurationMinutes !== 'number' || data.defaultDurationMinutes < 1) {
      errors.push('Duração padrão deve ser um número maior que 0');
    } else if (data.defaultDurationMinutes > 480) {
      errors.push('Duração padrão não pode ser maior que 480 minutos (8 horas)');
    }
  }
  
  // Validar preço
  if (data.defaultPriceCents !== undefined) {
    if (typeof data.defaultPriceCents !== 'number' || data.defaultPriceCents < 0) {
      errors.push('Preço padrão deve ser um número não negativo');
    }
  }
  
  // Validar cor
  if (data.color !== undefined) {
    if (typeof data.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
      errors.push('Cor deve ser um código hexadecimal válido (ex: #3b82f6)');
    }
  }
  
  // Validar descrição
  if (data.description && data.description.length > 1000) {
    errors.push('Descrição não pode ter mais de 1000 caracteres');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida dados de slot bloqueado
 * @param {Object} data - Dados do slot bloqueado
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateBlockedSlot(data) {
  const errors = [];
  
  // Validar datas
  if (!data.startTime) {
    errors.push('Data/hora de início é obrigatória');
  } else {
    const startDate = new Date(data.startTime);
    if (isNaN(startDate.getTime())) {
      errors.push('Data/hora de início inválida');
    }
  }
  
  if (!data.endTime) {
    errors.push('Data/hora de término é obrigatória');
  } else {
    const endDate = new Date(data.endTime);
    if (isNaN(endDate.getTime())) {
      errors.push('Data/hora de término inválida');
    }
  }
  
  // Validar que end > start
  if (data.startTime && data.endTime) {
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);
    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      if (endDate <= startDate) {
        errors.push('Data/hora de término deve ser posterior ao início');
      }
    }
  }
  
  // Validar motivo
  if (data.reason && data.reason.length > 255) {
    errors.push('Motivo não pode ter mais de 255 caracteres');
  }
  
  // Validar padrão de recorrência
  if (data.isRecurring && data.recurringPattern) {
    const patternValidation = validateBlockedSlotRecurringPattern(data.recurringPattern);
    if (!patternValidation.valid) {
      errors.push(...patternValidation.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida padrão de recorrência para slots bloqueados
 * @param {Object} pattern - Padrão de recorrência
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateBlockedSlotRecurringPattern(pattern) {
  const errors = [];
  
  if (!pattern || typeof pattern !== 'object') {
    errors.push('Padrão de recorrência deve ser um objeto');
    return { valid: false, errors };
  }
  
  // Validar tipo
  if (!pattern.type || !VALID_BLOCKED_RECURRING_TYPES.includes(pattern.type)) {
    errors.push(`Tipo de recorrência inválido. Valores permitidos: ${VALID_BLOCKED_RECURRING_TYPES.join(', ')}`);
  }
  
  // Validar dias para recorrência semanal
  if (pattern.type === 'weekly') {
    if (!pattern.days || !Array.isArray(pattern.days) || pattern.days.length === 0) {
      errors.push('Dias da semana são obrigatórios para recorrência semanal');
    } else {
      const invalidDays = pattern.days.filter(day => {
        return typeof day !== 'number' || day < 0 || day > 6 || !Number.isInteger(day);
      });
      
      if (invalidDays.length > 0) {
        errors.push('Dias devem ser números inteiros de 0 a 6 (domingo=0)');
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida parâmetros de paginação
 * @param {Object} params - Parâmetros { page, limit }
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
function validatePaginationParams(params) {
  const errors = [];
  const sanitized = {
    page: 1,
    limit: 50
  };
  
  if (params.page) {
    const page = parseInt(params.page);
    if (isNaN(page) || page < 1) {
      errors.push('Página deve ser um número maior que 0');
    } else if (page > 1000) {
      errors.push('Página não pode ser maior que 1000');
    } else {
      sanitized.page = page;
    }
  }
  
  if (params.limit) {
    const limit = parseInt(params.limit);
    if (isNaN(limit) || limit < 1) {
      errors.push('Limite deve ser um número maior que 0');
    } else if (limit > 100) {
      errors.push('Limite não pode ser maior que 100');
    } else {
      sanitized.limit = limit;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Valida intervalo de datas
 * @param {string} startDate - Data de início
 * @param {string} endDate - Data de fim
 * @returns {Object} { valid: boolean, errors: string[], sanitized: Object }
 */
function validateDateRange(startDate, endDate) {
  const errors = [];
  const sanitized = {};
  
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      errors.push('Data de início inválida');
    } else {
      sanitized.startDate = start;
    }
  }
  
  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      errors.push('Data de fim inválida');
    } else {
      sanitized.endDate = end;
    }
  }
  
  // Validar que end >= start
  if (sanitized.startDate && sanitized.endDate) {
    if (sanitized.endDate < sanitized.startDate) {
      errors.push('Data de fim deve ser igual ou posterior à data de início');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Valida UUID
 * @param {string} id - UUID para validar
 * @returns {boolean}
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

module.exports = {
  validateAppointment,
  validateAppointmentUpdate,
  validateStatusTransition,
  validateRecurringPattern,
  validateService,
  validateBlockedSlot,
  validateBlockedSlotRecurringPattern,
  validatePaginationParams,
  validateDateRange,
  isValidUUID,
  VALID_APPOINTMENT_STATUSES,
  VALID_PAYMENT_STATUSES,
  VALID_RECURRING_TYPES,
  VALID_BLOCKED_RECURRING_TYPES
};
