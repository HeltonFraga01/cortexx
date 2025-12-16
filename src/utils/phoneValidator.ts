/**
 * Utilitário para validação e formatação de números de telefone
 * usando a API do WUZAPI para verificação real no WhatsApp
 */

export interface PhoneValidationResult {
  isValid: boolean;
  formatted?: string;
  error?: string;
  isInWhatsApp?: boolean;
  verifiedName?: string;
  jid?: string;
  suggestions?: string[];
}

/**
 * Gera variações possíveis de um número de telefone brasileiro
 * para tentar encontrar o formato correto
 */
function generatePhoneVariations(phone: string): string[] {
  const cleanPhone = phone.replace(/\D/g, '');
  const variations: string[] = [];
  
  // Se já tem código do país (55)
  if (cleanPhone.startsWith('55')) {
    const withoutCountry = cleanPhone.substring(2);
    const areaCode = withoutCountry.substring(0, 2);
    const number = withoutCountry.substring(2);
    
    // Adicionar variação original
    variations.push(cleanPhone);
    
    // Se tem 8 dígitos, tentar adicionar 9 no início (celular)
    if (number.length === 8) {
      variations.push(`55${areaCode}9${number}`);
    }
    
    // Se tem 9 dígitos mas não começa com 9, tentar remover primeiro dígito
    if (number.length === 9 && !number.startsWith('9')) {
      variations.push(`55${areaCode}${number.substring(1)}`);
    }
  } else {
    // Sem código do país
    const areaCode = cleanPhone.substring(0, 2);
    const number = cleanPhone.substring(2);
    
    // Adicionar com código do país
    variations.push(`55${cleanPhone}`);
    
    // Se tem 8 dígitos, tentar adicionar 9 no início
    if (number.length === 8) {
      variations.push(`55${areaCode}9${number}`);
    }
    
    // Se tem 9 dígitos mas não começa com 9, tentar remover primeiro dígito
    if (number.length === 9 && !number.startsWith('9')) {
      variations.push(`55${areaCode}${number.substring(1)}`);
    }
  }
  
  // Remover duplicatas
  return [...new Set(variations)];
}

/**
 * Valida um número de telefone usando a API do WUZAPI
 * Esta é a forma mais confiável de validar, pois verifica diretamente no WhatsApp
 * 
 * @param phone - Número de telefone a ser validado
 * @param userToken - Token do usuário para autenticação na API
 * @param wuzapiBaseUrl - URL base da API WUZAPI (opcional)
 */
export async function validatePhoneWithAPI(
  phone: string,
  userToken: string,
  wuzapiBaseUrl: string = 'https://wzapi.wasend.com.br'
): Promise<PhoneValidationResult> {
  // Remover caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!cleanPhone) {
    return {
      isValid: false,
      error: 'Número de telefone não pode estar vazio'
    };
  }
  
  if (cleanPhone.length < 10) {
    return {
      isValid: false,
      error: 'Número muito curto. Mínimo: 10 dígitos (DDD + número)'
    };
  }
  
  try {
    // Gerar variações possíveis do número
    const variations = generatePhoneVariations(cleanPhone);
    
    // Verificar todas as variações na API
    const response = await fetch(`${wuzapiBaseUrl}/user/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': userToken
      },
      body: JSON.stringify({
        Phone: variations
      })
    });
    
    if (!response.ok) {
      return {
        isValid: false,
        error: `Erro ao validar número: ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (!data.success || !data.data?.Users) {
      return {
        isValid: false,
        error: 'Erro ao validar número na API'
      };
    }
    
    // Procurar o primeiro número válido no WhatsApp
    const validUser = data.data.Users.find((user: any) => user.IsInWhatsapp);
    
    if (validUser) {
      return {
        isValid: true,
        formatted: validUser.Query,
        isInWhatsApp: true,
        verifiedName: validUser.VerifiedName || undefined,
        jid: validUser.JID
      };
    }
    
    // Nenhuma variação foi encontrada no WhatsApp
    const testedNumbers = data.data.Users.map((u: any) => u.Query);
    
    return {
      isValid: false,
      error: 'Número não encontrado no WhatsApp',
      suggestions: testedNumbers,
      isInWhatsApp: false
    };
    
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Erro ao validar número'
    };
  }
}

/**
 * Formata um número de telefone para exibição amigável
 * Exemplo: 5531984996968 -> +55 (31) 98499-6968
 */
export function formatPhoneForDisplay(phone: string): string {
  const validation = validateAndFormatBrazilianPhone(phone);
  
  if (!validation.isValid || !validation.details) {
    return phone;
  }
  
  const { countryCode, areaCode, number, type } = validation.details;
  
  if (type === 'mobile') {
    // Formato: +55 (31) 98499-6968
    const part1 = number.substring(0, 5);
    const part2 = number.substring(5);
    return `+${countryCode} (${areaCode}) ${part1}-${part2}`;
  } else {
    // Formato: +55 (31) 3499-6968
    const part1 = number.substring(0, 4);
    const part2 = number.substring(4);
    return `+${countryCode} (${areaCode}) ${part1}-${part2}`;
  }
}

/**
 * Exemplos de uso e testes
 */
export const phoneValidationExamples = {
  valid: [
    '5531984996968',  // Formato completo
    '31984996968',    // Sem código do país
    '(31) 98499-6968', // Formatado
    '31 98499-6968',  // Com espaços
    '5531 98499-6968', // Misto
  ],
  invalid: [
    '553184996968',   // Falta o 9 do celular
    '31 8499-6968',   // Falta o 9 do celular
    '5599984996968',  // DDD inválido (99 não existe para celular)
    '123456',         // Muito curto
    '',               // Vazio
  ]
};
