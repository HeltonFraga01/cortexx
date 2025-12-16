/**
 * Erros específicos do módulo de Branding
 */

class BrandingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BrandingError';
  }
}

class BrandingNotFoundError extends BrandingError {
  constructor() {
    super('Configuração de branding não encontrada');
    this.name = 'BrandingNotFoundError';
    this.statusCode = 404;
  }
}

class BrandingValidationError extends BrandingError {
  constructor(errors) {
    super(`Validação falhou: ${errors.join(', ')}`);
    this.name = 'BrandingValidationError';
    this.statusCode = 400;
    this.errors = errors;
  }
}

module.exports = {
  BrandingError,
  BrandingNotFoundError,
  BrandingValidationError
};
