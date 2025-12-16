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

class VariationTracker {
  constructor(database = null) {
    // Injeção de dependência para facilitar testes
    this.db = database;
  }

  /**
   * Inicializa o tracker com instância do banco
   * 
   * @param {Object} database - Instância do database
   */
  initialize(database) {
    this.db = database;
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

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
      const sql = `
        INSERT INTO message_variations (
          campaign_id, message_id, template, selected_variations,
          recipient, user_id, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const result = await this.db.query(sql, [
        campaignId,
        messageId,
        template,
        selectionsJson,
        recipient,
        userId
      ]);

      const duration = Date.now() - startTime;

      logger.info('Variação registrada', {
        id: result.lastID,
        campaignId,
        recipient,
        duration
      });

      return {
        success: true,
        id: result.lastID,
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

      if (!Array.isArray(variations) || variations.length === 0) {
        throw new Error('Variations deve ser um array não vazio');
      }

      // Preparar valores para inserção em lote
      const values = variations.map(v => [
        v.campaignId || null,
        v.messageId || null,
        v.template,
        JSON.stringify(v.selections),
        v.recipient || null,
        v.userId || null
      ]);

      // Inserir em lote usando transação
      let insertedCount = 0;
      
      for (const value of values) {
        const sql = `
          INSERT INTO message_variations (
            campaign_id, message_id, template, selected_variations,
            recipient, user_id, sent_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        await this.db.query(sql, value);
        insertedCount++;
      }

      const duration = Date.now() - startTime;

      logger.info('Variações registradas em lote', {
        count: insertedCount,
        duration
      });

      return {
        success: true,
        count: insertedCount,
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

      if (!campaignId) {
        throw new Error('campaignId é obrigatório');
      }

      // Buscar todas as variações da campanha
      const sql = `
        SELECT 
          id, template, selected_variations, recipient,
          sent_at, delivered, read
        FROM message_variations
        WHERE campaign_id = ?
        ORDER BY sent_at DESC
      `;

      const result = await this.db.query(sql, [campaignId]);
      const variations = result.rows;

      if (variations.length === 0) {
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

      const { startDate = null, endDate = null, limit = 100 } = options;

      let sql = `
        SELECT 
          campaign_id, COUNT(*) as count,
          MIN(sent_at) as first_sent,
          MAX(sent_at) as last_sent
        FROM message_variations
        WHERE user_id = ?
      `;

      const params = [userId];

      if (startDate) {
        sql += ` AND sent_at >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND sent_at <= ?`;
        params.push(endDate);
      }

      sql += ` GROUP BY campaign_id ORDER BY last_sent DESC LIMIT ?`;
      params.push(limit);

      const result = await this.db.query(sql, params);

      return {
        userId,
        campaigns: result.rows,
        totalCampaigns: result.rows.length
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

      if (!['json', 'csv'].includes(format)) {
        throw new Error('Formato deve ser json ou csv');
      }

      // Buscar dados
      const sql = `
        SELECT 
          id, campaign_id, message_id, template, selected_variations,
          recipient, sent_at, delivered, read
        FROM message_variations
        WHERE campaign_id = ?
        ORDER BY sent_at ASC
      `;

      const result = await this.db.query(sql, [campaignId]);
      const data = result.rows;

      if (format === 'json') {
        return this._exportAsJson(data);
      } else {
        return this._exportAsCsv(data);
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
      if (!this.db) {
        throw new Error('Database não inicializado');
      }

      const { delivered = null, read = null } = status;

      let sql = 'UPDATE message_variations SET ';
      const updates = [];
      const params = [];

      if (delivered !== null) {
        updates.push('delivered = ?');
        params.push(delivered ? 1 : 0);
      }

      if (read !== null) {
        updates.push('read = ?');
        params.push(read ? 1 : 0);
      }

      if (updates.length === 0) {
        throw new Error('Nenhum status fornecido');
      }

      sql += updates.join(', ') + ' WHERE id = ?';
      params.push(variationId);

      await this.db.query(sql, params);

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
