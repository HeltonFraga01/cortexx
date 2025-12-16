# Widgets Layer - Blocos de UI Complexos

Esta camada contém blocos de UI autônomos que combinam múltiplas features.

## Exemplos

- Header com navegação e status de conexão
- Sidebar com menu e informações do usuário
- InstanceList com filtros e ações
- MessageComposer com templates e variáveis

## Regras FSD

- **Pode importar de:** features, entities, shared
- **Não pode importar de:** app, pages
- **Não pode ser importado por:** features, entities, shared

## Estrutura de um Widget

```
widgets/
├── header/
│   ├── ui/
│   │   └── Header.tsx
│   ├── model/
│   │   └── useHeaderState.ts
│   └── index.ts
├── sidebar/
│   ├── ui/
│   │   └── Sidebar.tsx
│   └── index.ts
└── instance-list/
    ├── ui/
    │   └── InstanceList.tsx
    ├── model/
    │   └── useInstanceList.ts
    └── index.ts
```

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 4.1
- Feature-Sliced Design: https://feature-sliced.design/
