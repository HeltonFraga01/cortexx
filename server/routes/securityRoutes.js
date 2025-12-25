/**
 * Security Routes (Task 3.3)
 * Handles CSP violation reports and security-related endpoints
 */
const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { apiLimiter } = require('../middleware/rateLimiter');

/**
 * POST /api/csp-report
 * Receives CSP violation reports from browsers
 */
router.post('/csp-report', 
  // Rate limit to prevent spam
  apiLimiter,
  express.json({ type: ['application/json', 'application/csp-report'] }),
  (req, res) => {
    try {
      // CSP reports can come in different formats
      const report = req.body['csp-report'] || req.body;
      
      if (!report) {
        return res.status(400).json({ error: 'Invalid CSP report' });
      }
      
      // Log the violation with context
      logger.warn('CSP Violation detected', {
        type: 'csp_violation',
        blockedUri: report['blocked-uri'] || report.blockedUri,
        violatedDirective: report['violated-directive'] || report.violatedDirective,
        effectiveDirective: report['effective-directive'] || report.effectiveDirective,
        documentUri: report['document-uri'] || report.documentUri,
        sourceFile: report['source-file'] || report.sourceFile,
        lineNumber: report['line-number'] || report.lineNumber,
        columnNumber: report['column-number'] || report.columnNumber,
        originalPolicy: report['original-policy'] || report.originalPolicy,
        disposition: report.disposition,
        statusCode: report['status-code'] || report.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      // Return 204 No Content (standard for CSP reports)
      res.status(204).end();
    } catch (error) {
      logger.error('Error processing CSP report', {
        error: error.message,
        body: req.body
      });
      res.status(500).json({ error: 'Failed to process report' });
    }
  }
);

/**
 * GET /api/security/status
 * Returns security configuration status (admin only)
 */
router.get('/status', (req, res) => {
  // This endpoint should be protected by admin auth in production
  const { validateSecurityEnv, IS_PRODUCTION } = require('../middleware/securityConfig');
  const validation = validateSecurityEnv();
  
  res.json({
    success: true,
    data: {
      environment: process.env.NODE_ENV || 'development',
      isProduction: IS_PRODUCTION,
      validation: {
        valid: validation.valid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length
      },
      features: {
        csp: true,
        sessionSecurity: true,
        rateLimiting: true,
        csrf: true
      }
    }
  });
});

module.exports = router;
