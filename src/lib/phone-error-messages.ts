/**
 * Mensagens de erro para validação de telefone
 * Centralizadas para consistência entre frontend e backend
 */

export const PHONE_ERROR_MESSAGES = {
  // Erros de formato
  EMPTY: 'Número não pode estar vazio',
  INVALID_LENGTH: (length: number) => 
    `Número deve ter 10 ou 11 dígitos (você digitou ${length}). Exemplo: 21975705641 ou 5521975705641`,
  INVALID_COUNTRY_CODE: 'Número deve começar com código do país 55 (Brasil)',
  INVALID_DDD: (ddd: string) => 
    `DDD inválido: ${ddd}. Deve estar entre 11 e 99`,
  INVALID_NUMBER_LENGTH: (length: number) => 
    `Número deve ter 8 ou 9 dígitos após o DDD (você digitou ${length})`,
  MOBILE_MUST_START_WITH_9: 'Número com 9 dígitos deve começar com 9 (celular)',
  
  // Erros de verificação WhatsApp
  NOT_IN_WHATSAPP: 'Este número não está cadastrado no WhatsApp',
  VERIFICATION_TIMEOUT: 'Timeout ao verificar número (5s)',
  VERIFICATION_ERROR: 'Não foi possível verificar o número. Continuando mesmo assim...',
  VERIFICATION_NETWORK_ERROR: 'Erro de rede ao verificar número',
  
  // Erros de importação
  CSV_EMPTY: 'Arquivo CSV vazio',
  CSV_NO_PHONE_COLUMN: 'CSV deve conter coluna "phone" ou "telefone"',
  CSV_FILE_TOO_LARGE: (maxSizeMB: number) => 
    `Arquivo muito grande. Máximo: ${maxSizeMB}MB`,
  CSV_INVALID_TYPE: 'Apenas arquivos CSV são permitidos',
  
  // Erros de lista
  NO_NUMBERS_PROVIDED: 'É necessário fornecer pelo menos um número',
  LIST_TOO_LARGE: (max: number) => 
    `Máximo de ${max} números por vez`,
  
  // Mensagens de sucesso
  NUMBER_VERIFIED: (formatted: string) => 
    `Número válido: ${formatted}`,
  CONTACT_FOUND: (name: string) => 
    `Contato encontrado: ${name}`,
  NUMBERS_VALIDATED: (valid: number, invalid: number) => 
    `${valid} números válidos, ${invalid} inválidos`,
  
  // Avisos
  WARNING_NETWORK_ERROR: 'Não foi possível verificar o número no WhatsApp. Continuando mesmo assim...',
  WARNING_DUPLICATES_REMOVED: (count: number) => 
    `${count} contatos duplicados removidos`,
} as const;

/**
 * Mensagens de erro para o backend (JavaScript)
 * Mantém compatibilidade com código CommonJS
 */
export const PHONE_ERROR_MESSAGES_JS = {
  EMPTY: 'Número não pode estar vazio',
  INVALID_LENGTH: (length: number) => 
    `Número deve ter 10 ou 11 dígitos (você digitou ${length}). Exemplo: 21975705641 ou 5521975705641`,
  INVALID_COUNTRY_CODE: 'Número deve começar com código do país 55 (Brasil)',
  INVALID_DDD: (ddd: string) => 
    `DDD inválido: ${ddd}. Deve estar entre 11 e 99`,
  INVALID_NUMBER_LENGTH: (length: number) => 
    `Número deve ter 8 ou 9 dígitos após o DDD (você digitou ${length})`,
  MOBILE_MUST_START_WITH_9: 'Número com 9 dígitos deve começar com 9 (celular)',
  NOT_IN_WHATSAPP: 'Este número não está cadastrado no WhatsApp',
  VERIFICATION_TIMEOUT: 'Timeout ao verificar número (5s)',
  VERIFICATION_ERROR: 'Não foi possível verificar o número',
  CSV_EMPTY: 'Arquivo CSV vazio',
  CSV_NO_PHONE_COLUMN: 'CSV deve conter coluna "phone" ou "telefone"',
  CSV_FILE_TOO_LARGE: (maxSizeMB: number) => 
    `Arquivo muito grande. Máximo: ${maxSizeMB}MB`,
  CSV_INVALID_TYPE: 'Apenas arquivos CSV são permitidos',
  NO_NUMBERS_PROVIDED: 'É necessário fornecer pelo menos um número',
  LIST_TOO_LARGE: (max: number) => 
    `Máximo de ${max} números por vez`,
};

/**
 * Exemplos de formatos aceitos
 */
export const PHONE_FORMAT_EXAMPLES = {
  WITH_COUNTRY_CODE: [
    '5521975705641',
    '+5521975705641',
    '55 21 97570-5641',
    '+55 (21) 97570-5641',
  ],
  WITHOUT_COUNTRY_CODE: [
    '21975705641',
    '(21) 97570-5641',
    '21 97570-5641',
  ],
  WITH_LEADING_ZERO: [
    '55021975705641',
    '021975705641',
    '(021) 97570-5641',
  ],
  WHATSAPP_JID: [
    '5521975705641@c.us',
    '5521975705641@s.whatsapp.net',
    '5521975705641@lid',
  ],
} as const;

/**
 * Texto de ajuda para inputs de telefone
 */
export const PHONE_INPUT_HELP_TEXT = {
  PLACEHOLDER: 'Ex: 21 97570-5641 ou +55 (21) 97570-5641',
  HELPER: 'Aceita qualquer formato: com ou sem código do país (55), com ou sem espaços, parênteses ou hífens.',
  EXAMPLES: 'Exemplos: 21 97570-5641, (21) 97570-5641, +55 21 97570-5641, 5521975705641',
} as const;

export default PHONE_ERROR_MESSAGES;
