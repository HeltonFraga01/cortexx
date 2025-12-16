const express = require('express');
const { logger } = require('../utils/logger');
const ContactFetcherService = require('../services/ContactFetcherService');
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

// POST /api/user/database-connections/:id/preview - Preview contacts
router.post('/:id/preview', verifyUserToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { query } = req.body;
        const userToken = req.userToken;
        const db = req.app.locals.db;

        const fetcher = new ContactFetcherService(db);
        const contacts = await fetcher.fetchContacts(id, userToken, query);

        res.json({
            success: true,
            count: contacts.length,
            contacts: contacts.slice(0, 10), // Retornar apenas preview
            totalAvailable: contacts.length
        });

    } catch (error) {
        logger.error('Erro no preview de contatos:', error.message);
        res.status(500).json({
            error: 'Erro ao buscar contatos',
            message: error.message
        });
    }
});

// POST /api/user/database-connections/:id/fetch - Fetch all contacts
router.post('/:id/fetch', verifyUserToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { query } = req.body;
        const userToken = req.userToken;
        const db = req.app.locals.db;

        const fetcher = new ContactFetcherService(db);
        const contacts = await fetcher.fetchContacts(id, userToken, query);

        res.json({
            success: true,
            count: contacts.length,
            contacts: contacts
        });

    } catch (error) {
        logger.error('Erro ao buscar contatos:', error.message);
        res.status(500).json({
            error: 'Erro ao buscar contatos',
            message: error.message
        });
    }
});

module.exports = router;
