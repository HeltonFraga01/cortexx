// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login as admin
       * @example cy.loginAsAdmin()
       */
      loginAsAdmin(): Chainable<void>
      
      /**
       * Custom command to login as user with token
       * @example cy.loginAsUser('user-token')
       */
      loginAsUser(token: string): Chainable<void>
      
      /**
       * Custom command to wait for API response
       * @example cy.waitForApi('@getUsers')
       */
      waitForApi(alias: string): Chainable<void>
      
      /**
       * Custom command to mock WUZAPI responses
       * @example cy.mockWuzAPI()
       */
      mockWuzAPI(): Chainable<void>
    }
  }
}

// Login as admin using environment token
Cypress.Commands.add('loginAsAdmin', () => {
  const adminToken = Cypress.env('ADMIN_TOKEN') || 'test-admin-token'
  cy.window().then((win) => {
    win.localStorage.setItem('adminToken', adminToken)
  })
})

// Login as user with specific token
Cypress.Commands.add('loginAsUser', (token: string) => {
  cy.window().then((win) => {
    win.localStorage.setItem('userToken', token)
  })
})

// Wait for API response with better error handling
Cypress.Commands.add('waitForApi', (alias: string) => {
  cy.wait(alias).then((interception) => {
    expect(interception.response?.statusCode).to.be.oneOf([200, 201, 204])
  })
})

// Mock WUZAPI responses for testing
Cypress.Commands.add('mockWuzAPI', () => {
  // Mock user list endpoint
  cy.intercept('GET', '/api/admin/users', {
    fixture: 'users.json'
  }).as('getUsers')
  
  // Mock user update endpoint
  cy.intercept('PUT', '/api/admin/users/*', {
    statusCode: 200,
    body: { success: true, message: 'User updated successfully' }
  }).as('updateUser')
  
  // Mock user deletion endpoint
  cy.intercept('DELETE', '/api/admin/users/*', {
    statusCode: 200,
    body: { success: true, message: 'User deleted successfully' }
  }).as('deleteUser')
  
  // Mock branding config endpoint
  cy.intercept('GET', '/api/branding/config', {
    fixture: 'branding.json'
  }).as('getBranding')
  
  // Mock branding update endpoint
  cy.intercept('PUT', '/api/branding/config', {
    statusCode: 200,
    body: { success: true, message: 'Branding updated successfully' }
  }).as('updateBranding')
})