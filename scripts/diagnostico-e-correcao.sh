#!/bin/bash

# Script de Diagnóstico e Correção - WUZAPI Manager
# Data: 2025-11-07

set -e

echo "🔍 Iniciando diagnóstico do WUZAPI Manager..."
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cor
print_status() {
    local status=$1
    local message=$2
    
    case $status in
        "ok")
            echo -e "${GREEN}✅ ${message}${NC}"
            ;;
        "error")
            echo -e "${RED}❌ ${message}${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  ${message}${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  ${message}${NC}"
            ;;
    esac
}

# 1. Verificar estrutura de diretórios
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Verificando estrutura de diretórios..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "server" ]; then
    print_status "ok" "Diretório server/ existe"
else
    print_status "error" "Diretório server/ não encontrado"
    exit 1
fi

if [ -d "dist" ]; then
    print_status "ok" "Diretório dist/ existe (build do frontend)"
else
    print_status "warning" "Diretório dist/ não encontrado (execute 'npm run build')"
fi

# Criar diretórios necessários
mkdir -p server/logs
mkdir -p server/public
mkdir -p data
mkdir -p backups

print_status "ok" "Diretórios necessários criados/verificados"
echo ""

# 2. Verificar banco de dados SQLite
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Verificando banco de dados SQLite..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Verificar se sqlite3 está instalado
if ! command -v sqlite3 &> /dev/null; then
    print_status "warning" "sqlite3 não está instalado (diagnóstico limitado)"
else
    # Verificar arquivos do banco
    if [ -f "server/wuzapi.db" ]; then
        print_status "ok" "Banco de dados encontrado: server/wuzapi.db"
        
        # Verificar integridade
        INTEGRITY=$(sqlite3 server/wuzapi.db "PRAGMA integrity_check;" 2>&1)
        if [ "$INTEGRITY" = "ok" ]; then
            print_status "ok" "Integridade do banco: OK"
        else
            print_status "error" "Integridade do banco: FALHOU"
            echo "   Detalhes: $INTEGRITY"
        fi
        
        # Verificar journal mode
        JOURNAL_MODE=$(sqlite3 server/wuzapi.db "PRAGMA journal_mode;" 2>&1)
        print_status "info" "Journal mode: $JOURNAL_MODE"
        
        # Verificar tabelas
        TABLES=$(sqlite3 server/wuzapi.db ".tables" 2>&1)
        print_status "info" "Tabelas encontradas:"
        echo "$TABLES" | sed 's/^/   /'
        
        # Verificar tamanho
        SIZE=$(du -h server/wuzapi.db | cut -f1)
        print_status "info" "Tamanho do banco: $SIZE"
        
    else
        print_status "warning" "Banco de dados não encontrado (será criado na primeira execução)"
    fi
fi

# Verificar permissões
if [ -d "server" ]; then
    if [ -w "server" ]; then
        print_status "ok" "Permissões de escrita no diretório server/"
    else
        print_status "error" "Sem permissões de escrita no diretório server/"
        echo "   Execute: chmod u+w server/"
    fi
fi

echo ""

# 3. Verificar arquivos de configuração
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Verificando arquivos de configuração..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f ".env" ]; then
    print_status "ok" "Arquivo .env encontrado"
    
    # Verificar variáveis importantes
    if grep -q "SQLITE_DB_PATH" .env; then
        DB_PATH=$(grep "SQLITE_DB_PATH" .env | cut -d'=' -f2)
        print_status "info" "SQLITE_DB_PATH: $DB_PATH"
    else
        print_status "warning" "SQLITE_DB_PATH não definido em .env"
    fi
    
    if grep -q "WUZAPI_BASE_URL" .env; then
        API_URL=$(grep "WUZAPI_BASE_URL" .env | cut -d'=' -f2)
        print_status "info" "WUZAPI_BASE_URL: $API_URL"
    else
        print_status "warning" "WUZAPI_BASE_URL não definido em .env"
    fi
else
    print_status "warning" "Arquivo .env não encontrado"
    print_status "info" "Copie .env.example para .env e configure"
fi

if [ -f "server/.env" ]; then
    print_status "ok" "Arquivo server/.env encontrado"
else
    print_status "warning" "Arquivo server/.env não encontrado"
fi

echo ""

# 4. Verificar arquivos HTML
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Verificando arquivos HTML..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "dist/index.html" ]; then
    print_status "ok" "SPA principal: dist/index.html"
else
    print_status "warning" "SPA principal não encontrado (execute 'npm run build')"
fi

if [ -f "server/public/landing-custom.html" ]; then
    print_status "ok" "Landing page customizada: server/public/landing-custom.html"
else
    print_status "info" "Landing page customizada não configurada (opcional)"
fi

if [ -f "index-landing-page.html" ]; then
    print_status "info" "Landing page na raiz: index-landing-page.html"
fi

echo ""

# 5. Verificar dependências
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Verificando dependências..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "node_modules" ]; then
    print_status "ok" "node_modules/ existe (frontend)"
else
    print_status "warning" "node_modules/ não encontrado (execute 'npm install')"
fi

if [ -d "server/node_modules" ]; then
    print_status "ok" "server/node_modules/ existe (backend)"
else
    print_status "warning" "server/node_modules/ não encontrado (execute 'npm run server:install')"
fi

echo ""

# 6. Testar servidor (se solicitado)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Teste de conectividade (opcional)..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

read -p "Deseja testar o servidor? (s/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_status "info" "Testando servidor na porta 3001..."
    
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        print_status "ok" "Servidor está respondendo"
        
        # Mostrar resposta do health check
        HEALTH=$(curl -s http://localhost:3001/health | jq '.' 2>/dev/null || curl -s http://localhost:3001/health)
        echo "$HEALTH" | sed 's/^/   /'
    else
        print_status "warning" "Servidor não está respondendo (pode não estar rodando)"
        print_status "info" "Execute 'npm run server:dev' para iniciar"
    fi
else
    print_status "info" "Teste de servidor pulado"
fi

echo ""

# 7. Resumo e recomendações
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Resumo e Recomendações"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
print_status "info" "Recomendações:"
echo ""
echo "   1. Certifique-se de que as dependências estão instaladas:"
echo "      npm install && npm run server:install"
echo ""
echo "   2. Configure os arquivos .env corretamente:"
echo "      cp .env.example .env"
echo "      # Edite .env com suas configurações"
echo ""
echo "   3. Faça o build do frontend:"
echo "      npm run build"
echo ""
echo "   4. Inicie o servidor:"
echo "      npm run server:dev"
echo ""
echo "   5. Verifique o health check:"
echo "      curl http://localhost:3001/health | jq"
echo ""
echo "   6. Para corrigir problemas de banco de dados:"
echo "      - Verifique permissões: chmod -R u+w server/"
echo "      - Recrie o banco: rm server/wuzapi.db && npm run server:dev"
echo ""

print_status "ok" "Diagnóstico concluído!"
echo ""
