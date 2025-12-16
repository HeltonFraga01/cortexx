/**
 * Error Detection System - Type Definitions
 * 
 * This module defines the core types and enums for the error detection system.
 * All types are documented with JSDoc for TypeScript-like type safety in JavaScript.
 */

/**
 * Error types that can be detected by the system
 * @readonly
 * @enum {string}
 */
const ErrorType = {
  SYNTAX: 'syntax',
  RUNTIME: 'runtime',
  LOGICAL: 'logical',
  CONFIGURATION: 'configuration',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  ACCESSIBILITY: 'accessibility',
  COMPATIBILITY: 'compatibility'
};

/**
 * Error categories for classification
 * @readonly
 * @enum {string}
 */
const ErrorCategory = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

/**
 * Error severity levels
 * @readonly
 * @enum {string}
 */
const ErrorSeverity = {
  BLOCKER: 'blocker',
  CRITICAL: 'critical',
  MAJOR: 'major',
  MINOR: 'minor',
  TRIVIAL: 'trivial'
};

/**
 * Resolution difficulty levels
 * @readonly
 * @enum {string}
 */
const ResolutionDifficulty = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
};

/**
 * Export formats supported by the report generator
 * @readonly
 * @enum {string}
 */
const ExportFormat = {
  MARKDOWN: 'markdown',
  JSON: 'json',
  HTML: 'html'
};

/**
 * Creates an error location object
 * @param {Object} params
 * @param {string} params.filePath - Path to the file
 * @param {number} params.line - Line number
 * @param {number} params.column - Column number
 * @param {number} [params.startOffset] - Start offset in file
 * @param {number} [params.endOffset] - End offset in file
 * @param {string} [params.context] - Code context around the error
 * @returns {Object} ErrorLocation object
 */
function createErrorLocation({ filePath, line, column, startOffset = 0, endOffset = 0, context = '' }) {
  return {
    filePath,
    line,
    column,
    startOffset,
    endOffset,
    context
  };
}

/**
 * Creates a resolution step object
 * @param {Object} params
 * @param {number} params.order - Step order
 * @param {string} params.description - Step description
 * @param {string} [params.code] - Code example for the step
 * @param {string} [params.note] - Additional note
 * @returns {Object} ResolutionStep object
 */
function createResolutionStep({ order, description, code = '', note = '' }) {
  return {
    order,
    description,
    code,
    note
  };
}

/**
 * Creates a resolution object
 * @param {Object} params
 * @param {string} params.id - Unique identifier
 * @param {string} params.title - Resolution title
 * @param {string} params.description - Resolution description
 * @param {Array} params.steps - Resolution steps
 * @param {string} params.difficulty - Difficulty level
 * @param {number} params.estimatedTime - Estimated time in minutes
 * @param {Array} [params.requirements] - Required dependencies
 * @returns {Object} Resolution object
 */
function createResolution({ id, title, description, steps, difficulty, estimatedTime, requirements = [] }) {
  return {
    id,
    title,
    description,
    steps,
    difficulty,
    estimatedTime,
    requirements
  };
}

/**
 * Creates a code example object
 * @param {Object} params
 * @param {string} params.incorrect - Incorrect code example
 * @param {string} params.correct - Correct code example
 * @param {string} [params.explanation] - Explanation of the difference
 * @returns {Object} CodeExample object
 */
function createCodeExample({ incorrect, correct, explanation = '' }) {
  return {
    incorrect,
    correct,
    explanation
  };
}

/**
 * Creates a prevention strategy object
 * @param {Object} params
 * @param {string} params.id - Unique identifier
 * @param {string} params.title - Strategy title
 * @param {string} params.description - Strategy description
 * @param {Array} params.tools - Recommended tools
 * @param {Array} params.steps - Implementation steps
 * @param {string} [params.tradeoffs] - Trade-offs explanation
 * @param {string} [params.configExample] - Configuration example
 * @returns {Object} PreventionStrategy object
 */
function createPreventionStrategy({ id, title, description, tools, steps, tradeoffs = '', configExample = '' }) {
  return {
    id,
    title,
    description,
    tools,
    steps,
    tradeoffs,
    configExample
  };
}

/**
 * Creates a detected error object
 * @param {Object} params
 * @param {string} params.id - Unique identifier
 * @param {string} params.type - Error type
 * @param {string} params.category - Error category
 * @param {string} params.severity - Error severity
 * @param {string} params.message - Error message
 * @param {string} params.description - Detailed description
 * @param {Object} params.location - Error location
 * @param {Array} [params.causes] - Possible causes
 * @param {Array} [params.resolutions] - Resolution options
 * @param {Array} [params.preventionStrategies] - Prevention strategies
 * @param {Array} [params.examples] - Code examples
 * @returns {Object} DetectedError object
 */
function createDetectedError({
  id,
  type,
  category,
  severity,
  message,
  description,
  location,
  causes = [],
  resolutions = [],
  preventionStrategies = [],
  examples = []
}) {
  return {
    id,
    type,
    category,
    severity,
    message,
    description,
    location,
    causes,
    resolutions,
    preventionStrategies,
    examples
  };
}

/**
 * Creates a detection result object
 * @param {Object} params
 * @param {Array} params.errors - Detected errors
 * @param {Array} [params.warnings] - Detected warnings
 * @param {Object} [params.metrics] - Project metrics
 * @param {Date} [params.timestamp] - Analysis timestamp
 * @returns {Object} DetectionResult object
 */
function createDetectionResult({ errors, warnings = [], metrics = {}, timestamp = new Date() }) {
  return {
    errors,
    warnings,
    metrics,
    timestamp
  };
}

/**
 * Creates export options object
 * @param {Object} params
 * @param {string} params.format - Export format
 * @param {boolean} [params.includeResolutions] - Include resolutions
 * @param {boolean} [params.includePrevention] - Include prevention strategies
 * @param {boolean} [params.includeExamples] - Include code examples
 * @param {boolean} [params.groupByCategory] - Group errors by category
 * @param {string} [params.sortBy] - Sort field
 * @returns {Object} ExportOptions object
 */
function createExportOptions({
  format,
  includeResolutions = true,
  includePrevention = true,
  includeExamples = true,
  groupByCategory = true,
  sortBy = 'severity'
}) {
  return {
    format,
    includeResolutions,
    includePrevention,
    includeExamples,
    groupByCategory,
    sortBy
  };
}

module.exports = {
  // Enums
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  ResolutionDifficulty,
  ExportFormat,
  // Factory functions
  createErrorLocation,
  createResolutionStep,
  createResolution,
  createCodeExample,
  createPreventionStrategy,
  createDetectedError,
  createDetectionResult,
  createExportOptions
};
