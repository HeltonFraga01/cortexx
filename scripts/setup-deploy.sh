#!/bin/bash

# Script para configurar ambiente de deploy
# Uso: ./scripts/setup-deploy.sh [environment]

set -e

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse argumentos
ENVIRONMENT=${1:-"production"}

# Validar argumentos
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Environment deve ser: development, staging ou production"
    exit 1
fi

log_info "=== Configurando Ambiente de Deploy ==="
log_info "Environment: $ENVIRONMENT"
echo

# Função para verificar dependências
check_dependencies() {
    log_info "Verificando dependências..."
    
    local missing_deps=()
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi
    
    # Verificar Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        missing_deps+=("docker-compose")
    fi
    
    # Verificar jq
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    # Verificar curl
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if [[ ${#missing_deps[@]} -gt 0 ]]; then
        log_error "Dependências faltando: ${missing_deps[*]}"
        log_info "Instale as dependências e execute novamente"
        exit 1
    fi
    
    log_success "Todas as dependências estão instaladas"
}

# Função para configurar Docker Swarm (produção)
setup_docker_swarm() {
    if [[ "$ENVIRONMENT" != "production" ]]; then
        return 0
    fi
    
    log_info "Configurando Docker Swarm..."
    
    # Verificar se Swarm está ativo
    if ! docker info | grep -q "Swarm: active"; then
        log_info "Inicializando Docker Swarm..."
        docker swarm init || {
            log_error "Falha ao inicializar Docker Swarm"
            exit 1
        }
    fi
    
    # Criar network externa se não existir
    if ! docker network ls | grep -q "network_public"; then
        log_info "Criando network externa..."
        docker network create --driver overlay network_public || {
            log_error "Falha ao criar network externa"
            exit 1
        }
    fi
    
    log_success "Docker Swarm configurado"
}

# Função para criar diretórios necessários
create_directories() {
    log_info "Criando diretórios necessários..."
    
    local dirs=(
        "$PROJECT_ROOT/data"
        "$PROJECT_ROOT/logs"
        "$PROJECT_ROOT/backups"
        "$PROJECT_ROOT/deploy/secrets"
        "$PROJECT_ROOT/monitoring"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Criado: $dir"
        fi
    done
    
    # Configurar permissões
    chmod 755 "$PROJECT_ROOT/data"
    chmod 755 "$PROJECT_ROOT/logs"
    chmod 700 "$PROJECT_ROOT/deploy/secrets"
    
    log_success "Diretórios criados"
}

# Função para configurar secrets
setup_secrets() {
    log_info "Configurando secrets..."
    
    local secrets_dir="$PROJECT_ROOT/deploy/secrets"
    local env_file="$secrets_dir/.env.$ENVIRONMENT"
    
    if [[ ! -f "$env_file" ]]; then
        log_info "Criando arquivo de environment: $env_file"
        
        cat > "$env_file" << EOF
# Environment Variables para $ENVIRONMENT
NODE_ENV=$ENVIRONMENT
PORT=3001

# WUZAPI Configuration
WUZAPI_BASE_URL=https://wzapi.wasend.com.br
REQUEST_TIMEOUT=10000

# CORS Configuration
CORS_ORIGINS=https://cloudapi.wasend.com.br

# SQLite Configuration
SQLITE_DB_PATH=/app/data/wuzapi.db
SQLITE_WAL_MODE=true
SQLITE_TIMEOUT=10000
SQLITE_CACHE_SIZE=8000
SQLITE_SYNCHRONOUS=NORMAL
SQLITE_JOURNAL_MODE=WAL

# Node.js Optimizations
NODE_OPTIONS=--max-old-space-size=512
UV_THREADPOOL_SIZE=4

# Timezone
TZ=America/Sao_Paulo

# Logging
LOG_LEVEL=info

# Adicione outras variáveis conforme necessário
# ADMIN_TOKEN=
# DATABASE_ENCRYPTION_KEY=
# JWT_SECRET=
EOF
        
        chmod 600 "$env_file"
        log_warning "Arquivo criado: $env_file"
        log_warning "IMPORTANTE: Configure as variáveis sensíveis antes do deploy!"
    fi
    
    log_success "Secrets configurados"
}

# Função para configurar monitoramento
setup_monitoring() {
    log_info "Configurando monitoramento..."
    
    # Criar configuração do Prometheus se não existir
    local prometheus_config="$PROJECT_ROOT/monitoring/prometheus.yml"
    if [[ ! -f "$prometheus_config" ]]; then
        log_info "Prometheus config já existe, pulando..."
    fi
    
    # Criar configuração do Grafana
    local grafana_dir="$PROJECT_ROOT/monitoring/grafana"
    mkdir -p "$grafana_dir/dashboards" "$grafana_dir/datasources"
    
    log_success "Monitoramento configurado"
}

# Função para configurar backup
setup_backup() {
    log_info "Configurando sistema de backup..."
    
    # Criar script de backup
    local backup_script="$PROJECT_ROOT/scripts/backup.sh"
    
    if [[ ! -f "$backup_script" ]]; then
        cat > "$backup_script" << 'EOF'
#!/bin/bash

# Script de backup automático
# Uso: ./scripts/backup.sh [environment]

set -e

ENVIRONMENT=${1:-"production"}
BACKUP_DIR="./backups/$(date +%Y%m%d-%H%M%S)"
STACK_NAME="wuzapi"

mkdir -p "$BACKUP_DIR"

echo "Iniciando backup para $ENVIRONMENT..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    # Backup do banco de dados
    CONTAINER_ID=$(docker ps --filter "name=${STACK_NAME}_wuzapi-manager" --format "{{.ID}}" | head -1)
    if [[ -n "$CONTAINER_ID" ]]; then
        docker exec "$CONTAINER_ID" sqlite3 /app/data/wuzapi.db ".backup /app/data/backup-$(date +%Y%m%d-%H%M%S).db"
        docker cp "$CONTAINER_ID:/app/data/backup-$(date +%Y%m%d-%H%M%S).db" "$BACKUP_DIR/wuzapi.db"
    fi
    
    # Backup das configurações
    cp docker-swarm-stack.yml "$BACKUP_DIR/"
    cp -r deploy/ "$BACKUP_DIR/" 2>/dev/null || true
fi

echo "Backup concluído: $BACKUP_DIR"

# Limpar backups antigos (manter últimos 30 dias)
find ./backups -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
EOF
        
        chmod +x "$backup_script"
        log_info "Script de backup criado: $backup_script"
    fi
    
    # Configurar cron job para backup automático (produção)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        log_info "Para configurar backup automático, adicione ao crontab:"
        echo "0 2 * * * cd $PROJECT_ROOT && ./scripts/backup.sh production"
    fi
    
    log_success "Sistema de backup configurado"
}

# Função para configurar logs
setup_logging() {
    log_info "Configurando sistema de logs..."
    
    # Configurar logrotate
    local logrotate_config="/etc/logrotate.d/wuzapi-manager"
    
    if [[ "$ENVIRONMENT" == "production" && ! -f "$logrotate_config" ]]; then
        log_info "Para configurar rotação de logs, crie (como root):"
        echo "sudo tee $logrotate_config << EOF"
        echo "$PROJECT_ROOT/logs/*.log {"
        echo "    daily"
        echo "    missingok"
        echo "    rotate 30"
        echo "    compress"
        echo "    delaycompress"
        echo "    notifempty"
        echo "    create 644 $(whoami) $(whoami)"
        echo "}"
        echo "EOF"
    fi
    
    log_success "Sistema de logs configurado"
}

# Função para validar configuração
validate_configuration() {
    log_info "Validando configuração..."
    
    # Verificar arquivos necessários
    local required_files=(
        "$PROJECT_ROOT/Dockerfile"
        "$PROJECT_ROOT/docker-swarm-stack.yml"
        "$PROJECT_ROOT/scripts/deploy.sh"
        "$PROJECT_ROOT/scripts/rollback.sh"
        "$PROJECT_ROOT/scripts/post-deploy-check.sh"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            log_error "Arquivo necessário não encontrado: $file"
            exit 1
        fi
    done
    
    # Verificar se scripts são executáveis
    local scripts=(
        "$PROJECT_ROOT/scripts/deploy.sh"
        "$PROJECT_ROOT/scripts/rollback.sh"
        "$PROJECT_ROOT/scripts/post-deploy-check.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ ! -x "$script" ]]; then
            log_warning "Tornando script executável: $script"
            chmod +x "$script"
        fi
    done
    
    # Validar configuração Docker
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker stack config -c "$PROJECT_ROOT/docker-swarm-stack.yml" > /dev/null || {
            log_error "Configuração Docker Swarm inválida"
            exit 1
        }
    fi
    
    log_success "Configuração validada"
}

# Função para mostrar próximos passos
show_next_steps() {
    echo
    log_info "=== PRÓXIMOS PASSOS ==="
    echo
    echo "1. Configure as variáveis de ambiente sensíveis:"
    echo "   vi $PROJECT_ROOT/deploy/secrets/.env.$ENVIRONMENT"
    echo
    echo "2. Para fazer deploy:"
    echo "   ./scripts/deploy.sh $ENVIRONMENT v1.2.2"
    echo
    echo "3. Para verificar status:"
    echo "   ./scripts/post-deploy-check.sh $ENVIRONMENT"
    echo
    echo "4. Para fazer rollback (se necessário):"
    echo "   ./scripts/rollback.sh $ENVIRONMENT [versao-anterior]"
    echo
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "5. Configure backup automático (crontab):"
        echo "   0 2 * * * cd $PROJECT_ROOT && ./scripts/backup.sh production"
        echo
        echo "6. Configure monitoramento (opcional):"
        echo "   docker-compose --profile monitoring up -d"
        echo
    fi
    
    echo "7. Para mais informações, consulte:"
    echo "   - docs/DOCKER.md"
    echo "   - deploy/config.yml"
    echo
}

# Função principal
main() {
    check_dependencies
    setup_docker_swarm
    create_directories
    setup_secrets
    setup_monitoring
    setup_backup
    setup_logging
    validate_configuration
    
    log_success "Ambiente de deploy configurado com sucesso!"
    show_next_steps
}

# Função de ajuda
show_help() {
    echo "Uso: $0 [environment]"
    echo
    echo "Argumentos:"
    echo "  environment    Environment (development|staging|production)"
    echo
    echo "Este script configura o ambiente para deploy automatizado."
}

# Verificar se foi solicitada ajuda
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Executar função principal
main