#!/usr/bin/env node

/**
 * Error Detection CLI
 * 
 * Command-line interface for project scanning, error detection,
 * and report generation.
 * 
 * @module error-detection/cli
 */

const path = require('path');
const fs = require('fs');
const ErrorDetectionEngine = require('./ErrorDetectionEngine');
const { SyntaxAnalyzer, RuntimeAnalyzer, ConfigurationValidator } = require('./analyzers');
const ReportGenerator = require('./ReportGenerator');
const { ExportFormat } = require('./types');

/**
 * CLI configuration
 */
const CLI_CONFIG = {
  name: 'error-detect',
  version: '1.0.0',
  description: 'Software Error Detection System'
};

/**
 * Parses command line arguments
 * @param {string[]} args - Command line arguments
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {
    command: 'scan',
    path: '.',
    format: 'markdown',
    output: null,
    verbose: false,
    watch: false,
    help: false,
    version: false,
    ignore: [],
    include: []
  };
  
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true;
        break;
      case '-v':
      case '--version':
        options.version = true;
        break;
      case '-V':
      case '--verbose':
        options.verbose = true;
        break;
      case '-w':
      case '--watch':
        options.watch = true;
        break;
      case '-f':
      case '--format':
        options.format = args[++i];
        break;
      case '-o':
      case '--output':
        options.output = args[++i];
        break;
      case '-i':
      case '--ignore':
        options.ignore.push(args[++i]);
        break;
      case '--include':
        options.include.push(args[++i]);
        break;
      case 'scan':
      case 'watch':
      case 'report':
        options.command = arg;
        break;
      default:
        if (!arg.startsWith('-')) {
          options.path = arg;
        }
        break;
    }
    i++;
  }
  
  return options;
}

/**
 * Prints help message
 */
function printHelp() {
  console.log(`
${CLI_CONFIG.name} v${CLI_CONFIG.version}
${CLI_CONFIG.description}

Usage:
  ${CLI_CONFIG.name} [command] [options] [path]

Commands:
  scan     Scan a project for errors (default)
  watch    Watch a project for changes and scan continuously
  report   Generate a report from the last scan

Options:
  -h, --help          Show this help message
  -v, --version       Show version number
  -V, --verbose       Enable verbose output
  -f, --format <fmt>  Output format: markdown, json, html (default: markdown)
  -o, --output <file> Write output to file instead of stdout
  -w, --watch         Watch for file changes
  -i, --ignore <pat>  Ignore pattern (can be used multiple times)
  --include <pat>     Include pattern (can be used multiple times)

Examples:
  ${CLI_CONFIG.name} scan ./my-project
  ${CLI_CONFIG.name} scan -f json -o report.json ./src
  ${CLI_CONFIG.name} watch ./my-project
  ${CLI_CONFIG.name} scan -V --ignore node_modules --ignore dist .
`);
}

/**
 * Prints version
 */
function printVersion() {
  console.log(`${CLI_CONFIG.name} v${CLI_CONFIG.version}`);
}

/**
 * Creates the error detection engine with analyzers
 * @param {Object} options - CLI options
 * @returns {ErrorDetectionEngine} Configured engine
 */
function createEngine(options) {
  const engine = new ErrorDetectionEngine({
    ignorePatterns: [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      ...options.ignore
    ]
  });
  
  // Register analyzers
  engine.registerAnalyzer(new SyntaxAnalyzer());
  engine.registerAnalyzer(new RuntimeAnalyzer());
  engine.registerAnalyzer(new ConfigurationValidator());
  
  return engine;
}

/**
 * Formats duration in human readable format
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Prints scan summary to console
 * @param {Object} result - Scan result
 * @param {Object} options - CLI options
 */
function printSummary(result, options) {
  const { errors, warnings, metrics } = result;
  
  console.log('\n=== Scan Summary ===\n');
  console.log(`Files scanned: ${metrics.totalFiles}`);
  console.log(`Files with errors: ${metrics.filesWithErrors}`);
  console.log(`Total errors: ${errors.length}`);
  console.log(`Total warnings: ${warnings.length}`);
  console.log(`Scan duration: ${formatDuration(metrics.scanDuration)}`);
  
  if (options.verbose) {
    console.log('\nErrors by type:');
    for (const [type, count] of Object.entries(metrics.errorsByType || {})) {
      console.log(`  ${type}: ${count}`);
    }
    
    console.log('\nErrors by severity:');
    for (const [severity, count] of Object.entries(metrics.errorsBySeverity || {})) {
      console.log(`  ${severity}: ${count}`);
    }
  }
  
  if (errors.length > 0) {
    console.log('\n=== Errors ===\n');
    for (const error of errors.slice(0, options.verbose ? errors.length : 10)) {
      const location = error.location 
        ? `${error.location.filePath}:${error.location.line}:${error.location.column}`
        : 'unknown';
      console.log(`[${error.severity}] ${error.message}`);
      console.log(`  Location: ${location}`);
      if (options.verbose && error.description) {
        console.log(`  Description: ${error.description}`);
      }
      console.log('');
    }
    
    if (!options.verbose && errors.length > 10) {
      console.log(`... and ${errors.length - 10} more errors`);
    }
  }
}

/**
 * Writes output to file or stdout
 * @param {string} content - Content to write
 * @param {string|null} outputPath - Output file path
 */
function writeOutput(content, outputPath) {
  if (outputPath) {
    fs.writeFileSync(outputPath, content, 'utf-8');
    console.log(`Report written to: ${outputPath}`);
  } else {
    console.log(content);
  }
}

/**
 * Runs the scan command
 * @param {Object} options - CLI options
 */
async function runScan(options) {
  const projectPath = path.resolve(options.path);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Path does not exist: ${projectPath}`);
    process.exit(1);
  }
  
  console.log(`Scanning: ${projectPath}`);
  if (options.verbose) {
    console.log(`Format: ${options.format}`);
    console.log(`Ignore patterns: ${options.ignore.join(', ') || 'default'}`);
  }
  
  const engine = createEngine(options);
  const startTime = Date.now();
  
  try {
    const result = await engine.scanProject(projectPath);
    
    // Print summary
    printSummary(result, options);
    
    // Generate report if output specified or format is not markdown
    if (options.output || options.format !== 'markdown') {
      const generator = new ReportGenerator();
      const formatMap = {
        markdown: ExportFormat.MARKDOWN,
        json: ExportFormat.JSON,
        html: ExportFormat.HTML
      };
      
      const report = await generator.generate(result.errors, {
        format: formatMap[options.format] || ExportFormat.MARKDOWN
      });
      
      const content = typeof report === 'object' 
        ? JSON.stringify(report, null, 2) 
        : report;
      
      writeOutput(content, options.output);
    }
    
    // Exit with error code if errors found
    if (result.errors.length > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error(`Scan failed: ${error.message}`);
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

/**
 * Runs the watch command
 * @param {Object} options - CLI options
 */
async function runWatch(options) {
  const projectPath = path.resolve(options.path);
  
  if (!fs.existsSync(projectPath)) {
    console.error(`Error: Path does not exist: ${projectPath}`);
    process.exit(1);
  }
  
  console.log(`Watching: ${projectPath}`);
  console.log('Press Ctrl+C to stop\n');
  
  const engine = createEngine(options);
  
  // Initial scan
  const result = await engine.scanProject(projectPath);
  printSummary(result, options);
  
  // Start watching
  const handle = engine.watchProject(projectPath, (event) => {
    console.log(`\n[${new Date().toISOString()}] File changed: ${event.filePath}`);
    
    if (event.errors.length > 0) {
      console.log(`Found ${event.errors.length} error(s):`);
      for (const error of event.errors) {
        console.log(`  [${error.severity}] ${error.message}`);
      }
    } else {
      console.log('No errors found');
    }
  });
  
  // Handle exit
  process.on('SIGINT', () => {
    console.log('\nStopping watch...');
    engine.stopWatching(handle);
    process.exit(0);
  });
}

/**
 * Main CLI entry point
 * @param {string[]} args - Command line arguments
 */
async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    return;
  }
  
  if (options.version) {
    printVersion();
    return;
  }
  
  switch (options.command) {
    case 'scan':
      await runScan(options);
      break;
    case 'watch':
      await runWatch(options);
      break;
    case 'report':
      // Report command would load cached results
      console.log('Report command not yet implemented');
      break;
    default:
      console.error(`Unknown command: ${options.command}`);
      printHelp();
      process.exit(1);
  }
}

// Export for testing
module.exports = {
  main,
  parseArgs,
  createEngine,
  CLI_CONFIG
};

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}
