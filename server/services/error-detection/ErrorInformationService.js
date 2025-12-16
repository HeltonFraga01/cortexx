/**
 * Error Information Service
 * 
 * Provides detailed error descriptions, code examples, cause analysis,
 * and diagnostic steps for detected errors.
 * 
 * @module error-detection/ErrorInformationService
 */

const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  createCodeExample,
  createResolutionStep
} = require('./types');

/**
 * Error description templates
 */
const ERROR_DESCRIPTIONS = {
  [ErrorType.SYNTAX]: {
    title: 'Syntax Error',
    description: 'A syntax error occurs when code violates the grammatical rules of the programming language.',
    commonCauses: [
      'Missing or mismatched brackets, parentheses, or braces',
      'Missing semicolons or commas',
      'Unclosed string literals',
      'Invalid variable names or keywords',
      'Incorrect indentation (Python)'
    ]
  },
  [ErrorType.RUNTIME]: {
    title: 'Runtime Error',
    description: 'A runtime error occurs during program execution when an operation cannot be completed.',
    commonCauses: [
      'Null or undefined reference access',
      'Division by zero',
      'Array index out of bounds',
      'Type mismatch during operations',
      'Unhandled promise rejections'
    ]
  },
  [ErrorType.LOGICAL]: {
    title: 'Logical Error',
    description: 'A logical error occurs when code runs without crashing but produces incorrect results.',
    commonCauses: [
      'Incorrect algorithm implementation',
      'Off-by-one errors in loops',
      'Wrong comparison operators',
      'Incorrect boolean logic',
      'Race conditions in async code'
    ]
  },
  [ErrorType.CONFIGURATION]: {
    title: 'Configuration Error',
    description: 'A configuration error occurs when settings or configuration files are invalid or incomplete.',
    commonCauses: [
      'Missing required configuration fields',
      'Invalid JSON/YAML syntax',
      'Wrong data types for configuration values',
      'Incompatible version specifications',
      'Missing environment variables'
    ]
  },
  [ErrorType.SECURITY]: {
    title: 'Security Vulnerability',
    description: 'A security vulnerability is a weakness that could be exploited to compromise the system.',
    commonCauses: [
      'SQL injection vulnerabilities',
      'Cross-site scripting (XSS)',
      'Insecure direct object references',
      'Hardcoded credentials',
      'Missing input validation'
    ]
  },
  [ErrorType.PERFORMANCE]: {
    title: 'Performance Issue',
    description: 'A performance issue is code that runs slower than necessary or uses excessive resources.',
    commonCauses: [
      'Nested loops with high complexity',
      'Unnecessary DOM manipulations',
      'Memory leaks from uncleaned resources',
      'Synchronous operations blocking event loop',
      'Inefficient database queries'
    ]
  }
};

/**
 * Code example templates by error pattern
 */
const CODE_EXAMPLES = {
  null_reference: {
    javascript: {
      incorrect: `// Accessing property without null check
const user = getUser();
const name = user.profile.name; // TypeError if user is null`,
      correct: `// Using optional chaining
const user = getUser();
const name = user?.profile?.name ?? 'Unknown';

// Or explicit null check
if (user && user.profile) {
  const name = user.profile.name;
}`,
      explanation: 'Always check for null/undefined before accessing nested properties. Use optional chaining (?.) or explicit checks.'
    },
    python: {
      incorrect: `# Accessing attribute without check
user = get_user()
name = user.profile.name  # AttributeError if user is None`,
      correct: `# Using getattr with default
user = get_user()
name = getattr(getattr(user, 'profile', None), 'name', 'Unknown')

# Or explicit check
if user and hasattr(user, 'profile'):
    name = user.profile.name`,
      explanation: 'Check for None before accessing attributes. Use getattr() with defaults or explicit checks.'
    }
  },
  unhandled_promise: {
    javascript: {
      incorrect: `// Promise without error handling
fetchData()
  .then(data => processData(data));
// Errors silently ignored`,
      correct: `// With .catch() handler
fetchData()
  .then(data => processData(data))
  .catch(error => {
    console.error('Failed to fetch:', error);
    showErrorMessage(error);
  });

// Or with async/await
async function loadData() {
  try {
    const data = await fetchData();
    return processData(data);
  } catch (error) {
    console.error('Failed to fetch:', error);
    throw error;
  }
}`,
      explanation: 'Always handle promise rejections with .catch() or try-catch around await.'
    }
  },
  missing_semicolon: {
    javascript: {
      incorrect: `const x = 5
const y = 10
function test() {
  return x + y
}`,
      correct: `const x = 5;
const y = 10;
function test() {
  return x + y;
}`,
      explanation: 'Add semicolons at the end of statements to avoid automatic semicolon insertion issues.'
    }
  },
  unclosed_bracket: {
    javascript: {
      incorrect: `function processData(data) {
  if (data.valid) {
    return data.value
  // Missing closing brace`,
      correct: `function processData(data) {
  if (data.valid) {
    return data.value;
  }
}`,
      explanation: 'Ensure all opening brackets have matching closing brackets.'
    }
  },
  eval_usage: {
    javascript: {
      incorrect: `// Dangerous: executing arbitrary code
const result = eval(userInput);`,
      correct: `// For JSON parsing
const result = JSON.parse(userInput);

// For math expressions, use a safe parser
const mathResult = safeEval(expression);

// Or refactor to avoid dynamic code
const operations = {
  add: (a, b) => a + b,
  subtract: (a, b) => a - b
};
const result = operations[operation](a, b);`,
      explanation: 'Never use eval() with user input. Use JSON.parse() for JSON, or refactor to avoid dynamic code execution.'
    }
  },
  sql_injection: {
    javascript: {
      incorrect: `// Vulnerable to SQL injection
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
db.query(query);`,
      correct: `// Using parameterized queries
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// Or with named parameters
const query = 'SELECT * FROM users WHERE id = :userId';
db.query(query, { userId });`,
      explanation: 'Always use parameterized queries to prevent SQL injection attacks.'
    }
  }
};

/**
 * Diagnostic steps for multi-cause errors
 */
const DIAGNOSTIC_STEPS = {
  null_reference: [
    { step: 1, action: 'Check if the variable is being initialized', question: 'Is the variable assigned a value before use?' },
    { step: 2, action: 'Verify API response structure', question: 'Does the API always return the expected data structure?' },
    { step: 3, action: 'Check for race conditions', question: 'Could the data be accessed before it is loaded?' },
    { step: 4, action: 'Review error handling', question: 'Are errors from data fetching properly handled?' },
    { step: 5, action: 'Add defensive checks', question: 'Should optional chaining or null checks be added?' }
  ],
  unhandled_promise: [
    { step: 1, action: 'Identify the promise source', question: 'Where is the promise created?' },
    { step: 2, action: 'Check for .catch() handler', question: 'Is there a .catch() in the promise chain?' },
    { step: 3, action: 'Review async/await usage', question: 'Is the await wrapped in try-catch?' },
    { step: 4, action: 'Check global error handlers', question: 'Is there a global unhandledrejection handler?' },
    { step: 5, action: 'Add appropriate error handling', question: 'What should happen when the promise fails?' }
  ],
  performance_issue: [
    { step: 1, action: 'Profile the code', question: 'Which function is taking the most time?' },
    { step: 2, action: 'Check algorithm complexity', question: 'What is the Big O complexity of the code?' },
    { step: 3, action: 'Review loop operations', question: 'Are there unnecessary operations inside loops?' },
    { step: 4, action: 'Check for memory leaks', question: 'Are resources being properly cleaned up?' },
    { step: 5, action: 'Consider caching', question: 'Can results be cached to avoid repeated computation?' }
  ],
  configuration_error: [
    { step: 1, action: 'Validate file syntax', question: 'Is the configuration file valid JSON/YAML?' },
    { step: 2, action: 'Check required fields', question: 'Are all required fields present?' },
    { step: 3, action: 'Verify field types', question: 'Do field values have the correct types?' },
    { step: 4, action: 'Check environment variables', question: 'Are referenced environment variables set?' },
    { step: 5, action: 'Review documentation', question: 'Does the configuration match the expected schema?' }
  ]
};

class ErrorInformationService {
  /**
   * Creates a new ErrorInformationService instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.descriptions = { ...ERROR_DESCRIPTIONS, ...options.customDescriptions };
    this.codeExamples = { ...CODE_EXAMPLES, ...options.customExamples };
    this.diagnosticSteps = { ...DIAGNOSTIC_STEPS, ...options.customDiagnostics };
  }

  /**
   * Gets detailed description for an error type
   * @param {string} errorType - Error type
   * @returns {Object} Error description
   */
  getErrorDescription(errorType) {
    return this.descriptions[errorType] || {
      title: 'Unknown Error',
      description: 'An unknown error occurred.',
      commonCauses: ['Unknown cause']
    };
  }

  /**
   * Generates a detailed error explanation
   * @param {Object} error - Detected error
   * @returns {Object} Detailed explanation
   */
  generateExplanation(error) {
    const typeInfo = this.getErrorDescription(error.type);
    
    return {
      title: typeInfo.title,
      summary: error.message,
      description: error.description || typeInfo.description,
      location: this.formatLocation(error.location),
      causes: error.causes?.length > 0 ? error.causes : typeInfo.commonCauses,
      impact: this.assessImpact(error),
      urgency: this.assessUrgency(error)
    };
  }

  /**
   * Formats error location for display
   * @param {Object} location - Error location
   * @returns {string} Formatted location
   */
  formatLocation(location) {
    if (!location) return 'Unknown location';
    
    const { filePath, line, column, context } = location;
    let formatted = `${filePath}:${line}:${column}`;
    
    if (context) {
      formatted += `\n  > ${context.trim()}`;
    }
    
    return formatted;
  }

  /**
   * Assesses the impact of an error
   * @param {Object} error - Detected error
   * @returns {string} Impact assessment
   */
  assessImpact(error) {
    switch (error.severity) {
      case ErrorSeverity.BLOCKER:
        return 'Critical: Application cannot function';
      case ErrorSeverity.CRITICAL:
        return 'High: Major functionality affected';
      case ErrorSeverity.MAJOR:
        return 'Medium: Some functionality affected';
      case ErrorSeverity.MINOR:
        return 'Low: Minor inconvenience';
      default:
        return 'Minimal: Cosmetic or informational';
    }
  }

  /**
   * Assesses the urgency of fixing an error
   * @param {Object} error - Detected error
   * @returns {string} Urgency assessment
   */
  assessUrgency(error) {
    if (error.type === ErrorType.SECURITY) {
      return 'Immediate: Security vulnerabilities should be fixed immediately';
    }
    
    switch (error.category) {
      case ErrorCategory.CRITICAL:
        return 'Immediate: Fix before deployment';
      case ErrorCategory.HIGH:
        return 'High: Fix within current sprint';
      case ErrorCategory.MEDIUM:
        return 'Medium: Plan for upcoming sprint';
      case ErrorCategory.LOW:
        return 'Low: Address when convenient';
      default:
        return 'Optional: Consider for future improvement';
    }
  }

  /**
   * Gets code examples for an error pattern
   * @param {string} errorPattern - Error pattern name
   * @param {string} language - Programming language
   * @returns {Object|null} Code example
   */
  getCodeExample(errorPattern, language = 'javascript') {
    const examples = this.codeExamples[errorPattern];
    if (!examples) return null;
    
    const langExample = examples[language] || examples.javascript;
    if (!langExample) return null;
    
    return createCodeExample({
      incorrect: langExample.incorrect,
      correct: langExample.correct,
      explanation: langExample.explanation
    });
  }

  /**
   * Gets all code examples for an error
   * @param {Object} error - Detected error
   * @param {string} language - Programming language
   * @returns {Array} Code examples
   */
  getCodeExamplesForError(error, language = 'javascript') {
    const examples = [];
    
    // Get examples from error itself
    if (error.examples?.length > 0) {
      examples.push(...error.examples);
    }
    
    // Try to find pattern-based examples
    const patternName = this.extractPatternName(error);
    if (patternName) {
      const patternExample = this.getCodeExample(patternName, language);
      if (patternExample) {
        examples.push(patternExample);
      }
    }
    
    return examples;
  }

  /**
   * Extracts pattern name from error
   * @param {Object} error - Detected error
   * @returns {string|null} Pattern name
   */
  extractPatternName(error) {
    // Try to extract from error ID
    if (error.id) {
      const match = error.id.match(/^(\w+)_/);
      if (match) return match[1];
    }
    
    // Try to infer from message
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('null') || message.includes('undefined')) {
      return 'null_reference';
    }
    if (message.includes('promise') || message.includes('unhandled')) {
      return 'unhandled_promise';
    }
    if (message.includes('semicolon')) {
      return 'missing_semicolon';
    }
    if (message.includes('bracket') || message.includes('brace')) {
      return 'unclosed_bracket';
    }
    if (message.includes('eval')) {
      return 'eval_usage';
    }
    if (message.includes('sql') || message.includes('injection')) {
      return 'sql_injection';
    }
    
    return null;
  }

  /**
   * Gets diagnostic steps for an error
   * @param {Object} error - Detected error
   * @returns {Array} Diagnostic steps
   */
  getDiagnosticSteps(error) {
    const patternName = this.extractPatternName(error);
    
    if (patternName && this.diagnosticSteps[patternName]) {
      return this.diagnosticSteps[patternName];
    }
    
    // Return generic diagnostic steps based on error type
    switch (error.type) {
      case ErrorType.RUNTIME:
        return this.diagnosticSteps.null_reference || [];
      case ErrorType.CONFIGURATION:
        return this.diagnosticSteps.configuration_error || [];
      case ErrorType.PERFORMANCE:
        return this.diagnosticSteps.performance_issue || [];
      default:
        return this.getGenericDiagnosticSteps(error);
    }
  }

  /**
   * Gets generic diagnostic steps
   * @param {Object} error - Detected error
   * @returns {Array} Generic diagnostic steps
   */
  getGenericDiagnosticSteps(error) {
    return [
      { step: 1, action: 'Reproduce the error', question: 'Can you consistently reproduce this error?' },
      { step: 2, action: 'Check the error location', question: 'Is the error at the reported line and column?' },
      { step: 3, action: 'Review recent changes', question: 'What changed recently that might have caused this?' },
      { step: 4, action: 'Check dependencies', question: 'Are all dependencies up to date and compatible?' },
      { step: 5, action: 'Apply the suggested fix', question: 'Does the suggested resolution fix the issue?' }
    ];
  }

  /**
   * Generates a complete error information package
   * @param {Object} error - Detected error
   * @param {string} language - Programming language
   * @returns {Object} Complete error information
   */
  generateCompleteInfo(error, language = 'javascript') {
    return {
      explanation: this.generateExplanation(error),
      examples: this.getCodeExamplesForError(error, language),
      diagnosticSteps: this.getDiagnosticSteps(error),
      resolutions: error.resolutions || [],
      preventionStrategies: error.preventionStrategies || [],
      relatedErrors: this.findRelatedErrors(error)
    };
  }

  /**
   * Finds related error patterns
   * @param {Object} error - Detected error
   * @returns {Array} Related error patterns
   */
  findRelatedErrors(error) {
    const related = [];
    
    // Find errors of the same type
    if (error.type === ErrorType.RUNTIME) {
      related.push(
        { pattern: 'null_reference', description: 'Null/undefined reference errors' },
        { pattern: 'unhandled_promise', description: 'Unhandled promise rejections' }
      );
    }
    
    if (error.type === ErrorType.SYNTAX) {
      related.push(
        { pattern: 'missing_semicolon', description: 'Missing semicolons' },
        { pattern: 'unclosed_bracket', description: 'Unclosed brackets' }
      );
    }
    
    return related;
  }
}

module.exports = ErrorInformationService;
