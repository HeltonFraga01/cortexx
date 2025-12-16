# Exemplo: Sistema de Notificações

Como implementar um sistema de notificações em tempo real no WUZAPI Manager.

## 🎯 Objetivo

Criar um sistema completo de notificações que:
- Exibe notificações em tempo real
- Persiste notificações no banco
- Permite marcar como lida/não lida
- Suporte a diferentes tipos de notificação
- Interface de usuário intuitiva

## 📋 Funcionalidades

### Backend
- WebSocket para tempo real
- API REST para CRUD
- Diferentes tipos de notificação
- Sistema de prioridades

### Frontend
- Componente de notificações
- Toast notifications
- Badge com contador
- Lista de notificações

## 🔧 Implementação Backend

### Passo 1: Estrutura do Banco

🔧 **Migração** `server/migrations/002_create_notifications.js`:
```javascript
async function up(db) {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_token TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('info', 'success', 'warning', 'error')),
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        priority INTEGER DEFAULT 1 CHECK (priority IN (1, 2, 3)),
        read_at DATETIME NULL,
        data JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NULL
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function down(db) {
  return new Promise((resolve, reject) => {
    db.run('DROP TABLE IF EXISTS notifications', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

module.exports = { up, down };
```

### Passo 2: Serviço de Notificações

🔧 **Criar** `server/services/notificationService.js`:
```javascript
const WebSocket = require('ws');
const logger = require('../utils/logger');

class NotificationService {
  constructor() {
    this.clients = new Map(); // userToken -> WebSocket
    this.db = null;
  }

  initialize(server, database) {
    this.db = database;
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws/notifications'
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    logger.info('Notification service initialized');
  }

  handleConnection(ws, req) {
    const userToken = this.extractUserToken(req);
    
    if (!userToken) {
      ws.close(1008, 'Token required');
      return;
    }

    // Armazenar conexão
    this.clients.set(userToken, ws);
    
    logger.info('WebSocket connected', { userToken });

    // Enviar notificações não lidas
    this.sendUnreadNotifications(userToken, ws);

    ws.on('message', (message) => {
      this.handleMessage(userToken, message);
    });

    ws.on('close', () => {
      this.clients.delete(userToken);
      logger.info('WebSocket disconnected', { userToken });
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', { userToken, error: error.message });
      this.clients.delete(userToken);
    });
  }

  extractUserToken(req) {
    const url = new URL(req.url, 'http://localhost');
    return url.searchParams.get('token');
  }

  async sendUnreadNotifications(userToken, ws) {
    try {
      const notifications = await this.getUnreadNotifications(userToken);
      
      if (notifications.length > 0) {
        ws.send(JSON.stringify({
          type: 'unread_notifications',
          data: notifications
        }));
      }
    } catch (error) {
      logger.error('Error sending unread notifications', {
        userToken,
        error: error.message
      });
    }
  }

  async createNotification(userToken, notification) {
    try {
      const { type, title, message, priority = 1, data = null, expiresAt = null } = notification;

      const id = await new Promise((resolve, reject) => {
        this.db.run(`
          INSERT INTO notifications (user_token, type, title, message, priority, data, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userToken, type, title, message, priority, JSON.stringify(data), expiresAt], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      const createdNotification = await this.getNotification(id);

      // Enviar via WebSocket se cliente conectado
      const client = this.clients.get(userToken);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'new_notification',
          data: createdNotification
        }));
      }

      logger.info('Notification created', {
        id,
        userToken,
        type,
        title
      });

      return createdNotification;
    } catch (error) {
      logger.error('Error creating notification', {
        userToken,
        error: error.message
      });
      throw error;
    }
  }
```