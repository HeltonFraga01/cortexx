#!/bin/bash

# Script de build e deploy multi-arquitetura para WUZAPI Manager
# Uso: ./deploy-multiarch.sh [version]
# Exemplo: ./deploy-multiarch.sh v1.3.1

set -e

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configurações
IMAGE_NAME="heltonfraga/cortexx"
VERSION=${1:-$(node -p "require('./package.json').version")}
PLATFORMS="linux/amd64,linux/arm64"

# Supabase configuration for frontend build (PRODUCTION)
VITE_SUPABASE_URL="https://bdhkfyvyvgfdukdodddr.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkaGtmeXZ5dmdmZHVrZG9kZGRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MTE2NDYsImV4cCI6MjA4MTM4NzY0Nn0.6ekEVkvP-HADksTzvr5YxXxxXpdDPJJKd4vV98VhBmU"

log_info "=== WUZAPI Manager Multi-Arch Build ==="
log_info "Image: $IMAGE_NAME"
log_info "Version: $VERSION"
log_info "Platforms: $PLATFORMS"
echo

# Verificar pré-requisitos
log_info "Verificando pré-requisitos..."

if ! command -v docker &> /dev/null; then
    log_error "Docker não está instalado"
    exit 1
fi

if ! docker buildx version &> /dev/null; then
    log_error "Docker Buildx não está disponível"
    exit 1
fi

# Verificar se o builder existe, senão criar
if ! docker buildx inspect multiarch-builder &> /dev/null; then
    log_info "Criando builder multi-arquitetura..."
    docker buildx create --name multiarch-builder --use --platform $PLATFORMS
    docker buildx inspect --bootstrap
else
    log_info "Usando builder existente: multiarch-builder"
    docker buildx use multiarch-builder
fi

log_success "Pré-requisitos verificados"

# Verificar se há mudanças não commitadas
if [[ -n $(git status -s) ]]; then
    log_warning "Há mudanças não commitadas no repositório"
    read -p "Deseja continuar? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Build cancelado"
        exit 0
    fi
fi

# Build da imagem
log_info "Iniciando build multi-arquitetura..."
log_info "Isso pode levar alguns minutos..."

# Opção 1: Build com push otimizado (com retry e limite de concorrência)
# Se o push travar, use a Opção 2 abaixo

# Build + Push multi-arch
log_info "Iniciando build multi-arch com push..."

# Primeiro, garantir login no Docker Hub
log_info "Verificando autenticação no Docker Hub..."
if ! docker info 2>/dev/null | grep -q "Username"; then
    log_warning "Não autenticado no Docker Hub. Execute: docker login"
fi

# Build e push direto (única forma de fazer multi-arch)
docker buildx build \
    --platform $PLATFORMS \
    --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
    --tag $IMAGE_NAME:$VERSION \
    --tag $IMAGE_NAME:latest \
    --provenance=false \
    --sbom=false \
    --push \
    . || {
    log_error "Falha no build/push"
    exit 1
}

log_success "Build concluído com sucesso!"

# Verificar imagens no registry
log_info "Verificando imagens no Docker Hub..."
sleep 5

for platform in "amd64" "arm64"; do
    log_info "Verificando plataforma: linux/$platform"
    if docker manifest inspect $IMAGE_NAME:$VERSION | grep -q "linux/$platform"; then
        log_success "✓ Imagem linux/$platform disponível"
    else
        log_error "✗ Imagem linux/$platform não encontrada"
        exit 1
    fi
done

# Exibir informações da imagem
log_info ""
log_info "=== Informações da Imagem ==="
docker manifest inspect $IMAGE_NAME:$VERSION | grep -E "architecture|os" | head -4

log_info ""
log_success "=== Deploy Concluído ==="
log_info "Imagem publicada: $IMAGE_NAME:$VERSION"
log_info "Imagem latest: $IMAGE_NAME:latest"
log_info ""
log_info "Para fazer deploy no Docker Swarm:"
log_info "  docker service update --image $IMAGE_NAME:$VERSION wuzapi-manager_wuzapi-manager"
log_info ""
log_info "Ou usar o script de deploy:"
log_info "  npm run deploy:production"
