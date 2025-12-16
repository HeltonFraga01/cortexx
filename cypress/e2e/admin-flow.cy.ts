describe('Admin Dashboard Flow', () => {
  beforeEach(() => {
    cy.mockWuzAPI()
    cy.loginAsAdmin()
  })

  it('should navigate through admin dashboard successfully', () => {
    cy.visit('/admin')
    
    // Should redirect to admin dashboard
    cy.url().should('include', '/admin')
    cy.contains('Painel Administrativo').should('be.visible')
    
    // Should display navigation menu
    cy.get('[data-testid="admin-nav"]').should('be.visible')
    cy.contains('Usuários').should('be.visible')
    cy.contains('Configurações').should('be.visible')
  })

  it('should manage users successfully', () => {
    cy.visit('/admin/users')
    
    // Wait for users to load
    cy.waitForApi('@getUsers')
    
    // Should display users list
    cy.contains('Test User 1').should('be.visible')
    cy.contains('Test User 2').should('be.visible')
    
    // Should show user status
    cy.contains('Logado e Ativo').should('be.visible')
    cy.contains('Desconectado').should('be.visible')
    
    // Should allow editing user
    cy.contains('Test User 1').parent().find('[data-testid="edit-user"]').click()
    cy.url().should('include', '/admin/users/edit/test-user-1')
    
    // Should display edit form
    cy.get('input[name="name"]').should('have.value', 'Test User 1')
    cy.get('input[name="webhook"]').should('have.value', 'https://example.com/webhook1')
  })

  it('should update user configuration', () => {
    cy.visit('/admin/users/edit/test-user-1')
    
    // Wait for user data to load
    cy.get('input[name="name"]').should('have.value', 'Test User 1')
    
    // Update user name
    cy.get('input[name="name"]').clear().type('Updated User Name')
    
    // Update webhook URL
    cy.get('input[name="webhook"]').clear().type('https://newwebhook.com/endpoint')
    
    // Save changes
    cy.contains('Salvar Alterações').click()
    
    // Should show success message
    cy.contains('Configurações atualizadas com sucesso').should('be.visible')
    
    // Should call update API
    cy.waitForApi('@updateUser')
  })

  it('should handle branding configuration', () => {
    cy.visit('/admin/settings')
    
    // Wait for branding config to load
    cy.waitForApi('@getBranding')
    
    // Should display branding form
    cy.get('input[name="appName"]').should('have.value', 'WUZAPI Manager')
    
    // Update app name
    cy.get('input[name="appName"]').clear().type('Custom App Name')
    
    // Update primary color
    cy.get('input[name="primaryColor"]').clear().type('#ff0000')
    
    // Save changes
    cy.contains('Salvar Configurações').click()
    
    // Should show success message
    cy.contains('Configurações salvas com sucesso').should('be.visible')
    
    // Should call update API
    cy.waitForApi('@updateBranding')
  })

  it('should handle error scenarios gracefully', () => {
    // Mock API error
    cy.intercept('GET', '/api/admin/users', {
      statusCode: 500,
      body: { error: 'Internal server error' }
    }).as('getUsersError')
    
    cy.visit('/admin/users')
    
    // Should display error message
    cy.contains('Erro ao carregar usuários').should('be.visible')
    
    // Should show retry button
    cy.contains('Tentar Novamente').should('be.visible')
    
    // Mock successful retry
    cy.intercept('GET', '/api/admin/users', {
      fixture: 'users.json'
    }).as('getUsersRetry')
    
    // Click retry
    cy.contains('Tentar Novamente').click()
    
    // Should load successfully
    cy.waitForApi('@getUsersRetry')
    cy.contains('Test User 1').should('be.visible')
  })
})