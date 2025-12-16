const express = require('express');
const { logger } = require('../utils/logger');
const AnalyticsService = require('../services/AnalyticsService');
const router = express.Router();

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
        const db = req.app.locals.db;
        const service = new AnalyticsService(db);
        const metrics = await service.getOverviewMetrics(req.userToken);
        res.json({ success: true, metrics });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao obter métricas', message: error.message });
    }
});

// GET /api/user/analytics/hourly
router.get('/hourly', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const service = new AnalyticsService(db);
        const data = await service.getHourlyDeliveryStats(req.userToken);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao obter dados por hora', message: error.message });
    }
});

// GET /api/user/analytics/funnel
router.get('/funnel', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const service = new AnalyticsService(db);
        const data = await service.getConversionFunnel(req.userToken);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao obter funil', message: error.message });
    }
});

module.exports = router;
