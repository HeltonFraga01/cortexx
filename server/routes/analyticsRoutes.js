/**
 * Analytics Routes
 * Handles analytics and metrics operations
 * 
 * Migrated to use SupabaseService directly
 */

const express = require('express');
const { logger } = require('../utils/logger');
const AnalyticsService = require('../services/AnalyticsService');
const router = express.Router();

// Initialize service at module level (no db parameter needed)
const analyticsService = new AnalyticsService();

// Middleware para verificar token
const verifyUserToken = async (req, res, next) => {
    let userToken = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        userToken = authHeader.substring(7);
    } else if (req.session?.userToken) {
        userToken = req.session.userToken;
    }

    if (!userToken) return res.status(401).json({ error: 'Não autorizado' });
    req.userToken = userToken;
    next();
};

// GET /api/user/analytics/overview
router.get('/overview', verifyUserToken, async (req, res) => {
    try {
        const metrics = await analyticsService.getOverviewMetrics(req.userToken);
        res.json({ success: true, metrics });
    } catch (error) {
        logger.error('Erro ao obter métricas:', { error: error.message });
        res.status(500).json({ error: 'Erro ao obter métricas', message: error.message });
    }
});

// GET /api/user/analytics/hourly
router.get('/hourly', verifyUserToken, async (req, res) => {
    try {
        const data = await analyticsService.getHourlyDeliveryStats(req.userToken);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Erro ao obter dados por hora:', { error: error.message });
        res.status(500).json({ error: 'Erro ao obter dados por hora', message: error.message });
    }
});

// GET /api/user/analytics/funnel
router.get('/funnel', verifyUserToken, async (req, res) => {
    try {
        const data = await analyticsService.getConversionFunnel(req.userToken);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Erro ao obter funil:', { error: error.message });
        res.status(500).json({ error: 'Erro ao obter funil', message: error.message });
    }
});

module.exports = router;
