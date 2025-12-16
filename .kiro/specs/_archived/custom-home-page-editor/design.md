# Design Document - Custom HOME Page Editor

## Overview

Esta funcionalidade permite que administradores personalizem o conteúdo da página HOME (página inicial) através de um editor de HTML customizado no painel administrativo. A solução integra-se ao sistema de branding existente e fornece uma interface segura para edição e preview de conteúdo HTML.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Admin Panel (Frontend)                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  BrandingSettings Component                          │  │
│  │  ├─ Custom HTML Editor Section                       │  │
│  │  │  ├─ Textarea for HTML input                       │  │
│  │  │  ├─ Preview Button                                │  │
│  │  │  ├─ Reset to Default Button                       │  │
│  │  │  └─ Save Button                                   │  │
│  │  └─ Preview Modal                                    │  │
│  │     └─ Sandboxed iframe for HTML rendering          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend API (Express)                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Branding Routes (/api/admin/branding)               │  │
│  │  ├─ GET  - Retrieve branding config                  │  │
│  │  └─ PUT  - Update branding config                    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  HTML Sanitization Service                           │  │
│  │  ├─ DOMPurify integration                            │  │
│  │  ├─ Whitelist safe HTML tags                         │  │
│  │  └─ Remove dangerous attributes                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ SQLite
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (SQLite)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  branding_config table                               │  │
│  │  ├─ id                                               │  │
│  │  ├─ app_name                                         │  │
│  │  ├─ logo_url                                         │  │
│  │  ├─ primary_color                                    │  │
│  │  ├─ secondary_color                                  │  │
│  │  ├─ custom_home_html (NEW)                           │  │
│  │  ├─ created_at                                       │  │
│  │  └─ updated_at                                       │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   User Dashboard (Frontend)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  UserOverview Component                              │  │
│  │  └─ Custom HTML Renderer                             │  │
│  │     ├─ Fetch custom HTML from branding config        │  │
│  │     ├─ Apply branding CSS variables                  │  │
│  │     └─ Render sanitized HTML                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Admin edits HTML** → Frontend validates → Sends to backend
2. **Backend receives HTML** → Sanitizes content → Validates → Stores in database
3. **User accesses HOME** → Frontend fetches branding config → Renders custom HTML with branding styles

## Components and Interfaces

### 1. Database Schema Extension

**Migration**: Add `custom_home_html` column to `branding_config` table

```sql
ALTER TABLE branding_config 
ADD COLUMN custom_home_html TEXT DEFAULT NULL;
```

**Updated Table Structure**:
```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name VARCHAR(50) NOT NULL DEFAULT 'WUZAPI',
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_home_html TEXT,  -- NEW FIELD
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Backend Components

#### 2.1 Database Methods (server/database.js)

**Update existing methods**:

```javascript
// Extend getBrandingConfig()
async getBrandingConfig() {
  const sql = `
    SELECT id, app_name, logo_url, primary_color, secondary_color, 
           custom_home_html, created_at, updated_at
    FROM branding_config 
    ORDER BY id DESC 
    LIMIT 1
  `;
  // ... existing logic
  return {
    id: config.id,
    appName: config.app_name,
    logoUrl: config.logo_url,
    primaryColor: config.primary_color,
    secondaryColor: config.secondary_color,
    customHomeHtml: config.custom_home_html,  // NEW
    createdAt: config.created_at,
    updatedAt: config.updated_at
  };
}

// Extend updateBrandingConfig()
async updateBrandingConfig(configData) {
  const validatedData = this.validateBrandingData(configData);
  
  const sql = `
    UPDATE branding_config SET
      app_name = ?, logo_url = ?, primary_color = ?, 
      secondary_color = ?, custom_home_html = ?,  -- NEW
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  // ... existing logic
}

// Extend validateBrandingData()
validateBrandingData(data) {
  const validated = {};
  // ... existing validations
  
  // Validate custom_home_html
  if (data.customHomeHtml !== undefined && data.customHomeHtml !== null) {
    if (typeof data.customHomeHtml !== 'string') {
      throw new Error('HTML customizado deve ser uma string');
    }
    // Length validation (max 100KB)
    if (data.customHomeHtml.length > 100000) {
      throw new Error('HTML customizado excede o tamanho máximo de 100KB');
    }
    validated.customHomeHtml = data.customHomeHtml;
  } else {
    validated.customHomeHtml = null;
  }
  
  return validated;
}
```

#### 2.2 HTML Sanitization Service (server/utils/htmlSanitizer.js)

**New file**: Create a dedicated service for HTML sanitization

```javascript
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const { logger } = require('./logger');

class HtmlSanitizer {
  constructor() {
    const window = new JSDOM('').window;
    this.DOMPurify = createDOMPurify(window);
    
    // Configure allowed tags and attributes
    this.config = {
      ALLOWED_TAGS: [
        'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'a', 'img', 'strong', 'em', 'br',
        'section', 'article', 'header', 'footer', 'nav',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'button', 'form', 'input', 'label', 'select', 'option'
      ],
      ALLOWED_ATTR: [
        'class', 'id', 'style', 'href', 'src', 'alt', 'title',
        'width', 'height', 'target', 'rel', 'type', 'placeholder',
        'value', 'name', 'data-*'
      ],
      ALLOW_DATA_ATTR: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
    };
  }

  sanitize(html) {
    try {
      const clean = this.DOMPurify.sanitize(html, this.config);
      logger.info('✅ HTML sanitizado com sucesso');
      return clean;
    } catch (error) {
      logger.error('❌ Erro ao sanitizar HTML:', error.message);
      throw new Error('Falha ao sanitizar HTML');
    }
  }

  validate(html) {
    const dangerous = ['<script', '<iframe', 'javascript:', 'onerror=', 'onload='];
    const found = dangerous.filter(pattern => 
      html.toLowerCase().includes(pattern.toLowerCase())
    );
    
    return {
      isValid: found.length === 0,
      dangerousPatterns: found
    };
  }
}

module.exports = new HtmlSanitizer();
```

#### 2.3 Branding Routes Extension (server/routes/brandingRoutes.js)

**Update PUT route** to handle HTML sanitization:

```javascript
const htmlSanitizer = require('../utils/htmlSanitizer');

router.put('/', async (req, res) => {
  // ... existing validation
  
  const brandingData = req.body;
  
  // Sanitize custom HTML if provided
  if (brandingData.customHomeHtml) {
    const validation = htmlSanitizer.validate(brandingData.customHomeHtml);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'HTML contém elementos perigosos',
        dangerousPatterns: validation.dangerousPatterns,
        code: 400
      });
    }
    
    brandingData.customHomeHtml = htmlSanitizer.sanitize(brandingData.customHomeHtml);
  }
  
  // ... existing update logic
});
```

### 3. Frontend Components

#### 3.1 Type Definitions (src/types/branding.ts)

**Extend existing types**:

```typescript
export interface BrandingConfig {
  id: number | null;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;  // NEW
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BrandingConfigUpdate {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customHomeHtml?: string | null;  // NEW
}
```

#### 3.2 Branding Service Extension (src/services/branding.ts)

**Update validation method**:

```typescript
validateBrandingConfig(config: BrandingConfigUpdate): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // ... existing validations
  
  // Validate custom HTML
  if (config.customHomeHtml !== undefined && config.customHomeHtml !== null) {
    if (config.customHomeHtml.length > 100000) {
      errors.push('HTML customizado excede 100KB');
    }
    
    // Check for dangerous patterns
    const dangerous = ['<script', '<iframe', 'javascript:', 'onerror='];
    const found = dangerous.filter(pattern => 
      config.customHomeHtml!.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (found.length > 0) {
      errors.push(`HTML contém elementos perigosos: ${found.join(', ')}`);
    }
  }
  
  return { isValid: errors.length === 0, errors, warnings };
}
```

#### 3.3 Custom HTML Editor Component (src/components/admin/CustomHomeHtmlEditor.tsx)

**New component** for editing custom HTML:

```typescript
interface CustomHomeHtmlEditorProps {
  value: string | null;
  onChange: (value: string) => void;
  onPreview: () => void;
  onReset: () => void;
}

const CustomHomeHtmlEditor: React.FC<CustomHomeHtmlEditorProps> = ({
  value,
  onChange,
  onPreview,
  onReset
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>HTML Customizado da Página HOME</Label>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onPreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetar
          </Button>
        </div>
      </div>
      
      <Textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cole seu HTML customizado aqui..."
        className="font-mono text-sm min-h-[400px]"
      />
      
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Use variáveis CSS para cores: var(--primary-color), var(--secondary-color)
        </AlertDescription>
      </Alert>
    </div>
  );
};
```

#### 3.4 HTML Preview Modal (src/components/admin/HtmlPreviewModal.tsx)

**New component** for previewing HTML:

```typescript
interface HtmlPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  html: string;
  brandingConfig: BrandingConfig;
}

const HtmlPreviewModal: React.FC<HtmlPreviewModalProps> = ({
  isOpen,
  onClose,
  html,
  brandingConfig
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  useEffect(() => {
    if (iframeRef.current && html) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        const styledHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                :root {
                  --primary-color: ${brandingConfig.primaryColor || '#000000'};
                  --secondary-color: ${brandingConfig.secondaryColor || '#666666'};
                }
                body {
                  margin: 0;
                  padding: 20px;
                  font-family: system-ui, -apple-system, sans-serif;
                }
              </style>
            </head>
            <body>${html}</body>
          </html>
        `;
        doc.open();
        doc.write(styledHtml);
        doc.close();
      }
    }
  }, [html, brandingConfig]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Preview da Página HOME</DialogTitle>
        </DialogHeader>
        <div className="border rounded-lg overflow-hidden">
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin"
            className="w-full h-[60vh]"
            title="HTML Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### 3.5 Update BrandingSettings Component

**Integrate** the new editor into existing BrandingSettings:

```typescript
const BrandingSettings: React.FC = () => {
  // ... existing state
  const [customHomeHtml, setCustomHomeHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  
  // ... existing logic
  
  const handleResetHtml = () => {
    if (confirm('Resetar HTML para o template padrão?')) {
      setCustomHomeHtml(DEFAULT_HOME_HTML);
    }
  };
  
  return (
    <Card>
      {/* ... existing branding fields */}
      
      <Separator />
      
      <CustomHomeHtmlEditor
        value={customHomeHtml}
        onChange={setCustomHomeHtml}
        onPreview={() => setShowPreview(true)}
        onReset={handleResetHtml}
      />
      
      <HtmlPreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        html={customHomeHtml}
        brandingConfig={config}
      />
    </Card>
  );
};
```

#### 3.6 User HOME Page Renderer (src/components/user/UserOverview.tsx)

**Update** to render custom HTML:

```typescript
const UserOverview: React.FC = () => {
  const { config } = useBranding();
  const [customHtml, setCustomHtml] = useState<string | null>(null);
  
  useEffect(() => {
    if (config.customHomeHtml) {
      setCustomHtml(config.customHomeHtml);
    }
  }, [config]);
  
  if (customHtml) {
    return (
      <div 
        className="custom-home-content"
        dangerouslySetInnerHTML={{ __html: customHtml }}
        style={{
          '--primary-color': config.primaryColor || '#000000',
          '--secondary-color': config.secondaryColor || '#666666'
        } as React.CSSProperties}
      />
    );
  }
  
  // Fallback to default HOME content
  return <DefaultHomeContent />;
};
```

## Data Models

### BrandingConfig Model

```typescript
interface BrandingConfig {
  id: number | null;
  appName: string;              // 1-50 characters
  logoUrl: string | null;       // Valid URL or null
  primaryColor: string | null;  // #RRGGBB format or null
  secondaryColor: string | null;// #RRGGBB format or null
  customHomeHtml: string | null;// HTML string (max 100KB) or null
  createdAt: string | null;     // ISO timestamp
  updatedAt: string | null;     // ISO timestamp
}
```

### Default HTML Template

```html
<div class="home-container">
  <header class="home-header">
    <h1 style="color: var(--primary-color)">Bem-vindo ao Sistema</h1>
    <p style="color: var(--secondary-color)">
      Gerencie suas operações de forma eficiente
    </p>
  </header>
  
  <section class="home-features">
    <div class="feature-card">
      <h3>Gestão de Dados</h3>
      <p>Acesse e gerencie seus dados de forma centralizada</p>
    </div>
    <div class="feature-card">
      <h3>Integrações</h3>
      <p>Conecte-se com sistemas externos facilmente</p>
    </div>
    <div class="feature-card">
      <h3>Relatórios</h3>
      <p>Visualize métricas e relatórios em tempo real</p>
    </div>
  </section>
</div>
```

## Error Handling

### Backend Error Scenarios

1. **Invalid HTML Format**
   - Status: 400
   - Message: "HTML customizado inválido"
   - Action: Return validation errors

2. **Dangerous Content Detected**
   - Status: 400
   - Message: "HTML contém elementos perigosos"
   - Action: List dangerous patterns found

3. **HTML Too Large**
   - Status: 400
   - Message: "HTML excede tamanho máximo de 100KB"
   - Action: Reject with size limit info

4. **Database Error**
   - Status: 500
   - Message: "Erro ao salvar configuração"
   - Action: Log error, return generic message

### Frontend Error Handling

1. **Validation Errors**
   - Display inline error messages
   - Highlight problematic fields
   - Prevent form submission

2. **Network Errors**
   - Show toast notification
   - Retry mechanism
   - Preserve user input

3. **Preview Errors**
   - Display error in preview modal
   - Allow user to fix and retry
   - Don't block saving

## Testing Strategy

### Unit Tests

1. **Backend**
   - `htmlSanitizer.test.js` - Test sanitization logic
   - `database.test.js` - Test CRUD operations for custom HTML
   - `brandingRoutes.test.js` - Test API endpoints

2. **Frontend**
   - `CustomHomeHtmlEditor.test.tsx` - Test editor component
   - `HtmlPreviewModal.test.tsx` - Test preview functionality
   - `branding.test.ts` - Test service validation

### Integration Tests

1. **End-to-End Flow**
   - Admin creates custom HTML
   - HTML is sanitized and saved
   - User sees custom HTML on HOME page

2. **Security Tests**
   - Attempt XSS injection
   - Test script tag filtering
   - Verify event handler removal

3. **Performance Tests**
   - Large HTML content (near 100KB limit)
   - Multiple rapid saves
   - Concurrent user access

### Manual Testing Checklist

- [ ] Create custom HTML with valid content
- [ ] Preview HTML before saving
- [ ] Save and verify persistence
- [ ] Reset to default template
- [ ] Test with dangerous content (should be blocked)
- [ ] Verify branding variables work in custom HTML
- [ ] Test on different screen sizes
- [ ] Verify user sees updated content immediately

## Security Considerations

1. **HTML Sanitization**
   - Use DOMPurify library
   - Whitelist safe tags only
   - Remove all event handlers
   - Block script/iframe tags

2. **Content Security Policy**
   - Render in sandboxed iframe for preview
   - Use `sandbox="allow-same-origin"` attribute
   - Prevent inline scripts execution

3. **Size Limits**
   - Maximum 100KB per HTML content
   - Prevent DoS through large payloads

4. **Admin-Only Access**
   - Require admin token for updates
   - Validate permissions on every request

## Performance Optimization

1. **Caching**
   - Cache branding config in frontend (5 minutes)
   - Use localStorage for offline access
   - Invalidate cache on updates

2. **Lazy Loading**
   - Load custom HTML only when needed
   - Defer non-critical content
   - Use code splitting for editor

3. **Database Optimization**
   - Index on `updated_at` column
   - Limit query to single row
   - Use prepared statements

## Migration Plan

1. **Database Migration**
   - Add `custom_home_html` column
   - Set default value to NULL
   - No data migration needed (new feature)

2. **Backward Compatibility**
   - If `custom_home_html` is NULL, show default content
   - Existing branding settings remain unchanged
   - No breaking changes to API

3. **Rollout Strategy**
   - Deploy backend changes first
   - Test with admin users
   - Deploy frontend changes
   - Monitor for errors

## Documentation Requirements

1. **Admin Guide**
   - How to access HTML editor
   - Available CSS variables
   - HTML best practices
   - Security guidelines

2. **Developer Guide**
   - API documentation
   - Component usage
   - Customization examples
   - Troubleshooting

3. **User Guide**
   - What users will see
   - How content updates
   - Support contact info
