/**
 * Agent Data Routes
 * 
 * Routes for fetching data scoped to the authenticated agent.
 * All routes require agent authentication.
 * 
 * Requirements: Agent can only see data assigned to them.
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const { requireAgentAuth } = require('../middleware/agentAuth');
const InboxService = require('../services/InboxService');
const AgentService = require('../services/AgentService');

// Services will be initialized with db
let inboxService = null;
let agentService = null;

function initServices(db) {
  if (!inboxService) {
    inboxService = new InboxService(db);
    agentService = new AgentService(db);
  }
}

/**
 * GET /api/agent/my/inboxes
 * Get inboxes assigned to the current agent
 */
router.get('/my/inboxes', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    
    // Get inboxes where this agent is a member (uses existing listAgentInboxes method)
    const inboxes = await inboxService.listAgentInboxes(agentId);
    
    res.json({
      success: true,
      data: inboxes
    });
  } catch (error) {
    logger.error('Failed to get agent inboxes', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar caixas de entrada' });
  }
});

/**
 * GET /api/agent/my/conversations
 * Get conversations assigned to the current agent
 */
router.get('/my/conversations', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { status, inboxId, limit = 50, offset = 0 } = req.query;
    
    // For now, return empty array - conversations feature needs to be implemented
    // This would query conversations assigned to this agent
    const conversations = [];
    const total = 0;
    
    res.json({
      success: true,
      data: conversations,
      total
    });
  } catch (error) {
    logger.error('Failed to get agent conversations', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar conversas' });
  }
});

/**
 * GET /api/agent/my/contacts
 * Get contacts accessible to the current agent (from assigned inboxes)
 */
router.get('/my/contacts', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { search, limit = 50, offset = 0 } = req.query;
    const db = req.app.locals.db;
    
    // Get agent's assigned inbox IDs
    const inboxes = await inboxService.listAgentInboxes(agentId);
    const inboxIds = inboxes.map(inbox => inbox.id);
    
    if (inboxIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0
      });
    }
    
    // Build query to get unique contacts from conversations in agent's inboxes
    // Group only by contact_jid to avoid duplicates when same contact has different names/avatars
    const placeholders = inboxIds.map(() => '?').join(',');
    let sql = `
      SELECT 
        c.contact_jid as id,
        MAX(c.contact_name) as name,
        c.contact_jid as phone,
        MAX(c.contact_avatar_url) as avatarUrl,
        MAX(c.last_message_at) as lastContactAt,
        COUNT(c.id) as conversationCount
      FROM conversations c
      WHERE c.inbox_id IN (${placeholders})
    `;
    
    const params = [...inboxIds];
    
    if (search) {
      sql += ' AND (c.contact_name LIKE ? OR c.contact_jid LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    sql += ' GROUP BY c.contact_jid';
    sql += ' ORDER BY lastContactAt DESC NULLS LAST';
    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const { rows: contacts } = await db.query(sql, params);
    
    // Get total count
    let countSql = `
      SELECT COUNT(DISTINCT c.contact_jid) as total
      FROM conversations c
      WHERE c.inbox_id IN (${placeholders})
    `;
    const countParams = [...inboxIds];
    
    if (search) {
      countSql += ' AND (c.contact_name LIKE ? OR c.contact_jid LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    const { rows: countRows } = await db.query(countSql, countParams);
    const total = countRows[0]?.total || 0;
    
    // Transform contacts to clean format
    const transformedContacts = contacts.map(contact => ({
      id: contact.id,
      name: contact.name || contact.phone?.replace('@s.whatsapp.net', ''),
      phone: contact.phone?.replace('@s.whatsapp.net', ''),
      avatarUrl: contact.avatarUrl,
      lastContactAt: contact.lastContactAt,
      conversationCount: contact.conversationCount
    }));
    
    logger.info('Agent contacts retrieved', { 
      agentId, 
      count: transformedContacts.length, 
      total 
    });
    
    res.json({
      success: true,
      data: transformedContacts,
      total
    });
  } catch (error) {
    logger.error('Failed to get agent contacts', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar contatos' });
  }
});

/**
 * GET /api/agent/my/stats
 * Get dashboard stats for the current agent
 */
router.get('/my/stats', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    const db = req.app.locals.db;
    
    const agentId = req.agent.id;
    
    // Get inboxes count (uses existing listAgentInboxes method)
    const inboxes = await inboxService.listAgentInboxes(agentId);
    const inboxIds = inboxes.map(i => i.id);
    
    let totalConversations = 0;
    let openConversations = 0;
    let pendingConversations = 0;
    let totalContacts = 0;
    
    // Get conversation and contact stats if agent has access to any inboxes
    if (inboxIds.length > 0) {
      const placeholders = inboxIds.map(() => '?').join(',');
      
      // Conversations: Count only those assigned to this agent (not unassigned)
      // This shows the conversations the agent is actively handling
      const convResult = await db.query(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count
        FROM conversations 
        WHERE inbox_id IN (${placeholders})
          AND assigned_agent_id = ?`,
        [...inboxIds, agentId]
      );
      
      if (convResult.rows && convResult.rows.length > 0) {
        totalConversations = convResult.rows[0].total || 0;
        openConversations = convResult.rows[0].open_count || 0;
        pendingConversations = convResult.rows[0].pending_count || 0;
      }
      
      // Contacts: Count unique contacts from conversations in agent's inboxes
      // This matches the logic in /my/contacts route
      const contactResult = await db.query(
        `SELECT COUNT(DISTINCT contact_jid) as total
         FROM conversations 
         WHERE inbox_id IN (${placeholders})`,
        inboxIds
      );
      
      if (contactResult.rows && contactResult.rows.length > 0) {
        totalContacts = contactResult.rows[0].total || 0;
      }
    }
    
    const stats = {
      totalInboxes: inboxes.length,
      totalConversations,
      openConversations,
      pendingConversations,
      totalContacts
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get agent stats', { 
      error: error.message, 
      stack: error.stack,
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});

/**
 * POST /api/agent/my/inboxes/:inboxId/import-contacts
 * Import contacts from WUZAPI for a specific inbox
 */
router.post('/my/inboxes/:inboxId/import-contacts', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    const axios = require('axios');
    
    const agentId = req.agent.id;
    const { inboxId } = req.params;
    const db = req.app.locals.db;
    
    // Verify agent has access to this inbox
    const hasAccess = await inboxService.checkAccess(agentId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acesso negado a esta caixa de entrada' });
    }
    
    // Get inbox to retrieve WUZAPI token
    const inbox = await inboxService.getInboxById(inboxId);
    if (!inbox) {
      return res.status(404).json({ error: 'Caixa de entrada não encontrada' });
    }
    
    if (!inbox.wuzapiToken) {
      return res.status(400).json({ error: 'Esta caixa de entrada não tem conexão WhatsApp configurada' });
    }
    
    // Import contacts from WUZAPI
    logger.info('Importing contacts from WUZAPI for inbox', { 
      agentId, 
      inboxId, 
      inboxName: inbox.name,
      tokenPrefix: inbox.wuzapiToken.substring(0, 8) + '...'
    });
    
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    // Call WUZAPI to get contacts
    const wuzapiResponse = await axios.get(
      `${wuzapiBaseUrl}/user/contacts`,
      {
        headers: {
          'token': inbox.wuzapiToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    if (!wuzapiResponse.data || !wuzapiResponse.data.data) {
      logger.warn('Empty or invalid response from WUZAPI', { inboxId });
      return res.json({
        success: true,
        data: {
          contacts: [],
          total: 0,
          imported: 0
        }
      });
    }
    
    const wuzapiContacts = wuzapiResponse.data.data;
    let imported = 0;
    
    // Process contacts from WUZAPI response (it's an object with JID as keys)
    for (const [jid, contact] of Object.entries(wuzapiContacts)) {
      // Skip groups, LID contacts, and contacts not found
      if (!jid || !jid.includes('@s.whatsapp.net') || jid.includes('@g.us') || jid.includes('@lid')) {
        continue;
      }
      
      if (!contact.Found) {
        continue;
      }
      
      const contactJid = jid;
      const contactName = contact.PushName || contact.FullName || contact.FirstName || null;
      
      // Check if conversation already exists
      const existingConv = await db.query(
        'SELECT id FROM conversations WHERE inbox_id = ? AND contact_jid = ?',
        [inboxId, contactJid]
      );
      
      if (existingConv.rows.length === 0) {
        // Create new conversation (id is auto-generated)
        const now = new Date().toISOString();
        
        await db.query(`
          INSERT INTO conversations (
            user_id, contact_jid, contact_name, inbox_id, 
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          inbox.accountId,
          contactJid,
          contactName,
          inboxId,
          'open',
          now,
          now
        ]);
        
        imported++;
      } else if (contactName) {
        // Update contact name if we have a new one
        await db.query(
          'UPDATE conversations SET contact_name = ?, updated_at = ? WHERE inbox_id = ? AND contact_jid = ?',
          [contactName, new Date().toISOString(), inboxId, contactJid]
        );
      }
    }
    
    logger.info('Contacts imported from WUZAPI', { 
      agentId, 
      inboxId, 
      total: Object.keys(wuzapiContacts).length, 
      imported 
    });
    
    // Return updated contacts list
    const { rows: contacts } = await db.query(`
      SELECT DISTINCT
        c.contact_jid as id,
        c.contact_name as name,
        c.contact_jid as phone,
        c.contact_avatar_url as avatarUrl
      FROM conversations c
      WHERE c.inbox_id = ?
      ORDER BY c.contact_name
    `, [inboxId]);
    
    const transformedContacts = contacts.map(contact => ({
      id: contact.id,
      name: contact.name || contact.phone?.replace('@s.whatsapp.net', ''),
      phone: contact.phone?.replace('@s.whatsapp.net', ''),
      avatarUrl: contact.avatarUrl
    }));
    
    res.json({
      success: true,
      data: {
        contacts: transformedContacts,
        total: transformedContacts.length,
        imported
      }
    });
  } catch (error) {
    logger.error('Failed to import contacts from inbox', { 
      error: error.message, 
      agentId: req.agent?.id,
      inboxId: req.params.inboxId,
      stack: error.stack
    });
    res.status(500).json({ error: error.message || 'Erro ao importar contatos' });
  }
});

/**
 * GET /api/agent/database-connections
 * Get database connections available to the agent (from account)
 */
router.get('/database-connections', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const accountId = req.account.id;
    
    // Get all connections for the account
    const connections = await db.getAllConnections();
    
    // Filter to only return basic info (no credentials)
    const sanitizedConnections = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      type: conn.type,
      status: conn.status
    }));
    
    res.json({
      success: true,
      connections: sanitizedConnections
    });
  } catch (error) {
    logger.error('Failed to get database connections for agent', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar conexões de banco de dados' });
  }
});

/**
 * GET /api/agent/my-database-connections
 * Get database connections that the agent has explicit access to
 * Returns only connections with 'view' or 'full' access level
 */
router.get('/my-database-connections', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    
    // Initialize AgentDatabaseAccessService
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    
    // Get accessible databases for this agent
    const accessibleDatabases = await accessService.getAccessibleDatabases(agentId);
    
    if (accessibleDatabases.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    // Get full connection details for accessible databases
    const connectionIds = accessibleDatabases.map(a => a.connectionId);
    const connections = await db.getAllConnections();
    
    // Filter and enrich with access level
    const accessibleConnections = connections
      .filter(conn => connectionIds.includes(String(conn.id)))
      .map(conn => {
        const access = accessibleDatabases.find(a => a.connectionId === String(conn.id));
        return {
          id: String(conn.id),
          name: conn.name,
          type: conn.type,
          status: conn.status,
          accessLevel: access?.accessLevel || 'view'
        };
      });
    
    res.json({
      success: true,
      data: accessibleConnections
    });
  } catch (error) {
    logger.error('Failed to get agent database connections', { 
      error: error.message, 
      agentId: req.agent?.id 
    });
    res.status(500).json({ error: 'Erro ao carregar conexões de banco de dados' });
  }
});

/**
 * POST /api/agent/database-connections/:id/preview
 * Preview contacts from a database connection
 */
router.post('/database-connections/:id/preview', requireAgentAuth(null), async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req.body;
    const db = req.app.locals.db;
    
    // Import ContactFetcherService
    const ContactFetcherService = require('../services/ContactFetcherService');
    const fetcher = new ContactFetcherService(db);
    
    // Use a system token or the account's token for fetching
    // For now, we'll pass null and let the service handle it
    const contacts = await fetcher.fetchContacts(id, null, query);
    
    res.json({
      success: true,
      count: contacts.length,
      contacts: contacts.slice(0, 10), // Preview only
      totalAvailable: contacts.length
    });
  } catch (error) {
    logger.error('Failed to preview contacts for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.id
    });
    res.status(500).json({ 
      success: false,
      message: error.message || 'Erro ao buscar contatos' 
    });
  }
});

/**
 * POST /api/agent/database-connections/:id/fetch
 * Fetch all contacts from a database connection
 */
router.post('/database-connections/:id/fetch', requireAgentAuth(null), async (req, res) => {
  try {
    const { id } = req.params;
    const { query } = req.body;
    const db = req.app.locals.db;
    
    // Import ContactFetcherService
    const ContactFetcherService = require('../services/ContactFetcherService');
    const fetcher = new ContactFetcherService(db);
    
    const contacts = await fetcher.fetchContacts(id, null, query);
    
    logger.info('Agent fetched contacts from database', {
      agentId: req.agent.id,
      connectionId: id,
      count: contacts.length
    });
    
    res.json({
      success: true,
      count: contacts.length,
      contacts: contacts
    });
  } catch (error) {
    logger.error('Failed to fetch contacts for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.id
    });
    res.status(500).json({ 
      success: false,
      message: error.message || 'Erro ao importar contatos' 
    });
  }
});

/**
 * GET /api/agent/database/:connectionId
 * Get connection details and table data for agent
 * Requires agent to have access to this connection
 */
router.get('/database/:connectionId', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId } = req.params;
    
    // Check agent has access to this connection
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    // Get connection details
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Sanitize connection (remove sensitive data)
    const sanitizedConnection = {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      status: connection.status,
      baseUrl: connection.baseUrl,
      tableId: connection.tableId,
      fieldMappings: connection.fieldMappings || connection.field_mappings || [],
      viewConfiguration: connection.viewConfiguration || connection.view_configuration || {},
      default_view_mode: connection.default_view_mode,
      accessLevel: accessLevel
    };
    
    logger.info('Agent accessed database connection', {
      agentId,
      connectionId,
      accessLevel
    });
    
    res.json({
      success: true,
      data: sanitizedConnection
    });
  } catch (error) {
    logger.error('Failed to get database connection for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId
    });
    res.status(500).json({ error: 'Erro ao carregar conexão de banco de dados' });
  }
});

/**
 * GET /api/agent/database/:connectionId/data
 * Get table data for agent (fetches all records without user filtering)
 */
router.get('/database/:connectionId/data', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId } = req.params;
    
    // Check agent has access
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    // Get connection
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Fetch all data from NocoDB without user filtering
    const axios = require('axios');
    let records = [];
    
    if (connection.type === 'NOCODB') {
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;
      const limit = parseInt(process.env.DEFAULT_RECORDS_LIMIT) || 1000;
      
      const response = await nocoApi.get(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        { params: { limit } }
      );
      
      records = response.data?.list || response.data || [];
    } else {
      // For other types, use existing methods (they may need userToken)
      // For now, return empty for non-NocoDB connections
      logger.warn('Agent database access for non-NocoDB connections not fully implemented', {
        connectionType: connection.type,
        connectionId
      });
      records = [];
    }
    
    // Format data if method exists
    const formattedData = db.formatTableData ? db.formatTableData(records, connection) : records;
    
    logger.info('Agent fetched database data', {
      agentId,
      connectionId,
      recordCount: formattedData.length
    });
    
    res.json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    logger.error('Failed to get database data for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId
    });
    res.status(500).json({ error: 'Erro ao carregar dados do banco de dados' });
  }
});

/**
 * GET /api/agent/database/:connectionId/record/:recordId
 * Get a specific record for agent
 */
router.get('/database/:connectionId/record/:recordId', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId, recordId } = req.params;
    
    // Check agent has access
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    // Get connection
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Fetch record using database methods
    let record = null;
    if (connection.type === 'NOCODB') {
      record = await db.getNocoDBRecordById(connection, recordId);
    } else {
      record = await db.getExternalDBRecordById(connection, recordId);
    }
    
    if (!record) {
      return res.status(404).json({ error: 'Registro não encontrado' });
    }
    
    logger.info('Agent fetched database record', {
      agentId,
      connectionId,
      recordId
    });
    
    res.json({
      success: true,
      data: record,
      accessLevel: accessLevel
    });
  } catch (error) {
    logger.error('Failed to get record for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId,
      recordId: req.params.recordId
    });
    res.status(500).json({ error: 'Erro ao carregar registro' });
  }
});

/**
 * PUT /api/agent/database/:connectionId/record/:recordId
 * Update a record (only if agent has 'full' access)
 */
router.put('/database/:connectionId/record/:recordId', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId, recordId } = req.params;
    const updateData = req.body;
    
    // Check agent has FULL access
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    if (accessLevel !== 'full') {
      return res.status(403).json({ error: 'Você não tem permissão para editar registros nesta conexão' });
    }
    
    // Get connection
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Update record using database methods
    let updatedRecord = null;
    if (connection.type === 'NOCODB') {
      updatedRecord = await db.updateNocoDBRecord(connection, recordId, updateData);
    } else {
      updatedRecord = await db.updateExternalDBRecord(connection, recordId, updateData);
    }
    
    logger.info('Agent updated database record', {
      agentId,
      connectionId,
      recordId,
      fieldsUpdated: Object.keys(updateData)
    });
    
    res.json({
      success: true,
      data: updatedRecord
    });
  } catch (error) {
    logger.error('Failed to update record for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId,
      recordId: req.params.recordId
    });
    res.status(500).json({ error: 'Erro ao atualizar registro' });
  }
});

/**
 * POST /api/agent/database/:connectionId/record
 * Create a new record (only if agent has 'full' access)
 */
router.post('/database/:connectionId/record', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId } = req.params;
    const recordData = req.body;
    
    // Check agent has FULL access
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    if (accessLevel !== 'full') {
      return res.status(403).json({ error: 'Você não tem permissão para criar registros nesta conexão' });
    }
    
    // Get connection
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Create record using database methods
    let newRecord = null;
    if (connection.type === 'NOCODB') {
      // Use axios directly for NocoDB create
      const axios = require('axios');
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const projectId = connection.nocodb_project_id || connection.database;
      const tableId = connection.nocodb_table_id || connection.table_name;
      
      const response = await nocoApi.post(
        `/api/v1/db/data/noco/${projectId}/${tableId}`,
        recordData
      );
      newRecord = response.data;
    } else {
      // For other types, use existing methods if available
      logger.warn('Agent record creation for non-NocoDB connections not fully implemented', {
        connectionType: connection.type,
        connectionId
      });
      throw new Error('Criação de registros não suportada para este tipo de conexão');
    }
    
    logger.info('Agent created database record', {
      agentId,
      connectionId,
      recordId: newRecord?.Id || newRecord?.id
    });
    
    res.json({
      success: true,
      data: newRecord
    });
  } catch (error) {
    logger.error('Failed to create record for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId
    });
    res.status(500).json({ error: error.message || 'Erro ao criar registro' });
  }
});

/**
 * GET /api/agent/database/:connectionId/columns
 * Get NocoDB columns for a connection
 */
router.get('/database/:connectionId/columns', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const agentId = req.agent.id;
    const { connectionId } = req.params;
    
    // Check agent has access
    const AgentDatabaseAccessService = require('../services/AgentDatabaseAccessService');
    const accessService = new AgentDatabaseAccessService(db);
    const accessLevel = await accessService.checkDatabaseAccess(agentId, connectionId);
    
    if (accessLevel === 'none') {
      return res.status(403).json({ error: 'Acesso negado a esta conexão de banco de dados' });
    }
    
    // Get connection
    const connection = await db.getConnectionById(parseInt(connectionId));
    if (!connection) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    
    // Fetch columns from NocoDB
    let columns = [];
    if (connection.type === 'NOCODB') {
      const axios = require('axios');
      const nocoApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      const tableId = connection.nocodb_table_id || connection.table_name;
      
      const response = await nocoApi.get(`/api/v1/db/meta/tables/${tableId}/columns`);
      columns = response.data?.list || response.data || [];
    }
    
    res.json({
      success: true,
      data: columns
    });
  } catch (error) {
    logger.error('Failed to get columns for agent', { 
      error: error.message, 
      agentId: req.agent?.id,
      connectionId: req.params.connectionId
    });
    res.status(500).json({ error: 'Erro ao carregar colunas' });
  }
});

/**
 * GET /api/agent/custom-themes
 * List all custom themes (read-only for agents)
 */
router.get('/custom-themes', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { getCustomThemeService } = require('../services/CustomThemeService');
    const service = getCustomThemeService(db);
    
    const { connection_id, limit, offset } = req.query;

    const themes = await service.list({
      connectionId: connection_id ? parseInt(connection_id, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });

    const total = await service.count({
      connectionId: connection_id ? parseInt(connection_id, 10) : undefined,
    });

    res.json({
      success: true,
      data: {
        themes,
        total,
      },
    });
  } catch (error) {
    logger.error('Failed to list custom themes for agent', {
      error: error.message,
      agentId: req.agent?.id,
      endpoint: '/api/agent/custom-themes',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/agent/custom-themes/:id
 * Get a single custom theme (read-only for agents)
 */
router.get('/custom-themes/:id', requireAgentAuth(null), async (req, res) => {
  try {
    const db = req.app.locals.db;
    const { getCustomThemeService } = require('../services/CustomThemeService');
    const service = getCustomThemeService(db);
    
    const { id } = req.params;
    const theme = await service.getById(parseInt(id, 10));

    if (!theme) {
      return res.status(404).json({
        success: false,
        error: 'Theme not found',
      });
    }

    res.json({
      success: true,
      data: theme,
    });
  } catch (error) {
    logger.error('Failed to get custom theme for agent', {
      error: error.message,
      themeId: req.params.id,
      agentId: req.agent?.id,
      endpoint: '/api/agent/custom-themes/:id',
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
