/**
 * Utilitários para validação e sanitização de números de telefone (Backend)
 * Mantém paridade com src/lib/phone-utils.ts do frontend
 */

/**
 * Remove sufixos do WhatsApp (@c.us, @s.whatsapp.net, @lid)
 * 
 * @param {string} phone - Número de telefone com possível sufixo WhatsApp
 * @returns {string} Número sem sufixo WhatsApp
 * 
 * @example
 * removeWhatsAppSuffix('5521975705641@c.us') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641@s.whatsapp.net') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641@lid') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641') // '5521975705641'
 */
function removeWhatsAppSuffix(phone) {
  if (!phone) return '';
  return phone
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '');
}

/**
 * Remove todos os caracteres não numéricos de um número de telefone
 * Primeiro remove sufixos do WhatsApp, depois remove caracteres especiais
 * 
 * @param {string} phone - Número de telefone a ser sanitizado
 * @returns {string} Número contendo apenas dígitos
 * 
 * @example
 * sanitizePhoneNumber('+55 (21) 97570-5641') // '5521975705641'
 * sanitizePhoneNumber('21 9 7570-5641') // '21975705641'
 * sanitizePhoneNumber('5521975705641@c.us') // '5521975705641'
 * sanitizePhoneNumber('(21)97570-5641') // '21975705641'
 */
function sanitizePhoneNumber(phone) {
  // Primeiro remove sufixos do WhatsApp
  const withoutSuffix = removeWhatsAppSuffix(phone);
  // Depois remove todos os caracteres não numéricos
  return withoutSuffix.replace(/\D/g, '');
}

/**
 * Remove zero inicial do DDD (021 → 21, 011 → 11)
 * Suporta números com e sem código do país
 * 
 * @param {string} phone - Número de telefone sanitizado
 * @returns {string} Número sem zero inicial no DDD
 * 
 * @example
 * removeLeadingZeroFromDDD('55021975705641') // '5521975705641'
 * removeLeadingZeroFromDDD('021975705641') // '21975705641'
 * removeLeadingZeroFromDDD('5521975705641') // '5521975705641'
 */
function removeLeadingZeroFromDDD(phone) {
  // Se tem código do país (55) e zero após ele
  if (phone.startsWith('550') && phone.length >= 13) {
    return '55' + phone.substring(3);
  }
  // Se não tem código do país e começa com zero
  if (phone.startsWith('0') && phone.length >= 11) {
    return phone.substring(1);
  }
  return phone;
}

/**
 * Normaliza número para formato WhatsApp (55DDNNNNNNNNN)
 * Suporta TODOS os formatos possíveis do WhatsApp
 * 
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {string} Número normalizado no formato 55DDNNNNNNNNN
 * 
 * @example
 * // Com código do país
 * normalizePhoneNumber('5521975705641') // '5521975705641'
 * normalizePhoneNumber('+5521975705641') // '5521975705641'
 * normalizePhoneNumber('55 21 97570-5641') // '5521975705641'
 * normalizePhoneNumber('+55 (21) 97570-5641') // '5521975705641'
 * 
 * // Sem código do país
 * normalizePhoneNumber('21975705641') // '5521975705641'
 * normalizePhoneNumber('(21) 97570-5641') // '5521975705641'
 * 
 * // Com zero no DDD
 * normalizePhoneNumber('55021975705641') // '5521975705641'
 * normalizePhoneNumber('021975705641') // '5521975705641'
 * 
 * // Formato WhatsApp JID
 * normalizePhoneNumber('5521975705641@c.us') // '5521975705641'
 */
function normalizePhoneNumber(phone) {
  // 1. Sanitiza (remove sufixos e caracteres especiais)
  let sanitized = sanitizePhoneNumber(phone);
  
  // 2. Remove zero inicial do DDD
  sanitized = removeLeadingZeroFromDDD(sanitized);
  
  // 3. Adiciona código do país se necessário
  // Se já tem código do país (55) e tamanho correto
  if (sanitized.startsWith('55') && sanitized.length >= 12 && sanitized.length <= 13) {
    return sanitized;
  }
  
  // Se não tem código do país, adiciona 55
  if (sanitized.length >= 10 && sanitized.length <= 11) {
    return '55' + sanitized;
  }
  
  // Para números internacionais ou outros casos, retorna como está
  return sanitized;
}

/**
 * Valida formato de número brasileiro
 * Aceita: 10-11 dígitos (sem código) ou 12-13 dígitos (com código 55)
 * 
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {Object} Objeto com resultado da validação
 * @returns {boolean} returns.isValid - Se o número é válido
 * @returns {string} [returns.error] - Mensagem de erro se inválido
 * @returns {string} [returns.normalized] - Número normalizado se válido
 * 
 * @example
 * validatePhoneFormat('5521975705641') // { isValid: true, normalized: '5521975705641' }
 * validatePhoneFormat('21 97570-5641') // { isValid: true, normalized: '5521975705641' }
 * validatePhoneFormat('123') // { isValid: false, error: '...' }
 */
function validatePhoneFormat(phone) {
  const sanitized = sanitizePhoneNumber(phone);
  
  if (!sanitized) {
    return {
      isValid: false,
      error: 'Número não pode estar vazio'
    };
  }
  
  // Normaliza o número
  const normalized = normalizePhoneNumber(sanitized);
  
  // Deve ter 12 ou 13 dígitos após normalização (55 + 10 ou 11 dígitos)
  if (normalized.length < 12 || normalized.length > 13) {
    return {
      isValid: false,
      error: `Número deve ter 10 ou 11 dígitos (você digitou ${sanitized.length}). Exemplo: 21975705641 ou 5521975705641`
    };
  }
  
  // Deve começar com 55
  if (!normalized.startsWith('55')) {
    return {
      isValid: false,
      error: 'Número deve começar com código do país 55 (Brasil)'
    };
  }
  
  // Extrai DDD e número
  const withoutCountry = normalized.substring(2);
  const ddd = withoutCountry.substring(0, 2);
  const number = withoutCountry.substring(2);
  
  // Valida DDD (11-99)
  const dddNum = parseInt(ddd);
  if (dddNum < 11 || dddNum > 99) {
    return {
      isValid: false,
      error: `DDD inválido: ${ddd}. Deve estar entre 11 e 99`
    };
  }
  
  // Valida tamanho do número (8 ou 9 dígitos)
  if (number.length !== 8 && number.length !== 9) {
    return {
      isValid: false,
      error: `Número deve ter 8 ou 9 dígitos após o DDD (você digitou ${number.length})`
    };
  }
  
  // Se tem 9 dígitos, deve começar com 9 (celular)
  if (number.length === 9 && !number.startsWith('9')) {
    return {
      isValid: false,
      error: 'Número com 9 dígitos deve começar com 9 (celular)'
    };
  }
  
  return {
    isValid: true,
    normalized,
    error: undefined
  };
}

/**
 * Formata número para exibição visual
 * 
 * @param {string} phone - Número de telefone em qualquer formato
 * @returns {string} Número formatado para exibição: +55 (DD) NNNNN-NNNN ou +55 (DD) NNNN-NNNN
 * 
 * @example
 * formatPhoneDisplay('5521975705641') // '+55 (21) 97570-5641'
 * formatPhoneDisplay('552137705641') // '+55 (21) 3770-5641'
 * formatPhoneDisplay('21975705641') // '+55 (21) 97570-5641'
 */
function formatPhoneDisplay(phone) {
  const sanitized = sanitizePhoneNumber(phone);
  const normalized = normalizePhoneNumber(sanitized);
  
  if (normalized.length < 12) {
    return phone; // Retorna original se não conseguir normalizar
  }
  
  const withoutCountry = normalized.substring(2);
  const ddd = withoutCountry.substring(0, 2);
  const number = withoutCountry.substring(2);
  
  if (number.length === 9) {
    // Celular: +55 (DD) 9NNNN-NNNN
    return `+55 (${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
  } else {
    // Fixo: +55 (DD) NNNN-NNNN
    return `+55 (${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
  }
}

/**
 * Cache para resoluções de LID
 * Armazena: { lidNumber: { phone, timestamp } }
 */
const lidCache = new Map();
const LID_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Resolve um LID (Linked Device ID) para o número real via API WUZAPI
 * 
 * Estrutura do webhook com @lid:
 * - Chat: "1234567890@lid" (Linked Device ID)
 * - Sender: "5511999999999@s.whatsapp.net" (remetente)
 * 
 * Quando Chat termina com @lid, precisamos chamar a API para obter o número real
 * 
 * @param {string} lidNumber - Número do LID (sem sufixo @lid)
 * @param {string} userToken - Token do usuário WUZAPI
 * @returns {Promise<string|null>} Número real ou null se não encontrado
 * 
 * @example
 * // Resolver LID para número real
 * const phone = await resolveLidToPhone('1234567890', userToken);
 * // Returns: '5511999999999'
 */
async function resolveLidToPhone(lidNumber, userToken) {
  const { logger } = require('./logger');
  const wuzapiClient = require('./wuzapiClient');
  
  if (!lidNumber || !userToken) {
    logger.warn('resolveLidToPhone: lidNumber ou userToken ausente', {
      hasLidNumber: !!lidNumber,
      hasUserToken: !!userToken
    });
    return null;
  }
  
  // Verificar cache
  const cacheKey = `${userToken}:${lidNumber}`;
  const cached = lidCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < LID_CACHE_TTL) {
    logger.debug('resolveLidToPhone: usando cache', { lidNumber });
    return cached.phone;
  }
  
  try {
    logger.debug('resolveLidToPhone: chamando API /user/lid', { lidNumber });
    
    const response = await wuzapiClient.get(`/user/lid/${lidNumber}`, {
      headers: {
        'token': userToken
      }
    });
    
    if (!response.success) {
      logger.warn('resolveLidToPhone: API retornou erro', {
        lidNumber,
        status: response.status,
        error: response.error
      });
      return null;
    }
    
    const jid = response.data?.jid;
    if (!jid) {
      logger.warn('resolveLidToPhone: resposta sem campo jid', {
        lidNumber,
        responseKeys: response.data ? Object.keys(response.data) : []
      });
      return null;
    }
    
    // Extrai número do JID (ex: "5511999999999@s.whatsapp.net" -> "5511999999999")
    const phone = jid.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '');
    
    // Cacheia resultado
    lidCache.set(cacheKey, { phone, timestamp: Date.now() });
    
    logger.debug('resolveLidToPhone: LID resolvido com sucesso', {
      lidNumber,
      phone
    });
    
    return phone;
  } catch (error) {
    logger.error('resolveLidToPhone: erro ao resolver LID', {
      lidNumber,
      error: error.message
    });
    return null;
  }
}

/**
 * Extrai número de telefone de evento webhook WUZAPI
 * Trata casos especiais como @lid onde o número precisa ser resolvido via API
 * 
 * Estrutura do webhook:
 * - Info.Chat: JID do chat (pode ser @s.whatsapp.net, @g.us, @lid)
 * - Info.Sender: JID do remetente (importante para grupos)
 * - Info.IsFromMe: Se a mensagem é do próprio usuário
 * - Info.IsGroup: Se é mensagem de grupo
 * 
 * Tipos de JID:
 * - @s.whatsapp.net: Chat individual (usar Chat)
 * - @c.us: Formato antigo (usar Chat)
 * - @g.us: Grupo (usar Sender para remetente)
 * - @lid: Linked Device ID (resolver via API /user/lid)
 * 
 * @param {Object} event - Evento do webhook WUZAPI
 * @param {string} userToken - Token do usuário WUZAPI (necessário para resolver LID)
 * @returns {Promise<string>} Número normalizado ou string vazia se não encontrado
 * 
 * @example
 * // Chat individual
 * extractPhoneFromWebhook({ Info: { Chat: '5521975705641@s.whatsapp.net' } })
 * // Returns: '5521975705641'
 * 
 * // Grupo (usar Sender)
 * extractPhoneFromWebhook({ 
 *   Info: { 
 *     Chat: '123456789-1234567890@g.us',
 *     Sender: '5521975705641@s.whatsapp.net'
 *   } 
 * })
 * // Returns: '5521975705641'
 * 
 * // Chat com @lid (resolver via API)
 * extractPhoneFromWebhook({ 
 *   Info: { 
 *     Chat: '1234567890@lid',
 *     Sender: '5521975705641@s.whatsapp.net'
 *   }
 * }, userToken)
 * // Returns: '5511999999999' (resolvido via API)
 * 
 * // Webhook sem Info
 * extractPhoneFromWebhook({})
 * // Returns: ''
 */
async function extractPhoneFromWebhook(event, userToken = null) {
  const { logger } = require('./logger');
  
  // Verifica se o evento tem a estrutura Info
  if (!event || !event.Info) {
    logger.warn('extractPhoneFromWebhook: evento sem campo Info', { 
      hasEvent: !!event,
      eventKeys: event ? Object.keys(event) : []
    });
    return '';
  }
  
  const info = event.Info;
  const chat = info.Chat || '';
  const sender = info.Sender || '';
  
  let source = '';
  
  // Determinar qual campo usar baseado no tipo de JID
  if (chat.endsWith('@lid')) {
    // Chat com @lid - precisa resolver via API
    if (!userToken) {
      logger.warn('extractPhoneFromWebhook: Chat com @lid mas userToken ausente', {
        chat,
        infoKeys: Object.keys(info)
      });
      // Fallback: tentar usar Sender se disponível
      source = sender;
    } else {
      // Extrair número do LID e resolver via API
      const lidNumber = chat.replace('@lid', '');
      const resolvedPhone = await resolveLidToPhone(lidNumber, userToken);
      
      if (resolvedPhone) {
        source = resolvedPhone;
      } else {
        // Fallback: usar Sender se resolução falhar
        logger.warn('extractPhoneFromWebhook: falha ao resolver LID, usando Sender', {
          chat,
          sender
        });
        source = sender;
      }
    }
  } else if (chat.endsWith('@g.us')) {
    // Grupo - usar Sender para obter o remetente
    if (!sender) {
      logger.warn('extractPhoneFromWebhook: Grupo sem Sender', {
        chat,
        infoKeys: Object.keys(info)
      });
      return '';
    }
    source = sender;
  } else {
    // Chat normal (@s.whatsapp.net ou @c.us) - usar Chat
    if (!chat) {
      logger.warn('extractPhoneFromWebhook: Chat ausente', {
        infoKeys: Object.keys(info)
      });
      return '';
    }
    source = chat;
  }
  
  // Normaliza o número extraído
  const normalized = normalizePhoneNumber(source);
  
  return normalized;
}

module.exports = {
  removeWhatsAppSuffix,
  sanitizePhoneNumber,
  removeLeadingZeroFromDDD,
  normalizePhoneNumber,
  validatePhoneFormat,
  formatPhoneDisplay,
  extractPhoneFromWebhook,
  resolveLidToPhone
};
