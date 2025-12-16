/**
 * Módulo de Branding - API Pública
 * 
 * Este arquivo expõe apenas o que deve ser acessível por outros módulos.
 * Importações internas são proibidas.
 */

const BrandingService = require('./core/services/BrandingService');
const brandingRouter = require('./api/http/router');

module.exports = {
  BrandingService,
  brandingRouter
};
