# Guia de Navegação de Bancos de Dados

## Visão Geral

Este guia explica como acessar e editar seus dados pessoais através da navegação dinâmica na sidebar. O sistema permite acesso direto aos seus registros sem necessidade de múltiplos cliques.

## Índice

1. [Acessando Suas Conexões](#acessando-suas-conexões)
2. [Editando Seus Registros](#editando-seus-registros)
3. [Salvando Alterações](#salvando-alterações)
4. [Troubleshooting](#troubleshooting)
5. [Perguntas Frequentes](#perguntas-frequentes)

---

## Acessando Suas Conexões

### Como Visualizar Suas Conexões

Após fazer login no sistema, você verá automaticamente na sidebar (barra lateral esquerda) todas as conexões de banco de dados que foram atribuídas a você pelo administrador.

**Localização na Sidebar:**
```
📊 Dashboard
💬 Mensagens
🗄️ [Suas Conexões de Banco]  ← Aparecem aqui dinamicamente
⚙️ Configurações
```

### Características das Conexões

- **Ícone de Banco de Dados**: Cada conexão aparece com um ícone 🗄️ (Database)
- **Nome Personalizado**: O nome exibido é configurado pelo administrador (ex: "Teste Final", "MasterMegga")
- **Ordenação Alfabética**: As conexões são listadas em ordem alfabética
- **Atualização Automática**: Novas conexões aparecem após login ou refresh da página

### Exemplo Visual

```
┌─────────────────────────┐
│  📊 Dashboard           │
│  💬 Mensagens           │
│  🗄️ Teste Final        │  ← Conexão 1
│  🗄️ MasterMegga        │  ← Conexão 2
│  ⚙️ Configurações       │
└─────────────────────────┘
```

### Navegação Rápida

1. **Clique Único**: Basta clicar no nome da conexão
2. **Carregamento Automático**: O sistema busca seus dados automaticamente
3. **Acesso Direto**: Você é levado diretamente ao formulário de edição

---

## Editando Seus Registros

### Fluxo de Edição

Quando você clica em uma conexão na sidebar:

1. **Indicador de Carregamento**: Um spinner aparece ao lado da conexão clicada
2. **Busca Automática**: O sistema busca seu registro vinculado ao seu token
3. **Formulário Pré-preenchido**: A página de edição abre com seus dados já carregados

### Página de Edição

A página de edição contém:

#### Cabeçalho
```
Editar Registro - [Nome da Conexão]
─────────────────────────────────────
Tipo: NocoDB | Tabela: my7kpxstrt02976 | Vínculo: apiToken
```

#### Formulário Dinâmico

O formulário exibe campos baseados na configuração do administrador:

- **Campos Visíveis**: Apenas os campos configurados como visíveis aparecem
- **Campos Editáveis**: Campos editáveis têm fundo branco e podem ser modificados
- **Campos Somente Leitura**: Campos não editáveis têm fundo cinza e não podem ser alterados
- **Labels Personalizados**: Os nomes dos campos podem ser customizados pelo admin

### Exemplo de Formulário

```
┌──────────────────────────────────────────┐
│  Nome da Empresa                         │
│  ┌────────────────────────────────────┐  │
│  │ Minha Empresa                      │  │ ← Editável
│  └────────────────────────────────────┘  │
│                                          │
│  Website                                 │
│  ┌────────────────────────────────────┐  │
│  │ https://minhaempresa.com           │  │ ← Editável
│  └────────────────────────────────────┘  │
│                                          │
│  Token da API                            │
│  ┌────────────────────────────────────┐  │
│  │ 01K7MXQ1...                        │  │ ← Somente Leitura
│  └────────────────────────────────────┘  │
│                                          │
│  [Salvar Alterações]                     │
└──────────────────────────────────────────┘
```

### Tipos de Campos Suportados

O sistema suporta diversos tipos de campos com componentes especializados que se adaptam automaticamente ao tipo de dado:

#### Campos de Texto

| Tipo | Descrição | Validação | Exemplo | Componente |
|------|-----------|-----------|---------|------------|
| **Texto Simples** | Texto de linha única | Nenhuma | Nome, Título | Input padrão |
| **Texto Longo** | Texto multi-linha | Nenhuma | Descrição, Observações | Textarea |
| **Email** | Endereço de email | Formato de email válido | usuario@exemplo.com | EmailInput com validação inline |
| **Telefone** | Número de telefone | Formato brasileiro | (11) 98765-4321 | PhoneInput com máscara |
| **URL** | Endereço web | URL válida com protocolo | https://exemplo.com | UrlInput com auto-complete de protocolo |

#### Campos Numéricos

| Tipo | Descrição | Formato | Exemplo | Componente |
|------|-----------|---------|---------|------------|
| **Número Inteiro** | Números sem decimais | 0, 1, 2, 3... | 42 | NumberInput (inteiro) |
| **Decimal** | Números com decimais | 0.00 | 3.14 | NumberInput (decimal) |
| **Moeda** | Valores monetários | R$ 0,00 | R$ 1.234,56 | NumberInput (currency) |
| **Porcentagem** | Valores percentuais | 0% | 75% | NumberInput (percent) |
| **Ano** | Ano específico | YYYY | 2025 | NumberInput (year) |
| **Avaliação** | Nota de 0 a 5 | Estrelas | ★★★★☆ | RatingInput |

**Características do NumberInput:**
- Aceita vírgula ou ponto como separador decimal
- Formata automaticamente conforme o tipo (moeda, porcentagem)
- Valida valores mínimos e máximos
- Suporta incremento/decremento com botões

#### Campos de Data e Hora

| Tipo | Descrição | Formato | Exemplo | Componente |
|------|-----------|---------|---------|------------|
| **Data** | Data sem hora | DD/MM/YYYY | 15/11/2025 | DatePicker com calendário |
| **Data e Hora** | Data com hora | DD/MM/YYYY HH:mm | 15/11/2025 14:30 | DateTimePicker (calendário + hora) |
| **Hora** | Apenas hora | HH:mm | 14:30 | TimePicker com seleção de hora/minuto |
| **Duração** | Intervalo de tempo | HH:MM:SS | 01:30:00 | DurationInput |

**Características dos Componentes de Data:**
- **Calendário Inline**: Abre diretamente na página, sem popup
- **Navegação Rápida**: Botões para mês anterior/próximo
- **Seleção de Ano**: Dropdown para anos de 1900 a 2100
- **Formato Brasileiro**: DD/MM/YYYY (dia/mês/ano)
- **Validação Automática**: Impede datas inválidas
- **Teclado**: Suporta digitação direta no formato correto

#### Campos de Seleção

| Tipo | Descrição | Comportamento | Exemplo | Componente |
|------|-----------|---------------|---------|------------|
| **Seleção Única** | Escolha uma opção | Dropdown com busca | Status: Ativo | Select |
| **Seleção Múltipla** | Escolha várias opções | Multi-select com checkboxes | Tags: Cliente, VIP | MultiSelectInput |
| **Checkbox** | Verdadeiro/Falso | Toggle on/off | Ativo: ✓ | Checkbox |

**Características do MultiSelectInput:**
- **Dropdown com Checkboxes**: Clique para abrir lista de opções
- **Seleção Múltipla**: Marque/desmarque várias opções
- **Badges Visuais**: Opções selecionadas aparecem como badges coloridos
- **Busca Integrada**: Digite para filtrar opções
- **Contador**: Mostra quantas opções estão selecionadas
- **Limpar Tudo**: Botão para desmarcar todas as opções

**Exemplo Visual do MultiSelectInput:**
```
Tags
┌────────────────────────────────────┐
│ [Cliente] [VIP] [Premium]  ▼      │ ← Badges das opções selecionadas
└────────────────────────────────────┘
     ↓ Clique para abrir
┌────────────────────────────────────┐
│ 🔍 Buscar...                       │
│ ☑ Cliente                          │
│ ☑ VIP                              │
│ ☑ Premium                          │
│ ☐ Básico                           │
│ ☐ Corporativo                      │
│                                    │
│ [Limpar Tudo]  3 selecionados      │
└────────────────────────────────────┘
```

#### Campos Especiais

| Tipo | Descrição | Comportamento |
|------|-----------|---------------|
| **JSON** | Dados estruturados | Editor de código |
| **Anexo** | Arquivos | Upload (em desenvolvimento) |
| **Usuário** | Referência a usuário | Seleção (em desenvolvimento) |

### Componentes Especializados

O sistema utiliza componentes especializados que se adaptam automaticamente ao tipo de campo, proporcionando a melhor experiência de edição para cada tipo de dado.

#### Detecção Automática de Tipo

Quando você abre um formulário de edição, o sistema:

1. **Busca Metadados**: Consulta o NocoDB para obter informações sobre cada campo
2. **Identifica o Tipo**: Determina o tipo de campo (texto, número, data, seleção, etc.)
3. **Renderiza Componente**: Exibe o componente apropriado automaticamente
4. **Aplica Validação**: Configura regras de validação específicas do tipo

**Exemplo de Detecção:**
```
Campo: "dataVencimento"
Tipo NocoDB: "Date"
→ Sistema renderiza: DatePicker com calendário
→ Validação: Data válida no formato DD/MM/YYYY
```

#### Componentes Inline

Todos os campos de seleção (Data, Hora, Multi-Select) usam **componentes inline** que abrem diretamente na página, sem popups ou modais separados. Isso proporciona uma experiência mais fluida e intuitiva.

#### Fallback para Conexões Antigas

Para conexões que não são do tipo NocoDB ou que não possuem metadados disponíveis:
- **Fallback Automático**: Sistema usa campos de texto simples
- **Funcionalidade Mantida**: Você ainda pode editar e salvar dados
- **Sem Erros**: O formulário continua funcionando normalmente

**Mensagem de Fallback:**
```
ℹ️ Usando campos de texto simples. Metadados de campo não disponíveis.
```

---

## Salvando Alterações

### Como Salvar

1. **Edite os Campos**: Modifique os valores desejados nos campos editáveis
2. **Clique em "Salvar Alterações"**: Botão localizado no final do formulário
3. **Aguarde Confirmação**: Um indicador de loading aparece no botão
4. **Mensagem de Sucesso**: Uma notificação verde confirma que as alterações foram salvas

### Feedback Visual

**Durante o Salvamento:**
```
[⏳ Salvando...]  ← Botão desabilitado com spinner
```

**Após Sucesso:**
```
✅ Alterações salvas com sucesso!
```

**Em Caso de Erro:**
```
❌ Erro ao salvar alterações
```

### Validação de Campos

O sistema valida automaticamente cada tipo de campo:

#### Validações por Tipo

**Campos de Texto:**
- **Obrigatórios**: Não podem ficar vazios se marcados como required
- **Email**: Deve conter @ e domínio válido (ex: usuario@exemplo.com)
- **Telefone**: Formato brasileiro (11) 98765-4321 ou 11987654321
- **URL**: Deve começar com http:// ou https://
- **Tamanho**: Limite de caracteres conforme configuração

**Campos Numéricos:**
- **Inteiros**: Apenas números sem decimais
- **Decimais**: Aceita ponto ou vírgula como separador
- **Moeda**: Formato monetário brasileiro (R$ 1.234,56)
- **Porcentagem**: Valores entre 0 e 100
- **Ano**: Entre 1900 e 2100

**Campos de Data:**
- **Data**: Formato válido DD/MM/YYYY
- **Data e Hora**: Data e hora válidas
- **Hora**: Formato 24h (00:00 a 23:59)

**Campos de Seleção:**
- **Seleção Única**: Deve escolher uma opção válida
- **Seleção Múltipla**: Opções devem existir na lista
- **Checkbox**: Apenas true/false

#### Feedback de Validação

Se houver erro de validação:

1. **Borda Vermelha**: O campo fica com borda vermelha
2. **Mensagem de Erro**: Aparece abaixo do campo explicando o problema
3. **Foco Automático**: O primeiro campo com erro recebe foco
4. **Bloqueio de Salvamento**: Botão "Salvar" fica desabilitado até corrigir

**Exemplo de Erro:**
```
Email
┌────────────────────────────────────┐
│ usuario@invalido                   │ ← Borda vermelha
└────────────────────────────────────┘
❌ Email inválido. Use o formato: usuario@exemplo.com
```

---

## Troubleshooting

### Problema: Não Vejo Nenhuma Conexão na Sidebar

**Possíveis Causas:**
- Nenhuma conexão foi atribuída ao seu usuário
- Você não está autenticado corretamente
- Erro ao carregar as conexões

**Soluções:**

1. **Verifique seu Login**
   ```
   - Faça logout e login novamente
   - Confirme que está usando as credenciais corretas
   ```

2. **Contate o Administrador**
   ```
   - Solicite que verifique se há conexões atribuídas ao seu token
   - Peça para confirmar que as conexões estão ativas
   ```

3. **Limpe o Cache do Navegador**
   ```
   - Pressione Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)
   - Ou limpe o cache manualmente nas configurações do navegador
   ```

---

### Problema: Erro "Nenhum Registro Encontrado"

**Mensagem:**
```
❌ Nenhum registro encontrado para sua conta
```

**Possíveis Causas:**
- Seu registro ainda não foi criado no banco de dados
- O campo de vínculo não está configurado corretamente
- Seu token não corresponde a nenhum registro

**Soluções:**

1. **Contate o Administrador**
   ```
   - Informe que você não possui um registro criado
   - Solicite a criação de um registro vinculado ao seu token
   ```

2. **Verifique o Campo de Vínculo**
   ```
   - Pergunte ao admin qual campo vincula seu usuário
   - Confirme que seu token está correto
   ```

---

### Problema: Erro ao Carregar Dados

**Mensagem:**
```
❌ Erro ao carregar seus dados
```

**Possíveis Causas:**
- Problema de conexão com o banco de dados
- Timeout na requisição
- Erro de rede

**Soluções:**

1. **Tente Novamente**
   ```
   - Clique novamente na conexão na sidebar
   - Aguarde alguns segundos antes de tentar
   ```

2. **Verifique sua Conexão de Internet**
   ```
   - Confirme que está conectado à internet
   - Teste acessando outros sites
   ```

3. **Recarregue a Página**
   ```
   - Pressione F5 ou clique no botão de reload do navegador
   - Faça login novamente se necessário
   ```

4. **Contate o Suporte**
   ```
   - Se o erro persistir, informe ao administrador
   - Forneça o nome da conexão que está causando problema
   ```

---

### Problema: Erro ao Salvar Alterações

**Mensagem:**
```
❌ Erro ao salvar alterações
```

**Possíveis Causas:**
- Validação de campo falhou
- Problema de permissão
- Erro de conexão com o banco

**Soluções:**

1. **Verifique os Campos**
   ```
   - Procure por mensagens de erro abaixo dos campos
   - Corrija campos obrigatórios vazios
   - Verifique formatos (email, número, etc.)
   ```

2. **Verifique Permissões**
   ```
   - Confirme que você tem permissão para editar
   - Alguns campos podem ser somente leitura
   ```

3. **Tente Novamente**
   ```
   - Clique em "Salvar Alterações" novamente
   - Se persistir, recarregue a página e tente novamente
   ```

4. **Contate o Administrador**
   ```
   - Informe quais campos você estava tentando editar
   - Forneça detalhes do erro se houver mensagem específica
   ```

---

### Problema: Campos Aparecem Desabilitados

**Sintoma:**
- Campos com fundo cinza
- Não é possível editar

**Causa:**
- Campos configurados como "somente leitura" pelo administrador

**Solução:**
```
Isso é intencional. Alguns campos são protegidos e não podem ser editados
por usuários. Se você precisa alterar um campo desabilitado, contate o
administrador para fazer a alteração ou solicitar permissão de edição.
```

---

### Problema: Página Fica Carregando Indefinidamente

**Sintoma:**
- Spinner não para de girar
- Formulário não aparece

**Possíveis Causas:**
- Timeout na requisição
- Banco de dados não responde
- Erro de configuração

**Soluções:**

1. **Aguarde 30 Segundos**
   ```
   - Algumas conexões podem demorar mais
   - Especialmente em bancos de dados externos
   ```

2. **Recarregue a Página**
   ```
   - Pressione F5
   - Tente acessar a conexão novamente
   ```

3. **Verifique o Console do Navegador**
   ```
   - Pressione F12 para abrir DevTools
   - Vá na aba "Console"
   - Procure por mensagens de erro em vermelho
   - Compartilhe essas mensagens com o administrador
   ```

4. **Teste Outra Conexão**
   ```
   - Se você tem múltiplas conexões, teste outra
   - Isso ajuda a identificar se o problema é específico de uma conexão
   ```

---

### Problema: Alterações Não Aparecem Após Salvar

**Sintoma:**
- Mensagem de sucesso aparece
- Mas ao recarregar, os dados antigos voltam

**Possíveis Causas:**
- Cache do navegador
- Problema de sincronização com o banco
- Erro silencioso no backend

**Soluções:**

1. **Limpe o Cache**
   ```
   - Pressione Ctrl+Shift+R (Windows/Linux)
   - Ou Cmd+Shift+R (Mac)
   ```

2. **Aguarde e Recarregue**
   ```
   - Aguarde 1-2 minutos
   - Recarregue a página
   - Verifique se as alterações aparecem
   ```

3. **Verifique Diretamente no Banco**
   ```
   - Peça ao administrador para verificar se as alterações
     foram salvas no banco de dados
   ```

---

### Problema: Campos Não Mostram Valores Salvos

**Sintoma:**
- Campos de seleção mostram "Selecione opções" mesmo após salvar
- Campos de data mostram "Selecione uma data" mesmo com data salva
- Campos de texto aparecem vazios

**Possíveis Causas:**
- Valores no banco estão realmente vazios (`null`)
- Problema de mapeamento entre nome do campo e dados
- Cache desatualizado

**Soluções:**

1. **Verifique se os Dados Existem**
   ```
   - Abra o console do navegador (F12)
   - Procure por logs "📊 RecordForm: formData state:"
   - Verifique se o campo tem valor ou está null
   ```

2. **Recarregue com Cache Limpo**
   ```
   - Pressione Ctrl+Shift+R (Windows/Linux)
   - Ou Cmd+Shift+R (Mac)
   - Isso força o recarregamento dos metadados
   ```

3. **Verifique o Mapeamento de Campos**
   ```
   - Contate o administrador
   - Confirme que o columnName no Field Mapping corresponde
     ao column_name real no NocoDB
   ```

**Exemplo de Diagnóstico:**

Se você vê no console:
```javascript
formData: {
  "etapaUser": null,  // ← Campo está vazio no banco
  "test": false,      // ← Campo tem valor
  "vencimento": null  // ← Campo está vazio no banco
}
```

Isso significa que os campos realmente estão vazios no banco de dados, não é um problema de exibição.

---

### Problema: Erro ao Carregar Metadados de Campo

**Mensagem:**
```
⚠️ Erro ao carregar metadados de campo. Usando campos de texto simples.
```

**Possíveis Causas:**
- Conexão não é do tipo NocoDB
- Timeout ao buscar metadados
- Erro de rede ou configuração

**Impacto:**
- Formulário usa campos de texto simples como fallback
- Funcionalidade básica mantida (você ainda pode editar)
- Sem componentes especializados (calendário, multi-select, etc.)

**Soluções:**

1. **Verifique o Tipo de Conexão**
   ```
   - Metadados só estão disponíveis para conexões NocoDB
   - Conexões SQLite, PostgreSQL, MySQL usam texto simples
   ```

2. **Recarregue a Página**
   ```
   - Pressione F5 para tentar buscar metadados novamente
   - O sistema faz cache por 10 minutos
   ```

3. **Verifique Conectividade**
   ```
   - Confirme que o servidor NocoDB está acessível
   - Teste acessando o NocoDB diretamente no navegador
   ```

4. **Contate o Administrador**
   ```
   - Informe que os metadados não estão carregando
   - Forneça o nome da conexão afetada
   ```

**Nota:** Este é um comportamento de fallback seguro. Mesmo sem metadados, você pode continuar editando seus dados usando campos de texto.

---

### Problema: Erro "Invalid option" ao Salvar Campo de Seleção

**Mensagem:**
```
❌ Falha na API NocoDB: Request failed with status code 400
Invalid option(s) provided for column
```

**Causa:**
- Problema de sincronização entre IDs e títulos de opções
- Metadados de campo desatualizados

**Solução Automática:**
O sistema agora converte automaticamente IDs de opções para títulos antes de enviar ao NocoDB. Se você ainda encontrar este erro:

1. **Recarregue a Página**
   ```
   - Pressione F5 para limpar o cache de metadados
   - Tente selecionar a opção novamente
   ```

2. **Contate o Administrador**
   ```
   - Informe qual campo está causando o problema
   - Mencione qual opção você tentou selecionar
   ```

**Detalhes Técnicos:**
- Campos SELECT/MULTI_SELECT armazenam valores usando IDs internos
- O NocoDB espera receber os títulos das opções, não os IDs
- O sistema faz a conversão automaticamente antes de salvar

---

## Perguntas Frequentes

### 1. Quantas conexões posso ter?

Não há limite técnico. O número de conexões que você vê depende de quantas o administrador atribuiu ao seu usuário.

### 2. Posso criar novas conexões?

Não. Apenas administradores podem criar e atribuir conexões. Se você precisa de acesso a uma nova conexão, solicite ao administrador.

### 3. Posso criar novos registros?

Atualmente, o sistema permite apenas editar registros existentes. Se você não tem um registro, o administrador precisa criá-lo para você.

### 4. As alterações são salvas automaticamente?

Não. Você precisa clicar no botão "Salvar Alterações" para persistir suas modificações.

### 5. Posso editar registros de outros usuários?

Não. Você só pode ver e editar seu próprio registro, vinculado ao seu token de usuário.

### 6. O que acontece se eu fechar a página sem salvar?

As alterações não salvas serão perdidas. Sempre clique em "Salvar Alterações" antes de sair da página.

### 7. Posso acessar as conexões pelo celular?

Sim! A interface é responsiva e funciona em dispositivos móveis. A sidebar se adapta automaticamente ao tamanho da tela.

### 8. Com que frequência os dados são atualizados?

Os dados são buscados sempre que você clica em uma conexão. O sistema usa cache de 2 minutos para melhorar a performance, mas você sempre pode recarregar para ver dados atualizados.

### 9. Posso renomear uma conexão?

Não. Apenas administradores podem renomear conexões. O nome que você vê é o configurado pelo admin.

### 10. O que significa "Campo de Vínculo"?

É o campo no banco de dados que conecta o registro ao seu usuário (geralmente seu token de API). Isso garante que você só veja seus próprios dados.

### 11. Como funcionam os campos de data e hora?

Os campos de data e hora usam componentes especializados:

**DatePicker (Data):**
- Clique no campo para abrir o calendário
- Use as setas para navegar entre meses
- Clique em um dia para selecionar
- Ou digite diretamente no formato DD/MM/YYYY

**DateTimePicker (Data e Hora):**
- Selecione a data no calendário
- Use os campos de hora e minuto abaixo
- Formato: DD/MM/YYYY HH:mm

**TimePicker (Hora):**
- Selecione hora (0-23)
- Selecione minuto (0-59)
- Formato: HH:mm

### 12. Como funcionam os campos de seleção múltipla?

O MultiSelectInput permite selecionar várias opções:

1. **Clique no campo** para abrir o dropdown
2. **Marque as checkboxes** das opções desejadas
3. **Use a busca** para filtrar opções (se houver muitas)
4. **Veja as badges** das opções selecionadas no campo
5. **Clique em "Limpar Tudo"** para desmarcar todas
6. **Clique fora** ou pressione Esc para fechar

**Dica:** As opções selecionadas aparecem como badges coloridos no campo, facilitando a visualização.

### 13. Os campos numéricos aceitam vírgula ou ponto?

Sim! O NumberInput aceita ambos:
- `1234.56` (ponto decimal)
- `1234,56` (vírgula decimal)

O sistema converte automaticamente para o formato correto antes de salvar.

### 14. Como funciona a validação de email e telefone?

**Email:**
- Deve conter @ e domínio válido
- Exemplo válido: `usuario@exemplo.com`
- Exemplo inválido: `usuario@` ou `usuario.com`

**Telefone:**
- Aceita formato brasileiro com ou sem máscara
- Válido: `(11) 98765-4321` ou `11987654321`
- O sistema formata automaticamente enquanto você digita

### 15. Posso copiar e colar valores nos campos?

Sim! Todos os campos suportam copiar e colar:
- **Ctrl+C / Cmd+C**: Copiar
- **Ctrl+V / Cmd+V**: Colar
- **Ctrl+X / Cmd+X**: Recortar

Para campos especializados (data, número), o sistema tenta interpretar o valor colado e formatá-lo corretamente.

---

## Dicas de Uso

### ✅ Boas Práticas

1. **Salve Frequentemente**
   - Não espere editar todos os campos de uma vez
   - Salve após cada grupo de alterações importantes

2. **Verifique Antes de Salvar**
   - Revise os campos editados
   - Confirme que os valores estão corretos

3. **Use Navegação por Teclado**
   - Tab: Navegar entre campos
   - Enter: Salvar (quando o botão está focado)
   - Esc: Cancelar (em alguns casos)

4. **Mantenha o Navegador Atualizado**
   - Use versões recentes do Chrome, Firefox, Safari ou Edge
   - Isso garante melhor compatibilidade

### ⚠️ Cuidados

1. **Não Compartilhe Tokens**
   - Seu token é pessoal e confidencial
   - Não compartilhe com outros usuários

2. **Atenção com Campos Críticos**
   - Alguns campos afetam integrações externas
   - Tenha cuidado ao editar URLs, tokens de API, etc.

3. **Não Force Recarregamentos Durante Salvamento**
   - Aguarde a confirmação de sucesso
   - Recarregar durante o salvamento pode causar perda de dados

---

## Detalhes Técnicos

### Como Funciona o Sistema de Campos

O sistema usa uma arquitetura de três camadas para gerenciar campos:

#### 1. Metadados do NocoDB (Fonte da Verdade)

Quando você acessa uma conexão NocoDB, o sistema busca automaticamente os metadados das colunas:

```javascript
{
  "id": "sympano1xtdq0aw",
  "title": "Etapa User",
  "column_name": "etapaUser",
  "uidt": "SingleSelect",
  "colOptions": {
    "options": [
      { "id": "abc123", "title": "Iniciante" },
      { "id": "def456", "title": "Cliente" },
      { "id": "ghi789", "title": "Revenda" }
    ]
  }
}
```

**Informações Obtidas:**
- **column_name**: Nome real da coluna no banco (ex: "etapaUser")
- **title**: Título da coluna no NocoDB (ex: "Etapa User")
- **uidt**: Tipo de campo UI (ex: "SingleSelect", "Date", "Number")
- **colOptions**: Opções disponíveis para campos SELECT

#### 2. Field Mappings (Configuração do Admin)

O administrador pode customizar como os campos aparecem:

```javascript
{
  "columnName": "etapaUser",      // Referência ao nome real da coluna
  "label": "Etapa do Cliente",    // Rótulo customizado
  "visible": true,                // Se aparece no formulário
  "editable": true,               // Se pode ser editado
  "helperText": "Selecione a etapa atual do cliente"
}
```

**Customizações Possíveis:**
- **label**: Renomear campo (ex: "etapaUser" → "Etapa do Cliente")
- **visible**: Ocultar campos sensíveis
- **editable**: Proteger campos contra edição
- **helperText**: Adicionar dicas e instruções

#### 3. Merge de Configurações

O sistema mescla os metadados do NocoDB com as configurações do admin:

```
Metadados NocoDB + Field Mappings = Campos Exibidos
─────────────────────────────────────────────────────
column_name: etapaUser          columnName: etapaUser
title: Etapa User        +      label: Etapa do Cliente    =  Label: "Etapa do Cliente"
uidt: SingleSelect              visible: true                  Type: SELECT
options: [...]                  editable: true                 Options: [...]
                                                               Editable: true
```

### Conversão de Valores para NocoDB

#### Problema Comum: IDs vs Títulos

Campos SELECT e MULTI_SELECT armazenam valores de duas formas:

**No Frontend (durante edição):**
```javascript
// Valores armazenados como IDs
{
  "etapaUser": ["sympano1xtdq0aw"]  // ID da opção "Cliente"
}
```

**No NocoDB (ao salvar):**
```javascript
// NocoDB espera títulos, não IDs
{
  "etapaUser": "Cliente"  // Título da opção
}
```

#### Conversão Automática

O sistema faz a conversão automaticamente antes de salvar:

1. **Busca metadados** das colunas do NocoDB
2. **Identifica campos SELECT** através de `colOptions.options`
3. **Converte IDs para títulos**:
   - Array de 1 elemento: `["abc123"]` → `"Cliente"`
   - Array múltiplo: `["abc123", "def456"]` → `"Cliente,Iniciante"`
   - String: `"abc123"` → `"Cliente"`

**Código de Conversão:**
```typescript
// Para cada campo alterado
if (column.colOptions && column.colOptions.options) {
  const options = column.colOptions.options;
  
  if (Array.isArray(currentValue)) {
    // Converter IDs para títulos
    const titles = currentValue
      .map(id => options.find(opt => opt.id === id)?.title)
      .filter(Boolean);
    
    // Single: "Cliente" | Multiple: "Cliente,Revenda"
    transformedValue = titles.length === 1 ? titles[0] : titles.join(',');
  }
}
```

### Cache de Metadados

Para melhorar a performance, o sistema usa cache:

| Tipo de Cache | Duração | Quando Limpar |
|---------------|---------|---------------|
| **Conexões do Usuário** | 5 minutos | Após admin alterar atribuições |
| **Metadados de Campo** | 10 minutos | Após admin alterar estrutura da tabela |
| **Dados de Registro** | 2 minutos | Após salvar alterações |

**Como Forçar Atualização:**
- Recarregue a página (F5 ou Ctrl+R)
- O cache é limpo automaticamente após salvamento

---

## Suporte

### Precisa de Ajuda?

Se você encontrou um problema não listado neste guia:

1. **Verifique a Documentação Técnica**
   - Consulte `docs/TROUBLESHOOTING.md` para problemas técnicos avançados

2. **Contate o Administrador**
   - Forneça detalhes específicos do problema
   - Inclua capturas de tela se possível
   - Mencione qual conexão está causando problema

3. **Reporte Bugs**
   - Se você acredita ter encontrado um bug no sistema
   - Informe ao administrador com passos para reproduzir o problema

---

## Changelog

### Versão 1.3 (Novembro 2025)
- **Novos Componentes Especializados**: Adicionados componentes para tipos específicos de campo
  - NumberInput: Números, moeda, porcentagem, ano
  - DateTimePicker: Data e hora combinados
  - TimePicker: Seleção de hora
  - MultiSelectInput: Seleção múltipla com checkboxes e badges
  - EmailInput: Validação de email inline
  - PhoneInput: Formatação de telefone brasileiro
  - UrlInput: Validação e auto-complete de URL
- **Detecção Automática de Tipo**: Sistema identifica tipo de campo e renderiza componente apropriado
- **Validação Aprimorada**: Validação específica por tipo de campo
- **Fallback Inteligente**: Campos de texto simples para conexões sem metadados
- **Cache de Metadados**: Performance melhorada com cache de 10 minutos
- **Documentação Expandida**: Novos troubleshooting e FAQs sobre componentes especializados

### Versão 1.2 (Novembro 2025)
- Correção de bug de conversão de IDs para títulos em campos SELECT
- Melhorias na documentação técnica sobre conversão de valores
- Adicionado troubleshooting para erro "Invalid option"

### Versão 1.1 (Novembro 2025)
- Melhorias na interface de edição
- Adicionado suporte para mais tipos de campo
- Otimizações de performance

### Versão 1.0 (Novembro 2025)
- Documentação inicial
- Guia de navegação dinâmica na sidebar
- Troubleshooting de problemas comuns
- Perguntas frequentes

---

**Última Atualização:** 11 de Novembro de 2025  
**Versão do Sistema:** 1.3.x  
**Autor:** Equipe WUZAPI Manager
