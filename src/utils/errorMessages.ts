/**
 * Error Messages Utility
 * 
 * Fornece mensagens de erro amigáveis para o usuário
 */

export interface ApiError {
  error: string;
  message: string;
  errors?: string[];
  code?: string;
}

/**
 * Extrai mensagem de erro amigável de uma resposta de API
 * @param error - Erro da API
 * @returns Mensagem amigável
 */
export function getErrorMessage(error: any): string {
  // Se for um erro de rede
  if (error.message === 'Network Error' || error.message === 'Failed to fetch') {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  
  // Se for um erro de timeout
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return 'A requisição demorou muito. Tente novamente.';
  }
  
  // Se tiver resposta da API
  if (error.response?.data) {
    const data = error.response.data as ApiError;
    
    // Se tiver múltiplos erros
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors.join('\n');
    }
    
    // Se tiver mensagem específica
    if (data.message) {
      return data.message;
    }
    
    // Se tiver apenas o campo error
    if (data.error) {
      return data.error;
    }
  }
  
  // Mensagem genérica baseada no status
  if (error.response?.status) {
    switch (error.response.status) {
      case 400:
        return 'Dados inválidos. Verifique os campos e tente novamente.';
      case 401:
        return 'Não autorizado. Faça login novamente.';
      case 403:
        return 'Acesso negado. Você não tem permissão para esta ação.';
      case 404:
        return 'Recurso não encontrado.';
      case 409:
        return 'Conflito. Este recurso já existe ou está em uso.';
      case 422:
        return 'Dados não processáveis. Verifique os campos.';
      case 429:
        return 'Muitas requisições. Aguarde um momento e tente novamente.';
      case 500:
        return 'Erro no servidor. Tente novamente mais tarde.';
      case 503:
        return 'Serviço temporariamente indisponível. Tente novamente.';
      default:
        return `Erro ${error.response.status}. Tente novamente.`;
    }
  }
  
  // Fallback para mensagem do erro
  if (error.message) {
    return error.message;
  }
  
  return 'Erro desconhecido. Tente novamente.';
}

/**
 * Formata lista de erros para exibição
 * @param errors - Lista de erros
 * @returns String formatada
 */
export function formatErrorList(errors: string[]): string {
  if (errors.length === 0) {
    return '';
  }
  
  if (errors.length === 1) {
    return errors[0];
  }
  
  return `Foram encontrados ${errors.length} erros:\n\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
}

/**
 * Verifica se é um erro de validação
 * @param error - Erro da API
 * @returns true se for erro de validação
 */
export function isValidationError(error: any): boolean {
  return error.response?.status === 400 && 
         error.response?.data?.errors && 
         Array.isArray(error.response.data.errors);
}

/**
 * Verifica se é um erro de autenticação
 * @param error - Erro da API
 * @returns true se for erro de autenticação
 */
export function isAuthError(error: any): boolean {
  return error.response?.status === 401 || error.response?.status === 403;
}

/**
 * Verifica se é um erro de servidor
 * @param error - Erro da API
 * @returns true se for erro de servidor
 */
export function isServerError(error: any): boolean {
  return error.response?.status >= 500;
}

/**
 * Mensagens de erro específicas para campanhas
 */
export const CampaignErrorMessages = {
  INVALID_PHONE: 'Número de telefone inválido. Use o formato: 5511999999999',
  NO_CONTACTS: 'Adicione pelo menos um contato para criar a campanha',
  TOO_MANY_CONTACTS: 'Número máximo de contatos por campanha é 10.000',
  INVALID_DELAY: 'Delays devem estar entre 5 e 300 segundos',
  DELAY_MIN_GREATER: 'Delay mínimo não pode ser maior que delay máximo',
  INVALID_SCHEDULE: 'Data de agendamento inválida ou no passado',
  CAMPAIGN_NOT_FOUND: 'Campanha não encontrada',
  CAMPAIGN_ALREADY_RUNNING: 'Esta campanha já está em execução',
  CAMPAIGN_ALREADY_COMPLETED: 'Esta campanha já foi concluída',
  SCHEDULER_UNAVAILABLE: 'Serviço de agendamento temporariamente indisponível',
  INVALID_MESSAGE: 'Mensagem inválida ou muito longa (máx. 4096 caracteres)',
  INVALID_MEDIA_URL: 'URL da mídia inválida',
  EMPTY_CAMPAIGN_NAME: 'Nome da campanha é obrigatório',
  CAMPAIGN_NAME_TOO_LONG: 'Nome da campanha não pode ter mais de 100 caracteres'
};

/**
 * Obtém mensagem de erro específica para campanha
 * @param errorCode - Código do erro
 * @returns Mensagem amigável
 */
export function getCampaignErrorMessage(errorCode: string): string {
  return CampaignErrorMessages[errorCode as keyof typeof CampaignErrorMessages] || 
         'Erro ao processar campanha. Tente novamente.';
}
