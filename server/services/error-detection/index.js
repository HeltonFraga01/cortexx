/**
 * Error Detection System - Main Entry Point
 * 
 * This module exports all components of the error detection system.
 * 
 * @module error-detection
 */

const types = require('./types');
const interfaces = require('./interfaces');
const ErrorDetectionEngine = require('./ErrorDetectionEngine');
const ErrorInformationService = require('./ErrorInformationService');
const ResolutionEngine = require('./ResolutionEngine');
const PreventionStrategyService = require('./PreventionStrategyService');
const ReportGenerator = require('./ReportGenerator');
const RealTimeMonitor = require('./RealTimeMonitor');
const MetricsAnalyzer = require('./MetricsAnalyzer');
const KnowledgeBase = require('./KnowledgeBase');
const ErrorHandler = require('./ErrorHandler');
const analyzers = require('./analyzers');

module.exports = {
  // Types and enums
  ...types,
  
  // Interfaces
  ...interfaces,
  
  // Core components
  ErrorDetectionEngine,
  ErrorInformationService,
  ResolutionEngine,
  PreventionStrategyService,
  ReportGenerator,
  RealTimeMonitor,
  MetricsAnalyzer,
  KnowledgeBase,
  ErrorHandler,
  
  // Analyzers
  ...analyzers
};
