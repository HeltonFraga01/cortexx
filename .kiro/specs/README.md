# Specs do WUZAPI Manager

## Estrutura de Diretórios

```
.kiro/specs/
├── README.md                    # Este arquivo
├── SPEC_STATUS_REPORT.md        # Relatório detalhado de status
├── _archived/                   # Specs completas (49 specs)
├── _incomplete/                 # Specs incompletas
├── branding-system/             # 📚 Spec consolidada (referência)
├── chat-interface/              # 🔄 Em progresso
├── contact-management-system/   # 🔄 Em progresso
├── manutencao-continua/         # 📚 Spec consolidada (referência)
├── production-cleanup-v2/       # 🔄 Em progresso (ATUAL)
└── scheduling-system-review/    # 🔄 Em progresso
```

## Legenda

- 🔄 **Em Progresso** - Spec ativa com tarefas sendo executadas
- 📚 **Consolidada** - Spec de referência que consolida múltiplas specs relacionadas
- ✅ **Arquivada** - Spec completa, movida para `_archived/`

## Specs Ativas (4)

### 1. chat-interface
**Status:** 🔄 Em progresso  
**Descrição:** Interface de chat integrada com Chatwoot  
**Próxima Ação:** Desenvolvimento ativo

### 2. contact-management-system
**Status:** 🔄 Em progresso  
**Descrição:** Sistema completo de gerenciamento de contatos  
**Próxima Ação:** Testes opcionais pendentes

### 3. production-cleanup-v2
**Status:** 🔄 Em progresso (ATUAL)  
**Descrição:** Limpeza e organização do projeto para produção  
**Próxima Ação:** Executando tarefas

### 4. scheduling-system-review
**Status:** 🔄 Em progresso  
**Descrição:** Revisão e correções do sistema de agendamento  
**Próxima Ação:** Implementação de correções

## Specs Consolidadas (2)

### 1. branding-system
**Tipo:** 📚 Referência  
**Descrição:** Consolida todas as funcionalidades de branding  
**Status:** ✅ Implementado e funcional

### 2. manutencao-continua
**Tipo:** 📚 Referência  
**Descrição:** Consolida requisitos de manutenção contínua  
**Status:** Processo contínuo

## Specs Arquivadas (49)

Ver pasta `_archived/` para specs completas.

## Como Trabalhar com Specs

### Criar Nova Spec

1. Criar diretório: `.kiro/specs/nome-da-feature/`
2. Criar `requirements.md` com requisitos EARS + INCOSE
3. Criar `design.md` com arquitetura e decisões
4. Criar `tasks.md` com plano de implementação
5. Executar tarefas uma por vez

### Executar Tarefas de uma Spec

1. Abrir `tasks.md` da spec
2. Clicar em "Start task" na tarefa desejada
3. Implementar conforme descrito
4. Marcar como completa
5. Passar para próxima tarefa

### Arquivar Spec Completa

1. Verificar que todas as tarefas estão completas
2. Mover para `_archived/`: `mv .kiro/specs/nome/ .kiro/specs/_archived/`
3. Atualizar este README

## Métricas Atuais

- **Total de Specs:** 55 (4 ativas + 49 arquivadas + 2 consolidadas)
- **Taxa de Conclusão:** 89% (49/55)
- **Specs Ativas:** 7% (4/55)

## Referências

- **Convenções:** `.kiro/steering/tech.md`, `structure.md`, `product.md`
- **Workflow:** Ver instruções no prompt do sistema

---

**Última Atualização:** Dezembro 2025
