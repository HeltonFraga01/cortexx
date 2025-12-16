/**
 * Error Detection System - Interface Definitions
 * 
 * This module defines the interfaces (contracts) for the error detection system components.
 * These serve as documentation and validation for implementing classes.
 */

const { ErrorType, ErrorCategory } = require('./types');

/**
 * Interface for Error Analyzer components
 * All analyzers must implement these methods
 */
const ErrorAnalyzerInterface = {
  /**
   * Analyze content for errors
   * @param {string} content - File content to analyze
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} Analysis result
   */
  analyze: async (content, filePath) => { throw new Error('Not implemented'); },

  /**
   * Get supported file types
   * @returns {string[]} Array of file extensions
   */
  getSupportedFileTypes: () => { throw new Error('Not implemented'); },

  /**
   * Get error categories this analyzer can detect
   * @returns {string[]} Array of error categories
   */
  getErrorCategories: () => { throw new Error('Not implemented'); }
};

/**
 * Interface for the Error Detection Engine
 */
const ErrorDetectionEngineInterface = {
  /**
   * Scan an entire project directory
   * @param {string} projectPath - Path to project root
   * @returns {Promise<Object>} Detection result
   */
  scanProject: async (projectPath) => { throw new Error('Not implemented'); },

  /**
   * Scan a single file
   * @param {string} filePath - Path to file
   * @returns {Promise<Object>} File analysis result
   */
  scanFile: async (filePath) => { throw new Error('Not implemented'); },

  /**
   * Start watching a project for changes
   * @param {string} projectPath - Path to project root
   * @param {Function} callback - Callback for error events
   * @returns {Object} Watch handle
   */
  watchProject: (projectPath, callback) => { throw new Error('Not implemented'); },

  /**
   * Stop watching a project
   * @param {Object} handle - Watch handle
   */
  stopWatching: (handle) => { throw new Error('Not implemented'); }
};

/**
 * Interface for Report Generator
 */
const ReportGeneratorInterface = {
  /**
   * Generate markdown report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<string>} Markdown content
   */
  generateMarkdown: async (errors, options) => { throw new Error('Not implemented'); },

  /**
   * Generate JSON report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<Object>} JSON object
   */
  generateJSON: async (errors, options) => { throw new Error('Not implemented'); },

  /**
   * Generate HTML report
   * @param {Array} errors - Detected errors
   * @param {Object} options - Export options
   * @returns {Promise<string>} HTML content
   */
  generateHTML: async (errors, options) => { throw new Error('Not implemented'); }
};

/**
 * Interface for Resolution Engine
 */
const ResolutionEngineInterface = {
  /**
   * Generate resolutions for an error
   * @param {Object} error - Detected error
   * @returns {Promise<Array>} Array of resolutions
   */
  generateResolutions: async (error) => { throw new Error('Not implemented'); },

  /**
   * Rank resolutions by effectiveness
   * @param {Array} resolutions - Array of resolutions
   * @returns {Array} Ranked resolutions
   */
  rankResolutions: (resolutions) => { throw new Error('Not implemented'); },

  /**
   * Generate validation steps for a resolution
   * @param {Object} resolution - Resolution object
   * @returns {Array} Validation steps
   */
  generateValidationSteps: (resolution) => { throw new Error('Not implemented'); }
};

/**
 * Interface for Real-time Monitor
 */
const RealTimeMonitorInterface = {
  /**
   * Start monitoring a project
   * @param {string} projectPath - Path to project
   * @param {Object} options - Monitor options
   * @returns {Object} Monitor handle
   */
  start: (projectPath, options) => { throw new Error('Not implemented'); },

  /**
   * Stop monitoring
   * @param {Object} handle - Monitor handle
   */
  stop: (handle) => { throw new Error('Not implemented'); },

  /**
   * Get current error status
   * @returns {Object} Current errors and status
   */
  getStatus: () => { throw new Error('Not implemented'); },

  /**
   * Subscribe to error events
   * @param {string} event - Event type
   * @param {Function} callback - Event callback
   */
  on: (event, callback) => { throw new Error('Not implemented'); }
};

/**
 * Interface for Metrics Analyzer
 */
const MetricsAnalyzerInterface = {
  /**
   * Track error occurrence
   * @param {Object} error - Detected error
   */
  trackError: (error) => { throw new Error('Not implemented'); },

  /**
   * Get error frequency over time
   * @param {Object} options - Query options
   * @returns {Object} Frequency data
   */
  getFrequency: (options) => { throw new Error('Not implemented'); },

  /**
   * Get trend analysis
   * @param {Object} options - Query options
   * @returns {Object} Trend data
   */
  getTrends: (options) => { throw new Error('Not implemented'); },

  /**
   * Get process improvement suggestions
   * @returns {Array} Suggestions
   */
  getSuggestions: () => { throw new Error('Not implemented'); }
};

/**
 * Interface for Knowledge Base
 */
const KnowledgeBaseInterface = {
  /**
   * Find matching error patterns
   * @param {Object} error - Error to match
   * @returns {Array} Matching patterns
   */
  findPatterns: (error) => { throw new Error('Not implemented'); },

  /**
   * Get solution templates for an error
   * @param {string} patternId - Error pattern ID
   * @returns {Array} Solution templates
   */
  getSolutions: (patternId) => { throw new Error('Not implemented'); },

  /**
   * Get prevention strategies for an error type
   * @param {string} errorType - Error type
   * @returns {Array} Prevention strategies
   */
  getPreventionStrategies: (errorType) => { throw new Error('Not implemented'); },

  /**
   * Get best practices for a configuration type
   * @param {string} configType - Configuration type
   * @returns {Array} Best practice rules
   */
  getBestPractices: (configType) => { throw new Error('Not implemented'); }
};

/**
 * Validates that an object implements an interface
 * @param {Object} obj - Object to validate
 * @param {Object} interfaceDef - Interface definition
 * @param {string} name - Interface name for error messages
 * @returns {boolean} True if valid
 * @throws {Error} If interface not implemented
 */
function validateInterface(obj, interfaceDef, name) {
  const missingMethods = [];
  
  for (const method of Object.keys(interfaceDef)) {
    if (typeof obj[method] !== 'function') {
      missingMethods.push(method);
    }
  }
  
  if (missingMethods.length > 0) {
    throw new Error(
      `Object does not implement ${name} interface. Missing methods: ${missingMethods.join(', ')}`
    );
  }
  
  return true;
}

module.exports = {
  ErrorAnalyzerInterface,
  ErrorDetectionEngineInterface,
  ReportGeneratorInterface,
  ResolutionEngineInterface,
  RealTimeMonitorInterface,
  MetricsAnalyzerInterface,
  KnowledgeBaseInterface,
  validateInterface
};
