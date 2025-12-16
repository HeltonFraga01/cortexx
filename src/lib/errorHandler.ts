/**
 * Error Handler Utility
 * 
 * Centralizes error handling for API responses in the frontend.
 * Provides user-friendly messages and retry suggestions.
 * 
 * Requirements: 3.1, 3.2
 */

/**
 * Error codes returned by the backend API
 */
export type ErrorCode =
  | 'INVALID_NUMBER'
  | 'BLOCKED_NUMBER'
  | 'DISCONNECTED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMIT'
  | 'SERVER_BUSY'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'API_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

/**
 * API Error structure
 */
export interface ApiError {
  code?: ErrorCode;
  message?: string;
  status?: number;
  details?: {
    field?: string;
    suggestion?: string;
    [key: string]: unknown;
  };
}

/**
 * Result of error handling
 */
export interface ErrorHandlerResult {
  message: string;
  type: 'error' | 'warning' | 'info';
  retryable: boolean;
  suggestion?: string;
  originalError?: ApiError;
}

/**
 * Error messages in Portuguese (Brazilian)
 */
const ERROR_MESSAGES: Record<ErrorCode, { message: string; type: 'error' | 'warning' | 'info'; retryable: boolean; suggestion?: string }> = {
  INVALID_NUMBER: {
    message: 'Número de telefone inválido ou não existe no WhatsApp.',
    type: 'warning',
    retryable: false,
    suggestion: 'Verifique se o número está correto e inclui o código do país.'
  },
  BLOCKED_NUMBER: {
    message: 'Este número está bloqueado.',
    type: 'warning',
    retryable: false,
    suggestion: 'O contato pode ter bloqueado seu número.'
  },
  DISCONNECTED: {
    message: 'Instância WhatsApp desconectada.',
    type: 'error',
    retryable: false,
    suggestion: 'Reconecte sua instância WhatsApp e tente novamente.'
  },
  UNAUTHORIZED: {
    message: 'Sessão expirada ou não autorizada.',
    type: 'error',
    retryable: false,
    suggestion: 'Faça login novamente para continuar.'
  },
  RATE_LIMIT: {
    message: 'Muitas requisições. Aguarde um momento.',
    type: 'warning',
    retryable: true,
    suggestion: 'Aguarde alguns segundos e tente novamente.'
  },
  SERVER_BUSY: {
    message: 'Servidor ocupado. Tente novamente em instantes.',
    type: 'warning',
    retryable: true,
    suggestion: 'Clique para tentar novamente.'
  },
  TIMEOUT: {
    message: 'A requisição demorou muito para responder.',
    type: 'warning',
    retryable: true,
    suggestion: 'Verifique sua conexão e tente novamente.'
  },
  NETWORK_ERROR: {
    message: 'Erro de conexão. Verifique sua internet.',
    type: 'error',
    retryable: true,
    suggestion: 'Verifique sua conexão com a internet e tente novamente.'
  },
  API_ERROR: {
    message: 'Erro ao processar requisição.',
    type: 'error',
    retryable: true,
    suggestion: 'Tente novamente. Se o problema persistir, contate o suporte.'
  },
  VALIDATION_ERROR: {
    message: 'Dados inválidos.',
    type: 'warning',
    retryable: false,
    suggestion: 'Verifique os dados informados.'
  },
  NOT_FOUND: {
    message: 'Recurso não encontrado.',
    type: 'warning',
    retryable: false
  },
  UNKNOWN_ERROR: {
    message: 'Ocorreu um erro inesperado.',
    type: 'error',
    retryable: true,
    suggestion: 'Tente novamente. Se o problema persistir, contate o suporte.'
  }
};


/**
 * Determines error code from HTTP status
 */
function getErrorCodeFromStatus(status: number): ErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
    case 403:
      return 'UNAUTHORIZED';
    case 404:
      return 'NOT_FOUND';
    case 429:
      return 'RATE_LIMIT';
    case 408:
      return 'TIMEOUT';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'SERVER_BUSY';
    default:
      return 'API_ERROR';
  }
}

/**
 * Determines error code from error message
 */
function getErrorCodeFromMessage(message: string): ErrorCode {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('network') || lowerMessage.includes('rede') || lowerMessage.includes('connection')) {
    return 'NETWORK_ERROR';
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('tempo esgotado')) {
    return 'TIMEOUT';
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('não autorizado') || lowerMessage.includes('token')) {
    return 'UNAUTHORIZED';
  }
  if (lowerMessage.includes('disconnected') || lowerMessage.includes('desconectado') || lowerMessage.includes('not connected')) {
    return 'DISCONNECTED';
  }
  if (lowerMessage.includes('invalid') || lowerMessage.includes('inválido') || lowerMessage.includes('validation')) {
    return 'VALIDATION_ERROR';
  }
  if (lowerMessage.includes('rate limit') || lowerMessage.includes('muitas requisições')) {
    return 'RATE_LIMIT';
  }
  if (lowerMessage.includes('blocked') || lowerMessage.includes('bloqueado')) {
    return 'BLOCKED_NUMBER';
  }

  return 'API_ERROR';
}

/**
 * Handles API errors and returns user-friendly messages
 * 
 * @param error - The error object from API response
 * @returns ErrorHandlerResult with message, type, and retry info
 */
export function handleApiError(error: ApiError | Error | unknown): ErrorHandlerResult {
  // Handle null/undefined
  if (!error) {
    return {
      ...ERROR_MESSAGES.UNKNOWN_ERROR,
      originalError: undefined
    };
  }

  // Convert to ApiError if it's a standard Error
  const apiError: ApiError = error instanceof Error
    ? { message: error.message }
    : (error as ApiError);

  // Determine error code
  let errorCode: ErrorCode;

  if (apiError.code && apiError.code in ERROR_MESSAGES) {
    errorCode = apiError.code;
  } else if (apiError.status) {
    errorCode = getErrorCodeFromStatus(apiError.status);
  } else if (apiError.message) {
    errorCode = getErrorCodeFromMessage(apiError.message);
  } else {
    errorCode = 'UNKNOWN_ERROR';
  }

  // Get base error info
  const baseError = ERROR_MESSAGES[errorCode];

  // Build result with customizations
  const result: ErrorHandlerResult = {
    message: baseError.message,
    type: baseError.type,
    retryable: baseError.retryable,
    suggestion: baseError.suggestion,
    originalError: apiError
  };

  // Customize message for validation errors with field info
  if (errorCode === 'VALIDATION_ERROR' && apiError.details?.field) {
    result.message = `Campo "${apiError.details.field}" inválido.`;
    if (apiError.details.suggestion) {
      result.suggestion = apiError.details.suggestion;
    }
  }

  // Use custom message if provided and more specific
  if (apiError.message && apiError.message.length > 0 && apiError.message !== baseError.message) {
    // Keep the original message if it's more specific
    if (apiError.message.length < 100) {
      result.message = apiError.message;
    }
  }

  return result;
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: ApiError | Error | unknown): boolean {
  const result = handleApiError(error);
  return result.retryable;
}

/**
 * Gets a user-friendly error message
 */
export function getErrorMessage(error: ApiError | Error | unknown): string {
  const result = handleApiError(error);
  return result.message;
}

/**
 * Gets error suggestion if available
 */
export function getErrorSuggestion(error: ApiError | Error | unknown): string | undefined {
  const result = handleApiError(error);
  return result.suggestion;
}

/**
 * Determines if error requires user action (login, reconnect, etc.)
 */
export function requiresUserAction(error: ApiError | Error | unknown): boolean {
  const result = handleApiError(error);
  const actionRequired: ErrorCode[] = ['UNAUTHORIZED', 'DISCONNECTED'];
  
  if (result.originalError?.code) {
    return actionRequired.includes(result.originalError.code);
  }
  
  return false;
}

/**
 * Formats error for toast notification
 */
export function formatErrorForToast(error: ApiError | Error | unknown): {
  title: string;
  description: string;
  variant: 'default' | 'destructive';
} {
  const result = handleApiError(error);
  
  return {
    title: result.type === 'error' ? 'Erro' : 'Atenção',
    description: result.suggestion 
      ? `${result.message} ${result.suggestion}`
      : result.message,
    variant: result.type === 'error' ? 'destructive' : 'default'
  };
}
