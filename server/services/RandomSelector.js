/**
 * RandomSelector Service
 * 
 * Serviço responsável por selecionar variações aleatórias de forma uniforme.
 * Usa crypto.randomInt() para garantir distribuição uniforme e segura.
 * 
 * Requisitos: 1.2, 6.2
 */

const crypto = require('crypto');
const { logger } = require('../utils/logger');

class RandomSelector {
  constructor() {
    // Estatísticas de seleção (para debugging/monitoring)
    this.stats = {
      totalSelections: 0,
      selectionsByBlock: {},
      lastReset: new Date()
    };
  }

  /**
   * Seleciona variações aleatórias para cada bloco
   * 
   * @param {Array} blocks - Array de blocos do VariationParser
   * @returns {Array} Array de seleções com índice e texto
   */
  selectVariations(blocks) {
    const startTime = Date.now();
    
    try {
      if (!blocks || !Array.isArray(blocks)) {
        throw new Error('Blocks deve ser um array válido');
      }

      if (blocks.length === 0) {
        logger.warn('Nenhum bloco fornecido para seleção');
        return [];
      }

      const selections = [];

      // Selecionar uma variação aleatória para cada bloco
      for (const block of blocks) {
        if (!block.variations || block.variations.length === 0) {
          logger.warn(`Bloco ${block.index} não tem variações`, { block });
          continue;
        }

        // Usar crypto.randomInt para seleção uniforme e segura
        const randomIndex = crypto.randomInt(0, block.variations.length);
        const selectedVariation = block.variations[randomIndex];

        selections.push({
          blockIndex: block.index,
          variationIndex: randomIndex,
          selected: selectedVariation,
          totalOptions: block.variations.length
        });

        // Atualizar estatísticas
        this._updateStats(block.index, randomIndex);
      }

      const duration = Date.now() - startTime;
      
      logger.info('Variações selecionadas', {
        blockCount: blocks.length,
        selections: selections.length,
        duration
      });

      this.stats.totalSelections++;

      return selections;

    } catch (error) {
      logger.error('Erro ao selecionar variações', { error: error.message });
      throw error;
    }
  }

  /**
   * Seleciona uma única variação de um bloco específico
   * 
   * @param {Object} block - Bloco do VariationParser
   * @returns {Object} Seleção com índice e texto
   */
  selectSingle(block) {
    if (!block || !block.variations || block.variations.length === 0) {
      throw new Error('Bloco inválido ou sem variações');
    }

    const randomIndex = crypto.randomInt(0, block.variations.length);
    const selectedVariation = block.variations[randomIndex];

    this._updateStats(block.index, randomIndex);

    return {
      blockIndex: block.index,
      variationIndex: randomIndex,
      selected: selectedVariation,
      totalOptions: block.variations.length
    };
  }

  /**
   * Seleciona variações com seed para reprodutibilidade (útil para testes)
   * 
   * @param {Array} blocks - Array de blocos
   * @param {number} seed - Seed para geração determinística
   * @returns {Array} Array de seleções
   */
  selectWithSeed(blocks, seed) {
    if (!blocks || !Array.isArray(blocks)) {
      throw new Error('Blocks deve ser um array válido');
    }

    if (typeof seed !== 'number') {
      throw new Error('Seed deve ser um número');
    }

    const selections = [];
    let currentSeed = seed;

    for (const block of blocks) {
      if (!block.variations || block.variations.length === 0) {
        continue;
      }

      // Usar seed para gerar índice determinístico
      // Algoritmo simples: (seed * prime) % length
      const prime = 31;
      currentSeed = (currentSeed * prime) % 1000000;
      const randomIndex = currentSeed % block.variations.length;
      const selectedVariation = block.variations[randomIndex];

      selections.push({
        blockIndex: block.index,
        variationIndex: randomIndex,
        selected: selectedVariation,
        totalOptions: block.variations.length
      });
    }

    logger.info('Variações selecionadas com seed', {
      seed,
      blockCount: blocks.length,
      selections: selections.length
    });

    return selections;
  }

  /**
   * Gera múltiplas seleções diferentes (útil para preview)
   * 
   * @param {Array} blocks - Array de blocos
   * @param {number} count - Número de seleções a gerar
   * @returns {Array<Array>} Array de arrays de seleções
   */
  generateMultiple(blocks, count = 3) {
    if (!blocks || !Array.isArray(blocks)) {
      throw new Error('Blocks deve ser um array válido');
    }

    if (count < 1 || count > 10) {
      throw new Error('Count deve estar entre 1 e 10');
    }

    const results = [];
    const seen = new Set();

    // Tentar gerar seleções únicas
    let attempts = 0;
    const maxAttempts = count * 10; // Evitar loop infinito

    while (results.length < count && attempts < maxAttempts) {
      const selections = this.selectVariations(blocks);
      const signature = this._getSelectionSignature(selections);

      // Verificar se esta combinação já foi gerada
      if (!seen.has(signature)) {
        seen.add(signature);
        results.push(selections);
      }

      attempts++;
    }

    logger.info('Múltiplas seleções geradas', {
      requested: count,
      generated: results.length,
      attempts,
      unique: seen.size
    });

    return results;
  }

  /**
   * Verifica a uniformidade da distribuição (útil para testes)
   * 
   * @param {Array} blocks - Array de blocos
   * @param {number} iterations - Número de iterações para teste
   * @returns {Object} Estatísticas de distribuição
   */
  testDistribution(blocks, iterations = 1000) {
    if (!blocks || blocks.length === 0) {
      throw new Error('Blocks inválido');
    }

    const distribution = {};

    // Inicializar contadores
    blocks.forEach(block => {
      distribution[block.index] = new Array(block.variations.length).fill(0);
    });

    // Executar seleções
    for (let i = 0; i < iterations; i++) {
      const selections = this.selectVariations(blocks);
      selections.forEach(selection => {
        distribution[selection.blockIndex][selection.variationIndex]++;
      });
    }

    // Calcular estatísticas
    const stats = {};
    blocks.forEach(block => {
      const counts = distribution[block.index];
      const expected = iterations / block.variations.length;
      const variance = counts.reduce((sum, count) => {
        return sum + Math.pow(count - expected, 2);
      }, 0) / block.variations.length;
      const stdDev = Math.sqrt(variance);

      stats[block.index] = {
        counts,
        expected,
        variance: variance.toFixed(2),
        stdDev: stdDev.toFixed(2),
        uniformity: (1 - (stdDev / expected)).toFixed(4) // 1 = perfeito, 0 = ruim
      };
    });

    logger.info('Teste de distribuição concluído', {
      iterations,
      blocks: blocks.length,
      stats
    });

    return stats;
  }

  /**
   * Obtém estatísticas de uso
   * 
   * @returns {Object} Estatísticas
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.lastReset.getTime()
    };
  }

  /**
   * Reseta estatísticas
   */
  resetStats() {
    this.stats = {
      totalSelections: 0,
      selectionsByBlock: {},
      lastReset: new Date()
    };
    logger.info('Estatísticas do RandomSelector resetadas');
  }

  /**
   * Atualiza estatísticas internas
   * 
   * @private
   * @param {number} blockIndex - Índice do bloco
   * @param {number} variationIndex - Índice da variação selecionada
   */
  _updateStats(blockIndex, variationIndex) {
    if (!this.stats.selectionsByBlock[blockIndex]) {
      this.stats.selectionsByBlock[blockIndex] = {};
    }
    
    if (!this.stats.selectionsByBlock[blockIndex][variationIndex]) {
      this.stats.selectionsByBlock[blockIndex][variationIndex] = 0;
    }
    
    this.stats.selectionsByBlock[blockIndex][variationIndex]++;
  }

  /**
   * Gera assinatura única para uma seleção
   * 
   * @private
   * @param {Array} selections - Array de seleções
   * @returns {string} Assinatura única
   */
  _getSelectionSignature(selections) {
    return selections
      .map(s => `${s.blockIndex}:${s.variationIndex}`)
      .join('|');
  }
}

// Exportar instância singleton
module.exports = new RandomSelector();

// Exportar classe para testes
module.exports.RandomSelector = RandomSelector;
