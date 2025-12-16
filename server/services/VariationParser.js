/**
 * VariationParser Service
 * 
 * Serviço responsável por analisar e validar templates de mensagem com variações.
 * Suporta a sintaxe: "Texto|Variação1|Variação2" para criar blocos de variação.
 * 
 * Exemplo:
 * "Olá|Oi|E aí, tudo bem? Gostaria de saber mais sobre|Tenho interesse em nossos produtos."
 * 
 * Requisitos: 1.1, 5.1, 5.2, 5.3
 */

const { logger } = require('../utils/logger');

class VariationParser {
  constructor() {
    // Configurações de validação
    this.config = {
      minVariationsPerBlock: 2,
      maxVariationsPerBlock: 10,
      maxBlocks: 20,
      minVariationLength: 1,
      maxVariationLength: 500,
      delimiter: '|'
    };
  }

  /**
   * Analisa um template e extrai blocos de variação
   * 
   * @param {string} template - Template com sintaxe de variações
   * @returns {ParsedMessage} Objeto com blocos, erros e avisos
   */
  parse(template) {
    const startTime = Date.now();
    
    try {
      // Validação inicial
      if (!template || typeof template !== 'string') {
        return this._createErrorResult('Template inválido ou vazio');
      }

      if (template.trim().length === 0) {
        return this._createErrorResult('Template não pode estar vazio');
      }

      // Estratégia: encontrar sequências de texto com pipes que formam blocos de variação
      // Um bloco é uma sequência de texto|texto|texto sem espaços grandes entre eles
      const blocks = [];
      const errors = [];
      const warnings = [];
      let blockIndex = 0;

      // Dividir o template em partes usando espaços como separadores naturais
      // Mas manter pipes dentro de cada parte
      const parts = template.split(/\s+/);
      let currentPos = 0;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Encontrar a posição real desta parte no template original
        const partStartPos = template.indexOf(part, currentPos);
        
        // Verificar se esta parte contém pipes (possível bloco de variação)
        if (part.includes(this.config.delimiter)) {
          const variations = part.split(this.config.delimiter).map(v => v.trim());
          
          // Validar o bloco
          const blockValidation = this._validateBlock(variations, blockIndex);
          
          if (blockValidation.isValid) {
            blocks.push({
              index: blockIndex,
              startPos: partStartPos,
              endPos: partStartPos + part.length,
              originalText: part,
              variations: variations.filter(v => v.length > 0),
              variationCount: variations.filter(v => v.length > 0).length
            });
            blockIndex++;
          } else {
            errors.push(...blockValidation.errors);
          }

          if (blockValidation.warnings.length > 0) {
            warnings.push(...blockValidation.warnings);
          }
        }
        
        currentPos = partStartPos + part.length;
      }

      // Validações globais
      if (blocks.length === 0) {
        warnings.push({
          type: 'NO_VARIATIONS',
          message: 'Nenhuma variação encontrada. Use o formato: Texto1|Texto2|Texto3',
          suggestion: 'Adicione pelo menos um bloco com 2 ou mais variações separadas por |'
        });
      }

      if (blocks.length > this.config.maxBlocks) {
        errors.push({
          type: 'TOO_MANY_BLOCKS',
          message: `Número máximo de blocos excedido (${blocks.length}/${this.config.maxBlocks})`,
          blockIndex: null
        });
      }

      // Calcular total de combinações possíveis
      const totalCombinations = this.calculateCombinations(blocks);

      // Verificar se há texto estático (não variável)
      const hasStaticText = this._hasStaticText(template, blocks);
      if (!hasStaticText && blocks.length > 0) {
        warnings.push({
          type: 'NO_STATIC_TEXT',
          message: 'Template contém apenas variações, sem texto fixo',
          suggestion: 'Considere adicionar texto fixo para dar contexto à mensagem'
        });
      }

      const duration = Date.now() - startTime;
      logger.info('Template analisado com sucesso', {
        blocks: blocks.length,
        combinations: totalCombinations,
        errors: errors.length,
        warnings: warnings.length,
        duration
      });

      return {
        isValid: errors.length === 0,
        blocks,
        totalCombinations,
        errors,
        warnings,
        metadata: {
          templateLength: template.length,
          blockCount: blocks.length,
          hasStaticText,
          parseTime: duration
        }
      };

    } catch (error) {
      logger.error('Erro ao analisar template', { error: error.message });
      return this._createErrorResult(`Erro ao processar template: ${error.message}`);
    }
  }

  /**
   * Valida um template sem retornar blocos detalhados
   * 
   * @param {string} template - Template a validar
   * @returns {ValidationResult} Resultado simplificado da validação
   */
  validate(template) {
    const parsed = this.parse(template);
    
    return {
      isValid: parsed.isValid,
      errors: parsed.errors,
      warnings: parsed.warnings,
      blockCount: parsed.blocks.length,
      totalCombinations: parsed.totalCombinations
    };
  }

  /**
   * Calcula o número total de combinações possíveis
   * 
   * @param {Array} blocks - Array de blocos de variação
   * @returns {number} Total de combinações possíveis
   */
  calculateCombinations(blocks) {
    if (!blocks || blocks.length === 0) {
      return 1;
    }

    return blocks.reduce((total, block) => {
      return total * block.variationCount;
    }, 1);
  }

  /**
   * Valida um bloco individual de variações
   * 
   * @private
   * @param {Array<string>} variations - Array de variações do bloco
   * @param {number} blockIndex - Índice do bloco
   * @returns {Object} Resultado da validação com erros e avisos
   */
  _validateBlock(variations, blockIndex) {
    const errors = [];
    const warnings = [];

    // Remover variações vazias
    const validVariations = variations.filter(v => v.trim().length > 0);

    // Validação: mínimo de variações
    if (validVariations.length < this.config.minVariationsPerBlock) {
      errors.push({
        type: 'INSUFFICIENT_VARIATIONS',
        message: `Bloco ${blockIndex + 1} tem apenas ${validVariations.length} variação(ões). Mínimo: ${this.config.minVariationsPerBlock}`,
        blockIndex,
        suggestion: 'Adicione mais variações separadas por | ou remova o bloco'
      });
    }

    // Validação: máximo de variações
    if (validVariations.length > this.config.maxVariationsPerBlock) {
      errors.push({
        type: 'TOO_MANY_VARIATIONS',
        message: `Bloco ${blockIndex + 1} tem ${validVariations.length} variações. Máximo: ${this.config.maxVariationsPerBlock}`,
        blockIndex
      });
    }

    // Validação: variações vazias
    const emptyCount = variations.length - validVariations.length;
    if (emptyCount > 0) {
      warnings.push({
        type: 'EMPTY_VARIATIONS',
        message: `Bloco ${blockIndex + 1} contém ${emptyCount} variação(ões) vazia(s)`,
        blockIndex,
        suggestion: 'Remova delimitadores | extras ou preencha as variações'
      });
    }

    // Validação: tamanho das variações
    validVariations.forEach((variation, idx) => {
      if (variation.length > this.config.maxVariationLength) {
        warnings.push({
          type: 'VARIATION_TOO_LONG',
          message: `Variação ${idx + 1} do bloco ${blockIndex + 1} é muito longa (${variation.length} caracteres)`,
          blockIndex,
          suggestion: `Mantenha variações abaixo de ${this.config.maxVariationLength} caracteres`
        });
      }
    });

    // Validação: variações duplicadas
    const uniqueVariations = new Set(validVariations.map(v => v.toLowerCase()));
    if (uniqueVariations.size < validVariations.length) {
      warnings.push({
        type: 'DUPLICATE_VARIATIONS',
        message: `Bloco ${blockIndex + 1} contém variações duplicadas`,
        blockIndex,
        suggestion: 'Remova variações repetidas para aumentar a diversidade'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Verifica se o template tem texto estático (não variável)
   * 
   * @private
   * @param {string} template - Template completo
   * @param {Array} blocks - Blocos de variação encontrados
   * @returns {boolean} True se há texto estático
   */
  _hasStaticText(template, blocks) {
    if (blocks.length === 0) {
      return true; // Todo o texto é estático
    }

    // Calcular quanto do template é coberto por blocos de variação
    let coveredLength = 0;
    blocks.forEach(block => {
      coveredLength += (block.endPos - block.startPos);
    });

    // Se menos de 90% do template é variação, há texto estático
    const coverageRatio = coveredLength / template.length;
    return coverageRatio < 0.9;
  }

  /**
   * Cria um resultado de erro padrão
   * 
   * @private
   * @param {string} message - Mensagem de erro
   * @returns {ParsedMessage} Resultado com erro
   */
  _createErrorResult(message) {
    return {
      isValid: false,
      blocks: [],
      totalCombinations: 0,
      errors: [{
        type: 'PARSE_ERROR',
        message,
        blockIndex: null
      }],
      warnings: [],
      metadata: {
        templateLength: 0,
        blockCount: 0,
        hasStaticText: false,
        parseTime: 0
      }
    };
  }

  /**
   * Extrai texto estático do template (sem variações)
   * 
   * @param {string} template - Template completo
   * @param {Array} blocks - Blocos de variação
   * @returns {string} Template com placeholders no lugar das variações
   */
  getStaticTemplate(template, blocks) {
    if (blocks.length === 0) {
      return template;
    }

    let result = template;
    
    // Substituir blocos de variação por placeholders
    // Processar de trás para frente para manter índices corretos
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      const placeholder = `{VAR_${i}}`;
      result = result.substring(0, block.startPos) + 
               placeholder + 
               result.substring(block.endPos);
    }

    return result;
  }

  /**
   * Obtém configurações atuais do parser
   * 
   * @returns {Object} Configurações
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Atualiza configurações do parser
   * 
   * @param {Object} newConfig - Novas configurações
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.info('Configurações do VariationParser atualizadas', this.config);
  }
}

// Exportar instância singleton
module.exports = new VariationParser();

// Exportar classe para testes
module.exports.VariationParser = VariationParser;
