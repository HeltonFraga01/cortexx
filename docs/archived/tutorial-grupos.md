# Tutorial Completo: Sistema de Grupos

Tutorial passo-a-passo para implementar um sistema completo de grupos no WUZAPI Manager.

## 🎯 Objetivo

Implementar um sistema de grupos que permite:
- Criar e gerenciar grupos de contatos
- Enviar mensagens para grupos
- Interface administrativa para CRUD de grupos
- Integração com WUZAPI para grupos do WhatsApp

## 📋 Pré-requisitos

- Ambiente de desenvolvimento configurado
- Conhecimento básico de React e Node.js
- Familiaridade com SQLite e APIs REST
- WUZAPI Manager rodando localmente

## 🏗️ Planejamento

### Funcionalidades
1. **Backend**: API REST para grupos
2. **Frontend**: Interface administrativa
3. **Integração**: Sincronização com WhatsApp
4. **Testes**: Cobertura completa

### Estrutura de Dados
```sql
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  user_token TEXT NOT NULL,
  whatsapp_group_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups (id)
);
```

## 🔧 Implementação Backend

### Passo 1: Criar Migração do Banco
P
rimeiro, vamos criar a migração para as tabelas de grupos:

```bash
# Gerar migração
npm run generate migration create_groups_tables
```

🔧 **Código para implementar** - `server/migrations/001_create_groups_tables.js`:
```javascript
const sqlite3 = require('sqlite3').verbose();

async function up(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabela de grupos
      db.run(`
        CREATE TABLE IF NOT EXISTS groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          user_token TEXT NOT NULL,
          whatsapp_group_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Tabela de contatos do grupo
      db.run(`
        CREATE TABLE IF NOT EXISTS group_contacts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          phone TEXT NOT NULL,
          name TEXT,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function down(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS group_contacts');
      db.run('DROP TABLE IF EXISTS groups', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = { up, down };
```

### Passo 2: Gerar Rota Backend

```bash
# Usar CLI para gerar rota administrativa
npm run generate route admin-groups
```🔧
 **Implementar** - `server/routes/admin-groupsRoutes.js`:
```javascript
const express = require('express');
const adminValidator = require('../validators/adminValidator');
const errorHandler = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

// GET /api/admin-groups - Listar grupos
router.get('/',
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.authorization;
      const db = req.app.locals.db;
      
      // Validar token admin
      const isValidAdmin = await adminValidator.validateAdminToken(token);
      if (!isValidAdmin.isValid) {
        return res.status(401).json({
          success: false,
          error: 'Token administrativo inválido',
          code: 401,
          timestamp: new Date().toISOString()
        });
      }

      // Buscar grupos com contagem de contatos
      const groups = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            g.*,
            COUNT(gc.id) as contact_count
          FROM groups g
          LEFT JOIN group_contacts gc ON g.id = gc.group_id
          GROUP BY g.id
          ORDER BY g.created_at DESC
        `, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });

      const duration = Date.now() - startTime;
      
      logger.info('Grupos listados com sucesso', {
        count: groups.length,
        duration: `${duration}ms`,
        url: req.url,
        method: req.method
      });

      return res.status(200).json({
        success: true,
        code: 200,
        data: groups,
        message: 'Grupos recuperados com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Erro ao listar grupos', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`,
        url: req.url,
        method: req.method
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);
```// POST 
/api/admin-groups - Criar grupo
router.post('/',
  errorHandler.validateAdminTokenFormat.bind(errorHandler),
  async (req, res) => {
    const startTime = Date.now();
    
    try {
      const token = req.headers.authorization;
      const { name, description, user_token, contacts } = req.body;
      const db = req.app.locals.db;
      
      // Validar token admin
      const isValidAdmin = await adminValidator.validateAdminToken(token);
      if (!isValidAdmin.isValid) {
        return res.status(401).json({
          success: false,
          error: 'Token administrativo inválido',
          code: 401,
          timestamp: new Date().toISOString()
        });
      }

      // Validar dados obrigatórios
      if (!name || !user_token) {
        return res.status(400).json({
          success: false,
          error: 'Nome e token do usuário são obrigatórios',
          code: 400,
          timestamp: new Date().toISOString()
        });
      }

      // Criar grupo
      const groupId = await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO groups (name, description, user_token)
          VALUES (?, ?, ?)
        `, [name, description, user_token], function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        });
      });

      // Adicionar contatos se fornecidos
      if (contacts && contacts.length > 0) {
        for (const contact of contacts) {
          await new Promise((resolve, reject) => {
            db.run(`
              INSERT INTO group_contacts (group_id, phone, name)
              VALUES (?, ?, ?)
            `, [groupId, contact.phone, contact.name], (err) => {
              if (err) reject(err);
              else resolve();
            });
          });
        }
      }

      // Buscar grupo criado com contatos
      const createdGroup = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            g.*,
            COUNT(gc.id) as contact_count
          FROM groups g
          LEFT JOIN group_contacts gc ON g.id = gc.group_id
          WHERE g.id = ?
          GROUP BY g.id
        `, [groupId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      const duration = Date.now() - startTime;
      
      logger.info('Grupo criado com sucesso', {
        groupId,
        name,
        contactCount: contacts?.length || 0,
        duration: `${duration}ms`
      });

      return res.status(201).json({
        success: true,
        code: 201,
        data: createdGroup,
        message: 'Grupo criado com sucesso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Erro ao criar grupo', {
        error: error.message,
        stack: error.stack,
        duration: `${duration}ms`
      });

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        code: 500,
        timestamp: new Date().toISOString()
      });
    }
  }
);

module.exports = router;
```

### Passo 3: Registrar Rota

🔧 **Adicionar em** `server/index.js`:
```javascript
// Registrar rota de grupos
app.use('/api/admin-groups', require('./routes/admin-groupsRoutes'));
```