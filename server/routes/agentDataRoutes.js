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
 * GET /api/agent/my/inboxes/status
 * Get connection status for all inboxes assigned to the current agent
 * Returns status for each WhatsApp inbox and a summary
 */
router.get('/my/inboxes/status', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    const wuzapiClient = require('../utils/wuzapiClient');
    
    const agentId = req.agent.id;
    
    // Get inboxes where this agent is a member
    const inboxes = await inboxService.listAgentInboxes(agentId);
    
    // Initialize summary counters
    let online = 0;
    let offline = 0;
    let connecting = 0;
    
    // Get status for each inbox
    const statuses = await Promise.all(inboxes.map(async (inbox) => {
      const baseStatus = {
        inboxId: inbox.id,
        inboxName: inbox.name,
        channelType: inbox.channelType
      };
      
      // Only check status for WhatsApp inboxes
      if (inbox.channelType !== 'whatsapp') {
        return {
          ...baseStatus,
          status: 'not_applicable',
          connected: false,
          loggedIn: false
        };
      }
      
      // If no WUZAPI token configured
      if (!inbox.wuzapiToken) {
        offline++;
        return {
          ...baseStatus,
          status: 'not_configured',
          connected: false,
          loggedIn: false
        };
      }
      
      try {
        // Get session status from WUZAPI
        const statusResult = await wuzapiClient.get('/session/status', {
          headers: { 'token': inbox.wuzapiToken }
        });
        
        // Handle nested data structure from WUZAPI
        const responseData = statusResult.data || {};
        const innerData = responseData.data || responseData;
        const connected = statusResult.success && (innerData.Connected || innerData.connected || false);
        const loggedIn = statusResult.success && (innerData.LoggedIn || innerData.loggedIn || false);
        
        // Determine status and update counters
        let status;
        if (loggedIn) {
          status = 'connected';
          online++;
        } else if (connected) {
          status = 'connecting';
          connecting++;
        } else {
          status = 'disconnected';
          offline++;
        }
        
        return {
          ...baseStatus,
          status,
          connected,
          loggedIn
        };
      } catch (error) {
        logger.warn('Failed to get inbox status from WUZAPI', {
          inboxId: inbox.id,
          error: error.message
        });
        offline++;
        return {
          ...baseStatus,
          status: 'unknown',
          connected: false,
          loggedIn: false
        };
      }
    }));
    
    logger.info('Agent inbox statuses fetched', {
      agentId,
      total: inboxes.length,
      online,
      offline,
      connecting
    });
    
    res.json({
      success: true,
      data: statuses,
      summary: {
        total: inboxes.length,
        online,
        offline,
        connecting
      }
    });
  } catch (error) {
    logger.error('Failed to get agent inbox statuses', {
      error: error.message,
      agentId: req.agent?.id
    });
    res.status(500).json({ error: 'Erro ao carregar status das caixas de entrada' });
  }
});

/**
 * GET /api/agent/my/inboxes/:inboxId/status
 * Get connection status for a specific inbox assigned to the current agent
 */
router.get('/my/inboxes/:inboxId/status', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    const wuzapiClient = require('../utils/wuzapiClient');
    
    const agentId = req.agent.id;
    const { inboxId } = req.params;
    
    // Verify agent has access to this inbox
    const hasAccess = await inboxService.checkAccess(agentId, inboxId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Acesso negado a esta caixa de entrada' });
    }
    
    // Get inbox details
    const inbox = await inboxService.getInboxById(inboxId);
    if (!inbox) {
      return res.status(404).json({ error: 'Caixa de entrada não encontrada' });
    }
    
    // Only check status for WhatsApp inboxes
    if (inbox.channelType !== 'whatsapp') {
      return res.json({
        success: true,
        data: {
          inboxId: inbox.id,
          status: 'not_applicable',
          connected: false,
          loggedIn: false
        }
      });
    }
    
    // If no WUZAPI token configured
    if (!inbox.wuzapiToken) {
      return res.json({
        success: true,
        data: {
          inboxId: inbox.id,
          status: 'not_configured',
          connected: false,
          loggedIn: false
        }
      });
    }
    
    try {
      // Get session status from WUZAPI
      const statusResult = await wuzapiClient.get('/session/status', {
        headers: { 'token': inbox.wuzapiToken }
      });
      
      // Handle nested data structure from WUZAPI
      const responseData = statusResult.data || {};
      const innerData = responseData.data || responseData;
      const connected = statusResult.success && (innerData.Connected || innerData.connected || false);
      const loggedIn = statusResult.success && (innerData.LoggedIn || innerData.loggedIn || false);
      
      // Determine status
      let status;
      if (loggedIn) {
        status = 'connected';
      } else if (connected) {
        status = 'connecting';
      } else {
        status = 'disconnected';
      }
      
      logger.debug('Agent inbox status fetched', {
        agentId,
        inboxId,
        status,
        connected,
        loggedIn
      });
      
      res.json({
        success: true,
        data: {
          inboxId: inbox.id,
          status,
          connected,
          loggedIn,
          details: statusResult.data || null
        }
      });
    } catch (error) {
      logger.warn('Failed to get inbox status from WUZAPI', {
        inboxId,
        error: error.message
      });
      res.json({
        success: true,
        data: {
          inboxId: inbox.id,
          status: 'unknown',
          connected: false,
          loggedIn: false
        }
      });
    }
  } catch (error) {
    logger.error('Failed to get agent inbox status', {
      error: error.message,
      agentId: req.agent?.id,
      inboxId: req.params.inboxId
    });
    res.status(500).json({ error: 'Erro ao carregar status da caixa de entrada' });
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
    const SupabaseService = require('../services/SupabaseService');
    
    const agentId = req.agent.id;
    const accountId = req.account.id;
    const { search, limit = 50, offset = 0 } = req.query;
    
    // Cap limit at 10000 to prevent excessive queries
    const maxLimit = Math.min(parseInt(limit), 10000);
    
    // Get agent's assigned inbox IDs (for validation)
    const inboxes = await inboxService.listAgentInboxes(agentId);
    const inboxIds = inboxes.map(inbox => inbox.id);
    
    logger.debug('Agent contacts query', { agentId, accountId, inboxIds, search, limit: maxLimit });
    
    if (inboxIds.length === 0) {
      return res.json({
        success: true,
        data: [],
        total: 0
      });
    }
    
    // For large limits, fetch in batches to overcome Supabase's 1000 row limit
    let allConversations = [];
    const BATCH_SIZE = 1000;
    let currentOffset = parseInt(offset);
    let hasMore = true;
    
    while (hasMore && allConversations.length < maxLimit) {
      const batchLimit = Math.min(BATCH_SIZE, maxLimit - allConversations.length);
      
      let query = SupabaseService.adminClient
        .from('conversations')
        .select('contact_jid, contact_name, contact_avatar_url, last_message_at')
        .eq('account_id', accountId)
        .in('inbox_id', inboxIds);
      
      if (search) {
        query = query.or(`contact_name.ilike.%${search}%,contact_jid.ilike.%${search}%`);
      }
      
      const { data: conversations, error: convError } = await query
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .range(currentOffset, currentOffset + batchLimit - 1);
      
      if (convError) {
        logger.error('Failed to query conversations', { error: convError.message });
        throw convError;
      }
      
      if (!conversations || conversations.length === 0) {
        hasMore = false;
      } else {
        allConversations = allConversations.concat(conversations);
        currentOffset += conversations.length;
        
        // If we got less than requested, there's no more data
        if (conversations.length < batchLimit) {
          hasMore = false;
        }
      }
    }
    
    // Deduplicate by contact_jid and transform
    const contactMap = new Map();
    allConversations.forEach(conv => {
      if (!conv.contact_jid) return;
      
      if (!contactMap.has(conv.contact_jid)) {
        contactMap.set(conv.contact_jid, {
          id: conv.contact_jid,
          name: conv.contact_name || conv.contact_jid?.replace('@s.whatsapp.net', ''),
          phone: conv.contact_jid?.replace('@s.whatsapp.net', ''),
          avatarUrl: conv.contact_avatar_url,
          lastContactAt: conv.last_message_at,
          conversationCount: 1
        });
      } else {
        const existing = contactMap.get(conv.contact_jid);
        existing.conversationCount++;
        // Keep the most recent name/avatar
        if (conv.contact_name && !existing.name) {
          existing.name = conv.contact_name;
        }
        if (conv.contact_avatar_url && !existing.avatarUrl) {
          existing.avatarUrl = conv.contact_avatar_url;
        }
      }
    });
    
    const transformedContacts = Array.from(contactMap.values());
    
    // Get total count
    let countQuery = SupabaseService.adminClient
      .from('conversations')
      .select('contact_jid', { count: 'exact', head: true })
      .eq('account_id', accountId)
      .in('inbox_id', inboxIds);
    
    if (search) {
      countQuery = countQuery.or(`contact_name.ilike.%${search}%,contact_jid.ilike.%${search}%`);
    }
    
    const { count: total, error: countError } = await countQuery;
    
    if (countError) {
      logger.warn('Failed to get contacts count', { error: countError.message });
    }
    
    logger.info('Agent contacts retrieved', { 
      agentId, 
      accountId,
      inboxCount: inboxIds.length,
      count: transformedContacts.length, 
      total: total || transformedContacts.length 
    });
    
    res.json({
      success: true,
      data: transformedContacts,
      total: total || transformedContacts.length
    });
  } catch (error) {
    logger.error('Failed to get agent contacts', { 
      error: error.message, 
      stack: error.stack,
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
    const SupabaseService = require('../services/SupabaseService');
    
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
      // Conversations: Count only those assigned to this agent
      const { count: convTotal, error: convError } = await SupabaseService.adminClient
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('inbox_id', inboxIds)
        .eq('assigned_agent_id', agentId);
      
      if (!convError) {
        totalConversations = convTotal || 0;
      }
      
      // Open conversations
      const { count: openCount, error: openError } = await SupabaseService.adminClient
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('inbox_id', inboxIds)
        .eq('assigned_agent_id', agentId)
        .eq('status', 'open');
      
      if (!openError) {
        openConversations = openCount || 0;
      }
      
      // Pending conversations
      const { count: pendingCount, error: pendingError } = await SupabaseService.adminClient
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .in('inbox_id', inboxIds)
        .eq('assigned_agent_id', agentId)
        .eq('status', 'pending');
      
      if (!pendingError) {
        pendingConversations = pendingCount || 0;
      }
      
      // Contacts: Count unique contacts from conversations in agent's inboxes
      const { data: contactData, error: contactError } = await SupabaseService.adminClient
        .from('conversations')
        .select('contact_jid')
        .in('inbox_id', inboxIds)
        .not('contact_jid', 'is', null);
      
      if (!contactError && contactData) {
        // Count unique contact_jid values
        const uniqueContacts = new Set(contactData.map(c => c.contact_jid));
        totalContacts = uniqueContacts.size;
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
 * Optimized with batch upsert for better performance
 */
router.post('/my/inboxes/:inboxId/import-contacts', requireAgentAuth(null), async (req, res) => {
  try {
    initServices(req.app.locals.db);
    const axios = require('axios');
    const SupabaseService = require('../services/SupabaseService');
    const crypto = require('crypto');
    
    const agentId = req.agent.id;
    const { inboxId } = req.params;
    
    logger.debug('Import contacts request', { agentId, inboxId });
    
    // Verify agent has access to this inbox
    const hasAccess = await inboxService.checkAccess(agentId, inboxId);
    logger.debug('Access check result', { agentId, inboxId, hasAccess });
    
    if (!hasAccess) {
      logger.warn('Agent access denied to inbox', { agentId, inboxId });
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
    const now = new Date().toISOString();
    
    // Prepare contacts for batch upsert
    const contactsToUpsert = [];
    for (const [jid, contact] of Object.entries(wuzapiContacts)) {
      // Skip groups, LID contacts, and contacts not found
      if (!jid || !jid.includes('@s.whatsapp.net') || jid.includes('@g.us') || jid.includes('@lid')) {
        continue;
      }
      
      if (!contact.Found) {
        continue;
      }
      
      const contactName = contact.PushName || contact.FullName || contact.FirstName || null;
      
      contactsToUpsert.push({
        id: crypto.randomUUID(),
        account_id: inbox.accountId,
        contact_jid: jid,
        contact_name: contactName,
        inbox_id: inboxId,
        status: 'open',
        created_at: now,
        updated_at: now
      });
    }
    
    logger.debug('Contacts prepared for upsert', { 
      inboxId, 
      totalFromWuzapi: Object.keys(wuzapiContacts).length,
      validContacts: contactsToUpsert.length 
    });
    
    let imported = 0;
    let updated = 0;
    
    if (contactsToUpsert.length > 0) {
      // First, get existing contacts to know which are new vs updates
      const contactJids = contactsToUpsert.map(c => c.contact_jid);
      const { data: existingContacts } = await SupabaseService.adminClient
        .from('conversations')
        .select('contact_jid')
        .eq('account_id', inbox.accountId)
        .in('contact_jid', contactJids);
      
      const existingJids = new Set((existingContacts || []).map(c => c.contact_jid));
      const newContacts = contactsToUpsert.filter(c => !existingJids.has(c.contact_jid));
      const existingToUpdate = contactsToUpsert.filter(c => existingJids.has(c.contact_jid));
      
      // Batch upsert in chunks of 100 for better performance
      const BATCH_SIZE = 100;
      for (let i = 0; i < contactsToUpsert.length; i += BATCH_SIZE) {
        const batch = contactsToUpsert.slice(i, i + BATCH_SIZE);
        
        // Use upsert with onConflict to handle duplicates
        // Note: unique constraint is on (account_id, contact_jid), not (inbox_id, contact_jid)
        const { data: upsertResult, error: upsertError } = await SupabaseService.adminClient
          .from('conversations')
          .upsert(batch, {
            onConflict: 'account_id,contact_jid',
            ignoreDuplicates: false
          })
          .select('id');
        
        if (upsertError) {
          // If upsert fails (e.g., no unique constraint), fall back to individual inserts
          logger.warn('Batch upsert failed, falling back to individual inserts', { 
            error: upsertError.message,
            batchStart: i,
            batchSize: batch.length
          });
          
          // Fall back: check existing and insert only new ones
          for (const contact of batch) {
            const { data: existing } = await SupabaseService.adminClient
              .from('conversations')
              .select('id')
              .eq('account_id', inbox.accountId)
              .eq('contact_jid', contact.contact_jid)
              .limit(1);
            
            if (!existing || existing.length === 0) {
              const { error: insertError } = await SupabaseService.adminClient
                .from('conversations')
                .insert(contact);
              
              if (!insertError) {
                imported++;
              }
            } else if (contact.contact_name) {
              // Update name if we have one
              await SupabaseService.adminClient
                .from('conversations')
                .update({ 
                  contact_name: contact.contact_name, 
                  updated_at: now 
                })
                .eq('account_id', inbox.accountId)
                .eq('contact_jid', contact.contact_jid);
              updated++;
            }
          }
        }
      }
      
      // Count new contacts from successful upsert
      imported = newContacts.length;
      updated = existingToUpdate.length;
    }
    
    logger.info('Contacts imported from WUZAPI', { 
      agentId, 
      inboxId, 
      total: Object.keys(wuzapiContacts).length, 
      imported,
      updated
    });
    
    // Return updated contacts list using Supabase
    const { data: contacts, error: listError } = await SupabaseService.adminClient
      .from('conversations')
      .select('contact_jid, contact_name, contact_avatar_url')
      .eq('inbox_id', inboxId)
      .order('contact_name');
    
    if (listError) {
      logger.error('Error listing contacts after import', { error: listError.message });
      throw listError;
    }
    
    // Deduplicate by contact_jid
    const contactMap = new Map();
    (contacts || []).forEach(c => {
      if (c.contact_jid && !contactMap.has(c.contact_jid)) {
        contactMap.set(c.contact_jid, {
          id: c.contact_jid,
          name: c.contact_name || c.contact_jid?.replace('@s.whatsapp.net', ''),
          phone: c.contact_jid?.replace('@s.whatsapp.net', ''),
          avatarUrl: c.contact_avatar_url
        });
      }
    });
    
    const transformedContacts = Array.from(contactMap.values());
    
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
