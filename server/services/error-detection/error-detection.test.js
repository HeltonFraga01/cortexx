/**
 * Error Detection System - Basic Tests
 * 
 * Tests core functionality of the error detection system.
 */

const { test, describe } = require('node:test');
const assert = require('node:assert');

const {
  ErrorType,
  ErrorCategory,
  ErrorSeverity,
  createDetectedError,
  createErrorLocation,
  ErrorDetectionEngine,
  SyntaxAnalyzer,
  RuntimeAnalyzer,
  ConfigurationValidator,
  ReportGenerator,
  ResolutionEngine,
  PreventionStrategyService,
  MetricsAnalyzer,
  KnowledgeBase,
  ErrorHandler,
  ExportFormat
} = require('./index');

describe('Error Detection Types', () => {
  test('should have all error types defined', () => {
    assert.ok(ErrorType.SYNTAX);
    assert.ok(ErrorType.RUNTIME);
    assert.ok(ErrorType.LOGICAL);
    assert.ok(ErrorType.CONFIGURATION);
    assert.ok(ErrorType.SECURITY);
    assert.ok(ErrorType.PERFORMANCE);
  });

  test('should have all error categories defined', () => {
    assert.ok(ErrorCategory.CRITICAL);
    assert.ok(ErrorCategory.HIGH);
    assert.ok(ErrorCategory.MEDIUM);
    assert.ok(ErrorCategory.LOW);
    assert.ok(ErrorCategory.INFO);
  });

  test('should have all error severities defined', () => {
    assert.ok(ErrorSeverity.BLOCKER);
    assert.ok(ErrorSeverity.CRITICAL);
    assert.ok(ErrorSeverity.MAJOR);
    assert.ok(ErrorSeverity.MINOR);
    assert.ok(ErrorSeverity.TRIVIAL);
  });

  test('should create error location correctly', () => {
    const location = createErrorLocation({
      filePath: '/test/file.js',
      line: 10,
      column: 5,
      context: 'const x = 5'
    });

    assert.strictEqual(location.filePath, '/test/file.js');
    assert.strictEqual(location.line, 10);
    assert.strictEqual(location.column, 5);
    assert.strictEqual(location.context, 'const x = 5');
  });

  test('should create detected error correctly', () => {
    const error = createDetectedError({
      id: 'test_error_1',
      type: ErrorType.SYNTAX,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR,
      message: 'Test error message',
      description: 'Test description',
      location: createErrorLocation({
        filePath: '/test/file.js',
        line: 1,
        column: 1
      })
    });

    assert.strictEqual(error.id, 'test_error_1');
    assert.strictEqual(error.type, ErrorType.SYNTAX);
    assert.strictEqual(error.category, ErrorCategory.HIGH);
    assert.strictEqual(error.severity, ErrorSeverity.MAJOR);
    assert.strictEqual(error.message, 'Test error message');
  });
});

describe('Syntax Analyzer', () => {
  test('should be instantiable', () => {
    const analyzer = new SyntaxAnalyzer();
    assert.ok(analyzer);
  });

  test('should return supported file types', () => {
    const analyzer = new SyntaxAnalyzer();
    const types = analyzer.getSupportedFileTypes();
    
    assert.ok(Array.isArray(types));
    assert.ok(types.includes('.js'));
    assert.ok(types.includes('.ts'));
    assert.ok(types.includes('.py'));
  });

  test('should analyze JavaScript code for syntax errors', async () => {
    const analyzer = new SyntaxAnalyzer();
    const code = `
      function test() {
        if (x = 5) {
          console.log("test")
        }
      }
    `;
    
    const result = await analyzer.analyze(code, '/test.js', 'javascript');
    
    assert.ok(result);
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
  });

  test('should detect bracket matching errors', async () => {
    const analyzer = new SyntaxAnalyzer();
    const code = `
      function test() {
        if (true) {
          console.log("test")
        // missing closing brace
      }
    `;
    
    const result = await analyzer.analyze(code, '/test.js', 'javascript');
    
    // Should detect unclosed bracket
    assert.ok(result.errors.length > 0 || result.warnings.length > 0);
  });
});

describe('Runtime Analyzer', () => {
  test('should be instantiable', () => {
    const analyzer = new RuntimeAnalyzer();
    assert.ok(analyzer);
  });

  test('should return supported file types', () => {
    const analyzer = new RuntimeAnalyzer();
    const types = analyzer.getSupportedFileTypes();
    
    assert.ok(Array.isArray(types));
    assert.ok(types.includes('.js'));
    assert.ok(types.includes('.py'));
  });

  test('should detect potential runtime errors', async () => {
    const analyzer = new RuntimeAnalyzer();
    const code = `
      const user = getUser();
      const name = user.profile.name;
      
      fetchData().then(data => process(data));
      
      while (true) {
        doSomething();
      }
    `;
    
    const result = await analyzer.analyze(code, '/test.js', 'javascript');
    
    assert.ok(result);
    assert.ok(Array.isArray(result.errors));
  });
});

describe('Configuration Validator', () => {
  test('should be instantiable', () => {
    const validator = new ConfigurationValidator();
    assert.ok(validator);
  });

  test('should validate JSON configuration', async () => {
    const validator = new ConfigurationValidator();
    const config = JSON.stringify({
      name: 'test-project',
      version: '1.0.0'
    });
    
    const result = await validator.analyze(config, '/package.json', 'json');
    
    assert.ok(result);
    assert.ok(Array.isArray(result.errors));
    assert.ok(Array.isArray(result.warnings));
  });

  test('should detect invalid JSON', async () => {
    const validator = new ConfigurationValidator();
    const invalidJson = '{ "name": "test", }'; // trailing comma
    
    const result = await validator.analyze(invalidJson, '/config.json', 'json');
    
    // Should detect parse error
    assert.ok(result.errors.length > 0);
  });
});

describe('Error Detection Engine', () => {
  test('should be instantiable', () => {
    const engine = new ErrorDetectionEngine();
    assert.ok(engine);
  });

  test('should register analyzers', () => {
    const engine = new ErrorDetectionEngine();
    const analyzer = new SyntaxAnalyzer();
    
    engine.registerAnalyzer(analyzer);
    
    assert.strictEqual(engine.analyzers.length, 1);
  });

  test('should determine error category from type', () => {
    const engine = new ErrorDetectionEngine();
    
    const securityCategory = engine.determineCategory({ type: ErrorType.SECURITY });
    const syntaxCategory = engine.determineCategory({ type: ErrorType.SYNTAX });
    const perfCategory = engine.determineCategory({ type: ErrorType.PERFORMANCE });
    
    assert.strictEqual(securityCategory, ErrorCategory.CRITICAL);
    assert.strictEqual(syntaxCategory, ErrorCategory.HIGH);
    assert.strictEqual(perfCategory, ErrorCategory.LOW);
  });

  test('should group errors by type', () => {
    const engine = new ErrorDetectionEngine();
    const errors = [
      { type: ErrorType.SYNTAX, message: 'Error 1' },
      { type: ErrorType.SYNTAX, message: 'Error 2' },
      { type: ErrorType.RUNTIME, message: 'Error 3' }
    ];
    
    const grouped = engine.groupErrorsByType(errors);
    
    assert.strictEqual(grouped[ErrorType.SYNTAX].length, 2);
    assert.strictEqual(grouped[ErrorType.RUNTIME].length, 1);
  });
});

describe('Report Generator', () => {
  test('should be instantiable', () => {
    const generator = new ReportGenerator();
    assert.ok(generator);
  });

  test('should generate JSON report', async () => {
    const generator = new ReportGenerator();
    const errors = [
      createDetectedError({
        id: 'test_1',
        type: ErrorType.SYNTAX,
        category: ErrorCategory.HIGH,
        severity: ErrorSeverity.MAJOR,
        message: 'Test error',
        description: 'Test description',
        location: createErrorLocation({
          filePath: '/test.js',
          line: 1,
          column: 1
        })
      })
    ];
    
    const report = await generator.generateJSON(errors, {});
    
    assert.ok(report);
    assert.ok(report.metadata);
    assert.ok(report.summary);
    assert.ok(report.errors);
    assert.strictEqual(report.errors.length, 1);
  });

  test('should generate Markdown report', async () => {
    const generator = new ReportGenerator();
    const errors = [
      createDetectedError({
        id: 'test_1',
        type: ErrorType.SYNTAX,
        category: ErrorCategory.HIGH,
        severity: ErrorSeverity.MAJOR,
        message: 'Test error',
        description: 'Test description',
        location: createErrorLocation({
          filePath: '/test.js',
          line: 1,
          column: 1
        })
      })
    ];
    
    const report = await generator.generateMarkdown(errors, {});
    
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('Error Detection Report'));
    assert.ok(report.includes('Test error'));
  });

  test('should generate HTML report', async () => {
    const generator = new ReportGenerator();
    const errors = [];
    
    const report = await generator.generateHTML(errors, {});
    
    assert.ok(typeof report === 'string');
    assert.ok(report.includes('<!DOCTYPE html>'));
    assert.ok(report.includes('Error Detection Report'));
  });
});

describe('Resolution Engine', () => {
  test('should be instantiable', () => {
    const engine = new ResolutionEngine();
    assert.ok(engine);
  });

  test('should generate resolutions for errors', async () => {
    const engine = new ResolutionEngine();
    const error = createDetectedError({
      id: 'null_reference_1',
      type: ErrorType.RUNTIME,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR,
      message: 'Potential null reference',
      description: 'Accessing property of potentially null value',
      location: createErrorLocation({
        filePath: '/test.js',
        line: 1,
        column: 1
      })
    });
    
    const resolutions = await engine.generateResolutions(error);
    
    assert.ok(Array.isArray(resolutions));
  });

  test('should rank resolutions by effectiveness', () => {
    const engine = new ResolutionEngine();
    const resolutions = [
      { title: 'Low', effectiveness: 50, difficulty: 'easy', estimatedTime: 5 },
      { title: 'High', effectiveness: 100, difficulty: 'easy', estimatedTime: 2 },
      { title: 'Medium', effectiveness: 75, difficulty: 'medium', estimatedTime: 10 }
    ];
    
    const ranked = engine.rankResolutions(resolutions);
    
    assert.strictEqual(ranked[0].title, 'High');
    assert.strictEqual(ranked[1].title, 'Medium');
    assert.strictEqual(ranked[2].title, 'Low');
  });
});

describe('Prevention Strategy Service', () => {
  test('should be instantiable', () => {
    const service = new PreventionStrategyService();
    assert.ok(service);
  });

  test('should return strategies for error types', () => {
    const service = new PreventionStrategyService();
    
    const syntaxStrategies = service.getStrategiesForType(ErrorType.SYNTAX);
    const runtimeStrategies = service.getStrategiesForType(ErrorType.RUNTIME);
    const securityStrategies = service.getStrategiesForType(ErrorType.SECURITY);
    
    assert.ok(Array.isArray(syntaxStrategies));
    assert.ok(Array.isArray(runtimeStrategies));
    assert.ok(Array.isArray(securityStrategies));
    assert.ok(syntaxStrategies.length > 0);
  });

  test('should return tool recommendations', () => {
    const service = new PreventionStrategyService();
    
    const tools = service.getToolRecommendations(ErrorType.SYNTAX);
    
    assert.ok(Array.isArray(tools));
    assert.ok(tools.length > 0);
  });
});

describe('Metrics Analyzer', () => {
  test('should be instantiable', () => {
    const analyzer = new MetricsAnalyzer();
    assert.ok(analyzer);
  });

  test('should track errors', () => {
    const analyzer = new MetricsAnalyzer();
    const error = {
      id: 'test_1',
      type: ErrorType.SYNTAX,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR,
      location: { filePath: '/test.js' }
    };
    
    analyzer.trackError(error);
    
    const frequency = analyzer.getFrequency({});
    assert.strictEqual(frequency.total, 1);
  });

  test('should track resolutions', () => {
    const analyzer = new MetricsAnalyzer();
    const error = {
      id: 'test_1',
      type: ErrorType.SYNTAX,
      category: ErrorCategory.HIGH,
      severity: ErrorSeverity.MAJOR
    };
    
    analyzer.trackError(error);
    analyzer.trackResolution('test_1', { method: 'manual' });
    
    const times = analyzer.getResolutionTimes({});
    assert.strictEqual(times.count, 1);
  });

  test('should generate suggestions', () => {
    const analyzer = new MetricsAnalyzer();
    
    // Add some errors to generate suggestions
    for (let i = 0; i < 20; i++) {
      analyzer.trackError({
        id: `test_${i}`,
        type: ErrorType.SYNTAX,
        category: ErrorCategory.HIGH,
        severity: ErrorSeverity.MAJOR
      });
    }
    
    const suggestions = analyzer.getSuggestions();
    
    assert.ok(Array.isArray(suggestions));
  });
});

describe('Knowledge Base', () => {
  test('should be instantiable', () => {
    const kb = new KnowledgeBase();
    assert.ok(kb);
  });

  test('should have default patterns', () => {
    const kb = new KnowledgeBase();
    const patterns = kb.getAllPatterns();
    
    assert.ok(Array.isArray(patterns));
    assert.ok(patterns.length > 0);
  });

  test('should find patterns for errors', () => {
    const kb = new KnowledgeBase();
    const error = {
      message: 'TypeError: Cannot read property of null',
      description: 'Null reference error'
    };
    
    const patterns = kb.findPatterns(error);
    
    assert.ok(Array.isArray(patterns));
  });

  test('should search patterns by keyword', () => {
    const kb = new KnowledgeBase();
    
    const results = kb.searchPatterns('null');
    
    assert.ok(Array.isArray(results));
  });

  test('should return best practices for languages', () => {
    const kb = new KnowledgeBase();
    
    const jsPractices = kb.getBestPractices('javascript');
    const tsPractices = kb.getBestPractices('typescript');
    
    assert.ok(Array.isArray(jsPractices));
    assert.ok(Array.isArray(tsPractices));
  });
});

describe('Error Handler', () => {
  test('should be instantiable', () => {
    const handler = new ErrorHandler();
    assert.ok(handler);
  });

  test('should classify errors correctly', () => {
    const handler = new ErrorHandler();
    
    const fileError = new Error('ENOENT: no such file');
    fileError.code = 'ENOENT';
    
    const parseError = new Error('Unexpected token');
    parseError.name = 'SyntaxError';
    
    const timeoutError = new Error('Operation timed out');
    timeoutError.name = 'TimeoutError';
    
    assert.strictEqual(
      handler.classifyError(fileError),
      ErrorHandler.SystemErrorType.FILE_ACCESS
    );
    assert.strictEqual(
      handler.classifyError(parseError),
      ErrorHandler.SystemErrorType.PARSER
    );
    assert.strictEqual(
      handler.classifyError(timeoutError),
      ErrorHandler.SystemErrorType.TIMEOUT
    );
  });

  test('should handle errors with recovery', async () => {
    const handler = new ErrorHandler();
    const error = new Error('Test error');
    
    // Add error listener to prevent unhandled error
    handler.on('error', () => {});
    
    const recovery = await handler.handleError(error, { operation: 'test' });
    
    assert.ok(recovery);
    assert.ok(recovery.action);
  });

  test('should execute with retry', async () => {
    const handler = new ErrorHandler();
    let attempts = 0;
    
    const operation = async () => {
      attempts++;
      if (attempts < 2) {
        const error = new Error('Temporary failure');
        error.code = 'ETIMEDOUT';
        throw error;
      }
      return 'success';
    };
    
    const result = await handler.withRetry(operation, {
      retryConfig: { maxRetries: 3, initialDelay: 10 }
    });
    
    assert.strictEqual(result, 'success');
    assert.strictEqual(attempts, 2);
  });

  test('should get error statistics', () => {
    const handler = new ErrorHandler();
    
    handler.logError(new Error('Test 1'), 'file_access', {});
    handler.logError(new Error('Test 2'), 'parser', {});
    
    const stats = handler.getStatistics();
    
    assert.strictEqual(stats.total, 2);
    assert.ok(stats.byType);
  });
});

console.log('All tests defined. Run with: node --test server/services/error-detection/error-detection.test.js');
