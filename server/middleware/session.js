const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const path = require('path');

// Resolver o caminho correto do diretório data
// __dirname é server/middleware, então subimos 2 níveis para chegar na raiz do projeto
const dataDir = path.resolve(__dirname, '../../data');

const sessionConfig = {
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: dataDir,
    table: 'sessions'
  }),
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  name: 'wuzapi.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    // Secure apenas se HTTPS estiver disponível (não apenas em produção)
    // Permite testes locais em produção via HTTP
    secure: process.env.COOKIE_SECURE === 'true' || false,
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
};

module.exports = sessionConfig;
