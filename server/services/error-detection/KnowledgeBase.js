/**
 * Knowledge Base
 * 
 * Stores error patterns, solution templates, and best practice rules.
 * Provides pattern matching and solution lookup functionality.
 * 
 * @module error-detection/KnowledgeBase
 */

const { ErrorType, ErrorCategory, ErrorSeverity } = require('./types');

/**
 * Built-in error patterns
 */
const DEFAULT_PATTERNS = [
  // JavaScript/TypeScript patterns
  {
    id: 'js_null_reference',
    name: 'Null Reference Error',
    description: 'Accessing property of null or undefined value',
    regex: ['TypeError.*null', 'TypeError.*undefined', 'Cannot read propert'],
    languages: ['javascript', 'typescript'],
    frameworks: ['react', 'vue', 'angular', 'node'],
    commonCauses: [
      'Variable not initialized',
      'API response missing expected data',
      'Async data not loaded yet',
      'Object property does not exist'
    ],
    relatedPatterns: ['js_optional_chaining', 'js_nullish_coalescing']
  },
  {
    id: 'js_unhandled_promise',
    name: 'Unhandled Promise Rejection',
    description: 'Promise rejection without error handling',
    regex: ['UnhandledPromiseRejection', 'unhandled.*rejection'],
    languages: ['javascript', 'typescript'],
    frameworks: ['react', 'vue', 'angular', 'node'],
    commonCauses: [
      'Missing .catch() handler',
      'No try-catch around await',
      'Error thrown in async function'
    ],
    relatedPatterns: ['js_async_await', 'js_promise_chain']
  },
  {
    id: 'js_syntax_error',
    name: 'JavaScript Syntax Error',
    description: 'Invalid JavaScript syntax',
    regex: ['SyntaxError', 'Unexpected token', 'Unexpected end of input'],
    languages: ['javascript', 'typescript'],
    frameworks: [],
    commonCauses: [
      'Missing bracket or parenthesis',
      'Unclosed string literal',
      'Invalid JSON',
      'Missing semicolon (in some cases)'
    ],
    relatedPatterns: ['js_bracket_matching']
  },
  {
    id: 'js_reference_error',
    name: 'Reference Error',
    description: 'Using undefined variable',
    regex: ['ReferenceError', 'is not defined'],
    languages: ['javascript', 'typescript'],
    frameworks: [],
    commonCauses: [
      'Variable not declared',
      'Typo in variable name',
      'Variable out of scope',
      'Import missing'
    ],
    relatedPatterns: ['js_scope', 'js_imports']
  },
  
  // Python patterns
  {
    id: 'py_indentation',
    name: 'Python Indentation Error',
    description: 'Inconsistent indentation in Python code',
    regex: ['IndentationError', 'unexpected indent', 'expected an indented block'],
    languages: ['python'],
    frameworks: ['django', 'flask', 'fastapi'],
    commonCauses: [
      'Mixed tabs and spaces',
      'Inconsistent indentation level',
      'Missing indentation after colon'
    ],
    relatedPatterns: ['py_syntax']
  },
  {
    id: 'py_attribute_error',
    name: 'Python Attribute Error',
    description: 'Accessing non-existent attribute',
    regex: ['AttributeError', 'has no attribute'],
    languages: ['python'],
    frameworks: ['django', 'flask', 'fastapi'],
    commonCauses: [
      'Object is None',
      'Typo in attribute name',
      'Wrong object type',
      'Method not defined'
    ],
    relatedPatterns: ['py_none_check']
  },
  
  // Configuration patterns
  {
    id: 'config_json_invalid',
    name: 'Invalid JSON Configuration',
    description: 'JSON syntax error in configuration file',
    regex: ['JSON.*parse', 'Unexpected token', 'JSON at position'],
    languages: ['json'],
    frameworks: [],
    commonCauses: [
      'Trailing comma',
      'Single quotes instead of double',
      'Unquoted keys',
      'Missing comma between items'
    ],
    relatedPatterns: ['config_validation']
  },
  {
    id: 'config_env_missing',
    name: 'Missing Environment Variable',
    description: 'Required environment variable not set',
    regex: ['env.*undefined', 'environment variable.*not set', 'missing.*env'],
    languages: [],
    frameworks: ['node', 'python', 'java'],
    commonCauses: [
      '.env file not loaded',
      'Variable not defined in .env',
      'Typo in variable name',
      'Different variable name in production'
    ],
    relatedPatterns: ['config_dotenv']
  },
  
  // Security patterns
  {
    id: 'sec_sql_injection',
    name: 'SQL Injection Vulnerability',
    description: 'User input directly in SQL query',
    regex: ['SELECT.*\\+.*input', 'INSERT.*\\$\\{', 'query.*\\+.*req\\.'],
    languages: ['javascript', 'python', 'java'],
    frameworks: [],
    commonCauses: [
      'String concatenation in SQL',
      'Template literals with user input',
      'Missing parameterized queries'
    ],
    relatedPatterns: ['sec_parameterized_queries']
  },
  {
    id: 'sec_xss',
    name: 'Cross-Site Scripting (XSS)',
    description: 'Unsanitized user input in HTML',
    regex: ['innerHTML.*=', 'dangerouslySetInnerHTML', 'document\\.write'],
    languages: ['javascript', 'typescript'],
    frameworks: ['react', 'vue', 'angular'],
    commonCauses: [
      'Using innerHTML with user data',
      'Not sanitizing HTML content',
      'Rendering user input directly'
    ],
    relatedPatterns: ['sec_sanitization']
  }
];

/**
 * Built-in solution templates
 */
const DEFAULT_SOLUTIONS = {
  js_null_reference: [
    {
      id: 'sol_optional_chaining',
      title: 'Use Optional Chaining',
      description: 'Use ?. operator to safely access nested properties',
      steps: [
        'Replace direct property access with optional chaining',
        'Add nullish coalescing for default values',
        'Test with null/undefined values'
      ],
      codeExamples: [{
        incorrect: 'const name = user.profile.name;',
        correct: 'const name = user?.profile?.name ?? "Unknown";'
      }],
      tools: [],
      references: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Optional_chaining']
    }
  ],
  js_unhandled_promise: [
    {
      id: 'sol_catch_handler',
      title: 'Add .catch() Handler',
      description: 'Add error handling to promise chain',
      steps: [
        'Add .catch() at the end of promise chain',
        'Log or handle the error appropriately',
        'Consider adding global unhandledrejection handler'
      ],
      codeExamples: [{
        incorrect: 'fetchData().then(process);',
        correct: 'fetchData().then(process).catch(handleError);'
      }],
      tools: ['eslint-plugin-promise'],
      references: []
    },
    {
      id: 'sol_try_catch_async',
      title: 'Use try-catch with async/await',
      description: 'Wrap async operations in try-catch',
      steps: [
        'Convert to async/await syntax',
        'Wrap await in try-catch block',
        'Handle error in catch block'
      ],
      codeExamples: [{
        incorrect: 'async function load() { const data = await fetch(); }',
        correct: 'async function load() { try { const data = await fetch(); } catch (e) { handleError(e); } }'
      }],
      tools: [],
      references: []
    }
  ],
  config_json_invalid: [
    {
      id: 'sol_json_validate',
      title: 'Validate JSON Syntax',
      description: 'Use JSON validator to find and fix errors',
      steps: [
        'Use online JSON validator or IDE extension',
        'Fix reported syntax errors',
        'Remove trailing commas',
        'Use double quotes for strings and keys'
      ],
      codeExamples: [{
        incorrect: "{ 'name': 'test', }",
        correct: '{ "name": "test" }'
      }],
      tools: ['jsonlint', 'VS Code JSON extension'],
      references: []
    }
  ],
  sec_sql_injection: [
    {
      id: 'sol_parameterized',
      title: 'Use Parameterized Queries',
      description: 'Replace string concatenation with parameters',
      steps: [
        'Identify queries with string concatenation',
        'Replace with parameterized query syntax',
        'Pass user input as separate parameters',
        'Test with malicious input'
      ],
      codeExamples: [{
        incorrect: 'db.query(`SELECT * FROM users WHERE id = ${userId}`)',
        correct: 'db.query("SELECT * FROM users WHERE id = ?", [userId])'
      }],
      tools: ['sqlmap', 'OWASP ZAP'],
      references: ['https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html']
    }
  ]
};

/**
 * Built-in best practice rules
 */
const DEFAULT_BEST_PRACTICES = {
  javascript: [
    {
      id: 'bp_strict_equality',
      name: 'Use strict equality',
      description: 'Always use === instead of ==',
      check: (code) => !code.includes('==') || code.includes('==='),
      fix: 'Replace == with ==='
    },
    {
      id: 'bp_const_let',
      name: 'Use const/let instead of var',
      description: 'Prefer const and let over var',
      check: (code) => !code.includes('var '),
      fix: 'Replace var with const or let'
    },
    {
      id: 'bp_no_console',
      name: 'Remove console statements',
      description: 'Remove console.log in production code',
      check: (code) => !code.includes('console.log'),
      fix: 'Remove or replace with proper logging'
    }
  ],
  typescript: [
    {
      id: 'bp_no_any',
      name: 'Avoid any type',
      description: 'Use specific types instead of any',
      check: (code) => !code.includes(': any'),
      fix: 'Replace any with specific type'
    },
    {
      id: 'bp_strict_null',
      name: 'Enable strict null checks',
      description: 'Use strictNullChecks in tsconfig',
      check: (config) => config?.compilerOptions?.strictNullChecks === true,
      fix: 'Add "strictNullChecks": true to tsconfig.json'
    }
  ],
  python: [
    {
      id: 'bp_type_hints',
      name: 'Use type hints',
      description: 'Add type hints to function signatures',
      check: (code) => code.includes('->') || code.includes(': '),
      fix: 'Add type hints to function parameters and return types'
    }
  ]
};

class KnowledgeBase {
  /**
   * Creates a new KnowledgeBase instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.patterns = [...DEFAULT_PATTERNS, ...(options.customPatterns || [])];
    this.solutions = { ...DEFAULT_SOLUTIONS, ...(options.customSolutions || {}) };
    this.bestPractices = { ...DEFAULT_BEST_PRACTICES, ...(options.customBestPractices || {}) };
  }

  /**
   * Finds matching error patterns
   * @param {Object} error - Error to match
   * @returns {Array} Matching patterns
   */
  findPatterns(error) {
    const matches = [];
    const errorText = `${error.message} ${error.description || ''}`.toLowerCase();
    
    for (const pattern of this.patterns) {
      // Check regex matches
      const regexMatch = pattern.regex.some(r => {
        try {
          return new RegExp(r, 'i').test(errorText);
        } catch {
          return errorText.includes(r.toLowerCase());
        }
      });
      
      if (regexMatch) {
        matches.push({
          ...pattern,
          matchScore: this.calculateMatchScore(error, pattern)
        });
      }
    }
    
    // Sort by match score
    return matches.sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Calculates match score for a pattern
   * @param {Object} error - Error object
   * @param {Object} pattern - Pattern object
   * @returns {number} Match score
   */
  calculateMatchScore(error, pattern) {
    let score = 0;
    
    // Language match
    if (pattern.languages.length === 0 || 
        pattern.languages.includes(error.language)) {
      score += 10;
    }
    
    // Framework match
    if (pattern.frameworks.length === 0 ||
        pattern.frameworks.includes(error.framework)) {
      score += 5;
    }
    
    // Error type match
    if (error.type && pattern.id.includes(error.type.toLowerCase())) {
      score += 5;
    }
    
    return score;
  }

  /**
   * Gets solution templates for an error pattern
   * @param {string} patternId - Error pattern ID
   * @returns {Array} Solution templates
   */
  getSolutions(patternId) {
    return this.solutions[patternId] || [];
  }

  /**
   * Gets solutions for an error
   * @param {Object} error - Error object
   * @returns {Array} Solutions
   */
  getSolutionsForError(error) {
    const patterns = this.findPatterns(error);
    const solutions = [];
    
    for (const pattern of patterns) {
      const patternSolutions = this.getSolutions(pattern.id);
      solutions.push(...patternSolutions.map(s => ({
        ...s,
        patternId: pattern.id,
        patternName: pattern.name
      })));
    }
    
    return solutions;
  }

  /**
   * Gets prevention strategies for an error type
   * @param {string} errorType - Error type
   * @returns {Array} Prevention strategies
   */
  getPreventionStrategies(errorType) {
    const strategies = [];
    
    // Find patterns for this error type
    const typePatterns = this.patterns.filter(p => 
      p.id.includes(errorType.toLowerCase())
    );
    
    for (const pattern of typePatterns) {
      const solutions = this.getSolutions(pattern.id);
      for (const solution of solutions) {
        if (solution.tools?.length > 0) {
          strategies.push({
            title: `Use ${solution.tools.join(', ')}`,
            description: solution.description,
            tools: solution.tools,
            patternId: pattern.id
          });
        }
      }
    }
    
    return strategies;
  }

  /**
   * Gets best practices for a configuration type
   * @param {string} configType - Configuration type (language)
   * @returns {Array} Best practice rules
   */
  getBestPractices(configType) {
    return this.bestPractices[configType] || [];
  }

  /**
   * Checks best practices against code
   * @param {string} code - Code to check
   * @param {string} language - Programming language
   * @returns {Array} Violations
   */
  checkBestPractices(code, language) {
    const practices = this.getBestPractices(language);
    const violations = [];
    
    for (const practice of practices) {
      try {
        if (!practice.check(code)) {
          violations.push({
            rule: practice.id,
            name: practice.name,
            description: practice.description,
            fix: practice.fix
          });
        }
      } catch {
        // Skip if check fails
      }
    }
    
    return violations;
  }

  /**
   * Adds a custom pattern
   * @param {Object} pattern - Pattern to add
   */
  addPattern(pattern) {
    if (!pattern.id || !pattern.name || !pattern.regex) {
      throw new Error('Pattern must have id, name, and regex');
    }
    this.patterns.push(pattern);
  }

  /**
   * Adds a custom solution
   * @param {string} patternId - Pattern ID
   * @param {Object} solution - Solution to add
   */
  addSolution(patternId, solution) {
    if (!this.solutions[patternId]) {
      this.solutions[patternId] = [];
    }
    this.solutions[patternId].push(solution);
  }

  /**
   * Adds a custom best practice
   * @param {string} language - Language
   * @param {Object} practice - Best practice to add
   */
  addBestPractice(language, practice) {
    if (!this.bestPractices[language]) {
      this.bestPractices[language] = [];
    }
    this.bestPractices[language].push(practice);
  }

  /**
   * Gets all patterns
   * @returns {Array} All patterns
   */
  getAllPatterns() {
    return this.patterns;
  }

  /**
   * Gets patterns by language
   * @param {string} language - Language
   * @returns {Array} Patterns for language
   */
  getPatternsByLanguage(language) {
    return this.patterns.filter(p => 
      p.languages.length === 0 || p.languages.includes(language)
    );
  }

  /**
   * Searches patterns by keyword
   * @param {string} keyword - Search keyword
   * @returns {Array} Matching patterns
   */
  searchPatterns(keyword) {
    const lower = keyword.toLowerCase();
    return this.patterns.filter(p =>
      p.name.toLowerCase().includes(lower) ||
      p.description.toLowerCase().includes(lower) ||
      p.commonCauses.some(c => c.toLowerCase().includes(lower))
    );
  }

  /**
   * Exports knowledge base data
   * @returns {Object} Exported data
   */
  exportData() {
    return {
      patterns: this.patterns,
      solutions: this.solutions,
      bestPractices: this.bestPractices,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Imports knowledge base data
   * @param {Object} data - Data to import
   * @param {boolean} merge - Whether to merge with existing
   */
  importData(data, merge = true) {
    if (merge) {
      if (data.patterns) {
        this.patterns = [...this.patterns, ...data.patterns];
      }
      if (data.solutions) {
        this.solutions = { ...this.solutions, ...data.solutions };
      }
      if (data.bestPractices) {
        this.bestPractices = { ...this.bestPractices, ...data.bestPractices };
      }
    } else {
      if (data.patterns) this.patterns = data.patterns;
      if (data.solutions) this.solutions = data.solutions;
      if (data.bestPractices) this.bestPractices = data.bestPractices;
    }
  }
}

module.exports = KnowledgeBase;
