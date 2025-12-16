# Shared - Kernel Técnico

Este diretório contém código agnóstico ao negócio, compartilhado por todos os módulos.

## Estrutura

```
shared/
├── database/       # Abstrações de banco de dados
├── logger/         # Sistema de logging
├── middleware/     # Middlewares globais
├── errors/         # Classes de erro base
└── utils/          # Utilitários genéricos
```

## Regras

1. **Código aqui NÃO deve conter lógica de negócio**
2. **Módulos podem importar de shared/**
3. **shared/ NÃO pode importar de modules/**

## Migração

Durante a migração para Modular Monolith, os arquivos em `server/utils/` e `server/middleware/` serão gradualmente movidos para cá.

## Referências

- Manual de Engenharia WUZAPI Manager, Seção 2.1
