# Design Document - Editor Simples de HTML para Página Inicial

## Overview

Design simplificado para um editor de HTML onde o administrador cola código HTML completo (gerado externamente) e esse HTML é exibido na rota raiz (`/`). Sem sanitização restritiva, sem validações complexas, sem dois campos - apenas um campo de texto simples.

### Filosofia

- **Confiança no Admin**: O admin sabe o que está fazendo e confia no código que está colando
- **Simplicidade**: Um único campo de texto, sem complicações
- **Flexibilidade Total**: Permitir qualquer HTML, incluindo `<script>`, `<style>`, documento completo
- **Sem Processamento**: Salvar e servir o HTML exatamente como foi fornecido

## Architecture

### Fluxo Simplificado

```
[Admin] → [Campo HTML] → [Salvar] → [Database: custom_home_html]
                                            ↓
[Visitante] → [GET /] → [Busca HTML] → [Retorna HTML ou SPA React]
```

### Componentes

1. **Frontend**: Um único campo `<textarea>` para colar HTML
2. **Backend**: Salvar HTML sem sanitização restritiva
3. **Rota `/`**: Servir HTML se existir, senão servir SPA React

## Components and Interfaces

### 1. Frontend - BrandingSettings.tsx

**Simplificação Necessária**:
- Remover campo "Landing Page Completa" (duplicado e confuso)
- Manter apenas um campo: "HTML da Página Inicial"
- Remover validações restritivas
- Permitir qualquer HTML

**Interface**:
```typescript
interface BrandingConfigUpdate {
  appName?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  customHomeHtml?: string | null; // ← Único campo HTML
}
```

### 2. Backend - brandingRoutes.js

**Simplificação Necessária**:
- Remover sanitização restritiva
- Permitir qualquer HTML (incluindo `<script>`, `<style>`, `<html>`, etc.)
- Apenas validar que não é muito grande (limite razoável: 1MB)

**Fluxo Simplificado**:
```javascript
1. Receber req.body.customHomeHtml
2. Verificar tamanho (< 1MB)
3. Salvar no banco SEM modificações
4. Retornar configuração atualizada
```

### 3. Database - database.js

**Status**: ✅ Já existe, apenas usar

**Schema**:
```sql
CREATE TABLE IF NOT EXISTS branding_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_name VARCHAR(50) NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  custom_home_html TEXT,  -- ← Armazena HTML completo
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### 4. Server - index.js (Rota Raiz)

**Implementação Simples**:

```javascript
app.get('/', async (req, res, next) => {
  try {
    // 1. Buscar HTML customizado do banco
    const brandingConfig = await db.getBrandingConfig();
    
    // 2. Se existe, retornar exatamente como foi salvo
    if (brandingConfig.customHomeHtml && brandingConfig.customHomeHtml.trim() !== '') {
      logger.info('✅ Servindo HTML customizado');
      res.setHeader('Content-Type', 'text/html');
      return res.send(brandingConfig.customHomeHtml);
    }
    
    // 3. Senão, servir SPA React
    next();
  } catch (error) {
    logger.error('❌ Erro ao buscar HTML customizado:', error);
    next(); // Fallback para SPA React
  }
});
```

**Sem complicações**:
- Sem aplicar variáveis CSS (o admin coloca tudo no HTML)
- Sem sanitização (o admin confia no código)
- Sem processamento (retorna exatamente o que foi salvo)

## Data Model

```typescript
interface BrandingConfig {
  id: number | null;
  appName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  customHomeHtml: string | null;  // ← HTML completo da página inicial
  createdAt: string | null;
  updatedAt: string | null;
}
```

## Error Handling

### Erros Simples

1. **Tamanho muito grande**: Rejeitar se > 1MB
2. **Erro ao salvar**: Retornar erro 500
3. **Erro ao buscar**: Fallback para SPA React

```javascript
// Backend - validação simples
if (customHomeHtml && customHomeHtml.length > 1024 * 1024) {
  return res.status(400).json({
    success: false,
    error: 'HTML muito grande (máximo 1MB)'
  });
}

// Rota raiz - fallback simples
try {
  const config = await db.getBrandingConfig();
  if (config.customHomeHtml) {
    return res.send(config.customHomeHtml);
  }
  next(); // SPA React
} catch (error) {
  logger.error('Erro:', error);
  next(); // SPA React
}
```

## Testing Strategy

### Teste Manual Simples

1. **Salvar HTML**:
   - Login como admin
   - Ir em Branding Settings
   - Colar HTML no campo
   - Salvar
   - Verificar mensagem de sucesso

2. **Verificar Exibição**:
   - Logout
   - Acessar `/`
   - Verificar que HTML é exibido

3. **Limpar HTML**:
   - Login como admin
   - Limpar campo
   - Salvar
   - Logout
   - Acessar `/`
   - Verificar que SPA React é exibido

## Design Decisions

### 1. Sem Sanitização Restritiva
**Decisão**: Permitir qualquer HTML, incluindo `<script>`, `<style>`, etc.
**Motivo**: O admin confia no código que está colando (gerado externamente)

### 2. Um Único Campo
**Decisão**: Remover campo duplicado "Landing Page Completa"
**Motivo**: Confunde o usuário, um campo é suficiente

### 3. Sem Processamento
**Decisão**: Salvar e servir HTML exatamente como fornecido
**Motivo**: Simplicidade, o admin já incluiu tudo no HTML

### 4. Limite de 1MB
**Decisão**: Rejeitar HTML > 1MB
**Motivo**: Razoável para qualquer landing page, previne abuso

### 5. Fallback para SPA React
**Decisão**: Se HTML não existe ou erro, servir SPA React
**Motivo**: Sistema sempre funciona, compatibilidade com comportamento atual
