# Design Document - Code Cleanup and Organization

## Overview

This design document outlines the approach for analyzing, identifying, and removing legacy code from the WUZAPI Manager project. The system will perform static code analysis to identify obsolete files, validate code conventions, and generate actionable reports for cleanup. This is a preparatory step before production deployment, ensuring the codebase is clean, organized, and maintainable.

**Key Principle**: This is an analysis and reporting tool, not an automated cleanup system. All changes require manual review and approval before execution.

## Architecture

### High-Level Design

The cleanup system follows a **multi-phase analysis pipeline**:

```
Phase 1: Discovery → Phase 2: Analysis → Phase 3: Validation → Phase 4: Reporting
```

Each phase produces intermediate results that feed into the next phase, allowing for modular execution and debugging.

### System Components

```
cleanup-analyzer/
├── analyzers/
│   ├── LegacyFileAnalyzer.js      # Identifies obsolete files
│   ├── RouteConventionAnalyzer.js # Validates route patterns
│   ├── DirectoryStructureAnalyzer.js # Checks organization
│   ├── TestFileAnalyzer.js        # Consolidates test files
│   ├── DocumentationAnalyzer.js   # Reviews docs
│   ├── CodeQualityAnalyzer.js     # Finds unused imports/comments
│   └── ConfigurationAnalyzer.js   # Validates configs
├── validators/
│   ├── DependencyValidator.js     # Checks file dependencies
│   └── ImpactValidator.js         # Estimates change impact
├── reporters/
│   └── CleanupReporter.js         # Generates markdown reports
├── utils/
│   ├── fileScanner.js             # File system traversal
│   ├── importParser.js            # Parse import/require statements
│   └── astAnalyzer.js             # AST-based code analysis
└── index.js                        # Main orchestrator
```

## Components and Interfaces

### 1. LegacyFileAnalyzer

**Purpose**: Identify obsolete, unused, or duplicate files across the project.

**Interface**:
```javascript
class LegacyFileAnalyzer {
  constructor(projectRoot, options = {})
  
  async analyzeDirectory(dirPath)
  async findUnreferencedComponents()
  async findObsoleteTestFiles()
  async findTemporaryDocuments()
  
  getResults() // Returns categorized list of legacy files
}
```

**Analysis Strategy**:
- **Markdown Files**: Pattern matching for temporary files (`*_SUMMARY.md`, `*_SUCCESS.md`, `DEPLOY_*.md`, `RELEASE_*.md`)
- **Test Files**: Identify standalone `test-*.js` in `server/` root that have equivalents in `server/tests/`
- **Components**: Parse all imports in `src/` to build dependency graph, flag unreferenced components
- **Database Files**: Identify test database artifacts (`*.db-shm`, `*.db-wal`)

**Decision Rationale**: Static analysis is safer than runtime analysis for identifying unused code, as it doesn't require executing potentially broken code.

### 2. RouteConventionAnalyzer

**Purpose**: Validate that backend routes follow established naming and organizational conventions.

**Interface**:
```javascript
class RouteConventionAnalyzer {
  constructor(routesDir)
  
  async analyzeRouteFiles()
  validateNamingConvention(filename)
  validateRoutePrefix(routeFile, expectedPrefix)
  validateErrorHandling(routeFile)
  
  getViolations() // Returns list of convention violations
}
```

**Validation Rules**:
1. **Naming**: Files must match `[role][Feature]Routes.js` (e.g., `adminUserRoutes.js`, `userMessageRoutes.js`)
2. **Prefixes**: 
   - Admin routes: `/api/admin/*`
   - User routes: `/api/user/*` or `/api/*`
   - Public routes: `/api/public/*`
3. **Error Handling**: All route handlers must have try-catch with logger
4. **Middleware**: Authentication middleware must be applied

**Decision Rationale**: Convention validation ensures consistency and makes the codebase easier to navigate for new developers.

### 3. DirectoryStructureAnalyzer

**Purpose**: Verify files are in the correct directories according to project conventions.

**Interface**:
```javascript
class DirectoryStructureAnalyzer {
  constructor(projectRoot)
  
  async analyzeComponentStructure()
  async analyzeRouteStructure()
  async analyzeTestStructure()
  
  suggestRelocations() // Returns files that should be moved
}
```

**Structure Rules**:
- **Frontend Components**: Must be in `admin/`, `user/`, `shared/`, `features/`, or `ui/`
- **Backend Routes**: All in `server/routes/`
- **Tests**: Organized in `server/tests/{integration,routes,services}/`
- **Services**: Business logic in `server/services/`

**Decision Rationale**: Enforcing directory structure prevents "junk drawer" directories and maintains clear separation of concerns.

### 4. TestFileAnalyzer

**Purpose**: Identify duplicate or obsolete test files and suggest consolidation.

**Interface**:
```javascript
class TestFileAnalyzer {
  constructor(serverDir)
  
  async findStandaloneTests()
  async findDuplicateTests()
  async findTestArtifacts()
  
  getConsolidationPlan() // Returns test migration suggestions
}
```

**Analysis Strategy**:
1. Scan `server/` root for `test-*.js` files
2. Check if equivalent tests exist in `server/tests/`
3. Compare test coverage using AST analysis
4. Flag database artifacts (`*.db-shm`, `*.db-wal`)

**Decision Rationale**: Consolidating tests into `server/tests/` improves discoverability and allows for better test organization.

### 5. DocumentationAnalyzer

**Purpose**: Identify obsolete, duplicate, or outdated documentation.

**Interface**:
```javascript
class DocumentationAnalyzer {
  constructor(projectRoot)
  
  async analyzeRootDocs()
  async analyzeDocsDirectory()
  async findDuplicateContent()
  
  getArchiveCandidates() // Returns docs to archive/remove
}
```

**Analysis Strategy**:
- **Temporary Docs**: Files matching `*_SUMMARY.md`, `*_SUCCESS.md`, `DEPLOY_*.md`, `RELEASE_*.md`
- **Duplicate Content**: Compare file content similarity using text diff
- **Outdated Docs**: Check last modified date and references to old versions
- **Archive Candidates**: Historical docs that should move to `docs/archived/`

**Decision Rationale**: Clean documentation improves onboarding and reduces confusion about which docs are current.

### 6. CodeQualityAnalyzer

**Purpose**: Find unused imports, commented code, and other code quality issues.

**Interface**:
```javascript
class CodeQualityAnalyzer {
  constructor(projectRoot)
  
  async findUnusedImports(filePath)
  async findCommentedCode(filePath)
  async analyzeCodeQuality()
  
  getCleanupSuggestions() // Returns code quality improvements
}
```

**Analysis Strategy**:
- **Unused Imports**: Parse AST to find imports/requires not referenced in code
- **Commented Code**: Detect blocks of 5+ consecutive commented lines
- **Distinction**: Preserve explanatory comments, flag commented-out code

**Tools**: 
- `@babel/parser` for JavaScript/TypeScript AST
- `eslint` rules for unused variables

**Decision Rationale**: Removing unused imports and commented code reduces noise and improves code readability.

### 7. ConfigurationAnalyzer

**Purpose**: Validate and consolidate configuration files.

**Interface**:
```javascript
class ConfigurationAnalyzer {
  constructor(projectRoot)
  
  async analyzeEnvFiles()
  async findDuplicateConfigs()
  async validateScripts()
  
  getConsolidationPlan() // Returns config consolidation suggestions
}
```

**Analysis Strategy**:
- **Env Files**: Compare `.env`, `server/.env`, `.env.example`, `.env.production`
- **Duplicate Variables**: Flag variables defined in multiple places
- **Archived Scripts**: Review `scripts/archive/` for permanent removal
- **Conflicts**: Identify conflicting values between environments

**Decision Rationale**: Single source of truth for configuration prevents deployment issues and confusion.

## Data Models

### Analysis Result Structure

```typescript
interface AnalysisResult {
  category: 'legacy' | 'convention' | 'structure' | 'test' | 'docs' | 'quality' | 'config'
  severity: 'low' | 'medium' | 'high'
  items: AnalysisItem[]
  summary: {
    totalIssues: number
    byCategory: Record<string, number>
    estimatedImpact: 'low' | 'medium' | 'high'
  }
}

interface AnalysisItem {
  type: 'remove' | 'move' | 'consolidate' | 'fix'
  path: string
  reason: string
  suggestion: string
  impact: 'low' | 'medium' | 'high'
  dependencies: string[]
  autoFixable: boolean
}
```

### Dependency Graph

```typescript
interface DependencyGraph {
  nodes: Map<string, FileNode>
  edges: Map<string, Set<string>>
  
  addFile(path: string, metadata: FileMetadata): void
  addDependency(from: string, to: string): void
  getDependents(path: string): string[]
  isOrphaned(path: string): boolean
}

interface FileNode {
  path: string
  type: 'component' | 'route' | 'service' | 'util' | 'test' | 'doc'
  imports: string[]
  exports: string[]
  lastModified: Date
}
```

## Error Handling

### Validation Errors

**Strategy**: Fail gracefully on individual file analysis errors, continue with remaining files.

```javascript
try {
  const result = await analyzer.analyzeFile(filePath)
  results.push(result)
} catch (error) {
  logger.warn(`Failed to analyze ${filePath}`, { error: error.message })
  skippedFiles.push({ path: filePath, reason: error.message })
}
```

### Dependency Validation

**Strategy**: Before marking a file for removal, validate it has no dependents.

```javascript
function validateRemoval(filePath, dependencyGraph) {
  const dependents = dependencyGraph.getDependents(filePath)
  
  if (dependents.length > 0) {
    return {
      safe: false,
      reason: `File is imported by: ${dependents.join(', ')}`,
      impact: 'high'
    }
  }
  
  return { safe: true, impact: 'low' }
}
```

### Impact Assessment

**Levels**:
- **Low**: Documentation, test artifacts, archived scripts
- **Medium**: Standalone test files, unused components
- **High**: Routes, services, shared utilities

## Testing Strategy

### Unit Tests

**Scope**: Test each analyzer independently with mock file systems.

```javascript
describe('LegacyFileAnalyzer', () => {
  it('should identify temporary markdown files', async () => {
    const analyzer = new LegacyFileAnalyzer(mockProjectRoot)
    const results = await analyzer.findTemporaryDocuments()
    
    expect(results).toContainEqual({
      path: 'DEPLOY_SUCCESS_v1.4.5.md',
      type: 'remove',
      reason: 'Temporary deployment document'
    })
  })
  
  it('should not flag current documentation', async () => {
    const analyzer = new LegacyFileAnalyzer(mockProjectRoot)
    const results = await analyzer.findTemporaryDocuments()
    
    expect(results).not.toContainEqual(
      expect.objectContaining({ path: 'README.md' })
    )
  })
})
```

### Integration Tests

**Scope**: Test full analysis pipeline on sample project structure.

```javascript
describe('Cleanup Analysis Pipeline', () => {
  it('should generate complete cleanup report', async () => {
    const analyzer = new CleanupAnalyzer(testProjectRoot)
    const report = await analyzer.runFullAnalysis()
    
    expect(report).toHaveProperty('legacy')
    expect(report).toHaveProperty('conventions')
    expect(report).toHaveProperty('structure')
    expect(report.summary.totalIssues).toBeGreaterThan(0)
  })
})
```

### Manual Validation

**Process**:
1. Run analyzer on actual WUZAPI Manager codebase
2. Review generated report for false positives
3. Manually verify dependency graph accuracy
4. Test suggested removals in isolated branch

## Implementation Phases

### Phase 1: Core Infrastructure (Requirements 1, 8)

**Deliverables**:
- File scanner utility
- Import parser (JavaScript/TypeScript)
- Dependency graph builder
- Report generator framework

**Validation**: Can scan project and build dependency graph

### Phase 2: File Analysis (Requirements 1, 4, 5)

**Deliverables**:
- LegacyFileAnalyzer
- TestFileAnalyzer
- DocumentationAnalyzer

**Validation**: Identifies obsolete files with justifications

### Phase 3: Convention Validation (Requirements 2, 3)

**Deliverables**:
- RouteConventionAnalyzer
- DirectoryStructureAnalyzer

**Validation**: Flags convention violations with suggestions

### Phase 4: Code Quality (Requirements 6, 7)

**Deliverables**:
- CodeQualityAnalyzer
- ConfigurationAnalyzer

**Validation**: Finds unused imports and config duplicates

### Phase 5: Reporting & Execution (Requirement 8)

**Deliverables**:
- Complete markdown report generator
- Execution scripts for approved changes
- Rollback mechanism

**Validation**: Report is actionable and changes are reversible

## Design Decisions

### Decision 1: Static Analysis Over Runtime Analysis

**Rationale**: Static analysis is safer and faster. It doesn't require running potentially broken code and can analyze the entire codebase without side effects.

**Trade-off**: May produce false positives for dynamically imported modules, but manual review mitigates this.

### Decision 2: Report-First, Execute-Later Approach

**Rationale**: Automated code deletion is risky. Generating a report for manual review ensures no critical code is accidentally removed.

**Trade-off**: Requires manual execution, but safety is paramount.

### Decision 3: Dependency Graph for Safety

**Rationale**: Building a complete dependency graph ensures we never mark a file for removal if it's still imported elsewhere.

**Trade-off**: Graph building adds complexity, but prevents breaking changes.

### Decision 4: Categorized Impact Levels

**Rationale**: Not all cleanup items are equal. Categorizing by impact helps prioritize what to address first.

**Trade-off**: Impact assessment may be subjective, but provides useful guidance.

### Decision 5: Preserve Historical Documentation

**Rationale**: Some old docs have historical value. Move to `docs/archived/` rather than delete.

**Trade-off**: Increases archive size, but preserves project history.

### Decision 6: AST-Based Code Analysis

**Rationale**: Using Abstract Syntax Trees (AST) provides accurate parsing of code structure, better than regex-based approaches.

**Trade-off**: Requires additional dependencies (`@babel/parser`), but accuracy is worth it.

## Report Format

### Markdown Report Structure

```markdown
# Code Cleanup Analysis Report

Generated: [timestamp]

## Executive Summary

- Total Issues: X
- Files to Remove: Y
- Files to Move: Z
- Convention Violations: W

## 1. Legacy Files (Requirement 1)

### Files Recommended for Removal

| File | Reason | Impact | Dependencies |
|------|--------|--------|--------------|
| DEPLOY_SUCCESS_v1.4.5.md | Temporary deployment doc | Low | None |
| server/test-admin-routes.db-shm | Test artifact | Low | None |

### Execution Commands

```bash
rm DEPLOY_SUCCESS_v1.4.5.md
rm server/test-admin-routes.db-shm
```

## 2. Route Conventions (Requirement 2)

### Convention Violations

| Route File | Issue | Suggestion |
|------------|-------|------------|
| server/routes/admin.js | Should be adminRoutes.js | Rename file |

## 3. Directory Structure (Requirement 3)

### Files to Relocate

| Current Path | Suggested Path | Reason |
|--------------|----------------|--------|
| src/components/UserForm.tsx | src/components/user/UserForm.tsx | User-specific component |

## 4. Test Consolidation (Requirement 4)

[Similar structure...]

## 5. Documentation Cleanup (Requirement 5)

[Similar structure...]

## 6. Code Quality (Requirement 6)

[Similar structure...]

## 7. Configuration (Requirement 7)

[Similar structure...]

## Execution Plan

1. Review this report
2. Execute low-impact changes first
3. Test after each category
4. Commit changes incrementally
```

## Security Considerations

1. **File System Access**: Analyzer only reads files, never writes
2. **Path Traversal**: Validate all file paths stay within project root
3. **Sensitive Data**: Don't log file contents, only paths and metadata
4. **Execution Scripts**: Generated scripts should be reviewed before execution

## Performance Considerations

1. **Parallel Analysis**: Analyze files concurrently using worker threads
2. **Caching**: Cache AST parsing results for large files
3. **Incremental Analysis**: Support analyzing specific directories only
4. **Progress Reporting**: Show progress for long-running analysis

## Future Enhancements

1. **Auto-fix Mode**: Automatically apply low-risk changes
2. **Git Integration**: Create cleanup branch automatically
3. **CI Integration**: Run as pre-commit or pre-deploy check
4. **Interactive Mode**: CLI tool for reviewing and applying changes
5. **Metrics Dashboard**: Track code quality metrics over time
