/**
 * Lighthouse CI Configuration (Task 6.3)
 * Performance budgets and CI integration
 */
module.exports = {
  ci: {
    collect: {
      // Number of runs per URL
      numberOfRuns: 3,
      
      // URLs to test
      url: [
        'http://localhost:5173/',
        'http://localhost:5173/login',
      ],
      
      // Start server before testing
      startServerCommand: 'npm run dev',
      startServerReadyPattern: 'Local:',
      startServerReadyTimeout: 30000,
      
      // Chrome flags for consistent results
      settings: {
        chromeFlags: '--no-sandbox --headless --disable-gpu',
        preset: 'desktop',
        throttling: {
          // Simulate fast 4G connection
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
      },
    },
    
    assert: {
      // Performance budgets
      assertions: {
        // Core Web Vitals
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],
        
        // Performance score
        'categories:performance': ['warn', { minScore: 0.8 }],
        
        // Accessibility score
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        
        // Best practices score
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        
        // SEO score
        'categories:seo': ['warn', { minScore: 0.8 }],
        
        // Resource budgets
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }], // 500KB
        'resource-summary:total:size': ['warn', { maxNumericValue: 1500000 }], // 1.5MB
        
        // Network requests
        'network-requests': ['warn', { maxNumericValue: 50 }],
        
        // DOM size
        'dom-size': ['warn', { maxNumericValue: 1500 }],
        
        // Unused JavaScript
        'unused-javascript': ['warn', { maxNumericValue: 100000 }], // 100KB
      },
    },
    
    upload: {
      // Upload to temporary public storage (for CI)
      target: 'temporary-public-storage',
    },
  },
};
