# Implementation Plan

- [x] 1. Set up core infrastructure and utilities
  - Create `cleanup-analyzer/` directory structure
  - Implement file scanner utility with recursive directory traversal
  - Implement import parser for JavaScript and TypeScript files
  - Create dependency graph builder with node and edge management
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Implement LegacyFileAnalyzer
- [x] 2.1 Create LegacyFileAnalyzer class with core methods
  - Implement constructor with project root configuration
  - Create `analyzeDirectory()` method for scanning directories
  - Create `findUnreferencedComponents()` using dependency graph
  - Create `findObsoleteTestFiles()` for test artifact detection
  - Create `findTemporaryDocuments()` with pattern matching
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2.2 Implement markdown file detection logic
  - Pattern matching for `*_SUMMARY.md`, `*_SUCCESS.md`, `DEPLOY_*.md`, `RELEASE_*.md`
  - Validate files are not in `docs/archived/` or current documentation
  - _Requirements: 1.1, 5.4_

- [x] 2.3 Implement component reference detection
  - Parse all imports in `src/` directory
  - Build component dependency graph
  - Identify components with zero incoming references
  - _Requirements: 1.3_

- [x] 2.4 Implement test artifact detection
  - Scan for `*.db-shm` and `*.db-wal` files
  - Identify standalone `test-*.js` files in `server/` root
  - _Requirements: 1.2, 4.1, 4.4_

- [x] 3. Implement RouteConventionAnalyzer
- [x] 3.1 Create RouteConventionAnalyzer class
  - Implement constructor with routes directory path
  - Create `analyzeRouteFiles()` method to scan all route files
  - Create `validateNamingConvention()` for filename validation
  - Create `validateRoutePrefix()` for endpoint prefix checking
  - Create `validateErrorHandling()` for try-catch verification
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.2 Implement naming convention validation
  - Check files match `[role][Feature]Routes.js` pattern
  - Identify files not following convention
  - Generate rename suggestions
  - _Requirements: 2.1, 2.5_

- [x] 3.3 Implement route prefix validation
  - Parse route definitions using AST
  - Verify admin routes use `/api/admin/` prefix
  - Verify user routes use `/api/user/` or `/api/` prefix
  - _Requirements: 2.2, 2.3, 2.5_

- [x] 3.4 Implement error handling validation
  - Parse route handlers using AST
  - Check for try-catch blocks
  - Verify logger usage in catch blocks
  - _Requirements: 2.4, 2.5_

- [x] 4. Implement DirectoryStructureAnalyzer
- [x] 4.1 Create DirectoryStructureAnalyzer class
  - Implement constructor with project root
  - Create `analyzeComponentStructure()` for frontend components
  - Create `analyzeRouteStructure()` for backend routes
  - Create `analyzeTestStructure()` for test organization
  - Create `suggestRelocations()` to generate move suggestions
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4.2 Implement component structure validation
  - Verify components are in `admin/`, `user/`, `shared/`, `features/`, or `ui/`
  - Identify misplaced components
  - Generate relocation suggestions with updated import paths
  - _Requirements: 3.1, 3.4, 3.5_

- [x] 4.3 Implement route structure validation
  - Verify all routes are in `server/routes/`
  - Check for route files in incorrect locations
  - _Requirements: 3.2, 3.4_

- [x] 4.4 Implement test structure validation
  - Verify tests are in `server/tests/{integration,routes,services}/`
  - Identify tests in incorrect locations
  - _Requirements: 3.3, 3.4_

- [x] 5. Implement TestFileAnalyzer
- [x] 5.1 Create TestFileAnalyzer class
  - Implement constructor with server directory path
  - Create `findStandaloneTests()` for root-level test files
  - Create `findDuplicateTests()` for equivalent test detection
  - Create `findTestArtifacts()` for database files
  - Create `getConsolidationPlan()` for migration suggestions
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5.2 Implement standalone test detection
  - Scan `server/` root for `test-*.js` files
  - Check for equivalent tests in `server/tests/`
  - Compare test coverage using AST analysis
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5.3 Implement test artifact cleanup
  - Identify all `*.db-shm` and `*.db-wal` files
  - Mark for removal with justification
  - _Requirements: 4.4_

- [x] 6. Implement DocumentationAnalyzer
- [x] 6.1 Create DocumentationAnalyzer class
  - Implement constructor with project root
  - Create `analyzeRootDocs()` for root-level markdown files
  - Create `analyzeDocsDirectory()` for docs/ folder
  - Create `findDuplicateContent()` for similarity detection
  - Create `getArchiveCandidates()` for archival suggestions
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 6.2 Implement temporary document detection
  - Pattern matching for temporary files
  - Check last modified date
  - Verify no references in current documentation
  - _Requirements: 5.1, 5.4_

- [x] 6.3 Implement duplicate documentation detection
  - Compare file content similarity using text diff
  - Identify newer versions of same content
  - _Requirements: 5.2, 5.3_

- [x] 6.4 Implement archival suggestions
  - Identify historical documentation
  - Suggest moving to `docs/archived/` instead of deletion
  - _Requirements: 5.5_

- [x] 7. Implement CodeQualityAnalyzer
- [x] 7.1 Create CodeQualityAnalyzer class
  - Implement constructor with project root
  - Create `findUnusedImports()` for import analysis
  - Create `findCommentedCode()` for commented block detection
  - Create `analyzeCodeQuality()` for full analysis
  - Create `getCleanupSuggestions()` for recommendations
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 7.2 Implement unused import detection
  - Parse TypeScript files using `@babel/parser`
  - Build AST and identify imported symbols
  - Check if symbols are referenced in code
  - Flag unused imports for removal
  - _Requirements: 6.1, 6.2_

- [x] 7.3 Implement commented code detection
  - Scan for blocks of 5+ consecutive commented lines
  - Distinguish between explanatory comments and commented code
  - Preserve valuable comments, flag dead code
  - _Requirements: 6.3, 6.4, 6.5_

- [x] 8. Implement ConfigurationAnalyzer
- [x] 8.1 Create ConfigurationAnalyzer class
  - Implement constructor with project root
  - Create `analyzeEnvFiles()` for environment variable validation
  - Create `findDuplicateConfigs()` for duplicate detection
  - Create `validateScripts()` for script analysis
  - Create `getConsolidationPlan()` for consolidation suggestions
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.2 Implement environment file analysis
  - Parse `.env`, `server/.env`, `.env.example`, `.env.production`
  - Identify duplicate variables across files
  - Flag conflicting values
  - _Requirements: 7.1, 7.2, 7.3_

- [x] 8.3 Implement script validation
  - Analyze `scripts/archive/` for obsolete scripts
  - Check if archived scripts are still referenced
  - Suggest permanent removal for unused scripts
  - _Requirements: 7.4, 7.5_

- [x] 9. Implement dependency validation and impact assessment
- [x] 9.1 Create DependencyValidator class
  - Implement `validateRemoval()` to check file dependencies
  - Create `getDependents()` to find files that import target
  - Ensure no file is marked for removal if it has dependents
  - _Requirements: 1.5_

- [x] 9.2 Create ImpactValidator class
  - Implement impact level assessment (low, medium, high)
  - Categorize by file type (docs=low, routes=high)
  - Generate impact reports for each cleanup item
  - _Requirements: 8.4_

- [x] 10. Implement report generation system
- [x] 10.1 Create CleanupReporter class
  - Implement constructor with analysis results
  - Create `generateMarkdownReport()` for full report
  - Create section generators for each category
  - Include execution commands in report
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 10.2 Implement report formatting
  - Generate executive summary with totals
  - Create categorized tables for each analysis type
  - Include justifications and impact levels
  - Add execution commands for approved changes
  - _Requirements: 8.1, 8.2, 8.3, 8.5_

- [x] 10.3 Implement execution script generation
  - Generate bash scripts for file removal
  - Generate scripts for file relocation with import updates
  - Include rollback mechanism
  - _Requirements: 8.5_

- [x] 11. Create main orchestrator and CLI
- [x] 11.1 Implement main CleanupAnalyzer orchestrator
  - Create `runFullAnalysis()` method to execute all analyzers
  - Coordinate analysis phases in correct order
  - Aggregate results from all analyzers
  - Handle errors gracefully and continue analysis
  - _Requirements: 8.1_

- [x] 11.2 Create CLI interface
  - Implement command-line argument parsing
  - Support options for specific analysis types
  - Add progress reporting for long-running analysis
  - Output report to file or stdout
  - _Requirements: 8.1_

- [x] 12. Add error handling and logging
  - Implement graceful error handling for file read failures
  - Add logging for analysis progress
  - Track skipped files with reasons
  - Ensure analysis continues even if individual files fail
  - _Requirements: 1.5, 8.1_

- [x] 13. Integrate with project and generate initial report
  - Run full analysis on WUZAPI Manager codebase
  - Generate comprehensive cleanup report
  - Review report for false positives
  - Validate dependency graph accuracy
  - Create execution plan for approved changes
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
