/**
 * Bulk Campaign Validator
 * 
 * Validações abrangentes para campanhas de disparo em massa
 */

const { logger } = require('../utils/logger');

/**
 * Valida dados de criação de campanha
 * @param {Object} data - Dados da campanha
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCampaignCreation(data) {
  const errors = [];
  
  // Validar campos obrigatórios
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Nome da campanha é obrigatório e deve ser uma string não vazia');
  }
  
  if (data.name && data.name.length > 100) {
    errors.push('Nome da campanha não pode ter mais de 100 caracteres');
  }
  
  if (!data.instance || typeof data.instance !== 'string') {
    errors.push('Instância é obrigatória e deve ser uma string');
  }
  
  if (!data.messageType || !['text', 'media'].includes(data.messageType)) {
    errors.push('Tipo de mensagem deve ser "text" ou "media"');
  }
  
  if (!data.messageContent || typeof data.messageContent !== 'string' || data.messageContent.trim().length === 0) {
    errors.push('Conteúdo da mensagem é obrigatório');
  }
  
  if (data.messageContent && data.messageContent.length > 4096) {
    errors.push('Conteúdo da mensagem não pode ter mais de 4096 caracteres');
  }
  
  // Validar mídia se tipo for media
  if (data.messageType === 'media') {
    if (!data.mediaUrl || typeof data.mediaUrl !== 'string') {
      errors.push('URL da mídia é obrigatória para mensagens de mídia');
    }
    
    if (data.mediaUrl && !isValidUrl(data.mediaUrl)) {
      errors.push('URL da mídia inválida');
    }
    
    if (data.mediaType && !['image', 'video', 'document'].includes(data.mediaType)) {
      errors.push('Tipo de mídia deve ser "image", "video" ou "document"');
    }
  }
  
  // Validar contatos
  if (!data.contacts || !Array.isArray(data.contacts)) {
    errors.push('Contatos devem ser fornecidos como um array');
  } else if (data.contacts.length === 0) {
    errors.push('É necessário fornecer pelo menos um contato');
  } else if (data.contacts.length > 10000) {
    errors.push('Número máximo de contatos por campanha é 10.000');
  } else {
    // Validar cada contato
    data.contacts.forEach((contact, index) => {
      if (!contact.phone || typeof contact.phone !== 'string') {
        errors.push(`Contato ${index + 1}: telefone é obrigatório`);
      } else if (!isValidPhoneNumber(contact.phone)) {
        errors.push(`Contato ${index + 1}: número de telefone inválido (${contact.phone})`);
      }
      
      if (contact.variables && typeof contact.variables !== 'object') {
        errors.push(`Contato ${index + 1}: variáveis devem ser um objeto`);
      }
    });
  }
  
  // Validar humanização
  const delayMin = data.delayMin || 10;
  const delayMax = data.delayMax || 20;
  
  if (typeof delayMin !== 'number' || delayMin < 5 || delayMin > 300) {
    errors.push('Delay mínimo deve ser um número entre 5 e 300 segundos');
  }
  
  if (typeof delayMax !== 'number' || delayMax < 5 || delayMax > 300) {
    errors.push('Delay máximo deve ser um número entre 5 e 300 segundos');
  }
  
  if (delayMin > delayMax) {
    errors.push('Delay mínimo não pode ser maior que delay máximo');
  }
  
  if (typeof data.randomizeOrder !== 'undefined' && typeof data.randomizeOrder !== 'boolean') {
    errors.push('randomizeOrder deve ser um booleano');
  }
  
  // Validar agendamento
  if (data.isScheduled) {
    if (!data.scheduledAt) {
      errors.push('Data de agendamento é obrigatória quando isScheduled é true');
    } else {
      const scheduledDate = new Date(data.scheduledAt);
      if (isNaN(scheduledDate.getTime())) {
        errors.push('Data de agendamento inválida');
      } else if (scheduledDate < new Date()) {
        errors.push('Data de agendamento não pode ser no passado');
      } else if (scheduledDate > new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)) {
        errors.push('Data de agendamento não pode ser mais de 1 ano no futuro');
      }
    }
  }
  
  // Validar janela de envio (sending window)
  if (data.sendingWindow) {
    const windowValidation = validateSendingWindow(data.sendingWindow);
    if (!windowValidation.valid) {
      errors.push(...windowValidation.errors);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida número de telefone
 * @param {string} phone - Número de telefone
 * @returns {boolean}
 */
function isValidPhoneNumber(phone) {
  // Remover espaços e caracteres especiais
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Deve ter entre 10 e 15 dígitos
  if (!/^\d{10,15}$/.test(cleaned)) {
    return false;
  }
  
  return true;
}

/**
 * Valida URL
 * @param {string} url - URL
 * @returns {boolean}
 */
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Valida ID de campanha
 * @param {string} campaignId - ID da campanha
 * @returns {Object} { valid: boolean, error: string }
 */
function validateCampaignId(campaignId) {
  if (!campaignId || typeof campaignId !== 'string') {
    return {
      valid: false,
      error: 'ID da campanha é obrigatório e deve ser uma string'
    };
  }
  
  if (campaignId.length < 10 || campaignId.length > 50) {
    return {
      valid: false,
      error: 'ID da campanha inválido'
    };
  }
  
  return { valid: true };
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
    limit: 20
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
 * Sanitiza nome de campanha
 * @param {string} name - Nome da campanha
 * @returns {string}
 */
function sanitizeCampaignName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  // Remover caracteres especiais perigosos
  return name
    .trim()
    .replace(/[<>\"']/g, '')
    .substring(0, 100);
}

/**
 * Sanitiza conteúdo de mensagem
 * @param {string} content - Conteúdo da mensagem
 * @returns {string}
 */
function sanitizeMessageContent(content) {
  if (!content || typeof content !== 'string') {
    return '';
  }
  
  return content.trim().substring(0, 4096);
}

/**
 * Valida data de agendamento futuro
 * @param {string|Date} scheduledAt - Data de agendamento
 * @param {Date} [referenceDate] - Data de referência para comparação (default: now)
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateFutureDate(scheduledAt, referenceDate = new Date()) {
  const errors = [];
  
  if (!scheduledAt) {
    errors.push('Data de agendamento é obrigatória');
    return { valid: false, errors };
  }
  
  const scheduledDate = new Date(scheduledAt);
  
  if (isNaN(scheduledDate.getTime())) {
    errors.push('Data de agendamento inválida');
    return { valid: false, errors };
  }
  
  // Date must be in the future
  if (scheduledDate <= referenceDate) {
    errors.push('Data de agendamento não pode ser no passado');
  }
  
  // Date cannot be more than 1 year in the future
  const oneYearFromNow = new Date(referenceDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  if (scheduledDate > oneYearFromNow) {
    errors.push('Data de agendamento não pode ser mais de 1 ano no futuro');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida configuração de janela de envio
 * @param {Object} window - Configuração da janela de envio
 * @param {string} window.startTime - Hora de início (HH:mm)
 * @param {string} window.endTime - Hora de fim (HH:mm)
 * @param {number[]} window.days - Dias permitidos (0-6, domingo=0)
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateSendingWindow(window) {
  const errors = [];
  
  if (!window) {
    return { valid: true, errors };
  }
  
  // Validar startTime
  if (!window.startTime) {
    errors.push('startTime é obrigatório na janela de envio');
  } else if (typeof window.startTime !== 'string') {
    errors.push('startTime deve ser uma string');
  } else if (!/^\d{2}:\d{2}$/.test(window.startTime)) {
    errors.push('startTime deve estar no formato HH:mm');
  } else {
    // Validar se é uma hora válida (00:00 a 23:59)
    const [hours, minutes] = window.startTime.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      errors.push('startTime deve ser uma hora válida (00:00 a 23:59)');
    }
  }
  
  // Validar endTime
  if (!window.endTime) {
    errors.push('endTime é obrigatório na janela de envio');
  } else if (typeof window.endTime !== 'string') {
    errors.push('endTime deve ser uma string');
  } else if (!/^\d{2}:\d{2}$/.test(window.endTime)) {
    errors.push('endTime deve estar no formato HH:mm');
  } else {
    // Validar se é uma hora válida (00:00 a 23:59)
    const [hours, minutes] = window.endTime.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      errors.push('endTime deve ser uma hora válida (00:00 a 23:59)');
    }
  }
  
  // Validar days
  if (!window.days) {
    errors.push('days é obrigatório na janela de envio');
  } else if (!Array.isArray(window.days)) {
    errors.push('days deve ser um array de números (0-6)');
  } else if (window.days.length === 0) {
    errors.push('days deve conter pelo menos um dia');
  } else {
    // Validar cada dia
    const invalidDays = window.days.filter(day => {
      return typeof day !== 'number' || day < 0 || day > 6 || !Number.isInteger(day);
    });
    
    if (invalidDays.length > 0) {
      errors.push('days deve conter apenas números inteiros de 0 a 6 (domingo=0)');
    }
    
    // Verificar duplicatas
    const uniqueDays = [...new Set(window.days)];
    if (uniqueDays.length !== window.days.length) {
      errors.push('days não deve conter dias duplicados');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valida atualização de configuração de campanha
 * @param {Object} updates - Campos a atualizar
 * @param {number} [updates.delay_min] - Delay mínimo entre mensagens (segundos)
 * @param {number} [updates.delay_max] - Delay máximo entre mensagens (segundos)
 * @param {Object} [updates.sending_window] - Configuração da janela de envio
 * @param {string} [updates.scheduled_at] - Data/hora de início agendado
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateCampaignConfigUpdate(updates) {
  const errors = [];
  
  if (!updates || typeof updates !== 'object') {
    errors.push('Dados de atualização são obrigatórios');
    return { valid: false, errors };
  }
  
  // Check if at least one field is provided
  const allowedFields = ['delay_min', 'delay_max', 'sending_window', 'scheduled_at'];
  const providedFields = Object.keys(updates).filter(key => allowedFields.includes(key));
  
  if (providedFields.length === 0) {
    errors.push('Pelo menos um campo deve ser fornecido para atualização');
    return { valid: false, errors };
  }
  
  // Validate delay_min
  if (updates.delay_min !== undefined) {
    if (typeof updates.delay_min !== 'number' || !Number.isInteger(updates.delay_min)) {
      errors.push('delay_min deve ser um número inteiro');
    } else if (updates.delay_min < 1) {
      errors.push('delay_min deve ser maior ou igual a 1');
    } else if (updates.delay_min > 300) {
      errors.push('delay_min não pode ser maior que 300 segundos');
    }
  }
  
  // Validate delay_max
  if (updates.delay_max !== undefined) {
    if (typeof updates.delay_max !== 'number' || !Number.isInteger(updates.delay_max)) {
      errors.push('delay_max deve ser um número inteiro');
    } else if (updates.delay_max < 1) {
      errors.push('delay_max deve ser maior ou igual a 1');
    } else if (updates.delay_max > 300) {
      errors.push('delay_max não pode ser maior que 300 segundos');
    }
  }
  
  // Validate delay_min <= delay_max when both are provided
  if (updates.delay_min !== undefined && updates.delay_max !== undefined) {
    if (typeof updates.delay_min === 'number' && typeof updates.delay_max === 'number') {
      if (updates.delay_min > updates.delay_max) {
        errors.push('delay_min não pode ser maior que delay_max');
      }
    }
  }
  
  // Validate sending_window using existing function
  if (updates.sending_window !== undefined) {
    if (updates.sending_window === null) {
      // Allow null to clear the sending window
    } else {
      const windowValidation = validateSendingWindow(updates.sending_window);
      if (!windowValidation.valid) {
        errors.push(...windowValidation.errors);
      }
    }
  }
  
  // Validate scheduled_at is in the future (if provided)
  if (updates.scheduled_at !== undefined) {
    if (updates.scheduled_at === null) {
      // Allow null to clear the scheduled time
    } else {
      const dateValidation = validateFutureDate(updates.scheduled_at);
      if (!dateValidation.valid) {
        errors.push(...dateValidation.errors);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateCampaignCreation,
  validateCampaignId,
  validatePaginationParams,
  validateSendingWindow,
  validateFutureDate,
  validateCampaignConfigUpdate,
  isValidPhoneNumber,
  isValidUrl,
  sanitizeCampaignName,
  sanitizeMessageContent
};
