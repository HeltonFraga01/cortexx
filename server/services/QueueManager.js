/**
 * QueueManager Service
 * 
 * Gerencia a fila de envio de mensagens em massa:
 * - Processamento sequencial com delays humanizados
 * - Controle de estado (running, paused, cancelled)
 * - Persistência de progresso
 * - Retry logic para falhas temporárias
 * - Substituição de variáveis nas mensagens
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { normalizePhoneNumber } = require('../utils/phoneUtils');
const { validatePhoneWithAPI } = require('./PhoneValidationService');
const HumanizationEngine = require('./HumanizationEngine');
const templateProcessor = require('./TemplateProcessor');
const variationTracker = require('./VariationTracker');

class QueueManager {
  /**
   * @param {string} campaignId - ID da campanha
   * @param {Object} config - Configuração da campanha
   */
  constructor(campaignId, config) {
    this.campaignId = campaignId;
    this.config = config;
    // No db parameter needed - uses SupabaseService directly

    // Estado da fila
    this.status = 'initialized'; // initialized, running, paused, completed, cancelled, failed
    this.contacts = [];
    this.currentIndex = 0;
    this.sentCount = 0;
    this.failedCount = 0;
    this.startedAt = null;
    this.pausedAt = null;
    this.completedAt = null;

    // Controle de execução
    this.isPaused = false;
    this.isCancelled = false;
    this.isProcessing = false;

    // Retry configuration
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 segundos

    // WUZAPI configuration
    this.wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    this.wuzapiTimeout = 15000; // 15 segundos

    // Batch processing configuration
    this.batchSize = 100; // Process contacts in batches of 100
    this.batchThreshold = 1000; // Use batch processing when > 1000 contacts

    // Enhanced progress tracking
    this.recentErrors = []; // Last 5 errors
    this.maxRecentErrors = 5;
    this.processingStartTime = null;

    logger.info('QueueManager criado', {
      campaignId,
      instance: config.instance,
      messageType: config.message_type
    });
  }

  /**
   * Gera variáveis dinâmicas no momento do envio
   * @returns {Object} Variáveis dinâmicas (data, saudacao)
   */
  generateDynamicVariables() {
    const now = new Date();

    // Gerar saudação baseada na hora atual
    const hour = now.getHours();
    let saudacao = 'Olá';
    if (hour >= 6 && hour < 12) {
      saudacao = 'Bom dia';
    } else if (hour >= 12 && hour < 18) {
      saudacao = 'Boa tarde';
    } else {
      saudacao = 'Boa noite';
    }

    return {
      data: now.toLocaleDateString('pt-BR'),
      saudacao: saudacao
    };
  }

  /**
   * Inicia o processamento da fila
   */
  async start() {
    try {
      if (this.isProcessing) {
        throw new Error('Fila já está em processamento');
      }

      logger.info('Iniciando processamento da fila', {
        campaignId: this.campaignId,
        totalContacts: this.contacts.length
      });

      this.status = 'running';
      this.isProcessing = true;
      this.startedAt = new Date();
      this.processingStartTime = Date.now();
      this.isPaused = false;
      this.isCancelled = false;

      // Atualizar status no banco
      await this.updateCampaignStatus('running', { started_at: this.startedAt });

      // Randomizar ordem se configurado
      if (this.config.randomize_order && this.currentIndex === 0) {
        logger.info('Randomizando ordem dos contatos');
        this.contacts = HumanizationEngine.shuffleContacts(this.contacts);

        // Atualizar processing_order no banco
        await this.updateContactsProcessingOrder();
      }

      // Processar fila
      await this.processQueue();

    } catch (error) {
      logger.error('Erro ao iniciar fila:', error.message);
      this.status = 'failed';
      await this.updateCampaignStatus('failed');
      throw error;
    }
  }

  /**
   * Processa a fila de contatos
   */
  async processQueue() {
    try {
      while (this.currentIndex < this.contacts.length) {
        // Verificar se foi pausado ou cancelado
        if (this.isPaused) {
          logger.info('Fila pausada', {
            campaignId: this.campaignId,
            currentIndex: this.currentIndex
          });
          this.status = 'paused';
          await this.updateCampaignStatus('paused', { paused_at: this.pausedAt });
          return;
        }

        if (this.isCancelled) {
          logger.info('Fila cancelada', {
            campaignId: this.campaignId,
            currentIndex: this.currentIndex
          });
          this.status = 'cancelled';
          this.completedAt = new Date();
          await this.updateCampaignStatus('cancelled', { completed_at: this.completedAt });
          return;
        }

        // Processar contato atual
        const contact = this.contacts[this.currentIndex];
        await this.processContact(contact);

        // Incrementar índice
        this.currentIndex++;

        // Atualizar progresso no banco
        await this.updateProgress();

        // Calcular e aplicar delay (exceto no último contato)
        if (this.currentIndex < this.contacts.length) {
          const delay = HumanizationEngine.calculateDelay(
            this.config.delay_min,
            this.config.delay_max
          );

          logger.debug('Aguardando delay', {
            campaignId: this.campaignId,
            delayMs: delay,
            nextIndex: this.currentIndex
          });

          await this.sleep(delay);
        }
      }

      // Fila concluída
      logger.info('Fila concluída', {
        campaignId: this.campaignId,
        sent: this.sentCount,
        failed: this.failedCount
      });

      this.status = 'completed';
      this.completedAt = new Date();
      this.isProcessing = false;
      await this.updateCampaignStatus('completed', { completed_at: this.completedAt });

    } catch (error) {
      logger.error('Erro ao processar fila:', error.message);
      this.status = 'failed';
      this.isProcessing = false;
      await this.updateCampaignStatus('failed');
      throw error;
    }
  }

  /**
   * Processa um contato individual
   */
  /**
   * Processa um contato individual
   */
  async processContact(contact) {
    // Verificar janela de envio antes de começar
    await this.checkSendingWindow();

    let attempt = 0;
    let lastError = null;

    // Determine messages to send (sequence or single legacy message)
    let messagesToSend = this.config.messages && this.config.messages.length > 0
      ? this.config.messages
      : [{
        type: this.config.message_type,
        content: this.config.message_content,
        mediaUrl: this.config.media_url,
        mediaType: this.config.media_type,
        fileName: this.config.media_file_name
      }];

    // Normalizar mensagens do formato antigo (array de strings) para o novo formato (array de objetos)
    messagesToSend = messagesToSend.map((msg, index) => {
      if (typeof msg === 'string') {
        logger.warn('Mensagem em formato legado detectada, convertendo', {
          campaignId: this.campaignId,
          messageIndex: index
        });
        return {
          id: String(index + 1),
          type: 'text',
          content: msg
        };
      }
      return msg;
    });

    while (attempt < this.maxRetries) {
      try {
        logger.info('Processando contato', {
          campaignId: this.campaignId,
          phone: contact.phone,
          attempt: attempt + 1,
          messageCount: messagesToSend.length
        });

        // Gerar variáveis dinâmicas (data, saudacao)
        const dynamicVars = this.generateDynamicVariables();

        // Mesclar variáveis do contato com variáveis dinâmicas
        const allVariables = {
          ...(contact.variables || {}),
          ...dynamicVars
        };

        // Send sequence of messages
        for (let i = 0; i < messagesToSend.length; i++) {
          const msgConfig = messagesToSend[i];

          // Processar template
          const processed = templateProcessor.process(
            msgConfig.content || '',
            allVariables
          );

          if (!processed.success) {
            throw new Error(`Erro ao processar template da mensagem ${i + 1}: ${processed.errors[0]?.message || 'Erro desconhecido'}`);
          }

          const messageBody = processed.finalMessage;

          // Enviar mensagem via WUZAPI
          // Adaptar chamada para suportar config específica da mensagem
          const result = await this.sendMessageWithConfig(contact.phone, messageBody, msgConfig);

          // Rastrear variações
          if (processed.selections && processed.selections.length > 0) {
            await variationTracker.logVariation({
              campaignId: this.campaignId,
              messageId: result.id || `msg-${Date.now()}-${i}`,
              template: msgConfig.content,
              selections: processed.selections,
              recipient: contact.phone,
              userId: null
            }).catch(err => {
              logger.warn('Erro ao rastrear variação', { error: err.message });
            });
          }

          // Delay entre mensagens da sequência (3-8 segundos)
          if (i < messagesToSend.length - 1) {
            const seqDelay = Math.floor(Math.random() * (8000 - 3000 + 1) + 3000);
            await this.sleep(seqDelay);
          }
        }

        // Marcar como enviado (apenas se todas as mensagens da sequência forem enviadas)
        await this.updateContactStatus(contact.id, 'sent', null, null, new Date());
        this.sentCount++;

        logger.info('Contato processado com sucesso', {
          campaignId: this.campaignId,
          phone: contact.phone
        });

        return; // Sucesso, sair do loop de retry

      } catch (error) {
        lastError = error;
        const errorType = this.categorizeError(error);

        logger.warn('Erro ao processar contato', {
          campaignId: this.campaignId,
          phone: contact.phone,
          attempt: attempt + 1,
          errorType,
          error: error.message
        });

        // Circuit Breaker: Pausar se desconectado
        if (['DISCONNECTED', 'UNAUTHORIZED'].includes(errorType)) {
          logger.error('Instância desconectada ou não autorizada. Pausando campanha automaticamente.', { 
            campaignId: this.campaignId,
            errorType,
            contactPhone: contact.phone
          });
          
          // Registrar evento de desconexão no banco de dados
          await this.persistError({
            contactId: contact.id,
            contactPhone: contact.phone,
            errorType: errorType,
            errorMessage: `Auto-pause: ${error.message}`,
            errorCode: 'AUTO_PAUSE_DISCONNECTION',
            retryCount: attempt
          });
          
          await this.pause();

          // Atualizar status do contato para pendente para tentar depois
          // Não incrementamos failedCount aqui pois a campanha foi pausada
          return;
        }

        // Verificar se deve tentar novamente
        if (this.shouldRetry(errorType, attempt)) {
          const backoff = this.calculateBackoff(errorType, attempt);
          logger.info(`Tentando novamente em ${backoff}ms...`, { campaignId: this.campaignId, phone: contact.phone });
          await this.sleep(backoff);
          attempt++;
        } else {
          // Se não deve tentar (erro permanente ou limite atingido), sair do loop
          break;
        }
      }
    }

    // Todas as tentativas falharam
    const errorType = this.categorizeError(lastError);
    await this.updateContactStatus(
      contact.id,
      'failed',
      errorType,
      lastError.message,
      null
    );
    this.failedCount++;

    logger.error('Contato falhou após todas as tentativas', {
      campaignId: this.campaignId,
      phone: contact.phone,
      errorType,
      error: lastError.message
    });

    // Adicionar à lista de erros recentes
    this.addRecentError({
      phone: contact.phone,
      errorType,
      message: lastError.message,
      contactId: contact.id
    });
  }

  /**
   * Verifica se está dentro da janela de envio
   * Se não estiver, aguarda até o início da próxima janela
   */
  async checkSendingWindow() {
    if (!this.config.sending_window) return;

    const { startTime, endTime, days } = this.config.sending_window;
    if (!startTime || !endTime) return;

    // Loop infinito até estar dentro da janela ou ser cancelado
    while (true) {
      if (this.isCancelled) throw new Error('Campanha cancelada');
      if (this.isPaused) {
        // Se pausado, o loop principal vai tratar, mas aqui precisamos sair
        // para permitir que o status seja atualizado
        return;
      }

      const now = new Date();

      // Ajustar fuso horário (assumindo servidor em UTC ou local, mas janela em horário local do usuário)
      // Idealmente usar biblioteca como luxon ou date-fns-tz, mas aqui faremos básico
      // Vamos assumir que startTime/endTime são strings "HH:mm"

      const currentDay = now.getDay(); // 0 = Domingo, 1 = Segunda, ...
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentTime = currentHour * 60 + currentMinute;

      const [startHour, startMinute] = startTime.split(':').map(Number);
      const windowStart = startHour * 60 + startMinute;

      const [endHour, endMinute] = endTime.split(':').map(Number);
      const windowEnd = endHour * 60 + endMinute;

      // Verificar dia da semana (se days estiver definido)
      // days deve ser array de números [0, 1, 2, ...]
      const isDayAllowed = !days || days.length === 0 || days.includes(currentDay);

      // Verificar horário
      const isTimeAllowed = currentTime >= windowStart && currentTime < windowEnd;

      if (isDayAllowed && isTimeAllowed) {
        return; // Dentro da janela, prosseguir
      }

      logger.info('Fora da janela de envio, aguardando...', {
        campaignId: this.campaignId,
        now: now.toISOString(),
        window: { startTime, endTime, days }
      });

      // Calcular tempo de espera
      // Por simplicidade, esperar 1 minuto e verificar novamente
      // Isso evita complexidade de cálculo de próximo dia/horário exato
      await this.sleep(60000);
    }
  }

  /**
   * Verifica se o identificador é um JID de grupo do WhatsApp
   * @param {string} identifier - Phone ou JID
   * @returns {boolean} true se for um grupo
   */
  isGroupJid(identifier) {
    if (!identifier) return false;
    if (identifier.endsWith('@g.us')) return true;
    if (/^\d{10,15}-\d{10,13}$/.test(identifier)) return true;
    return false;
  }

  /**
   * Envia mensagem com configuração específica (para sequências)
   */
  async sendMessageWithConfig(phone, messageBody, msgConfig) {
    try {
      const { type, mediaUrl, mediaType, fileName } = msgConfig;

      // Detectar se é um grupo
      const isGroup = this.isGroupJid(phone);
      
      let validatedPhone;
      
      if (isGroup) {
        // Para grupos, usar o JID diretamente
        validatedPhone = phone.endsWith('@g.us') ? phone : `${phone}@g.us`;
        
        logger.info('Enviando mensagem para grupo', {
          campaignId: this.campaignId,
          groupJid: validatedPhone
        });
      } else {
        // 1. Normalizar número de telefone
        const normalizedPhone = normalizePhoneNumber(phone);
        
        logger.debug('Telefone normalizado', {
          campaignId: this.campaignId,
          originalPhone: phone,
          normalizedPhone: normalizedPhone
        });

        // 2. Validar com API WUZAPI /user/check
        logger.debug('Validando telefone com API WUZAPI', {
          campaignId: this.campaignId,
          phone: normalizedPhone
        });

        const phoneValidation = await validatePhoneWithAPI(normalizedPhone, this.config.user_token);
        
        if (!phoneValidation.isValid) {
          logger.warn('Número inválido na validação', {
            campaignId: this.campaignId,
            phone: normalizedPhone,
            error: phoneValidation.error
          });
          throw new Error(`Número inválido: ${phoneValidation.error}`);
        }

        // 3. Usar o número validado pela API (campo Query)
        validatedPhone = phoneValidation.validatedPhone;
        
        logger.info('Telefone validado com sucesso', {
          campaignId: this.campaignId,
          originalPhone: phone,
          normalizedPhone: normalizedPhone,
          validatedPhone: validatedPhone,
          jid: phoneValidation.jid
        });
      }

      let endpoint;
      let payload;

      if (type === 'text') {
        endpoint = '/chat/send/text';
        payload = {
          Phone: validatedPhone,
          Body: messageBody
        };
      } else if (type === 'media') {
        if (mediaType === 'image') {
          endpoint = '/chat/send/image';
          payload = {
            Phone: validatedPhone,
            Image: mediaUrl,
            Caption: messageBody
          };
        } else if (mediaType === 'video') {
          endpoint = '/chat/send/video';
          payload = {
            Phone: validatedPhone,
            Video: mediaUrl,
            Caption: messageBody
          };
        } else if (mediaType === 'document') {
          endpoint = '/chat/send/document';
          payload = {
            Phone: validatedPhone,
            Document: mediaUrl,
            FileName: fileName || 'document.pdf',
            Caption: messageBody
          };
        } else {
          throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
        }
      } else {
        throw new Error(`Tipo de mensagem não suportado: ${type}`);
      }

      logger.debug('Enviando mensagem via WUZAPI com número validado', {
        campaignId: this.campaignId,
        endpoint,
        phone: validatedPhone,
        originalPhone: phone,
        messageType: type,
        token: this.config.instance?.substring(0, 10) + '...',
        baseUrl: this.wuzapiBaseUrl
      });

      const response = await axios.post(
        `${this.wuzapiBaseUrl}${endpoint}`,
        payload,
        {
          headers: {
            'token': this.config.instance,
            'Content-Type': 'application/json'
          },
          timeout: this.wuzapiTimeout
        }
      );

      logger.info('Mensagem enviada com sucesso via WUZAPI', {
        campaignId: this.campaignId,
        phone,
        messageType: type,
        responseStatus: response.status,
        responseData: response.data
      });

      return response.data;

    } catch (error) {
      logger.error('Erro ao enviar mensagem via WUZAPI', {
        campaignId: this.campaignId,
        phone,
        endpoint: endpoint || 'unknown',
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        token: this.config.instance?.substring(0, 10) + '...'
      });

      if (error.response) {
        const enhancedError = new Error(
          error.response.data?.message || error.message
        );
        enhancedError.status = error.response.status;
        enhancedError.code = error.code;
        throw enhancedError;
      }
      throw error;
    }
  }





  /**
   * Categoriza o erro para relatórios
   */
  /**
   * Categoriza o erro para relatórios e decisão de retry
   * 
   * Categories:
   * - INVALID_NUMBER: Número inválido ou não existe no WhatsApp (permanente)
   * - BLOCKED_NUMBER: Número bloqueado (permanente)
   * - DISCONNECTED: Instância desconectada (pausar campanha)
   * - UNAUTHORIZED: Token inválido ou expirado (pausar campanha)
   * - RATE_LIMIT: Limite de requisições excedido (retry com backoff longo)
   * - SERVER_BUSY: Servidor ocupado ou erro 5xx (retry com backoff)
   * - TIMEOUT: Timeout na requisição (retry com backoff)
   * - NETWORK_ERROR: Erro de rede/conexão (retry com backoff)
   * - API_ERROR: Erro genérico da API (retry com backoff)
   * - UNKNOWN_ERROR: Erro desconhecido
   * 
   * @param {Error} error - Erro a ser categorizado
   * @returns {string} Categoria do erro
   */
  categorizeError(error) {
    if (!error) return 'UNKNOWN_ERROR';

    const message = (error.message || '').toLowerCase();
    const status = error.response?.status || error.status;
    const code = error.code || '';

    // 1. Erros de Rede (Tentar novamente com backoff)
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ENETUNREACH') {
      return 'NETWORK_ERROR';
    }
    if (message.includes('network') || message.includes('rede') || message.includes('connection refused')) {
      return 'NETWORK_ERROR';
    }

    // 2. Erros de Autenticação (Pausar campanha / Circuit Breaker) - verificar ANTES de erros permanentes
    if (status === 401 || status === 403 || message.includes('unauthorized') || message.includes('não autorizado')) {
      return 'UNAUTHORIZED';
    }
    if (message.includes('token') && (message.includes('invalid') || message.includes('expired') || message.includes('inválido'))) {
      return 'UNAUTHORIZED';
    }

    // 3. Erros de Conexão (Pausar campanha / Circuit Breaker)
    if (status === 404 || message.includes('disconnected') || message.includes('desconectado') || message.includes('sessão fechada')) {
      return 'DISCONNECTED';
    }
    if (message.includes('not connected') || message.includes('não conectado') || message.includes('qr code')) {
      return 'DISCONNECTED';
    }

    // 4. Erros Permanentes (Não tentar novamente)
    if (status === 400 || message.includes('invalid number') || message.includes('número inválido') || message.includes('não existe')) {
      return 'INVALID_NUMBER';
    }
    if (message.includes('not on whatsapp') || message.includes('não está no whatsapp')) {
      return 'INVALID_NUMBER';
    }
    if (message.includes('blocked') || message.includes('bloqueado')) {
      return 'BLOCKED_NUMBER';
    }

    // 5. Erros Transientes (Tentar novamente com backoff)
    if (status === 429 || message.includes('rate limit') || message.includes('muitas requisições') || message.includes('too many')) {
      return 'RATE_LIMIT';
    }
    if (status >= 500 || message.includes('server error') || message.includes('busy') || message.includes('ocupado')) {
      return 'SERVER_BUSY';
    }
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || message.includes('timeout')) {
      return 'TIMEOUT';
    }

    // 6. Erro genérico da API
    return 'API_ERROR';
  }

  /**
   * Decide se deve tentar novamente com base no erro
   * 
   * @param {string} errorType - Tipo do erro (retornado por categorizeError)
   * @param {number} attempt - Número da tentativa atual (0-indexed)
   * @returns {boolean} True se deve tentar novamente
   */
  shouldRetry(errorType, attempt) {
    // Nunca tentar erros permanentes
    if (['INVALID_NUMBER', 'BLOCKED_NUMBER', 'UNKNOWN_ERROR'].includes(errorType)) {
      return false;
    }

    // Erros de conexão devem pausar a campanha, não apenas retry
    if (['DISCONNECTED', 'UNAUTHORIZED'].includes(errorType)) {
      return false; // O loop principal vai tratar isso pausando
    }

    // Limite máximo de tentativas para erros transientes
    if (attempt >= this.maxRetries) {
      return false;
    }

    // Erros transientes que podem ser retentados
    // RATE_LIMIT, SERVER_BUSY, TIMEOUT, NETWORK_ERROR, API_ERROR
    return true;
  }

  /**
   * Calcula o tempo de espera para a próxima tentativa (Exponential Backoff)
   * 
   * @param {string} errorType - Tipo do erro
   * @param {number} attempt - Número da tentativa atual (0-indexed)
   * @returns {number} Tempo de espera em milissegundos
   */
  calculateBackoff(errorType, attempt) {
    const baseDelay = 2000; // 2 segundos

    // Backoff exponencial: 2s, 4s, 8s, 16s...
    let delay = baseDelay * Math.pow(2, attempt);

    // Ajustes específicos por tipo de erro
    switch (errorType) {
      case 'RATE_LIMIT':
        delay = Math.max(delay, 60000); // Mínimo 1 minuto para rate limit
        break;
      case 'SERVER_BUSY':
        delay = Math.max(delay, 10000); // Mínimo 10s para servidor ocupado
        break;
      case 'NETWORK_ERROR':
        delay = Math.max(delay, 5000); // Mínimo 5s para erro de rede
        break;
      case 'TIMEOUT':
        delay = Math.max(delay, 3000); // Mínimo 3s para timeout
        break;
      // API_ERROR usa o backoff padrão
    }

    // Adicionar "jitter" (variação aleatória) para evitar thundering herd
    const jitter = Math.random() * 1000;

    return Math.min(delay + jitter, 300000); // Teto máximo de 5 minutos
  }

  /**
   * Pausa o processamento da fila
   */
  async pause() {
    if (this.status !== 'running') {
      throw new Error('Fila não está em execução');
    }

    logger.info('Pausando fila', { campaignId: this.campaignId });
    this.isPaused = true;
    this.pausedAt = new Date();
  }

  /**
   * Retoma o processamento da fila
   */
  async resume() {
    if (this.status !== 'paused') {
      throw new Error('Fila não está pausada');
    }

    logger.info('Retomando fila', {
      campaignId: this.campaignId,
      currentIndex: this.currentIndex
    });

    this.isPaused = false;
    this.pausedAt = null;
    this.status = 'running';
    await this.updateCampaignStatus('running');

    // Continuar processamento
    await this.processQueue();
  }

  /**
   * Restaura o estado de uma campanha pausada
   * @param {Object} campaign - Dados da campanha do banco
   */
  async restoreState(campaign) {
    logger.info('Restaurando estado da campanha', {
      campaignId: this.campaignId,
      currentIndex: campaign.current_index,
      sentCount: campaign.sent_count,
      failedCount: campaign.failed_count,
      totalContacts: campaign.total_contacts,
      contactsLoaded: this.contacts.length
    });

    // Restaurar contadores
    this.currentIndex = campaign.current_index || 0;
    this.sentCount = campaign.sent_count || 0;
    this.failedCount = campaign.failed_count || 0;

    // Restaurar timestamps
    this.startedAt = campaign.started_at ? new Date(campaign.started_at) : null;
    this.pausedAt = campaign.paused_at ? new Date(campaign.paused_at) : null;

    // Restaurar status como pausado
    this.status = 'paused';
    this.isPaused = true;

    // Validar que há contatos para processar
    if (this.currentIndex >= this.contacts.length) {
      const errorMsg = `Campanha já foi concluída. Index: ${this.currentIndex}, Total: ${this.contacts.length}`;
      logger.error(errorMsg, { campaignId: this.campaignId });
      throw new Error('Campanha já foi concluída. Não há mais contatos para processar');
    }

    const remainingContacts = this.contacts.length - this.currentIndex;
    logger.info('Estado restaurado com sucesso', {
      campaignId: this.campaignId,
      contactsRemaining: remainingContacts,
      nextContactIndex: this.currentIndex,
      nextContactPhone: this.contacts[this.currentIndex]?.phone
    });
  }

  /**
   * Cancela o processamento da fila
   */
  async cancel() {
    if (this.status === 'completed' || this.status === 'cancelled') {
      throw new Error('Fila já foi finalizada');
    }

    logger.info('Cancelando fila', { campaignId: this.campaignId });
    this.isCancelled = true;
  }

  /**
   * Retorna o progresso atual
   */
  getProgress() {
    const total = this.contacts.length;
    const pending = total - this.currentIndex;
    const successRate = total > 0 ? (this.sentCount / total) * 100 : 0;

    // Calcular tempo estimado restante
    const avgDelay = (this.config.delay_min + this.config.delay_max) / 2;
    const estimatedTime = HumanizationEngine.estimateRemainingTime(pending, avgDelay);

    return {
      campaignId: this.campaignId,
      status: this.status,
      stats: {
        total,
        sent: this.sentCount,
        pending,
        failed: this.failedCount,
        successRate: Math.round(successRate * 100) / 100
      },
      currentIndex: this.currentIndex,
      currentContact: this.contacts[this.currentIndex] || null,
      estimatedTimeRemaining: estimatedTime,
      startedAt: this.startedAt,
      pausedAt: this.pausedAt,
      completedAt: this.completedAt
    };
  }

  /**
   * Retorna progresso aprimorado com métricas adicionais
   * Inclui tempo estimado legível, velocidade média e erros recentes
   */
  getEnhancedProgress() {
    const basicProgress = this.getProgress();
    const total = this.contacts.length;
    const processed = this.sentCount + this.failedCount;

    // Calcular tempo decorrido
    let elapsedMs = 0;
    if (this.processingStartTime) {
      elapsedMs = Date.now() - this.processingStartTime;
    } else if (this.startedAt) {
      elapsedMs = Date.now() - new Date(this.startedAt).getTime();
    }

    // Calcular velocidade média (mensagens por minuto)
    const elapsedMinutes = elapsedMs / 60000;
    const averageSpeed = elapsedMinutes > 0 ? Math.round((processed / elapsedMinutes) * 100) / 100 : 0;

    // Calcular tempo estimado restante em formato legível
    const pending = total - this.currentIndex;
    const estimatedTimeRemaining = this.formatTimeRemaining(pending, averageSpeed);

    return {
      ...basicProgress,
      enhanced: {
        estimatedTimeRemaining,
        averageSpeed, // mensagens por minuto
        elapsedTime: this.formatElapsedTime(elapsedMs),
        elapsedMs,
        processedCount: processed,
        recentErrors: this.recentErrors.slice(-this.maxRecentErrors),
        batchInfo: {
          useBatching: total > this.batchThreshold,
          batchSize: this.batchSize,
          currentBatch: Math.floor(this.currentIndex / this.batchSize) + 1,
          totalBatches: Math.ceil(total / this.batchSize)
        }
      }
    };
  }

  /**
   * Formata tempo restante em formato legível
   * @param {number} pending - Contatos pendentes
   * @param {number} speed - Velocidade em mensagens/minuto
   * @returns {string} Tempo formatado (ex: "2h 30min restantes")
   */
  formatTimeRemaining(pending, speed) {
    if (speed <= 0 || pending <= 0) {
      return 'Calculando...';
    }

    const minutesRemaining = pending / speed;
    
    if (minutesRemaining < 1) {
      return 'Menos de 1min restante';
    } else if (minutesRemaining < 60) {
      return `${Math.ceil(minutesRemaining)}min restantes`;
    } else {
      const hours = Math.floor(minutesRemaining / 60);
      const mins = Math.ceil(minutesRemaining % 60);
      if (mins === 0) {
        return `${hours}h restantes`;
      }
      return `${hours}h ${mins}min restantes`;
    }
  }

  /**
   * Formata tempo decorrido em formato legível
   * @param {number} ms - Milissegundos decorridos
   * @returns {string} Tempo formatado
   */
  formatElapsedTime(ms) {
    if (ms < 60000) {
      return `${Math.floor(ms / 1000)}s`;
    } else if (ms < 3600000) {
      const mins = Math.floor(ms / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${mins}min ${secs}s`;
    } else {
      const hours = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      return `${hours}h ${mins}min`;
    }
  }

  /**
   * Adiciona erro à lista de erros recentes e persiste no banco
   * @param {Object} error - Informações do erro
   */
  addRecentError(error) {
    const errorEntry = {
      ...error,
      timestamp: new Date().toISOString()
    };

    this.recentErrors.push(errorEntry);
    
    // Manter apenas os últimos N erros
    if (this.recentErrors.length > this.maxRecentErrors) {
      this.recentErrors.shift();
    }

    // Persistir erro no banco de dados
    this.persistError(errorEntry).catch(err => {
      logger.warn('Failed to persist error to database', { error: err.message });
    });
  }

  /**
   * Persiste erro no banco de dados campaign_error_logs
   * Note: campaign_error_logs table may not exist in Supabase - this is a no-op if table doesn't exist
   * @param {Object} error - Informações do erro
   */
  async persistError(error) {
    try {
      const id = uuidv4();
      const SupabaseService = require('./SupabaseService');

      const { error: dbError } = await SupabaseService.adminClient
        .from('campaign_error_logs')
        .insert({
          id,
          campaign_id: this.campaignId,
          contact_id: error.contactId || null,
          contact_phone: error.phone || null,
          error_type: error.errorType || 'UNKNOWN',
          error_message: error.message || null,
          error_code: error.code || null,
          retry_count: error.retryCount || 0
        });

      if (dbError) {
        // Table doesn't exist - log and skip
        if (dbError.code === '42P01' || dbError.message?.includes('does not exist')) {
          logger.debug('campaign_error_logs table does not exist, skipping error persistence');
          return;
        }
        throw dbError;
      }

      logger.debug('Error persisted to database', {
        campaignId: this.campaignId,
        errorId: id,
        errorType: error.errorType
      });

    } catch (dbError) {
      logger.error('Failed to persist error to campaign_error_logs', {
        campaignId: this.campaignId,
        error: dbError.message
      });
    }
  }

  /**
   * Retorna os erros recentes
   * @param {number} limit - Número máximo de erros a retornar
   * @returns {Array} Lista de erros recentes
   */
  getRecentErrors(limit = 5) {
    return this.recentErrors.slice(-Math.min(limit, this.maxRecentErrors));
  }

  /**
   * Carrega contatos do banco de dados
   * @param {boolean} filterPending - Se true, carrega apenas contatos com status 'pending'
   */
  async loadContacts(filterPending = false) {
    try {
      const SupabaseService = require('./SupabaseService');
      
      let query = SupabaseService.adminClient
        .from('campaign_contacts')
        .select('*')
        .eq('campaign_id', this.campaignId)
        .order('processing_order', { ascending: true });

      if (filterPending) {
        query = query.eq('status', 'pending');
      }

      const { data: rows, error } = await query;

      if (error) throw error;

      this.contacts = (rows || []).map(row => {
        // Parse variáveis existentes
        let variables = row.variables ? (typeof row.variables === 'string' ? JSON.parse(row.variables) : row.variables) : {};
        
        // Adicionar nome às variáveis automaticamente se não existir
        if (row.name && !variables.nome) {
          variables.nome = row.name;
        }
        
        // Adicionar telefone às variáveis se não existir
        if (row.phone && !variables.telefone) {
          variables.telefone = row.phone;
        }
        
        return {
          id: row.id,
          phone: row.phone,
          name: row.name,
          variables,
          status: row.status,
          processingOrder: row.processing_order
        };
      });

      logger.info('Contatos carregados', {
        campaignId: this.campaignId,
        totalCount: this.contacts.length,
        filterPending,
        currentIndex: this.currentIndex,
        remainingCount: this.contacts.length - this.currentIndex,
        note: 'Cada número será normalizado e validado durante o envio'
      });

      if (this.contacts.length === 0) {
        logger.warn('Nenhum contato encontrado', {
          campaignId: this.campaignId,
          filterPending
        });
      }

    } catch (error) {
      logger.error('Erro ao carregar contatos:', error.message);
      throw error;
    }
  }

  /**
   * Atualiza status da campanha no banco
   */
  async updateCampaignStatus(status, additionalFields = {}) {
    try {
      const SupabaseService = require('./SupabaseService');
      
      const fields = {
        status,
        sent_count: this.sentCount,
        failed_count: this.failedCount,
        current_index: this.currentIndex,
        updated_at: new Date().toISOString(),
        ...additionalFields
      };

      // Convert Date objects to ISO strings for Supabase
      Object.keys(fields).forEach(key => {
        if (fields[key] instanceof Date) {
          fields[key] = fields[key].toISOString();
        }
      });

      const { error } = await SupabaseService.adminClient
        .from('bulk_campaigns')
        .update(fields)
        .eq('id', this.campaignId);

      if (error) throw error;

    } catch (error) {
      logger.error('Erro ao atualizar status da campanha:', error.message);
    }
  }

  /**
   * Atualiza progresso no banco
   */
  async updateProgress() {
    await this.updateCampaignStatus(this.status);
  }

  /**
   * Atualiza status de um contato
   */
  async updateContactStatus(contactId, status, errorType, errorMessage, sentAt) {
    try {
      const SupabaseService = require('./SupabaseService');
      
      const { error } = await SupabaseService.adminClient
        .from('campaign_contacts')
        .update({
          status,
          error_type: errorType,
          error_message: errorMessage,
          sent_at: sentAt ? sentAt.toISOString() : null
        })
        .eq('id', contactId);

      if (error) throw error;

    } catch (error) {
      logger.error('Erro ao atualizar status do contato:', error.message);
    }
  }

  /**
   * Atualiza processing_order dos contatos após randomização
   */
  async updateContactsProcessingOrder() {
    try {
      const SupabaseService = require('./SupabaseService');
      
      // Update each contact's processing_order
      for (let i = 0; i < this.contacts.length; i++) {
        const { error } = await SupabaseService.adminClient
          .from('campaign_contacts')
          .update({ processing_order: i })
          .eq('id', this.contacts[i].id);

        if (error) throw error;
      }
    } catch (error) {
      logger.error('Erro ao atualizar processing_order:', error.message);
    }
  }

  /**
   * Aguarda um período de tempo
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Atualiza configuração em tempo real
   * @param {Object} updates - Campos a atualizar
   */
  updateConfig(updates) {
    logger.info('Atualizando configuração da fila em tempo real', {
      campaignId: this.campaignId,
      updates: Object.keys(updates)
    });

    if (updates.delay_min !== undefined) {
      this.config.delay_min = updates.delay_min;
      logger.debug('delay_min atualizado', {
        campaignId: this.campaignId,
        newValue: updates.delay_min
      });
    }

    if (updates.delay_max !== undefined) {
      this.config.delay_max = updates.delay_max;
      logger.debug('delay_max atualizado', {
        campaignId: this.campaignId,
        newValue: updates.delay_max
      });
    }

    if (updates.sending_window !== undefined) {
      this.config.sending_window = updates.sending_window;
      logger.debug('sending_window atualizado', {
        campaignId: this.campaignId,
        newValue: updates.sending_window
      });
    }

    logger.info('Configuração da campanha atualizada em tempo real', {
      campaignId: this.campaignId,
      updatedFields: Object.keys(updates)
    });
  }

  /**
   * Static helper to check if a given time is within the sending window.
   * This is a pure function that can be tested in isolation.
   * 
   * @param {Object} sendingWindow - The sending window configuration
   * @param {string} sendingWindow.startTime - Start time in HH:mm format
   * @param {string} sendingWindow.endTime - End time in HH:mm format
   * @param {number[]} [sendingWindow.days] - Allowed days (0=Sunday, 6=Saturday)
   * @param {Date} currentTime - The time to check
   * @returns {boolean} True if within the sending window
   */
  static isWithinSendingWindow(sendingWindow, currentTime) {
    if (!sendingWindow) return true;

    const { startTime, endTime, days } = sendingWindow;
    if (!startTime || !endTime) return true;

    const currentDay = currentTime.getDay(); // 0 = Sunday, 6 = Saturday
    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const windowStart = startHour * 60 + startMinute;

    const [endHour, endMinute] = endTime.split(':').map(Number);
    const windowEnd = endHour * 60 + endMinute;

    // Check day of week (if days is defined)
    const isDayAllowed = !days || days.length === 0 || days.includes(currentDay);

    // Check time
    const isTimeAllowed = currentTimeMinutes >= windowStart && currentTimeMinutes < windowEnd;

    return isDayAllowed && isTimeAllowed;
  }
}

module.exports = QueueManager;
