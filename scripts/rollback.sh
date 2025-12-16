#!/bin/bash

# Script de rollback para WUZAPI Manager
# Uso: ./scripts/rollback.sh [environment] [version]

set -e

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STACK_NAME="wuzapi"
IMAGE_NAME="heltonfraga/wuzapi-manager"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Parse argumentos
ENVIRONMENT=${1:-"production"}
TARGET_VERSION=$2

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

# Função para listar versões disponíveis
list_available_versions() {
    log_info "Versões disponíveis para rollback:"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Listar versões do Docker Swarm
        docker service ls --filter "name=${STACK_NAME}_wuzapi-manager" --format "table {{.Name}}\t{{.Image}}\t{{.UpdatedAt}}"
    else
        # Listar imagens locais
        docker images "$IMAGE_NAME" --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"
    fi
    
    # Listar backups disponíveis
    local backup_dir="$PROJECT_ROOT/backups"
    if [[ -d "$backup_dir" ]]; then
        echo
        log_info "Backups de banco disponíveis:"
        ls -la "$backup_dir" | grep "deploy-" | tail -10
    fi
}

# Função para obter versão atual
get_current_version() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        docker service inspect "$STACK_NAME"_wuzapi-manager --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null | cut -d':' -f2 || echo "unknown"
    else
        docker-compose -f "$PROJECT_ROOT/$COMPOSE_FILE" config | grep "image:" | head -1 | awk '{print $2}' | cut -d':' -f2 || echo "unknown"
    fi
}

# Função para executar rollback
execute_rollback() {
    local version=$1
    
    log_info "Executando rollback para versão: $version"
    log_info "Environment: $ENVIRONMENT"
    
    # Verificar se a imagem existe
    if ! docker pull "$IMAGE_NAME:$version" &> /dev/null; then
        log_error "Imagem não encontrada: $IMAGE_NAME:$version"
        exit 1
    fi
    
    cd "$PROJECT_ROOT"
    
    # Backup da configuração atual
    cp "$COMPOSE_FILE" "$COMPOSE_FILE.rollback-backup"
    
    # Atualizar versão no arquivo de configuração
    sed -i.bak "s|image: $IMAGE_NAME:.*|image: $IMAGE_NAME:$version|g" "$COMPOSE_FILE"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Rollback no Docker Swarm
        log_info "Executando rollback no Docker Swarm..."
        docker stack deploy -c "$COMPOSE_FILE" "$STACK_NAME" || {
            log_error "Falha no rollback"
            # Restaurar configuração original
            mv "$COMPOSE_FILE.rollback-backup" "$COMPOSE_FILE"
            rm -f "$COMPOSE_FILE.bak"
            exit 1
        }
    else
        # Rollback no Docker Compose
        log_info "Executando rollback no Docker Compose..."
        docker-compose -f "$COMPOSE_FILE" pull
        docker-compose -f "$COMPOSE_FILE" up -d || {
            log_error "Falha no rollback"
            # Restaurar configuração original
            mv "$COMPOSE_FILE.rollback-backup" "$COMPOSE_FILE"
            rm -f "$COMPOSE_FILE.bak"
            exit 1
        }
    fi
    
    # Limpar arquivos temporários
    rm -f "$COMPOSE_FILE.bak" "$COMPOSE_FILE.rollback-backup"
    
    log_success "Rollback executado"
}

# Função para verificar rollback
verify_rollback() {
    local version=$1
    local max_attempts=20
    local attempt=1
    
    log_info "Verificando rollback..."
    
    # Aguardar serviços ficarem prontos
    sleep 30
    
    # Verificar health check
    while [[ $attempt -le $max_attempts ]]; do
        log_info "Tentativa $attempt/$max_attempts - Verificando health check..."
        
        if curl -f -s "http://$DOMAIN/health" > /dev/null 2>&1; then
            log_success "Health check passou!"
            
            # Verificar se a versão está correta
            local current_version=$(get_current_version)
            if [[ "$current_version" == "$version" ]]; then
                log_success "Rollback para versão $version verificado com sucesso!"
                return 0
            else
                log_warning "Versão atual ($current_version) não corresponde à esperada ($version)"
            fi
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Health check falhou após $max_attempts tentativas"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    return 0
}

# Função para restaurar backup do banco
restore_database_backup() {
    local backup_path=$1
    
    if [[ ! -f "$backup_path" ]]; then
        log_error "Backup não encontrado: $backup_path"
        return 1
    fi
    
    log_info "Restaurando backup do banco de dados: $backup_path"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local container_id=$(docker ps --filter "name=${STACK_NAME}_wuzapi-manager" --format "{{.ID}}" | head -1)
        if [[ -n "$container_id" ]]; then
            # Parar aplicação temporariamente
            docker service scale "$STACK_NAME"_wuzapi-manager=0
            sleep 10
            
            # Copiar backup para container
            docker cp "$backup_path" "$container_id:/app/data/wuzapi.db"
            
            # Reiniciar aplicação
            docker service scale "$STACK_NAME"_wuzapi-manager=1
            
            log_success "Backup do banco restaurado"
        else
            log_error "Container não encontrado"
            return 1
        fi
    fi
}

# Função principal
main() {
    local current_version=$(get_current_version)
    
    log_info "=== WUZAPI Manager Rollback ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Versão atual: $current_version"
    echo
    
    if [[ -z "$TARGET_VERSION" ]]; then
        log_info "Nenhuma versão especificada. Listando opções disponíveis:"
        echo
        list_available_versions
        echo
        read -p "Digite a versão para rollback (ou 'cancel' para cancelar): " TARGET_VERSION
        
        if [[ "$TARGET_VERSION" == "cancel" ]]; then
            log_info "Rollback cancelado pelo usuário"
            exit 0
        fi
    fi
    
    if [[ -z "$TARGET_VERSION" ]]; then
        log_error "Versão não especificada"
        exit 1
    fi
    
    if [[ "$TARGET_VERSION" == "$current_version" ]]; then
        log_warning "Versão especificada ($TARGET_VERSION) é a mesma que a atual"
        read -p "Deseja continuar mesmo assim? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Rollback cancelado"
            exit 0
        fi
    fi
    
    # Confirmar rollback
    echo
    log_warning "ATENÇÃO: Você está prestes a fazer rollback de $current_version para $TARGET_VERSION"
    read -p "Tem certeza que deseja continuar? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelado pelo usuário"
        exit 0
    fi
    
    # Executar rollback
    execute_rollback "$TARGET_VERSION"
    
    # Verificar rollback
    if verify_rollback "$TARGET_VERSION"; then
        log_success "Rollback concluído com sucesso!"
        
        # Perguntar sobre restauração do banco
        echo
        read -p "Deseja restaurar um backup do banco de dados? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Backups disponíveis:"
            ls -la "$PROJECT_ROOT/backups/" | grep "deploy-" | tail -5
            echo
            read -p "Digite o caminho completo do backup: " backup_path
            if [[ -n "$backup_path" ]]; then
                restore_database_backup "$backup_path"
            fi
        fi
        
    else
        log_error "Rollback falhou - verifique os logs e status dos serviços"
        exit 1
    fi
}

# Função de ajuda
show_help() {
    echo "Uso: $0 [environment] [version]"
    echo
    echo "Argumentos:"
    echo "  environment    Environment (development|staging|production)"
    echo "  version        Versão para rollback (opcional - será solicitada se não fornecida)"
    echo
    echo "Exemplos:"
    echo "  $0 production v1.2.0"
    echo "  $0 staging"
    echo "  $0 development latest"
}

# Verificar se foi solicitada ajuda
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Executar função principal
main