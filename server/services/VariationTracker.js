/**
 * VariationTracker Service
 * 
 * Serviço responsável por:
 * - Registrar variações enviadas no banco de dados
 * - Calcular estatísticas de distribuição
 * - Gerar relatórios de uso
 * - Exportar dados em JSON/CSV
 * 
 * Requisitos: 3.3, 7.1, 7.2, 7.3, 7.4, 7.5
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class VariationTracker {
  constructor() {
    // No db parameter needed - uses SupabaseService directly
  }

  /**
   * Inicializa o tracker (mantido para compatibilidade)
   */
  initialize() {
    logger.info('VariationTracker inicializado');
  }

  /**
   * Registra uma variação enviada
   * 
   * @param {Object} data - Dados da variação
   * @returns {Promise<Object>} Resultado do registro
   */
  async logVariation(data) {
    const startTime = Date.now();
    
    try {
      // Validar dados obrigatórios
      this._validateLogData(data);

      const {
        campaignId = null,
        messageId = null,
        template,
        selections,
        recipient = null,
        userId = null
      } = data;

      // Converter selections para JSON string
      const selectionsJson = JSON.stringify(selections);

      // Inserir no banco
      const { data: result, error } = await SupabaseService.queryAsAdmin('message_variations', (query) =>
        query.insert({
          campaign_id: campaignId,
          message_id: messageId,
          template,
          selected_variations: selectionsJson,
          recipient,
          user_id: userId,
          sent_at: new Date().toISOString()
        }).select('id').single()
      );

      if (error) throw error;

      const duration = Date.now() - startTime;

      logger.info('Variação registrada', {
        id: result?.id,
        campaignId,
        recipient,
        duration
      });

      return {
        success: true,
        id: result?.id,
        duration
      };

    } catch (error) {
      logger.error('Erro ao registrar variação', { error: error.message });
      throw error;
    }
  }

  /**
   * Registra múltiplas variações em lote (bulk)
   * 
   * @param {Array} variations - Array de variações
   * @returns {Promise<Object>} Resultado do registro
   */
  async logVariationsBulk(variations) {
    const startTime = Date.now();
    
    try {
      if (!Array.isArray(variations) || variations.length === 0) {
        throw new Error('Variations deve ser um array não vazio');
      }

      // Preparar valores para inserção em lote
      const records = variations.map(v => ({
        campaign_id: v.campaignId || null,
        message_id: v.messageId || null,
        template: v.template,
        selected_variations: JSON.stringify(v.selections),
        recipient: v.recipient || null,
        user_id: v.userId || null,
        sent_at: new Date().toISOString()
      }));

      // Inserir em lote
      const { error } = await SupabaseService.queryAsAdmin('message_variations', (query) =>
        query.insert(records)
      );

      if (error) throw error;

      const duration = Date.now() - startTime;

      logger.info('Variações registradas em lote', {
        count: records.length,
        duration
      });

      return {
        success: true,
        count: records.length,
        duration
      };

    } catch (error) {
      logger.error('Erro ao registrar variações em lote', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtém estatísticas de variações para uma campanha
   * 
   * @param {string} campaignId - ID da campanha
   * @returns {Promise<Object>} Estatísticas
   */
  async getStats(campaignId) {
    const startTime = Date.now();
    
    try {
      if (!campaignId) {
        throw new Error('campaignId é obrigatório');
      }

      // Buscar todas as variações da campanha
      const { data: variations, error } = await SupabaseService.queryAsAdmin('message_variations', (query) =>
        query.select('id, template, selected_variations, recipient, sent_at, delivered, read')
          .eq('campaign_id', campaignId)
          .order('sent_at', { ascending: false })
      );

      if (error) throw error;

      if (!variations || variations.length === 0) {
        return {
          campaignId,
          totalMessages: 0,
          blocks: [],
          deliveryStats: {
            sent: 0,
            delivered: 0,
            read: 0
          }
        };
      }

      // Calcular estatísticas de distribuição
      const distributionStats = this._calculateDistribution(variations);

      // Calcular estatísticas de entrega
      const deliveryStats = this._calculateDeliveryStats(variations);

      const duration = Date.now() - startTime;

      logger.info('Estatísticas calculadas', {
        campaignId,
        totalMessages: variations.length,
        duration
      });

      return {
        campaignId,
        totalMessages: variations.length,
        blocks: distributionStats,
        deliveryStats,
        metadata: {
          calculationTime: duration,
          firstSent: variations[variations.length - 1]?.sent_at,
          lastSent: variations[0]?.sent_at
        }
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas', { error: error.message });
      throw error;
    }
  }

  /**
   * Obtém estatísticas para um usuário específico
   * 
   * @param {number} userId - ID do usuário
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Estatísticas
   */
  async getUserStats(userId, options = {}) {
    try {
      const { startDate = null, endDate = null, limit = 100 } = options;

      let query = SupabaseService.adminClient
        .from('message_variations')
        .select('campaign_id')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('sent_at', startDate);
      }

      if (endDate) {
        query = query.lte('sent_at', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Agrupar por campaign_id manualmente
      const campaignStats = {};
      (data || []).forEach(row => {
        if (!campaignStats[row.campaign_id]) {
          campaignStats[row.campaign_id] = { count: 0 };
        }
        campaignStats[row.campaign_id].count++;
      });

      const campaigns = Object.entries(campaignStats)
        .map(([campaign_id, stats]) => ({
          campaign_id,
          count: stats.count
        }))
        .slice(0, limit);

      return {
        userId,
        campaigns,
        totalCampaigns: campaigns.length
      };

    } catch (error) {
      logger.error('Erro ao obter estatísticas do usuário', { error: error.message });
      throw error;
    }
  }

  /**
   * Exporta dados de variações
   * 
   * @param {string} campaignId - ID da campanha
   * @param {string} format - Formato (json ou csv)
   * @returns {Promise<string>} Dados exportados
   */
  async exportData(campaignId, format = 'json') {
    try {
      if (!['json', 'csv'].includes(format)) {
        throw new Error('Formato deve ser json ou csv');
      }

      // Buscar dados
      const { data, error } = await SupabaseService.queryAsAdmin('message_variations', (query) =>
        query.select('id, campaign_id, message_id, template, selected_variations, recipient, sent_at, delivered, read')
          .eq('campaign_id', campaignId)
          .order('sent_at', { ascending: true })
      );

      if (error) throw error;

      if (format === 'json') {
        return this._exportAsJson(data || []);
      } else {
        return this._exportAsCsv(data || []);
      }

    } catch (error) {
      logger.error('Erro ao exportar dados', { error: error.message });
      throw error;
    }
  }

  /**
   * Atualiza status de entrega de uma variação
   * 
   * @param {number} variationId - ID da variação
   * @param {Object} status - Status de entrega
   * @returns {Promise<Object>} Resultado
   */
  async updateDeliveryStatus(variationId, status) {
    try {
      const { delivered = null, read = null } = status;

      const updateData = {};

      if (delivered !== null) {
        updateData.delivered = delivered ? true : false;
      }

      if (read !== null) {
        updateData.read = read ? true : false;
      }

      if (Object.keys(updateData).length === 0) {
        throw new Error('Nenhum status fornecido');
      }

      const { error } = await SupabaseService.queryAsAdmin('message_variations', (query) =>
        query.update(updateData).eq('id', variationId)
      );

      if (error) throw error;

      logger.info('Status de entrega atualizado', { variationId, status });

      return { success: true };

    } catch (error) {
      logger.error('Erro ao atualizar status', { error: error.message });
      throw error;
    }
  }

  /**
   * Valida dados de log
   * 
   * @private
   * @param {Object} data - Dados a validar
   */
  _validateLogData(data) {
    if (!data.template) {
      throw new Error('template é obrigatório');
    }

    if (!data.selections || !Array.isArray(data.selections)) {
      throw new Error('selections deve ser um array');
    }
  }

  /**
   * Calcula distribuição de variações
   * 
   * @private
   * @param {Array} variations - Variações
   * @returns {Array} Estatísticas por bloco
   */
  _calculateDistribution(variations) {
    const blockStats = {};

    // Processar cada variação
    variations.forEach(variation => {
      try {
        const selections = JSON.parse(variation.selected_variations);
        
        selections.forEach(selection => {
          const blockIndex = selection.blockIndex;
          const selected = selection.selected;

          if (!blockStats[blockIndex]) {
            blockStats[blockIndex] = {
              blockIndex,
              variations: {},
              total: 0
            };
          }

          if (!blockStats[blockIndex].variations[selected]) {
            blockStats[blockIndex].variations[selected] = 0;
          }

          blockStats[blockIndex].variations[selected]++;
          blockStats[blockIndex].total++;
        });
      } catch (error) {
        logger.warn('Erro ao processar variação', { id: variation.id, error: error.message });
      }
    });

    // Converter para array e calcular percentuais
    return Object.values(blockStats).map(block => {
      const variationsArray = Object.entries(block.variations).map(([text, count]) => ({
        text,
        count,
        percentage: ((count / block.total) * 100).toFixed(2)
      }));

      // Ordenar por contagem (maior primeiro)
      variationsArray.sort((a, b) => b.count - a.count);

      return {
        blockIndex: block.blockIndex,
        total: block.total,
        variations: variationsArray
      };
    });
  }

  /**
   * Calcula estatísticas de entrega
   * 
   * @private
   * @param {Array} variations - Variações
   * @returns {Object} Estatísticas de entrega
   */
  _calculateDeliveryStats(variations) {
    const stats = {
      sent: variations.length,
      delivered: 0,
      read: 0,
      deliveryRate: 0,
      readRate: 0
    };

    variations.forEach(v => {
      if (v.delivered) stats.delivered++;
      if (v.read) stats.read++;
    });

    stats.deliveryRate = stats.sent > 0 
      ? ((stats.delivered / stats.sent) * 100).toFixed(2)
      : 0;

    stats.readRate = stats.delivered > 0
      ? ((stats.read / stats.delivered) * 100).toFixed(2)
      : 0;

    return stats;
  }

  /**
   * Exporta dados como JSON
   * 
   * @private
   * @param {Array} data - Dados
   * @returns {string} JSON string
   */
  _exportAsJson(data) {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Exporta dados como CSV
   * 
   * @private
   * @param {Array} data - Dados
   * @returns {string} CSV string
   */
  _exportAsCsv(data) {
    if (data.length === 0) {
      return '';
    }

    // Cabeçalho
    const headers = [
      'id', 'campaign_id', 'message_id', 'template',
      'selected_variations', 'recipient', 'sent_at',
      'delivered', 'read'
    ];

    let csv = headers.join(',') + '\n';

    // Linhas
    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header];
        
        // Escapar valores com vírgula ou aspas
        if (value && typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value !== null && value !== undefined ? value : '';
      });
      
      csv += values.join(',') + '\n';
    });

    return csv;
  }
}

// Exportar instância singleton
module.exports = new VariationTracker();

// Exportar classe para testes
module.exports.VariationTracker = VariationTracker;
