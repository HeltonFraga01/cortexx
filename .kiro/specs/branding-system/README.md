# Sistema de Branding - Spec Consolidada

## Visão Geral

Esta spec consolida todas as funcionalidades relacionadas ao sistema de branding do WUZAPI Manager. O sistema permite personalização completa da identidade visual da aplicação, incluindo nome, logo, cores e página inicial customizada.

## Status

✅ **Implementado e Funcional**

Todas as funcionalidades descritas nesta spec foram implementadas e testadas nas seguintes specs arquivadas:

1. `white-label-branding` - Sistema base de white label
2. `dynamic-app-name-branding` - Nome dinâmico da aplicação
3. `dynamic-theme-colors` - Cores de tema dinâmicas
4. `custom-home-page-editor` - Editor de página inicial
5. `fix-custom-home-page-editor` - Correções e melhorias

## Funcionalidades Implementadas

### 1. Configuração de Identidade
- ✅ Nome customizado da aplicação
- ✅ Logo customizado (upload e URL)
- ✅ Aplicação automática em toda interface
- ✅ Fallback para valores padrão

### 2. Sistema de Cores
- ✅ Cor primária (tema dark)
- ✅ Cor secundária (tema light)
- ✅ Cálculo automático de contraste
- ✅ Validação WCAG AA
- ✅ Preview em tempo real
- ✅ Aplicação sem reload

### 3. Editor de Página Inicial
- ✅ Editor de HTML completo
- ✅ Suporte a scripts e estilos
- ✅ Preview antes de salvar
- ✅ Validação de tamanho (1MB)
- ✅ Renderização na rota raiz

### 4. Meta Tags e SEO
- ✅ Open Graph tags
- ✅ Twitter Card tags
- ✅ Document title dinâmico
- ✅ Sincronização automática

### 5. API e Persistência
- ✅ Endpoints REST completos
- ✅ Autenticação admin
- ✅ Persistência em Supabase (PostgreSQL)
- ✅ Cache e performance
- ✅ Validação de dados

## Arquitetura

### Backend
```
server/
├── routes/brandingRoutes.js      # Endpoints de API
├── database.js                    # Queries de branding
└── utils/htmlSanitizer.js        # Sanitização de HTML
```

### Frontend
```
src/
├── contexts/BrandingContext.tsx           # Estado global
├── services/
│   ├── branding.ts                        # Cliente API
│   └── themeColorManager.ts               # Gerenciamento de cores
├── components/admin/
│   ├── BrandingSettings.tsx               # Interface de configuração
│   ├── CustomHomeHtmlEditor.tsx           # Editor de HTML
│   ├── HtmlPreviewModal.tsx               # Preview de HTML
│   └── ThemeColorPreview.tsx              # Preview de cores
└── types/branding.ts                      # Tipos TypeScript
```

### Banco de Dados
```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY,
  app_name TEXT,
  logo_url TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  custom_home_html TEXT,
  updated_at DATETIME
);
```

## Como Usar

### Para Administradores

1. **Acessar Configurações:**
   - Login como admin
   - Navegar para "Configurações" → "Branding"

2. **Configurar Identidade:**
   - Definir nome da aplicação
   - Upload de logo ou URL
   - Salvar alterações

3. **Configurar Cores:**
   - Escolher cor primária (tema dark)
   - Escolher cor secundária (tema light)
   - Visualizar preview
   - Salvar alterações

4. **Customizar Página Inicial:**
   - Colar HTML completo no editor
   - Usar preview para visualizar
   - Salvar HTML customizado

### Para Desenvolvedores

#### Usar Branding em Componentes
```typescript
import { useBrandingConfig } from '@/contexts/BrandingContext';

function MyComponent() {
  const brandingConfig = useBrandingConfig();
  
  return (
    <div>
      <h1>{brandingConfig.appName} Manager</h1>
      <img src={brandingConfig.logoUrl} alt="Logo" />
    </div>
  );
}
```

#### Acessar API de Branding
```typescript
import { brandingService } from '@/services/branding';

// Buscar configurações
const config = await brandingService.getBrandingConfig();

// Atualizar configurações
await brandingService.updateBrandingConfig({
  appName: 'Minha Empresa',
  primaryColor: '#3b82f6',
  secondaryColor: '#10b981'
});
```

## Variáveis CSS Disponíveis

O sistema aplica as seguintes variáveis CSS automaticamente:

```css
:root {
  --primary: [cor primária em HSL];
  --primary-foreground: [cor de contraste calculada];
  --secondary: [cor secundária em HSL];
  --secondary-foreground: [cor de contraste calculada];
}
```

## Validações

### Nome da Aplicação
- Máximo: 50 caracteres
- Mínimo: 1 caractere
- Caracteres permitidos: letras, números, espaços

### Logo
- Formatos: PNG, JPG, JPEG, SVG
- Tamanho máximo: 2MB
- URL ou upload direto

### Cores
- Formato: Hexadecimal (#RRGGBB)
- Validação de contraste WCAG AA
- Cálculo automático de foreground

### HTML Customizado
- Tamanho máximo: 1MB
- Todos os tags permitidos (incluindo script/style)
- Validação de tamanho apenas

## Troubleshooting

### Branding não aparece
1. Verificar se configurações foram salvas
2. Limpar cache do navegador
3. Verificar console para erros
4. Verificar se BrandingProvider está no App.tsx

### Cores não aplicam
1. Verificar formato hexadecimal
2. Verificar contraste WCAG
3. Limpar cache e recarregar
4. Verificar console para erros

### HTML customizado não renderiza
1. Verificar tamanho (máximo 1MB)
2. Verificar se foi salvo corretamente
3. Acessar rota raiz "/" diretamente
4. Verificar logs do servidor

## Próximos Passos

Esta spec está completa e funcional. Para trabalhos futuros relacionados a branding:

1. Criar nova spec específica para a funcionalidade
2. Referenciar esta spec consolidada
3. Seguir padrões estabelecidos aqui
4. Atualizar este README se necessário

## Referências

- Specs arquivadas: `.kiro/specs/_archived/`
- Documentação técnica: `tech.md`, `structure.md`, `product.md`
- Código fonte: Ver seção "Arquitetura" acima
