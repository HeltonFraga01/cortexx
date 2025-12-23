/**
 * Contact List Routes
 * Handles contact list operations
 * 
 * Migrated to use SupabaseService directly
 */

const express = require('express');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');
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
        const { data: rows, error } = await SupabaseService.queryAsAdmin(
            'contact_lists',
            (query) => query
                .select('*')
                .eq('user_token', req.userToken)
                .order('created_at', { ascending: false })
        );

        if (error) {
            throw error;
        }

        res.json({ success: true, data: rows || [] });
    } catch (error) {
        logger.error('Erro ao listar listas de contatos:', { error: error.message });
        res.status(500).json({ error: 'Erro ao listar contatos' });
    }
});

// GET /api/user/contact-lists/:id - Obter detalhes de uma lista
router.get('/:id', verifyUserToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Buscar lista
        const { data: listRows, error: listError } = await SupabaseService.queryAsAdmin(
            'contact_lists',
            (query) => query
                .select('*')
                .eq('id', id)
                .eq('user_token', req.userToken)
        );

        if (listError) {
            throw listError;
        }

        if (!listRows || listRows.length === 0) {
            return res.status(404).json({ error: 'Lista não encontrada' });
        }

        // Buscar contatos (paginado seria ideal, mas por enquanto trazemos tudo ou limitamos)
        const { data: contactsRows, error: contactsError } = await SupabaseService.queryAsAdmin(
            'contacts',
            (query) => query
                .select('*')
                .eq('list_id', id)
                .limit(1000)
        );

        if (contactsError) {
            throw contactsError;
        }

        // Parse variables JSON e adiciona nome às variáveis se não existir
        const contacts = (contactsRows || []).map(contact => {
            let variables = {};
            try {
                variables = contact.variables ? 
                    (typeof contact.variables === 'string' ? JSON.parse(contact.variables) : contact.variables) 
                    : {};
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
        logger.error('Erro ao buscar lista:', { error: error.message });
        res.status(500).json({ error: 'Erro ao buscar lista' });
    }
});

// POST /api/user/contact-lists - Criar nova lista
router.post('/', verifyUserToken, async (req, res) => {
    try {
        const { name, description, contacts } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Nome da lista é obrigatório' });
        }

        // 1. Criar lista
        const { data: listData, error: listError } = await SupabaseService.queryAsAdmin(
            'contact_lists',
            (query) => query.insert({
                name,
                description: description || null,
                user_token: req.userToken,
                total_contacts: contacts ? contacts.length : 0
            }).select().single()
        );

        if (listError) {
            throw listError;
        }

        const listId = listData.id;

        // 2. Inserir contatos
        if (contacts && contacts.length > 0) {
            const contactsToInsert = contacts.map(contact => ({
                list_id: listId,
                phone: contact.phone,
                name: contact.name || null,
                variables: contact.variables || {}
            }));

            const { error: contactsError } = await SupabaseService.queryAsAdmin(
                'contacts',
                (query) => query.insert(contactsToInsert)
            );

            if (contactsError) {
                logger.error('Erro ao inserir contatos:', { error: contactsError.message });
                // Continue anyway, list was created
            }
        }

        res.json({ 
            success: true, 
            data: { 
                id: listId, 
                name, 
                total_contacts: contacts ? contacts.length : 0 
            } 
        });

    } catch (error) {
        logger.error('Erro ao criar lista:', { error: error.message });
        res.status(500).json({ error: 'Erro ao criar lista' });
    }
});

// DELETE /api/user/contact-lists/:id - Deletar lista
router.delete('/:id', verifyUserToken, async (req, res) => {
    try {
        const { id } = req.params;

        // First verify ownership
        const { data: existing, error: checkError } = await SupabaseService.queryAsAdmin(
            'contact_lists',
            (query) => query
                .select('id')
                .eq('id', id)
                .eq('user_token', req.userToken)
        );

        if (checkError) {
            throw checkError;
        }

        if (!existing || existing.length === 0) {
            return res.status(404).json({ error: 'Lista não encontrada' });
        }

        // Delete contacts first (foreign key constraint)
        await SupabaseService.queryAsAdmin(
            'contacts',
            (query) => query.delete().eq('list_id', id)
        );

        // Delete the list
        const { error: deleteError } = await SupabaseService.queryAsAdmin(
            'contact_lists',
            (query) => query.delete().eq('id', id)
        );

        if (deleteError) {
            throw deleteError;
        }

        res.json({ success: true, message: 'Lista removida com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar lista:', { error: error.message });
        res.status(500).json({ error: 'Erro ao deletar lista' });
    }
});

module.exports = router;
