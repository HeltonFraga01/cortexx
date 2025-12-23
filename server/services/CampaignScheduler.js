/**
 * CampaignScheduler Service
 * 
 * Verifica periodicamente campanhas agendadas e as inicia automaticamente:
 * - Verificação a cada 1 minuto
 * - Validação de conexão WUZAPI antes de iniciar
 * - Integração com QueueManager
 * - Tratamento de erros e notificações
 */

const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');
const QueueManager = require('./QueueManager');
const { wuzapiValidator } = require('../utils/wuzapiValidator');
const SupabaseService = require('./SupabaseService');

class CampaignScheduler {
  /**
   * Constructor - no db parameter needed, uses SupabaseService directly
   */
  constructor() {
    this.checkInterval = 60000; // 1 minuto
    this.intervalId = null;
    this.activeQueues = new Map(); // campaignId -> QueueManager
    this.processingLocks = new Map(); // campaignId -> lockId (in-memory locks)
    this.isRunning = false;
    this.wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    this.instanceId = uuidv4().substring(0, 8); // Unique ID for this scheduler instance

    logger.info('CampaignScheduler criado', {
      checkInterval: this.checkInterval,
      wuzapiBaseUrl: this.wuzapiBaseUrl,
      instanceId: this.instanceId
    });
  }

  /**
   * Tenta adquirir lock para processar uma campanha
   * Usa tanto lock em memória quanto lock no banco de dados
   * 
   * @param {string} campaignId - ID da campanha
   * @returns {Promise<boolean>} True se o lock foi adquirido
   */
  async acquireLock(campaignId) {
    // Verificar lock em memória primeiro
    if (this.processingLocks.has(campaignId)) {
      logger.debug('Lock em memória já existe', { campaignId });
      return false;
    }

    try {
      const lockId = `${this.instanceId}-${Date.now()}`;
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      // Check if campaign exists and lock is available
      const { data: campaign, error: fetchError } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.select('id, processing_lock, lock_acquired_at')
          .eq('id', campaignId)
          .single()
      );

      if (fetchError || !campaign) {
        logger.debug('Campanha não encontrada', { campaignId });
        return false;
      }

      // Check if lock is available (no lock or expired lock)
      const lockAvailable = !campaign.processing_lock || 
        (campaign.lock_acquired_at && new Date(campaign.lock_acquired_at) < new Date(fiveMinutesAgo));

      if (!lockAvailable) {
        logger.debug('Lock não disponível', { campaignId, existingLock: campaign.processing_lock });
        return false;
      }

      // Try to acquire lock
      const { data: updated, error: updateError } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.update({ 
          processing_lock: lockId, 
          lock_acquired_at: new Date().toISOString() 
        })
        .eq('id', campaignId)
        .select()
      );

      if (updateError || !updated || updated.length === 0) {
        logger.debug('Não foi possível adquirir lock no banco', { campaignId });
        return false;
      }

      // Lock adquirido no banco, adicionar lock em memória
      this.processingLocks.set(campaignId, lockId);
      
      logger.info('Lock adquirido', { campaignId, lockId });
      return true;

    } catch (error) {
      logger.error('Erro ao adquirir lock', { campaignId, error: error.message });
      return false;
    }
  }

  /**
   * Libera o lock de uma campanha
   * 
   * @param {string} campaignId - ID da campanha
   */
  async releaseLock(campaignId) {
    try {
      // Remover lock em memória
      const lockId = this.processingLocks.get(campaignId);
      this.processingLocks.delete(campaignId);

      // Remover lock no banco de dados usando Supabase
      const { error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.update({ processing_lock: null, lock_acquired_at: null })
          .eq('id', campaignId)
          .eq('processing_lock', lockId)
      );

      if (error) {
        logger.warn('Erro ao liberar lock no banco', { campaignId, error: error.message });
      }
      
      logger.info('Lock liberado', { campaignId, lockId });

    } catch (error) {
      logger.error('Erro ao liberar lock', { campaignId, error: error.message });
    }
  }

  /**
   * Limpa fila ativa após conclusão ou cancelamento
   * 
   * @param {string} campaignId - ID da campanha
   */
  async cleanupQueue(campaignId) {
    try {
      // Remover da lista de filas ativas
      if (this.activeQueues.has(campaignId)) {
        this.activeQueues.delete(campaignId);
        logger.info('Fila removida de activeQueues', { campaignId });
      }

      // Liberar lock
      await this.releaseLock(campaignId);

      logger.info('Cleanup de fila concluído', { campaignId });

    } catch (error) {
      logger.error('Erro no cleanup de fila', { campaignId, error: error.message });
    }
  }

  /**
   * Inicia o scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('CampaignScheduler já está em execução');
      return;
    }

    logger.info('Iniciando CampaignScheduler');
    this.isRunning = true;

    // Executar verificação imediatamente
    this.checkScheduledCampaigns();

    // Configurar verificação periódica
    this.intervalId = setInterval(() => {
      this.checkScheduledCampaigns();
    }, this.checkInterval);
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('CampaignScheduler não está em execução');
      return;
    }

    logger.info('Parando CampaignScheduler');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Pausar todas as filas ativas
    this.activeQueues.forEach((queue, campaignId) => {
      logger.info('Pausando fila ativa', { campaignId });
      queue.pause().catch(err => {
        logger.error('Erro ao pausar fila:', err.message);
      });
    });
  }

  /**
   * Verifica campanhas agendadas que devem ser iniciadas
   */
  async checkScheduledCampaigns() {
    try {
      logger.debug('Verificando campanhas agendadas');

      // Buscar campanhas agendadas para agora ou antes usando Supabase
      const now = new Date().toISOString();
      
      const { data: rows, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.select('*')
          .eq('status', 'scheduled')
          .lte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
      );

      if (error) {
        logger.error('Erro ao buscar campanhas agendadas', { error: error.message });
        return;
      }

      if (!rows || rows.length === 0) {
        logger.debug('Nenhuma campanha agendada para iniciar');
        return;
      }

      logger.info('Campanhas agendadas encontradas', {
        count: rows.length,
        campaigns: rows.map(c => ({ id: c.id, name: c.name, scheduled_at: c.scheduled_at }))
      });

      // Processar cada campanha
      for (const campaign of rows) {
        await this.startScheduledCampaign(campaign);
      }

    } catch (error) {
      logger.error('Erro ao verificar campanhas agendadas:', error.message);
    }
  }

  /**
   * Inicia uma campanha agendada
   */
  async startScheduledCampaign(campaign) {
    try {
      logger.info('Iniciando campanha agendada', {
        campaignId: campaign.id,
        name: campaign.name,
        instance: campaign.instance
      });

      // Tentar adquirir lock para evitar processamento duplicado
      const lockAcquired = await this.acquireLock(campaign.id);
      if (!lockAcquired) {
        logger.warn('Não foi possível adquirir lock, campanha pode estar sendo processada por outra instância', {
          campaignId: campaign.id
        });
        return;
      }

      // Validar formato e conexão da instância WUZAPI
      logger.info('Validando instância WUZAPI antes de iniciar campanha', {
        campaignId: campaign.id,
        instance: campaign.instance?.substring(0, 10) + '...'
      });

      // Validar formato do token
      if (!wuzapiValidator.isValidTokenFormat(campaign.instance)) {
        const errorMsg = 'Token WUZAPI inválido ou muito curto';
        logger.error(errorMsg, {
          campaignId: campaign.id,
          tokenLength: campaign.instance?.length
        });
        await this.failCampaign(campaign.id, errorMsg);
        return;
      }

      // Validar conexão com WUZAPI
      const validation = await wuzapiValidator.validateInstance(campaign.instance);
      
      if (!validation.valid) {
        const errorMsg = `Instância WUZAPI não está conectada: ${validation.error}`;
        logger.error(errorMsg, {
          campaignId: campaign.id,
          status: validation.status
        });
        await this.failCampaign(campaign.id, errorMsg);
        return;
      }

      logger.info('Instância WUZAPI validada com sucesso', {
        campaignId: campaign.id,
        status: validation.status
      });

      // Criar QueueManager
      const config = {
        instance: campaign.instance,
        user_token: campaign.user_token,
        message_type: campaign.message_type,
        message_content: campaign.message_content,
        media_url: campaign.media_url,
        media_type: campaign.media_type,
        media_file_name: campaign.media_file_name,
        delay_min: campaign.delay_min,
        delay_max: campaign.delay_max,
        randomize_order: campaign.randomize_order === 1,
        messages: campaign.messages ? JSON.parse(campaign.messages) : [],
        sending_window: campaign.sending_window ? JSON.parse(campaign.sending_window) : null
      };

      const queueManager = new QueueManager(campaign.id, config);

      // Carregar contatos (já normaliza os números)
      await queueManager.loadContacts();

      if (queueManager.contacts.length === 0) {
        logger.error('Campanha sem contatos, cancelando', {
          campaignId: campaign.id
        });

        await this.failCampaign(campaign.id, 'Nenhum contato encontrado');
        return;
      }

      // Nota: Validação de números de telefone é feita durante o envio via QueueManager
      // usando validatePhoneWithAPI, que valida contra a API WUZAPI /user/check
      logger.info('Iniciando campanha - validação de telefones será feita durante envio', {
        campaignId: campaign.id,
        totalContacts: queueManager.contacts.length
      });

      // Adicionar à lista de filas ativas
      this.activeQueues.set(campaign.id, queueManager);

      // Iniciar processamento (não-bloqueante)
      queueManager.start()
        .then(() => {
          logger.info('Campanha concluída', { campaignId: campaign.id });
          // Limpar fila e liberar lock após conclusão
          this.cleanupQueue(campaign.id);
        })
        .catch(error => {
          logger.error('Erro ao processar campanha:', {
            campaignId: campaign.id,
            error: error.message
          });
          // Limpar fila e liberar lock mesmo em caso de erro
          this.cleanupQueue(campaign.id);
        });

      logger.info('Campanha iniciada com sucesso', {
        campaignId: campaign.id,
        totalContacts: queueManager.contacts.length
      });

    } catch (error) {
      logger.error('Erro ao iniciar campanha agendada:', {
        campaignId: campaign.id,
        error: error.message
      });

      await this.failCampaign(campaign.id, error.message);
    }
  }



  /**
   * Marca campanha como falha
   */
  async failCampaign(campaignId, errorMessage) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.update({ 
          status: 'failed', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', campaignId)
      );

      if (error) {
        logger.error('Erro ao atualizar status da campanha', { campaignId, error: error.message });
      }

      // Limpar fila e liberar lock
      await this.cleanupQueue(campaignId);

      logger.info('Campanha marcada como falha', {
        campaignId,
        errorMessage
      });

    } catch (error) {
      logger.error('Erro ao marcar campanha como falha:', error.message);
    }
  }

  /**
   * Retorna fila ativa por ID da campanha
   */
  getActiveQueue(campaignId) {
    return this.activeQueues.get(campaignId);
  }

  /**
   * Retorna todas as filas ativas
   */
  getActiveQueues() {
    return Array.from(this.activeQueues.entries()).map(([campaignId, queue]) => ({
      campaignId,
      status: queue.status,
      progress: queue.getProgress()
    }));
  }

  /**
   * Pausa uma campanha ativa
   */
  async pauseCampaign(campaignId) {
    const queue = this.activeQueues.get(campaignId);

    if (!queue) {
      throw new Error('Campanha não está em execução');
    }

    await queue.pause();

    logger.info('Campanha pausada', { campaignId });
  }

  /**
   * Busca campanha do banco de dados com validação
   * @param {string} campaignId - ID da campanha
   * @returns {Object} Dados da campanha
   */
  async getCampaignFromDB(campaignId) {
    logger.debug('Buscando campanha no banco', { campaignId });

    const { data, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
      query.select('*').eq('id', campaignId).single()
    );

    if (error || !data) {
      logger.error('Campanha não encontrada no banco', { campaignId, error: error?.message });
      throw new Error('Campanha não encontrada');
    }

    const campaign = data;
    logger.debug('Campanha encontrada', {
      campaignId,
      status: campaign.status,
      name: campaign.name,
      currentIndex: campaign.current_index,
      totalContacts: campaign.total_contacts
    });

    return campaign;
  }

  /**
   * Transforma dados da campanha do banco para formato do QueueManager
   * @param {Object} campaign - Dados da campanha do banco
   * @returns {Object} Configuração no formato esperado pelo QueueManager
   */
  transformCampaignToConfig(campaign) {
    logger.debug('Transformando dados da campanha para config', {
      campaignId: campaign.id
    });

    let messages = [];
    let sendingWindow = null;

    try {
      if (campaign.messages) {
        messages = JSON.parse(campaign.messages);
      }
      if (campaign.sending_window) {
        sendingWindow = JSON.parse(campaign.sending_window);
      }
    } catch (e) {
      logger.error('Erro ao fazer parse de JSON da campanha', { error: e.message, campaignId: campaign.id });
    }

    const config = {
      instance: campaign.instance,
      user_token: campaign.user_token,
      message_type: campaign.message_type,
      message_content: campaign.message_content,
      media_url: campaign.media_url,
      media_type: campaign.media_type,
      media_file_name: campaign.media_file_name,
      delay_min: campaign.delay_min,
      delay_max: campaign.delay_max,
      randomize_order: campaign.randomize_order === 1,
      messages: messages,
      sending_window: sendingWindow
    };

    logger.debug('Config criado com sucesso', {
      campaignId: campaign.id,
      messageType: config.message_type,
      delayRange: `${config.delay_min}-${config.delay_max}s`,
      hasSequence: messages.length > 0,
      hasWindow: !!sendingWindow
    });

    return config;
  }

  /**
   * Retoma uma campanha pausada
   */
  async resumeCampaign(campaignId) {
    try {
      logger.info('Iniciando retomada de campanha', { campaignId });

      // Tentar adquirir lock para evitar processamento duplicado
      const lockAcquired = await this.acquireLock(campaignId);
      if (!lockAcquired) {
        throw new Error('Não foi possível adquirir lock. A campanha pode estar sendo processada por outra instância.');
      }

      let queue = this.activeQueues.get(campaignId);

      // Se a fila não existe (ex: servidor reiniciou), recriar
      if (!queue) {
        logger.info('Fila não encontrada em memória, recriando', { campaignId });

        // 1. Buscar campanha do banco com validação
        const campaign = await this.getCampaignFromDB(campaignId);

        // 2. Validar status
        if (campaign.status !== 'paused') {
          const errorMsg = `Campanha não está pausada. Status atual: ${campaign.status}`;
          logger.error(errorMsg, { campaignId });
          throw new Error(errorMsg);
        }

        // 3. Validar conexão WUZAPI
        logger.info('Validando conexão WUZAPI', {
          campaignId,
          instance: campaign.instance
        });

        const validation = await wuzapiValidator.validateInstance(campaign.instance);

        if (!validation.valid) {
          const errorMsg = `Instância WhatsApp não está conectada: ${validation.error}`;
          logger.error(errorMsg, {
            campaignId,
            instance: campaign.instance,
            status: validation.status
          });
          throw new Error(errorMsg);
        }

        logger.info('Conexão WUZAPI validada com sucesso', {
          campaignId,
          status: validation.status
        });

        // 4. Transformar dados para formato correto
        const config = this.transformCampaignToConfig(campaign);

        // 5. Criar nova fila com config correto
        const QueueManager = require('./QueueManager');
        queue = new QueueManager(campaignId, config);

        logger.info('QueueManager criado', { campaignId });

        // 6. Carregar apenas contatos pendentes (evita reprocessar já enviados)
        await queue.loadContacts(true);

        logger.info('Contatos pendentes carregados', {
          campaignId,
          pendingContactsCount: queue.contacts.length
        });

        // Nota: Validação de números acontece no QueueManager durante o envio
        logger.info('Contatos pendentes prontos para envio', {
          campaignId,
          pendingContactsCount: queue.contacts.length,
          note: 'Validação de números acontecerá durante o envio'
        });

        // 7. Restaurar estado da campanha
        await queue.restoreState(campaign);

        logger.info('Estado restaurado', {
          campaignId,
          currentIndex: queue.currentIndex,
          sentCount: queue.sentCount,
          failedCount: queue.failedCount
        });

        // 8. Adicionar à lista de filas ativas
        this.activeQueues.set(campaignId, queue);

        logger.info('Fila recriada e adicionada às filas ativas', { campaignId });
      }

      // 9. Retomar processamento
      logger.info('Retomando processamento da fila', {
        campaignId,
        status: queue.status,
        currentIndex: queue.currentIndex
      });

      await queue.resume();

      logger.info('Campanha retomada com sucesso', { campaignId });

    } catch (error) {
      logger.error('Erro ao retomar campanha', {
        campaignId,
        error: error.message,
        stack: error.stack
      });
      // Liberar lock em caso de erro
      await this.releaseLock(campaignId);
      throw error;
    }
  }

  /**
   * Cancela uma campanha ativa
   */
  async cancelCampaign(campaignId) {
    const queue = this.activeQueues.get(campaignId);

    if (!queue) {
      throw new Error('Campanha não está em execução');
    }

    await queue.cancel();

    logger.info('Campanha cancelada', { campaignId });

    // Limpar fila e liberar lock após um delay (permite finalização de operações pendentes)
    setTimeout(() => {
      this.cleanupQueue(campaignId);
    }, 5000);
  }

  /**
   * Inicia uma campanha imediatamente (não agendada)
   */
  async startCampaignNow(campaignId) {
    try {
      logger.info('Iniciando campanha imediatamente', { campaignId });

      // Buscar campanha usando Supabase
      const { data: campaign, error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.select('*').eq('id', campaignId).single()
      );

      if (error || !campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Verificar se já está em execução (via lock em memória)
      if (this.processingLocks.has(campaignId)) {
        throw new Error('Campanha já está em execução');
      }

      // Verificar se já está em execução (via activeQueues)
      if (this.activeQueues.has(campaignId)) {
        throw new Error('Campanha já está em execução');
      }

      // Iniciar campanha (acquireLock é chamado dentro de startScheduledCampaign)
      await this.startScheduledCampaign(campaign);

    } catch (error) {
      logger.error('Erro ao iniciar campanha imediatamente:', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Atualiza configurações de uma campanha em execução ou pausada
   * @param {string} campaignId - ID da campanha
   * @param {Object} updates - Campos a atualizar
   * @returns {Object} { campaignId, updatedFields }
   */
  async updateCampaignConfig(campaignId, updates) {
    try {
      logger.info('Atualizando configuração da campanha', {
        campaignId,
        updates: Object.keys(updates)
      });

      // 1. Buscar campanha e validar status
      const campaign = await this.getCampaignFromDB(campaignId);

      const allowedStatuses = ['paused', 'running', 'scheduled'];
      if (!allowedStatuses.includes(campaign.status)) {
        const errorMsg = `Não é possível editar campanha com status: ${campaign.status}`;
        logger.error(errorMsg, { campaignId, currentStatus: campaign.status });
        throw new Error(errorMsg);
      }

      // 2. Validar campos editáveis por status
      const editableByStatus = {
        'scheduled': ['scheduled_at', 'delay_min', 'delay_max', 'sending_window'],
        'paused': ['delay_min', 'delay_max', 'sending_window'],
        'running': ['delay_min', 'delay_max', 'sending_window']
      };

      const allowedFields = editableByStatus[campaign.status];
      const invalidFields = Object.keys(updates).filter(f => !allowedFields.includes(f));

      if (invalidFields.length > 0) {
        const errorMsg = `Campos não editáveis para status ${campaign.status}: ${invalidFields.join(', ')}`;
        logger.error(errorMsg, { campaignId, invalidFields });
        throw new Error(errorMsg);
      }

      // 3. Validar valores
      if (updates.delay_min !== undefined || updates.delay_max !== undefined) {
        const min = updates.delay_min ?? campaign.delay_min;
        const max = updates.delay_max ?? campaign.delay_max;

        if (typeof min !== 'number' || typeof max !== 'number') {
          throw new Error('delay_min e delay_max devem ser números');
        }

        if (min < 1 || max < 1) {
          throw new Error('delay_min e delay_max devem ser >= 1');
        }

        if (min > max) {
          throw new Error('delay_min deve ser <= delay_max');
        }

        logger.debug('Validação de delays aprovada', { min, max });
      }

      if (updates.sending_window !== undefined) {
        const { validateSendingWindow } = require('../validators/bulkCampaignValidator');
        const validation = validateSendingWindow(updates.sending_window);

        if (!validation.valid) {
          const errorMsg = validation.errors.join(', ');
          logger.error('Validação de sending_window falhou', {
            campaignId,
            errors: validation.errors
          });
          throw new Error(errorMsg);
        }

        logger.debug('Validação de sending_window aprovada');
      }

      if (updates.scheduled_at !== undefined) {
        const { validateFutureDate } = require('../validators/bulkCampaignValidator');
        const validation = validateFutureDate(updates.scheduled_at);

        if (!validation.valid) {
          const errorMsg = validation.errors.join(', ');
          logger.error('Validação de scheduled_at falhou', {
            campaignId,
            errors: validation.errors
          });
          throw new Error(errorMsg);
        }

        logger.debug('Validação de scheduled_at aprovada');
      }

      // 4. Persistir no banco usando Supabase
      const updateData = {};

      if (updates.delay_min !== undefined) {
        updateData.delay_min = updates.delay_min;
      }

      if (updates.delay_max !== undefined) {
        updateData.delay_max = updates.delay_max;
      }

      if (updates.sending_window !== undefined) {
        updateData.sending_window = updates.sending_window;
      }

      if (updates.scheduled_at !== undefined) {
        updateData.scheduled_at = updates.scheduled_at;
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await SupabaseService.queryAsAdmin('bulk_campaigns', (query) =>
        query.update(updateData).eq('id', campaignId)
      );

      if (error) {
        throw new Error(`Erro ao atualizar campanha: ${error.message}`);
      }

      logger.info('Configuração persistida no banco', {
        campaignId,
        updatedFields: Object.keys(updates)
      });

      // 5. Atualizar QueueManager ativo (se existir)
      const queue = this.activeQueues.get(campaignId);
      if (queue) {
        queue.updateConfig(updates);
        logger.info('QueueManager ativo atualizado', { campaignId });
      } else {
        logger.debug('QueueManager não está ativo, apenas banco atualizado', {
          campaignId
        });
      }

      return {
        campaignId,
        updatedFields: Object.keys(updates)
      };

    } catch (error) {
      logger.error('Erro ao atualizar configuração da campanha', {
        campaignId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Verifica se uma campanha tem lock ativo
   * @param {string} campaignId - ID da campanha
   * @returns {boolean} True se a campanha tem lock ativo
   */
  hasLock(campaignId) {
    return this.processingLocks.has(campaignId);
  }

  /**
   * Retorna todos os locks ativos
   * @returns {Array} Lista de campaignIds com locks ativos
   */
  getActiveLocks() {
    return Array.from(this.processingLocks.keys());
  }

  /**
   * Retorna estatísticas do scheduler
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      instanceId: this.instanceId,
      activeQueuesCount: this.activeQueues.size,
      activeLocksCount: this.processingLocks.size,
      activeLocks: this.getActiveLocks(),
      activeQueues: this.getActiveQueues()
    };
  }
}

module.exports = CampaignScheduler;
