/**
 * InboxContextService
 * 
 * Gerencia o contexto de inbox para usuários autenticados via Supabase Auth.
 * Suporta tanto owners (donos de account) quanto agentes (membros de times).
 * 
 * Requirements: 1.1, 1.2, 1.3, 2.1, 6.4, 7.1, 7.2, 9.1, 9.2, 10.1, 10.2, 11.1, 11.2, 11.3
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class InboxContextService {
  /**
   * Carrega contexto completo para um usuário (owner ou agent)
   * @param {string} userId - Supabase Auth user ID
   * @returns {Promise<Object>} SessionContext
   */
  static async getUserInboxContext(userId) {
    try {
      logger.debug('Loading inbox context', { userId });

      // 1. Verificar se usuário é owner de alguma account
      const ownerResult = await this.checkIfOwner(userId);
      
      if (ownerResult.isOwner) {
        return await this.buildOwnerContext(userId, ownerResult.account);
      }

      // 2. Verificar se usuário é agent
      const agentResult = await this.checkIfAgent(userId);
      
      if (agentResult.isAgent) {
        return await this.buildAgentContext(userId, agentResult.agent);
      }

      // 3. Nenhum dos dois - erro
      logger.warn('User has no account or agent association', { userId });
      throw {
        code: 'NO_ACCOUNT',
        status: 401,
        message: 'Nenhuma conta vinculada ao usuário'
      };

    } catch (error) {
      if (error.code && error.status) {
        throw error; // Re-throw known errors
      }
      logger.error('Error loading inbox context', {
        userId,
        error: error.message,
        stack: error.stack
      });
      throw {
        code: 'CONTEXT_LOAD_ERROR',
        status: 500,
        message: 'Erro ao carregar contexto'
      };
    }
  }

  /**
   * Verifica se usuário é owner de alguma account
   * @param {string} userId
   * @returns {Promise<{isOwner: boolean, account: Object|null}>}
   */
  static async checkIfOwner(userId) {
    const { data: account, error } = await SupabaseService.queryAsAdmin('accounts', (query) =>
      query.select('*').eq('owner_user_id', userId).single()
    );

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      logger.error('Error checking owner status', { userId, error: error.message });
    }

    return {
      isOwner: !!account,
      account: account || null
    };
  }

  /**
   * Verifica se usuário é agent
   * @param {string} userId
   * @returns {Promise<{isAgent: boolean, agent: Object|null}>}
   */
  static async checkIfAgent(userId) {
    const { data: agent, error } = await SupabaseService.queryAsAdmin('agents', (query) =>
      query.select('*, accounts(*)').eq('user_id', userId).eq('status', 'active').single()
    );

    if (error && error.code !== 'PGRST116') {
      logger.error('Error checking agent status', { userId, error: error.message });
    }

    return {
      isAgent: !!agent,
      agent: agent || null
    };
  }

  /**
   * Constrói contexto para owner
   * @param {string} userId
   * @param {Object} account
   * @returns {Promise<Object>} SessionContext
   */
  static async buildOwnerContext(userId, account) {
    // Buscar todas as inboxes da account
    const availableInboxes = await this.getAvailableInboxes(userId, account.id, 'owner');

    if (availableInboxes.length === 0) {
      throw {
        code: 'NO_INBOX',
        status: 403,
        message: 'Nenhuma caixa de entrada disponível'
      };
    }

    // Selecionar inbox ativa
    const activeInbox = await this.selectActiveInbox(userId, availableInboxes);

    // Buscar email do usuário via Supabase Auth Admin API
    let userEmail = '';
    try {
      const { data: authUser, error: authError } = await SupabaseService.adminClient.auth.admin.getUserById(userId);
      if (!authError && authUser?.user?.email) {
        userEmail = authUser.user.email;
      }
    } catch (authErr) {
      logger.debug('Could not fetch user email from auth', { userId, error: authErr.message });
    }

    return {
      userId,
      userType: 'owner',
      email: userEmail,
      agentId: null,
      agentRole: 'owner',
      accountId: account.id,
      accountName: account.name,
      tenantId: account.tenant_id,
      inboxId: activeInbox.id,
      inboxName: activeInbox.name,
      wuzapiToken: activeInbox.wuzapi_token,
      instance: activeInbox.wuzapi_user_id || activeInbox.wuzapi_token,
      phoneNumber: activeInbox.phone_number,
      isConnected: activeInbox.wuzapi_connected || false,
      permissions: ['*'], // Owner tem todas as permissões
      availableInboxes
    };
  }

  /**
   * Constrói contexto para agent
   * @param {string} userId
   * @param {Object} agent
   * @returns {Promise<Object>} SessionContext
   */
  static async buildAgentContext(userId, agent) {
    const account = agent.accounts;

    // Buscar inboxes associadas ao agent
    const availableInboxes = await this.getAvailableInboxes(userId, account.id, 'agent', agent.id);

    if (availableInboxes.length === 0) {
      throw {
        code: 'NO_INBOX',
        status: 403,
        message: 'Nenhuma caixa de entrada disponível para este agente'
      };
    }

    // Selecionar inbox ativa
    const activeInbox = await this.selectActiveInbox(userId, availableInboxes);

    // Buscar permissões do agent
    const permissions = await this.getAgentPermissions(agent.id, agent.role, agent.custom_role_id);

    return {
      userId,
      userType: 'agent',
      email: agent.email,
      agentId: agent.id,
      agentRole: agent.role,
      accountId: account.id,
      accountName: account.name,
      tenantId: account.tenant_id,
      inboxId: activeInbox.id,
      inboxName: activeInbox.name,
      wuzapiToken: activeInbox.wuzapi_token,
      instance: activeInbox.wuzapi_user_id || activeInbox.wuzapi_token,
      phoneNumber: activeInbox.phone_number,
      isConnected: activeInbox.wuzapi_connected || false,
      permissions,
      availableInboxes
    };
  }

  /**
   * Busca inboxes disponíveis para o usuário
   * @param {string} userId
   * @param {string} accountId
   * @param {string} userType - 'owner' | 'agent'
   * @param {string} agentId - Required if userType is 'agent'
   * @returns {Promise<Array>} InboxSummary[]
   */
  static async getAvailableInboxes(userId, accountId, userType, agentId = null) {
    let inboxes = [];

    if (userType === 'owner') {
      // Owner tem acesso a todas as inboxes da account
      const { data, error } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
        query.select('*')
          .eq('account_id', accountId)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
      );

      if (error) {
        logger.error('Error fetching owner inboxes', { accountId, error: error.message });
        return [];
      }

      inboxes = data || [];
    } else {
      // Agent tem acesso apenas às inboxes associadas via inbox_members
      const { data, error } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
        query.select('inbox_id, inboxes(*)')
          .eq('agent_id', agentId)
      );

      if (error) {
        logger.error('Error fetching agent inboxes', { agentId, error: error.message });
        return [];
      }

      inboxes = (data || [])
        .map(im => im.inboxes)
        .filter(inbox => inbox && inbox.status === 'active');
    }

    // Buscar preferência de inbox primária do usuário
    const { data: userInboxes } = await SupabaseService.queryAsAdmin('user_inboxes', (query) =>
      query.select('inbox_id, is_primary').eq('user_id', userId)
    );

    const primaryInboxId = userInboxes?.find(ui => ui.is_primary)?.inbox_id;

    // Formatar para InboxSummary
    return inboxes.map(inbox => ({
      id: inbox.id,
      name: inbox.name,
      phoneNumber: inbox.phone_number,
      isConnected: inbox.wuzapi_connected || false,
      isPrimary: inbox.id === primaryInboxId,
      wuzapi_token: inbox.wuzapi_token,
      wuzapi_user_id: inbox.wuzapi_user_id,
      wuzapi_connected: inbox.wuzapi_connected
    }));
  }

  /**
   * Seleciona inbox ativa baseado em preferências
   * @param {string} userId
   * @param {Array} inboxes
   * @returns {Promise<Object>} Inbox selecionada
   */
  static async selectActiveInbox(userId, inboxes) {
    if (inboxes.length === 0) {
      return null;
    }

    // 1. Verificar preferência salva
    const { data: preference } = await SupabaseService.queryAsAdmin('user_preferences', (query) =>
      query.select('value')
        .eq('user_id', userId)
        .eq('key', 'active_inbox_id')
        .single()
    );

    if (preference?.value?.inboxId) {
      const preferredInbox = inboxes.find(i => i.id === preference.value.inboxId);
      if (preferredInbox) {
        return preferredInbox;
      }
    }

    // 2. Usar inbox marcada como primária
    const primaryInbox = inboxes.find(i => i.isPrimary);
    if (primaryInbox) {
      return primaryInbox;
    }

    // 3. Usar primeira inbox
    return inboxes[0];
  }

  /**
   * Troca a inbox ativa do usuário
   * @param {string} userId
   * @param {string} inboxId
   * @returns {Promise<Object>} Novo SessionContext
   */
  static async switchActiveInbox(userId, inboxId) {
    // Verificar acesso
    const hasAccess = await this.hasInboxAccess(userId, inboxId);
    
    if (!hasAccess) {
      throw {
        code: 'INBOX_ACCESS_DENIED',
        status: 403,
        message: 'Acesso negado a esta caixa de entrada'
      };
    }

    // Salvar preferência
    await this.saveInboxPreference(userId, inboxId);

    // Retornar novo contexto
    return await this.getUserInboxContext(userId);
  }

  /**
   * Salva preferência de inbox do usuário
   * @param {string} userId
   * @param {string} inboxId
   */
  static async saveInboxPreference(userId, inboxId) {
    const { error } = await SupabaseService.adminClient
      .from('user_preferences')
      .upsert({
        user_id: userId,
        key: 'active_inbox_id',
        value: { inboxId },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,key'
      });

    if (error) {
      logger.error('Error saving inbox preference', { userId, inboxId, error: error.message });
      throw error;
    }

    logger.info('Inbox preference saved', { userId, inboxId });
  }

  /**
   * Verifica se usuário tem acesso a uma inbox específica
   * @param {string} userId
   * @param {string} inboxId
   * @returns {Promise<boolean>}
   */
  static async hasInboxAccess(userId, inboxId) {
    // Verificar se é owner da account que possui a inbox
    const { data: inbox } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
      query.select('account_id').eq('id', inboxId).single()
    );

    if (!inbox) {
      return false;
    }

    // Verificar se é owner
    const { data: account } = await SupabaseService.queryAsAdmin('accounts', (query) =>
      query.select('id').eq('id', inbox.account_id).eq('owner_user_id', userId).single()
    );

    if (account) {
      return true;
    }

    // Verificar se é agent com acesso
    const { data: agent } = await SupabaseService.queryAsAdmin('agents', (query) =>
      query.select('id').eq('user_id', userId).eq('account_id', inbox.account_id).single()
    );

    if (!agent) {
      return false;
    }

    // Verificar inbox_members
    const { data: membership } = await SupabaseService.queryAsAdmin('inbox_members', (query) =>
      query.select('id').eq('agent_id', agent.id).eq('inbox_id', inboxId).single()
    );

    return !!membership;
  }

  /**
   * Busca permissões do agent
   * @param {string} agentId
   * @param {string} role
   * @param {string} customRoleId
   * @returns {Promise<string[]>}
   */
  static async getAgentPermissions(agentId, role, customRoleId) {
    // Permissões padrão por role
    const defaultPermissions = {
      owner: ['*'],
      administrator: [
        'messages:send', 'messages:read', 'messages:delete',
        'contacts:read', 'contacts:write', 'contacts:delete',
        'conversations:read', 'conversations:write', 'conversations:assign',
        'campaigns:read', 'campaigns:write',
        'reports:read',
        'settings:read', 'settings:write',
        'agents:read', 'agents:write'
      ],
      agent: [
        'messages:send', 'messages:read',
        'contacts:read', 'contacts:write',
        'conversations:read', 'conversations:write',
        'campaigns:read'
      ]
    };

    // Se tem custom_role_id, buscar permissões customizadas
    if (customRoleId) {
      const { data: customRole } = await SupabaseService.queryAsAdmin('custom_roles', (query) =>
        query.select('permissions').eq('id', customRoleId).single()
      );

      if (customRole?.permissions) {
        return customRole.permissions;
      }
    }

    return defaultPermissions[role] || defaultPermissions.agent;
  }

  /**
   * Verifica status de conexão da inbox via WUZAPI
   * @param {string} inboxId
   * @returns {Promise<boolean>}
   */
  static async checkInboxConnectionStatus(inboxId) {
    const { data: inbox } = await SupabaseService.queryAsAdmin('inboxes', (query) =>
      query.select('wuzapi_token, wuzapi_connected').eq('id', inboxId).single()
    );

    if (!inbox) {
      return false;
    }

    // Por enquanto, retornar o status salvo no banco
    // TODO: Implementar verificação real via WUZAPI
    return inbox.wuzapi_connected || false;
  }

  /**
   * Obtém a seleção de inboxes salva do usuário
   * @param {string} userId
   * @returns {Promise<'all' | string[]>}
   */
  static async getInboxSelection(userId) {
    try {
      const { data: preference } = await SupabaseService.queryAsAdmin('user_preferences', (query) =>
        query.select('value')
          .eq('user_id', userId)
          .eq('key', 'inbox_selection')
          .single()
      );

      if (preference?.value?.selection) {
        return preference.value.selection;
      }

      // Padrão: todas as caixas
      return 'all';
    } catch (error) {
      logger.debug('No inbox selection found, using default', { userId });
      return 'all';
    }
  }

  /**
   * Salva a seleção de inboxes do usuário
   * @param {string} userId
   * @param {'all' | string[]} selection
   */
  static async saveInboxSelection(userId, selection) {
    const { error } = await SupabaseService.adminClient
      .from('user_preferences')
      .upsert({
        user_id: userId,
        key: 'inbox_selection',
        value: { selection },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,key'
      });

    if (error) {
      logger.error('Error saving inbox selection', { userId, selection, error: error.message });
      throw error;
    }

    logger.info('Inbox selection saved', { 
      userId, 
      selection: selection === 'all' ? 'all' : `${selection.length} inboxes` 
    });
  }
}

module.exports = InboxContextService;
