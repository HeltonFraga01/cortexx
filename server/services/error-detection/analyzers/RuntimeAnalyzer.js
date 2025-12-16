/**
 * Runtime Analyzer
 * 
 * Analyzes code for potential runtime errors, memory leaks, and performance issues.
 * Detects common patterns that lead to runtime failures.
 * 
 * @module error-detection/analyzers/RuntimeAnalyzer
 */

const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  createDetectedError,
  createErrorLocation,
  createCodeExample,
  createResolution,
  createResolutionStep
} = require('../types');

/**
 * Runtime error patterns for different languages
 */
const RUNTIME_PATTERNS = {
  javascript: [
    {
      name: 'null_reference',
      pattern: /(\w+)\.(\w+)\s*(?!\?\.)(?=\(|\.|\[)/g,
      message: 'Potential null/undefined reference',
      severity: ErrorSeverity.MAJOR,
      description: 'Accessing property without null check may cause TypeError'
    },
    {
      name: 'unhandled_promise',
      pattern: /(?:new\s+Promise|async\s+function|\basync\s*\(|\.then\s*\()(?![^]*\.catch)/g,
      message: 'Promise without error handling',
      severity: ErrorSeverity.MAJOR,
      description: 'Unhandled promise rejection may cause silent failures'
    },
    {
      name: 'infinite_loop_risk',
      pattern: /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/g,
      message: 'Potential infinite loop',
      severity: ErrorSeverity.CRITICAL,
      description: 'Loop without clear exit condition may hang the application'
    },
    {
      name: 'array_index_access',
      pattern: /\[\s*\w+\s*\](?!\s*=)/g,
      message: 'Array access without bounds check',
      severity: ErrorSeverity.MINOR,
      description: 'Accessing array index without validation may return undefined'
    },
    {
      name: 'type_coercion',
      pattern: /==(?!=)/g,
      message: 'Loose equality comparison',
      severity: ErrorSeverity.MINOR,
      description: 'Loose equality may cause unexpected type coercion'
    },
    {
      name: 'eval_usage',
      pattern: /\beval\s*\(/g,
      message: 'Usage of eval() is dangerous',
      severity: ErrorSeverity.CRITICAL,
      description: 'eval() can execute arbitrary code and is a security risk'
    },
    {
      name: 'global_variable',
      pattern: /(?<!var\s|let\s|const\s|function\s|\.)(\b[a-z]\w*)\s*=/g,
      message: 'Potential global variable assignment',
      severity: ErrorSeverity.MAJOR,
      description: 'Assigning to undeclared variable creates global'
    }
  ],
  python: [
    {
      name: 'bare_except',
      pattern: /except\s*:/g,
      message: 'Bare except clause catches all exceptions',
      severity: ErrorSeverity.MAJOR,
      description: 'Catching all exceptions may hide bugs'
    },
    {
      name: 'mutable_default',
      pattern: /def\s+\w+\s*\([^)]*=\s*(\[\]|\{\})/g,
      message: 'Mutable default argument',
      severity: ErrorSeverity.MAJOR,
      description: 'Mutable default arguments are shared between calls'
    },
    {
      name: 'division_by_zero',
      pattern: /\/\s*0(?!\d)/g,
      message: 'Potential division by zero',
      severity: ErrorSeverity.CRITICAL,
      description: 'Division by zero will raise ZeroDivisionError'
    }
  ]
};

/**
 * Memory leak patterns
 */
const MEMORY_LEAK_PATTERNS = {
  javascript: [
    {
      name: 'event_listener_leak',
      pattern: /addEventListener\s*\([^)]+\)(?![^]*removeEventListener)/g,
      message: 'Event listener without cleanup',
      severity: ErrorSeverity.MAJOR,
      description: 'Event listeners should be removed when no longer needed'
    },
    {
      name: 'interval_leak',
      pattern: /setInterval\s*\([^)]+\)(?![^]*clearInterval)/g,
      message: 'setInterval without clearInterval',
      severity: ErrorSeverity.MAJOR,
      description: 'Intervals should be cleared to prevent memory leaks'
    },
    {
      name: 'closure_leak',
      pattern: /function\s*\([^)]*\)\s*\{[^}]*\bthis\b[^}]*\}/g,
      message: 'Potential closure memory leak',
      severity: ErrorSeverity.MINOR,
      description: 'Closures may retain references to outer scope variables'
    },
    {
      name: 'large_array_in_loop',
      pattern: /(?:for|while)[^{]*\{[^}]*(?:push|concat|spread)[^}]*\}/g,
      message: 'Array growing in loop',
      severity: ErrorSeverity.MINOR,
      description: 'Growing arrays in loops may cause memory issues'
    }
  ]
};

/**
 * Performance issue patterns
 */
const PERFORMANCE_PATTERNS = {
  javascript: [
    {
      name: 'nested_loops',
      pattern: /(?:for|while)[^{]*\{[^}]*(?:for|while)[^{]*\{/g,
      message: 'Nested loops detected',
      severity: ErrorSeverity.MINOR,
      description: 'Nested loops may cause O(n²) or worse performance'
    },
    {
      name: 'sync_file_operation',
      pattern: /(?:readFileSync|writeFileSync|existsSync|statSync)/g,
      message: 'Synchronous file operation',
      severity: ErrorSeverity.MINOR,
      description: 'Sync operations block the event loop'
    },
    {
      name: 'regex_in_loop',
      pattern: /(?:for|while)[^{]*\{[^}]*new\s+RegExp/g,
      message: 'RegExp creation in loop',
      severity: ErrorSeverity.MINOR,
      description: 'Creating RegExp in loops is inefficient'
    },
    {
      name: 'dom_in_loop',
      pattern: /(?:for|while)[^{]*\{[^}]*(?:getElementById|querySelector|getElementsBy)/g,
      message: 'DOM query in loop',
      severity: ErrorSeverity.MAJOR,
      description: 'DOM queries in loops are expensive'
    },
    {
      name: 'console_in_production',
      pattern: /console\.(log|debug|info|warn|error)\s*\(/g,
      message: 'Console statement found',
      severity: ErrorSeverity.TRIVIAL,
      description: 'Console statements should be removed in production'
    }
  ]
};

/**
 * Resolution templates for runtime errors
 */
const RESOLUTION_TEMPLATES = {
  null_reference: {
    title: 'Add null/undefined check',
    description: 'Add optional chaining or explicit null check',
    steps: [
      { order: 1, description: 'Use optional chaining (?.) for property access' },
      { order: 2, description: 'Or add explicit null check before access' },
      { order: 3, description: 'Consider using nullish coalescing (??) for defaults' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  },
  unhandled_promise: {
    title: 'Add error handling to Promise',
    description: 'Add .catch() or try-catch for async/await',
    steps: [
      { order: 1, description: 'Add .catch() handler to promise chain' },
      { order: 2, description: 'Or wrap async/await in try-catch block' },
      { order: 3, description: 'Log or handle the error appropriately' }
    ],
    difficulty: 'easy',
    estimatedTime: 3
  },
  infinite_loop_risk: {
    title: 'Add loop exit condition',
    description: 'Ensure loop has a clear termination condition',
    steps: [
      { order: 1, description: 'Add a counter or condition variable' },
      { order: 2, description: 'Add break statement with condition' },
      { order: 3, description: 'Consider using for...of or forEach instead' }
    ],
    difficulty: 'medium',
    estimatedTime: 5
  },
  eval_usage: {
    title: 'Replace eval with safer alternative',
    description: 'Use JSON.parse, Function constructor, or refactor logic',
    steps: [
      { order: 1, description: 'Identify what eval is being used for' },
      { order: 2, description: 'For JSON: use JSON.parse()' },
      { order: 3, description: 'For dynamic code: consider safer alternatives' },
      { order: 4, description: 'Refactor to avoid dynamic code execution' }
    ],
    difficulty: 'hard',
    estimatedTime: 15
  },
  event_listener_leak: {
    title: 'Add event listener cleanup',
    description: 'Remove event listeners when component unmounts',
    steps: [
      { order: 1, description: 'Store reference to the handler function' },
      { order: 2, description: 'Call removeEventListener in cleanup' },
      { order: 3, description: 'For React: use useEffect cleanup function' }
    ],
    difficulty: 'easy',
    estimatedTime: 3
  },
  mutable_default: {
    title: 'Use None as default argument',
    description: 'Replace mutable default with None and create inside function',
    steps: [
      { order: 1, description: 'Change default value to None' },
      { order: 2, description: 'Add check at start of function' },
      { order: 3, description: 'Create new mutable object if None' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  }
};

class RuntimeAnalyzer {
  /**
   * Creates a new RuntimeAnalyzer instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.runtimePatterns = { ...RUNTIME_PATTERNS, ...options.customRuntimePatterns };
    this.memoryPatterns = { ...MEMORY_LEAK_PATTERNS, ...options.customMemoryPatterns };
    this.performancePatterns = { ...PERFORMANCE_PATTERNS, ...options.customPerformancePatterns };
    this.resolutionTemplates = { ...RESOLUTION_TEMPLATES, ...options.customResolutions };
  }

  /**
   * Gets supported file types
   * @returns {string[]} Array of file extensions
   */
  getSupportedFileTypes() {
    return ['.js', '.jsx', '.ts', '.tsx', '.py'];
  }

  /**
   * Gets error categories this analyzer can detect
   * @returns {string[]} Array of error categories
   */
  getErrorCategories() {
    return [ErrorCategory.CRITICAL, ErrorCategory.HIGH, ErrorCategory.MEDIUM, ErrorCategory.LOW];
  }

  /**
   * Analyzes content for runtime errors
   * @param {string} content - File content
   * @param {string} filePath - Path to file
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(content, filePath, language) {
    const errors = [];
    const warnings = [];
    
    if (!language) {
      return { errors, warnings };
    }
    
    // Detect runtime errors
    const runtimeErrors = this.detectRuntimePatterns(content, filePath, language);
    errors.push(...runtimeErrors.filter(e => e.severity !== ErrorSeverity.TRIVIAL));
    warnings.push(...runtimeErrors.filter(e => e.severity === ErrorSeverity.TRIVIAL));
    
    // Detect memory leaks
    const memoryErrors = this.analyzeMemoryLeaks(content, filePath, language);
    errors.push(...memoryErrors);
    
    // Detect performance issues
    const perfWarnings = this.checkPerformanceIssues(content, filePath, language);
    warnings.push(...perfWarnings);
    
    return { errors, warnings };
  }

  /**
   * Detects runtime error patterns
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @param {string} language - Language
   * @returns {Array} Detected errors
   */
  detectRuntimePatterns(content, filePath, language) {
    const errors = [];
    const patterns = this.runtimePatterns[language] || [];
    const lines = content.split('\n');
    
    for (const patternDef of patterns) {
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const column = this.getColumn(content, match.index);
        
        errors.push(this.createRuntimeError(
          patternDef,
          match[0],
          filePath,
          line,
          column,
          lines[line - 1] || ''
        ));
      }
    }
    
    return errors;
  }

  /**
   * Analyzes for memory leak patterns
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @param {string} language - Language
   * @returns {Array} Memory leak errors
   */
  analyzeMemoryLeaks(content, filePath, language) {
    const errors = [];
    const patterns = this.memoryPatterns[language] || [];
    const lines = content.split('\n');
    
    for (const patternDef of patterns) {
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const column = this.getColumn(content, match.index);
        
        errors.push(this.createMemoryError(
          patternDef,
          match[0],
          filePath,
          line,
          column,
          lines[line - 1] || ''
        ));
      }
    }
    
    return errors;
  }

  /**
   * Checks for performance issues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @param {string} language - Language
   * @returns {Array} Performance warnings
   */
  checkPerformanceIssues(content, filePath, language) {
    const warnings = [];
    const patterns = this.performancePatterns[language] || [];
    const lines = content.split('\n');
    
    for (const patternDef of patterns) {
      const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const column = this.getColumn(content, match.index);
        
        warnings.push(this.createPerformanceWarning(
          patternDef,
          match[0],
          filePath,
          line,
          column,
          lines[line - 1] || ''
        ));
      }
    }
    
    return warnings;
  }

  /**
   * Gets line number for position
   * @param {string} content - Content
   * @param {number} index - Character index
   * @returns {number} Line number
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Gets column number for position
   * @param {string} content - Content
   * @param {number} index - Character index
   * @returns {number} Column number
   */
  getColumn(content, index) {
    const lastNewline = content.lastIndexOf('\n', index - 1);
    return index - lastNewline;
  }

  /**
   * Creates a runtime error object
   * @param {Object} patternDef - Pattern definition
   * @param {string} matchText - Matched text
   * @param {string} filePath - File path
   * @param {number} line - Line number
   * @param {number} column - Column number
   * @param {string} context - Code context
   * @returns {Object} Detected error
   */
  createRuntimeError(patternDef, matchText, filePath, line, column, context) {
    const resolution = this.resolutionTemplates[patternDef.name];
    
    return createDetectedError({
      id: `runtime_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.RUNTIME,
      category: this.severityToCategory(patternDef.severity),
      severity: patternDef.severity,
      message: patternDef.message,
      description: patternDef.description,
      location: createErrorLocation({ filePath, line, column, context }),
      causes: this.getCauses(patternDef.name),
      resolutions: resolution ? [this.createResolution(resolution, patternDef.name)] : [],
      preventionStrategies: [],
      examples: this.getCodeExamples(patternDef.name)
    });
  }

  /**
   * Creates a memory error object
   * @param {Object} patternDef - Pattern definition
   * @param {string} matchText - Matched text
   * @param {string} filePath - File path
   * @param {number} line - Line number
   * @param {number} column - Column number
   * @param {string} context - Code context
   * @returns {Object} Detected error
   */
  createMemoryError(patternDef, matchText, filePath, line, column, context) {
    const resolution = this.resolutionTemplates[patternDef.name];
    
    return createDetectedError({
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.RUNTIME,
      category: ErrorCategory.HIGH,
      severity: patternDef.severity,
      message: patternDef.message,
      description: patternDef.description,
      location: createErrorLocation({ filePath, line, column, context }),
      causes: ['Resource not properly cleaned up', 'Missing cleanup in component lifecycle'],
      resolutions: resolution ? [this.createResolution(resolution, patternDef.name)] : [],
      preventionStrategies: [],
      examples: []
    });
  }

  /**
   * Creates a performance warning object
   * @param {Object} patternDef - Pattern definition
   * @param {string} matchText - Matched text
   * @param {string} filePath - File path
   * @param {number} line - Line number
   * @param {number} column - Column number
   * @param {string} context - Code context
   * @returns {Object} Warning object
   */
  createPerformanceWarning(patternDef, matchText, filePath, line, column, context) {
    return createDetectedError({
      id: `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.PERFORMANCE,
      category: ErrorCategory.LOW,
      severity: patternDef.severity,
      message: patternDef.message,
      description: patternDef.description,
      location: createErrorLocation({ filePath, line, column, context }),
      causes: ['Inefficient code pattern'],
      resolutions: [],
      preventionStrategies: [],
      examples: []
    });
  }

  /**
   * Converts severity to category
   * @param {string} severity - Severity level
   * @returns {string} Category
   */
  severityToCategory(severity) {
    switch (severity) {
      case ErrorSeverity.BLOCKER:
      case ErrorSeverity.CRITICAL:
        return ErrorCategory.CRITICAL;
      case ErrorSeverity.MAJOR:
        return ErrorCategory.HIGH;
      case ErrorSeverity.MINOR:
        return ErrorCategory.MEDIUM;
      default:
        return ErrorCategory.LOW;
    }
  }

  /**
   * Creates a resolution object from template
   * @param {Object} template - Resolution template
   * @param {string} name - Error name
   * @returns {Object} Resolution object
   */
  createResolution(template, name) {
    return createResolution({
      id: `res_${name}`,
      title: template.title,
      description: template.description,
      steps: template.steps.map(s => createResolutionStep(s)),
      difficulty: template.difficulty,
      estimatedTime: template.estimatedTime,
      requirements: template.requirements || []
    });
  }

  /**
   * Gets causes for an error type
   * @param {string} errorName - Error name
   * @returns {string[]} Causes
   */
  getCauses(errorName) {
    const causes = {
      null_reference: [
        'Variable may be null or undefined',
        'API response may not contain expected data',
        'Object property may not exist'
      ],
      unhandled_promise: [
        'Missing .catch() handler',
        'No try-catch around await',
        'Error handling forgotten'
      ],
      infinite_loop_risk: [
        'Missing break condition',
        'Counter not incrementing',
        'Exit condition never met'
      ],
      eval_usage: [
        'Dynamic code execution needed',
        'Legacy code pattern',
        'JSON parsing (should use JSON.parse)'
      ]
    };
    
    return causes[errorName] || ['Unknown cause'];
  }

  /**
   * Gets code examples for an error type
   * @param {string} errorName - Error name
   * @returns {Array} Code examples
   */
  getCodeExamples(errorName) {
    const examples = {
      null_reference: [
        createCodeExample({
          incorrect: 'const name = user.profile.name;',
          correct: 'const name = user?.profile?.name;',
          explanation: 'Use optional chaining to safely access nested properties'
        })
      ],
      unhandled_promise: [
        createCodeExample({
          incorrect: 'fetchData().then(data => process(data));',
          correct: 'fetchData().then(data => process(data)).catch(err => handleError(err));',
          explanation: 'Always add .catch() to handle promise rejections'
        })
      ],
      eval_usage: [
        createCodeExample({
          incorrect: 'const data = eval(jsonString);',
          correct: 'const data = JSON.parse(jsonString);',
          explanation: 'Use JSON.parse() instead of eval() for JSON data'
        })
      ]
    };
    
    return examples[errorName] || [];
  }
}

module.exports = RuntimeAnalyzer;
