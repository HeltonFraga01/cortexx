# Documentação Técnica - Editor de Página Inicial Customizada

## 📋 Índice

1. [Arquitetura](#arquitetura)
2. [Endpoints de API](#endpoints-de-api)
3. [Estrutura de Dados](#estrutura-de-dados)
4. [Processo de Sanitização](#processo-de-sanitização)
5. [Componentes Frontend](#componentes-frontend)
6. [Fluxo de Dados](#fluxo-de-dados)
7. [Segurança](#segurança)
8. [Performance](#performance)

---

## Arquitetura

### Visão Geral

```
┌─────────────────┐
│   Frontend      │
│  (React/TS)     │
└────────┬────────┘
         │
         │ HTTP/REST
         │
┌────────▼────────┐
│   Backend       │
│  (Node.js)      │
└────────┬────────┘
         │
         │ SQL
         │
┌────────▼────────┐
│   Database      │
│   (SQLite)      │
└─────────────────┘
```

### Camadas

1. **Apresentação**: Componentes React (CustomHomeHtmlEditor, HtmlPreviewModal)
2. **Lógica de Negócio**: Serviços (brandingService, htmlSanitizer)
3. **API**: Rotas Express (brandingRoutes)
4. **Persistência**: Database SQLite (branding_config table)

---

## Endpoints de API

### GET /api/admin/branding

Recupera a configuração de branding incluindo HTML customizado.

**Headers**:
```
Authorization: {admin_token}
```

**Response Success (200)**:
```json
{
  "success": true,
  "code": 200,
  "data": {
    "id": 1,
    "appName": "WUZAPI",
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#3B82F6",
    "secondaryColor": "#8B5CF6",
    "customHomeHtml": "<div>...</div>",
    "createdAt": "2025-11-07T10:00:00.000Z",
    "updatedAt": "2025-11-07T12:00:00.000Z"
  }
}
```

**Response Error (400/401/403/500)**:
```json
{
  "success": false,
  "error": "Mensagem de erro",
  "code": 400
}
```

### PUT /api/admin/branding

Atualiza a configuração de branding incluindo HTML customizado.

**Headers**:
```
Authorization: {admin_token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "appName": "Minha Empresa",
  "logoUrl": "https://example.com/logo.png",
  "primaryColor": "#FF5733",
  "secondaryColor": "#33FF57",
  "customHomeHtml": "<div>HTML customizado</div>"
}
```

**Response Success (200)**:
```json
{
  "success": true,
  "code": 200,
  "message": "Configuração de branding atualizada com sucesso",
  "data": {
    "id": 1,
    "appName": "Minha Empresa",
    "logoUrl": "https://example.com/logo.png",
    "primaryColor": "#FF5733",
    "secondaryColor": "#33FF57",
    "customHomeHtml": "<div>HTML customizado</div>",
    "createdAt": "2025-11-07T10:00:00.000Z",
    "updatedAt": "2025-11-07T14:30:00.000Z"
  }
}
```

**Response Error (400)**:
```json
{
  "success": false,
  "error": "HTML customizado contém conteúdo inválido ou perigoso",
  "details": [
    "HTML contém padrões perigosos detectados"
  ],
  "warnings": [
    "Padrões detectados: /<script/gi, /onclick/gi"
  ],
  "code": 400
}
```

---

## Estrutura de Dados

### Database Schema

**Tabela: `branding_config`**

```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_home_html TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### TypeScript Interfaces

**BrandingConfig**:
```typescript
interface BrandingConfig {
  id: number | null;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
```

**BrandingConfigUpdate**:
```typescript
interface BrandingConfigUpdate {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customHomeHtml?: string | null;
}
```

---

## Processo de Sanitização

### Fluxo de Sanitização

```
1. Frontend Validation
   ↓
2. Backend Validation
   ↓
3. DOMPurify Sanitization
   ↓
4. Database Storage
   ↓
5. Safe Rendering
```

### Frontend Validation

**Arquivo**: `src/services/branding.ts`

**Validações**:
- Tamanho máximo: 100KB (100.000 bytes)
- Detecção de 11 padrões perigosos
- Verificação de conteúdo válido
- Detecção de tags não fechadas

**Padrões Detectados**:
```typescript
const dangerousPatterns = [
  /on\w+\s*=/gi,           // Event handlers
  /javascript:/gi,          // JavaScript protocol
  /data:text\/html/gi,     // Data URIs HTML
  /<script/gi,             // Script tags
  /<iframe/gi,             // Iframe tags
  /<object/gi,             // Object tags
  /<embed/gi,              // Embed tags
  /<applet/gi,             // Applet tags
  /<meta\s+http-equiv/gi,  // Meta http-equiv
  /@import/gi,             // CSS imports
  /expression\s*\(/gi      // CSS expressions
];
```

### Backend Sanitization

**Arquivo**: `server/utils/htmlSanitizer.js`

**Biblioteca**: DOMPurify + JSDOM

**Tags Permitidas**:
```javascript
const allowedTags = [
  // Estrutura
  'div', 'span', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav',
  // Texto
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
  'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
  'blockquote', 'pre', 'code',
  // Listas
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  // Tabelas
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  // Mídia
  'img', 'figure', 'figcaption', 'picture', 'source', 'video', 'audio', 'track',
  // Links e botões
  'a', 'button',
  // Formulários (limitado)
  'form', 'input', 'textarea', 'select', 'option', 'label',
  // Outros
  'time', 'address', 'abbr', 'cite', 'q', 'kbd', 'samp', 'var'
];
```

**Atributos Permitidos**:
```javascript
const allowedAttributes = [
  'id', 'class', 'style', 'title', 'lang', 'dir',
  'data-*', 'aria-*', 'role',
  'href', 'target', 'rel',
  'src', 'alt', 'width', 'height', 'loading',
  'srcset', 'sizes', 'poster', 'controls', 'autoplay', 'loop', 'muted',
  'type', 'name', 'value', 'placeholder', 'disabled', 'readonly',
  'checked', 'selected', 'required', 'min', 'max', 'step',
  'colspan', 'rowspan', 'scope',
  'datetime', 'cite'
];
```

**Configuração DOMPurify**:
```javascript
const config = {
  ALLOWED_TAGS: allowedTags,
  ALLOWED_ATTR: allowedAttributes,
  ALLOW_DATA_ATTR: true,
  ALLOW_ARIA_ATTR: true,
  KEEP_CONTENT: true,
  SAFE_FOR_TEMPLATES: true,
  WHOLE_DOCUMENT: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'applet', 'base', 'link', 'meta']
};
```

---

## Componentes Frontend

### CustomHomeHtmlEditor

**Arquivo**: `src/components/admin/CustomHomeHtmlEditor.tsx`

**Props**:
```typescript
interface CustomHomeHtmlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onPreview: () => void;
  onReset: () => void;
  disabled?: boolean;
  errors?: string[];
  warnings?: string[];
}
```

**Funcionalidades**:
- Textarea com fonte monoespaçada
- Contador de caracteres em tempo real
- Indicador de tamanho em KB
- Barra de progresso visual
- Alert informativo com variáveis CSS
- Exibição de erros e warnings

### HtmlPreviewModal

**Arquivo**: `src/components/admin/HtmlPreviewModal.tsx`

**Props**:
```typescript
interface HtmlPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  brandingConfig: BrandingConfig;
}
```

**Funcionalidades**:
- Modal com Dialog do shadcn/ui
- Iframe sandboxed para segurança
- Injeção de CSS com variáveis de branding
- Suporte a tema claro/escuro
- Botão para abrir em nova aba

### BrandingSettings

**Arquivo**: `src/components/admin/BrandingSettings.tsx`

**Integrações**:
- CustomHomeHtmlEditor
- HtmlPreviewModal
- brandingService para validação
- useBranding hook para estado global

---

## Fluxo de Dados

### Salvamento de HTML

```
1. Usuário edita HTML no CustomHomeHtmlEditor
   ↓
2. onChange atualiza estado local
   ↓
3. Validação em tempo real (brandingService.validateBrandingConfig)
   ↓
4. Usuário clica em "Salvar"
   ↓
5. Validação final no frontend
   ↓
6. PUT /api/admin/branding
   ↓
7. Backend valida e sanitiza (htmlSanitizer)
   ↓
8. Salva no database
   ↓
9. Retorna configuração atualizada
   ↓
10. Frontend atualiza cache e estado global
```

### Renderização de HTML

```
1. UserOverview carrega
   ↓
2. useBranding hook busca configuração (cache ou API)
   ↓
3. Verifica se customHomeHtml existe
   ↓
4. Se existe:
   - Gera variáveis CSS inline
   - Renderiza com dangerouslySetInnerHTML
   ↓
5. Se não existe:
   - Renderiza dashboard padrão
```

---

## Segurança

### Camadas de Segurança

1. **Validação Frontend**: Detecta padrões perigosos antes de enviar
2. **Sanitização Backend**: DOMPurify remove todo código malicioso
3. **Whitelist de Tags**: Apenas tags seguras são permitidas
4. **Whitelist de Atributos**: Apenas atributos seguros são permitidos
5. **Iframe Sandboxed**: Preview usa iframe com sandbox
6. **CSP Headers**: Content Security Policy no servidor

### Proteções Implementadas

- ✅ XSS (Cross-Site Scripting)
- ✅ Script Injection
- ✅ Event Handler Injection
- ✅ CSS Expression Injection
- ✅ Data URI Attacks
- ✅ Meta Refresh Attacks
- ✅ Iframe Injection

### Limitações

- Tamanho máximo: 100KB
- Sem JavaScript
- Sem iframes
- Sem imports externos
- Sem meta tags perigosas

---

## Performance

### Otimizações Implementadas

1. **Cache de Branding**:
   - Duração: 5 minutos
   - Armazenamento: Memória + localStorage
   - Invalidação: Manual ou automática

2. **Lazy Loading**:
   - Componentes carregados sob demanda
   - Preview renderizado apenas quando aberto

3. **Validação Assíncrona**:
   - Validação não bloqueia UI
   - Feedback em tempo real

4. **Sanitização Eficiente**:
   - DOMPurify otimizado
   - Processamento único no backend

### Métricas Esperadas

- **Tempo de carregamento**: < 100ms (com cache)
- **Tempo de salvamento**: < 500ms
- **Tempo de preview**: < 200ms
- **Tamanho do bundle**: +15KB (gzipped)

---

## Exemplos de Uso

### Exemplo 1: Salvar HTML via API

```javascript
const response = await fetch('/api/admin/branding', {
  method: 'PUT',
  headers: {
    'Authorization': adminToken,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customHomeHtml: '<div>Meu HTML</div>'
  })
});

const data = await response.json();
console.log(data.data.customHomeHtml);
```

### Exemplo 2: Validar HTML no Frontend

```typescript
import { brandingService } from '@/services/branding';

const validation = brandingService.validateBrandingConfig({
  customHomeHtml: '<div>Teste</div>'
});

if (!validation.isValid) {
  console.error('Erros:', validation.errors);
}
```

### Exemplo 3: Sanitizar HTML no Backend

```javascript
const htmlSanitizer = require('./utils/htmlSanitizer');

const result = htmlSanitizer.validateAndSanitize(html);

if (result.success) {
  console.log('HTML sanitizado:', result.sanitized);
} else {
  console.error('Erros:', result.errors);
}
```

---

## Troubleshooting

### Problema: HTML não está sendo sanitizado

**Solução**: Verificar se DOMPurify e JSDOM estão instalados:
```bash
npm install dompurify jsdom
```

### Problema: Variáveis CSS não funcionam

**Solução**: Verificar se as cores estão configuradas no branding e se o CSS está sendo injetado corretamente.

### Problema: Preview não abre

**Solução**: Verificar console do navegador para erros e garantir que o Dialog do shadcn/ui está configurado.

---

## Manutenção

### Atualizando Tags Permitidas

Editar `server/utils/htmlSanitizer.js`:
```javascript
this.allowedTags = [
  // Adicionar novas tags aqui
  'nova-tag'
];
```

### Atualizando Padrões Perigosos

Editar `src/services/branding.ts`:
```typescript
const dangerousPatterns = [
  // Adicionar novos padrões aqui
  /novo-padrao/gi
];
```

---

**Última atualização**: 2025-11-07  
**Versão**: 1.0.0  
**Autor**: Equipe de Desenvolvimento
