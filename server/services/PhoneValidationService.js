/**
 * Phone Validation Service
 * Centraliza validação de números de telefone usando a API WUZAPI /user/check
 * 
 * O campo 'Query' retornado pela API é o número no formato correto que o WhatsApp reconhece
 */

const { logger } = require('../utils/logger');

// Lazy load wuzapiClient apenas quando necessário (para evitar circular dependencies)
let wuzapiClient = null;
function getWuzapiClient() {
  if (!wuzapiClient) {
    wuzapiClient = require('../utils/wuzapiClient');
  }
  return wuzapiClient;
}

// Cache simples em memória para resoluções de validação
// Formato: { "userToken:preparedPhone": { validatedPhone, isValid, timestamp } }
const validationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const MAX_CACHE_SIZE = 10000; // Limite máximo de entradas no cache

/**
 * Adiciona entrada ao cache com evição LRU quando excede o limite
 * @param {string} key - Chave do cache
 * @param {Object} value - Valor a ser armazenado
 */
function setCacheEntry(key, value) {
  // Se o cache está cheio, remover as entradas mais antigas
  if (validationCache.size >= MAX_CACHE_SIZE) {
    // Encontrar e remover as entradas mais antigas (LRU)
    const entriesToRemove = Math.ceil(MAX_CACHE_SIZE * 0.1); // Remove 10% das entradas
    const entries = Array.from(validationCache.entries());
    
    // Ordenar por timestamp (mais antigos primeiro)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remover as entradas mais antigas
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      validationCache.delete(entries[i][0]);
    }
    
    logger.debug('PhoneValidationService: cache LRU eviction', {
      removed: entriesToRemove,
      newSize: validationCache.size
    });
  }
  
  validationCache.set(key, value);
}

/**
 * Prepara número para validação na API WUZAPI
 * Remove sufixos, caracteres especiais, zero inicial do DDD, adiciona código do país
 * 
 * Suporta múltiplos formatos:
 * - 5531994974759 (13 dígitos com código)
 * - 31994974759 (11 dígitos sem código)
 * - 21994974759 (11 dígitos sem código)
 * - +55 31 99497-4759 (formatado)
 * - (31) 99497-4759 (formatado sem código)
 * 
 * @param {string} phone - Número em qualquer formato
 * @returns {string} Número preparado para enviar à API (sempre 55DDNNNNNNNNN)
 */
function preparePhoneForValidation(phone) {
  if (!phone) return '';
  
  // Remove sufixos WhatsApp
  let prepared = phone.replace(/@(s\.whatsapp\.net|c\.us|lid)$/i, '');
  
  // Remove caracteres não numéricos
  prepared = prepared.replace(/\D/g, '');
  
  // Se começar com 55 e tiver 12-13 dígitos, é um número com código do país
  if (prepared.startsWith('55') && (prepared.length === 12 || prepared.length === 13)) {
    // Verifica se tem zero após o 55 (55021 → 5521)
    if (prepared.startsWith('550')) {
      prepared = '55' + prepared.substring(3);
    }
    return prepared;
  }
  
  // Se começar com 0 e tiver 10-11 dígitos, remove o zero (021 → 21)
  if (prepared.startsWith('0') && (prepared.length === 10 || prepared.length === 11)) {
    prepared = prepared.substring(1);
  }
  
  // Se tiver 10-11 dígitos (sem código do país), adiciona 55
  if (prepared.length === 10 || prepared.length === 11) {
    prepared = '55' + prepared;
  }
  
  return prepared;
}

/**
 * Normaliza entrada de telefone para formato padrão brasileiro
 * Aceita múltiplos formatos e retorna no formato 55DDNNNNNNNNN
 * 
 * @param {string} phone - Número em qualquer formato
 * @returns {Object} { normalized, original, format, isValid }
 */
function normalizePhoneInput(phone) {
  if (!phone || typeof phone !== 'string') {
    return {
      normalized: null,
      original: phone,
      format: 'invalid',
      isValid: false,
      error: 'Número vazio ou inválido'
    };
  }

  const original = phone.trim();
  
  // Remove caracteres não numéricos exceto +
  let cleaned = original.replace(/[^\d+]/g, '');
  
  // Detectar formato de entrada
  let format = 'unknown';
  
  // Formato internacional com +
  if (cleaned.startsWith('+55')) {
    format = 'international';
    cleaned = cleaned.substring(1); // Remove o +
  } else if (cleaned.startsWith('+')) {
    // Outro país - não suportado
    return {
      normalized: null,
      original,
      format: 'foreign',
      isValid: false,
      error: 'Apenas números brasileiros são suportados'
    };
  }
  
  // Remove caracteres não numéricos restantes
  cleaned = cleaned.replace(/\D/g, '');
  
  // Detectar formato baseado no tamanho
  if (cleaned.startsWith('55')) {
    if (cleaned.length === 12) {
      format = 'br_with_code_8digits'; // 55 + DDD + 8 dígitos (fixo)
    } else if (cleaned.length === 13) {
      format = 'br_with_code_9digits'; // 55 + DDD + 9 dígitos (celular)
    }
  } else if (cleaned.length === 10) {
    format = 'br_local_8digits'; // DDD + 8 dígitos
  } else if (cleaned.length === 11) {
    format = 'br_local_9digits'; // DDD + 9 dígitos
  } else if (cleaned.length === 8) {
    format = 'br_no_ddd_8digits'; // Apenas 8 dígitos (sem DDD)
  } else if (cleaned.length === 9) {
    format = 'br_no_ddd_9digits'; // Apenas 9 dígitos (sem DDD)
  }
  
  // Normalizar para formato padrão
  const normalized = preparePhoneForValidation(cleaned);
  
  // Validar resultado
  const isValid = normalized.length === 12 || normalized.length === 13;
  
  return {
    normalized: isValid ? normalized : null,
    original,
    format,
    isValid,
    error: isValid ? null : 'Formato de número não reconhecido'
  };
}

/**
 * Sugere correção para número de telefone mal formatado
 * 
 * @param {string} phone - Número possivelmente mal formatado
 * @returns {Object} { suggestion, reason, confidence }
 */
function suggestCorrection(phone) {
  if (!phone || typeof phone !== 'string') {
    return { suggestion: null, reason: 'Número vazio', confidence: 0 };
  }

  const cleaned = phone.replace(/\D/g, '');
  
  // Número muito curto
  if (cleaned.length < 8) {
    return {
      suggestion: null,
      reason: 'Número muito curto. Mínimo 8 dígitos.',
      confidence: 0
    };
  }
  
  // Número muito longo
  if (cleaned.length > 13) {
    return {
      suggestion: cleaned.substring(0, 13),
      reason: 'Número muito longo. Removidos dígitos extras.',
      confidence: 0.5
    };
  }
  
  // Número sem DDD (8-9 dígitos)
  if (cleaned.length === 8 || cleaned.length === 9) {
    return {
      suggestion: null,
      reason: 'Número sem DDD. Adicione o código de área (ex: 11, 21, 31).',
      confidence: 0,
      example: `Ex: 11${cleaned}`
    };
  }
  
  // Número com DDD mas sem código do país
  if (cleaned.length === 10 || cleaned.length === 11) {
    const suggestion = '55' + cleaned;
    return {
      suggestion,
      reason: 'Código do país adicionado automaticamente.',
      confidence: 0.9,
      formatted: formatPhoneForDisplay(suggestion)
    };
  }
  
  // Número com código do país mas com zero extra
  if (cleaned.startsWith('550') && (cleaned.length === 13 || cleaned.length === 14)) {
    const suggestion = '55' + cleaned.substring(3);
    return {
      suggestion,
      reason: 'Zero extra após código do país removido.',
      confidence: 0.95,
      formatted: formatPhoneForDisplay(suggestion)
    };
  }
  
  // Número parece correto
  if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
    return {
      suggestion: cleaned,
      reason: 'Número parece estar no formato correto.',
      confidence: 1.0,
      formatted: formatPhoneForDisplay(cleaned)
    };
  }
  
  return {
    suggestion: null,
    reason: 'Formato não reconhecido. Use: +55 (DDD) XXXXX-XXXX',
    confidence: 0
  };
}

/**
 * Formata número para exibição amigável
 * 
 * @param {string} phone - Número no formato 55DDNNNNNNNNN
 * @returns {string} Número formatado para exibição
 */
function formatPhoneForDisplay(phone) {
  if (!phone || phone.length < 12) return phone;
  
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 13) {
    // Celular: +55 (DD) 9XXXX-XXXX
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`;
  } else if (cleaned.length === 12) {
    // Fixo: +55 (DD) XXXX-XXXX
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
  }
  
  return phone;
}

/**
 * Valida número usando API WUZAPI /user/check
 * 
 * A API WUZAPI retorna o campo 'Query' que é o número exatamente como WhatsApp o reconhece.
 * Isso resolve o problema do 9: o cliente digita com o 9, mas WhatsApp pode reconhecer sem o 9.
 * A API cuida disso automaticamente.
 * 
 * @param {string} phone - Número em qualquer formato (cliente sempre digita com o 9)
 * @param {string} userToken - Token do usuário WUZAPI
 * @returns {Promise<Object>} { isValid, validatedPhone, jid, name, error }
 */
async function validatePhoneWithAPI(phone, userToken) {
  const prepared = preparePhoneForValidation(phone);
  
  if (!prepared) {
    return {
      isValid: false,
      error: 'Número vazio ou inválido',
      validatedPhone: null
    };
  }
  
  // Verifica cache
  const cacheKey = `${userToken}:${prepared}`;
  const cached = validationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug('PhoneValidationService: usando cache', { 
      phone: prepared,
      validatedPhone: cached.result.validatedPhone 
    });
    return cached.result;
  }
  
  try {
    logger.debug('PhoneValidationService: chamando API /user/check', { 
      phone: prepared,
      userToken: userToken?.substring(0, 10) + '...'
    });
    
    const client = getWuzapiClient();
    
    const response = await client.post('/user/check', {
      Phone: [prepared]
    }, {
      headers: {
        'token': userToken,
        'Content-Type': 'application/json'
      }
    });
    
    logger.debug('PhoneValidationService: resposta da API', {
      phone: prepared,
      success: response.success,
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : [],
      hasUsers: response.data?.Users?.length > 0,
      fullResponse: JSON.stringify(response).substring(0, 500)
    });
    
    if (!response.success) {
      // Verificar se é erro de autenticação/conexão
      const isAuthError = response.status === 401 || response.status === 403;
      const isConnectionError = response.status === 404 || 
        (response.error && (
          response.error.includes('not connected') || 
          response.error.includes('disconnected') ||
          response.error.includes('not logged')
        ));
      
      logger.warn('PhoneValidationService: API retornou erro', {
        phone: prepared,
        status: response.status,
        error: response.error,
        isAuthError,
        isConnectionError,
        fullResponse: JSON.stringify(response).substring(0, 500)
      });
      
      let errorMessage = response.error || 'Erro desconhecido';
      if (isAuthError) {
        errorMessage = 'Token inválido ou expirado';
      } else if (isConnectionError) {
        errorMessage = 'Instância WhatsApp não está conectada';
      }
      
      return {
        isValid: false,
        error: `Erro na validação: ${errorMessage}`,
        validatedPhone: null
      };
    }
    
    // A API retorna Users dentro de data.data.Users
    const users = response.data?.data?.Users || response.data?.Users || [];
    if (users.length === 0) {
      logger.warn('PhoneValidationService: Resposta sem Users', {
        phone: prepared,
        dataKeys: response.data ? Object.keys(response.data) : [],
        fullResponse: JSON.stringify(response).substring(0, 500)
      });
      return {
        isValid: false,
        error: 'Resposta inválida da API',
        validatedPhone: null
      };
    }
    
    const user = users[0];
    
    if (!user.IsInWhatsapp) {
      const result = {
        isValid: false,
        error: 'Número não está registrado no WhatsApp',
        validatedPhone: null
      };
      
      // Cacheia resultado negativo
      setCacheEntry(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    }
    
    // Número é válido - extrair o número do JID (sem o sufixo @s.whatsapp.net)
    // O JID é o formato correto que WhatsApp usa internamente
    // Exemplo: JID = "553194974759@s.whatsapp.net" → número = "553194974759"
    const validatedPhone = user.JID.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
    
    const result = {
      isValid: true,
      validatedPhone: validatedPhone, // Número extraído do JID (sem sufixo)
      jid: user.JID,
      name: user.VerifiedName || null,
      error: null
    };
    
    // Cacheia resultado positivo
    setCacheEntry(cacheKey, { result, timestamp: Date.now() });
    
    logger.info('PhoneValidationService: validação bem-sucedida', {
      original: prepared,
      validatedPhone: user.Query,
      jid: user.JID
    });
    
    return result;
  } catch (error) {
    logger.error('PhoneValidationService: erro ao validar', {
      phone: prepared,
      error: error.message,
      stack: error.stack
    });
    
    return {
      isValid: false,
      error: `Erro na validação: ${error.message}`,
      validatedPhone: null
    };
  }
}

/**
 * Tenta validar um número específico na API WUZAPI
 * @private
 */
async function tryValidatePhone(phone, userToken) {
  try {
    const client = getWuzapiClient();
    
    const response = await client.post('/user/check', {
      Phone: [phone]
    }, {
      headers: {
        'token': userToken
      }
    });
    
    if (!response.success) {
      return {
        isValid: false,
        error: `Erro na validação: ${response.error || 'Erro desconhecido'}`,
        validatedPhone: null
      };
    }
    
    const users = response.data?.Users || [];
    if (users.length === 0) {
      return {
        isValid: false,
        error: 'Resposta inválida da API',
        validatedPhone: null
      };
    }
    
    const user = users[0];
    
    if (!user.IsInWhatsapp) {
      return {
        isValid: false,
        error: 'Número não está registrado no WhatsApp',
        validatedPhone: null
      };
    }
    
    // Número é válido
    return {
      isValid: true,
      validatedPhone: user.Query,
      jid: user.JID,
      name: user.VerifiedName || null,
      error: null
    };
  } catch (error) {
    return {
      isValid: false,
      error: error.message,
      validatedPhone: null
    };
  }
}

/**
 * Gera variações de um número para tentar validar
 * Útil quando o cliente digita o número de forma incorreta
 * @private
 */
function generatePhoneVariations(phone) {
  const variations = [];
  
  // Se tem 12 dígitos (falta um 9), tenta adicionar 9 em diferentes posições
  if (phone.length === 12 && phone.startsWith('55')) {
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    
    // Tenta adicionar 9 no início do número
    variations.push(`55${ddd}9${number}`);
    
    // Tenta adicionar 9 em outras posições
    for (let i = 0; i < number.length; i++) {
      variations.push(`55${ddd}${number.substring(0, i)}9${number.substring(i)}`);
    }
  }
  
  // Se tem 11 dígitos (sem código), adiciona 55
  if (phone.length === 11 && !phone.startsWith('55')) {
    variations.push(`55${phone}`);
  }
  
  // Se tem 13 dígitos, tenta remover um dígito
  if (phone.length === 13 && phone.startsWith('55')) {
    const ddd = phone.substring(2, 4);
    const number = phone.substring(4);
    
    // Tenta remover cada dígito do número
    for (let i = 0; i < number.length; i++) {
      variations.push(`55${ddd}${number.substring(0, i)}${number.substring(i + 1)}`);
    }
  }
  
  return variations;
}

/**
 * Valida múltiplos números em uma única chamada à API
 * 
 * @param {string[]} phones - Array de números em qualquer formato
 * @param {string} userToken - Token do usuário WUZAPI
 * @returns {Promise<Object[]>} Array de resultados de validação
 */
async function validatePhonesWithAPI(phones, userToken) {
  if (!Array.isArray(phones) || phones.length === 0) {
    return [];
  }
  
  // Prepara todos os números
  const preparedPhones = phones.map(p => preparePhoneForValidation(p));
  
  // Filtra números vazios
  const validPrepared = preparedPhones.filter(p => p);
  
  if (validPrepared.length === 0) {
    return phones.map(() => ({
      isValid: false,
      error: 'Número vazio ou inválido',
      validatedPhone: null
    }));
  }
  
  try {
    logger.debug('PhoneValidationService: validando múltiplos números', {
      count: validPrepared.length
    });
    
    // Chama API WUZAPI para validar todos
    const response = await wuzapiClient.post('/user/check', {
      Phone: validPrepared
    }, {
      headers: {
        'token': userToken
      }
    });
    
    if (!response.success) {
      logger.warn('PhoneValidationService: API retornou erro para múltiplos', {
        count: validPrepared.length,
        error: response.error
      });
      
      return phones.map(() => ({
        isValid: false,
        error: `Erro na validação: ${response.error || 'Erro desconhecido'}`,
        validatedPhone: null
      }));
    }
    
    // Mapeia resultados para os números originais
    const users = response.data?.Users || [];
    const results = [];
    
    for (let i = 0; i < phones.length; i++) {
      const prepared = preparedPhones[i];
      
      if (!prepared) {
        results.push({
          isValid: false,
          error: 'Número vazio ou inválido',
          validatedPhone: null
        });
        continue;
      }
      
      const user = users.find(u => u.Query === prepared);
      
      if (!user) {
        results.push({
          isValid: false,
          error: 'Número não encontrado na resposta da API',
          validatedPhone: null
        });
        continue;
      }
      
      if (!user.IsInWhatsapp) {
        results.push({
          isValid: false,
          error: 'Número não está registrado no WhatsApp',
          validatedPhone: null
        });
        continue;
      }
      
      // Extrair número do JID (sem sufixo)
      const validatedPhone = user.JID.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
      
      results.push({
        isValid: true,
        validatedPhone: validatedPhone,
        jid: user.JID,
        name: user.VerifiedName || null,
        error: null
      });
      
      // Cacheia resultado
      const cacheKey = `${userToken}:${prepared}`;
      setCacheEntry(cacheKey, {
        result: results[i],
        timestamp: Date.now()
      });
    }
    
    return results;
  } catch (error) {
    logger.error('PhoneValidationService: erro ao validar múltiplos', {
      count: validPrepared.length,
      error: error.message
    });
    
    return phones.map(() => ({
      isValid: false,
      error: `Erro na validação: ${error.message}`,
      validatedPhone: null
    }));
  }
}

/**
 * Limpa o cache de validações
 */
function clearCache() {
  validationCache.clear();
  logger.debug('PhoneValidationService: cache limpo');
}

/**
 * Retorna estatísticas do cache
 */
function getCacheStats() {
  return {
    size: validationCache.size,
    maxSize: MAX_CACHE_SIZE,
    utilizationPercent: ((validationCache.size / MAX_CACHE_SIZE) * 100).toFixed(2),
    ttlMs: CACHE_TTL,
    entries: Array.from(validationCache.entries()).map(([key, value]) => ({
      key,
      cached: Date.now() - value.timestamp < CACHE_TTL,
      age: Date.now() - value.timestamp
    }))
  };
}

module.exports = {
  preparePhoneForValidation,
  normalizePhoneInput,
  suggestCorrection,
  formatPhoneForDisplay,
  validatePhoneWithAPI,
  validatePhonesWithAPI,
  clearCache,
  getCacheStats,
  MAX_CACHE_SIZE
};
