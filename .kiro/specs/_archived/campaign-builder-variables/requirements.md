# Campaign Builder - Variáveis Padrão

## Problema

No componente CampaignBuilder (disparo em massa), não havia as variáveis padrão disponíveis para inserção rápida, diferente do DisparadorUnico que já tinha essa funcionalidade.

## Solução Implementada

Adicionada seção de "Variáveis Disponíveis" no campo de mensagem do CampaignBuilder, com as mesmas variáveis padrão do DisparadorUnico:

### Variáveis Padrão
- **Nome** - `{{nome}}`
- **Telefone** - `{{telefone}}`
- **Data** - `{{data}}`
- **Empresa** - `{{empresa}}`
- **Saudação** - `{{saudacao}}`

### Organização

1. **Variáveis Padrão**: Sempre visíveis, independente dos contatos importados
2. **Variáveis Customizadas**: Aparecem apenas quando há contatos importados com variáveis customizadas (do CSV)

### Visual

- Ícone Tag para identificar a seção
- Botões outline para cada variável
- Separação clara entre variáveis padrão e customizadas
- Clique no botão insere a variável no campo de mensagem

## Comportamento

- Ao clicar em uma variável, ela é inserida no final do texto da mensagem
- Formato: `{{variavel}}`
- Variáveis são detectadas automaticamente e validadas antes do envio
- Preview mostra como a mensagem ficará com as variáveis substituídas

## Consistência

Agora tanto o DisparadorUnico quanto o CampaignBuilder (disparo em massa) têm a mesma interface para inserção de variáveis, mantendo consistência na UX.

## Arquivos Modificados

- `src/components/disparador/CampaignBuilder.tsx`
  - Adicionada seção de variáveis padrão
  - Reorganizada seção de variáveis customizadas
  - Adicionado ícone Tag
