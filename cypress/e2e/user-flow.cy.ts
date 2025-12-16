describe('User Dashboard Flow', () => {
  beforeEach(() => {
    cy.mockWuzAPI()
    cy.loginAsUser('test-token-123')
  })

  it('should navigate through user dashboard successfully', () => {
    cy.visit('/user')
    
    // Should display user dashboard
    cy.url().should('include', '/user')
    cy.contains('Painel do Usuário').should('be.visible')
    
    // Should display navigation menu
    cy.get('[data-testid="user-nav"]').should('be.visible')
    cy.contains('Visão Geral').should('be.visible')
    cy.contains('Mensagens').should('be.visible')
    cy.contains('Configurações').should('be.visible')
  })

  it('should display user information correctly', () => {
    cy.visit('/user')
    
    // Should show connection status
    cy.contains('Status da Conexão').should('be.visible')
    
    // Should show user statistics
    cy.contains('Mensagens Enviadas').should('be.visible')
    cy.contains('Webhooks Recebidos').should('be.visible')
  })

  it('should handle message sending flow', () => {
    cy.visit('/user/messages')
    
    // Should display message form
    cy.get('input[name="phoneNumber"]').should('be.visible')
    cy.get('textarea[name="message"]').should('be.visible')
    
    // Fill message form
    cy.get('input[name="phoneNumber"]').type('5511999999999')
    cy.get('textarea[name="message"]').type('Test message from Cypress')
    
    // Mock send message API
    cy.intercept('POST', '/api/user/messages/send', {
      statusCode: 200,
      body: { success: true, messageId: 'msg-123' }
    }).as('sendMessage')
    
    // Send message
    cy.contains('Enviar Mensagem').click()
    
    // Should show success message
    cy.contains('Mensagem enviada com sucesso').should('be.visible')
    
    // Should call send API
    cy.waitForApi('@sendMessage')
  })

  it('should handle user settings update', () => {
    cy.visit('/user/settings')
    
    // Should display settings form
    cy.get('input[name="webhook"]').should('be.visible')
    cy.get('select[name="events"]').should('be.visible')
    
    // Update webhook URL
    cy.get('input[name="webhook"]').clear().type('https://mywebhook.com/endpoint')
    
    // Update events selection
    cy.get('select[name="events"]').select(['Message', 'Receipt'])
    
    // Mock update settings API
    cy.intercept('PUT', '/api/user/settings', {
      statusCode: 200,
      body: { success: true }
    }).as('updateSettings')
    
    // Save settings
    cy.contains('Salvar Configurações').click()
    
    // Should show success message
    cy.contains('Configurações atualizadas').should('be.visible')
    
    // Should call update API
    cy.waitForApi('@updateSettings')
  })

  it('should handle QR code generation', () => {
    cy.visit('/user/settings')
    
    // Mock QR code API
    cy.intercept('POST', '/api/user/qrcode', {
      statusCode: 200,
      body: { success: true, qrcode: 'mock-qr-code-data' }
    }).as('generateQR')
    
    // Generate QR code
    cy.contains('Gerar QR Code').click()
    
    // Should show QR code
    cy.get('[data-testid="qr-code"]').should('be.visible')
    
    // Should call QR API
    cy.waitForApi('@generateQR')
  })

  it('should handle logout flow', () => {
    cy.visit('/user')
    
    // Click logout button
    cy.get('[data-testid="logout-button"]').click()
    
    // Should redirect to login
    cy.url().should('include', '/login')
    
    // Should clear user token
    cy.window().then((win) => {
      expect(win.localStorage.getItem('userToken')).to.be.null
    })
  })
})