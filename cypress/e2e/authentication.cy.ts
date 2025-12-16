describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.mockWuzAPI()
    // Clear any existing tokens
    cy.window().then((win) => {
      win.localStorage.clear()
    })
  })

  it('should redirect unauthenticated users to login', () => {
    cy.visit('/admin')
    
    // Should redirect to login page
    cy.url().should('include', '/login')
    cy.contains('Login').should('be.visible')
  })

  it('should handle admin login successfully', () => {
    cy.visit('/login')
    
    // Should display login form
    cy.get('input[name="token"]').should('be.visible')
    cy.contains('Entrar como Admin').should('be.visible')
    
    // Mock admin validation
    cy.intercept('POST', '/api/auth/validate-admin', {
      statusCode: 200,
      body: { success: true, isAdmin: true }
    }).as('validateAdmin')
    
    // Enter admin token
    cy.get('input[name="token"]').type('admin-token-123')
    cy.contains('Entrar como Admin').click()
    
    // Should validate token
    cy.waitForApi('@validateAdmin')
    
    // Should redirect to admin dashboard
    cy.url().should('include', '/admin')
    cy.contains('Painel Administrativo').should('be.visible')
  })

  it('should handle user login successfully', () => {
    cy.visit('/login')
    
    // Mock user validation
    cy.intercept('POST', '/api/auth/validate-user', {
      statusCode: 200,
      body: { success: true, isUser: true }
    }).as('validateUser')
    
    // Enter user token
    cy.get('input[name="token"]').type('user-token-123')
    cy.contains('Entrar como Usuário').click()
    
    // Should validate token
    cy.waitForApi('@validateUser')
    
    // Should redirect to user dashboard
    cy.url().should('include', '/user')
    cy.contains('Painel do Usuário').should('be.visible')
  })

  it('should handle invalid token gracefully', () => {
    cy.visit('/login')
    
    // Mock invalid token response
    cy.intercept('POST', '/api/auth/validate-admin', {
      statusCode: 401,
      body: { success: false, error: 'Invalid token' }
    }).as('invalidToken')
    
    // Enter invalid token
    cy.get('input[name="token"]').type('invalid-token')
    cy.contains('Entrar como Admin').click()
    
    // Should show error message
    cy.contains('Token inválido').should('be.visible')
    
    // Should remain on login page
    cy.url().should('include', '/login')
  })

  it('should handle network errors during login', () => {
    cy.visit('/login')
    
    // Mock network error
    cy.intercept('POST', '/api/auth/validate-admin', {
      forceNetworkError: true
    }).as('networkError')
    
    // Enter token
    cy.get('input[name="token"]').type('admin-token-123')
    cy.contains('Entrar como Admin').click()
    
    // Should show network error message
    cy.contains('Erro de conexão').should('be.visible')
    
    // Should remain on login page
    cy.url().should('include', '/login')
  })

  it('should persist authentication across page reloads', () => {
    // Login as admin
    cy.loginAsAdmin()
    cy.visit('/admin')
    
    // Should display admin dashboard
    cy.contains('Painel Administrativo').should('be.visible')
    
    // Reload page
    cy.reload()
    
    // Should still be authenticated
    cy.contains('Painel Administrativo').should('be.visible')
    cy.url().should('include', '/admin')
  })

  it('should handle token expiration', () => {
    // Login as user
    cy.loginAsUser('expired-token')
    cy.visit('/user')
    
    // Mock token expiration
    cy.intercept('GET', '/api/user/**', {
      statusCode: 401,
      body: { success: false, error: 'Token expired' }
    }).as('tokenExpired')
    
    // Try to access protected resource
    cy.visit('/user/messages')
    
    // Should redirect to login
    cy.url().should('include', '/login')
    cy.contains('Sessão expirada').should('be.visible')
  })
})