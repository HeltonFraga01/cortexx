/**
 * HumanizationEngine Service
 * 
 * Implementa técnicas de humanização para evitar detecção como automação:
 * - Delays variáveis com distribuição normal
 * - Randomização de ordem (Fisher-Yates)
 * - Micro-variações naturais
 */

const { logger } = require('../utils/logger');

class HumanizationEngine {
  /**
   * Calcula um delay aleatório dentro do intervalo especificado
   * Usa distribuição normal para parecer mais natural
   * 
   * @param {number} minSeconds - Delay mínimo em segundos (5-300)
   * @param {number} maxSeconds - Delay máximo em segundos (5-300)
   * @returns {number} Delay em milissegundos
   */
  static calculateDelay(minSeconds, maxSeconds) {
    try {
      // Validar inputs
      if (minSeconds < 5 || minSeconds > 300) {
        throw new Error('minSeconds deve estar entre 5 e 300');
      }
      if (maxSeconds < 5 || maxSeconds > 300) {
        throw new Error('maxSeconds deve estar entre 5 e 300');
      }
      if (minSeconds > maxSeconds) {
        throw new Error('minSeconds não pode ser maior que maxSeconds');
      }

      // Calcular média e desvio padrão para distribuição normal
      const mean = (minSeconds + maxSeconds) / 2;
      const stdDev = (maxSeconds - minSeconds) / 6; // 99.7% dos valores dentro do intervalo

      // Gerar delay com distribuição normal
      let delay = this.normalRandom(mean, stdDev);

      // Garantir que o delay está dentro dos limites
      delay = Math.max(minSeconds, Math.min(maxSeconds, delay));

      // Adicionar micro-variação (±500ms) para parecer mais natural
      const microVariation = (Math.random() - 0.5) * 1; // ±0.5 segundos
      delay += microVariation;

      // Garantir limites novamente após micro-variação
      delay = Math.max(minSeconds, Math.min(maxSeconds, delay));

      // Converter para milissegundos
      const delayMs = Math.round(delay * 1000);

      logger.debug('Delay calculado', {
        minSeconds,
        maxSeconds,
        mean,
        stdDev,
        delaySeconds: delay,
        delayMs
      });

      return delayMs;

    } catch (error) {
      logger.error('Erro ao calcular delay:', error.message);
      // Fallback: retornar média simples
      const fallbackDelay = ((minSeconds + maxSeconds) / 2) * 1000;
      return Math.round(fallbackDelay);
    }
  }

  /**
   * Randomiza a ordem dos contatos usando algoritmo Fisher-Yates
   * Preserva todos os dados dos contatos
   * 
   * @param {Array} contacts - Array de contatos para randomizar
   * @returns {Array} Array de contatos em ordem aleatória
   */
  static shuffleContacts(contacts) {
    try {
      if (!Array.isArray(contacts)) {
        throw new Error('contacts deve ser um array');
      }

      if (contacts.length === 0) {
        return contacts;
      }

      // Criar cópia para não modificar o array original
      const shuffled = [...contacts];

      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        // Gerar índice aleatório entre 0 e i
        const j = Math.floor(Math.random() * (i + 1));

        // Trocar elementos i e j
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      logger.debug('Contatos randomizados', {
        originalCount: contacts.length,
        shuffledCount: shuffled.length
      });

      return shuffled;

    } catch (error) {
      logger.error('Erro ao randomizar contatos:', error.message);
      // Fallback: retornar array original
      return contacts;
    }
  }

  /**
   * Gera número aleatório com distribuição normal
   * Usa transformação Box-Muller
   * 
   * @param {number} mean - Média da distribuição
   * @param {number} stdDev - Desvio padrão da distribuição
   * @returns {number} Número aleatório com distribuição normal
   */
  static normalRandom(mean, stdDev) {
    try {
      // Box-Muller transform
      // Gera dois números aleatórios uniformes entre 0 e 1
      let u1 = 0;
      let u2 = 0;

      // Evitar u1 = 0 (log(0) = -Infinity)
      while (u1 === 0) {
        u1 = Math.random();
      }
      u2 = Math.random();

      // Aplicar transformação Box-Muller
      const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      // Converter para distribuição com média e desvio padrão desejados
      const result = z0 * stdDev + mean;

      return result;

    } catch (error) {
      logger.error('Erro ao gerar número aleatório normal:', error.message);
      // Fallback: retornar média
      return mean;
    }
  }

  /**
   * Calcula tempo estimado restante para conclusão da campanha
   * 
   * @param {number} remainingContacts - Número de contatos restantes
   * @param {number} avgDelaySeconds - Delay médio em segundos
   * @param {number} avgProcessingTimeSeconds - Tempo médio de processamento por contato
   * @returns {number} Tempo estimado em segundos
   */
  static estimateRemainingTime(remainingContacts, avgDelaySeconds, avgProcessingTimeSeconds = 2) {
    try {
      if (remainingContacts <= 0) {
        return 0;
      }

      // Tempo total = (delay médio + tempo de processamento) * contatos restantes
      const timePerContact = avgDelaySeconds + avgProcessingTimeSeconds;
      const totalSeconds = timePerContact * remainingContacts;

      logger.debug('Tempo estimado calculado', {
        remainingContacts,
        avgDelaySeconds,
        avgProcessingTimeSeconds,
        timePerContact,
        totalSeconds
      });

      return Math.round(totalSeconds);

    } catch (error) {
      logger.error('Erro ao calcular tempo estimado:', error.message);
      return 0;
    }
  }

  /**
   * Valida configuração de humanização
   * 
   * @param {Object} config - Configuração de humanização
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  static validateConfig(config) {
    const errors = [];

    try {
      if (!config) {
        errors.push('Configuração de humanização é obrigatória');
        return { valid: false, errors };
      }

      // Validar delay_min
      if (typeof config.delay_min !== 'number') {
        errors.push('delay_min deve ser um número');
      } else if (config.delay_min < 5 || config.delay_min > 300) {
        errors.push('delay_min deve estar entre 5 e 300 segundos');
      }

      // Validar delay_max
      if (typeof config.delay_max !== 'number') {
        errors.push('delay_max deve ser um número');
      } else if (config.delay_max < 5 || config.delay_max > 300) {
        errors.push('delay_max deve estar entre 5 e 300 segundos');
      }

      // Validar relação entre min e max
      if (config.delay_min > config.delay_max) {
        errors.push('delay_min não pode ser maior que delay_max');
      }

      // Validar randomize_order
      if (typeof config.randomize_order !== 'boolean') {
        errors.push('randomize_order deve ser um booleano');
      }

      const valid = errors.length === 0;

      logger.debug('Validação de configuração', {
        config,
        valid,
        errors
      });

      return { valid, errors };

    } catch (error) {
      logger.error('Erro ao validar configuração:', error.message);
      errors.push('Erro ao validar configuração: ' + error.message);
      return { valid: false, errors };
    }
  }

  /**
   * Gera estatísticas sobre delays aplicados
   * 
   * @param {Array<number>} delays - Array de delays em milissegundos
   * @returns {Object} Estatísticas dos delays
   */
  static getDelayStatistics(delays) {
    try {
      if (!Array.isArray(delays) || delays.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          mean: 0,
          median: 0,
          stdDev: 0
        };
      }

      const sorted = [...delays].sort((a, b) => a - b);
      const count = sorted.length;
      const min = sorted[0];
      const max = sorted[count - 1];
      const sum = sorted.reduce((acc, val) => acc + val, 0);
      const mean = sum / count;

      // Calcular mediana
      const median = count % 2 === 0
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];

      // Calcular desvio padrão
      const variance = sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / count;
      const stdDev = Math.sqrt(variance);

      return {
        count,
        min: Math.round(min),
        max: Math.round(max),
        mean: Math.round(mean),
        median: Math.round(median),
        stdDev: Math.round(stdDev)
      };

    } catch (error) {
      logger.error('Erro ao calcular estatísticas de delay:', error.message);
      return {
        count: 0,
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0
      };
    }
  }
}

module.exports = HumanizationEngine;
