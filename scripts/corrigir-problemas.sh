#!/bin/bash

# Script de Correção Rápida - WUZAPI Manager
# Corrige problemas comuns de banco de dados e configuração

set -e

echo "🔧 Iniciando correção de problemas..."
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_ok() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# 1. Criar diretórios necessários
print_info "Criando diretórios necessários..."
mkdir -p data
mkdir -p backups
mkdir -p server/logs
mkdir -p server/public
mkdir -p logs
print_ok "Diretórios criados"
echo ""

# 2. Ajustar permissões
print_info "Ajustando permissões..."
chmod -R u+w data/ 2>/dev/null || true
chmod -R u+w server/ 2>/dev/null || true
chmod -R u+w logs/ 2>/dev/null || true
print_ok "Permissões ajustadas"
echo ""

# 3. Verificar e mover banco de dados se necessário
print_info "Verificando localização do banco de dados..."

if [ -f "server/wuzapi.db" ]; then
    print_warning "Banco encontrado em server/wuzapi.db"
    read -p "Deseja mover para data/wuzapi.db? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        # Criar backup
        BACKUP_FILE="backups/wuzapi-backup-$(date +%Y%m%d-%H%M%S).db"
        cp server/wuzapi.db "$BACKUP_FILE"
        print_ok "Backup criado: $BACKUP_FILE"
        
        # Mover banco
        mv server/wuzapi.db data/wuzapi.db
        
        # Mover arquivos WAL e SHM se existirem
        [ -f "server/wuzapi.db-wal" ] && mv server/wuzapi.db-wal data/wuzapi.db-wal
        [ -f "server/wuzapi.db-shm" ] && mv server/wuzapi.db-shm data/wuzapi.db-shm
        
        print_ok "Banco movido para data/wuzapi.db"
    fi
fi

if [ -f "data/wuzapi.db" ]; then
    print_ok "Banco de dados encontrado em data/wuzapi.db"
    
    # Verificar integridade se sqlite3 estiver disponível
    if command -v sqlite3 &> /dev/null; then
        print_info "Verificando integridade do banco..."
        INTEGRITY=$(sqlite3 data/wuzapi.db "PRAGMA integrity_check;" 2>&1)
        if [ "$INTEGRITY" = "ok" ]; then
            print_ok "Integridade: OK"
        else
            print_warning "Integridade: $INTEGRITY"
        fi
    fi
else
    print_info "Banco de dados será criado na primeira execução"
fi
echo ""

# 4. Verificar arquivos .env
print_info "Verificando arquivos de configuração..."

if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_ok "Arquivo .env criado a partir de .env.example"
        print_warning "IMPORTANTE: Edite .env com suas configurações!"
    else
        print_warning "Arquivo .env.example não encontrado"
    fi
else
    print_ok "Arquivo .env existe"
fi

if [ ! -f "server/.env" ]; then
    print_info "Criando server/.env..."
    cat > server/.env << 'EOF'
# WUZAPI Manager Server - Configurações

# Configurações do servidor
NODE_ENV=development
PORT=3001

# URL base da API WUZAPI externa
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
REQUEST_TIMEOUT=10000

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:4173

# Configurações do banco de dados SQLite
# Caminho relativo ao diretório server/
SQLITE_DB_PATH=../data/wuzapi.db
SQLITE_WAL_MODE=true
SQLITE_TIMEOUT=5000
SQLITE_CACHE_SIZE=2000
SQLITE_SYNCHRONOUS=NORMAL
EOF
    print_ok "Arquivo server/.env criado"
else
    print_ok "Arquivo server/.env existe"
fi
echo ""

# 5. Verificar dependências
print_info "Verificando dependências..."

if [ ! -d "node_modules" ]; then
    print_warning "node_modules não encontrado"
    read -p "Deseja instalar dependências do frontend? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        npm install
        print_ok "Dependências do frontend instaladas"
    fi
else
    print_ok "Dependências do frontend instaladas"
fi

if [ ! -d "server/node_modules" ]; then
    print_warning "server/node_modules não encontrado"
    read -p "Deseja instalar dependências do backend? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        cd server && npm install && cd ..
        print_ok "Dependências do backend instaladas"
    fi
else
    print_ok "Dependências do backend instaladas"
fi
echo ""

# 6. Verificar build do frontend
print_info "Verificando build do frontend..."

if [ ! -d "dist" ]; then
    print_warning "Build do frontend não encontrado"
    read -p "Deseja fazer o build agora? (s/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Ss]$ ]]; then
        npm run build
        print_ok "Build do frontend concluído"
    else
        print_warning "Execute 'npm run build' antes de iniciar o servidor"
    fi
else
    print_ok "Build do frontend existe"
fi
echo ""

# 7. Resumo
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Correções Aplicadas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
print_ok "Diretórios criados e permissões ajustadas"
print_ok "Configurações verificadas"
print_ok "Banco de dados configurado em data/wuzapi.db"
echo ""
print_info "Próximos passos:"
echo "   1. Verifique as configurações em .env"
echo "   2. Inicie o servidor: npm run server:dev"
echo "   3. Acesse: http://localhost:3001/health"
echo ""
print_ok "Correção concluída!"
echo ""
