/**
 * Prevention Strategy Service
 * 
 * Provides prevention strategies with tool recommendations,
 * trade-off analysis, configuration examples, and implementation steps.
 * 
 * @module error-detection/PreventionStrategyService
 */

const {
  ErrorType,
  ErrorCategory,
  createPreventionStrategy
} = require('./types');

/**
 * Prevention strategies organized by error type
 */
const PREVENTION_STRATEGIES = {
  [ErrorType.SYNTAX]: [
    {
      id: 'eslint_setup',
      title: 'Set up ESLint for syntax checking',
      description: 'Configure ESLint to catch syntax errors during development',
      tools: ['ESLint', 'eslint-plugin-import'],
      steps: [
        'Install ESLint: npm install -D eslint',
        'Initialize config: npx eslint --init',
        'Add lint script to package.json',
        'Configure editor integration',
        'Set up pre-commit hooks with husky'
      ],
      tradeoffs: 'Adds build time but catches errors early. May require initial configuration effort.',
      configExample: `// .eslintrc.json
{
  "extends": ["eslint:recommended"],
  "rules": {
    "semi": ["error", "always"],
    "quotes": ["error", "single"],
    "no-unused-vars": "error"
  }
}`,
      benefits: ['Catches errors before runtime', 'Enforces code style', 'Integrates with editors']
    },
    {
      id: 'prettier_setup',
      title: 'Use Prettier for code formatting',
      description: 'Automatically format code to prevent style-related syntax issues',
      tools: ['Prettier', 'eslint-config-prettier'],
      steps: [
        'Install Prettier: npm install -D prettier',
        'Create .prettierrc config file',
        'Add format script to package.json',
        'Configure editor format-on-save',
        'Integrate with ESLint using eslint-config-prettier'
      ],
      tradeoffs: 'Opinionated formatting may not match team preferences. Requires team agreement on style.',
      configExample: `// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}`,
      benefits: ['Consistent code style', 'Reduces code review friction', 'Automatic formatting']
    },
    {
      id: 'typescript_strict',
      title: 'Enable TypeScript strict mode',
      description: 'Use TypeScript with strict mode for compile-time error detection',
      tools: ['TypeScript'],
      steps: [
        'Install TypeScript: npm install -D typescript',
        'Create tsconfig.json with strict: true',
        'Migrate JavaScript files to TypeScript',
        'Fix type errors as they appear',
        'Set up build pipeline'
      ],
      tradeoffs: 'Requires learning TypeScript. Initial migration effort. Longer build times.',
      configExample: `// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitReturns": true
  }
}`,
      benefits: ['Compile-time type checking', 'Better IDE support', 'Self-documenting code']
    }
  ],
  [ErrorType.RUNTIME]: [
    {
      id: 'null_checks',
      title: 'Implement defensive null checking',
      description: 'Use optional chaining and nullish coalescing consistently',
      tools: ['TypeScript', 'ESLint'],
      steps: [
        'Enable strictNullChecks in TypeScript',
        'Use optional chaining (?.) for property access',
        'Use nullish coalescing (??) for defaults',
        'Add ESLint rules for null safety',
        'Review existing code for null issues'
      ],
      tradeoffs: 'More verbose code. Requires consistent application across codebase.',
      configExample: `// ESLint rule
{
  "rules": {
    "@typescript-eslint/no-non-null-assertion": "error",
    "@typescript-eslint/strict-boolean-expressions": "error"
  }
}`,
      benefits: ['Prevents null reference errors', 'Clearer intent', 'Better error messages']
    },
    {
      id: 'error_boundaries',
      title: 'Implement error boundaries (React)',
      description: 'Use React error boundaries to catch and handle runtime errors',
      tools: ['React'],
      steps: [
        'Create ErrorBoundary component',
        'Wrap critical components with error boundaries',
        'Implement fallback UI for errors',
        'Add error logging/reporting',
        'Test error boundary behavior'
      ],
      tradeoffs: 'Only catches errors in render. Does not catch async errors or event handlers.',
      configExample: `// ErrorBoundary.jsx
class ErrorBoundary extends React.Component {
  state = { hasError: false };
  
  static getDerivedStateFromError(error) {
    return { hasError: true };
  }
  
  componentDidCatch(error, info) {
    logError(error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <FallbackUI />;
    }
    return this.props.children;
  }
}`,
      benefits: ['Graceful error handling', 'Better user experience', 'Error isolation']
    },
    {
      id: 'promise_handling',
      title: 'Standardize promise error handling',
      description: 'Establish patterns for consistent promise error handling',
      tools: ['ESLint', 'eslint-plugin-promise'],
      steps: [
        'Install eslint-plugin-promise',
        'Enable promise/catch-or-return rule',
        'Create utility functions for common patterns',
        'Add global unhandledrejection handler',
        'Review existing async code'
      ],
      tradeoffs: 'More boilerplate code. Requires team discipline.',
      configExample: `// ESLint config
{
  "plugins": ["promise"],
  "rules": {
    "promise/catch-or-return": "error",
    "promise/no-return-wrap": "error",
    "promise/always-return": "error"
  }
}`,
      benefits: ['No silent failures', 'Consistent error handling', 'Better debugging']
    }
  ],
  [ErrorType.SECURITY]: [
    {
      id: 'security_audit',
      title: 'Regular security audits',
      description: 'Run automated security audits on dependencies',
      tools: ['npm audit', 'Snyk', 'OWASP Dependency-Check'],
      steps: [
        'Run npm audit regularly',
        'Set up Snyk or similar in CI/CD',
        'Review and update vulnerable dependencies',
        'Configure automated alerts',
        'Document security review process'
      ],
      tradeoffs: 'May require frequent updates. Some vulnerabilities may not have fixes.',
      configExample: `// package.json scripts
{
  "scripts": {
    "audit": "npm audit",
    "audit:fix": "npm audit fix",
    "security": "snyk test"
  }
}`,
      benefits: ['Early vulnerability detection', 'Automated monitoring', 'Compliance support']
    },
    {
      id: 'input_validation',
      title: 'Implement input validation',
      description: 'Validate all user input before processing',
      tools: ['Zod', 'Joi', 'Yup'],
      steps: [
        'Choose a validation library',
        'Define schemas for all inputs',
        'Validate at API boundaries',
        'Sanitize HTML content',
        'Test with malicious inputs'
      ],
      tradeoffs: 'Additional code for validation. Performance overhead for complex schemas.',
      configExample: `// Using Zod
const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  age: z.number().min(0).max(150)
});

const result = userSchema.safeParse(input);
if (!result.success) {
  throw new ValidationError(result.error);
}`,
      benefits: ['Prevents injection attacks', 'Data integrity', 'Clear error messages']
    },
    {
      id: 'parameterized_queries',
      title: 'Use parameterized queries',
      description: 'Prevent SQL injection with parameterized queries',
      tools: ['Prepared statements', 'ORM'],
      steps: [
        'Replace string concatenation with parameters',
        'Use ORM for database operations',
        'Review all database queries',
        'Add SQL injection tests',
        'Document secure query patterns'
      ],
      tradeoffs: 'May require code refactoring. ORMs add abstraction layer.',
      configExample: `// Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// Using ORM (Sequelize)
const user = await User.findOne({
  where: { id: userId }
});`,
      benefits: ['Prevents SQL injection', 'Cleaner code', 'Database portability']
    }
  ],
  [ErrorType.CONFIGURATION]: [
    {
      id: 'schema_validation',
      title: 'Validate configuration with schemas',
      description: 'Use JSON Schema or similar to validate configuration files',
      tools: ['JSON Schema', 'Ajv', 'TypeScript'],
      steps: [
        'Define schemas for all config files',
        'Validate on application startup',
        'Add schema validation to CI/CD',
        'Document configuration options',
        'Provide helpful error messages'
      ],
      tradeoffs: 'Requires maintaining schemas. May slow startup slightly.',
      configExample: `// JSON Schema for config
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["port", "database"],
  "properties": {
    "port": { "type": "number", "minimum": 1, "maximum": 65535 },
    "database": {
      "type": "object",
      "required": ["host", "name"],
      "properties": {
        "host": { "type": "string" },
        "name": { "type": "string" }
      }
    }
  }
}`,
      benefits: ['Early error detection', 'Self-documenting config', 'IDE support']
    },
    {
      id: 'env_management',
      title: 'Proper environment variable management',
      description: 'Use dotenv and validation for environment variables',
      tools: ['dotenv', 'envalid', 'dotenv-safe'],
      steps: [
        'Install dotenv and envalid',
        'Create .env.example with all variables',
        'Validate env vars on startup',
        'Never commit .env files',
        'Document all environment variables'
      ],
      tradeoffs: 'Requires discipline to keep .env.example updated.',
      configExample: `// Using envalid
const env = envalid.cleanEnv(process.env, {
  PORT: envalid.port({ default: 3000 }),
  DATABASE_URL: envalid.url(),
  NODE_ENV: envalid.str({ choices: ['development', 'production'] })
});`,
      benefits: ['Fail fast on missing config', 'Type-safe env vars', 'Documentation']
    }
  ],
  [ErrorType.PERFORMANCE]: [
    {
      id: 'performance_monitoring',
      title: 'Set up performance monitoring',
      description: 'Monitor application performance in production',
      tools: ['Lighthouse', 'Web Vitals', 'APM tools'],
      steps: [
        'Add performance monitoring library',
        'Set up dashboards and alerts',
        'Define performance budgets',
        'Run Lighthouse in CI/CD',
        'Review metrics regularly'
      ],
      tradeoffs: 'Adds overhead. May require paid tools for full features.',
      configExample: `// Web Vitals monitoring
import { getCLS, getFID, getLCP } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);`,
      benefits: ['Early performance regression detection', 'Data-driven optimization', 'User experience insights']
    },
    {
      id: 'code_splitting',
      title: 'Implement code splitting',
      description: 'Split code into smaller chunks for faster loading',
      tools: ['Webpack', 'Vite', 'React.lazy'],
      steps: [
        'Identify large bundles',
        'Use dynamic imports for routes',
        'Implement React.lazy for components',
        'Add loading states',
        'Monitor bundle sizes'
      ],
      tradeoffs: 'More complex build setup. May cause loading waterfalls.',
      configExample: `// React lazy loading
const Dashboard = React.lazy(() => import('./Dashboard'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}`,
      benefits: ['Faster initial load', 'Better caching', 'Reduced bandwidth']
    }
  ]
};

class PreventionStrategyService {
  /**
   * Creates a new PreventionStrategyService instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.strategies = { ...PREVENTION_STRATEGIES, ...options.customStrategies };
  }

  /**
   * Gets prevention strategies for an error type
   * @param {string} errorType - Error type
   * @returns {Array} Prevention strategies
   */
  getStrategiesForType(errorType) {
    return this.strategies[errorType] || [];
  }

  /**
   * Gets all prevention strategies
   * @returns {Object} All strategies by type
   */
  getAllStrategies() {
    return this.strategies;
  }

  /**
   * Gets a specific strategy by ID
   * @param {string} strategyId - Strategy ID
   * @returns {Object|null} Strategy or null
   */
  getStrategyById(strategyId) {
    for (const strategies of Object.values(this.strategies)) {
      const found = strategies.find(s => s.id === strategyId);
      if (found) return found;
    }
    return null;
  }

  /**
   * Gets strategies for an error
   * @param {Object} error - Detected error
   * @returns {Array} Applicable strategies
   */
  getStrategiesForError(error) {
    const typeStrategies = this.getStrategiesForType(error.type);
    
    // Filter based on error specifics
    return typeStrategies.filter(strategy => {
      // Include all strategies for the error type
      return true;
    });
  }

  /**
   * Formats a strategy for display
   * @param {Object} strategy - Strategy object
   * @returns {Object} Formatted strategy
   */
  formatStrategy(strategy) {
    return createPreventionStrategy({
      id: strategy.id,
      title: strategy.title,
      description: strategy.description,
      tools: strategy.tools,
      steps: strategy.steps,
      tradeoffs: strategy.tradeoffs,
      configExample: strategy.configExample
    });
  }

  /**
   * Gets tool recommendations for an error type
   * @param {string} errorType - Error type
   * @returns {Array} Tool recommendations
   */
  getToolRecommendations(errorType) {
    const strategies = this.getStrategiesForType(errorType);
    const tools = new Set();
    
    for (const strategy of strategies) {
      for (const tool of strategy.tools) {
        tools.add(tool);
      }
    }
    
    return Array.from(tools);
  }

  /**
   * Gets trade-off analysis for strategies
   * @param {string} errorType - Error type
   * @returns {Array} Trade-off analysis
   */
  getTradeoffAnalysis(errorType) {
    const strategies = this.getStrategiesForType(errorType);
    
    return strategies.map(strategy => ({
      strategy: strategy.title,
      tradeoffs: strategy.tradeoffs,
      benefits: strategy.benefits || [],
      effort: this.estimateEffort(strategy),
      impact: this.estimateImpact(strategy)
    }));
  }

  /**
   * Estimates implementation effort
   * @param {Object} strategy - Strategy object
   * @returns {string} Effort level
   */
  estimateEffort(strategy) {
    const stepCount = strategy.steps?.length || 0;
    
    if (stepCount <= 3) return 'Low';
    if (stepCount <= 5) return 'Medium';
    return 'High';
  }

  /**
   * Estimates impact of strategy
   * @param {Object} strategy - Strategy object
   * @returns {string} Impact level
   */
  estimateImpact(strategy) {
    const benefitCount = strategy.benefits?.length || 0;
    
    if (benefitCount >= 3) return 'High';
    if (benefitCount >= 2) return 'Medium';
    return 'Low';
  }

  /**
   * Gets configuration examples for a strategy
   * @param {string} strategyId - Strategy ID
   * @returns {string|null} Configuration example
   */
  getConfigExample(strategyId) {
    const strategy = this.getStrategyById(strategyId);
    return strategy?.configExample || null;
  }

  /**
   * Gets implementation steps for a strategy
   * @param {string} strategyId - Strategy ID
   * @returns {Array} Implementation steps
   */
  getImplementationSteps(strategyId) {
    const strategy = this.getStrategyById(strategyId);
    if (!strategy) return [];
    
    return strategy.steps.map((step, index) => ({
      order: index + 1,
      description: step,
      isComplex: step.length > 50
    }));
  }

  /**
   * Generates a prevention plan for multiple errors
   * @param {Array} errors - Array of detected errors
   * @returns {Object} Prevention plan
   */
  generatePreventionPlan(errors) {
    const errorTypes = [...new Set(errors.map(e => e.type))];
    const plan = {
      summary: `Prevention plan for ${errors.length} errors across ${errorTypes.length} categories`,
      strategies: [],
      prioritizedActions: [],
      estimatedEffort: 'Medium'
    };
    
    for (const errorType of errorTypes) {
      const strategies = this.getStrategiesForType(errorType);
      plan.strategies.push({
        errorType,
        strategies: strategies.map(s => this.formatStrategy(s))
      });
    }
    
    // Prioritize actions
    plan.prioritizedActions = this.prioritizeActions(plan.strategies);
    plan.estimatedEffort = this.calculateOverallEffort(plan.strategies);
    
    return plan;
  }

  /**
   * Prioritizes prevention actions
   * @param {Array} strategyGroups - Strategy groups by error type
   * @returns {Array} Prioritized actions
   */
  prioritizeActions(strategyGroups) {
    const actions = [];
    
    for (const group of strategyGroups) {
      for (const strategy of group.strategies) {
        actions.push({
          action: strategy.title,
          errorType: group.errorType,
          effort: this.estimateEffort(strategy),
          impact: this.estimateImpact(strategy),
          priority: this.calculatePriority(strategy)
        });
      }
    }
    
    return actions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculates priority score for a strategy
   * @param {Object} strategy - Strategy object
   * @returns {number} Priority score
   */
  calculatePriority(strategy) {
    const impactScore = { High: 3, Medium: 2, Low: 1 };
    const effortScore = { Low: 3, Medium: 2, High: 1 };
    
    const impact = impactScore[this.estimateImpact(strategy)] || 2;
    const effort = effortScore[this.estimateEffort(strategy)] || 2;
    
    return impact * effort;
  }

  /**
   * Calculates overall effort for prevention plan
   * @param {Array} strategyGroups - Strategy groups
   * @returns {string} Overall effort level
   */
  calculateOverallEffort(strategyGroups) {
    let totalStrategies = 0;
    let highEffortCount = 0;
    
    for (const group of strategyGroups) {
      for (const strategy of group.strategies) {
        totalStrategies++;
        if (this.estimateEffort(strategy) === 'High') {
          highEffortCount++;
        }
      }
    }
    
    const highEffortRatio = highEffortCount / totalStrategies;
    
    if (highEffortRatio > 0.5) return 'High';
    if (highEffortRatio > 0.2) return 'Medium';
    return 'Low';
  }
}

module.exports = PreventionStrategyService;
