const express = require('express');
const { logger } = require('../utils/logger');
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

// GET /api/user/contact-lists - Listar todas as listas
router.get('/', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const sql = `
            SELECT * FROM contact_lists 
            WHERE user_token = ? 
            ORDER BY created_at DESC
        `;
        const { rows } = await db.query(sql, [req.userToken]);
        res.json({ success: true, data: rows });
    } catch (error) {
        logger.error('Erro ao listar listas de contatos:', error);
        res.status(500).json({ error: 'Erro ao listar contatos' });
    }
});

// GET /api/user/contact-lists/:id - Obter detalhes de uma lista
router.get('/:id', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const { id } = req.params;

        // Buscar lista
        const listSql = `SELECT * FROM contact_lists WHERE id = ? AND user_token = ?`;
        const { rows: listRows } = await db.query(listSql, [id, req.userToken]);

        if (listRows.length === 0) {
            return res.status(404).json({ error: 'Lista não encontrada' });
        }

        // Buscar contatos (paginado seria ideal, mas por enquanto trazemos tudo ou limitamos)
        const contactsSql = `SELECT * FROM contacts WHERE list_id = ? LIMIT 1000`;
        const { rows: contactsRows } = await db.query(contactsSql, [id]);

        // Parse variables JSON e adiciona nome às variáveis se não existir
        const contacts = contactsRows.map(contact => {
            let variables = {};
            try {
                variables = contact.variables ? JSON.parse(contact.variables) : {};
            } catch (e) {
                logger.warn('Erro ao parsear variables do contato:', { contactId: contact.id, error: e.message });
            }

            // Se o contato tem name mas não tem variables.nome, adicionar automaticamente
            if (contact.name && !variables.nome) {
                variables.nome = contact.name;
            }

            return {
                id: contact.id,
                phone: contact.phone,
                name: contact.name,
                variables
            };
        });

        res.json({
            success: true,
            data: {
                ...listRows[0],
                contacts
            }
        });
    } catch (error) {
        logger.error('Erro ao buscar lista:', error);
        res.status(500).json({ error: 'Erro ao buscar lista' });
    }
});

// POST /api/user/contact-lists - Criar nova lista
router.post('/', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const { name, description, contacts } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome da lista é obrigatório' });
        }

        // Operations are executed sequentially

        // 1. Criar lista
        const createListSql = `
            INSERT INTO contact_lists (name, description, user_token, total_contacts)
            VALUES (?, ?, ?, ?)
        `;
        const listResult = await db.query(createListSql, [name, description, req.userToken, contacts ? contacts.length : 0]);
        const listId = listResult.lastID;

        // 2. Inserir contatos
        if (contacts && contacts.length > 0) {
            const insertContactSql = `
                INSERT INTO contacts (list_id, phone, name, variables)
                VALUES (?, ?, ?, ?)
            `;

            // Inserir em lote ou loop
            for (const contact of contacts) {
                await db.query(insertContactSql, [
                    listId,
                    contact.phone,
                    contact.name,
                    JSON.stringify(contact.variables || {})
                ]);
            }
        }

        res.json({ success: true, data: { id: listId, name, total_contacts: contacts ? contacts.length : 0 } });

    } catch (error) {
        logger.error('Erro ao criar lista:', error);
        res.status(500).json({ error: 'Erro ao criar lista' });
    }
});

// DELETE /api/user/contact-lists/:id - Deletar lista
router.delete('/:id', verifyUserToken, async (req, res) => {
    try {
        const db = req.app.locals.db;
        const { id } = req.params;

        const sql = `DELETE FROM contact_lists WHERE id = ? AND user_token = ?`;
        const result = await db.query(sql, [id, req.userToken]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Lista não encontrada' });
        }

        res.json({ success: true, message: 'Lista removida com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar lista:', error);
        res.status(500).json({ error: 'Erro ao deletar lista' });
    }
});

module.exports = router;
