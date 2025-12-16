/**
 * Error Detection Engine
 * 
 * Core engine that orchestrates error detection across different analyzers.
 * Implements project scanning, file watching, and error categorization.
 * 
 * @module error-detection/ErrorDetectionEngine
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  createDetectedError,
  createDetectionResult,
  createErrorLocation
} = require('./types');

/**
 * Generates a unique ID for errors
 * @returns {string} Unique ID
 */
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Maps file extensions to languages
 */
const EXTENSION_TO_LANGUAGE = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.py': 'python',
  '.java': 'java',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.toml': 'toml',
  '.xml': 'xml',
  '.html': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.md': 'markdown'
};

/**
 * Default ignore patterns for scanning
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv'
];

class ErrorDetectionEngine extends EventEmitter {
  /**
   * Creates a new ErrorDetectionEngine instance
   * @param {Object} options - Configuration options
   * @param {Array} [options.analyzers] - Array of analyzer instances
   * @param {Array} [options.ignorePatterns] - Patterns to ignore during scanning
   * @param {number} [options.maxFileSize] - Maximum file size to analyze (bytes)
   * @param {boolean} [options.enableCache] - Enable file content caching
   * @param {number} [options.cacheMaxAge] - Max age for cache entries in ms
   */
  constructor(options = {}) {
    super();
    this.analyzers = options.analyzers || [];
    this.ignorePatterns = options.ignorePatterns || DEFAULT_IGNORE_PATTERNS;
    this.maxFileSize = options.maxFileSize || 1024 * 1024; // 1MB default
    this.watchers = new Map();
    this.errorCache = new Map();
    this.enableCache = options.enableCache !== false;
    this.cacheMaxAge = options.cacheMaxAge || 60000; // 1 minute default
    this.fileHashCache = new Map();
    this.analysisCache = new Map();
  }

  /**
   * Computes a simple hash for file content
   * @param {string} content - File content
   * @returns {string} Hash string
   */
  computeHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * Gets cached analysis result if valid
   * @param {string} filePath - File path
   * @param {string} contentHash - Content hash
   * @returns {Object|null} Cached result or null
   */
  getCachedAnalysis(filePath, contentHash) {
    if (!this.enableCache) return null;
    
    const cached = this.analysisCache.get(filePath);
    if (!cached) return null;
    
    // Check if cache is still valid
    if (cached.hash !== contentHash) return null;
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.analysisCache.delete(filePath);
      return null;
    }
    
    return cached.result;
  }

  /**
   * Caches analysis result
   * @param {string} filePath - File path
   * @param {string} contentHash - Content hash
   * @param {Object} result - Analysis result
   */
  cacheAnalysis(filePath, contentHash, result) {
    if (!this.enableCache) return;
    
    this.analysisCache.set(filePath, {
      hash: contentHash,
      result,
      timestamp: Date.now()
    });
    
    // Limit cache size
    if (this.analysisCache.size > 1000) {
      const oldest = this.analysisCache.keys().next().value;
      this.analysisCache.delete(oldest);
    }
  }

  /**
   * Registers an analyzer with the engine
   * @param {Object} analyzer - Analyzer instance
   */
  registerAnalyzer(analyzer) {
    if (!analyzer.analyze || typeof analyzer.analyze !== 'function') {
      throw new Error('Analyzer must implement analyze method');
    }
    this.analyzers.push(analyzer);
  }

  /**
   * Checks if a path should be ignored
   * @param {string} filePath - Path to check
   * @returns {boolean} True if should be ignored
   */
  shouldIgnore(filePath) {
    return this.ignorePatterns.some(pattern => filePath.includes(pattern));
  }

  /**
   * Gets the language for a file based on extension
   * @param {string} filePath - Path to file
   * @returns {string|null} Language identifier or null
   */
  getLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return EXTENSION_TO_LANGUAGE[ext] || null;
  }

  /**
   * Recursively gets all files in a directory
   * @param {string} dirPath - Directory path
   * @param {Array} files - Accumulator array
   * @returns {Array} Array of file paths
   */
  getAllFiles(dirPath, files = []) {
    if (this.shouldIgnore(dirPath)) {
      return files;
    }

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldIgnore(fullPath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          this.getAllFiles(fullPath, files);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      this.emit('error', { type: 'scan', path: dirPath, error: error.message });
    }
    
    return files;
  }

  /**
   * Scans a single file for errors
   * @param {string} filePath - Path to file
   * @param {Object} options - Scan options
   * @param {boolean} [options.useCache] - Whether to use cache
   * @returns {Promise<Object>} File analysis result
   */
  async scanFile(filePath, options = {}) {
    const errors = [];
    const warnings = [];
    const useCache = options.useCache !== false && this.enableCache;
    
    try {
      const stats = fs.statSync(filePath);
      
      if (stats.size > this.maxFileSize) {
        warnings.push({
          type: 'warning',
          message: `File ${filePath} exceeds maximum size limit`,
          filePath
        });
        return { errors, warnings, filePath, cached: false };
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const contentHash = this.computeHash(content);
      
      // Check cache
      if (useCache) {
        const cached = this.getCachedAnalysis(filePath, contentHash);
        if (cached) {
          return { ...cached, cached: true };
        }
      }
      
      const language = this.getLanguage(filePath);
      
      // Run all applicable analyzers
      for (const analyzer of this.analyzers) {
        const supportedTypes = analyzer.getSupportedFileTypes?.() || [];
        const ext = path.extname(filePath);
        
        if (supportedTypes.length === 0 || supportedTypes.includes(ext)) {
          try {
            const result = await analyzer.analyze(content, filePath, language);
            
            if (result.errors) {
              errors.push(...result.errors);
            }
            if (result.warnings) {
              warnings.push(...result.warnings);
            }
          } catch (analyzerError) {
            this.emit('error', {
              type: 'analyzer',
              analyzer: analyzer.constructor.name,
              filePath,
              error: analyzerError.message
            });
          }
        }
      }
      
      const result = { errors, warnings, filePath, cached: false };
      
      // Cache result
      if (useCache) {
        this.cacheAnalysis(filePath, contentHash, result);
      }
      
      return result;
    } catch (error) {
      this.emit('error', { type: 'file', filePath, error: error.message });
    }
    
    return { errors, warnings, filePath, cached: false };
  }

  /**
   * Scans an entire project directory
   * @param {string} projectPath - Path to project root
   * @returns {Promise<Object>} Detection result
   */
  async scanProject(projectPath) {
    const startTime = Date.now();
    const allErrors = [];
    const allWarnings = [];
    const fileResults = [];
    
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }
    
    const files = this.getAllFiles(projectPath);
    
    for (const filePath of files) {
      const result = await this.scanFile(filePath);
      fileResults.push(result);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }
    
    // Categorize and group errors
    const categorizedErrors = this.categorizeErrors(allErrors);
    const groupedErrors = this.groupErrorsByType(categorizedErrors);
    
    const metrics = {
      totalFiles: files.length,
      filesWithErrors: fileResults.filter(r => r.errors.length > 0).length,
      totalErrors: allErrors.length,
      totalWarnings: allWarnings.length,
      scanDuration: Date.now() - startTime,
      errorsByType: this.countByType(categorizedErrors),
      errorsBySeverity: this.countBySeverity(categorizedErrors)
    };
    
    // Cache results
    this.errorCache.set(projectPath, {
      errors: categorizedErrors,
      timestamp: new Date()
    });
    
    return createDetectionResult({
      errors: categorizedErrors,
      warnings: allWarnings,
      metrics,
      timestamp: new Date()
    });
  }

  /**
   * Categorizes errors by type and assigns severity
   * @param {Array} errors - Raw errors
   * @returns {Array} Categorized errors
   */
  categorizeErrors(errors) {
    return errors.map(error => {
      // Assign category based on type if not already set
      const category = error.category || this.determineCategory(error);
      const severity = error.severity || this.determineSeverity(error, category);
      
      return {
        ...error,
        id: error.id || generateErrorId(),
        category,
        severity
      };
    });
  }

  /**
   * Determines error category based on error properties
   * @param {Object} error - Error object
   * @returns {string} Error category
   */
  determineCategory(error) {
    const type = error.type;
    
    switch (type) {
      case ErrorType.SECURITY:
        return ErrorCategory.CRITICAL;
      case ErrorType.SYNTAX:
      case ErrorType.RUNTIME:
        return ErrorCategory.HIGH;
      case ErrorType.LOGICAL:
      case ErrorType.CONFIGURATION:
        return ErrorCategory.MEDIUM;
      case ErrorType.PERFORMANCE:
      case ErrorType.ACCESSIBILITY:
        return ErrorCategory.LOW;
      default:
        return ErrorCategory.INFO;
    }
  }

  /**
   * Determines error severity based on error and category
   * @param {Object} error - Error object
   * @param {string} category - Error category
   * @returns {string} Error severity
   */
  determineSeverity(error, category) {
    switch (category) {
      case ErrorCategory.CRITICAL:
        return ErrorSeverity.BLOCKER;
      case ErrorCategory.HIGH:
        return ErrorSeverity.CRITICAL;
      case ErrorCategory.MEDIUM:
        return ErrorSeverity.MAJOR;
      case ErrorCategory.LOW:
        return ErrorSeverity.MINOR;
      default:
        return ErrorSeverity.TRIVIAL;
    }
  }

  /**
   * Groups errors by type for efficient review
   * @param {Array} errors - Categorized errors
   * @returns {Object} Errors grouped by type
   */
  groupErrorsByType(errors) {
    const grouped = {};
    
    for (const error of errors) {
      const type = error.type || 'unknown';
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type].push(error);
    }
    
    return grouped;
  }

  /**
   * Counts errors by type
   * @param {Array} errors - Errors to count
   * @returns {Object} Count by type
   */
  countByType(errors) {
    const counts = {};
    for (const error of errors) {
      const type = error.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  /**
   * Counts errors by severity
   * @param {Array} errors - Errors to count
   * @returns {Object} Count by severity
   */
  countBySeverity(errors) {
    const counts = {};
    for (const error of errors) {
      const severity = error.severity || 'unknown';
      counts[severity] = (counts[severity] || 0) + 1;
    }
    return counts;
  }

  /**
   * Starts watching a project for changes
   * @param {string} projectPath - Path to project root
   * @param {Function} callback - Callback for error events
   * @returns {Object} Watch handle
   */
  watchProject(projectPath, callback) {
    if (this.watchers.has(projectPath)) {
      return this.watchers.get(projectPath);
    }
    
    const watcher = fs.watch(projectPath, { recursive: true }, async (eventType, filename) => {
      if (!filename || this.shouldIgnore(filename)) {
        return;
      }
      
      const fullPath = path.join(projectPath, filename);
      
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const result = await this.scanFile(fullPath);
        
        if (callback) {
          callback({
            eventType,
            filePath: fullPath,
            errors: result.errors,
            warnings: result.warnings
          });
        }
        
        this.emit('fileChanged', {
          eventType,
          filePath: fullPath,
          errors: result.errors,
          warnings: result.warnings
        });
      }
    });
    
    const handle = {
      id: `watch_${Date.now()}`,
      projectPath,
      watcher,
      startTime: new Date()
    };
    
    this.watchers.set(projectPath, handle);
    this.emit('watchStarted', { projectPath });
    
    return handle;
  }

  /**
   * Stops watching a project
   * @param {Object} handle - Watch handle
   */
  stopWatching(handle) {
    if (handle && handle.watcher) {
      handle.watcher.close();
      this.watchers.delete(handle.projectPath);
      this.emit('watchStopped', { projectPath: handle.projectPath });
    }
  }

  /**
   * Stops all watchers
   */
  stopAllWatchers() {
    for (const handle of this.watchers.values()) {
      this.stopWatching(handle);
    }
  }

  /**
   * Gets cached errors for a project
   * @param {string} projectPath - Path to project
   * @returns {Object|null} Cached errors or null
   */
  getCachedErrors(projectPath) {
    return this.errorCache.get(projectPath) || null;
  }

  /**
   * Clears error cache
   * @param {string} [projectPath] - Optional specific project to clear
   */
  clearCache(projectPath) {
    if (projectPath) {
      this.errorCache.delete(projectPath);
    } else {
      this.errorCache.clear();
    }
  }
}

module.exports = ErrorDetectionEngine;
