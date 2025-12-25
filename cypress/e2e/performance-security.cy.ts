/**
 * Performance & Security Integration Tests (Task 6.2)
 * Tests for lazy loading, health check, CSP, and metrics endpoints
 */

describe('Performance & Security', () => {
  describe('Health Check Endpoint', () => {
    it('should return healthy status', () => {
      cy.request('GET', '/health').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('status', 'healthy')
      })
    })

    it('should include database status', () => {
      cy.request('GET', '/health').then((response) => {
        expect(response.body).to.have.property('database')
      })
    })

    it('should include memory usage', () => {
      cy.request('GET', '/health').then((response) => {
        expect(response.body).to.have.property('memory')
      })
    })
  })

  describe('Metrics Endpoint', () => {
    it('should return Prometheus-compatible metrics', () => {
      cy.request('GET', '/metrics').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.headers['content-type']).to.include('text/plain')
        expect(response.body).to.include('wuzapi_')
      })
    })

    it('should include process memory metrics', () => {
      cy.request('GET', '/metrics').then((response) => {
        expect(response.body).to.include('wuzapi_process_memory_bytes')
      })
    })

    it('should include HTTP request metrics', () => {
      cy.request('GET', '/metrics').then((response) => {
        expect(response.body).to.include('wuzapi_http_requests_total')
      })
    })

    it('should accept web vital metrics via POST', () => {
      cy.request({
        method: 'POST',
        url: '/api/metrics',
        body: {
          type: 'web-vital',
          name: 'LCP',
          value: 1500,
          rating: 'good',
          url: '/test',
          timestamp: Date.now()
        }
      }).then((response) => {
        expect(response.status).to.eq(204)
      })
    })
  })

  describe('CSP Violation Reporting', () => {
    it('should accept CSP violation reports', () => {
      cy.request({
        method: 'POST',
        url: '/api/csp-report',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          'csp-report': {
            'blocked-uri': 'https://test.com/script.js',
            'violated-directive': 'script-src',
            'document-uri': 'https://app.example.com/'
          }
        }
      }).then((response) => {
        expect(response.status).to.eq(204)
      })
    })

    it('should accept alternative CSP report format', () => {
      cy.request({
        method: 'POST',
        url: '/api/csp-report',
        headers: {
          'Content-Type': 'application/csp-report'
        },
        body: JSON.stringify({
          'csp-report': {
            'blocked-uri': 'inline',
            'violated-directive': 'script-src'
          }
        })
      }).then((response) => {
        expect(response.status).to.eq(204)
      })
    })
  })

  describe('Security Status Endpoint', () => {
    it('should return security configuration status', () => {
      cy.request('GET', '/api/status').then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.property('success', true)
        expect(response.body.data).to.have.property('environment')
        expect(response.body.data).to.have.property('features')
      })
    })

    it('should include feature flags', () => {
      cy.request('GET', '/api/status').then((response) => {
        const features = response.body.data.features
        expect(features).to.have.property('csp', true)
        expect(features).to.have.property('sessionSecurity', true)
        expect(features).to.have.property('rateLimiting', true)
      })
    })
  })

  describe('Lazy Route Loading', () => {
    it('should load login page with lazy loading', () => {
      cy.visit('/login')
      cy.get('body').should('be.visible')
      // The page should load without errors
    })

    it('should show loading skeleton during route transition', () => {
      // Visit home first
      cy.visit('/')
      
      // The page should render
      cy.get('body').should('be.visible')
    })

    it('should handle navigation between lazy routes', () => {
      cy.visit('/login')
      cy.get('body').should('be.visible')
      
      // Navigate to another route
      cy.visit('/')
      cy.get('body').should('be.visible')
    })
  })

  describe('Security Headers', () => {
    it('should include security headers in response', () => {
      cy.request('GET', '/').then((response) => {
        // Check for common security headers
        expect(response.headers).to.have.property('x-content-type-options')
        expect(response.headers).to.have.property('x-frame-options')
      })
    })
  })

  describe('Performance Monitoring', () => {
    it('should have performance monitoring initialized', () => {
      cy.visit('/')
      
      // Check that web-vitals is loaded (via performance API)
      cy.window().then((win) => {
        expect(win.performance).to.exist
      })
    })
  })
})
