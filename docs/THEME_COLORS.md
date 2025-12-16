# Cores de Tema Dinâmicas

Este documento explica como usar e personalizar as cores de tema no WUZAPI Manager.

## Visão Geral

O sistema de cores de tema permite personalizar as cores principais da aplicação para modo claro (light) e escuro (dark), mantendo acessibilidade e consistência visual.

## Como Funciona

### Estrutura de Cores

O sistema utiliza duas cores principais:

- **Cor do Tema Dark** (`primaryColor`): Cor usada no modo escuro
- **Cor do Tema Light** (`secondaryColor`): Cor usada no modo claro

Essas cores são aplicadas automaticamente aos seguintes elementos:
- Botões primários
- Links e acentos
- Elementos da sidebar
- Indicadores de foco (ring)
- Badges e tags

### Conversão Automática

As cores são convertidas automaticamente de formato hexadecimal (#RRGGBB) para HSL (Hue, Saturation, Lightness), que é o formato usado pelas CSS variables do Tailwind CSS.

**Exemplo:**
```
#3B82F6 → 210 100% 50%
#10B981 → 160 84% 39%
```

### Cálculo de Contraste

O sistema calcula automaticamente a cor de texto (foreground) baseada na luminosidade da cor de fundo:

- **Luminosidade > 50%**: Usa texto escuro (#1C1917)
- **Luminosidade ≤ 50%**: Usa texto claro (#FAFAF9)

## Configuração via Interface

### Passo 1: Acessar Configurações

1. Faça login como administrador
2. Navegue para **Configurações** no menu lateral
3. Role até a seção **Cores do Tema**

### Passo 2: Escolher Cores

1. **Cor do Tema Dark**: Clique no seletor de cor ou digite o código hex
2. **Cor do Tema Light**: Clique no seletor de cor ou digite o código hex

### Passo 3: Visualizar Preview

1. Clique em **Mostrar Preview** para ver as cores aplicadas em tempo real
2. Alterne entre modo claro e escuro para testar ambas as cores
3. Verifique a validação de contraste WCAG AA

### Passo 4: Salvar

1. Clique em **Salvar** para persistir as alterações
2. As cores serão aplicadas automaticamente em toda a aplicação

## Validação de Acessibilidade

### Padrão WCAG AA

O sistema valida automaticamente o contraste entre cores usando o padrão WCAG AA:

- **Mínimo requerido**: 4.5:1
- **Recomendado (AAA)**: 7:1

### Indicadores Visuais

- ✅ **Verde**: Contraste adequado (≥ 4.5:1)
- ⚠️ **Amarelo**: Contraste insuficiente (< 4.5:1)

### Sugestões Automáticas

Quando o contraste é insuficiente, o sistema sugere ajustes:
- "Considere usar uma cor mais escura para melhor contraste"
- "Considere usar uma cor mais clara para melhor contraste"

## Exemplos de Combinações

### Combinações Recomendadas

#### Azul e Verde (Padrão)
```
Dark:  #3B82F6 (Azul)
Light: #10B981 (Verde)
Contraste: ✅ Excelente
```

#### Roxo e Rosa
```
Dark:  #8B5CF6 (Roxo)
Light: #EC4899 (Rosa)
Contraste: ✅ Bom
```

#### Laranja e Amarelo
```
Dark:  #F97316 (Laranja)
Light: #EAB308 (Amarelo)
Contraste: ⚠️ Atenção - Ajustar luminosidade
```

#### Vermelho e Azul
```
Dark:  #EF4444 (Vermelho)
Light: #3B82F6 (Azul)
Contraste: ✅ Excelente
```

### Paletas por Setor

#### Tecnologia
```
Dark:  #0EA5E9 (Cyan)
Light: #06B6D4 (Teal)
```

#### Saúde
```
Dark:  #10B981 (Verde)
Light: #14B8A6 (Teal)
```

#### Finanças
```
Dark:  #3B82F6 (Azul)
Light: #6366F1 (Indigo)
```

#### E-commerce
```
Dark:  #F59E0B (Âmbar)
Light: #EF4444 (Vermelho)
```

## Uso Programático

### Aplicar Cores via Código

```typescript
import { useBrandingActions } from '@/hooks/useBranding';

const { previewThemeColors, applyThemeColors } = useBrandingActions();

// Preview temporário (não persiste)
previewThemeColors('#3B82F6', '#10B981');

// Aplicar permanentemente (requer salvar via updateConfig)
await updateConfig({
  primaryColor: '#3B82F6',
  secondaryColor: '#10B981'
});
```

### Resetar para Padrão

```typescript
import { useBrandingActions } from '@/hooks/useBranding';

const { resetThemeColors } = useBrandingActions();

// Remove cores customizadas
resetThemeColors();
```

### Verificar Contraste

```typescript
import { 
  calculateContrastRatio, 
  validateContrast 
} from '@/services/themeColorManager';

const ratio = calculateContrastRatio('#3B82F6', '#FFFFFF');
// Retorna: 8.59

const validation = validateContrast(ratio);
// Retorna: { isValid: true, level: 'AAA', ratio: 8.59 }
```

## CSS Variables Utilizadas

As cores de tema modificam as seguintes CSS variables:

```css
/* Modo Light */
--primary: [secondaryColor em HSL]
--primary-foreground: [calculado automaticamente]
--accent: [secondaryColor em HSL]
--sidebar-primary: [secondaryColor em HSL]
--ring: [secondaryColor em HSL]

/* Modo Dark */
--primary: [primaryColor em HSL]
--primary-foreground: [calculado automaticamente]
--accent: [primaryColor em HSL]
--sidebar-primary: [primaryColor em HSL]
--ring: [primaryColor em HSL]
```

## Persistência

### Banco de Dados

As cores são armazenadas na tabela `branding_config`:

```sql
CREATE TABLE branding_config (
  id INTEGER PRIMARY KEY,
  primary_color TEXT,      -- Cor do tema dark (#RRGGBB)
  secondary_color TEXT,    -- Cor do tema light (#RRGGBB)
  -- outros campos...
);
```

### Cache Local

As cores são cacheadas no localStorage para melhor performance:

```javascript
localStorage.setItem('wuzapi_branding_config', JSON.stringify({
  config: {
    primaryColor: '#3B82F6',
    secondaryColor: '#10B981'
  },
  timestamp: Date.now()
}));
```

## Fallback e Valores Padrão

Se uma cor não estiver definida, o sistema usa valores padrão:

```typescript
const defaultPrimary = '#3B82F6';   // Azul
const defaultSecondary = '#10B981'; // Verde
```

Isso garante que a aplicação sempre tenha cores válidas, mesmo sem configuração.

## Troubleshooting

### Cores não estão sendo aplicadas

1. Verifique se ambas as cores estão salvas no banco
2. Limpe o cache do navegador (Ctrl+Shift+R)
3. Verifique o console para erros de validação
4. Confirme que o formato é #RRGGBB (6 dígitos hexadecimais)

### Contraste insuficiente

1. Use o preview para testar diferentes combinações
2. Ajuste a luminosidade da cor (mais clara ou mais escura)
3. Consulte as combinações recomendadas acima
4. Use ferramentas online como [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Preview não funciona

1. Verifique se o formato das cores é válido
2. Certifique-se de que está logado como administrador
3. Recarregue a página se necessário

## Referências

- [WCAG 2.1 Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [Tailwind CSS Colors](https://tailwindcss.com/docs/customizing-colors)
- [HSL Color Model](https://en.wikipedia.org/wiki/HSL_and_HSV)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

## Suporte

Para dúvidas ou problemas com cores de tema, consulte:
- Documentação técnica em `/docs`
- Issues no repositório
- Suporte via email
