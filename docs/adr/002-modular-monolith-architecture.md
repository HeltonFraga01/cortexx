# ADR 002: Arquitetura Modular Monolith

## Status
Proposto (Migração Gradual)

## Contexto
O backend atual usa arquitetura em camadas tradicional (routes/, services/, utils/). À medida que o projeto cresce, as dependências entre domínios se tornam difíceis de gerenciar.

## Decisão
Migrar gradualmente para arquitetura Modular Monolith, organizando código por domínio de negócio.

## Estrutura Proposta

### Atual (Layered Architecture):
```
server/
├── routes/           # Todas as rotas juntas
├── services/         # Todos os serviços juntos
├── middleware/       # Middlewares globais
└── utils/            # Utilitários globais
```

### Proposta (Modular Monolith):
```
server/
├── modules/
│   ├── instances/
│   │   ├── api/          # Controllers e rotas
│   │   ├── core/         # Serviços e domínio
│   │   └── infra/        # Repositórios
│   ├── messages/
│   │   ├── api/
│   │   ├── core/
│   │   └── infra/
│   └── contacts/
│       ├── api/
│       ├── core/
│       └── infra/
└── shared/               # Kernel técnico
    ├── database/
    ├── logger/
    └── middleware/
```

## Justificativa

### Benefícios:
1. **Alta Coesão**: Código que muda junto permanece junto
2. **Baixo Acoplamento**: Módulos se comunicam via APIs públicas
3. **Facilidade de Manutenção**: Desenvolvedores trabalham em módulos isolados
4. **Preparação para Microsserviços**: Extração futura facilitada

### Regra da API Pública:
Cada módulo expõe apenas o que está em seu `index.js`. Importações internas entre módulos são proibidas.

```javascript
// ✅ Correto
const { InstanceService } = require('../modules/instances');

// ❌ Proibido
const repo = require('../modules/instances/infra/repository');
```

## Plano de Migração

### Fase 1: Criar estrutura shared/
- Mover database.js, logger.js para shared/
- Manter compatibilidade com imports existentes

### Fase 2: Migrar módulo piloto (instances)
- Criar estrutura api/core/infra
- Refatorar rotas e serviços existentes

### Fase 3: Migrar demais módulos
- messages, contacts, webhooks, etc.

## Consequências

### Positivas:
- Código mais organizado e manutenível
- Onboarding mais rápido para novos devs
- Testes mais focados por módulo

### Negativas:
- Esforço de migração significativo
- Curva de aprendizado para equipe
- Possíveis breaking changes durante migração

## Referências
- Manual de Engenharia WUZAPI Manager, Seção 2
- Bulletproof Node.js Architecture
