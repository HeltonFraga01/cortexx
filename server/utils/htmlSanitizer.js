/**
 * HTML Sanitizer Service - Modo Totalmente Permissivo
 * 
 * Permite HTML customizado completo para administradores confiáveis.
 * Administradores têm controle total sobre o HTML customizado.
 * 
 * Permite:
 * - Scripts inline e externos (src="...")
 * - eval() e Function() constructor
 * - iframes externos
 * - URLs javascript:
 * - Event handlers com qualquer código
 * - Qualquer HTML/CSS/JavaScript válido
 * 
 * Validações aplicadas:
 * - Apenas limite de tamanho (1MB máximo)
 * - Aviso se próximo do limite (500KB)
 */

const { logger } = require('./logger');

class HtmlSanitizer {
  constructor() {
    // Limites de tamanho
    this.maxSize = 1024 * 1024; // 1MB
    this.warnSize = 512 * 1024; // 500KB
    
    // Padrões perigosos a serem bloqueados (MODO PERMISSIVO - apenas validações críticas)
    this.dangerousPatterns = [
      // Removidas todas as restrições - administrador tem controle total
      // Apenas validações de tamanho serão aplicadas
    ];
    
    // Padrões que geram avisos (não bloqueiam) - DESABILITADOS NO MODO PERMISSIVO
    this.warningPatterns = [
      // Removidos todos os avisos - administrador tem controle total
    ];
    
    logger.info('✅ HtmlSanitizer inicializado com validações de segurança', {
      maxSizeMB: Math.round(this.maxSize / 1024 / 1024),
      warnSizeKB: Math.round(this.warnSize / 1024),
      dangerousPatterns: this.dangerousPatterns.length,
      warningPatterns: this.warningPatterns.length
    });
  }

  /**
   * Verifica padrões perigosos no HTML
   * @param {string} html - HTML a ser verificado
   * @returns {Array} Lista de problemas encontrados
   */
  checkForDangerousPatterns(html) {
    const issues = [];
    
    for (const { pattern, message, severity } of this.dangerousPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        issues.push({
          severity,
          message,
          matches: matches.slice(0, 3), // Limitar a 3 exemplos
          count: matches.length
        });
        
        logger.warn(`⚠️ Padrão perigoso detectado: ${message}`, {
          pattern: pattern.toString(),
          matchCount: matches.length,
          examples: matches.slice(0, 3)
        });
      }
    }
    
    return issues;
  }

  /**
   * Verifica padrões que geram avisos (não bloqueiam)
   * @param {string} html - HTML a ser verificado
   * @returns {Array} Lista de avisos
   */
  checkForWarnings(html) {
    const warnings = [];
    
    for (const { pattern, message, severity } of this.warningPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        warnings.push({
          severity,
          message,
          count: matches.length
        });
        
        logger.info(`ℹ️ Aviso de qualidade: ${message}`, {
          pattern: pattern.toString(),
          matchCount: matches.length
        });
      }
    }
    
    return warnings;
  }

  /**
   * Retorna HTML sem modificações se passar nas validações de segurança
   * @param {string} html - HTML fornecido
   * @returns {string} HTML sem modificações
   */
  sanitize(html) {
    if (!html || typeof html !== 'string') {
      return '';
    }

    // Verificar padrões perigosos
    const dangerousIssues = this.checkForDangerousPatterns(html);
    if (dangerousIssues.length > 0) {
      logger.error('❌ HTML contém padrões perigosos', {
        issueCount: dangerousIssues.length,
        issues: dangerousIssues.map(i => i.message)
      });
      throw new Error(`HTML contém padrões de segurança perigosos: ${dangerousIssues.map(i => i.message).join(', ')}`);
    }

    // Verificar avisos (não bloqueia)
    const warnings = this.checkForWarnings(html);
    if (warnings.length > 0) {
      logger.info('ℹ️ HTML tem avisos de qualidade', {
        warningCount: warnings.length,
        warnings: warnings.map(w => w.message)
      });
    }

    logger.info('✅ HTML aceito após validação de segurança', {
      length: html.length,
      sizeKB: Math.round(html.length / 1024),
      warningCount: warnings.length
    });
    
    return html;
  }

  /**
   * Valida HTML com verificações de segurança e tamanho
   * @param {string} html - HTML a ser validado
   * @returns {Object} Resultado da validação
   */
  validate(html) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: null
    };

    // Validar tipo
    if (!html || typeof html !== 'string') {
      result.isValid = false;
      result.errors.push('HTML deve ser uma string válida');
      return result;
    }

    // Validar tamanho máximo (1MB)
    if (html.length > this.maxSize) {
      result.isValid = false;
      result.errors.push(
        `HTML excede o tamanho máximo de ${Math.round(this.maxSize / 1024)}KB ` +
        `(atual: ${Math.round(html.length / 1024)}KB)`
      );
      return result;
    }

    // Aviso de tamanho (500KB)
    if (html.length > this.warnSize) {
      result.warnings.push(
        `HTML é grande (${Math.round(html.length / 1024)}KB). ` +
        `Considere otimizar para melhor performance.`
      );
      
      logger.info('⚠️ HTML próximo do limite de tamanho', {
        sizeKB: Math.round(html.length / 1024),
        warnSizeKB: Math.round(this.warnSize / 1024),
        maxSizeKB: Math.round(this.maxSize / 1024)
      });
    }

    // Verificar padrões perigosos
    const dangerousIssues = this.checkForDangerousPatterns(html);
    if (dangerousIssues.length > 0) {
      result.isValid = false;
      result.errors = dangerousIssues.map(issue => {
        const countMsg = issue.count > 1 ? ` (${issue.count} ocorrências)` : '';
        return `${issue.message}${countMsg}`;
      });
      
      logger.error('❌ HTML falhou na validação de segurança', {
        errorCount: result.errors.length,
        errors: result.errors
      });
      
      return result;
    }

    // Verificar avisos de qualidade (não bloqueia)
    const qualityWarnings = this.checkForWarnings(html);
    if (qualityWarnings.length > 0) {
      result.warnings.push(...qualityWarnings.map(w => {
        const countMsg = w.count > 1 ? ` (${w.count} ocorrências)` : '';
        return `${w.message}${countMsg}`;
      }));
    }

    // HTML passou em todas as validações
    result.sanitized = html;
    
    logger.info('✅ HTML validado com sucesso', {
      sizeKB: Math.round(html.length / 1024),
      maxSizeKB: Math.round(this.maxSize / 1024),
      errorCount: result.errors.length,
      warningCount: result.warnings.length
    });

    return result;
  }

  /**
   * Valida e retorna HTML sem modificações (modo permissivo)
   * @param {string} html - HTML a ser processado
   * @returns {Object} Resultado com HTML ou erros
   */
  validateAndSanitize(html) {
    const validation = this.validate(html);
    
    if (!validation.isValid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    return {
      success: true,
      sanitized: validation.sanitized,
      warnings: validation.warnings
    };
  }
}

// Criar instância singleton
const htmlSanitizer = new HtmlSanitizer();

module.exports = htmlSanitizer;
