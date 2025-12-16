#!/bin/bash

# ============================================================================
# Docker Build Script - Production Multi-Architecture
# ============================================================================
# Builds Docker image for production with multi-arch support
# Usage: ./scripts/docker-build-production.sh [version]
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
IMAGE_NAME="heltonfraga/wuzapi-manager"
VERSION="${1:-latest}"
PLATFORMS="linux/amd64,linux/arm64"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Docker Production Build - Multi-Architecture${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""
echo -e "${BLUE}Image: ${IMAGE_NAME}:${VERSION}${NC}"
echo -e "${BLUE}Platforms: ${PLATFORMS}${NC}"
echo ""

# Validate buildx
if ! docker buildx version &> /dev/null; then
    echo -e "${RED}❌ docker buildx not available${NC}"
    exit 1
fi

# Create/use buildx builder
if ! docker buildx inspect multiarch-builder &> /dev/null; then
    echo -e "${YELLOW}Creating buildx builder...${NC}"
    docker buildx create --name multiarch-builder --use
fi

docker buildx use multiarch-builder

# Build and push
echo -e "${YELLOW}Building multi-architecture image...${NC}"
docker buildx build \
    --platform ${PLATFORMS} \
    --tag ${IMAGE_NAME}:${VERSION} \
    --tag ${IMAGE_NAME}:latest \
    --push \
    --progress=plain \
    .

echo -e "${GREEN}✅ Production image built and pushed successfully${NC}"
echo -e "${GREEN}   ${IMAGE_NAME}:${VERSION}${NC}"
echo -e "${GREEN}   ${IMAGE_NAME}:latest${NC}"
