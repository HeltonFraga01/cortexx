# Requirements Document

## Introduction

Este documento especifica os requisitos para uma revisão abrangente do sistema de disparador de mensagens do WUZAPI Manager. O sistema atual permite envio de mensagens únicas e em massa via WhatsApp, com funcionalidades de agendamento, humanização e gerenciamento de campanhas. A análise identificou problemas de segurança, falhas potenciais, e oportunidades de melhoria.

## Glossary

- **Disparador**: Sistema de envio de mensagens do WUZAPI Manager
- **Campanha**: Conjunto de mensagens a serem enviadas para múltiplos contatos
- **QueueManager**: Serviço que gerencia a fila de envio de mensagens em massa
- **CampaignScheduler**: Serviço que verifica e inicia campanhas agendadas
- **HumanizationEngine**: Serviço que aplica delays variáveis para evitar detecção como automação
- **WUZAPI**: API externa do WhatsApp Business utilizada para envio de mensagens
- **PhoneValidationService**: Serviço que valida números de telefone usando a API WUZAPI `/chat/checkphone` para verificar se o número existe no WhatsApp antes do envio
- **wuzapiClient**: Cliente HTTP (`server/utils/wuzapiClient.js`) que encapsula todas as chamadas à API WUZAPI, incluindo verificação de números
- **Sending Window**: Janela de horário permitida para envio de mensagens
- **Rate Limiting**: Limitação de taxa de requisições para evitar bloqueios

---

## Análise de Problemas Identificados

### Categoria 1: Problemas de Segurança

#### 1.1 Exposição de Token no Frontend
**Severidade: ALTA**

O componente `DisparadorWrapper.tsx` permite que usuários insiram tokens customizados diretamente no frontend, o que pode:
- Permitir uso de tokens de terceiros sem autorização
- Expor tokens em logs do console (linha 23-27)
- Não há validação se o token pertence ao usuário autenticado

#### 1.2 Falta de Rate Limiting nas Rotas de Campanha
**Severidade: MÉDIA**

As rotas em `bulkCampaignRoutes.js` não implementam rate limiting, permitindo:
- Criação massiva de campanhas
- Ataques de negação de serviço
- Sobrecarga do sistema

#### 1.3 Validação Insuficiente de Entrada
**Severidade: MÉDIA**

O validador `bulkCampaignValidator.js` não valida:
- Conteúdo de mensagens para scripts maliciosos
- URLs de mídia para domínios permitidos
- Variáveis de template para injeção

### Categoria 2: Falhas de Implementação

#### 2.1 Memory Leak no CampaignScheduler
**Severidade: ALTA**

O `CampaignScheduler` mantém filas ativas em memória (`activeQueues Map`) que:
- Não são limpas adequadamente após conclusão
- Podem crescer indefinidamente em caso de erros
- Não persistem entre reinicializações do servidor

#### 2.2 Falta de Tratamento de Erros no Frontend
**Severidade: MÉDIA**

O hook `useSingleMessageSender.ts` tem tratamento genérico de erros:
- Não diferencia tipos de erro (rede, validação, API)
- Não oferece opções de retry ao usuário
- Logs apenas no console sem persistência

#### 2.3 Race Condition no Agendamento
**Severidade: MÉDIA**

O `CampaignScheduler.checkScheduledCampaigns()` pode processar a mesma campanha múltiplas vezes se:
- O intervalo de verificação (1 min) for menor que o tempo de inicialização
- Múltiplas instâncias do servidor estiverem rodando

#### 2.4 Inconsistência de Estado
**Severidade: MÉDIA**

O `QueueManager` pode ficar em estado inconsistente quando:
- O servidor reinicia durante processamento
- A conexão WUZAPI é perdida durante envio
- O banco de dados fica indisponível

### Categoria 3: Problemas de UX/Usabilidade

#### 3.1 Feedback Insuficiente de Progresso
**Severidade: BAIXA**

O componente `CampaignProgressMonitor` não mostra:
- Tempo estimado de conclusão em formato legível
- Histórico de erros em tempo real
- Velocidade média de envio

#### 3.2 Validação de Telefone Confusa
**Severidade: BAIXA**

A validação de telefone no `DisparadorUnico.tsx`:
- Não mostra feedback visual durante validação
- Mensagens de erro não são claras para o usuário
- Não sugere correções automáticas

### Categoria 4: Problemas de Performance

#### 4.1 Consultas N+1 no Banco de Dados
**Severidade: MÉDIA**

O `QueueManager.loadContacts()` e `updateContactStatus()`:
- Fazem queries individuais para cada contato
- Não usam batch updates
- Podem causar lentidão com muitos contatos

#### 4.2 Cache Ineficiente de Validação
**Severidade: BAIXA**

O `PhoneValidationService` tem cache com TTL fixo de 24h:
- Não considera invalidação por mudanças
- Não tem limite de tamanho
- Pode consumir memória excessiva

---

## Requirements

### Requirement 1: Segurança de Tokens

**User Story:** Como administrador do sistema, quero garantir que tokens de usuário sejam usados de forma segura, para que não haja uso indevido de credenciais.

#### Acceptance Criteria

1. WHEN um usuário tenta usar um token customizado, THE Sistema SHALL validar se o token pertence ao usuário autenticado ou se o usuário tem permissão de admin
2. THE Sistema SHALL remover logs de debug que expõem tokens no console do navegador
3. WHEN um token inválido é fornecido, THE Sistema SHALL retornar erro genérico sem expor detalhes do token
4. THE Sistema SHALL implementar rate limiting de 10 requisições por minuto nas rotas de criação de campanha

### Requirement 2: Resiliência do CampaignScheduler

**User Story:** Como desenvolvedor, quero que o sistema de agendamento seja resiliente a falhas, para que campanhas não sejam perdidas ou duplicadas.

#### Acceptance Criteria

1. WHEN o servidor reinicia, THE CampaignScheduler SHALL restaurar campanhas em execução do banco de dados
2. THE Sistema SHALL implementar lock distribuído para evitar processamento duplicado de campanhas
3. WHEN uma campanha falha, THE Sistema SHALL registrar o erro e permitir retry manual
4. THE Sistema SHALL limpar filas ativas da memória após conclusão ou cancelamento

### Requirement 3: Tratamento de Erros Robusto

**User Story:** Como usuário, quero receber feedback claro sobre erros de envio, para que eu possa tomar ações corretivas.

#### Acceptance Criteria

1. WHEN ocorre erro de rede, THE Sistema SHALL exibir mensagem específica e oferecer opção de retry
2. WHEN ocorre erro de validação, THE Sistema SHALL destacar o campo com problema e sugerir correção
3. WHEN a conexão WUZAPI é perdida, THE Sistema SHALL pausar automaticamente a campanha e notificar o usuário
4. THE Sistema SHALL persistir logs de erro no banco de dados para análise posterior

### Requirement 4: Consistência de Estado

**User Story:** Como usuário, quero que o estado das campanhas seja sempre consistente, para que eu possa confiar nos dados exibidos.

#### Acceptance Criteria

1. WHEN o servidor reinicia durante processamento, THE Sistema SHALL marcar a campanha como pausada e permitir retomada
2. THE Sistema SHALL usar transações de banco de dados para atualizações de estado
3. WHEN há inconsistência detectada, THE Sistema SHALL logar o problema e tentar auto-correção
4. THE Sistema SHALL sincronizar estado entre memória e banco de dados a cada 30 segundos

### Requirement 5: Performance de Banco de Dados

**User Story:** Como desenvolvedor, quero que as operações de banco de dados sejam eficientes, para que o sistema suporte campanhas com muitos contatos.

#### Acceptance Criteria

1. THE Sistema SHALL usar batch updates para atualizar status de múltiplos contatos
2. THE Sistema SHALL implementar índices apropriados nas tabelas de campanhas e contatos
3. WHEN há mais de 1000 contatos, THE Sistema SHALL processar em lotes de 100
4. THE Sistema SHALL limitar o cache de validação de telefone a 10.000 entradas

### Requirement 6: Feedback de Progresso Melhorado

**User Story:** Como usuário, quero ver informações detalhadas sobre o progresso das campanhas, para que eu possa acompanhar o envio em tempo real.

#### Acceptance Criteria

1. THE Sistema SHALL exibir tempo estimado de conclusão em formato legível (ex: "2h 30min restantes")
2. THE Sistema SHALL mostrar velocidade média de envio (mensagens/minuto)
3. THE Sistema SHALL exibir últimos 5 erros em tempo real no monitor de progresso
4. THE Sistema SHALL atualizar progresso a cada 5 segundos durante execução

### Requirement 7: Validação de Telefone Aprimorada

**User Story:** Como usuário, quero que a validação de telefone seja clara e útil, para que eu possa corrigir números inválidos facilmente.

#### Acceptance Criteria

1. WHEN o usuário digita um número, THE Sistema SHALL mostrar indicador visual de validação em tempo real
2. WHEN o formato está incorreto, THE Sistema SHALL sugerir o formato correto automaticamente
3. THE Sistema SHALL aceitar múltiplos formatos de entrada (com/sem código país, com/sem formatação)
4. WHEN a validação WUZAPI falha, THE Sistema SHALL informar se o número não existe no WhatsApp

### Requirement 8: Auditoria e Logging

**User Story:** Como administrador, quero ter logs detalhados das operações do disparador, para que eu possa auditar e debugar problemas.

#### Acceptance Criteria

1. THE Sistema SHALL registrar todas as operações de campanha (criar, pausar, retomar, cancelar) com timestamp e usuário
2. THE Sistema SHALL manter histórico de erros por campanha no banco de dados
3. THE Sistema SHALL implementar rotação de logs com retenção de 30 dias
4. WHEN uma campanha é excluída, THE Sistema SHALL manter registro de auditoria por 90 dias

