# Validação do Custom HTML Rendering

## Status da Implementação

✅ **Tarefas Concluídas:**
1. ✅ Modificar CustomHtmlRenderer para usar srcdoc
2. ✅ Criar componente CustomHtmlErrorBoundary
3. ✅ Criar componente CustomHtmlLoadingIndicator
4. ✅ Implementar debugging e logging
5. ✅ Adicionar error handling e fallbacks
6. ✅ Integrar componentes no PublicHome

## Instruções de Validação Manual

### Pré-requisitos
1. Servidor rodando: `npm run dev:full`
2. Arquivo `homeCompativel.html` disponível no diretório raiz

### Passo 1: Configurar HTML Personalizado no Branding

1. Fazer login como admin no sistema
2. Navegar para as configurações de branding
3. Copiar o conteúdo do arquivo `homeCompativel.html`
4. Colar no campo `custom_home_html` da configuração de branding
5. Salvar as configurações

**Endpoint da API:**
```bash
PUT /api/branding
Content-Type: application/json

{
  "customHomeHtml": "<conteúdo do homeCompativel.html>"
}
```

### Passo 2: Validar Carregamento da Página

1. Fazer logout ou abrir uma janela anônima
2. Acessar `http://localhost:5173/`
3. Verificar que o HTML personalizado é carregado

**Checklist de Validação:**

#### ✅ Carregamento Inicial
- [ ] Loading indicator aparece durante o carregamento
- [ ] Tempo de carregamento é exibido no loading indicator
- [ ] Página carrega em menos de 10 segundos

#### ✅ Recursos Externos (CDN)
- [ ] Tailwind CSS é carregado e aplicado corretamente
- [ ] Ícones Lucide são renderizados
- [ ] Biblioteca TAOS (animações) funciona
- [ ] Google Fonts (Inter) é aplicada

#### ✅ Estilos e Layout
- [ ] Gradientes e cores personalizadas são aplicados
- [ ] Efeitos de hover funcionam (botões, cards)
- [ ] Animações neon e glow funcionam
- [ ] Layout responsivo adapta a diferentes tamanhos de tela

#### ✅ Funcionalidades Interativas
- [ ] Menu mobile abre e fecha corretamente
- [ ] Navegação por âncoras funciona (scroll suave)
- [ ] Botões têm efeitos visuais corretos
- [ ] Modais abrem e fecham (se houver)
- [ ] Formulários funcionam (se houver)

#### ✅ Animações TAOS
- [ ] Elementos animam ao entrar no viewport
- [ ] Animações são suaves e não travadas
- [ ] Scroll-triggered animations funcionam

#### ✅ Console Logs (DevTools)
Abrir o console do navegador e verificar:
- [ ] `[CustomHtmlRenderer] Iniciando carregamento...`
- [ ] `[CustomHtmlRenderer] Tamanho do HTML: X bytes`
- [ ] `[CustomHtmlRenderer] 📦 Recursos detectados:`
- [ ] `[CustomHtmlRenderer] ✅ Script carregado: ...`
- [ ] `[CustomHtmlRenderer] ✅ Stylesheet carregado: ...`
- [ ] `[CustomHtmlRenderer] ✅ HTML carregado com sucesso em Xms`
- [ ] `[CustomHtmlRenderer] 📊 Recursos carregados: X`
- [ ] `[CustomHtmlRenderer] 🎉 Todos os recursos foram processados`

### Passo 3: Testar Error Handling

#### Teste 1: Timeout
1. Modificar o HTML para incluir um recurso que não existe:
   ```html
   <script src="https://example.com/nonexistent-script.js"></script>
   ```
2. Recarregar a página
3. Verificar:
   - [ ] Timeout é detectado após 10 segundos
   - [ ] Mensagem de erro é exibida
   - [ ] Botão "Recarregar" está presente
   - [ ] Botão "Ir para Login" está presente
   - [ ] Estatísticas de recursos são exibidas

#### Teste 2: Erro Crítico
1. Modificar o HTML para incluir JavaScript inválido:
   ```html
   <script>
     throw new Error('Erro de teste');
   </script>
   ```
2. Recarregar a página
3. Verificar:
   - [ ] Erro é capturado e logado no console
   - [ ] Página continua funcionando (não trava)
   - [ ] ErrorBoundary captura erros de renderização React

#### Teste 3: Fallback para Login
1. Clicar no botão "Ir para Login" quando houver erro
2. Verificar:
   - [ ] Página de login padrão é exibida
   - [ ] Não há erros no console
   - [ ] É possível fazer login normalmente

#### Teste 4: Reload
1. Quando houver erro, clicar no botão "Recarregar"
2. Verificar:
   - [ ] Loading indicator aparece novamente
   - [ ] Página tenta carregar o HTML novamente
   - [ ] Logs de reload aparecem no console

### Passo 4: Validar Performance

1. Abrir DevTools > Network
2. Recarregar a página
3. Verificar:
   - [ ] Tempo total de carregamento < 3 segundos (ideal)
   - [ ] Todos os recursos CDN são carregados com sucesso
   - [ ] Não há recursos bloqueando o carregamento

### Passo 5: Validar Acessibilidade

1. Verificar no HTML do iframe:
   - [ ] `title="Custom Home Page"` está presente
   - [ ] `aria-label="Página inicial personalizada"` está presente
2. Testar navegação por teclado:
   - [ ] Tab navega pelos elementos interativos
   - [ ] Enter ativa botões e links
   - [ ] Esc fecha modais (se houver)

## Recursos Esperados no homeCompativel.html

### Scripts Externos
- ✅ Tailwind CSS CDN: `https://cdn.tailwindcss.com`
- ✅ Lucide Icons: `https://unpkg.com/lucide-icons`
- ✅ TAOS CSS: `https://unpkg.com/taos@1.0.5/dist/taos.css`
- ✅ TAOS JS: `https://unpkg.com/taos@1.0.5/dist/taos.js`

### Fontes
- ✅ Google Fonts (Inter): `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap`

### Funcionalidades JavaScript
- ✅ Configuração do Tailwind
- ✅ Inicialização do Lucide
- ✅ Inicialização do TAOS
- ✅ Event listeners para menu mobile
- ✅ Animações canvas (se houver)

## Troubleshooting

### Problema: Página não carrega
**Solução:**
1. Verificar se o HTML está salvo corretamente no branding
2. Verificar console para erros
3. Verificar se o servidor está rodando
4. Limpar cache do navegador

### Problema: Estilos não são aplicados
**Solução:**
1. Verificar se Tailwind CSS CDN está carregando
2. Verificar console para erros de CORS
3. Verificar se sandbox permissions estão corretas

### Problema: Ícones não aparecem
**Solução:**
1. Verificar se Lucide Icons está carregando
2. Verificar se `lucide.createIcons()` é chamado após o DOM carregar
3. Verificar console para erros

### Problema: Animações não funcionam
**Solução:**
1. Verificar se TAOS está carregando
2. Verificar se classes TAOS estão nos elementos
3. Verificar se `TAOS.init()` é chamado

## Logs Esperados

### Sucesso
```
[CustomHtmlRenderer] Iniciando carregamento de HTML personalizado...
[CustomHtmlRenderer] Tamanho do HTML: 45678 bytes
[CustomHtmlRenderer] 📦 Recursos detectados:
  - Scripts externos: 3
  - Stylesheets: 2
  - Imagens: 5
[CustomHtmlRenderer] 📜 Carregando script: https://cdn.tailwindcss.com
[CustomHtmlRenderer] ✅ Script carregado: https://cdn.tailwindcss.com
[CustomHtmlRenderer] 🎨 Carregando stylesheet: https://unpkg.com/taos@1.0.5/dist/taos.css
[CustomHtmlRenderer] ✅ Stylesheet carregado: https://unpkg.com/taos@1.0.5/dist/taos.css
[CustomHtmlRenderer] ✅ HTML carregado com sucesso em 1234ms
[CustomHtmlRenderer] 📊 Recursos carregados: 10
[CustomHtmlRenderer] ❌ Recursos falhados: 0
[CustomHtmlRenderer] 🎉 Todos os recursos foram processados
```

### Timeout
```
[CustomHtmlRenderer] Timeout: HTML demorou mais de 10 segundos para carregar
[CustomHtmlRenderer] Tempo decorrido: 10000 ms
[CustomHtmlRenderer] Recursos carregados: 5
[CustomHtmlRenderer] Recursos falhados: 2
```

### Erro
```
[CustomHtmlRenderer] ❌ Erro ao carregar HTML: Error message
[CustomHtmlRenderer] Stack trace: ...
[CustomHtmlRenderer] Tempo até erro: 1234 ms
[CustomHtmlRenderer] Recursos carregados antes do erro: 3
```

## Conclusão

Após completar todos os passos de validação, a implementação do Custom HTML Rendering está funcionando corretamente se:

1. ✅ HTML personalizado carrega sem erros
2. ✅ Todos os recursos externos (CDN) são carregados
3. ✅ Estilos e animações funcionam corretamente
4. ✅ Funcionalidades interativas funcionam
5. ✅ Error handling funciona (timeout, erros, fallback)
6. ✅ Logs detalhados aparecem no console
7. ✅ Performance está dentro do esperado (< 3s)
8. ✅ Acessibilidade está implementada

**Data de Validação:** _____________________
**Validado por:** _____________________
**Status:** ⬜ Aprovado  ⬜ Reprovado  ⬜ Necessita ajustes
