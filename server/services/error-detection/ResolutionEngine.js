/**
 * Resolution Engine
 * 
 * Generates step-by-step solutions for detected errors,
 * ranks resolutions by effectiveness, and provides validation steps.
 * 
 * @module error-detection/ResolutionEngine
 */

const {
  ErrorType,
  ErrorSeverity,
  ResolutionDifficulty,
  createResolution,
  createResolutionStep
} = require('./types');

/**
 * Resolution templates organized by error pattern
 */
const RESOLUTION_TEMPLATES = {
  // Syntax errors
  missing_semicolon: {
    title: 'Add missing semicolon',
    description: 'Add semicolons at the end of statements',
    steps: [
      { order: 1, description: 'Locate the line with the missing semicolon' },
      { order: 2, description: 'Add a semicolon (;) at the end of the statement' },
      { order: 3, description: 'Consider enabling ESLint semi rule to catch future occurrences' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 1,
    effectiveness: 100,
    requirements: []
  },
  unclosed_bracket: {
    title: 'Close unclosed bracket',
    description: 'Find and close the unclosed bracket',
    steps: [
      { order: 1, description: 'Use editor bracket matching to find the opening bracket' },
      { order: 2, description: 'Determine where the closing bracket should be placed' },
      { order: 3, description: 'Add the appropriate closing bracket (}, ], or ))' },
      { order: 4, description: 'Verify the code structure is correct' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 2,
    effectiveness: 100,
    requirements: []
  },
  unclosed_string: {
    title: 'Close unclosed string',
    description: 'Add the missing closing quote',
    steps: [
      { order: 1, description: 'Identify the type of quote used (single, double, or backtick)' },
      { order: 2, description: 'Find where the string should end' },
      { order: 3, description: 'Add the matching closing quote' },
      { order: 4, description: 'If the string contains quotes, escape them with backslash' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 1,
    effectiveness: 100,
    requirements: []
  },

  // Runtime errors
  null_reference: {
    title: 'Add null/undefined check',
    description: 'Protect against null/undefined reference errors',
    steps: [
      { order: 1, description: 'Identify the variable that may be null/undefined' },
      { order: 2, description: 'Add optional chaining (?.) for property access' },
      { order: 3, description: 'Use nullish coalescing (??) for default values' },
      { order: 4, description: 'Consider adding TypeScript strict null checks' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 3,
    effectiveness: 95,
    requirements: []
  },
  unhandled_promise: {
    title: 'Add promise error handling',
    description: 'Handle promise rejections properly',
    steps: [
      { order: 1, description: 'Identify the promise that needs error handling' },
      { order: 2, description: 'Add .catch() handler to the promise chain' },
      { order: 3, description: 'Or wrap async/await in try-catch block' },
      { order: 4, description: 'Log the error and provide user feedback' },
      { order: 5, description: 'Consider adding global unhandledrejection handler' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 5,
    effectiveness: 100,
    requirements: []
  },
  infinite_loop: {
    title: 'Add loop exit condition',
    description: 'Ensure the loop has a clear termination condition',
    steps: [
      { order: 1, description: 'Identify the loop that may run infinitely' },
      { order: 2, description: 'Add a counter variable to limit iterations' },
      { order: 3, description: 'Add a break condition based on the counter or state' },
      { order: 4, description: 'Consider using for...of or forEach for collections' }
    ],
    difficulty: ResolutionDifficulty.MEDIUM,
    estimatedTime: 10,
    effectiveness: 100,
    requirements: []
  },

  // Security errors
  eval_usage: {
    title: 'Replace eval with safer alternative',
    description: 'Remove eval() and use safer alternatives',
    steps: [
      { order: 1, description: 'Identify what eval() is being used for' },
      { order: 2, description: 'For JSON: replace with JSON.parse()' },
      { order: 3, description: 'For math: use a safe expression parser library' },
      { order: 4, description: 'For dynamic code: refactor to use function mapping' },
      { order: 5, description: 'Test thoroughly to ensure functionality is preserved' }
    ],
    difficulty: ResolutionDifficulty.HARD,
    estimatedTime: 30,
    effectiveness: 100,
    requirements: []
  },
  sql_injection: {
    title: 'Use parameterized queries',
    description: 'Prevent SQL injection with parameterized queries',
    steps: [
      { order: 1, description: 'Identify the SQL query with string concatenation' },
      { order: 2, description: 'Replace string interpolation with parameter placeholders' },
      { order: 3, description: 'Pass user input as separate parameters' },
      { order: 4, description: 'Test with malicious input to verify protection' }
    ],
    difficulty: ResolutionDifficulty.MEDIUM,
    estimatedTime: 15,
    effectiveness: 100,
    requirements: []
  },

  // Configuration errors
  missing_required_field: {
    title: 'Add required configuration field',
    description: 'Add the missing required field to configuration',
    steps: [
      { order: 1, description: 'Open the configuration file' },
      { order: 2, description: 'Add the missing field with appropriate value' },
      { order: 3, description: 'Refer to documentation for valid values' },
      { order: 4, description: 'Validate the configuration file' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 2,
    effectiveness: 100,
    requirements: []
  },
  invalid_json: {
    title: 'Fix JSON syntax',
    description: 'Correct the JSON syntax error',
    steps: [
      { order: 1, description: 'Use a JSON validator to identify the exact error' },
      { order: 2, description: 'Common fixes: remove trailing commas, use double quotes' },
      { order: 3, description: 'Ensure all brackets and braces are matched' },
      { order: 4, description: 'Validate the JSON is now valid' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 2,
    effectiveness: 100,
    requirements: []
  },

  // Memory leaks
  event_listener_leak: {
    title: 'Add event listener cleanup',
    description: 'Remove event listeners when no longer needed',
    steps: [
      { order: 1, description: 'Store reference to the event handler function' },
      { order: 2, description: 'Add removeEventListener in cleanup/unmount' },
      { order: 3, description: 'For React: use useEffect cleanup function' },
      { order: 4, description: 'Verify listeners are removed using DevTools' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 5,
    effectiveness: 100,
    requirements: []
  },
  interval_leak: {
    title: 'Clear interval on cleanup',
    description: 'Clear setInterval when component unmounts',
    steps: [
      { order: 1, description: 'Store the interval ID returned by setInterval' },
      { order: 2, description: 'Call clearInterval with the ID in cleanup' },
      { order: 3, description: 'For React: return cleanup function from useEffect' },
      { order: 4, description: 'Verify interval is cleared using DevTools' }
    ],
    difficulty: ResolutionDifficulty.EASY,
    estimatedTime: 3,
    effectiveness: 100,
    requirements: []
  }
};

/**
 * Validation step templates
 */
const VALIDATION_TEMPLATES = {
  syntax: [
    { description: 'Run the linter to check for syntax errors', command: 'npm run lint' },
    { description: 'Compile/transpile the code', command: 'npm run build' },
    { description: 'Verify no new errors in editor' }
  ],
  runtime: [
    { description: 'Run unit tests', command: 'npm test' },
    { description: 'Test the specific functionality manually' },
    { description: 'Check browser/Node console for errors' }
  ],
  security: [
    { description: 'Run security audit', command: 'npm audit' },
    { description: 'Test with malicious input' },
    { description: 'Review code for similar vulnerabilities' }
  ],
  configuration: [
    { description: 'Validate configuration file syntax' },
    { description: 'Restart the application' },
    { description: 'Verify the application starts without errors' }
  ],
  performance: [
    { description: 'Run performance profiler' },
    { description: 'Compare before/after metrics' },
    { description: 'Test with realistic data volume' }
  ]
};

class ResolutionEngine {
  /**
   * Creates a new ResolutionEngine instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.templates = { ...RESOLUTION_TEMPLATES, ...options.customTemplates };
    this.validationTemplates = { ...VALIDATION_TEMPLATES, ...options.customValidation };
  }

  /**
   * Generates resolutions for an error
   * @param {Object} error - Detected error
   * @returns {Promise<Array>} Array of resolutions
   */
  async generateResolutions(error) {
    const resolutions = [];
    
    // Get pattern-based resolution
    const patternName = this.extractPatternName(error);
    if (patternName && this.templates[patternName]) {
      resolutions.push(this.createResolutionFromTemplate(patternName));
    }
    
    // Add type-based generic resolutions
    const genericResolutions = this.getGenericResolutions(error.type);
    resolutions.push(...genericResolutions);
    
    // Add any resolutions already attached to the error
    if (error.resolutions?.length > 0) {
      resolutions.push(...error.resolutions);
    }
    
    // Remove duplicates and rank
    const uniqueResolutions = this.deduplicateResolutions(resolutions);
    return this.rankResolutions(uniqueResolutions);
  }

  /**
   * Extracts pattern name from error
   * @param {Object} error - Detected error
   * @returns {string|null} Pattern name
   */
  extractPatternName(error) {
    if (error.id) {
      const match = error.id.match(/^(\w+)_/);
      if (match && this.templates[match[1]]) {
        return match[1];
      }
    }
    
    const message = error.message?.toLowerCase() || '';
    
    const patternMap = {
      'semicolon': 'missing_semicolon',
      'bracket': 'unclosed_bracket',
      'brace': 'unclosed_bracket',
      'string': 'unclosed_string',
      'null': 'null_reference',
      'undefined': 'null_reference',
      'promise': 'unhandled_promise',
      'unhandled': 'unhandled_promise',
      'infinite': 'infinite_loop',
      'eval': 'eval_usage',
      'sql': 'sql_injection',
      'injection': 'sql_injection',
      'required field': 'missing_required_field',
      'json': 'invalid_json',
      'event listener': 'event_listener_leak',
      'interval': 'interval_leak'
    };
    
    for (const [keyword, pattern] of Object.entries(patternMap)) {
      if (message.includes(keyword)) {
        return pattern;
      }
    }
    
    return null;
  }

  /**
   * Creates a resolution from template
   * @param {string} patternName - Pattern name
   * @returns {Object} Resolution object
   */
  createResolutionFromTemplate(patternName) {
    const template = this.templates[patternName];
    if (!template) return null;
    
    return createResolution({
      id: `res_${patternName}_${Date.now()}`,
      title: template.title,
      description: template.description,
      steps: template.steps.map(s => createResolutionStep(s)),
      difficulty: template.difficulty,
      estimatedTime: template.estimatedTime,
      requirements: template.requirements || [],
      effectiveness: template.effectiveness
    });
  }

  /**
   * Gets generic resolutions for an error type
   * @param {string} errorType - Error type
   * @returns {Array} Generic resolutions
   */
  getGenericResolutions(errorType) {
    const genericResolutions = {
      [ErrorType.SYNTAX]: [
        createResolution({
          id: 'generic_syntax_lint',
          title: 'Run linter to identify issues',
          description: 'Use ESLint or similar tool to find and fix syntax issues',
          steps: [
            createResolutionStep({ order: 1, description: 'Run npm run lint' }),
            createResolutionStep({ order: 2, description: 'Review reported issues' }),
            createResolutionStep({ order: 3, description: 'Apply suggested fixes' })
          ],
          difficulty: ResolutionDifficulty.EASY,
          estimatedTime: 5,
          requirements: ['ESLint']
        })
      ],
      [ErrorType.RUNTIME]: [
        createResolution({
          id: 'generic_runtime_debug',
          title: 'Debug with breakpoints',
          description: 'Use debugger to step through code and identify the issue',
          steps: [
            createResolutionStep({ order: 1, description: 'Set breakpoint at error location' }),
            createResolutionStep({ order: 2, description: 'Run in debug mode' }),
            createResolutionStep({ order: 3, description: 'Inspect variable values' }),
            createResolutionStep({ order: 4, description: 'Identify the root cause' })
          ],
          difficulty: ResolutionDifficulty.MEDIUM,
          estimatedTime: 15,
          requirements: ['Debugger']
        })
      ],
      [ErrorType.CONFIGURATION]: [
        createResolution({
          id: 'generic_config_validate',
          title: 'Validate configuration',
          description: 'Use schema validation to check configuration',
          steps: [
            createResolutionStep({ order: 1, description: 'Find the configuration schema' }),
            createResolutionStep({ order: 2, description: 'Validate against schema' }),
            createResolutionStep({ order: 3, description: 'Fix reported issues' })
          ],
          difficulty: ResolutionDifficulty.EASY,
          estimatedTime: 5,
          requirements: []
        })
      ]
    };
    
    return genericResolutions[errorType] || [];
  }

  /**
   * Removes duplicate resolutions
   * @param {Array} resolutions - Array of resolutions
   * @returns {Array} Deduplicated resolutions
   */
  deduplicateResolutions(resolutions) {
    const seen = new Set();
    return resolutions.filter(r => {
      if (!r) return false;
      const key = r.title?.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Ranks resolutions by effectiveness and ease
   * @param {Array} resolutions - Array of resolutions
   * @returns {Array} Ranked resolutions
   */
  rankResolutions(resolutions) {
    return resolutions.sort((a, b) => {
      // Higher effectiveness first
      const effectivenessA = a.effectiveness || 50;
      const effectivenessB = b.effectiveness || 50;
      if (effectivenessA !== effectivenessB) {
        return effectivenessB - effectivenessA;
      }
      
      // Easier difficulty first
      const difficultyOrder = {
        [ResolutionDifficulty.EASY]: 1,
        [ResolutionDifficulty.MEDIUM]: 2,
        [ResolutionDifficulty.HARD]: 3
      };
      const diffA = difficultyOrder[a.difficulty] || 2;
      const diffB = difficultyOrder[b.difficulty] || 2;
      if (diffA !== diffB) {
        return diffA - diffB;
      }
      
      // Shorter time first
      return (a.estimatedTime || 10) - (b.estimatedTime || 10);
    });
  }

  /**
   * Generates validation steps for a resolution
   * @param {Object} resolution - Resolution object
   * @param {string} errorType - Error type
   * @returns {Array} Validation steps
   */
  generateValidationSteps(resolution, errorType) {
    const typeKey = this.getValidationTypeKey(errorType);
    const baseSteps = this.validationTemplates[typeKey] || [];
    
    return [
      ...baseSteps,
      { description: 'Verify the original error no longer appears' },
      { description: 'Run full test suite to check for regressions', command: 'npm test' }
    ];
  }

  /**
   * Gets validation type key from error type
   * @param {string} errorType - Error type
   * @returns {string} Validation type key
   */
  getValidationTypeKey(errorType) {
    const typeMap = {
      [ErrorType.SYNTAX]: 'syntax',
      [ErrorType.RUNTIME]: 'runtime',
      [ErrorType.LOGICAL]: 'runtime',
      [ErrorType.CONFIGURATION]: 'configuration',
      [ErrorType.SECURITY]: 'security',
      [ErrorType.PERFORMANCE]: 'performance'
    };
    
    return typeMap[errorType] || 'runtime';
  }

  /**
   * Generates a complete resolution package
   * @param {Object} error - Detected error
   * @returns {Promise<Object>} Complete resolution package
   */
  async generateCompleteResolution(error) {
    const resolutions = await this.generateResolutions(error);
    const primaryResolution = resolutions[0];
    
    return {
      primaryResolution,
      alternativeResolutions: resolutions.slice(1),
      validationSteps: primaryResolution 
        ? this.generateValidationSteps(primaryResolution, error.type)
        : [],
      estimatedTotalTime: this.calculateTotalTime(resolutions),
      recommendedApproach: this.getRecommendedApproach(error, resolutions)
    };
  }

  /**
   * Calculates total estimated time for all resolutions
   * @param {Array} resolutions - Array of resolutions
   * @returns {number} Total time in minutes
   */
  calculateTotalTime(resolutions) {
    return resolutions.reduce((total, r) => total + (r.estimatedTime || 0), 0);
  }

  /**
   * Gets recommended approach based on error and resolutions
   * @param {Object} error - Detected error
   * @param {Array} resolutions - Available resolutions
   * @returns {string} Recommended approach
   */
  getRecommendedApproach(error, resolutions) {
    if (resolutions.length === 0) {
      return 'Manual investigation required. Review the error details and consult documentation.';
    }
    
    const primary = resolutions[0];
    
    if (error.severity === ErrorSeverity.BLOCKER || error.severity === ErrorSeverity.CRITICAL) {
      return `Urgent: Apply "${primary.title}" immediately. This is a critical issue.`;
    }
    
    if (primary.difficulty === ResolutionDifficulty.EASY) {
      return `Quick fix available: "${primary.title}" (${primary.estimatedTime} min)`;
    }
    
    return `Recommended: "${primary.title}". Consider ${resolutions.length - 1} alternative approaches.`;
  }
}

module.exports = ResolutionEngine;
