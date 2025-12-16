#!/bin/bash

# Script de Limpeza - WUZAPI Manager
# Remove arquivos temporários e limpa o projeto

echo "🧹 Limpando projeto WUZAPI Manager..."

# Limpar node_modules
echo "📦 Limpando node_modules..."
rm -rf node_modules
rm -rf server/node_modules

# Limpar builds
echo "🏗️ Limpando builds..."
rm -rf dist
rm -rf server/dist

# Limpar logs
echo "📝 Limpando logs..."
rm -rf logs
rm -rf server/logs
rm -f *.log
rm -f server/*.log

# Limpar cache
echo "🗂️ Limpando cache..."
rm -rf .cache
rm -rf server/.cache
rm -f bun.lockb

# Limpar banco de dados local (cuidado!)
read -p "❓ Remover banco de dados local? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️ Removendo banco de dados local..."
    rm -f server/wuzapi.db
    rm -f server/*.db
fi

# Reinstalar dependências
read -p "📦 Reinstalar dependências? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "📦 Instalando dependências..."
    npm install
    cd server && npm install && cd ..
fi

echo "✅ Limpeza concluída!"
echo ""
echo "📋 Próximos passos:"
echo "1. npm run dev (desenvolvimento)"
echo "2. npm run build:production (build)"
echo "3. ./deploy-swarm.sh all (deploy)"