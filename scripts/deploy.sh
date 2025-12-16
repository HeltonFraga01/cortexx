#!/bin/bash

# Script automatizado de deploy para WUZAPI Manager
# Uso: ./scripts/deploy.sh [environment] [version] [options]
# Exemplo: ./scripts/deploy.sh production v1.2.2 --auto-rollback

set -e

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_CONFIG_FILE="$PROJECT_ROOT/deploy/config.yml"
STACK_NAME="wuzapi"
IMAGE_NAME="heltonfraga/wuzapi-manager"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Funções auxiliares
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Função para cleanup em caso de erro
cleanup_on_error() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        log_error "Deploy falhou com código $exit_code"
        
        if [[ "$AUTO_ROLLBACK" == "true" && -n "$PREVIOUS_VERSION" ]]; then
            log_warning "Iniciando rollback automático para versão $PREVIOUS_VERSION"
            rollback_deployment "$PREVIOUS_VERSION"
        fi
    fi
    exit $exit_code
}

# Configurar trap para cleanup
trap cleanup_on_error ERR

# Parse argumentos
ENVIRONMENT=${1:-"production"}
VERSION=${2:-"latest"}
AUTO_ROLLBACK=false
SKIP_TESTS=false
FORCE_DEPLOY=false
DRY_RUN=false

# Parse opções
shift 2 2>/dev/null || true
while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-rollback)
            AUTO_ROLLBACK=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --force)
            FORCE_DEPLOY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            log_error "Opção desconhecida: $1"
            exit 1
            ;;
    esac
done

# Validar argumentos
if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Environment deve ser: development, staging ou production"
    exit 1
fi

# Configurações por ambiente
case $ENVIRONMENT in
    "development")
        COMPOSE_FILE="docker-compose.yml"
        DOMAIN="wuzapi.localhost"
        ;;
    "staging")
        COMPOSE_FILE="docker-compose.staging.yml"
        DOMAIN="staging.wuzapi.com"
        ;;
    "production")
        COMPOSE_FILE="docker-swarm-stack.yml"
        DOMAIN="cloudapi.wasend.com.br"
        ;;
esac

log_info "=== WUZAPI Manager Deploy ==="
log_info "Environment: $ENVIRONMENT"
log_info "Version: $VERSION"
log_info "Image: $IMAGE_NAME:$VERSION"
log_info "Domain: $DOMAIN"
log_info "Auto Rollback: $AUTO_ROLLBACK"
log_info "Dry Run: $DRY_RUN"
echo

# Função para verificar pré-requisitos
check_prerequisites() {
    log_step "Verificando pré-requisitos..."
    
    # Verificar Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker não está instalado"
        exit 1
    fi
    
    # Verificar Docker Compose (para dev/staging)
    if [[ "$ENVIRONMENT" != "production" ]] && ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose não está instalado"
        exit 1
    fi
    
    # Verificar Docker Swarm (para produção)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        if ! docker info | grep -q "Swarm: active"; then
            log_error "Docker Swarm não está ativo"
            exit 1
        fi
    fi
    
    # Verificar arquivo de configuração
    if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        log_error "Arquivo de configuração não encontrado: $COMPOSE_FILE"
        exit 1
    fi
    
    # Verificar conectividade com registry
    if ! docker pull "$IMAGE_NAME:$VERSION" &> /dev/null; then
        log_error "Não foi possível baixar a imagem: $IMAGE_NAME:$VERSION"
        exit 1
    fi
    
    log_success "Pré-requisitos verificados"
}

# Função para executar testes
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Testes ignorados (--skip-tests)"
        return 0
    fi
    
    log_step "Executando testes..."
    
    # Testes unitários
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        cd "$PROJECT_ROOT"
        npm test -- --run --reporter=verbose || {
            log_error "Testes unitários falharam"
            exit 1
        }
    fi
    
    # Testes de integração (se disponível)
    if [[ -f "$PROJECT_ROOT/server/package.json" ]]; then
        cd "$PROJECT_ROOT/server"
        npm test || {
            log_error "Testes de integração falharam"
            exit 1
        }
    fi
    
    log_success "Testes executados com sucesso"
}

# Função para backup da versão atual
backup_current_version() {
    log_step "Fazendo backup da versão atual..."
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Docker Swarm
        CURRENT_IMAGE=$(docker service inspect "$STACK_NAME"_wuzapi-manager --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || echo "")
        if [[ -n "$CURRENT_IMAGE" ]]; then
            PREVIOUS_VERSION=$(echo "$CURRENT_IMAGE" | cut -d':' -f2)
            log_info "Versão atual: $PREVIOUS_VERSION"
            
            # Backup do banco de dados
            backup_database
        fi
    else
        # Docker Compose
        CURRENT_IMAGE=$(docker-compose -f "$COMPOSE_FILE" config | grep "image:" | head -1 | awk '{print $2}' || echo "")
        if [[ -n "$CURRENT_IMAGE" ]]; then
            PREVIOUS_VERSION=$(echo "$CURRENT_IMAGE" | cut -d':' -f2)
            log_info "Versão atual: $PREVIOUS_VERSION"
        fi
    fi
    
    log_success "Backup concluído"
}

# Função para backup do banco de dados
backup_database() {
    log_step "Fazendo backup do banco de dados..."
    
    local backup_dir="$PROJECT_ROOT/backups/deploy-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Backup via Docker Swarm
        local container_id=$(docker ps --filter "name=${STACK_NAME}_wuzapi-manager" --format "{{.ID}}" | head -1)
        if [[ -n "$container_id" ]]; then
            docker exec "$container_id" sqlite3 /app/data/wuzapi.db ".backup /app/data/pre-deploy-backup.db" || {
                log_warning "Falha no backup do banco de dados"
            }
            docker cp "$container_id:/app/data/pre-deploy-backup.db" "$backup_dir/wuzapi.db" || {
                log_warning "Falha ao copiar backup do banco de dados"
            }
        fi
    fi
    
    log_success "Backup do banco de dados concluído: $backup_dir"
}

# Função para validar configuração
validate_configuration() {
    log_step "Validando configuração..."
    
    # Validar arquivo de configuração
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Validar Docker Swarm stack
        docker stack config -c "$PROJECT_ROOT/$COMPOSE_FILE" > /dev/null || {
            log_error "Configuração do Docker Swarm inválida"
            exit 1
        }
    else
        # Validar Docker Compose
        docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" config > /dev/null || {
            log_error "Configuração do Docker Compose inválida"
            exit 1
        }
    fi
    
    # Validar variáveis de ambiente necessárias
    local required_vars=("WUZAPI_BASE_URL" "CORS_ORIGINS")
    for var in "${required_vars[@]}"; do
        if ! grep -q "$var" "$PROJECT_ROOT/$COMPOSE_FILE"; then
            log_warning "Variável de ambiente $var não encontrada na configuração"
        fi
    done
    
    log_success "Configuração validada"
}

# Função para executar deploy
execute_deploy() {
    log_step "Executando deploy..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "DRY RUN - Deploy não será executado"
        return 0
    fi
    
    cd "$PROJECT_ROOT"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Deploy com Docker Swarm
        log_info "Fazendo deploy no Docker Swarm..."
        
        # Atualizar imagem no arquivo de configuração
        sed -i.bak "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$VERSION|g" "$COMPOSE_FILE"
        
        # Deploy da stack
        docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME" || {
            log_error "Falha no deploy da stack"
            # Restaurar arquivo original
            mv "$COMPOSE_FILE.bak" "$COMPOSE_FILE"
            exit 1
        }
        
        # Remover backup do arquivo
        rm -f "$COMPOSE_FILE.bak"
        
    else
        # Deploy com Docker Compose
        log_info "Fazendo deploy com Docker Compose..."
        
        # Atualizar imagem no arquivo de configuração
        sed -i.bak "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$VERSION|g" "$COMPOSE_FILE"
        
        # Pull da nova imagem
        docker-compose -f "$COMPOSE_FILE" pull
        
        # Deploy
        docker-compose -f "$COMPOSE_FILE" up -d || {
            log_error "Falha no deploy com Docker Compose"
            # Restaurar arquivo original
            mv "$COMPOSE_FILE.bak" "$COMPOSE_FILE"
            exit 1
        }
        
        # Remover backup do arquivo
        rm -f "$COMPOSE_FILE.bak"
    fi
    
    log_success "Deploy executado"
}

# Função para verificações pós-deploy
post_deploy_checks() {
    log_step "Executando verificações pós-deploy..."
    
    local max_attempts=30
    local attempt=1
    local health_check_url="http://$DOMAIN/health"
    
    # Aguardar serviços ficarem prontos
    log_info "Aguardando serviços ficarem prontos..."
    sleep 30
    
    # Verificar health check
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Tentativa $attempt/$max_attempts - Verificando health check..."
        
        if curl -f -s "$health_check_url" > /dev/null 2>&1; then
            log_success "Health check passou!"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health check falhou após $max_attempts tentativas"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    # Verificar logs por erros
    log_info "Verificando logs por erros..."
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local recent_logs=$(docker service logs "$STACK_NAME"_wuzapi-manager --tail 50 2>/dev/null || echo "")
        if echo "$recent_logs" | grep -i "error\|exception\|fatal" > /dev/null; then
            log_warning "Erros encontrados nos logs recentes"
        fi
    fi
    
    # Verificar métricas básicas
    log_info "Verificando métricas básicas..."
    local metrics_url="http://$DOMAIN/metrics"
    if curl -f -s "$metrics_url" > /dev/null 2>&1; then
        log_success "Endpoint de métricas acessível"
    else
        log_warning "Endpoint de métricas não acessível"
    fi
    
    log_success "Verificações pós-deploy concluídas"
}

# Função para rollback
rollback_deployment() {
    local rollback_version=${1:-$PREVIOUS_VERSION}
    
    if [[ -z "$rollback_version" ]]; then
        log_error "Versão para rollback não especificada"
        return 1
    fi
    
    log_step "Executando rollback para versão $rollback_version..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Rollback no Docker Swarm
        sed -i.bak "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$rollback_version|g" "$COMPOSE_FILE"
        docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME"
        rm -f "$COMPOSE_FILE.bak"
    else
        # Rollback no Docker Compose
        sed -i.bak "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$rollback_version|g" "$COMPOSE_FILE"
        docker-compose -f "$COMPOSE_FILE" pull
        docker-compose -f "$COMPOSE_FILE" up -d
        rm -f "$COMPOSE_FILE.bak"
    fi
    
    # Aguardar e verificar rollback
    sleep 30
    if curl -f -s "http://$DOMAIN/health" > /dev/null 2>&1; then
        log_success "Rollback executado com sucesso"
    else
        log_error "Rollback falhou - intervenção manual necessária"
        return 1
    fi
}

# Função para notificações
send_notification() {
    local status=$1
    local message=$2
    
    # Implementar notificações (Slack, Discord, email, etc.)
    # Por enquanto, apenas log
    log_info "NOTIFICAÇÃO [$status]: $message"
}

# Função principal
main() {
    log_info "Iniciando processo de deploy..."
    
    # Executar etapas do deploy
    check_prerequisites
    run_tests
    backup_current_version
    validate_configuration
    execute_deploy
    
    # Verificações pós-deploy
    if post_deploy_checks; then
        log_success "Deploy concluído com sucesso!"
        send_notification "SUCCESS" "Deploy da versão $VERSION concluído com sucesso em $ENVIRONMENT"
    else
        log_error "Verificações pós-deploy falharam"
        
        if [[ "$AUTO_ROLLBACK" == "true" && -n "$PREVIOUS_VERSION" ]]; then
            log_warning "Executando rollback automático..."
            if rollback_deployment "$PREVIOUS_VERSION"; then
                send_notification "ROLLBACK" "Deploy falhou, rollback para $PREVIOUS_VERSION executado com sucesso"
            else
                send_notification "CRITICAL" "Deploy e rollback falharam - intervenção manual necessária"
                exit 1
            fi
        else
            send_notification "FAILED" "Deploy da versão $VERSION falhou em $ENVIRONMENT"
            exit 1
        fi
    fi
}

# Função de ajuda
show_help() {
    echo "Uso: $0 [environment] [version] [options]"
    echo
    echo "Argumentos:"
    echo "  environment    Environment de deploy (development|staging|production)"
    echo "  version        Versão da imagem Docker (default: latest)"
    echo
    echo "Opções:"
    echo "  --auto-rollback    Executar rollback automático em caso de falha"
    echo "  --skip-tests       Pular execução de testes"
    echo "  --force            Forçar deploy mesmo com avisos"
    echo "  --dry-run          Simular deploy sem executar"
    echo "  --help             Mostrar esta ajuda"
    echo
    echo "Exemplos:"
    echo "  $0 production v1.2.2 --auto-rollback"
    echo "  $0 staging latest --skip-tests"
    echo "  $0 development --dry-run"
}

# Verificar se foi solicitada ajuda
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Executar função principal
main