#!/bin/bash

# Script otimizado para build Docker do WUZAPI Manager
# Uso: ./scripts/docker-build.sh [tag] [--push]

set -e

# Configurações
IMAGE_NAME="heltonfraga/wuzapi-manager"
DEFAULT_TAG="v1.5.7"
DOCKERFILE="Dockerfile"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funções auxiliares
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
TAG=${1:-$DEFAULT_TAG}
PUSH_IMAGE=false

if [[ "$2" == "--push" ]] || [[ "$1" == "--push" ]]; then
    PUSH_IMAGE=true
    if [[ "$1" == "--push" ]]; then
        TAG=$DEFAULT_TAG
    fi
fi

# Verificar se Docker está rodando
if ! docker info > /dev/null 2>&1; then
    log_error "Docker não está rodando ou não está acessível"
    exit 1
fi

# Verificar se estamos no diretório correto
if [[ ! -f "$DOCKERFILE" ]]; then
    log_error "Dockerfile não encontrado. Execute este script da raiz do projeto."
    exit 1
fi

log_info "Iniciando build da imagem Docker..."
log_info "Imagem: $IMAGE_NAME:$TAG"
log_info "Dockerfile: $DOCKERFILE"

# Limpar builds anteriores (opcional)
log_info "Limpando imagens antigas..."
docker image prune -f > /dev/null 2>&1 || true

# Build com cache otimizado
log_info "Executando build Docker..."

# Usar BuildKit para builds mais rápidos
export DOCKER_BUILDKIT=1

# Build da imagem com cache layers otimizado
docker build \
    --tag "$IMAGE_NAME:$TAG" \
    --tag "$IMAGE_NAME:latest" \
    --file "$DOCKERFILE" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    --cache-from "$IMAGE_NAME:latest" \
    --progress=plain \
    .

if [[ $? -eq 0 ]]; then
    log_success "Build concluído com sucesso!"
    
    # Mostrar informações da imagem
    log_info "Informações da imagem:"
    docker images "$IMAGE_NAME:$TAG" --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    
    # Verificar health check
    log_info "Testando health check da imagem..."
    CONTAINER_ID=$(docker run -d --rm -p 3001:3001 "$IMAGE_NAME:$TAG")
    
    # Aguardar container inicializar
    sleep 30
    
    # Testar health check
    if docker exec "$CONTAINER_ID" node server/healthcheck.js; then
        log_success "Health check passou!"
    else
        log_warning "Health check falhou, mas a imagem foi criada"
    fi
    
    # Parar container de teste
    docker stop "$CONTAINER_ID" > /dev/null 2>&1 || true
    
    # Push para registry se solicitado
    if [[ "$PUSH_IMAGE" == true ]]; then
        log_info "Fazendo push da imagem para o registry..."
        
        # Login no Docker Hub (se necessário)
        if ! docker info | grep -q "Username:"; then
            log_warning "Não logado no Docker Hub. Execute: docker login"
            read -p "Deseja continuar com o push? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_info "Push cancelado pelo usuário"
                exit 0
            fi
        fi
        
        # Push das tags
        docker push "$IMAGE_NAME:$TAG"
        docker push "$IMAGE_NAME:latest"
        
        if [[ $? -eq 0 ]]; then
            log_success "Push concluído com sucesso!"
            log_info "Imagem disponível em: $IMAGE_NAME:$TAG"
        else
            log_error "Falha no push da imagem"
            exit 1
        fi
    fi
    
    # Mostrar comandos úteis
    echo
    log_info "Comandos úteis:"
    echo "  Executar localmente:"
    echo "    docker run -p 3001:3001 --env-file server/.env $IMAGE_NAME:$TAG"
    echo
    echo "  Executar com docker-compose:"
    echo "    docker-compose up -d"
    echo
    echo "  Deploy no Swarm:"
    echo "    docker stack deploy -c docker-swarm-stack.yml wuzapi"
    echo
    
else
    log_error "Falha no build da imagem Docker"
    exit 1
fi

log_success "Script concluído!"