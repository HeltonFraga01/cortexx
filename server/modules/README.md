# Módulos do Backend - Modular Monolith

Este diretório contém os módulos de negócio do WUZAPI Manager, organizados seguindo o padrão Modular Monolith conforme o Manual de Engenharia.

## Estrutura de um Módulo

Cada módulo segue a estrutura:

```
modules/
├── [module-name]/
│   ├── api/                    # Camada de Interface (Entrada)
│   │   ├── http/
│   │   │   ├── controller.js   # Manipulação de Request/Response
│   │   │   └── router.js       # Definição de Rotas Express
│   │   └── dtos/               # Data Transfer Objects (Validação)
│   ├── core/                   # Camada de Aplicação e Domínio
│   │   ├── services/           # Casos de uso e orquestração
│   │   ├── domain/             # Entidades e Tipos do Domínio
│   │   └── errors/             # Erros específicos do módulo
│   ├── infra/                  # Camada de Infraestrutura (Saída)
│   │   ├── repositories/       # Implementação do acesso ao banco de dados
│   │   └── mappers/            # Conversão Linha BD <-> Entidade Domínio
│   └── index.js                # API Pública do Módulo
```

## Regra da API Pública

O arquivo `index.js` na raiz de cada módulo atua como uma barreira arquitetural (Facade).

**Outros módulos NUNCA devem importar arquivos internos de um módulo.**

```javascript
// ✅ Correto
const { InstanceService } = require('../modules/instances');

// ❌ Proibido
const repo = require('../modules/instances/infra/repositories/instanceRepository');
```

## Módulos Disponíveis

- `instances/` - Gerenciamento de instâncias WhatsApp
- `messages/` - Envio e histórico de mensagens
- `contacts/` - Gerenciamento de contatos
- `webhooks/` - Configuração de webhooks
- `branding/` - Configuração de branding

## Migração Gradual

A migração para Modular Monolith está sendo feita gradualmente:

1. Novos recursos são criados diretamente nos módulos
2. Código existente é migrado conforme necessidade
3. Rotas antigas são mantidas para compatibilidade

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 2
- ADR 002: Modular Monolith Architecture
