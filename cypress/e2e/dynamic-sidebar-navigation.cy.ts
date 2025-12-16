/**
 * End-to-End Tests for Dynamic Sidebar Database Navigation
 * Tests the complete flow: login → sidebar → direct-to-edit → save
 */

describe('Dynamic Sidebar Database Navigation - E2E', () => {
  const TEST_USER_TOKEN = 'test-user-token-123';
  const TEST_ADMIN_TOKEN = 'test-admin-token-456';
  
  const mockConnections = [
    {
      id: 1,
      name: 'Teste Final',
      type: 'NOCODB',
      host: 'https://nocodb.example.com',
      nocodb_project_id: 'p123',
      nocodb_table_id: 'my7kpxstrt02976',
      table_name: 'my7kpxstrt02976',
      user_link_field: 'apiToken',
      status: 'connected',
      assignedUsers: [TEST_USER_TOKEN],
      fieldMappings: [
        { columnName: 'chatwootInboxName', label: 'Nome do Inbox', visible: true, editable: true },
        { columnName: 'chatwootBaseUrl', label: 'URL do Chatwoot', visible: true, editable: true },
        { columnName: 'apiToken', label: 'Token API', visible: false, editable: false }
      ]
    },
    {
      id: 2,
      name: 'MasterMegga',
      type: 'SQLITE',
      host: 'localhost',
      database: 'test.db',
      table_name: 'users',
      user_link_field: 'user_token',
      status: 'connected',
      assignedUsers: [TEST_USER_TOKEN],
      fieldMappings: [
        { columnName: 'name', label: 'Nome', visible: true, editable: true },
        { columnName: 'email', label: 'Email', visible: true, editable: true }
      ]
    }
  ];

  const mockUserRecord1 = {
    id: 1,
    chatwootInboxName: 'HeltonWzapi',
    chatwootBaseUrl: 'https://chat.wasend.com.br',
    apiToken: TEST_USER_TOKEN,
    created_at: '2025-10-30T11:30:40+00:00',
    updated_at: '2025-11-04T20:51:09+00:00'
  };

  const mockUserRecord2 = {
    id: 2,
    name: 'Test User',
    email: 'test@example.com',
    user_token: TEST_USER_TOKEN
  };

  beforeEach(() => {
    // Clear localStorage and cookies
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Mock API endpoints
    cy.intercept('GET', '/api/user/database-connections', {
      statusCode: 200,
      body: {
        success: true,
        data: mockConnections
      }
    }).as('getUserConnections');

    cy.intercept('GET', '/api/user/database-connections/1/record', {
      statusCode: 200,
      body: {
        success: true,
        data: mockUserRecord1,
        metadata: {
          connectionId: 1,
          connectionName: 'Teste Final',
          tableName: 'my7kpxstrt02976'
        }
      }
    }).as('getUserRecord1');

    cy.intercept('GET', '/api/user/database-connections/2/record', {
      statusCode: 200,
      body: {
        success: true,
        data: mockUserRecord2,
        metadata: {
          connectionId: 2,
          connectionName: 'MasterMegga',
          tableName: 'users'
        }
      }
    }).as('getUserRecord2');

    cy.intercept('GET', '/api/database-connections/1', {
      statusCode: 200,
      body: {
        success: true,
        data: mockConnections[0]
      }
    }).as('getConnection1');

    cy.intercept('GET', '/api/database-connections/2', {
      statusCode: 200,
      body: {
        success: true,
        data: mockConnections[1]
      }
    }).as('getConnection2');

    cy.intercept('PUT', '/api/user/database-connections/*/data/*', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Record updated successfully'
      }
    }).as('updateRecord');
  });

  describe('Complete User Flow: Login → Sidebar → Edit → Save', () => {
    it('should complete full navigation flow successfully', () => {
      // Step 1: Login as user
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      // Step 2: Navigate to user dashboard
      cy.visit('/user');
      cy.url().should('include', '/user');
      
      // Step 3: Wait for sidebar to load connections
      cy.wait('@getUserConnections');
      
      // Step 4: Verify dynamic database items appear in sidebar
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('be.visible');
      
      // Step 5: Verify alphabetical ordering
      cy.get('nav[aria-label="Conexões de banco de dados"] button').then(($buttons) => {
        const names = $buttons.map((i, el) => Cypress.$(el).text().trim()).get();
        expect(names[0]).to.include('MasterMegga');
        expect(names[1]).to.include('Teste Final');
      });
      
      // Step 6: Click on first connection
      cy.contains('button', 'Teste Final').click();
      
      // Step 7: Verify loading state
      cy.contains('button', 'Teste Final').should('have.attr', 'aria-busy', 'true');
      
      // Step 8: Wait for record fetch
      cy.wait('@getUserRecord1');
      
      // Step 9: Verify navigation to edit page
      cy.url().should('include', '/user/database/1/edit/1');
      
      // Step 10: Wait for connection details to load
      cy.wait('@getConnection1');
      
      // Step 11: Verify page header
      cy.contains('Editar Registro - Teste Final').should('be.visible');
      
      // Step 12: Verify connection metadata
      cy.contains('Tipo do Banco').should('be.visible');
      cy.contains('NOCODB').should('be.visible');
      cy.contains('Tabela').should('be.visible');
      cy.contains('my7kpxstrt02976').should('be.visible');
      
      // Step 13: Verify form fields are populated
      cy.get('input[name="chatwootInboxName"]').should('have.value', 'HeltonWzapi');
      cy.get('input[name="chatwootBaseUrl"]').should('have.value', 'https://chat.wasend.com.br');
      
      // Step 14: Verify hidden field is not visible
      cy.get('input[name="apiToken"]').should('not.exist');
      
      // Step 15: Edit a field
      cy.get('input[name="chatwootInboxName"]').clear().type('UpdatedInbox');
      
      // Step 16: Save changes
      cy.contains('button', 'Salvar Alterações').click();
      
      // Step 17: Verify save request
      cy.wait('@updateRecord');
      
      // Step 18: Verify success message
      cy.contains('Alterações salvas com sucesso').should('be.visible');
    });

    it('should handle multiple connections correctly', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Test first connection
      cy.contains('button', 'Teste Final').click();
      cy.wait('@getUserRecord1');
      cy.url().should('include', '/user/database/1/edit/1');
      cy.wait('@getConnection1');
      cy.contains('Editar Registro - Teste Final').should('be.visible');
      
      // Go back to dashboard
      cy.contains('button', 'Voltar').click();
      cy.url().should('include', '/user');
      
      // Test second connection
      cy.contains('button', 'MasterMegga').click();
      cy.wait('@getUserRecord2');
      cy.url().should('include', '/user/database/2/edit/2');
      cy.wait('@getConnection2');
      cy.contains('Editar Registro - MasterMegga').should('be.visible');
    });
  });

  describe('Error Handling Scenarios', () => {
    it('should handle record not found error', () => {
      cy.intercept('GET', '/api/user/database-connections/1/record', {
        statusCode: 404,
        body: {
          success: false,
          error: 'No record found for this user',
          code: 'RECORD_NOT_FOUND',
          suggestion: 'Contact administrator to create a record for your account'
        }
      }).as('recordNotFound');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      cy.contains('button', 'Teste Final').click();
      cy.wait('@recordNotFound');
      
      // Should show error toast
      cy.contains('Registro não encontrado').should('be.visible');
      cy.contains('Contact administrator').should('be.visible');
    });

    it('should handle connection not found error', () => {
      cy.intercept('GET', '/api/user/database-connections/1/record', {
        statusCode: 404,
        body: {
          success: false,
          error: 'Connection not found',
          code: 'CONNECTION_NOT_FOUND'
        }
      }).as('connectionNotFound');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      cy.contains('button', 'Teste Final').click();
      cy.wait('@connectionNotFound');
      
      // Should show error toast
      cy.contains('Conexão não encontrada').should('be.visible');
    });

    it('should handle unauthorized error and redirect to login', () => {
      cy.intercept('GET', '/api/user/database-connections/1/record', {
        statusCode: 401,
        body: {
          success: false,
          error: 'Unauthorized',
          code: 'UNAUTHORIZED'
        }
      }).as('unauthorized');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      cy.contains('button', 'Teste Final').click();
      cy.wait('@unauthorized');
      
      // Should show error toast
      cy.contains('Acesso negado').should('be.visible');
    });

    it('should handle network errors gracefully', () => {
      cy.intercept('GET', '/api/user/database-connections/1/record', {
        forceNetworkError: true
      }).as('networkError');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      cy.contains('button', 'Teste Final').click();
      
      // Should show error toast
      cy.contains('Erro ao carregar seus dados', { timeout: 10000 }).should('be.visible');
    });

    it('should handle save errors', () => {
      cy.intercept('PUT', '/api/user/database-connections/1/data/1', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Internal server error'
        }
      }).as('saveError');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user/database/1/edit/1');
      cy.wait('@getConnection1');
      
      // Edit a field
      cy.get('input[name="chatwootInboxName"]').clear().type('NewValue');
      
      // Try to save
      cy.contains('button', 'Salvar Alterações').click();
      cy.wait('@saveError');
      
      // Should show error toast
      cy.contains('Erro ao salvar alterações').should('be.visible');
    });
  });

  describe('Cache Functionality', () => {
    it('should use cached connections on subsequent visits', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      // First visit - should fetch from API
      cy.visit('/user');
      cy.wait('@getUserConnections');
      cy.contains('Teste Final').should('be.visible');
      
      // Navigate away and back - should use cache (no API call)
      cy.visit('/user/settings');
      cy.visit('/user');
      
      // Connections should still be visible without new API call
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('be.visible');
    });

    it('should invalidate cache after record update', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user/database/1/edit/1');
      cy.wait('@getConnection1');
      
      // Edit and save
      cy.get('input[name="chatwootInboxName"]').clear().type('CachedValue');
      cy.contains('button', 'Salvar Alterações').click();
      cy.wait('@updateRecord');
      
      // Navigate back and return - should fetch fresh data
      cy.contains('button', 'Voltar').click();
      cy.contains('button', 'Teste Final').click();
      
      // Should make new API call for record
      cy.wait('@getUserRecord1');
    });
  });

  describe('Accessibility Features', () => {
    it('should support keyboard navigation', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Tab to first connection
      cy.get('body').tab();
      cy.focused().should('contain', 'MasterMegga');
      
      // Press Enter to activate
      cy.focused().type('{enter}');
      cy.wait('@getUserRecord2');
      
      // Should navigate to edit page
      cy.url().should('include', '/user/database/2/edit/2');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Check navigation has proper aria-label
      cy.get('nav[aria-label="Conexões de banco de dados"]').should('exist');
      
      // Check buttons have proper aria-labels
      cy.get('button[aria-label*="Acessar banco de dados"]').should('have.length', 2);
      
      // Check loading state has aria-busy
      cy.contains('button', 'Teste Final').click();
      cy.contains('button', 'Teste Final').should('have.attr', 'aria-busy', 'true');
    });

    it('should announce loading states to screen readers', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      
      // Check loading state has sr-only text
      cy.get('.sr-only').contains('Carregando conexões').should('exist');
      
      cy.wait('@getUserConnections');
      
      // Click connection and check loading announcement
      cy.contains('button', 'Teste Final').click();
      cy.get('.sr-only').contains('Carregando dados da conexão').should('exist');
    });
  });

  describe('Responsive Design', () => {
    it('should work on mobile viewport', () => {
      cy.viewport('iphone-x');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Sidebar should be visible
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('be.visible');
      
      // Click connection
      cy.contains('button', 'Teste Final').click();
      cy.wait('@getUserRecord1');
      cy.wait('@getConnection1');
      
      // Form should be responsive
      cy.get('input[name="chatwootInboxName"]').should('be.visible');
      cy.contains('button', 'Salvar Alterações').should('be.visible');
    });

    it('should handle long connection names without breaking layout', () => {
      const longNameConnection = {
        ...mockConnections[0],
        id: 3,
        name: 'This is a very long connection name that should be truncated properly'
      };
      
      cy.intercept('GET', '/api/user/database-connections', {
        statusCode: 200,
        body: {
          success: true,
          data: [longNameConnection]
        }
      }).as('getLongNameConnection');
      
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getLongNameConnection');
      
      // Name should be truncated with ellipsis
      cy.get('button span.truncate').should('have.css', 'text-overflow', 'ellipsis');
    });
  });

  describe('Admin Changes Synchronization', () => {
    it('should reflect connection removal after refresh', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Both connections visible
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('be.visible');
      
      // Mock admin removing one connection
      cy.intercept('GET', '/api/user/database-connections', {
        statusCode: 200,
        body: {
          success: true,
          data: [mockConnections[0]] // Only first connection
        }
      }).as('getUpdatedConnections');
      
      // Refresh page
      cy.reload();
      cy.wait('@getUpdatedConnections');
      
      // Only one connection should be visible
      cy.contains('Teste Final').should('be.visible');
      cy.contains('MasterMegga').should('not.exist');
    });

    it('should reflect connection rename after refresh', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      cy.contains('Teste Final').should('be.visible');
      
      // Mock admin renaming connection
      const renamedConnection = {
        ...mockConnections[0],
        name: 'Renamed Connection'
      };
      
      cy.intercept('GET', '/api/user/database-connections', {
        statusCode: 200,
        body: {
          success: true,
          data: [renamedConnection, mockConnections[1]]
        }
      }).as('getRenamedConnection');
      
      // Refresh page
      cy.reload();
      cy.wait('@getRenamedConnection');
      
      // New name should be visible
      cy.contains('Renamed Connection').should('be.visible');
      cy.contains('Teste Final').should('not.exist');
    });

    it('should reflect field mapping changes after refresh', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user/database/1/edit/1');
      cy.wait('@getConnection1');
      
      // Field should be editable
      cy.get('input[name="chatwootInboxName"]').should('not.be.disabled');
      
      // Mock admin making field read-only
      const updatedConnection = {
        ...mockConnections[0],
        fieldMappings: [
          { columnName: 'chatwootInboxName', label: 'Nome do Inbox', visible: true, editable: false },
          { columnName: 'chatwootBaseUrl', label: 'URL do Chatwoot', visible: true, editable: true }
        ]
      };
      
      cy.intercept('GET', '/api/database-connections/1', {
        statusCode: 200,
        body: {
          success: true,
          data: updatedConnection
        }
      }).as('getUpdatedConnection');
      
      // Refresh page
      cy.reload();
      cy.wait('@getUpdatedConnection');
      
      // Field should now be disabled
      cy.get('input[name="chatwootInboxName"]').should('be.disabled');
    });
  });

  describe('Performance', () => {
    it('should load edit page within 2 seconds', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      const startTime = Date.now();
      
      cy.contains('button', 'Teste Final').click();
      cy.wait('@getUserRecord1');
      cy.wait('@getConnection1');
      
      cy.url().should('include', '/user/database/1/edit/1');
      cy.contains('Editar Registro - Teste Final').should('be.visible');
      
      cy.then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(2000);
      });
    });

    it('should handle rapid connection clicks gracefully', () => {
      cy.visit('/login');
      cy.window().then((win) => {
        win.localStorage.setItem('userToken', TEST_USER_TOKEN);
      });
      
      cy.visit('/user');
      cy.wait('@getUserConnections');
      
      // Click multiple times rapidly
      cy.contains('button', 'Teste Final').click();
      cy.contains('button', 'Teste Final').click();
      cy.contains('button', 'Teste Final').click();
      
      // Should only make one request
      cy.wait('@getUserRecord1');
      
      // Should navigate successfully
      cy.url().should('include', '/user/database/1/edit/1');
    });
  });
});
