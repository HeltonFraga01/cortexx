/**
 * Error Detection API Routes
 * 
 * REST API endpoints for error detection, report generation,
 * and real-time monitoring.
 * 
 * @module routes/errorDetectionRoutes
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const {
  ErrorDetectionEngine,
  SyntaxAnalyzer,
  RuntimeAnalyzer,
  ConfigurationValidator,
  ReportGenerator,
  RealTimeMonitor,
  MetricsAnalyzer,
  KnowledgeBase,
  ResolutionEngine,
  PreventionStrategyService,
  ExportFormat
} = require('../services/error-detection');

// Initialize services
const engine = new ErrorDetectionEngine();
engine.registerAnalyzer(new SyntaxAnalyzer());
engine.registerAnalyzer(new RuntimeAnalyzer());
engine.registerAnalyzer(new ConfigurationValidator());

const reportGenerator = new ReportGenerator();
const metricsAnalyzer = new MetricsAnalyzer();
const knowledgeBase = new KnowledgeBase();
const resolutionEngine = new ResolutionEngine();
const preventionService = new PreventionStrategyService();

// Store for active monitors (in production, use Redis or similar)
const activeMonitors = new Map();

/**
 * @route POST /api/error-detection/scan
 * @description Scan a project directory for errors
 * @body {string} projectPath - Path to project directory
 * @body {string[]} [ignorePatterns] - Patterns to ignore
 * @returns {Object} Scan results
 */
router.post('/scan', async (req, res) => {
  try {
    const { projectPath, ignorePatterns } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    // Resolve path (in production, validate against allowed paths)
    const resolvedPath = path.resolve(projectPath);
    
    const result = await engine.scanProject(resolvedPath);
    
    // Track errors in metrics
    for (const error of result.errors) {
      metricsAnalyzer.trackError(error);
    }
    
    res.json({
      success: true,
      data: {
        errors: result.errors,
        warnings: result.warnings,
        metrics: result.metrics,
        timestamp: result.timestamp
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/scan-file
 * @description Scan a single file for errors
 * @body {string} filePath - Path to file
 * @returns {Object} File scan results
 */
router.post('/scan-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ 
        success: false, 
        error: 'filePath is required' 
      });
    }
    
    const result = await engine.scanFile(filePath);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/report
 * @description Generate an error report
 * @body {Object[]} errors - Errors to include in report
 * @body {string} format - Report format (markdown, json, html)
 * @body {Object} options - Report options
 * @returns {Object} Generated report
 */
router.post('/report', async (req, res) => {
  try {
    const { errors, format = 'json', options = {} } = req.body;
    
    if (!errors || !Array.isArray(errors)) {
      return res.status(400).json({ 
        success: false, 
        error: 'errors array is required' 
      });
    }
    
    const formatMap = {
      markdown: ExportFormat.MARKDOWN,
      json: ExportFormat.JSON,
      html: ExportFormat.HTML
    };
    
    const report = await reportGenerator.generate(errors, {
      format: formatMap[format] || ExportFormat.JSON,
      ...options
    });
    
    // Set appropriate content type
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html');
      return res.send(report);
    }
    
    if (format === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown');
      return res.send(report);
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/monitor/start
 * @description Start real-time monitoring for a project
 * @body {string} projectPath - Path to project
 * @body {Object} options - Monitor options
 * @returns {Object} Monitor handle info
 */
router.post('/monitor/start', async (req, res) => {
  try {
    const { projectPath, options = {} } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    // Check if already monitoring
    if (activeMonitors.has(projectPath)) {
      return res.json({
        success: true,
        data: {
          message: 'Already monitoring this project',
          monitorId: activeMonitors.get(projectPath).id
        }
      });
    }
    
    const monitor = new RealTimeMonitor(engine, options);
    const handle = monitor.start(projectPath, options);
    
    activeMonitors.set(projectPath, {
      id: handle.id,
      monitor,
      handle
    });
    
    res.json({
      success: true,
      data: {
        monitorId: handle.id,
        projectPath,
        startTime: handle.startTime
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/monitor/stop
 * @description Stop monitoring a project
 * @body {string} projectPath - Path to project
 * @returns {Object} Stop confirmation
 */
router.post('/monitor/stop', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    if (!projectPath) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectPath is required' 
      });
    }
    
    const monitorInfo = activeMonitors.get(projectPath);
    if (!monitorInfo) {
      return res.status(404).json({
        success: false,
        error: 'No active monitor for this project'
      });
    }
    
    monitorInfo.monitor.stop(monitorInfo.handle);
    activeMonitors.delete(projectPath);
    
    res.json({
      success: true,
      data: {
        message: 'Monitor stopped',
        projectPath
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/monitor/status
 * @description Get status of all active monitors
 * @returns {Object} Monitor statuses
 */
router.get('/monitor/status', (req, res) => {
  try {
    const statuses = [];
    
    for (const [projectPath, info] of activeMonitors.entries()) {
      statuses.push({
        projectPath,
        monitorId: info.id,
        status: info.monitor.getStatus()
      });
    }
    
    res.json({
      success: true,
      data: {
        activeMonitors: statuses.length,
        monitors: statuses
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/metrics
 * @description Get error metrics and analytics
 * @query {string} period - Time period (hour, day, week, month)
 * @query {string} type - Filter by error type
 * @returns {Object} Metrics data
 */
router.get('/metrics', (req, res) => {
  try {
    const { period = 'day', type, since, until } = req.query;
    
    const options = { period };
    if (type) options.type = type;
    if (since) options.since = since;
    if (until) options.until = until;
    
    const frequency = metricsAnalyzer.getFrequency(options);
    const trends = metricsAnalyzer.getTrends({ period });
    const common = metricsAnalyzer.getMostCommonCategories(options);
    const resolutionTimes = metricsAnalyzer.getResolutionTimes(options);
    
    res.json({
      success: true,
      data: {
        frequency,
        trends,
        commonCategories: common,
        resolutionTimes
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/suggestions
 * @description Get process improvement suggestions
 * @returns {Object} Suggestions
 */
router.get('/suggestions', (req, res) => {
  try {
    const suggestions = metricsAnalyzer.getSuggestions();
    
    res.json({
      success: true,
      data: suggestions
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/resolve
 * @description Get resolutions for an error
 * @body {Object} error - Error to resolve
 * @returns {Object} Resolutions
 */
router.post('/resolve', async (req, res) => {
  try {
    const { error } = req.body;
    
    if (!error) {
      return res.status(400).json({ 
        success: false, 
        error: 'error object is required' 
      });
    }
    
    const resolutions = await resolutionEngine.generateResolutions(error);
    const completeResolution = await resolutionEngine.generateCompleteResolution(error);
    
    res.json({
      success: true,
      data: {
        resolutions,
        recommendation: completeResolution.recommendedApproach,
        validationSteps: completeResolution.validationSteps
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/prevention/:errorType
 * @description Get prevention strategies for an error type
 * @param {string} errorType - Error type
 * @returns {Object} Prevention strategies
 */
router.get('/prevention/:errorType', (req, res) => {
  try {
    const { errorType } = req.params;
    
    const strategies = preventionService.getStrategiesForType(errorType);
    const tools = preventionService.getToolRecommendations(errorType);
    const tradeoffs = preventionService.getTradeoffAnalysis(errorType);
    
    res.json({
      success: true,
      data: {
        strategies,
        recommendedTools: tools,
        tradeoffAnalysis: tradeoffs
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/knowledge/patterns
 * @description Search knowledge base patterns
 * @query {string} query - Search query
 * @query {string} language - Filter by language
 * @returns {Object} Matching patterns
 */
router.get('/knowledge/patterns', (req, res) => {
  try {
    const { query, language } = req.query;
    
    let patterns;
    if (query) {
      patterns = knowledgeBase.searchPatterns(query);
    } else if (language) {
      patterns = knowledgeBase.getPatternsByLanguage(language);
    } else {
      patterns = knowledgeBase.getAllPatterns();
    }
    
    res.json({
      success: true,
      data: patterns
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/knowledge/solutions/:patternId
 * @description Get solutions for a pattern
 * @param {string} patternId - Pattern ID
 * @returns {Object} Solutions
 */
router.get('/knowledge/solutions/:patternId', (req, res) => {
  try {
    const { patternId } = req.params;
    
    const solutions = knowledgeBase.getSolutions(patternId);
    
    res.json({
      success: true,
      data: solutions
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route GET /api/error-detection/knowledge/best-practices/:language
 * @description Get best practices for a language
 * @param {string} language - Programming language
 * @returns {Object} Best practices
 */
router.get('/knowledge/best-practices/:language', (req, res) => {
  try {
    const { language } = req.params;
    
    const practices = knowledgeBase.getBestPractices(language);
    
    res.json({
      success: true,
      data: practices
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * @route POST /api/error-detection/track-resolution
 * @description Track that an error was resolved
 * @body {string} errorId - Error ID
 * @body {Object} resolution - Resolution details
 * @returns {Object} Confirmation
 */
router.post('/track-resolution', (req, res) => {
  try {
    const { errorId, resolution } = req.body;
    
    if (!errorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'errorId is required' 
      });
    }
    
    metricsAnalyzer.trackResolution(errorId, resolution);
    
    res.json({
      success: true,
      data: {
        message: 'Resolution tracked',
        errorId
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;
