/**
 * Branding Router - Definição de Rotas Express
 * 
 * Camada de interface HTTP do módulo de Branding.
 */

const express = require('express');
const BrandingController = require('./controller');

const router = express.Router();

/**
 * GET /api/branding
 * Obtém configuração de branding (público)
 */
router.get('/', BrandingController.getConfig);

/**
 * PUT /api/branding
 * Atualiza configuração de branding (requer admin)
 */
router.put('/', BrandingController.updateConfig);

/**
 * POST /api/branding
 * Cria/atualiza configuração de branding (requer admin)
 */
router.post('/', BrandingController.updateConfig);

module.exports = router;
