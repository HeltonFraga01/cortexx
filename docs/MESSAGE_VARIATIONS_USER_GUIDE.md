# Guia de Variações de Mensagem

## Visão Geral

O sistema de **Variações de Mensagem** permite criar mensagens mais naturais e humanizadas, alternando automaticamente entre diferentes versões do mesmo texto. Isso ajuda a evitar detecção como automação e torna suas mensagens mais personalizadas.

## Como Funciona

### Sintaxe Básica

Use o caractere `|` (barra vertical) para separar diferentes variações de texto:

```
Olá|Oi|E aí, tudo bem?
```

Quando você envia esta mensagem, o sistema escolhe **aleatoriamente** uma das opções:
- "Olá, tudo bem?"
- "Oi, tudo bem?"
- "E aí, tudo bem?"

### Múltiplos Blocos de Variação

Você pode ter vários blocos de variação em uma única mensagem:

```
Olá|Oi|E aí {{nome}}, tudo bem?|como vai?

Gostaria de|Queria|Posso te apresentar|mostrar nosso produto.

Podemos conversar?|Você tem um minuto?|Posso te enviar mais detalhes?
```

**Exemplo de resultado:**
```
Oi João, como vai?

Queria te apresentar nosso produto.

Você tem um minuto?
```

## Regras de Sintaxe

### ✅ Permitido

- Mínimo de 2 variações por bloco
- Máximo recomendado de 10 variações por bloco
- Espaços ao redor do `|` são removidos automaticamente
- Compatível com variáveis `{{nome}}`, `{{telefone}}`, etc.
- Pontuação e emojis funcionam normalmente

### ❌ Evite

- Blocos com apenas 1 variação (use texto normal)
- Variações vazias: `Olá||Oi` (o `||` causa erro)
- Mais de 10 variações por bloco (dificulta leitura)

## Usando no Sistema

### 1. Envio Único

1. Acesse **Mensagens** → **Envio Único**
2. Digite sua mensagem com variações
3. Veja o preview em tempo real
4. Clique em **Gerar Preview** para ver exemplos
5. Envie normalmente

### 2. Envio em Massa

1. Acesse **Mensagens** → **Envio em Massa**
2. Importe seus contatos
3. Digite a mensagem com variações
4. O preview mostra como ficará
5. Cada contato receberá uma combinação diferente
6. Inicie a campanha

### 3. Templates

1. Acesse **Mensagens** → **Templates**
2. Crie um template com variações
3. Templates com variações têm um badge ✨ **Variações**
4. Ao usar o template, as variações são preservadas

## Recursos Avançados

### Preview de Variações

O painel de preview mostra:
- Número total de combinações possíveis
- Exemplos de mensagens geradas
- Quais variações foram selecionadas
- Destaque visual das partes variadas

### Estatísticas

Após enviar uma campanha, você pode ver:
- Distribuição de uso de cada variação
- Porcentagem de cada opção enviada
- Gráficos de distribuição
- Exportação de dados (JSON/CSV)

### Validação em Tempo Real

O editor valida automaticamente:
- ✅ Sintaxe correta
- ⚠️ Avisos sobre possíveis melhorias
- ❌ Erros que impedem o envio
- 💡 Sugestões de correção

## Exemplos Práticos

### Exemplo 1: Saudação Variada
```
Olá|Oi|E aí {{nome}}, tudo bem?|como vai?|beleza?
```

### Exemplo 2: Apresentação
```
Eu sou o|Meu nome é|Aqui é o Helton da empresa XYZ.

Gostaria de|Queria|Posso te apresentar|mostrar nosso novo produto.
```

### Exemplo 3: Call to Action
```
Podemos conversar?|Você tem um minuto?|Posso te enviar mais detalhes?|Te interessa saber mais?
```

### Exemplo 4: Agradecimento
```
Obrigado!|Muito obrigado!|Agradeço!|Valeu!
```

## Dicas de Uso

### ✨ Boas Práticas

1. **Mantenha o mesmo tom**: Todas as variações devem ter o mesmo significado
2. **Varie o suficiente**: Use pelo menos 3 opções por bloco
3. **Teste antes**: Use o preview para verificar como fica
4. **Combine com variáveis**: `{{nome}}` funciona perfeitamente com variações
5. **Seja natural**: Escreva como você falaria normalmente

### ⚠️ Evite

1. Variações muito diferentes em significado
2. Muitas variações (mais de 10) - fica confuso
3. Variações muito longas - prefira frases curtas
4. Esquecer de testar - sempre veja o preview

## Combinações Possíveis

O número de combinações cresce multiplicando as opções:

- 1 bloco com 3 variações = **3 combinações**
- 2 blocos com 3 variações cada = **9 combinações** (3 × 3)
- 3 blocos com 3 variações cada = **27 combinações** (3 × 3 × 3)

**Exemplo:**
```
Olá|Oi|E aí (3 opções)
tudo bem?|como vai? (2 opções)
```
Total: **6 combinações possíveis** (3 × 2)

## Solução de Problemas

### Mensagem de Erro: "Bloco precisa de pelo menos 2 variações"

**Problema:** Você usou `|` mas não colocou texto suficiente

**Solução:** Adicione mais uma variação ou remova o `|`
```
❌ Olá| tudo bem?
✅ Olá|Oi tudo bem?
```

### Mensagem de Erro: "Variação vazia detectada"

**Problema:** Você tem `||` (dois pipes seguidos)

**Solução:** Remova o pipe extra ou adicione texto
```
❌ Olá||Oi
✅ Olá|Oi
```

### Preview não aparece

**Problema:** Pode não haver variações válidas

**Solução:** Verifique se:
- Você usou o caractere `|` (barra vertical)
- Cada bloco tem pelo menos 2 opções
- Não há erros de validação

### Botão desabilitado

**Problema:** Há erros de sintaxe

**Solução:** 
- Veja as mensagens de erro em vermelho
- Corrija conforme as sugestões
- O botão será habilitado automaticamente

## Perguntas Frequentes

### Posso usar variações com variáveis?

**Sim!** Funciona perfeitamente:
```
Olá|Oi {{nome}}, tudo bem?|como vai?
```

### As variações funcionam em envio em massa?

**Sim!** Cada contato recebe uma combinação diferente automaticamente.

### Posso ver quais variações foram mais usadas?

**Sim!** Acesse o relatório da campanha e vá na aba "Variações".

### Quantas variações posso ter?

- **Mínimo:** 2 por bloco
- **Máximo recomendado:** 10 por bloco
- **Máximo de blocos:** 20 por mensagem

### As variações são realmente aleatórias?

**Sim!** Usamos seleção criptograficamente segura para garantir distribuição uniforme.

## Suporte

Se tiver dúvidas ou problemas:
1. Verifique este guia
2. Use o preview para testar
3. Veja as mensagens de erro e sugestões
4. Entre em contato com o suporte

---

**Versão:** 1.0  
**Última atualização:** Janeiro 2025
