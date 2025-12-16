# FAQ - Perguntas Frequentes

Respostas para as dúvidas mais comuns sobre o WUZAPI Manager.

## 📋 Índice

- [Instalação e Setup](#instalação-e-setup)
- [Desenvolvimento](#desenvolvimento)
- [WUZAPI Integration](#wuzapi-integration)
- [Deploy e Produção](#deploy-e-produção)
- [Troubleshooting](#troubleshooting)
- [Contribuição](#contribuição)

## 🛠️ Instalação e Setup

### Q: Quais são os pré-requisitos para rodar o projeto?

**A:** Você precisa de:
- Node.js 20.x ou superior
- npm 10.x ou superior
- Git
- Docker (opcional, para deploy)

### Q: Como faço o setup inicial do projeto?

**A:** Execute os seguintes comandos:
```bash
git clone <repository-url>
cd wuzapi-manager
npm run setup
cp .env.example .env
cp server/.env.example server/.env
# Configure as variáveis de ambiente
npm run dev:full
```

### Q: O que fazer se o comando `npm run setup` falhar?

**A:** Tente:
1. Verificar se Node.js e npm estão nas versões corretas
2. Limpar cache: `npm cache clean --force`
3. Instalar manualmente: `npm install && cd server && npm install`
4. Verificar permissões de escrita no diretório

### Q: Como configurar as variáveis de ambiente?

**A:** Copie os arquivos de exemplo e configure:
```bash
# Frontend (.env)
VITE_ADMIN_TOKEN=seu-token-admin
VITE_API_URL=http://localhost:3001
VITE_WUZAPI_BASE_URL=https://wzapi.wasend.com.br

# Backend (server/.env)
DATABASE_PATH=./database.sqlite
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
REQUEST_TIMEOUT=30000
```

## 💻 Desenvolvimento

### Q: Como adicionar uma nova funcionalidade?

**A:** Siga este fluxo:
1. Use o CLI: `npm run generate route nome-funcionalidade`
2. Implemente a lógica no backend
3. Use o CLI: `npm run generate component NomeFuncionalidade`
4. Conecte frontend com backend
5. Teste e documente

### Q: Como usar o CLI de geração de código?

**A:** O CLI oferece vários geradores:
```bash
# Ver ajuda
npm run generate --help

# Gerar rota backend
npm run generate route admin-products

# Gerar componente React
npm run generate component ProductCard

# Gerar página completa
npm run generate page AdminProducts

# Gerar hook customizado
npm run generate hook useProducts
```

### Q: Qual é a estrutura de diretórios do projeto?

**A:**
```
wuzapi-manager/
├── src/                    # Frontend React
│   ├── components/         # Componentes React
│   │   ├── ui/            # Componentes base (shadcn/ui)
│   │   ├── ui-custom/     # Componentes customizados
│   │   ├── admin/         # Componentes administrativos
│   │   └── user/          # Componentes do usuário
│   ├── pages/             # Páginas da aplicação
│   ├── hooks/             # Hooks customizados
│   └── services/          # Serviços de API
├── server/                # Backend Node.js
│   ├── routes/            # Rotas da API
│   ├── middleware/        # Middlewares Express
│   └── utils/             # Utilitários backend
├── docs/                  # Documentação
└── templates/             # Templates para geração
```

### Q: Como executar testes?

**A:** Use os comandos de teste:
```bash
# Frontend
npm run test              # Modo watch
npm run test:run          # Execução única
npm run test:coverage     # Com coverage

# Backend
cd server
npm test                  # Todos os testes
npm run test:unit         # Testes unitários

# E2E
npm run test:e2e          # Cypress
```

### Q: Como debugar problemas no desenvolvimento?

**A:** Use estas ferramentas:
1. **Console do browser** para frontend
2. **Node.js debugger** para backend
3. **React DevTools** para componentes
4. **Network tab** para APIs
5. **Logs estruturados** no servidor

### Q: Como contribuir com o projeto?

**A:** Siga o [Guia de Contribuição](../CONTRIBUTING.md):
1. Fork o repositório
2. Crie uma branch para sua feature
3. Implemente seguindo os padrões
4. Execute testes
5. Abra um Pull Request

## 🔗 WUZAPI Integration

### Q: Como obter um token administrativo da WUZAPI?

**A:** Entre em contato com o suporte da WUZAPI ou consulte a documentação oficial. O token deve ser configurado na variável `VITE_ADMIN_TOKEN`.

### Q: Como conectar um usuário ao WhatsApp?

**A:** O fluxo é:
1. Criar usuário via API: `POST /api/admin/users`
2. Conectar sessão: `POST /api/wuzapi/connect`
3. Obter QR Code: `GET /api/wuzapi/qr`
4. Usuário escaneia QR Code no WhatsApp
5. Verificar status: `GET /api/wuzapi/status`

### Q: Por que o QR Code não aparece?

**A:** Possíveis causas:
- Usuário já está conectado (verifique status)
- Sessão não foi iniciada (chame connect primeiro)
- Token inválido
- Problemas de conectividade com WUZAPI

### Q: Como enviar mensagens via WUZAPI?

**A:** Use a API:
```javascript
POST /api/wuzapi/send-message
{
  "userToken": "token-do-usuario",
  "phone": "5511999999999",
  "message": "Sua mensagem aqui"
}
```

### Q: Como configurar webhooks?

**A:** Configure na criação do usuário:
```javascript
POST /api/admin/users
{
  "name": "Nome do Usuário",
  "webhook": "https://seu-site.com/webhook/wuzapi"
}
```

### Q: Quais eventos o webhook recebe?

**A:** Os principais eventos são:
- `message` - Mensagem recebida
- `connect` - Usuário conectou
- `disconnect` - Usuário desconectou
- `message_status` - Status da mensagem enviada

## 🚀 Deploy e Produção

### Q: Como fazer deploy com Docker?

**A:** Use Docker Compose:
```bash
# Build e deploy
docker-compose up -d

# Ou usar script
npm run deploy:build
./deploy/deploy.sh
```

### Q: Como configurar variáveis de ambiente em produção?

**A:** Configure no servidor:
```bash
# Variáveis obrigatórias
export VITE_ADMIN_TOKEN="seu-token-producao"
export DATABASE_PATH="/app/data/database.sqlite"
export NODE_ENV="production"
```

### Q: Como monitorar a aplicação em produção?

**A:** Use:
1. **Health checks**: `GET /health`
2. **Logs estruturados** no servidor
3. **Métricas de performance**
4. **Alertas para erros críticos**

### Q: Como fazer backup do banco de dados?

**A:** Para SQLite:
```bash
# Backup
cp database.sqlite database_backup_$(date +%Y%m%d).sqlite

# Ou usando sqlite3
sqlite3 database.sqlite ".backup backup.sqlite"
```

### Q: Como atualizar a aplicação em produção?

**A:** Siga este processo:
1. Fazer backup do banco
2. Parar a aplicação
3. Atualizar código
4. Executar migrações se necessário
5. Reiniciar aplicação
6. Verificar health checks

## 🔧 Troubleshooting

### Q: "Cannot find module" - como resolver?

**A:** Tente:
```bash
# Limpar e reinstalar
npm run clean:install

# Verificar versões
node --version
npm --version

# Verificar cache
npm cache verify
```

### Q: "Port already in use" - como resolver?

**A:**
```bash
# Encontrar processo
lsof -i :3000
lsof -i :3001

# Matar processo
kill -9 <PID>

# Ou usar porta diferente
PORT=3002 npm run dev
```

### Q: Problemas de CORS - como resolver?

**A:** Verifique:
1. Configuração CORS no `server/index.js`
2. URL do backend no frontend
3. Headers das requisições
4. Teste com curl para isolar o problema

### Q: Build de produção falha - o que fazer?

**A:**
```bash
# Verificar erros TypeScript
npx tsc --noEmit

# Limpar cache
rm -rf dist .tsbuildinfo

# Build com logs detalhados
npm run build -- --verbose
```

### Q: Docker build falha - como resolver?

**A:**
1. Verificar `.dockerignore`
2. Otimizar Dockerfile
3. Aumentar memória: `docker build --memory=4g`
4. Usar multi-stage build

### Q: Banco de dados locked - como resolver?

**A:**
```bash
# Verificar processos usando o banco
lsof database.sqlite

# Configurar WAL mode
sqlite3 database.sqlite "PRAGMA journal_mode = WAL;"

# Implementar timeout no código
db.configure('busyTimeout', 10000);
```

## 🤝 Contribuição

### Q: Como reportar um bug?

**A:** Abra uma issue no GitHub com:
1. Descrição clara do problema
2. Passos para reproduzir
3. Comportamento esperado vs atual
4. Screenshots se aplicável
5. Informações do ambiente

### Q: Como sugerir uma nova funcionalidade?

**A:** Abra uma issue com:
1. Descrição da funcionalidade
2. Justificativa/caso de uso
3. Proposta de implementação
4. Mockups se aplicável

### Q: Como fazer meu primeiro Pull Request?

**A:**
1. Fork o repositório
2. Clone seu fork
3. Crie branch: `git checkout -b feature/minha-feature`
4. Implemente seguindo os padrões
5. Teste sua implementação
6. Commit: `git commit -m "feat: adiciona nova funcionalidade"`
7. Push: `git push origin feature/minha-feature`
8. Abra Pull Request

### Q: Quais são os padrões de código?

**A:** Seguimos:
- **ESLint** para linting
- **Prettier** para formatação
- **Conventional Commits** para mensagens
- **TypeScript** para tipagem
- **React** best practices

### Q: Como testar minha contribuição?

**A:**
```bash
# Testes unitários
npm run test:run

# Linting
npm run lint

# Build
npm run build

# E2E (opcional)
npm run test:e2e
```

## 📚 Recursos Adicionais

### Documentação
- [Guia de Desenvolvimento](./DEVELOPMENT_GUIDE.md)
- [Guia de Troubleshooting](./TROUBLESHOOTING.md)
- [Documentação da API](./api/README.md)
- [Integração WUZAPI](./wuzapi/README.md)

### Ferramentas Úteis
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [VS Code Extensions](https://code.visualstudio.com/docs/editor/extension-marketplace)
- [Postman](https://www.postman.com/) para testar APIs

### Comunidade
- GitHub Issues para bugs e features
- Discussions para perguntas gerais
- Wiki para documentação colaborativa

---

**💡 Não encontrou sua pergunta?** Abra uma issue com a tag `question` ou consulte a [documentação completa](./README.md).