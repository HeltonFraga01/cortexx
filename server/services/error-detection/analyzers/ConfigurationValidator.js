/**
 * Configuration Validator
 * 
 * Validates configuration files against schemas and best practices.
 * Supports JSON, YAML, and TOML configuration files.
 * 
 * @module error-detection/analyzers/ConfigurationValidator
 */

const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  createDetectedError,
  createErrorLocation,
  createCodeExample,
  createResolution,
  createResolutionStep,
  createPreventionStrategy
} = require('../types');

/**
 * Common configuration schemas
 */
const CONFIG_SCHEMAS = {
  'package.json': {
    required: ['name', 'version'],
    recommended: ['description', 'main', 'scripts', 'dependencies'],
    types: {
      name: 'string',
      version: 'string',
      description: 'string',
      main: 'string',
      scripts: 'object',
      dependencies: 'object',
      devDependencies: 'object'
    }
  },
  'tsconfig.json': {
    required: ['compilerOptions'],
    recommended: ['include', 'exclude'],
    types: {
      compilerOptions: 'object',
      include: 'array',
      exclude: 'array'
    }
  },
  '.eslintrc.json': {
    required: [],
    recommended: ['rules', 'extends'],
    types: {
      rules: 'object',
      extends: ['string', 'array'],
      plugins: 'array',
      env: 'object'
    }
  },
  '.env': {
    format: 'env',
    patterns: {
      valid_key: /^[A-Z][A-Z0-9_]*$/,
      valid_line: /^[A-Z][A-Z0-9_]*=.*/
    }
  }
};

/**
 * Best practice rules for different config types
 */
const BEST_PRACTICES = {
  'package.json': [
    {
      name: 'has_license',
      check: (config) => !!config.license,
      message: 'Missing license field',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'has_repository',
      check: (config) => !!config.repository,
      message: 'Missing repository field',
      severity: ErrorSeverity.TRIVIAL
    },
    {
      name: 'has_engines',
      check: (config) => !!config.engines,
      message: 'Missing engines field (Node.js version)',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'no_exact_versions',
      check: (config) => {
        const deps = { ...config.dependencies, ...config.devDependencies };
        return !Object.values(deps).some(v => /^\d+\.\d+\.\d+$/.test(v));
      },
      message: 'Using exact versions instead of ranges',
      severity: ErrorSeverity.TRIVIAL
    },
    {
      name: 'no_deprecated_deps',
      check: (config) => {
        const deprecated = ['request', 'node-uuid', 'colors'];
        const deps = Object.keys({ ...config.dependencies, ...config.devDependencies });
        return !deps.some(d => deprecated.includes(d));
      },
      message: 'Using deprecated dependencies',
      severity: ErrorSeverity.MAJOR
    }
  ],
  'tsconfig.json': [
    {
      name: 'strict_mode',
      check: (config) => config.compilerOptions?.strict === true,
      message: 'TypeScript strict mode not enabled',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'no_implicit_any',
      check: (config) => config.compilerOptions?.noImplicitAny !== false,
      message: 'noImplicitAny is disabled',
      severity: ErrorSeverity.MINOR
    },
    {
      name: 'skip_lib_check',
      check: (config) => config.compilerOptions?.skipLibCheck === true,
      message: 'skipLibCheck not enabled (slower builds)',
      severity: ErrorSeverity.TRIVIAL
    }
  ],
  '.env': [
    {
      name: 'no_secrets_in_env',
      check: (content) => {
        const secretPatterns = [
          /password\s*=\s*[^\s]+/i,
          /secret\s*=\s*[^\s]+/i,
          /api_key\s*=\s*[^\s]+/i,
          /private_key\s*=\s*[^\s]+/i
        ];
        return !secretPatterns.some(p => p.test(content));
      },
      message: 'Potential secrets in .env file',
      severity: ErrorSeverity.CRITICAL
    }
  ]
};

/**
 * Resolution templates for configuration errors
 */
const RESOLUTION_TEMPLATES = {
  missing_required_field: {
    title: 'Add required field',
    description: 'Add the missing required field to the configuration',
    steps: [
      { order: 1, description: 'Open the configuration file' },
      { order: 2, description: 'Add the missing field with appropriate value' },
      { order: 3, description: 'Validate the configuration' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  },
  invalid_json: {
    title: 'Fix JSON syntax',
    description: 'Correct the JSON syntax error',
    steps: [
      { order: 1, description: 'Use a JSON validator to identify the exact error' },
      { order: 2, description: 'Fix the syntax issue (missing comma, bracket, etc.)' },
      { order: 3, description: 'Validate the JSON is now valid' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  },
  type_mismatch: {
    title: 'Fix field type',
    description: 'Change the field value to the correct type',
    steps: [
      { order: 1, description: 'Identify the expected type for the field' },
      { order: 2, description: 'Update the value to match the expected type' },
      { order: 3, description: 'Validate the configuration' }
    ],
    difficulty: 'easy',
    estimatedTime: 2
  },
  strict_mode: {
    title: 'Enable TypeScript strict mode',
    description: 'Enable strict mode for better type safety',
    steps: [
      { order: 1, description: 'Open tsconfig.json' },
      { order: 2, description: 'Add "strict": true to compilerOptions' },
      { order: 3, description: 'Fix any type errors that appear' }
    ],
    difficulty: 'medium',
    estimatedTime: 30
  }
};

class ConfigurationValidator {
  /**
   * Creates a new ConfigurationValidator instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.schemas = { ...CONFIG_SCHEMAS, ...options.customSchemas };
    this.bestPractices = { ...BEST_PRACTICES, ...options.customBestPractices };
    this.resolutionTemplates = { ...RESOLUTION_TEMPLATES, ...options.customResolutions };
  }

  /**
   * Gets supported file types
   * @returns {string[]} Array of file extensions
   */
  getSupportedFileTypes() {
    return ['.json', '.yaml', '.yml', '.toml', '.env'];
  }

  /**
   * Gets error categories this analyzer can detect
   * @returns {string[]} Array of error categories
   */
  getErrorCategories() {
    return [ErrorCategory.CRITICAL, ErrorCategory.HIGH, ErrorCategory.MEDIUM, ErrorCategory.LOW];
  }

  /**
   * Analyzes configuration file for errors
   * @param {string} content - File content
   * @param {string} filePath - Path to file
   * @param {string} language - File type
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(content, filePath, language) {
    const errors = [];
    const warnings = [];
    
    const fileName = this.getFileName(filePath);
    const configType = this.getConfigType(fileName);
    
    // Parse the configuration
    const parseResult = this.parseConfig(content, configType);
    
    if (parseResult.error) {
      errors.push(this.createParseError(parseResult.error, filePath));
      return { errors, warnings };
    }
    
    const config = parseResult.data;
    
    // Validate against schema
    if (this.schemas[fileName]) {
      const schemaErrors = this.validateSchema(config, this.schemas[fileName], filePath);
      errors.push(...schemaErrors);
    }
    
    // Check best practices
    const practiceViolations = this.checkBestPractices(
      configType === 'env' ? content : config,
      fileName,
      filePath
    );
    
    for (const violation of practiceViolations) {
      if (violation.severity === ErrorSeverity.TRIVIAL || violation.severity === ErrorSeverity.MINOR) {
        warnings.push(violation);
      } else {
        errors.push(violation);
      }
    }
    
    return { errors, warnings };
  }

  /**
   * Gets file name from path
   * @param {string} filePath - File path
   * @returns {string} File name
   */
  getFileName(filePath) {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Gets config type from file name
   * @param {string} fileName - File name
   * @returns {string} Config type
   */
  getConfigType(fileName) {
    if (fileName.endsWith('.json')) return 'json';
    if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) return 'yaml';
    if (fileName.endsWith('.toml')) return 'toml';
    if (fileName.startsWith('.env')) return 'env';
    return 'unknown';
  }

  /**
   * Parses configuration content
   * @param {string} content - File content
   * @param {string} configType - Config type
   * @returns {Object} Parse result with data or error
   */
  parseConfig(content, configType) {
    try {
      switch (configType) {
        case 'json':
          return { data: JSON.parse(content) };
        case 'yaml':
          // Simple YAML parsing (basic support)
          return { data: this.parseSimpleYaml(content) };
        case 'env':
          return { data: this.parseEnv(content) };
        default:
          return { data: content };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Simple YAML parser (basic key-value support)
   * @param {string} content - YAML content
   * @returns {Object} Parsed object
   */
  parseSimpleYaml(content) {
    const result = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Parses .env file content
   * @param {string} content - Env file content
   * @returns {Object} Parsed environment variables
   */
  parseEnv(content) {
    const result = {};
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex > 0) {
        const key = trimmed.substring(0, equalsIndex).trim();
        const value = trimmed.substring(equalsIndex + 1).trim();
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Validates config against schema
   * @param {Object} config - Parsed config
   * @param {Object} schema - Schema definition
   * @param {string} filePath - File path
   * @returns {Array} Validation errors
   */
  validateSchema(config, schema, filePath) {
    const errors = [];
    
    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (config[field] === undefined) {
          errors.push(this.createSchemaError(
            `Missing required field: ${field}`,
            filePath,
            field,
            ErrorSeverity.MAJOR
          ));
        }
      }
    }
    
    // Check field types
    if (schema.types) {
      for (const [field, expectedType] of Object.entries(schema.types)) {
        if (config[field] !== undefined) {
          const actualType = Array.isArray(config[field]) ? 'array' : typeof config[field];
          const validTypes = Array.isArray(expectedType) ? expectedType : [expectedType];
          
          if (!validTypes.includes(actualType)) {
            errors.push(this.createSchemaError(
              `Field "${field}" has wrong type: expected ${validTypes.join(' or ')}, got ${actualType}`,
              filePath,
              field,
              ErrorSeverity.MAJOR
            ));
          }
        }
      }
    }
    
    return errors;
  }

  /**
   * Checks best practices for config
   * @param {Object|string} config - Config object or content
   * @param {string} fileName - File name
   * @param {string} filePath - File path
   * @returns {Array} Best practice violations
   */
  checkBestPractices(config, fileName, filePath) {
    const violations = [];
    const practices = this.bestPractices[fileName] || [];
    
    for (const practice of practices) {
      try {
        if (!practice.check(config)) {
          violations.push(this.createBestPracticeViolation(
            practice,
            filePath
          ));
        }
      } catch (error) {
        // Skip if check fails
      }
    }
    
    return violations;
  }

  /**
   * Creates a parse error
   * @param {string} errorMessage - Error message
   * @param {string} filePath - File path
   * @returns {Object} Detected error
   */
  createParseError(errorMessage, filePath) {
    const resolution = this.resolutionTemplates.invalid_json;
    
    return createDetectedError({
      id: `config_parse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.CONFIGURATION,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR,
      message: 'Configuration file parse error',
      description: `Failed to parse configuration: ${errorMessage}`,
      location: createErrorLocation({ filePath, line: 1, column: 1, context: '' }),
      causes: ['Invalid JSON/YAML syntax', 'Trailing comma', 'Missing quotes'],
      resolutions: resolution ? [this.createResolution(resolution, 'invalid_json')] : [],
      preventionStrategies: [
        createPreventionStrategy({
          id: 'json_validator',
          title: 'Use JSON validator',
          description: 'Validate JSON before saving',
          tools: ['VS Code JSON extension', 'jsonlint'],
          steps: ['Install JSON validator', 'Enable format on save']
        })
      ],
      examples: [
        createCodeExample({
          incorrect: '{ "name": "test", }',
          correct: '{ "name": "test" }',
          explanation: 'Remove trailing comma in JSON'
        })
      ]
    });
  }

  /**
   * Creates a schema validation error
   * @param {string} message - Error message
   * @param {string} filePath - File path
   * @param {string} field - Field name
   * @param {string} severity - Error severity
   * @returns {Object} Detected error
   */
  createSchemaError(message, filePath, field, severity) {
    const resolution = this.resolutionTemplates.missing_required_field;
    
    return createDetectedError({
      id: `config_schema_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.CONFIGURATION,
      category: this.severityToCategory(severity),
      severity,
      message,
      description: `Schema validation failed: ${message}`,
      location: createErrorLocation({ filePath, line: 1, column: 1, context: field }),
      causes: ['Missing required field', 'Wrong field type', 'Invalid value'],
      resolutions: resolution ? [this.createResolution(resolution, 'missing_required_field')] : [],
      preventionStrategies: [],
      examples: []
    });
  }

  /**
   * Creates a best practice violation error
   * @param {Object} practice - Practice definition
   * @param {string} filePath - File path
   * @returns {Object} Detected error
   */
  createBestPracticeViolation(practice, filePath) {
    const resolution = this.resolutionTemplates[practice.name];
    
    return createDetectedError({
      id: `config_practice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: ErrorType.CONFIGURATION,
      category: this.severityToCategory(practice.severity),
      severity: practice.severity,
      message: practice.message,
      description: `Best practice violation: ${practice.message}`,
      location: createErrorLocation({ filePath, line: 1, column: 1, context: '' }),
      causes: ['Configuration not following best practices'],
      resolutions: resolution ? [this.createResolution(resolution, practice.name)] : [],
      preventionStrategies: [],
      examples: []
    });
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
}

module.exports = ConfigurationValidator;
