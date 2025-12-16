/**
 * TemplateProcessor Service
 * 
 * Serviço responsável por processar templates completos:
 * 1. Parse de variações (VariationParser)
 * 2. Seleção aleatória (RandomSelector)
 * 3. Substituição de blocos
 * 4. Aplicação de variáveis {{nome}}
 * 
 * Requisitos: 1.3, 1.5, 3.4, 6.1, 6.3
 */

const variationParser = require('./VariationParser');
const randomSelector = require('./RandomSelector');
const { logger } = require('../utils/logger');
const { LRUCache } = require('lru-cache');

class TemplateProcessor {
  constructor() {
    // LRU Cache com TTL de 1 hora e máximo de 1000 entradas
    this.parseCache = new LRUCache({
      max: 1000,
      ttl: 1000 * 60 * 60, // 1 hora em milissegundos
      updateAgeOnGet: true, // Atualiza TTL ao acessar
      updateAgeOnHas: false
    });
    this.cacheHits = 0;
    this.cacheMisses = 0;
    
    logger.info('TemplateProcessor inicializado com LRU cache', {
      maxSize: 1000,
      ttl: '1 hora'
    });
  }

  /**
   * Processa um template completo: parse → select → replace → variables
   * 
   * @param {string} template - Template com variações e variáveis
   * @param {Object} variables - Objeto com variáveis para substituição
   * @param {Object} options - Opções de processamento
   * @returns {ProcessedMessage} Mensagem processada com metadata
   */
  process(template, variables = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validação de entrada
      if (!template || typeof template !== 'string') {
        throw new Error('Template inválido');
      }

      // Opções padrão
      const opts = {
        validateOnly: false,
        useSeed: null,
        preserveVariations: false, // Se true, não substitui variações
        ...options
      };

      // Passo 1: Parse do template
      const parsed = this._parseTemplate(template);
      
      if (!parsed.isValid) {
        return {
          success: false,
          originalTemplate: template,
          finalMessage: null,
          errors: parsed.errors,
          warnings: parsed.warnings,
          metadata: {
            parseTime: Date.now() - startTime,
            hasVariations: false,
            hasVariables: false
          }
        };
      }

      // Se é apenas validação, retornar aqui
      if (opts.validateOnly) {
        return {
          success: true,
          originalTemplate: template,
          finalMessage: null,
          parsed,
          errors: [],
          warnings: parsed.warnings,
          metadata: {
            parseTime: Date.now() - startTime,
            hasVariations: parsed.blocks.length > 0,
            hasVariables: this._hasVariables(template)
          }
        };
      }

      // Passo 2: Selecionar variações
      let selections = [];
      if (parsed.blocks.length > 0 && !opts.preserveVariations) {
        if (opts.useSeed !== null) {
          selections = randomSelector.selectWithSeed(parsed.blocks, opts.useSeed);
        } else {
          selections = randomSelector.selectVariations(parsed.blocks);
        }
      }

      // Passo 3: Substituir blocos de variação
      let processedMessage = template;
      if (selections.length > 0) {
        processedMessage = this._replaceVariations(template, parsed.blocks, selections);
      }

      // Passo 4: Aplicar variáveis {{nome}}
      const finalMessage = this._applyVariables(processedMessage, variables);

      const duration = Date.now() - startTime;

      logger.info('Template processado com sucesso', {
        hasVariations: parsed.blocks.length > 0,
        hasVariables: Object.keys(variables).length > 0,
        selections: selections.length,
        duration
      });

      return {
        success: true,
        originalTemplate: template,
        finalMessage,
        parsed,
        selections,
        appliedVariables: variables,
        errors: [],
        warnings: parsed.warnings,
        metadata: {
          parseTime: duration,
          hasVariations: parsed.blocks.length > 0,
          hasVariables: Object.keys(variables).length > 0,
          totalCombinations: parsed.totalCombinations,
          variableCount: Object.keys(variables).length
        }
      };

    } catch (error) {
      logger.error('Erro ao processar template', { error: error.message });
      return {
        success: false,
        originalTemplate: template,
        finalMessage: null,
        errors: [{
          type: 'PROCESSING_ERROR',
          message: error.message
        }],
        warnings: [],
        metadata: {
          parseTime: Date.now() - startTime,
          hasVariations: false,
          hasVariables: false
        }
      };
    }
  }

  /**
   * Gera preview de mensagem com variações
   * 
   * @param {string} template - Template com variações
   * @param {Object} variables - Variáveis para substituição
   * @param {number} count - Número de previews a gerar
   * @returns {Array<ProcessedMessage>} Array de mensagens processadas
   */
  generatePreview(template, variables = {}, count = 3) {
    const startTime = Date.now();
    
    try {
      if (count < 1 || count > 10) {
        throw new Error('Count deve estar entre 1 e 10');
      }

      // Parse uma vez
      const parsed = this._parseTemplate(template);
      
      if (!parsed.isValid) {
        return [{
          success: false,
          originalTemplate: template,
          finalMessage: null,
          errors: parsed.errors,
          warnings: parsed.warnings
        }];
      }

      // Gerar múltiplas seleções
      const multipleSelections = parsed.blocks.length > 0
        ? randomSelector.generateMultiple(parsed.blocks, count)
        : [[]];

      // Processar cada seleção
      const previews = multipleSelections.map((selections, idx) => {
        let processedMessage = template;
        
        if (selections.length > 0) {
          processedMessage = this._replaceVariations(template, parsed.blocks, selections);
        }
        
        const finalMessage = this._applyVariables(processedMessage, variables);

        return {
          success: true,
          previewIndex: idx,
          originalTemplate: template,
          finalMessage,
          selections,
          appliedVariables: variables,
          metadata: {
            hasVariations: parsed.blocks.length > 0,
            hasVariables: Object.keys(variables).length > 0
          }
        };
      });

      const duration = Date.now() - startTime;
      
      logger.info('Previews gerados', {
        count: previews.length,
        duration
      });

      return previews;

    } catch (error) {
      logger.error('Erro ao gerar preview', { error: error.message });
      return [{
        success: false,
        originalTemplate: template,
        finalMessage: null,
        errors: [{
          type: 'PREVIEW_ERROR',
          message: error.message
        }]
      }];
    }
  }

  /**
   * Valida um template sem processar
   * 
   * @param {string} template - Template a validar
   * @returns {ValidationResult} Resultado da validação
   */
  validate(template) {
    return this.process(template, {}, { validateOnly: true });
  }

  /**
   * Extrai variáveis do template
   * 
   * @param {string} template - Template com variáveis
   * @returns {Array<string>} Array de nomes de variáveis
   */
  extractVariables(template) {
    if (!template || typeof template !== 'string') {
      return [];
    }

    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables = new Set();
    let match;

    while ((match = variableRegex.exec(template)) !== null) {
      variables.add(match[1]);
    }

    return Array.from(variables);
  }

  /**
   * Verifica se todas as variáveis necessárias foram fornecidas
   * 
   * @param {string} template - Template com variáveis
   * @param {Object} variables - Variáveis fornecidas
   * @returns {Object} Resultado da verificação
   */
  checkVariables(template, variables = {}) {
    const required = this.extractVariables(template);
    const provided = Object.keys(variables);
    const missing = required.filter(v => !provided.includes(v));
    const extra = provided.filter(v => !required.includes(v));

    return {
      required,
      provided,
      missing,
      extra,
      isComplete: missing.length === 0,
      hasExtra: extra.length > 0
    };
  }

  /**
   * Obtém estatísticas do cache
   * 
   * @returns {Object} Estatísticas
   */
  getCacheStats() {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? (this.cacheHits / total * 100).toFixed(2) : 0;

    return {
      size: this.parseCache.size,
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: `${hitRate}%`
    };
  }

  /**
   * Limpa o cache
   */
  clearCache() {
    this.parseCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    logger.info('Cache do TemplateProcessor limpo');
  }

  /**
   * Parse do template com cache
   * 
   * @private
   * @param {string} template - Template a parsear
   * @returns {ParsedMessage} Resultado do parse
   */
  _parseTemplate(template) {
    // Verificar cache
    const cached = this.parseCache.get(template);
    if (cached !== undefined) {
      this.cacheHits++;
      return cached;
    }

    // Parse novo
    this.cacheMisses++;
    const parsed = variationParser.parse(template);
    
    // Adicionar ao cache (LRU gerencia automaticamente o limite e TTL)
    this.parseCache.set(template, parsed);
    
    // Log a cada 100 misses para monitorar performance
    if (this.cacheMisses % 100 === 0) {
      const stats = this.getCacheStats();
      logger.debug('Cache stats', stats);
    }
    
    return parsed;
  }

  /**
   * Substitui blocos de variação pelas seleções
   * 
   * @private
   * @param {string} template - Template original
   * @param {Array} blocks - Blocos parseados
   * @param {Array} selections - Seleções feitas
   * @returns {string} Template com variações substituídas
   */
  _replaceVariations(template, blocks, selections) {
    let result = template;
    
    // Processar de trás para frente para manter índices corretos
    const sortedBlocks = [...blocks].sort((a, b) => b.startPos - a.startPos);
    
    for (const block of sortedBlocks) {
      const selection = selections.find(s => s.blockIndex === block.index);
      
      if (selection) {
        result = result.substring(0, block.startPos) +
                 selection.selected +
                 result.substring(block.endPos);
      }
    }
    
    return result;
  }

  /**
   * Aplica variáveis {{nome}} no template
   * 
   * @private
   * @param {string} template - Template com variáveis
   * @param {Object} variables - Objeto com variáveis
   * @returns {string} Template com variáveis substituídas
   */
  _applyVariables(template, variables = {}) {
    if (!variables || Object.keys(variables).length === 0) {
      return template;
    }

    let result = template;
    
    // Substituir cada variável
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      const value = variables[key] !== null && variables[key] !== undefined 
        ? String(variables[key]) 
        : '';
      result = result.replace(regex, value);
    });

    return result;
  }

  /**
   * Verifica se o template tem variáveis
   * 
   * @private
   * @param {string} template - Template a verificar
   * @returns {boolean} True se tem variáveis
   */
  _hasVariables(template) {
    return /\{\{\w+\}\}/.test(template);
  }
}

// Exportar instância singleton
module.exports = new TemplateProcessor();

// Exportar classe para testes
module.exports.TemplateProcessor = TemplateProcessor;
