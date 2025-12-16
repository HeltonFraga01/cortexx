#!/bin/bash

# Script de verificações pós-deploy para WUZAPI Manager
# Uso: ./scripts/post-deploy-check.sh [environment] [domain]

set -e

# Configurações
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
STACK_NAME="wuzapi"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_check() {
    echo -e "${PURPLE}[CHECK]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Parse argumentos
ENVIRONMENT=${1:-"production"}
DOMAIN=${2:-""}

# Configurar domain baseado no environment
if [[ -z "$DOMAIN" ]]; then
    case $ENVIRONMENT in
        "development")
            DOMAIN="wuzapi.localhost"
            ;;
        "staging")
            DOMAIN="staging.wuzapi.com"
            ;;
        "production")
            DOMAIN="cloudapi.wasend.com.br"
            ;;
    esac
fi

# Contadores para relatório
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Função para executar check
run_check() {
    local check_name=$1
    local check_command=$2
    local is_critical=${3:-true}
    
    ((TOTAL_CHECKS++))
    log_check "$check_name"
    
    if eval "$check_command"; then
        log_success "$check_name - PASSOU"
        ((PASSED_CHECKS++))
        return 0
    else
        if [[ "$is_critical" == "true" ]]; then
            log_error "$check_name - FALHOU"
            ((FAILED_CHECKS++))
        else
            log_warning "$check_name - AVISO"
            ((WARNING_CHECKS++))
        fi
        return 1
    fi
}

# Verificações de conectividade
check_connectivity() {
    log_info "=== Verificações de Conectividade ==="
    
    # Health check endpoint
    run_check "Health Check Endpoint" \
        "curl -f -s --max-time 10 http://$DOMAIN/health > /dev/null"
    
    # HTTPS (para produção)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        run_check "HTTPS Endpoint" \
            "curl -f -s --max-time 10 https://$DOMAIN/health > /dev/null"
    fi
    
    # Verificar redirecionamento HTTP para HTTPS
    if [[ "$ENVIRONMENT" == "production" ]]; then
        run_check "HTTP to HTTPS Redirect" \
            "curl -s --max-time 10 -I http://$DOMAIN | grep -q '301\\|302'" \
            false
    fi
    
    # Verificar tempo de resposta
    run_check "Response Time < 5s" \
        "timeout 5 curl -f -s http://$DOMAIN/health > /dev/null"
}

# Verificações de serviços
check_services() {
    log_info "=== Verificações de Serviços ==="
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Docker Swarm services
        run_check "Docker Swarm Service Running" \
            "docker service ls --filter name=${STACK_NAME}_wuzapi-manager --format '{{.Replicas}}' | grep -q '1/1'"
        
        run_check "Service Update Status" \
            "! docker service ls --filter name=${STACK_NAME}_wuzapi-manager --format '{{.UpdateStatus}}' | grep -q 'updating'"
        
        # Verificar se não há containers em estado de erro
        run_check "No Failed Containers" \
            "! docker service ps ${STACK_NAME}_wuzapi-manager --filter desired-state=running --format '{{.CurrentState}}' | grep -q 'Failed'"
    else
        # Docker Compose services
        run_check "Docker Compose Service Running" \
            "docker-compose -f $PROJECT_ROOT/docker-compose.yml ps | grep -q 'Up'"
    fi
}

# Verificações de aplicação
check_application() {
    log_info "=== Verificações de Aplicação ==="
    
    # Verificar resposta da API de health
    run_check "Health API Response Format" \
        "curl -s http://$DOMAIN/health | jq -e '.status == \"healthy\"' > /dev/null 2>&1" \
        false
    
    # Verificar se a aplicação está servindo arquivos estáticos
    run_check "Static Files Serving" \
        "curl -f -s --max-time 10 http://$DOMAIN/ | grep -q '<title>'" \
        false
    
    # Verificar endpoint de métricas (se disponível)
    run_check "Metrics Endpoint" \
        "curl -f -s --max-time 10 http://$DOMAIN/metrics > /dev/null" \
        false
    
    # Verificar API endpoints principais
    run_check "API Base Endpoint" \
        "curl -f -s --max-time 10 http://$DOMAIN/api/health > /dev/null" \
        false
}

# Verificações de banco de dados
check_database() {
    log_info "=== Verificações de Banco de Dados ==="
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local container_id=$(docker ps --filter "name=${STACK_NAME}_wuzapi-manager" --format "{{.ID}}" | head -1)
        
        if [[ -n "$container_id" ]]; then
            # Verificar se o arquivo do banco existe
            run_check "Database File Exists" \
                "docker exec $container_id test -f /app/data/wuzapi.db"
            
            # Verificar se o banco está acessível
            run_check "Database Accessible" \
                "docker exec $container_id sqlite3 /app/data/wuzapi.db 'SELECT 1;' > /dev/null 2>&1"
            
            # Verificar integridade do banco
            run_check "Database Integrity" \
                "docker exec $container_id sqlite3 /app/data/wuzapi.db 'PRAGMA integrity_check;' | grep -q 'ok'" \
                false
            
            # Verificar espaço em disco
            run_check "Sufficient Disk Space" \
                "docker exec $container_id df /app/data | awk 'NR==2 {print \$5}' | sed 's/%//' | awk '{if(\$1 < 90) exit 0; else exit 1}'"
        else
            log_warning "Container não encontrado para verificações de banco"
        fi
    fi
}

# Verificações de performance
check_performance() {
    log_info "=== Verificações de Performance ==="
    
    # Verificar tempo de resposta médio
    local response_times=()
    for i in {1..5}; do
        local start_time=$(date +%s%N)
        if curl -f -s --max-time 10 "http://$DOMAIN/health" > /dev/null; then
            local end_time=$(date +%s%N)
            local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
            response_times+=($response_time)
        fi
        sleep 1
    done
    
    if [[ ${#response_times[@]} -gt 0 ]]; then
        local total=0
        for time in "${response_times[@]}"; do
            total=$((total + time))
        done
        local avg_response_time=$((total / ${#response_times[@]}))
        
        run_check "Average Response Time < 2000ms (${avg_response_time}ms)" \
            "[[ $avg_response_time -lt 2000 ]]" \
            false
    fi
    
    # Verificar uso de memória (se possível)
    if [[ "$ENVIRONMENT" == "production" ]]; then
        local container_id=$(docker ps --filter "name=${STACK_NAME}_wuzapi-manager" --format "{{.ID}}" | head -1)
        if [[ -n "$container_id" ]]; then
            run_check "Memory Usage < 80%" \
                "docker stats --no-stream --format '{{.MemPerc}}' $container_id | sed 's/%//' | awk '{if(\$1 < 80) exit 0; else exit 1}'" \
                false
        fi
    fi
}

# Verificações de segurança
check_security() {
    log_info "=== Verificações de Segurança ==="
    
    # Verificar headers de segurança
    run_check "Security Headers Present" \
        "curl -I -s http://$DOMAIN/ | grep -q 'X-Frame-Options\\|X-Content-Type-Options'" \
        false
    
    # Verificar se não há informações sensíveis expostas
    run_check "No Sensitive Info in Headers" \
        "! curl -I -s http://$DOMAIN/ | grep -i 'server: \\|x-powered-by:'" \
        false
    
    # Para produção, verificar SSL
    if [[ "$ENVIRONMENT" == "production" ]]; then
        run_check "SSL Certificate Valid" \
            "curl -s --max-time 10 https://$DOMAIN/health > /dev/null" \
            false
        
        run_check "SSL Grade A or Better" \
            "timeout 30 curl -s 'https://api.ssllabs.com/api/v3/analyze?host=$DOMAIN&publish=off&all=done' | jq -r '.endpoints[0].grade' | grep -E '^(A\\+|A)$' > /dev/null" \
            false
    fi
}

# Verificações de logs
check_logs() {
    log_info "=== Verificações de Logs ==="
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        # Verificar logs recentes por erros críticos
        local recent_logs=$(docker service logs "$STACK_NAME"_wuzapi-manager --tail 100 2>/dev/null || echo "")
        
        run_check "No Critical Errors in Recent Logs" \
            "! echo '$recent_logs' | grep -i 'fatal\\|critical\\|emergency' > /dev/null" \
            false
        
        run_check "No Database Connection Errors" \
            "! echo '$recent_logs' | grep -i 'database.*error\\|connection.*failed' > /dev/null" \
            false
        
        # Verificar se há logs sendo gerados (aplicação ativa)
        run_check "Application Generating Logs" \
            "[[ -n '$recent_logs' ]]" \
            false
    fi
}

# Verificações de monitoramento
check_monitoring() {
    log_info "=== Verificações de Monitoramento ==="
    
    # Verificar se métricas estão sendo expostas
    run_check "Prometheus Metrics Available" \
        "curl -s http://$DOMAIN/metrics | grep -q 'nodejs_version_info'" \
        false
    
    # Verificar se health check está retornando dados úteis
    run_check "Health Check Returns Detailed Info" \
        "curl -s http://$DOMAIN/health | jq -e '.timestamp' > /dev/null 2>&1" \
        false
}

# Função para gerar relatório
generate_report() {
    echo
    log_info "=== RELATÓRIO FINAL ==="
    echo
    echo "Environment: $ENVIRONMENT"
    echo "Domain: $DOMAIN"
    echo "Timestamp: $(date)"
    echo
    echo "Resumo dos Checks:"
    echo "  Total: $TOTAL_CHECKS"
    echo "  Passou: $PASSED_CHECKS"
    echo "  Falhou: $FAILED_CHECKS"
    echo "  Avisos: $WARNING_CHECKS"
    echo
    
    local success_rate=$((PASSED_CHECKS * 100 / TOTAL_CHECKS))
    echo "Taxa de Sucesso: $success_rate%"
    echo
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        log_success "Todas as verificações críticas passaram!"
        if [[ $WARNING_CHECKS -gt 0 ]]; then
            log_warning "$WARNING_CHECKS verificações não-críticas falharam"
        fi
        return 0
    else
        log_error "$FAILED_CHECKS verificações críticas falharam"
        return 1
    fi
}

# Função principal
main() {
    log_info "=== WUZAPI Manager - Verificações Pós-Deploy ==="
    log_info "Environment: $ENVIRONMENT"
    log_info "Domain: $DOMAIN"
    echo
    
    # Executar todas as verificações
    check_connectivity
    echo
    check_services
    echo
    check_application
    echo
    check_database
    echo
    check_performance
    echo
    check_security
    echo
    check_logs
    echo
    check_monitoring
    
    # Gerar relatório final
    generate_report
}

# Função de ajuda
show_help() {
    echo "Uso: $0 [environment] [domain]"
    echo
    echo "Argumentos:"
    echo "  environment    Environment (development|staging|production)"
    echo "  domain         Domain para verificações (opcional)"
    echo
    echo "Exemplos:"
    echo "  $0 production"
    echo "  $0 staging staging.wuzapi.com"
    echo "  $0 development wuzapi.localhost"
}

# Verificar se foi solicitada ajuda
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    show_help
    exit 0
fi

# Executar função principal
main