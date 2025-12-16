# Implementation Plan

- [x] 1. Simplificar frontend para um único campo HTML
  - Remover campo "Landing Page Completa" de `BrandingSettings.tsx`
  - Manter apenas campo "HTML da Página Inicial"
  - Remover validações restritivas do frontend
  - Garantir que `customHomeHtml` é enviado no payload de atualização
  - _Requirements: 1.1, 1.4_

- [x] 2. Remover sanitização restritiva no backend
  - Modificar `server/utils/htmlSanitizer.js` para modo permissivo
  - Permitir tags: `<script>`, `<style>`, `<html>`, `<head>`, `<body>`, etc.
  - Remover restrições de event handlers e protocolos
  - Manter apenas validação de tamanho (< 1MB)
  - _Requirements: 1.5_

- [x] 3. Simplificar rota de salvamento no backend
  - Modificar `server/routes/brandingRoutes.js`
  - Remover sanitização restritiva
  - Validar apenas tamanho (< 1MB)
  - Salvar HTML sem modificações
  - Adicionar log quando HTML é salvo
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 4. Implementar middleware na rota raiz para servir HTML customizado
  - Modificar `app.get('/')` em `server/index.js`
  - Buscar `brandingConfig` do banco de dados
  - Se `customHomeHtml` existe, retornar HTML com `res.send()`
  - Definir `Content-Type: text/html`
  - Se não existe, chamar `next()` para servir SPA React
  - Adicionar try-catch com fallback para SPA React em caso de erro
  - Adicionar log quando HTML customizado é servido
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 5. Testar fluxo completo
  - Login como admin
  - Navegar para Branding Settings
  - Colar HTML completo no campo (incluindo `<html>`, `<head>`, `<body>`, `<script>`)
  - Salvar e verificar mensagem de sucesso
  - Verificar no banco de dados que HTML foi salvo sem modificações
  - Logout
  - Acessar rota raiz `/`
  - Verificar que HTML customizado é exibido
  - Limpar HTML e verificar que SPA React volta a ser exibido
  - _Requirements: Todos_
