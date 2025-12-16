/**
 * Real-Time Monitor
 * 
 * Provides real-time error monitoring with file change detection,
 * automatic re-scanning, notifications, and live dashboard data.
 * 
 * @module error-detection/RealTimeMonitor
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { ErrorCategory, ErrorSeverity } = require('./types');

/**
 * Monitor events
 */
const MonitorEvents = {
  ERROR_DETECTED: 'error:detected',
  ERROR_FIXED: 'error:fixed',
  FILE_CHANGED: 'file:changed',
  SCAN_STARTED: 'scan:started',
  SCAN_COMPLETED: 'scan:completed',
  CRITICAL_ERROR: 'error:critical',
  STATUS_UPDATE: 'status:update'
};

/**
 * Default monitor options
 */
const DEFAULT_OPTIONS = {
  debounceMs: 300,
  ignorePatterns: ['node_modules', '.git', 'dist', 'build'],
  maxFileSize: 1024 * 1024, // 1MB
  notifyOnCritical: true,
  autoRescan: true
};

class RealTimeMonitor extends EventEmitter {
  /**
   * Creates a new RealTimeMonitor instance
   * @param {Object} engine - ErrorDetectionEngine instance
   * @param {Object} options - Monitor options
   */
  constructor(engine, options = {}) {
    super();
    this.engine = engine;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.watchers = new Map();
    this.activeErrors = new Map();
    this.errorHistory = [];
    this.isMonitoring = false;
    this.debounceTimers = new Map();
    this.stats = {
      filesScanned: 0,
      errorsDetected: 0,
      errorsFixed: 0,
      lastScanTime: null
    };
  }

  /**
   * Starts monitoring a project
   * @param {string} projectPath - Path to project
   * @param {Object} options - Monitor options
   * @returns {Object} Monitor handle
   */
  start(projectPath, options = {}) {
    if (this.watchers.has(projectPath)) {
      return this.watchers.get(projectPath);
    }
    
    const opts = { ...this.options, ...options };
    
    // Initial scan
    this.performInitialScan(projectPath);
    
    // Set up file watcher
    const watcher = fs.watch(projectPath, { recursive: true }, (eventType, filename) => {
      if (!filename || this.shouldIgnore(filename, opts.ignorePatterns)) {
        return;
      }
      
      this.handleFileChange(projectPath, filename, eventType, opts);
    });
    
    const handle = {
      id: `monitor_${Date.now()}`,
      projectPath,
      watcher,
      startTime: new Date(),
      options: opts
    };
    
    this.watchers.set(projectPath, handle);
    this.isMonitoring = true;
    
    this.emit(MonitorEvents.STATUS_UPDATE, {
      status: 'started',
      projectPath,
      timestamp: new Date()
    });
    
    return handle;
  }

  /**
   * Stops monitoring a project
   * @param {Object} handle - Monitor handle
   */
  stop(handle) {
    if (!handle) return;
    
    if (handle.watcher) {
      handle.watcher.close();
    }
    
    this.watchers.delete(handle.projectPath);
    
    // Clear debounce timers
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(handle.projectPath)) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
    
    if (this.watchers.size === 0) {
      this.isMonitoring = false;
    }
    
    this.emit(MonitorEvents.STATUS_UPDATE, {
      status: 'stopped',
      projectPath: handle.projectPath,
      timestamp: new Date()
    });
  }

  /**
   * Stops all monitors
   */
  stopAll() {
    for (const handle of this.watchers.values()) {
      this.stop(handle);
    }
  }

  /**
   * Performs initial scan of project
   * @param {string} projectPath - Project path
   */
  async performInitialScan(projectPath) {
    this.emit(MonitorEvents.SCAN_STARTED, { projectPath, timestamp: new Date() });
    
    try {
      const result = await this.engine.scanProject(projectPath);
      
      // Store initial errors
      for (const error of result.errors) {
        this.addError(error);
      }
      
      this.stats.filesScanned = result.metrics?.totalFiles || 0;
      this.stats.lastScanTime = new Date();
      
      this.emit(MonitorEvents.SCAN_COMPLETED, {
        projectPath,
        errors: result.errors,
        metrics: result.metrics,
        timestamp: new Date()
      });
      
      // Notify on critical errors
      const criticalErrors = result.errors.filter(e => 
        e.severity === ErrorSeverity.BLOCKER || e.severity === ErrorSeverity.CRITICAL
      );
      
      if (criticalErrors.length > 0 && this.options.notifyOnCritical) {
        this.emit(MonitorEvents.CRITICAL_ERROR, {
          errors: criticalErrors,
          count: criticalErrors.length,
          timestamp: new Date()
        });
      }
    } catch (error) {
      this.emit('error', { type: 'scan', error: error.message });
    }
  }

  /**
   * Handles file change events
   * @param {string} projectPath - Project path
   * @param {string} filename - Changed file
   * @param {string} eventType - Event type
   * @param {Object} options - Options
   */
  handleFileChange(projectPath, filename, eventType, options) {
    const fullPath = path.join(projectPath, filename);
    const debounceKey = fullPath;
    
    // Clear existing debounce timer
    if (this.debounceTimers.has(debounceKey)) {
      clearTimeout(this.debounceTimers.get(debounceKey));
    }
    
    // Set new debounce timer
    const timer = setTimeout(async () => {
      this.debounceTimers.delete(debounceKey);
      
      this.emit(MonitorEvents.FILE_CHANGED, {
        filePath: fullPath,
        eventType,
        timestamp: new Date()
      });
      
      if (options.autoRescan) {
        await this.rescanFile(fullPath);
      }
    }, options.debounceMs);
    
    this.debounceTimers.set(debounceKey, timer);
  }

  /**
   * Rescans a single file
   * @param {string} filePath - File path
   */
  async rescanFile(filePath) {
    if (!fs.existsSync(filePath)) {
      // File was deleted, remove its errors
      this.removeErrorsForFile(filePath);
      return;
    }
    
    try {
      const result = await this.engine.scanFile(filePath);
      
      // Get previous errors for this file
      const previousErrors = this.getErrorsForFile(filePath);
      const previousIds = new Set(previousErrors.map(e => e.id));
      const newIds = new Set(result.errors.map(e => e.id));
      
      // Find fixed errors
      for (const prevError of previousErrors) {
        if (!newIds.has(prevError.id)) {
          this.removeError(prevError.id);
          this.emit(MonitorEvents.ERROR_FIXED, {
            error: prevError,
            filePath,
            timestamp: new Date()
          });
        }
      }
      
      // Find new errors
      for (const error of result.errors) {
        if (!previousIds.has(error.id)) {
          this.addError(error);
          this.emit(MonitorEvents.ERROR_DETECTED, {
            error,
            filePath,
            timestamp: new Date()
          });
          
          // Check for critical
          if (error.severity === ErrorSeverity.BLOCKER || 
              error.severity === ErrorSeverity.CRITICAL) {
            this.emit(MonitorEvents.CRITICAL_ERROR, {
              errors: [error],
              count: 1,
              timestamp: new Date()
            });
          }
        }
      }
      
      this.stats.filesScanned++;
      this.stats.lastScanTime = new Date();
      
    } catch (error) {
      this.emit('error', { type: 'rescan', filePath, error: error.message });
    }
  }

  /**
   * Checks if a path should be ignored
   * @param {string} filePath - Path to check
   * @param {Array} patterns - Ignore patterns
   * @returns {boolean} True if should ignore
   */
  shouldIgnore(filePath, patterns) {
    return patterns.some(pattern => filePath.includes(pattern));
  }

  /**
   * Adds an error to active errors
   * @param {Object} error - Error to add
   */
  addError(error) {
    this.activeErrors.set(error.id, error);
    this.errorHistory.push({
      action: 'added',
      error,
      timestamp: new Date()
    });
    this.stats.errorsDetected++;
  }

  /**
   * Removes an error from active errors
   * @param {string} errorId - Error ID
   */
  removeError(errorId) {
    const error = this.activeErrors.get(errorId);
    if (error) {
      this.activeErrors.delete(errorId);
      this.errorHistory.push({
        action: 'removed',
        error,
        timestamp: new Date()
      });
      this.stats.errorsFixed++;
    }
  }

  /**
   * Gets errors for a specific file
   * @param {string} filePath - File path
   * @returns {Array} Errors for file
   */
  getErrorsForFile(filePath) {
    const errors = [];
    for (const error of this.activeErrors.values()) {
      if (error.location?.filePath === filePath) {
        errors.push(error);
      }
    }
    return errors;
  }

  /**
   * Removes all errors for a file
   * @param {string} filePath - File path
   */
  removeErrorsForFile(filePath) {
    const toRemove = [];
    for (const [id, error] of this.activeErrors.entries()) {
      if (error.location?.filePath === filePath) {
        toRemove.push(id);
      }
    }
    
    for (const id of toRemove) {
      const error = this.activeErrors.get(id);
      this.removeError(id);
      this.emit(MonitorEvents.ERROR_FIXED, {
        error,
        filePath,
        reason: 'file_deleted',
        timestamp: new Date()
      });
    }
  }

  /**
   * Gets current error status
   * @returns {Object} Current status
   */
  getStatus() {
    const errors = Array.from(this.activeErrors.values());
    
    const bySeverity = {};
    const byCategory = {};
    const byType = {};
    
    for (const error of errors) {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      byCategory[error.category] = (byCategory[error.category] || 0) + 1;
      byType[error.type] = (byType[error.type] || 0) + 1;
    }
    
    return {
      isMonitoring: this.isMonitoring,
      totalErrors: errors.length,
      errors,
      bySeverity,
      byCategory,
      byType,
      stats: this.stats,
      criticalCount: (bySeverity[ErrorSeverity.BLOCKER] || 0) + 
                     (bySeverity[ErrorSeverity.CRITICAL] || 0)
    };
  }

  /**
   * Gets dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const status = this.getStatus();
    const recentHistory = this.errorHistory.slice(-50);
    
    return {
      ...status,
      recentActivity: recentHistory,
      monitoredProjects: Array.from(this.watchers.keys()),
      uptime: this.getUptime()
    };
  }

  /**
   * Gets monitor uptime
   * @returns {number} Uptime in milliseconds
   */
  getUptime() {
    let earliest = Date.now();
    for (const handle of this.watchers.values()) {
      const startTime = handle.startTime.getTime();
      if (startTime < earliest) {
        earliest = startTime;
      }
    }
    return Date.now() - earliest;
  }

  /**
   * Gets error history
   * @param {Object} options - Query options
   * @returns {Array} Error history
   */
  getHistory(options = {}) {
    let history = [...this.errorHistory];
    
    if (options.since) {
      const since = new Date(options.since);
      history = history.filter(h => h.timestamp >= since);
    }
    
    if (options.action) {
      history = history.filter(h => h.action === options.action);
    }
    
    if (options.limit) {
      history = history.slice(-options.limit);
    }
    
    return history;
  }

  /**
   * Clears error history
   */
  clearHistory() {
    this.errorHistory = [];
  }

  /**
   * Forces a full rescan of all monitored projects
   */
  async forceRescan() {
    for (const handle of this.watchers.values()) {
      await this.performInitialScan(handle.projectPath);
    }
  }
}

// Export events for external use
RealTimeMonitor.Events = MonitorEvents;

module.exports = RealTimeMonitor;
