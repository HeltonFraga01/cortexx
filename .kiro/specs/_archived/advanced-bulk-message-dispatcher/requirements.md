# Requirements Document

## Introduction

Este documento especifica os requisitos para o sistema avançado de disparo em massa de mensagens do WUZAPI Manager. O sistema permitirá importar contatos de múltiplas fontes, agendar disparos, e implementar técnicas de humanização para evitar detecção como automação, incluindo delays variáveis e randomização entre envios.

## Glossary

- **Bulk Dispatcher System**: Sistema de disparo em massa de mensagens WhatsApp
- **Contact Source**: Origem dos contatos (agenda importada, CSV, lista manual)
- **Humanization Engine**: Motor de randomização e delays para simular comportamento humano
- **Dispatch Queue**: Fila de mensagens aguardando envio
- **Delay Range**: Intervalo de tempo configurável entre envios (ex: 10-20 segundos)
- **WUZAPI Instance**: Instância conectada do WhatsApp Business API
- **Message Template**: Modelo de mensagem com suporte a variáveis

## Requirements

### Requirement 1

**User Story:** Como usuário, eu quero importar contatos da agenda conectada ao WUZAPI, para que eu possa enviar mensagens em massa para meus contatos existentes

#### Acceptance Criteria

1. WHEN o usuário acessa a funcionalidade de disparo em massa, THE Bulk Dispatcher System SHALL exibir opção para importar contatos da agenda
2. WHEN o usuário seleciona importar da agenda, THE Bulk Dispatcher System SHALL buscar todos os contatos da instância WUZAPI conectada
3. THE Bulk Dispatcher System SHALL exibir lista de contatos importados com nome e número de telefone
4. THE Bulk Dispatcher System SHALL permitir seleção individual ou em massa dos contatos importados
5. WHEN a importação falhar, THE Bulk Dispatcher System SHALL exibir mensagem de erro descritiva

### Requirement 2

**User Story:** Como usuário, eu quero fazer upload de arquivo CSV com lista de contatos, para que eu possa disparar mensagens para contatos externos à minha agenda

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL aceitar upload de arquivos no formato CSV
2. THE Bulk Dispatcher System SHALL validar estrutura do CSV com colunas obrigatórias (telefone) e opcionais (nome, variáveis customizadas)
3. WHEN o CSV contém erros de formato, THE Bulk Dispatcher System SHALL exibir lista de linhas com erro e descrição do problema
4. THE Bulk Dispatcher System SHALL processar arquivos CSV com até 10000 contatos
5. WHEN o upload for bem-sucedido, THE Bulk Dispatcher System SHALL exibir preview dos contatos importados

### Requirement 3

**User Story:** Como usuário, eu quero inserir números de telefone manualmente separados por vírgula, para que eu possa fazer disparos rápidos sem precisar criar arquivo

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL fornecer campo de texto para entrada manual de números
2. THE Bulk Dispatcher System SHALL aceitar números separados por vírgula, ponto-e-vírgula ou quebra de linha
3. THE Bulk Dispatcher System SHALL validar formato de cada número de telefone inserido
4. WHEN números inválidos forem detectados, THE Bulk Dispatcher System SHALL destacar os números com erro
5. THE Bulk Dispatcher System SHALL permitir entrada de até 500 números manualmente

### Requirement 4

**User Story:** Como usuário, eu quero agendar disparos de mensagens para data e hora específicas, para que eu possa planejar campanhas com antecedência

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL fornecer seletor de data e hora para agendamento
2. THE Bulk Dispatcher System SHALL validar que data/hora agendada está no futuro
3. THE Bulk Dispatcher System SHALL armazenar disparos agendados no banco de dados SQLite
4. THE Bulk Dispatcher System SHALL executar disparos agendados automaticamente no horário configurado
5. THE Bulk Dispatcher System SHALL permitir cancelamento de disparos agendados antes da execução

### Requirement 5

**User Story:** Como usuário, eu quero configurar delay variável entre envios, para que os disparos pareçam mais naturais e humanos

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL fornecer campos para configurar delay mínimo e máximo em segundos
2. THE Bulk Dispatcher System SHALL validar que delay mínimo é menor que delay máximo
3. THE Bulk Dispatcher System SHALL aceitar valores de delay entre 5 e 300 segundos
4. WHEN um disparo em massa é executado, THE Humanization Engine SHALL calcular delay aleatório dentro do intervalo configurado para cada envio
5. THE Bulk Dispatcher System SHALL exibir tempo estimado total do disparo baseado nos delays configurados

### Requirement 6

**User Story:** Como usuário, eu quero que o sistema randomize a ordem de envio dos contatos, para que o padrão de disparo seja menos previsível

#### Acceptance Criteria

1. THE Humanization Engine SHALL embaralhar ordem dos contatos antes de iniciar disparo em massa
2. THE Bulk Dispatcher System SHALL fornecer opção para desabilitar randomização se desejado
3. WHEN randomização está ativa, THE Humanization Engine SHALL aplicar algoritmo de embaralhamento Fisher-Yates
4. THE Bulk Dispatcher System SHALL preservar mapeamento entre contato e variáveis personalizadas após randomização
5. THE Bulk Dispatcher System SHALL exibir indicador visual quando randomização está ativa

### Requirement 7

**User Story:** Como usuário, eu quero pausar e retomar disparos em massa em andamento, para que eu possa controlar o processo se necessário

#### Acceptance Criteria

1. WHILE um disparo está em execução, THE Bulk Dispatcher System SHALL exibir botão de pausa
2. WHEN o usuário pausa um disparo, THE Dispatch Queue SHALL interromper processamento após mensagem atual
3. THE Bulk Dispatcher System SHALL armazenar estado da fila pausada no banco de dados
4. THE Bulk Dispatcher System SHALL fornecer botão para retomar disparo pausado
5. WHEN disparo é retomado, THE Dispatch Queue SHALL continuar do ponto onde parou

### Requirement 8

**User Story:** Como usuário, eu quero visualizar progresso em tempo real do disparo em massa, para que eu possa acompanhar quantas mensagens foram enviadas

#### Acceptance Criteria

1. WHILE disparo está em execução, THE Bulk Dispatcher System SHALL exibir barra de progresso atualizada em tempo real
2. THE Bulk Dispatcher System SHALL exibir contador de mensagens enviadas, pendentes e com erro
3. THE Bulk Dispatcher System SHALL exibir tempo decorrido e tempo estimado restante
4. THE Bulk Dispatcher System SHALL exibir último contato processado
5. WHEN um envio falha, THE Bulk Dispatcher System SHALL registrar erro e continuar com próximo contato

### Requirement 9

**User Story:** Como usuário, eu quero usar templates de mensagem com variáveis personalizadas, para que eu possa personalizar cada mensagem enviada

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL permitir uso de variáveis no formato {{variavel}} no texto da mensagem
2. THE Bulk Dispatcher System SHALL substituir variáveis por valores específicos de cada contato
3. THE Bulk Dispatcher System SHALL suportar variáveis padrão (nome, telefone) e customizadas do CSV
4. WHEN uma variável não tem valor para um contato, THE Bulk Dispatcher System SHALL substituir por string vazia
5. THE Bulk Dispatcher System SHALL exibir preview da mensagem com variáveis substituídas antes do envio

### Requirement 10

**User Story:** Como usuário, eu quero enviar imagens junto com mensagens em disparo em massa, para que eu possa criar campanhas mais ricas

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL permitir upload de imagem para anexar às mensagens
2. THE Bulk Dispatcher System SHALL aceitar formatos JPG, PNG e WebP com tamanho máximo de 5MB
3. THE Bulk Dispatcher System SHALL enviar mesma imagem para todos os contatos do disparo
4. THE Bulk Dispatcher System SHALL permitir adicionar legenda à imagem com suporte a variáveis
5. WHEN imagem não puder ser enviada, THE Bulk Dispatcher System SHALL registrar erro e tentar enviar apenas texto

### Requirement 11

**User Story:** Como usuário, eu quero visualizar histórico de disparos realizados, para que eu possa auditar e analisar campanhas anteriores

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL armazenar registro de cada disparo em massa no banco de dados
2. THE Bulk Dispatcher System SHALL exibir lista de disparos com data, quantidade de mensagens e status
3. THE Bulk Dispatcher System SHALL permitir visualizar detalhes de cada disparo (contatos, mensagem, configurações)
4. THE Bulk Dispatcher System SHALL exibir estatísticas de sucesso e falha para cada disparo
5. THE Bulk Dispatcher System SHALL permitir filtrar histórico por data e status

### Requirement 12

**User Story:** Como usuário, eu quero que o sistema valide se a instância WUZAPI está conectada antes de iniciar disparo, para que eu não perca tempo configurando disparo com instância offline

#### Acceptance Criteria

1. WHEN usuário acessa funcionalidade de disparo em massa, THE Bulk Dispatcher System SHALL verificar status da instância WUZAPI
2. IF instância está desconectada, THEN THE Bulk Dispatcher System SHALL exibir alerta e bloquear início do disparo
3. THE Bulk Dispatcher System SHALL exibir indicador visual do status da conexão
4. THE Bulk Dispatcher System SHALL verificar conexão novamente antes de iniciar cada disparo agendado
5. IF conexão cair durante disparo, THEN THE Bulk Dispatcher System SHALL pausar automaticamente e notificar usuário

### Requirement 13

**User Story:** Como usuário, eu quero gerar relatórios detalhados de campanhas de disparo, para que eu possa analisar performance, identificar erros e tomar decisões baseadas em dados

#### Acceptance Criteria

1. THE Bulk Dispatcher System SHALL gerar relatório completo ao final de cada campanha de disparo
2. THE Bulk Dispatcher System SHALL incluir no relatório: total de mensagens, enviadas com sucesso, falhas, taxa de sucesso percentual, tempo total de execução
3. THE Bulk Dispatcher System SHALL listar todos os erros ocorridos com número do contato, tipo de erro e timestamp
4. THE Bulk Dispatcher System SHALL categorizar erros por tipo (número inválido, instância desconectada, timeout, erro de API)
5. THE Bulk Dispatcher System SHALL permitir exportar relatório em formato CSV
6. THE Bulk Dispatcher System SHALL exibir gráfico visual de status da campanha (sucesso vs falhas)
7. THE Bulk Dispatcher System SHALL armazenar relatórios no banco de dados para consulta posterior
8. THE Bulk Dispatcher System SHALL permitir comparar múltiplas campanhas lado a lado
