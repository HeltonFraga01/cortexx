/**
 * Mock server para WuzAPI
 * Simula respostas da WuzAPI para testes
 */

const http = require('http');
const url = require('url');

class WuzAPIMock {
  constructor(port = 8080) {
    this.port = port;
    this.server = null;
    this.users = new Map();
    this.sessions = new Map();
    this.adminTokens = new Set(['test-admin-token', 'valid-admin-token']);
    this.userTokens = new Set(['test-user-token', 'valid-user-token']);
    
    // Dados de usuários mock
    this.initializeMockData();
  }

  initializeMockData() {
    // Usuários mock
    this.users.set('user1', {
      id: 'user1',
      name: 'Test User 1',
      token: 'test-user-token-1',
      connected: true,
      loggedIn: true,
      jid: 'user1@s.whatsapp.net',
      webhook: 'https://example.com/webhook1',
      events: 'All'
    });

    this.users.set('user2', {
      id: 'user2',
      name: 'Test User 2',
      token: 'test-user-token-2',
      connected: false,
      loggedIn: false,
      jid: null,
      webhook: null,
      events: null
    });

    this.users.set('user3', {
      id: 'user3',
      name: 'Test User 3',
      token: 'test-user-token-3',
      connected: true,
      loggedIn: false,
      jid: 'user3@s.whatsapp.net',
      webhook: 'https://example.com/webhook3',
      events: 'message,status'
    });

    // Sessões mock
    this.sessions.set('test-user-token-1', {
      connected: true,
      loggedIn: true,
      jid: 'user1@s.whatsapp.net',
      qr: null
    });

    this.sessions.set('test-user-token-2', {
      connected: false,
      loggedIn: false,
      jid: null,
      qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`WuzAPI Mock server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('WuzAPI Mock server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  handleRequest(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const token = req.headers.authorization || req.headers.token;

    console.log(`Mock WuzAPI: ${method} ${path} - Token: ${token ? token.substring(0, 10) + '...' : 'none'}`);

    try {
      // Roteamento baseado no path
      if (path === '/health') {
        this.handleHealth(req, res);
      } else if (path.startsWith('/admin/')) {
        this.handleAdminEndpoint(req, res, path, method, token);
      } else if (path.startsWith('/session/')) {
        this.handleSessionEndpoint(req, res, path, method, token);
      } else if (path.startsWith('/message/')) {
        this.handleMessageEndpoint(req, res, path, method, token);
      } else if (path.startsWith('/webhook/')) {
        this.handleWebhookEndpoint(req, res, path, method, token);
      } else {
        this.sendError(res, 404, 'Endpoint not found');
      }
    } catch (error) {
      console.error('Mock WuzAPI Error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  handleHealth(req, res) {
    this.sendSuccess(res, 200, {
      status: 'ok',
      service: 'wuzapi-mock',
      timestamp: new Date().toISOString()
    });
  }

  handleAdminEndpoint(req, res, path, method, token) {
    // Validar token administrativo
    if (!this.adminTokens.has(token)) {
      this.sendError(res, 401, 'Token administrativo inválido');
      return;
    }

    if (path === '/admin/users' && method === 'GET') {
      this.handleGetUsers(req, res);
    } else if (path === '/admin/users' && method === 'POST') {
      this.handleCreateUser(req, res);
    } else if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'GET') {
      const userId = path.split('/')[3];
      this.handleGetUser(req, res, userId);
    } else if (path.match(/^\/admin\/users\/[^\/]+$/) && method === 'DELETE') {
      const userId = path.split('/')[3];
      this.handleDeleteUser(req, res, userId, false);
    } else if (path.match(/^\/admin\/users\/[^\/]+\/full$/) && method === 'DELETE') {
      const userId = path.split('/')[3];
      this.handleDeleteUser(req, res, userId, true);
    } else {
      this.sendError(res, 404, 'Admin endpoint not found');
    }
  }

  handleSessionEndpoint(req, res, path, method, token) {
    // Validar token de usuário
    if (!token) {
      this.sendError(res, 400, 'Token necessário');
      return;
    }

    if (path === '/session/status' && method === 'GET') {
      this.handleSessionStatus(req, res, token);
    } else if (path === '/session/connect' && method === 'POST') {
      this.handleSessionConnect(req, res, token);
    } else if (path === '/session/disconnect' && method === 'POST') {
      this.handleSessionDisconnect(req, res, token);
    } else if (path === '/session/logout' && method === 'POST') {
      this.handleSessionLogout(req, res, token);
    } else if (path === '/session/qr' && method === 'GET') {
      this.handleSessionQR(req, res, token);
    } else {
      this.sendError(res, 404, 'Session endpoint not found');
    }
  }

  handleMessageEndpoint(req, res, path, method, token) {
    if (!token) {
      this.sendError(res, 400, 'Token necessário');
      return;
    }

    if (path === '/message/text' && method === 'POST') {
      this.handleSendTextMessage(req, res, token);
    } else if (path === '/message/media' && method === 'POST') {
      this.handleSendMediaMessage(req, res, token);
    } else {
      this.sendError(res, 404, 'Message endpoint not found');
    }
  }

  handleWebhookEndpoint(req, res, path, method, token) {
    if (!token) {
      this.sendError(res, 400, 'Token necessário');
      return;
    }

    if (path === '/webhook/set' && method === 'POST') {
      this.handleSetWebhook(req, res, token);
    } else if (path === '/webhook/get' && method === 'GET') {
      this.handleGetWebhook(req, res, token);
    } else {
      this.sendError(res, 404, 'Webhook endpoint not found');
    }
  }

  // Handlers específicos
  handleGetUsers(req, res) {
    const users = Array.from(this.users.values());
    this.sendSuccess(res, 200, {
      success: true,
      users: users,
      total: users.length,
      connected: users.filter(u => u.connected).length,
      logged_in: users.filter(u => u.loggedIn).length
    });
  }

  handleCreateUser(req, res) {
    this.getRequestBody(req, (body) => {
      try {
        const userData = JSON.parse(body);
        
        if (!userData.name || !userData.token) {
          this.sendError(res, 400, 'Nome e token são obrigatórios');
          return;
        }

        // Verificar se token já existe
        const existingUser = Array.from(this.users.values()).find(u => u.token === userData.token);
        if (existingUser) {
          this.sendError(res, 409, 'Usuário com este token já existe');
          return;
        }

        const newUser = {
          id: `user_${Date.now()}`,
          name: userData.name,
          token: userData.token,
          connected: false,
          loggedIn: false,
          jid: null,
          webhook: userData.webhook || null,
          events: userData.events || null
        };

        this.users.set(newUser.id, newUser);
        this.sessions.set(newUser.token, {
          connected: false,
          loggedIn: false,
          jid: null,
          qr: null
        });

        this.sendSuccess(res, 201, {
          success: true,
          data: newUser,
          message: 'Usuário criado com sucesso'
        });
      } catch (error) {
        this.sendError(res, 400, 'Dados inválidos');
      }
    });
  }

  handleGetUser(req, res, userId) {
    const user = this.users.get(userId);
    if (!user) {
      this.sendError(res, 404, 'Usuário não encontrado');
      return;
    }

    this.sendSuccess(res, 200, {
      success: true,
      data: user
    });
  }

  handleDeleteUser(req, res, userId, fullDeletion) {
    const user = this.users.get(userId);
    if (!user) {
      this.sendError(res, 404, 'Usuário não encontrado');
      return;
    }

    if (fullDeletion) {
      // Deleção completa - remover usuário e sessão
      this.users.delete(userId);
      this.sessions.delete(user.token);
    } else {
      // Deleção apenas do banco - manter sessão ativa
      this.users.delete(userId);
    }

    this.sendSuccess(res, 200, {
      success: true,
      data: {
        message: fullDeletion ? 'Usuário removido completamente' : 'Usuário removido do banco de dados',
        userId: userId,
        deletionType: fullDeletion ? 'full' : 'database_only'
      }
    });
  }

  handleSessionStatus(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    this.sendSuccess(res, 200, {
      success: true,
      data: {
        connected: session.connected,
        loggedIn: session.loggedIn,
        jid: session.jid
      }
    });
  }

  handleSessionConnect(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    // Simular conexão
    session.connected = true;
    session.qr = null;

    this.sendSuccess(res, 200, {
      success: true,
      message: 'Sessão conectada com sucesso'
    });
  }

  handleSessionDisconnect(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    // Simular desconexão
    session.connected = false;
    session.loggedIn = false;
    session.jid = null;

    this.sendSuccess(res, 200, {
      success: true,
      message: 'Sessão desconectada com sucesso'
    });
  }

  handleSessionLogout(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    // Simular logout
    session.loggedIn = false;
    session.jid = null;

    this.sendSuccess(res, 200, {
      success: true,
      message: 'Logout realizado com sucesso'
    });
  }

  handleSessionQR(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    if (session.connected && session.loggedIn) {
      this.sendSuccess(res, 200, {
        success: true,
        message: 'Sessão já conectada e logada',
        qr: null
      });
    } else {
      this.sendSuccess(res, 200, {
        success: true,
        qr: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        message: 'QR Code gerado'
      });
    }
  }

  handleSendTextMessage(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    if (!session.connected || !session.loggedIn) {
      this.sendError(res, 400, 'Sessão não conectada ou não logada');
      return;
    }

    this.getRequestBody(req, (body) => {
      try {
        const messageData = JSON.parse(body);
        
        if (!messageData.number || !messageData.text) {
          this.sendError(res, 400, 'Número e texto são obrigatórios');
          return;
        }

        this.sendSuccess(res, 200, {
          success: true,
          data: {
            messageId: `msg_${Date.now()}`,
            number: messageData.number,
            text: messageData.text,
            timestamp: new Date().toISOString()
          },
          message: 'Mensagem enviada com sucesso'
        });
      } catch (error) {
        this.sendError(res, 400, 'Dados inválidos');
      }
    });
  }

  handleSendMediaMessage(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    if (!session.connected || !session.loggedIn) {
      this.sendError(res, 400, 'Sessão não conectada ou não logada');
      return;
    }

    this.getRequestBody(req, (body) => {
      try {
        const messageData = JSON.parse(body);
        
        if (!messageData.number || !messageData.media) {
          this.sendError(res, 400, 'Número e mídia são obrigatórios');
          return;
        }

        this.sendSuccess(res, 200, {
          success: true,
          data: {
            messageId: `msg_${Date.now()}`,
            number: messageData.number,
            media: messageData.media,
            caption: messageData.caption || '',
            timestamp: new Date().toISOString()
          },
          message: 'Mídia enviada com sucesso'
        });
      } catch (error) {
        this.sendError(res, 400, 'Dados inválidos');
      }
    });
  }

  handleSetWebhook(req, res, token) {
    const session = this.sessions.get(token);
    if (!session) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    this.getRequestBody(req, (body) => {
      try {
        const webhookData = JSON.parse(body);
        
        // Encontrar usuário pelo token e atualizar webhook
        const user = Array.from(this.users.values()).find(u => u.token === token);
        if (user) {
          user.webhook = webhookData.webhook;
          user.events = webhookData.events;
        }

        this.sendSuccess(res, 200, {
          success: true,
          data: {
            webhook: webhookData.webhook,
            events: webhookData.events
          },
          message: 'Webhook configurado com sucesso'
        });
      } catch (error) {
        this.sendError(res, 400, 'Dados inválidos');
      }
    });
  }

  handleGetWebhook(req, res, token) {
    const user = Array.from(this.users.values()).find(u => u.token === token);
    if (!user) {
      this.sendError(res, 401, 'Token inválido');
      return;
    }

    this.sendSuccess(res, 200, {
      success: true,
      data: {
        webhook: user.webhook,
        events: user.events
      }
    });
  }

  // Métodos auxiliares
  getRequestBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      callback(body);
    });
  }

  sendSuccess(res, statusCode, data) {
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  sendError(res, statusCode, message) {
    res.writeHead(statusCode);
    res.end(JSON.stringify({
      success: false,
      error: message,
      code: statusCode,
      timestamp: new Date().toISOString()
    }));
  }

  // Métodos para manipular dados de teste
  addUser(userData) {
    const user = {
      id: userData.id || `user_${Date.now()}`,
      name: userData.name,
      token: userData.token,
      connected: userData.connected || false,
      loggedIn: userData.loggedIn || false,
      jid: userData.jid || null,
      webhook: userData.webhook || null,
      events: userData.events || null
    };

    this.users.set(user.id, user);
    this.sessions.set(user.token, {
      connected: user.connected,
      loggedIn: user.loggedIn,
      jid: user.jid,
      qr: user.connected ? null : 'mock-qr-code'
    });

    return user;
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.users.delete(userId);
      this.sessions.delete(user.token);
    }
    return user;
  }

  updateSession(token, sessionData) {
    const session = this.sessions.get(token);
    if (session) {
      Object.assign(session, sessionData);
    }
    return session;
  }

  addAdminToken(token) {
    this.adminTokens.add(token);
  }

  removeAdminToken(token) {
    this.adminTokens.delete(token);
  }

  reset() {
    this.users.clear();
    this.sessions.clear();
    this.adminTokens.clear();
    this.userTokens.clear();
    this.initializeMockData();
  }
}

module.exports = WuzAPIMock;