# Error Detection System

A comprehensive error detection, categorization, and resolution guidance system for software development projects.

## Features

- **Multi-language Support**: JavaScript, TypeScript, Python, Java, JSON, YAML
- **Error Categories**: Syntax, Runtime, Logical, Configuration, Security, Performance
- **Real-time Monitoring**: Watch files for changes and detect errors automatically
- **Resolution Guidance**: Step-by-step solutions for detected errors
- **Prevention Strategies**: Proactive measures to avoid common errors
- **Report Generation**: Export reports in Markdown, JSON, or HTML formats
- **Metrics & Analytics**: Track error trends and get improvement suggestions

## Quick Start

```javascript
const {
  ErrorDetectionEngine,
  SyntaxAnalyzer,
  RuntimeAnalyzer,
  ConfigurationValidator,
  ReportGenerator
} = require('./services/error-detection');

// Create and configure engine
const engine = new ErrorDetectionEngine();
engine.registerAnalyzer(new SyntaxAnalyzer());
engine.registerAnalyzer(new RuntimeAnalyzer());
engine.registerAnalyzer(new ConfigurationValidator());

// Scan a project
const result = await engine.scanProject('./my-project');

console.log(`Found ${result.errors.length} errors`);
console.log(`Found ${result.warnings.length} warnings`);

// Generate report
const generator = new ReportGenerator();
const report = await generator.generateMarkdown(result.errors, {
  includeResolutions: true,
  includePrevention: true
});

console.log(report);
```

## Components

### ErrorDetectionEngine

The core engine that orchestrates error detection across different analyzers.

```javascript
const engine = new ErrorDetectionEngine({
  ignorePatterns: ['node_modules', '.git', 'dist'],
  maxFileSize: 1024 * 1024 // 1MB
});

// Register analyzers
engine.registerAnalyzer(new SyntaxAnalyzer());

// Scan project
const result = await engine.scanProject('./project');

// Scan single file
const fileResult = await engine.scanFile('./file.js');

// Watch for changes
const handle = engine.watchProject('./project', (event) => {
  console.log('File changed:', event.filePath);
  console.log('Errors:', event.errors);
});

// Stop watching
engine.stopWatching(handle);
```

### Analyzers

#### SyntaxAnalyzer

Detects syntax errors in code files.

```javascript
const analyzer = new SyntaxAnalyzer();
const result = await analyzer.analyze(code, '/path/to/file.js', 'javascript');
```

#### RuntimeAnalyzer

Detects potential runtime errors, memory leaks, and performance issues.

```javascript
const analyzer = new RuntimeAnalyzer();
const result = await analyzer.analyze(code, '/path/to/file.js', 'javascript');
```

#### ConfigurationValidator

Validates configuration files against schemas and best practices.

```javascript
const validator = new ConfigurationValidator();
const result = await validator.analyze(jsonContent, '/path/to/config.json', 'json');
```

### ReportGenerator

Generates reports in multiple formats.

```javascript
const generator = new ReportGenerator();

// Markdown report
const markdown = await generator.generateMarkdown(errors, options);

// JSON report
const json = await generator.generateJSON(errors, options);

// HTML report with interactive elements
const html = await generator.generateHTML(errors, options);
```

### RealTimeMonitor

Provides real-time error monitoring with notifications.

```javascript
const monitor = new RealTimeMonitor(engine, {
  debounceMs: 300,
  notifyOnCritical: true
});

// Start monitoring
const handle = monitor.start('./project');

// Listen for events
monitor.on('error:detected', (event) => {
  console.log('New error:', event.error);
});

monitor.on('error:fixed', (event) => {
  console.log('Error fixed:', event.error);
});

monitor.on('error:critical', (event) => {
  console.log('CRITICAL:', event.errors);
});

// Get current status
const status = monitor.getStatus();

// Stop monitoring
monitor.stop(handle);
```

### ResolutionEngine

Generates solutions for detected errors.

```javascript
const engine = new ResolutionEngine();

// Get resolutions for an error
const resolutions = await engine.generateResolutions(error);

// Get complete resolution package
const complete = await engine.generateCompleteResolution(error);
console.log(complete.primaryResolution);
console.log(complete.validationSteps);
```

### PreventionStrategyService

Provides prevention strategies for error types.

```javascript
const service = new PreventionStrategyService();

// Get strategies for error type
const strategies = service.getStrategiesForType('syntax');

// Get tool recommendations
const tools = service.getToolRecommendations('runtime');

// Generate prevention plan
const plan = service.generatePreventionPlan(errors);
```

### MetricsAnalyzer

Tracks error metrics and provides analytics.

```javascript
const analyzer = new MetricsAnalyzer();

// Track errors
analyzer.trackError(error);

// Track resolutions
analyzer.trackResolution(errorId, { method: 'manual' });

// Get frequency data
const frequency = analyzer.getFrequency({ period: 'day' });

// Get trends
const trends = analyzer.getTrends({ period: 'week' });

// Get suggestions
const suggestions = analyzer.getSuggestions();
```

### KnowledgeBase

Stores error patterns and solutions.

```javascript
const kb = new KnowledgeBase();

// Find patterns for an error
const patterns = kb.findPatterns(error);

// Get solutions
const solutions = kb.getSolutions(patternId);

// Search patterns
const results = kb.searchPatterns('null reference');

// Get best practices
const practices = kb.getBestPractices('javascript');
```

### ErrorHandler

Provides error handling with retry and recovery.

```javascript
const handler = new ErrorHandler();

// Execute with retry
const result = await handler.withRetry(operation, {
  retryConfig: { maxRetries: 3 }
});

// Execute with timeout
const result = await handler.withTimeout(operation, 5000);

// Execute with graceful degradation
const { result, degraded } = await handler.withGracefulDegradation(
  primaryOperation,
  fallbackOperation
);
```

## CLI Usage

```bash
# Scan a project
node cli.js scan ./my-project

# Scan with specific format
node cli.js scan -f json -o report.json ./my-project

# Watch for changes
node cli.js watch ./my-project

# Verbose output
node cli.js scan -V ./my-project

# Ignore patterns
node cli.js scan --ignore dist --ignore coverage ./my-project
```

## API Endpoints

The system provides REST API endpoints for integration:

- `POST /api/error-detection/scan` - Scan a project
- `POST /api/error-detection/scan-file` - Scan a single file
- `POST /api/error-detection/report` - Generate a report
- `POST /api/error-detection/monitor/start` - Start monitoring
- `POST /api/error-detection/monitor/stop` - Stop monitoring
- `GET /api/error-detection/monitor/status` - Get monitor status
- `GET /api/error-detection/metrics` - Get error metrics
- `GET /api/error-detection/suggestions` - Get improvement suggestions
- `POST /api/error-detection/resolve` - Get resolutions for an error
- `GET /api/error-detection/prevention/:errorType` - Get prevention strategies
- `GET /api/error-detection/knowledge/patterns` - Search patterns
- `GET /api/error-detection/knowledge/solutions/:patternId` - Get solutions
- `GET /api/error-detection/knowledge/best-practices/:language` - Get best practices

## Error Types

| Type | Description |
|------|-------------|
| `syntax` | Code syntax errors |
| `runtime` | Potential runtime errors |
| `logical` | Logic errors |
| `configuration` | Configuration file errors |
| `security` | Security vulnerabilities |
| `performance` | Performance issues |
| `accessibility` | Accessibility issues |
| `compatibility` | Compatibility issues |

## Error Severities

| Severity | Description |
|----------|-------------|
| `blocker` | Application cannot function |
| `critical` | Major functionality affected |
| `major` | Some functionality affected |
| `minor` | Minor inconvenience |
| `trivial` | Cosmetic or informational |

## Testing

```bash
# Run tests
node --test server/services/error-detection/error-detection.test.js
```

## License

MIT
