/**
 * Syntax Analyzer
 * 
 * Analyzes code for syntax errors across multiple languages.
 * Supports JavaScript, TypeScript, Python, and Java syntax analysis.
 * 
 * @module error-detection/analyzers/SyntaxAnalyzer
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
 * Common syntax error patterns for different languages
 */
const SYNTAX_PATTERNS = {
  javascript: [
    {
      name: 'missing_semicolon',
      pattern: /^.*[^;{}\s]$/m,
      message: 'Possible missing semicolon',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'unclosed_bracket',
      pattern: /[\[{(][^}\])]*([\n]|$)/,
      message: 'Unclosed bracket detected',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'unclosed_string',
      pattern: /(['"`])(?:(?!\1)[^\\]|\\.)*$/m,
      message: 'Unclosed string literal',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'invalid_assignment',
      pattern: /\bif\s*\([^=]*=[^=][^)]*\)/,
      message: 'Assignment in condition (use === for comparison)',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'duplicate_key',
      pattern: /(['"]?)(\w+)\1\s*:\s*[^,}]+,\s*\1\2\1\s*:/,
      message: 'Duplicate object key',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'trailing_comma_json',
      pattern: /,\s*[}\]]/,
      message: 'Trailing comma (invalid in JSON)',
      severity: ErrorSeverity.MINOR
    }
  ],
  typescript: [
    {
      name: 'missing_type_annotation',
      pattern: /function\s+\w+\s*\([^)]*\)\s*{/,
      message: 'Function missing return type annotation',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'any_type_usage',
      pattern: /:\s*any\b/,
      message: 'Usage of "any" type reduces type safety',
      severity: ErrorSeverity.MINOR
    }
  ],
  python: [
    {
      name: 'indentation_error',
      pattern: /^( {1,3}|\t+ +| +\t+)\S/m,
      message: 'Inconsistent indentation',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'missing_colon',
      pattern: /\b(if|elif|else|for|while|def|class|try|except|finally|with)\b[^:]*$/m,
      message: 'Missing colon after statement',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'print_statement',
      pattern: /\bprint\s+[^(]/,
      message: 'Python 2 print statement (use print() function)',
      severity: ErrorSeverity.MAJOR
    }
  ],
  java: [
    {
      name: 'missing_semicolon',
      pattern: /[^;{}\s]\s*$/m,
      message: 'Missing semicolon',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'unclosed_brace',
      pattern: /\{[^}]*$/,
      message: 'Unclosed brace',
      severity: ErrorSeverity.MAJOR
    }
  ],
  json: [
    {
      name: 'trailing_comma',
      pattern: /,\s*[}\]]/,
      message: 'Trailing comma in JSON',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'single_quotes',
      pattern: /'[^']*'/,
      message: 'Single quotes not allowed in JSON (use double quotes)',
      severity: ErrorSeverity.MAJOR
    },
    {
      name: 'unquoted_key',
      pattern: /{\s*\w+\s*:/,
      message: 'Unquoted key in JSON',
      severity: ErrorSeverity.MAJOR
    }
  ]
};

/**
 * Resolution templates for common syntax errors
 */
const RESOLUTION_TEMPLATES = {
  missing_semicolon: {
    title: 'Add missing semicolon',
    description: 'Add a semicolon at the end of the statement',
    steps: [
      { order: 1, description: 'Locate the line with the missing semicolon' },
      { order: 2, description: 'Add a semicolon (;) at the end of the statement' },
      { order: 3, description: 'Save the file and verify no new errors appear' }
    ],
    difficulty: 'easy',
    estimatedTime: 1
  },
  unclosed_bracket: {
    title: 'Close unclosed bracket',
    description: 'Find and close the unclosed bracket',
    steps: [
      { order: 1, description: 'Identify the type of bracket that is unclosed' },
      { order: 2, description: 'Find the matching opening bracket' },
      { order: 3, description: 'Add the closing bracket at the appropriate location' },
      { order: 4, description: 'Verify bracket matching with editor highlighting' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  },
  unclosed_string: {
    title: 'Close unclosed string',
    description: 'Add the missing closing quote to the string literal',
    steps: [
      { order: 1, description: 'Identify the type of quote used (single, double, or backtick)' },
      { order: 2, description: 'Find where the string should end' },
      { order: 3, description: 'Add the matching closing quote' }
    ],
    difficulty: 'easy',
    estimatedTime: 1
  },
  invalid_assignment: {
    title: 'Fix assignment in condition',
    description: 'Replace assignment operator with comparison operator',
    steps: [
      { order: 1, description: 'Locate the condition with assignment' },
      { order: 2, description: 'Replace = with === (strict equality) or == (loose equality)' },
      { order: 3, description: 'If assignment was intentional, wrap in parentheses: if ((x = value))' }
    ],
    difficulty: 'easy',
    estimatedTime: 1
  },
  indentation_error: {
    title: 'Fix indentation',
    description: 'Correct the inconsistent indentation',
    steps: [
      { order: 1, description: 'Choose a consistent indentation style (spaces or tabs)' },
      { order: 2, description: 'Configure your editor to use consistent indentation' },
      { order: 3, description: 'Re-indent the affected lines' },
      { order: 4, description: 'Use an auto-formatter like Black for Python' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  }
};

class SyntaxAnalyzer {
  /**
   * Creates a new SyntaxAnalyzer instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.patterns = { ...SYNTAX_PATTERNS, ...options.customPatterns };
    this.resolutionTemplates = { ...RESOLUTION_TEMPLATES, ...options.customResolutions };
  }

  /**
   * Gets supported file types
   * @returns {string[]} Array of file extensions
   */
  getSupportedFileTypes() {
    return ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.json'];
  }

  /**
   * Gets error categories this analyzer can detect
   * @returns {string[]} Array of error categories
   */
  getErrorCategories() {
    return [ErrorCategory.HIGH, ErrorCategory.MEDIUM, ErrorCategory.LOW];
  }

  /**
   * Analyzes content for syntax errors
   * @param {string} content - File content
   * @param {string} filePath - Path to file
   * @param {string} language - Programming language
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(content, filePath, language) {
    const errors = [];
    const warnings = [];
    
    if (!language || !this.patterns[language]) {
      return { errors, warnings };
    }
    
    const patterns = this.patterns[language];
    const lines = content.split('\n');
    
    for (const patternDef of patterns) {
      const matches = this.findPatternMatches(content, lines, patternDef);
      
      for (const match of matches) {
        const error = this.createSyntaxError(match, patternDef, filePath, language);
        
        if (patternDef.severity === ErrorSeverity.MINOR) {
          warnings.push(error);
        } else {
          errors.push(error);
        }
      }
    }
    
    // Additional bracket matching analysis
    const bracketErrors = this.analyzeBracketMatching(content, filePath, language);
    errors.push(...bracketErrors);
    
    return { errors, warnings };
  }

  /**
   * Finds all matches for a pattern in content
   * @param {string} content - Full content
   * @param {string[]} lines - Content split by lines
   * @param {Object} patternDef - Pattern definition
   * @returns {Array} Array of matches with location info
   */
  findPatternMatches(content, lines, patternDef) {
    const matches = [];
    const regex = new RegExp(patternDef.pattern, 'gm');
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      const lineNumber = this.getLineNumber(content, match.index);
      const column = this.getColumn(content, match.index);
      const context = lines[lineNumber - 1] || '';
      
      matches.push({
        text: match[0],
        index: match.index,
        line: lineNumber,
        column,
        context
      });
    }
    
    return matches;
  }

  /**
   * Gets line number for a position in content
   * @param {string} content - Content string
   * @param {number} index - Character index
   * @returns {number} Line number (1-based)
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Gets column number for a position in content
   * @param {string} content - Content string
   * @param {number} index - Character index
   * @returns {number} Column number (1-based)
   */
  getColumn(content, index) {
    const lastNewline = content.lastIndexOf('\n', index - 1);
    return index - lastNewline;
  }

  /**
   * Creates a syntax error object
   * @param {Object} match - Pattern match
   * @param {Object} patternDef - Pattern definition
   * @param {string} filePath - File path
   * @param {string} language - Language
   * @returns {Object} Detected error
   */
  createSyntaxError(match, patternDef, filePath, language) {
    const location = createErrorLocation({
      filePath,
      line: match.line,
      column: match.column,
      startOffset: match.index,
      endOffset: match.index + match.text.length,
      context: match.context
    });
    
    const resolution = this.getResolution(patternDef.name);
    const example = this.getCodeExample(patternDef.name, language);
    
    return createDetectedError({
      id: `syntax_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.SYNTAX,
      category: this.severityToCategory(patternDef.severity),
      severity: patternDef.severity,
      message: patternDef.message,
      description: `Syntax error detected: ${patternDef.message}. Found "${match.text.substring(0, 50)}${match.text.length > 50 ? '...' : ''}"`,
      location,
      causes: this.getCauses(patternDef.name),
      resolutions: resolution ? [resolution] : [],
      preventionStrategies: this.getPreventionStrategies(patternDef.name, language),
      examples: example ? [example] : []
    });
  }

  /**
   * Converts severity to category
   * @param {string} severity - Error severity
   * @returns {string} Error category
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
   * Gets resolution for an error type
   * @param {string} errorName - Error name
   * @returns {Object|null} Resolution object
   */
  getResolution(errorName) {
    const template = this.resolutionTemplates[errorName];
    if (!template) return null;
    
    return createResolution({
      id: `res_${errorName}`,
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
   * @returns {string[]} Array of causes
   */
  getCauses(errorName) {
    const causes = {
      missing_semicolon: [
        'Forgot to add semicolon at end of statement',
        'Copy-pasted code without proper formatting',
        'Automatic semicolon insertion (ASI) confusion'
      ],
      unclosed_bracket: [
        'Forgot to close bracket after opening',
        'Deleted closing bracket accidentally',
        'Mismatched bracket types'
      ],
      unclosed_string: [
        'Forgot closing quote',
        'Used wrong quote type',
        'String contains unescaped quote character'
      ],
      invalid_assignment: [
        'Typo: used = instead of ==',
        'Confusion between assignment and comparison',
        'Copy-paste error'
      ],
      indentation_error: [
        'Mixed tabs and spaces',
        'Inconsistent indentation level',
        'Editor auto-indent misconfiguration'
      ]
    };
    
    return causes[errorName] || ['Unknown cause'];
  }

  /**
   * Gets code example for an error type
   * @param {string} errorName - Error name
   * @param {string} language - Language
   * @returns {Object|null} Code example
   */
  getCodeExample(errorName, language) {
    const examples = {
      missing_semicolon: {
        incorrect: 'const x = 5\nconst y = 10',
        correct: 'const x = 5;\nconst y = 10;',
        explanation: 'Add semicolons at the end of each statement'
      },
      unclosed_bracket: {
        incorrect: 'function test() {\n  console.log("test")\n',
        correct: 'function test() {\n  console.log("test");\n}',
        explanation: 'Ensure all opening brackets have matching closing brackets'
      },
      invalid_assignment: {
        incorrect: 'if (x = 5) { ... }',
        correct: 'if (x === 5) { ... }',
        explanation: 'Use === for comparison, = is for assignment'
      },
      indentation_error: {
        incorrect: 'def test():\n   print("mixed")\n\tprint("indentation")',
        correct: 'def test():\n    print("consistent")\n    print("indentation")',
        explanation: 'Use consistent indentation (4 spaces recommended for Python)'
      }
    };
    
    const example = examples[errorName];
    if (!example) return null;
    
    return createCodeExample(example);
  }

  /**
   * Gets prevention strategies for an error type
   * @param {string} errorName - Error name
   * @param {string} language - Language
   * @returns {Array} Prevention strategies
   */
  getPreventionStrategies(errorName, language) {
    const strategies = {
      missing_semicolon: [
        {
          id: 'eslint_semi',
          title: 'Enable ESLint semi rule',
          description: 'Configure ESLint to enforce semicolons',
          tools: ['ESLint'],
          steps: ['Install ESLint', 'Add "semi": ["error", "always"] to rules'],
          configExample: '{ "rules": { "semi": ["error", "always"] } }'
        }
      ],
      unclosed_bracket: [
        {
          id: 'editor_matching',
          title: 'Enable bracket matching',
          description: 'Use editor bracket matching and highlighting',
          tools: ['VS Code', 'WebStorm'],
          steps: ['Enable bracket pair colorization', 'Use bracket matching shortcuts']
        }
      ],
      indentation_error: [
        {
          id: 'editorconfig',
          title: 'Use EditorConfig',
          description: 'Configure consistent indentation across editors',
          tools: ['EditorConfig'],
          steps: ['Create .editorconfig file', 'Set indent_style and indent_size'],
          configExample: '[*.py]\nindent_style = space\nindent_size = 4'
        }
      ]
    };
    
    return strategies[errorName] || [];
  }

  /**
   * Analyzes bracket matching in content
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @param {string} language - Language
   * @returns {Array} Bracket errors
   */
  analyzeBracketMatching(content, filePath, language) {
    const errors = [];
    const brackets = { '(': ')', '[': ']', '{': '}' };
    const stack = [];
    const lines = content.split('\n');
    
    let inString = false;
    let stringChar = null;
    let inComment = false;
    let inMultilineComment = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const prevChar = i > 0 ? content[i - 1] : '';
      const nextChar = i < content.length - 1 ? content[i + 1] : '';
      
      // Handle string detection
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = null;
        }
        continue;
      }
      
      // Skip if in string
      if (inString) continue;
      
      // Handle comments
      if (char === '/' && nextChar === '/') {
        inComment = true;
        continue;
      }
      if (char === '\n' && inComment) {
        inComment = false;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inMultilineComment = true;
        continue;
      }
      if (char === '*' && nextChar === '/') {
        inMultilineComment = false;
        i++;
        continue;
      }
      
      // Skip if in comment
      if (inComment || inMultilineComment) continue;
      
      // Check brackets
      if (brackets[char]) {
        stack.push({ char, index: i, line: this.getLineNumber(content, i) });
      } else if (Object.values(brackets).includes(char)) {
        const expected = Object.entries(brackets).find(([, v]) => v === char)?.[0];
        
        if (stack.length === 0) {
          errors.push(this.createBracketError(
            `Unexpected closing bracket '${char}'`,
            filePath,
            this.getLineNumber(content, i),
            this.getColumn(content, i),
            lines[this.getLineNumber(content, i) - 1] || ''
          ));
        } else {
          const last = stack.pop();
          if (brackets[last.char] !== char) {
            errors.push(this.createBracketError(
              `Mismatched brackets: expected '${brackets[last.char]}' but found '${char}'`,
              filePath,
              this.getLineNumber(content, i),
              this.getColumn(content, i),
              lines[this.getLineNumber(content, i) - 1] || ''
            ));
          }
        }
      }
    }
    
    // Check for unclosed brackets
    for (const unclosed of stack) {
      errors.push(this.createBracketError(
        `Unclosed bracket '${unclosed.char}'`,
        filePath,
        unclosed.line,
        1,
        lines[unclosed.line - 1] || ''
      ));
    }
    
    return errors;
  }

  /**
   * Creates a bracket error
   * @param {string} message - Error message
   * @param {string} filePath - File path
   * @param {number} line - Line number
   * @param {number} column - Column number
   * @param {string} context - Code context
   * @returns {Object} Detected error
   */
  createBracketError(message, filePath, line, column, context) {
    return createDetectedError({
      id: `bracket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.SYNTAX,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR,
      message,
      description: `Bracket matching error: ${message}`,
      location: createErrorLocation({ filePath, line, column, context }),
      causes: ['Mismatched or missing brackets', 'Incomplete code block'],
      resolutions: [this.getResolution('unclosed_bracket')].filter(Boolean),
      preventionStrategies: this.getPreventionStrategies('unclosed_bracket'),
      examples: []
    });
  }
}

module.exports = SyntaxAnalyzer;
