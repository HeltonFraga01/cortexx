# Guia do Editor de Página Inicial Customizada

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Como Acessar](#como-acessar)
3. [Usando o Editor](#usando-o-editor)
4. [Variáveis CSS Disponíveis](#variáveis-css-disponíveis)
5. [Exemplos de HTML](#exemplos-de-html)
6. [Guidelines de Segurança](#guidelines-de-segurança)
7. [Solução de Problemas](#solução-de-problemas)

---

## Visão Geral

O Editor de Página Inicial Customizada permite que administradores personalizem completamente o conteúdo da página inicial (dashboard) dos usuários usando HTML customizado.

### Características Principais

- ✅ Editor de HTML com validação em tempo real
- ✅ Preview ao vivo antes de salvar
- ✅ Suporte a variáveis CSS do tema
- ✅ Sanitização automática de segurança
- ✅ Template padrão incluído
- ✅ Contador de caracteres (limite: 100KB)

---

## Como Acessar

1. Faça login como **administrador**
2. Navegue para **Configurações** → **Branding**
3. Role até a seção **"HTML Customizado da Página Inicial"**

---

## Usando o Editor

### 1. Editando o HTML

O editor possui uma área de texto onde você pode colar ou digitar seu HTML customizado:

```html
<div style="text-align: center; padding: 2rem;">
  <h1>Bem-vindo!</h1>
  <p>Conteúdo personalizado aqui</p>
</div>
```

### 2. Visualizando o Preview

- Clique no botão **"Preview"** para ver como o HTML será renderizado
- O preview abre em um modal com o tema aplicado
- Você pode abrir o preview em uma nova aba usando o ícone de link externo

### 3. Resetando para o Template Padrão

- Clique no botão **"Reset"** para restaurar o template padrão
- Uma confirmação será solicitada antes de resetar

### 4. Salvando as Alterações

- Clique em **"Salvar"** para aplicar as mudanças
- O HTML será validado e sanitizado automaticamente
- Se houver erros, eles serão exibidos abaixo do editor

---

## Variáveis CSS Disponíveis

Use estas variáveis CSS para manter consistência com o tema da aplicação:

### Cores Principais

```css
var(--primary)      /* Cor primária configurada no branding */
var(--secondary)    /* Cor secundária configurada no branding */
```

### Cores do Tema

```css
var(--background)         /* Cor de fundo principal */
var(--foreground)         /* Cor do texto principal */
var(--muted)             /* Cor de fundo secundária */
var(--muted-foreground)  /* Cor de texto secundário */
var(--border)            /* Cor das bordas */
var(--card)              /* Cor de fundo dos cards */
var(--card-foreground)   /* Cor do texto dos cards */
```

### Outras Variáveis

```css
var(--radius)  /* Raio de borda padrão (0.5rem) */
```

### Exemplo de Uso

```html
<div style="
  background: var(--primary);
  color: white;
  padding: 2rem;
  border-radius: var(--radius);
">
  <h1>Título com cor primária</h1>
</div>
```

---

## Exemplos de HTML

### Exemplo 1: Hero Section Simples

```html
<div style="
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
">
  <section style="
    text-align: center;
    padding: 4rem 2rem;
    background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
    border-radius: 1rem;
    color: white;
  ">
    <h1 style="font-size: 3rem; margin-bottom: 1rem;">
      Bem-vindo ao Sistema
    </h1>
    <p style="font-size: 1.25rem; opacity: 0.9;">
      Gerencie seus dados de forma eficiente
    </p>
  </section>
</div>
```

### Exemplo 2: Grid de Cards

```html
<div style="
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
  padding: 2rem;
">
  <div style="
    padding: 2rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  ">
    <h3 style="color: var(--foreground); margin-bottom: 0.5rem;">
      Feature 1
    </h3>
    <p style="color: var(--muted-foreground);">
      Descrição da funcionalidade
    </p>
  </div>
  
  <div style="
    padding: 2rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  ">
    <h3 style="color: var(--foreground); margin-bottom: 0.5rem;">
      Feature 2
    </h3>
    <p style="color: var(--muted-foreground);">
      Descrição da funcionalidade
    </p>
  </div>
</div>
```

### Exemplo 3: Call to Action

```html
<div style="
  text-align: center;
  padding: 3rem 2rem;
  background: var(--muted);
  border-radius: var(--radius);
  margin: 2rem;
">
  <h2 style="
    font-size: 2rem;
    margin-bottom: 1rem;
    color: var(--foreground);
  ">
    Pronto para começar?
  </h2>
  <a 
    href="/databases" 
    style="
      display: inline-block;
      padding: 0.75rem 2rem;
      background: var(--primary);
      color: white;
      text-decoration: none;
      border-radius: var(--radius);
      font-weight: 600;
    "
  >
    Acessar Bancos de Dados
  </a>
</div>
```

---

## Guidelines de Segurança

### ✅ Permitido

- Tags HTML básicas: `div`, `span`, `h1-h6`, `p`, `a`, `img`, etc.
- Estilos inline com CSS
- Links para páginas internas e externas
- Imagens de URLs públicas
- Variáveis CSS do tema

### ❌ Não Permitido (Automaticamente Removido)

- Tags `<script>` - JavaScript será removido
- Tags `<iframe>` - Iframes não são permitidos
- Event handlers inline (`onclick`, `onload`, etc.)
- Protocolo `javascript:` em links
- Tags `<object>`, `<embed>`, `<applet>`
- Meta tags com `http-equiv`
- CSS `@import` e `expression()`

### 🔒 Sanitização Automática

Todo HTML é automaticamente sanitizado no servidor antes de ser salvo:

1. **Frontend**: Validação inicial detecta padrões perigosos
2. **Backend**: Sanitização completa com DOMPurify
3. **Renderização**: HTML seguro é exibido aos usuários

### 💡 Dicas de Segurança

- Use sempre estilos inline em vez de `<style>` tags
- Prefira variáveis CSS do tema para cores
- Teste o HTML no preview antes de salvar
- Evite copiar HTML de fontes não confiáveis
- Mantenha o HTML simples e focado

---

## Solução de Problemas

### Erro: "HTML excede o tamanho máximo"

**Causa**: O HTML tem mais de 100KB (aproximadamente 100.000 caracteres)

**Solução**:
- Reduza o tamanho do HTML
- Remova espaços e comentários desnecessários
- Use imagens externas em vez de data URIs
- Simplifique a estrutura

### Erro: "HTML contém padrões perigosos"

**Causa**: O HTML contém código potencialmente inseguro

**Solução**:
- Remova tags `<script>`
- Remova event handlers (`onclick`, etc.)
- Use links normais em vez de `javascript:`
- Verifique os warnings para detalhes

### Preview não está mostrando as cores corretas

**Causa**: Variáveis CSS podem não estar definidas

**Solução**:
- Configure as cores primária e secundária no branding
- Use valores de fallback: `background: var(--primary, #3b82f6);`
- Teste em modo claro e escuro

### HTML não está sendo salvo

**Causa**: Erro de validação ou conexão

**Solução**:
1. Verifique os erros exibidos abaixo do editor
2. Corrija os problemas indicados
3. Tente salvar novamente
4. Se persistir, verifique sua conexão de internet

### Conteúdo não aparece na página inicial

**Causa**: HTML pode estar vazio ou com erro

**Solução**:
1. Verifique se o HTML foi salvo corretamente
2. Faça logout e login novamente
3. Limpe o cache do navegador
4. Use o botão "Reset" e tente novamente

---

## Suporte

Para mais ajuda ou reportar problemas:

- Consulte a documentação técnica em `docs/custom-home-page-editor-technical.md`
- Entre em contato com o suporte técnico
- Verifique os logs do servidor para erros detalhados

---

**Última atualização**: 2025-11-07  
**Versão**: 1.0.0
