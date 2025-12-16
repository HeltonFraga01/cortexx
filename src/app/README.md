# App Layer - Inicialização

Esta camada contém a configuração e inicialização da aplicação.

## Conteúdo

- Providers (React Query, Theme, Auth)
- Router configuration
- Global CSS
- App entry point

## Regras FSD

- **Pode importar de:** Todas as camadas abaixo (pages, widgets, features, entities, shared)
- **Não pode ser importado por:** Nenhuma outra camada

## Estrutura Proposta

```
app/
├── providers/
│   ├── QueryProvider.tsx
│   ├── ThemeProvider.tsx
│   └── AuthProvider.tsx
├── router/
│   └── index.tsx
├── styles/
│   └── global.css
└── index.tsx
```

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 4.1
- Feature-Sliced Design: https://feature-sliced.design/
