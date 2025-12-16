#!/bin/bash

# ============================================================================
# Docker Build Script - Local Testing
# ============================================================================
# Builds Docker image locally for testing authentication fixes
# Usage: ./scripts/docker-build-local.sh [tag]
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="wuzapi-manager"
TAG="${1:-local}"
FULL_IMAGE="${IMAGE_NAME}:${TAG}"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Docker Build Script - Local Testing${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Step 1: Validate Environment
# ============================================================================
echo -e "${YELLOW}[1/6] Validating environment...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo -e "${YELLOW}💡 Install Docker: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    echo -e "${YELLOW}💡 Start Docker Desktop or Docker daemon${NC}"
    exit 1
fi

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo -e "${RED}❌ .env.docker file not found${NC}"
    echo -e "${YELLOW}💡 Create .env.docker with required environment variables${NC}"
    echo -e "${YELLOW}💡 See .env.docker.example for reference${NC}"
    exit 1
fi

# Validate required variables in .env.docker
echo -e "${BLUE}   Checking required environment variables...${NC}"
REQUIRED_VARS=("WUZAPI_BASE_URL" "CORS_ORIGINS" "SESSION_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${var}=" .env.docker; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${RED}❌ Missing required variables in .env.docker:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${RED}   - ${var}${NC}"
    done
    exit 1
fi

echo -e "${GREEN}✅ Environment validation passed${NC}"
echo ""

# ============================================================================
# Step 2: Check Dockerfile
# ============================================================================
echo -e "${YELLOW}[2/6] Checking Dockerfile...${NC}"

if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Dockerfile not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Dockerfile found${NC}"
echo ""

# ============================================================================
# Step 3: Clean previous builds (optional)
# ============================================================================
echo -e "${YELLOW}[3/6] Cleaning previous builds...${NC}"

# Remove old image if exists
if docker images | grep -q "${IMAGE_NAME}.*${TAG}"; then
    echo -e "${BLUE}   Removing old image: ${FULL_IMAGE}${NC}"
    docker rmi "${FULL_IMAGE}" 2>/dev/null || true
fi

# Prune build cache (optional, uncomment if needed)
# docker builder prune -f

echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# ============================================================================
# Step 4: Build Docker image
# ============================================================================
echo -e "${YELLOW}[4/6] Building Docker image...${NC}"
echo -e "${BLUE}   Image: ${FULL_IMAGE}${NC}"
echo -e "${BLUE}   Platform: linux/amd64${NC}"
echo ""

# Build with progress output
docker build \
    --platform linux/amd64 \
    --tag "${FULL_IMAGE}" \
    --progress=plain \
    --no-cache \
    . 2>&1 | tee build.log

# Check if build succeeded
if [ ${PIPESTATUS[0]} -ne 0 ]; then
    echo -e "${RED}❌ Docker build failed${NC}"
    echo -e "${YELLOW}💡 Check build.log for details${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Docker image built successfully${NC}"
echo ""

# ============================================================================
# Step 5: Verify image
# ============================================================================
echo -e "${YELLOW}[5/6] Verifying image...${NC}"

# Check if image exists
if ! docker images | grep -q "${IMAGE_NAME}.*${TAG}"; then
    echo -e "${RED}❌ Image not found after build${NC}"
    exit 1
fi

# Get image size
IMAGE_SIZE=$(docker images "${FULL_IMAGE}" --format "{{.Size}}")
echo -e "${BLUE}   Image size: ${IMAGE_SIZE}${NC}"

# Get image ID
IMAGE_ID=$(docker images "${FULL_IMAGE}" --format "{{.ID}}")
echo -e "${BLUE}   Image ID: ${IMAGE_ID}${NC}"

echo -e "${GREEN}✅ Image verification passed${NC}"
echo ""

# ============================================================================
# Step 6: Display next steps
# ============================================================================
echo -e "${YELLOW}[6/6] Build complete!${NC}"
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}✅ Docker image built successfully: ${FULL_IMAGE}${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "${BLUE}1. Run the container:${NC}"
echo -e "   ${YELLOW}./scripts/docker-run-local.sh${NC}"
echo ""
echo -e "${BLUE}2. Or run manually:${NC}"
echo -e "   ${YELLOW}docker run -d --name wuzapi-test \\${NC}"
echo -e "   ${YELLOW}  --env-file .env.docker \\${NC}"
echo -e "   ${YELLOW}  -p 3001:3001 \\${NC}"
echo -e "   ${YELLOW}  -v \$(pwd)/data:/app/data \\${NC}"
echo -e "   ${YELLOW}  ${FULL_IMAGE}${NC}"
echo ""
echo -e "${BLUE}3. Check health:${NC}"
echo -e "   ${YELLOW}curl http://localhost:3001/health | jq .${NC}"
echo ""
echo -e "${BLUE}4. View logs:${NC}"
echo -e "   ${YELLOW}docker logs -f wuzapi-test${NC}"
echo ""
echo -e "${BLUE}5. Stop container:${NC}"
echo -e "   ${YELLOW}docker stop wuzapi-test && docker rm wuzapi-test${NC}"
echo ""

# Save build info
cat > build-info.txt <<EOF
Build Information
=================
Image: ${FULL_IMAGE}
Image ID: ${IMAGE_ID}
Size: ${IMAGE_SIZE}
Built: $(date)
Platform: linux/amd64

Environment Variables:
$(grep -v "^#" .env.docker | grep -v "^$" | sed 's/=.*/=***/')

Next Steps:
1. Run: ./scripts/docker-run-local.sh
2. Test: curl http://localhost:3001/health
3. Logs: docker logs -f wuzapi-test
EOF

echo -e "${GREEN}📝 Build info saved to: build-info.txt${NC}"
echo ""
