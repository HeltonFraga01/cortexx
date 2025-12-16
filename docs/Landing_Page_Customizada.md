# Landing Page Customizada - Guia de Implementação

## Visão Geral

O sistema agora suporta **dois tipos** de HTML customizado:

1. **HTML Snippet Sanitizado** (`custom_home_html`) - Para inserir dentro da aplicação
2. **Landing Page Completa** (`landing-custom.html`) - Arquivo HTML completo com scripts

## Por Que Dois Tipos?

### Problema Original

O validador HTML (`htmlSanitizer.js`) bloqueia tags `<script>` por segurança, o que é correto para conteúdo user-generated. Porém, landing pages modernas precisam de:

- Tailwind CSS via CDN
- Franken UI
- TAOS (animações)
- Outros scripts externos

### Solução

**Landing Page Completa** é servida como arquivo estático separado, **sem sanitização**, permitindo uso completo de HTML, CSS e JavaScript.

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Fluxo de Requisições                  │
└─────────────────────────────────────────────────────────┘

GET /                    → Landing Page Customizada
                           (se existir landing-custom.html)
                           OU Landing Page Padrão
                           (index-landing-page.html)
                           OU Aplicação React (fallback)

GET /login               → Aplicação React
GET /admin               → Aplicação React
GET /user                → Aplicação React

GET /api/*               → API Backend
```

## Estrutura de Arquivos

```
project/
├── server/
│   ├── public/
│   │   ├── landing-custom.html      # Landing page customizada (criada via API)
│   │   └── landing-default.html     # Template padrão (opcional)
│   └── routes/
│       └── landingPageRoutes.js     # API para gerenciar landing page
├── index-landing-page.html          # Landing page padrão do projeto
└── paginaBase.html                  # Template de referência
```

## API Endpoints

### 1. GET /api/admin/landing-page

Busca o conteúdo da landing page atual.

**Headers:**
```
Authorization: <ADMIN_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "<!DOCTYPE html>...",
    "isCustom": true,
    "path": "/path/to/landing-custom.html"
  }
}
```

### 2. PUT /api/admin/landing-page

Atualiza a landing page customizada.

**Headers:**
```
Authorization: <ADMIN_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "content": "<!DOCTYPE html>\n<html>...</html>"
}
```

**Validações:**
- Tamanho máximo: 500KB
- Deve conter: `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`
- Todas as tags devem estar fechadas

**Response:**
```json
{
  "success": true,
  "message": "Landing page atualizada com sucesso",
  "data": {
    "size": 12345,
    "path": "/path/to/landing-custom.html"
  }
}
```

### 3. DELETE /api/admin/landing-page

Reseta para a landing page padrão (remove customização).

**Headers:**
```
Authorization: <ADMIN_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "Landing page resetada para padrão"
}
```

## Como Usar

### 1. Via API (Programático)

```javascript
// Buscar landing page atual
const response = await fetch('/api/admin/landing-page', {
  headers: {
    'Authorization': adminToken
  }
});
const { data } = await response.json();
console.log(data.content);

// Atualizar landing page
const htmlContent = `<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <title>Minha Landing Page</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <h1>Bem-vindo!</h1>
</body>
</html>`;

await fetch('/api/admin/landing-page', {
  method: 'PUT',
  headers: {
    'Authorization': adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ content: htmlContent })
});

// Resetar para padrão
await fetch('/api/admin/landing-page', {
  method: 'DELETE',
  headers: {
    'Authorization': adminToken
  }
});
```

### 2. Via Interface Admin (Futuro)

Criar componente React no painel admin:

```typescript
// src/components/admin/LandingPageEditor.tsx
import { useState, useEffect } from 'react';

export function LandingPageEditor() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLandingPage();
  }, []);

  async function loadLandingPage() {
    const response = await fetch('/api/admin/landing-page', {
      headers: { 'Authorization': adminToken }
    });
    const { data } = await response.json();
    setContent(data.content);
  }

  async function saveLandingPage() {
    setLoading(true);
    try {
      await fetch('/api/admin/landing-page', {
        method: 'PUT',
        headers: {
          'Authorization': adminToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content })
      });
      alert('Landing page salva com sucesso!');
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>Editor de Landing Page</h2>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={30}
        style={{ width: '100%', fontFamily: 'monospace' }}
      />
      <button onClick={saveLandingPage} disabled={loading}>
        {loading ? 'Salvando...' : 'Salvar'}
      </button>
    </div>
  );
}
```

## Segurança

### Landing Page Completa (Não Sanitizada)

**Riscos:**
- Permite JavaScript arbitrário
- Pode conter código malicioso se admin for comprometido

**Mitigações:**
1. **Apenas admins** podem editar (token verificado)
2. **Backup automático** antes de cada atualização
3. **Validação estrutural** (DOCTYPE, tags essenciais)
4. **Limite de tamanho** (500KB)
5. **Logs de auditoria** de todas as mudanças

### HTML Snippet Sanitizado (Existente)

Para conteúdo dentro da aplicação, continue usando `custom_home_html` com sanitização completa.

## Diferenças Entre os Dois Tipos

| Característica | Landing Page Completa | HTML Snippet Sanitizado |
|----------------|----------------------|-------------------------|
| **Localização** | Arquivo separado | Banco de dados |
| **Sanitização** | Não (validação básica) | Sim (DOMPurify) |
| **Scripts** | ✅ Permitido | ❌ Bloqueado |
| **Uso** | Página inicial pública | Conteúdo dentro do app |
| **Tamanho máx** | 500KB | 100KB |
| **Acesso** | Público (/) | Autenticado |

## Boas Práticas

### 1. Use paginaBase.html como Template

```bash
# Copiar template
cp paginaBase.html server/public/landing-custom.html

# Editar conforme necessário
# Testar localmente
# Fazer upload via API
```

### 2. Teste Antes de Publicar

```bash
# Validar HTML
npx html-validate landing-custom.html

# Testar performance
npx lighthouse http://localhost:8080 --view
```

### 3. Mantenha Backups

O sistema cria backups automáticos, mas mantenha cópias locais:

```bash
# Baixar backup
curl -H "Authorization: $ADMIN_TOKEN" \
  http://localhost:8080/api/admin/landing-page \
  | jq -r '.data.content' > backup-$(date +%Y%m%d).html
```

### 4. Monitore Performance

Landing pages devem carregar em < 2 segundos:

- Minimize CSS/JS inline
- Use CDNs para bibliotecas
- Otimize imagens
- Implemente lazy loading

## Troubleshooting

### Erro: "HTML contém padrões perigosos"

**Causa:** Tentando usar `custom_home_html` (sanitizado) para landing page completa.

**Solução:** Use a API de landing page completa (`/api/admin/landing-page`).

### Landing Page Não Aparece

**Verificar:**
1. Arquivo existe em `server/public/landing-custom.html`
2. Servidor foi reiniciado após criar arquivo
3. Rota `/` não está sendo interceptada por outro middleware

**Debug:**
```bash
# Verificar se arquivo existe
ls -la server/public/landing-custom.html

# Testar endpoint diretamente
curl http://localhost:8080/
```

### Erro 401 ao Salvar

**Causa:** Token de admin inválido.

**Solução:**
```bash
# Verificar token no .env
echo $VITE_ADMIN_TOKEN

# Usar token correto
curl -X PUT \
  -H "Authorization: $VITE_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"..."}' \
  http://localhost:8080/api/admin/landing-page
```

## Próximos Passos

1. ✅ API de landing page implementada
2. ⏳ Interface admin para edição visual
3. ⏳ Preview em tempo real
4. ⏳ Versionamento de landing pages
5. ⏳ A/B testing de landing pages
6. ⏳ Analytics integrado

## Referências

- [paginaBase.html](../paginaBase.html) - Template de referência
- [Guia_Landing_Pages_SaaS.md](./Guia_Landing_Pages_SaaS.md) - Boas práticas
- [htmlSanitizer.js](../server/utils/htmlSanitizer.js) - Sanitizador para snippets
- [landingPageRoutes.js](../server/routes/landingPageRoutes.js) - API de landing page

---

**Última atualização:** 2025-01-07  
**Versão:** 1.0
