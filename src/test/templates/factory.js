/**
 * Factory para geração de dados de teste
 */

class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      id: `user_${Date.now()}`,
      name: 'Test User',
      token: 'test-token-123',
      webhook: 'https://example.com/webhook',
      events: 'Message,Receipt',
      connected: true,
      loggedIn: true,
      jid: '5511999999999:49@s.whatsapp.net',
      ...overrides
    };
  }

  static createConnection(overrides = {}) {
    return {
      id: `conn_${Date.now()}`,
      name: 'Test Connection',
      type: 'NOCODB',
      host: 'localhost',
      database: 'test_db',
      table_name: 'test_table',
      status: 'connected',
      assignedUsers: ['test-token'],
      user_link_field: 'user_token',
      ...overrides
    };
  }
}

module.exports = TestDataFactory;