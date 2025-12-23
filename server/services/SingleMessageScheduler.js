/**
 * SingleMessageScheduler Service
 * 
 * Processa mensagens únicas agendadas do banco de dados:
 * - Verificação a cada 30 segundos
 * - Validação de conexão WUZAPI antes de enviar
 * - Registro no histórico após envio
 */

const { logger } = require('../utils/logger');
const axios = require('axios');
const { validatePhoneWithAPI } = require('./PhoneValidationService');
const SupabaseService = require('./SupabaseService');

class SingleMessageScheduler {
  /**
   * @param {Object} db - Instância do banco de dados (deprecated, kept for backwards compatibility)
   */
  constructor(db = null) {
    // db parameter kept for backwards compatibility but not used
    this.checkInterval = 30000; // 30 segundos
    this.intervalId = null;
    this.isRunning = false;
    this.wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    logger.info('SingleMessageScheduler criado', {
      checkInterval: this.checkInterval,
      wuzapiBaseUrl: this.wuzapiBaseUrl
    });
  }

  /**
   * Inicia o scheduler
   */
  start() {
    if (this.isRunning) {
      logger.warn('SingleMessageScheduler já está em execução');
      return;
    }

    logger.info('Iniciando SingleMessageScheduler');
    this.isRunning = true;

    // Executar verificação imediatamente
    this.checkScheduledMessages();

    // Configurar verificação periódica
    this.intervalId = setInterval(() => {
      this.checkScheduledMessages();
    }, this.checkInterval);
  }

  /**
   * Para o scheduler
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('SingleMessageScheduler não está em execução');
      return;
    }

    logger.info('Parando SingleMessageScheduler');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Verifica mensagens agendadas que devem ser enviadas
   */
  async checkScheduledMessages() {
    try {
      logger.debug('Verificando mensagens agendadas');

      // Buscar mensagens agendadas para agora ou antes
      const now = new Date().toISOString();
      
      const { data: rows, error } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) =>
        query.select('*')
          .eq('status', 'pending')
          .lte('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(50)
      );

      if (error) {
        logger.error('Erro ao buscar mensagens agendadas:', error.message);
        return;
      }

      if (!rows || rows.length === 0) {
        logger.debug('Nenhuma mensagem agendada para enviar');
        return;
      }

      logger.info('Mensagens agendadas encontradas', {
        count: rows.length
      });

      // Processar cada mensagem
      for (const message of rows) {
        await this.sendScheduledMessage(message);
      }

    } catch (error) {
      logger.error('Erro ao verificar mensagens agendadas:', error.message);
    }
  }

  /**
   * Envia uma mensagem agendada
   */
  async sendScheduledMessage(message) {
    try {
      logger.info('Enviando mensagem agendada', {
        messageId: message.id,
        recipient: message.recipient,
        messageType: message.message_type
      });

      // Validar conexão WUZAPI
      const isConnected = await this.validateWuzapiConnection(
        message.instance,
        message.user_token
      );

      if (!isConnected) {
        logger.error('Conexão WUZAPI inválida, marcando mensagem como falha', {
          messageId: message.id,
          instance: message.instance
        });

        await this.failMessage(
          message.id,
          'Conexão WUZAPI não disponível no momento do agendamento'
        );
        return;
      }

      // Detectar se é um grupo (JID termina com @g.us ou formato telefone-timestamp)
      const isGroup = message.recipient.endsWith('@g.us') || 
                      /^\d{10,15}-\d{10,13}$/.test(message.recipient);
      
      let validatedPhone;
      
      if (isGroup) {
        // Para grupos, usar o JID diretamente
        validatedPhone = message.recipient.endsWith('@g.us') 
          ? message.recipient 
          : `${message.recipient}@g.us`;
        
        logger.info('Enviando mensagem agendada para grupo', {
          messageId: message.id,
          groupJid: validatedPhone
        });
      } else {
        // Validar número de telefone usando API WUZAPI /user/check
        logger.debug('Validando telefone para mensagem agendada', {
          messageId: message.id,
          recipient: message.recipient
        });

        const phoneValidation = await validatePhoneWithAPI(
          message.recipient,
          message.user_token
        );

        if (!phoneValidation.isValid) {
          logger.error('Número de telefone inválido para mensagem agendada', {
            messageId: message.id,
            recipient: message.recipient,
            error: phoneValidation.error
          });

          await this.failMessage(
            message.id,
            `Número de telefone inválido: ${phoneValidation.error}`
          );
          return;
        }

        // Usar o número validado pela API
        validatedPhone = phoneValidation.validatedPhone;

        logger.debug('Telefone validado para mensagem agendada', {
          messageId: message.id,
          original: message.recipient,
          validated: validatedPhone,
          jid: phoneValidation.jid
        });
      }

      // Enviar mensagem via WUZAPI
      let response;
      
      if (message.message_type === 'text') {
        response = await axios.post(
          `${this.wuzapiBaseUrl}/chat/send/text`,
          {
            Phone: validatedPhone,
            Body: message.message_content
          },
          {
            headers: {
              'token': message.instance,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );
      } else if (message.message_type === 'media') {
        const mediaData = JSON.parse(message.media_data || '{}');
        
        response = await axios.post(
          `${this.wuzapiBaseUrl}/chat/send/image`,
          {
            Phone: validatedPhone,
            Image: mediaData.url,
            Caption: message.message_content
          },
          {
            headers: {
              'token': message.instance,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );
      }

      // Marcar como enviada
      await this.markAsSent(message.id);

      // Registrar no histórico com formato padronizado
      const wuzapiResponse = {
        success: true,
        data: response.data,
        status: response.status
      };
      
      // Log sent message to sent_messages table
      await SupabaseService.insert('sent_messages', {
        user_token: message.user_token,
        recipient: message.recipient,
        message_content: message.message_content,
        message_type: message.message_type,
        wuzapi_response: wuzapiResponse,
        sent_at: new Date().toISOString()
      });

      logger.info('Mensagem agendada enviada com sucesso', {
        messageId: message.id,
        recipient: message.recipient
      });

    } catch (error) {
      logger.error('Erro ao enviar mensagem agendada:', {
        messageId: message.id,
        error: error.message
      });

      await this.failMessage(message.id, error.message);
    }
  }

  /**
   * Valida conexão com WUZAPI
   */
  async validateWuzapiConnection(instance, userToken) {
    try {
      logger.debug('Validando conexão WUZAPI', { instance });

      const response = await axios.get(
        `${this.wuzapiBaseUrl}/session/status`,
        {
          headers: {
            'token': instance
          },
          timeout: 10000
        }
      );

      const isConnected = response.data?.data?.connected === true ||
                         response.data?.data?.loggedIn === true;

      logger.debug('Status da conexão WUZAPI', {
        instance,
        connected: isConnected
      });

      return isConnected;

    } catch (error) {
      logger.error('Erro ao validar conexão WUZAPI:', {
        instance,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Marca mensagem como enviada
   */
  async markAsSent(messageId) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) =>
        query.update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', messageId)
      );

      if (error) {
        logger.error('Erro ao marcar mensagem como enviada:', error.message);
        return;
      }

      logger.info('Mensagem marcada como enviada', { messageId });

    } catch (error) {
      logger.error('Erro ao marcar mensagem como enviada:', error.message);
    }
  }

  /**
   * Marca mensagem como falha
   */
  async failMessage(messageId, errorMessage) {
    try {
      const { error } = await SupabaseService.queryAsAdmin('scheduled_single_messages', (query) =>
        query.update({
          status: 'failed',
          error_message: errorMessage,
          updated_at: new Date().toISOString()
        }).eq('id', messageId)
      );

      if (error) {
        logger.error('Erro ao marcar mensagem como falha:', error.message);
        return;
      }

      logger.info('Mensagem marcada como falha', {
        messageId,
        errorMessage
      });

    } catch (error) {
      logger.error('Erro ao marcar mensagem como falha:', error.message);
    }
  }

  /**
   * Retorna estatísticas do scheduler
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval
    };
  }
}

module.exports = SingleMessageScheduler;
