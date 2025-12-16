/**
 * Utilitários para validação e sanitização de números de telefone
 * Suporta TODOS os formatos de número do WhatsApp
 */

/**
 * Remove sufixos do WhatsApp (@c.us, @s.whatsapp.net, @lid)
 * 
 * @param phone - Número de telefone com possível sufixo WhatsApp
 * @returns Número sem sufixo WhatsApp
 * 
 * @example
 * removeWhatsAppSuffix('5521975705641@c.us') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641@s.whatsapp.net') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641@lid') // '5521975705641'
 * removeWhatsAppSuffix('5521975705641') // '5521975705641'
 */
export const removeWhatsAppSuffix = (phone: string): string => {
  return phone
    .replace(/@c\.us$/i, '')
    .replace(/@s\.whatsapp\.net$/i, '')
    .replace(/@lid$/i, '');
};

/**
 * Remove todos os caracteres não numéricos de um número de telefone
 * Primeiro remove sufixos do WhatsApp, depois remove caracteres especiais
 * 
 * @param phone - Número de telefone a ser sanitizado
 * @returns Número contendo apenas dígitos
 * 
 * @example
 * sanitizePhoneNumber('+55 (21) 97570-5641') // '5521975705641'
 * sanitizePhoneNumber('21 9 7570-5641') // '21975705641'
 * sanitizePhoneNumber('5521975705641@c.us') // '5521975705641'
 * sanitizePhoneNumber('(21)97570-5641') // '21975705641'
 */
export const sanitizePhoneNumber = (phone: string): string => {
  // Primeiro remove sufixos do WhatsApp
  const withoutSuffix = removeWhatsAppSuffix(phone);
  // Depois remove todos os caracteres não numéricos
  return withoutSuffix.replace(/\D/g, '');
};

/**
 * Remove zero inicial do DDD (021 → 21, 011 → 11)
 * Suporta números com e sem código do país
 * 
 * @param phone - Número de telefone sanitizado
 * @returns Número sem zero inicial no DDD
 * 
 * @example
 * removeLeadingZeroFromDDD('55021975705641') // '5521975705641'
 * removeLeadingZeroFromDDD('021975705641') // '21975705641'
 * removeLeadingZeroFromDDD('5521975705641') // '5521975705641'
 */
export const removeLeadingZeroFromDDD = (phone: string): string => {
  // Se tem código do país (55) e zero após ele
  if (phone.startsWith('550') && phone.length >= 13) {
    return '55' + phone.substring(3);
  }
  // Se não tem código do país e começa com zero
  if (phone.startsWith('0') && phone.length >= 11) {
    return phone.substring(1);
  }
  return phone;
};

/**
 * Normaliza número para formato WhatsApp (55DDNNNNNNNNN)
 * Suporta TODOS os formatos possíveis do WhatsApp
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Número normalizado no formato 55DDNNNNNNNNN
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
export const normalizePhoneNumber = (phone: string): string => {
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
};

/**
 * Valida formato de número brasileiro
 * Aceita: 10-11 dígitos (sem código) ou 12-13 dígitos (com código 55)
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Objeto com resultado da validação
 * 
 * @example
 * validatePhoneFormat('5521975705641') // { isValid: true, normalized: '5521975705641' }
 * validatePhoneFormat('21 97570-5641') // { isValid: true, normalized: '5521975705641' }
 * validatePhoneFormat('123') // { isValid: false, error: '...' }
 */
export const validatePhoneFormat = (phone: string): {
  isValid: boolean;
  error?: string;
  normalized?: string;
} => {
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
};

/**
 * Formata número para exibição visual
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Número formatado para exibição: +55 (DD) NNNNN-NNNN ou +55 (DD) NNNN-NNNN
 * 
 * @example
 * formatPhoneDisplay('5521975705641') // '+55 (21) 97570-5641'
 * formatPhoneDisplay('552137705641') // '+55 (21) 3770-5641'
 * formatPhoneDisplay('21975705641') // '+55 (21) 97570-5641'
 */
export const formatPhoneDisplay = (phone: string): string => {
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
};

/**
 * Interface para resultado de validação completa
 */
export interface PhoneValidationResult {
  isValid: boolean;
  normalized?: string;
  formatted?: string;
  contactName?: string;
  error?: string;
  warning?: string;
}

/**
 * Valida número completo (formato + existência no WhatsApp)
 * 
 * @param phone - Número de telefone em qualquer formato
 * @param instance - Token da instância WUZAPI
 * @param checkWhatsApp - Se deve verificar existência no WhatsApp (padrão: true)
 * @returns Resultado completo da validação
 * 
 * @example
 * const result = await validatePhoneNumber('21975705641', 'token123', true);
 * if (result.isValid) {
 *   console.log(`Número válido: ${result.formatted}`);
 *   if (result.contactName) {
 *     console.log(`Contato: ${result.contactName}`);
 *   }
 * } else {
 *   console.error(result.error);
 * }
 */
export const validatePhoneNumber = async (
  phone: string,
  instance: string,
  checkWhatsApp: boolean = true
): Promise<PhoneValidationResult> => {
  // Primeiro valida o formato
  const formatValidation = validatePhoneFormat(phone);
  
  if (!formatValidation.isValid) {
    return {
      isValid: false,
      error: formatValidation.error
    };
  }
  
  const normalized = formatValidation.normalized!;
  const formatted = formatPhoneDisplay(normalized);
  
  // Se não deve verificar WhatsApp, retorna sucesso
  if (!checkWhatsApp) {
    return {
      isValid: true,
      normalized,
      formatted
    };
  }
  
  // Verifica se existe no WhatsApp
  try {
    // Obter CSRF token
    const csrfResponse = await fetch('/api/auth/csrf-token');
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;
    
    // Chama a API do backend para verificar o contato
    const response = await fetch('/api/chat/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance,
        'csrf-token': csrfToken
      },
      body: JSON.stringify({
        Phone: normalized
      })
    });

    if (!response.ok) {
      // Se houver erro na verificação, permite continuar com aviso
      return {
        isValid: true,
        normalized,
        formatted,
        warning: 'Não foi possível verificar o número no WhatsApp. Continuando mesmo assim...'
      };
    }

    const data = await response.json();
    
    // Verifica se o número existe no WhatsApp
    if (!data.success || !data.data) {
      return {
        isValid: true,
        normalized,
        formatted,
        warning: 'Não foi possível verificar o número no WhatsApp. Continuando mesmo assim...'
      };
    }
    
    // Se o número não existe no WhatsApp
    if (data.data.exists === false) {
      return {
        isValid: false,
        normalized,
        formatted,
        error: 'Este número não está cadastrado no WhatsApp'
      };
    }
    
    return {
      isValid: true,
      normalized,
      formatted,
      contactName: data.data.name || data.data.pushname
    };
  } catch (error) {
    // Em caso de erro na verificação, permite continuar com aviso
    return {
      isValid: true,
      normalized,
      formatted,
      warning: 'Não foi possível verificar o número no WhatsApp. Continuando mesmo assim...'
    };
  }
};

/**
 * Sugere formato correto para um número de telefone
 * Retorna null se o número já está em formato ideal ou não pode ser corrigido
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Sugestão de formato ou null
 * 
 * @example
 * suggestPhoneFormat('21975705641') // '+55 21 97570-5641'
 * suggestPhoneFormat('+5521975705641') // '+55 21 97570-5641'
 * suggestPhoneFormat('+55 21 97570-5641') // null (já está formatado)
 */
export const suggestPhoneFormat = (phone: string): string | null => {
  if (!phone || phone.trim().length < 8) {
    return null;
  }

  const sanitized = sanitizePhoneNumber(phone);
  
  // Se não conseguir normalizar, não sugere
  if (sanitized.length < 10) {
    return null;
  }

  const normalized = normalizePhoneNumber(sanitized);
  
  // Se não conseguir normalizar corretamente, não sugere
  if (normalized.length < 12 || normalized.length > 13) {
    return null;
  }

  // Formata para exibição
  const formatted = formatPhoneDisplay(normalized);
  
  // Se o formato sugerido é igual ao input (ignorando espaços), não sugere
  const inputClean = phone.replace(/\s/g, '').toLowerCase();
  const formattedClean = formatted.replace(/\s/g, '').toLowerCase();
  
  if (inputClean === formattedClean || phone === formatted) {
    return null;
  }

  return formatted;
};

// ============================================================================
// FUNÇÕES LEGADAS (mantidas para compatibilidade)
// ============================================================================

/**
 * @deprecated Use validatePhoneFormat() ao invés
 */
export const validateBrazilianPhone = (phone: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
  formatted?: string;
} => {
  const result = validatePhoneFormat(phone);
  return {
    isValid: result.isValid,
    sanitized: result.normalized || sanitizePhoneNumber(phone),
    error: result.error,
    formatted: result.normalized ? formatPhoneDisplay(result.normalized) : undefined
  };
};

/**
 * @deprecated Use validatePhoneFormat() ao invés
 */
export const validateInternationalPhone = (phone: string): {
  isValid: boolean;
  sanitized: string;
  error?: string;
} => {
  const sanitized = sanitizePhoneNumber(phone);
  
  if (!sanitized) {
    return {
      isValid: false,
      sanitized: '',
      error: 'Número de telefone não pode estar vazio'
    };
  }
  
  // Número internacional deve ter entre 8 e 15 dígitos
  if (sanitized.length < 8 || sanitized.length > 15) {
    return {
      isValid: false,
      sanitized,
      error: `Número inválido. Deve ter entre 8 e 15 dígitos. Você digitou ${sanitized.length} dígitos.`
    };
  }
  
  return {
    isValid: true,
    sanitized,
    error: undefined
  };
};
