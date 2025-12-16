/**
 * Metrics Analyzer
 * 
 * Tracks error frequency, types over time, trend analysis,
 * team performance insights, and process improvement suggestions.
 * 
 * @module error-detection/MetricsAnalyzer
 */

const { ErrorType, ErrorCategory, ErrorSeverity } = require('./types');

/**
 * Time periods for analysis
 */
const TimePeriod = {
  HOUR: 'hour',
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month'
};

class MetricsAnalyzer {
  /**
   * Creates a new MetricsAnalyzer instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.errorLog = [];
    this.resolutionLog = [];
    this.maxLogSize = options.maxLogSize || 10000;
  }

  /**
   * Tracks an error occurrence
   * @param {Object} error - Detected error
   * @param {Object} metadata - Additional metadata
   */
  trackError(error, metadata = {}) {
    const entry = {
      id: error.id,
      type: error.type,
      category: error.category,
      severity: error.severity,
      filePath: error.location?.filePath,
      timestamp: new Date(),
      ...metadata
    };
    
    this.errorLog.push(entry);
    
    // Trim log if too large
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Tracks error resolution
   * @param {string} errorId - Error ID
   * @param {Object} resolution - Resolution details
   */
  trackResolution(errorId, resolution = {}) {
    const errorEntry = this.errorLog.find(e => e.id === errorId);
    
    const entry = {
      errorId,
      errorType: errorEntry?.type,
      errorSeverity: errorEntry?.severity,
      resolvedAt: new Date(),
      detectedAt: errorEntry?.timestamp,
      resolutionTime: errorEntry ? Date.now() - errorEntry.timestamp.getTime() : null,
      ...resolution
    };
    
    this.resolutionLog.push(entry);
    
    if (this.resolutionLog.length > this.maxLogSize) {
      this.resolutionLog = this.resolutionLog.slice(-this.maxLogSize);
    }
  }

  /**
   * Gets error frequency over time
   * @param {Object} options - Query options
   * @returns {Object} Frequency data
   */
  getFrequency(options = {}) {
    const { period = TimePeriod.DAY, since, until, type, category } = options;
    
    let filtered = this.filterErrors(this.errorLog, { since, until, type, category });
    
    const buckets = this.groupByTimePeriod(filtered, period);
    
    return {
      period,
      data: buckets,
      total: filtered.length,
      average: filtered.length / Object.keys(buckets).length || 0
    };
  }

  /**
   * Gets trend analysis
   * @param {Object} options - Query options
   * @returns {Object} Trend data
   */
  getTrends(options = {}) {
    const { period = TimePeriod.WEEK, compareWith = 1 } = options;
    
    const now = new Date();
    const periodMs = this.getPeriodMs(period);
    
    // Current period
    const currentStart = new Date(now.getTime() - periodMs);
    const currentErrors = this.filterErrors(this.errorLog, { 
      since: currentStart, 
      until: now 
    });
    
    // Previous period
    const previousStart = new Date(currentStart.getTime() - periodMs);
    const previousErrors = this.filterErrors(this.errorLog, { 
      since: previousStart, 
      until: currentStart 
    });
    
    const currentCount = currentErrors.length;
    const previousCount = previousErrors.length;
    
    const change = previousCount > 0 
      ? ((currentCount - previousCount) / previousCount) * 100 
      : currentCount > 0 ? 100 : 0;
    
    // Breakdown by type
    const currentByType = this.countByField(currentErrors, 'type');
    const previousByType = this.countByField(previousErrors, 'type');
    
    const typeChanges = {};
    for (const type of Object.keys({ ...currentByType, ...previousByType })) {
      const curr = currentByType[type] || 0;
      const prev = previousByType[type] || 0;
      typeChanges[type] = {
        current: curr,
        previous: prev,
        change: prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0
      };
    }
    
    return {
      period,
      currentPeriod: { start: currentStart, end: now, count: currentCount },
      previousPeriod: { start: previousStart, end: currentStart, count: previousCount },
      overallChange: change,
      trend: change > 5 ? 'increasing' : change < -5 ? 'decreasing' : 'stable',
      byType: typeChanges,
      qualityScore: this.calculateQualityScore(currentErrors)
    };
  }

  /**
   * Gets most common error categories
   * @param {Object} options - Query options
   * @returns {Array} Common categories
   */
  getMostCommonCategories(options = {}) {
    const filtered = this.filterErrors(this.errorLog, options);
    const counts = this.countByField(filtered, 'type');
    
    return Object.entries(counts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: (count / filtered.length) * 100
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Gets resolution time statistics
   * @param {Object} options - Query options
   * @returns {Object} Resolution time stats
   */
  getResolutionTimes(options = {}) {
    const { since, until, type } = options;
    
    let filtered = this.resolutionLog.filter(r => r.resolutionTime !== null);
    
    if (since) {
      filtered = filtered.filter(r => r.resolvedAt >= new Date(since));
    }
    if (until) {
      filtered = filtered.filter(r => r.resolvedAt <= new Date(until));
    }
    if (type) {
      filtered = filtered.filter(r => r.errorType === type);
    }
    
    if (filtered.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0, count: 0 };
    }
    
    const times = filtered.map(r => r.resolutionTime);
    times.sort((a, b) => a - b);
    
    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      median: times[Math.floor(times.length / 2)],
      min: times[0],
      max: times[times.length - 1],
      count: times.length,
      byType: this.getResolutionTimesByType(filtered)
    };
  }

  /**
   * Gets resolution times grouped by error type
   * @param {Array} resolutions - Resolution entries
   * @returns {Object} Times by type
   */
  getResolutionTimesByType(resolutions) {
    const byType = {};
    
    for (const r of resolutions) {
      if (!byType[r.errorType]) {
        byType[r.errorType] = [];
      }
      byType[r.errorType].push(r.resolutionTime);
    }
    
    const result = {};
    for (const [type, times] of Object.entries(byType)) {
      result[type] = {
        average: times.reduce((a, b) => a + b, 0) / times.length,
        count: times.length
      };
    }
    
    return result;
  }

  /**
   * Gets team/developer performance insights
   * @param {Object} options - Query options
   * @returns {Object} Performance insights
   */
  getPerformanceInsights(options = {}) {
    const filtered = this.filterErrors(this.errorLog, options);
    
    // Group by file path (as proxy for feature area)
    const byPath = {};
    for (const error of filtered) {
      const dir = this.getDirectory(error.filePath);
      if (!byPath[dir]) {
        byPath[dir] = [];
      }
      byPath[dir].push(error);
    }
    
    // Find hotspots
    const hotspots = Object.entries(byPath)
      .map(([path, errors]) => ({
        path,
        errorCount: errors.length,
        types: this.countByField(errors, 'type'),
        severities: this.countByField(errors, 'severity')
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);
    
    return {
      totalErrors: filtered.length,
      hotspots,
      errorDistribution: this.countByField(filtered, 'type'),
      severityDistribution: this.countByField(filtered, 'severity'),
      recommendations: this.generateRecommendations(hotspots, filtered)
    };
  }

  /**
   * Gets process improvement suggestions
   * @returns {Array} Suggestions
   */
  getSuggestions() {
    const suggestions = [];
    const trends = this.getTrends({ period: TimePeriod.WEEK });
    const common = this.getMostCommonCategories();
    const resolutionTimes = this.getResolutionTimes();
    
    // Check for increasing errors
    if (trends.trend === 'increasing') {
      suggestions.push({
        priority: 'high',
        category: 'quality',
        title: 'Error rate is increasing',
        description: `Errors increased by ${trends.overallChange.toFixed(1)}% compared to last period`,
        action: 'Review recent changes and consider adding more tests'
      });
    }
    
    // Check for common error types
    if (common.length > 0 && common[0].percentage > 30) {
      suggestions.push({
        priority: 'medium',
        category: 'prevention',
        title: `High concentration of ${common[0].type} errors`,
        description: `${common[0].type} errors make up ${common[0].percentage.toFixed(1)}% of all errors`,
        action: `Consider adding linting rules or tooling to prevent ${common[0].type} errors`
      });
    }
    
    // Check resolution times
    if (resolutionTimes.average > 3600000) { // > 1 hour
      suggestions.push({
        priority: 'medium',
        category: 'process',
        title: 'Long error resolution times',
        description: `Average resolution time is ${(resolutionTimes.average / 60000).toFixed(0)} minutes`,
        action: 'Consider improving documentation or adding automated fixes'
      });
    }
    
    // Check for syntax errors
    const syntaxCount = common.find(c => c.type === ErrorType.SYNTAX)?.count || 0;
    if (syntaxCount > 10) {
      suggestions.push({
        priority: 'low',
        category: 'tooling',
        title: 'Many syntax errors detected',
        description: `${syntaxCount} syntax errors found`,
        action: 'Enable ESLint/Prettier with format-on-save'
      });
    }
    
    // Check for security errors
    const securityCount = common.find(c => c.type === ErrorType.SECURITY)?.count || 0;
    if (securityCount > 0) {
      suggestions.push({
        priority: 'high',
        category: 'security',
        title: 'Security vulnerabilities detected',
        description: `${securityCount} security issues found`,
        action: 'Address security vulnerabilities immediately'
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Generates recommendations based on hotspots
   * @param {Array} hotspots - Error hotspots
   * @param {Array} errors - All errors
   * @returns {Array} Recommendations
   */
  generateRecommendations(hotspots, errors) {
    const recommendations = [];
    
    if (hotspots.length > 0) {
      const topHotspot = hotspots[0];
      recommendations.push({
        type: 'focus_area',
        message: `Focus on ${topHotspot.path} - it has ${topHotspot.errorCount} errors`,
        priority: 'high'
      });
    }
    
    // Check for patterns
    const typeDistribution = this.countByField(errors, 'type');
    const dominantType = Object.entries(typeDistribution)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (dominantType && dominantType[1] > errors.length * 0.4) {
      recommendations.push({
        type: 'tooling',
        message: `Consider adding tooling to prevent ${dominantType[0]} errors`,
        priority: 'medium'
      });
    }
    
    return recommendations;
  }

  /**
   * Filters errors based on options
   * @param {Array} errors - Errors to filter
   * @param {Object} options - Filter options
   * @returns {Array} Filtered errors
   */
  filterErrors(errors, options = {}) {
    let filtered = [...errors];
    
    if (options.since) {
      const since = new Date(options.since);
      filtered = filtered.filter(e => e.timestamp >= since);
    }
    
    if (options.until) {
      const until = new Date(options.until);
      filtered = filtered.filter(e => e.timestamp <= until);
    }
    
    if (options.type) {
      filtered = filtered.filter(e => e.type === options.type);
    }
    
    if (options.category) {
      filtered = filtered.filter(e => e.category === options.category);
    }
    
    if (options.severity) {
      filtered = filtered.filter(e => e.severity === options.severity);
    }
    
    return filtered;
  }

  /**
   * Groups errors by time period
   * @param {Array} errors - Errors to group
   * @param {string} period - Time period
   * @returns {Object} Grouped errors
   */
  groupByTimePeriod(errors, period) {
    const buckets = {};
    
    for (const error of errors) {
      const key = this.getTimeBucketKey(error.timestamp, period);
      if (!buckets[key]) {
        buckets[key] = 0;
      }
      buckets[key]++;
    }
    
    return buckets;
  }

  /**
   * Gets time bucket key for a timestamp
   * @param {Date} timestamp - Timestamp
   * @param {string} period - Time period
   * @returns {string} Bucket key
   */
  getTimeBucketKey(timestamp, period) {
    const date = new Date(timestamp);
    
    switch (period) {
      case TimePeriod.HOUR:
        return `${date.toISOString().slice(0, 13)}:00`;
      case TimePeriod.DAY:
        return date.toISOString().slice(0, 10);
      case TimePeriod.WEEK:
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().slice(0, 10);
      case TimePeriod.MONTH:
        return date.toISOString().slice(0, 7);
      default:
        return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Gets period duration in milliseconds
   * @param {string} period - Time period
   * @returns {number} Duration in ms
   */
  getPeriodMs(period) {
    switch (period) {
      case TimePeriod.HOUR:
        return 60 * 60 * 1000;
      case TimePeriod.DAY:
        return 24 * 60 * 60 * 1000;
      case TimePeriod.WEEK:
        return 7 * 24 * 60 * 60 * 1000;
      case TimePeriod.MONTH:
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Counts items by field
   * @param {Array} items - Items to count
   * @param {string} field - Field to count by
   * @returns {Object} Counts
   */
  countByField(items, field) {
    const counts = {};
    for (const item of items) {
      const value = item[field] || 'unknown';
      counts[value] = (counts[value] || 0) + 1;
    }
    return counts;
  }

  /**
   * Gets directory from file path
   * @param {string} filePath - File path
   * @returns {string} Directory
   */
  getDirectory(filePath) {
    if (!filePath) return 'unknown';
    const parts = filePath.split('/');
    return parts.slice(0, -1).join('/') || '/';
  }

  /**
   * Calculates quality score
   * @param {Array} errors - Errors
   * @returns {number} Quality score (0-100)
   */
  calculateQualityScore(errors) {
    if (errors.length === 0) return 100;
    
    let score = 100;
    
    // Deduct points based on severity
    for (const error of errors) {
      switch (error.severity) {
        case ErrorSeverity.BLOCKER:
          score -= 10;
          break;
        case ErrorSeverity.CRITICAL:
          score -= 5;
          break;
        case ErrorSeverity.MAJOR:
          score -= 2;
          break;
        case ErrorSeverity.MINOR:
          score -= 1;
          break;
        default:
          score -= 0.5;
      }
    }
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Exports metrics data
   * @returns {Object} Exported data
   */
  exportData() {
    return {
      errorLog: this.errorLog,
      resolutionLog: this.resolutionLog,
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Imports metrics data
   * @param {Object} data - Data to import
   */
  importData(data) {
    if (data.errorLog) {
      this.errorLog = data.errorLog.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp)
      }));
    }
    if (data.resolutionLog) {
      this.resolutionLog = data.resolutionLog.map(r => ({
        ...r,
        resolvedAt: new Date(r.resolvedAt),
        detectedAt: r.detectedAt ? new Date(r.detectedAt) : null
      }));
    }
  }

  /**
   * Clears all metrics data
   */
  clear() {
    this.errorLog = [];
    this.resolutionLog = [];
  }
}

MetricsAnalyzer.TimePeriod = TimePeriod;

module.exports = MetricsAnalyzer;
