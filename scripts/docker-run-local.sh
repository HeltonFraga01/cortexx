#!/bin/bash

# ============================================================================
# Docker Run Script - Local Testing
# ============================================================================
# Runs Docker container locally for testing authentication fixes
# Usage: ./scripts/docker-run-local.sh [tag]
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
CONTAINER_NAME="wuzapi-test"
HOST_PORT="3001"
CONTAINER_PORT="3001"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Docker Run Script - Local Testing${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# Step 1: Validate Prerequisites
# ============================================================================
echo -e "${YELLOW}[1/7] Validating prerequisites...${NC}"

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon is not running${NC}"
    exit 1
fi

# Check if image exists
if ! docker images | grep -q "${IMAGE_NAME}.*${TAG}"; then
    echo -e "${RED}❌ Image not found: ${FULL_IMAGE}${NC}"
    echo -e "${YELLOW}💡 Build the image first: ./scripts/docker-build-local.sh${NC}"
    exit 1
fi

# Check if .env.docker exists
if [ ! -f ".env.docker" ]; then
    echo -e "${RED}❌ .env.docker file not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites validated${NC}"
echo ""

# ============================================================================
# Step 2: Stop and remove existing container
# ============================================================================
echo -e "${YELLOW}[2/7] Cleaning up existing container...${NC}"

if docker ps -a | grep -q "${CONTAINER_NAME}"; then
    echo -e "${BLUE}   Stopping existing container...${NC}"
    docker stop "${CONTAINER_NAME}" 2>/dev/null || true
    
    echo -e "${BLUE}   Removing existing container...${NC}"
    docker rm "${CONTAINER_NAME}" 2>/dev/null || true
fi

echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# ============================================================================
# Step 3: Ensure data directory exists
# ============================================================================
echo -e "${YELLOW}[3/7] Preparing data directory...${NC}"

DATA_DIR="$(pwd)/data"
LOGS_DIR="$(pwd)/logs"

mkdir -p "${DATA_DIR}"
mkdir -p "${LOGS_DIR}"

echo -e "${BLUE}   Data directory: ${DATA_DIR}${NC}"
echo -e "${BLUE}   Logs directory: ${LOGS_DIR}${NC}"

echo -e "${GREEN}✅ Directories ready${NC}"
echo ""

# ============================================================================
# Step 4: Run Docker container
# ============================================================================
echo -e "${YELLOW}[4/7] Starting Docker container...${NC}"
echo -e "${BLUE}   Container: ${CONTAINER_NAME}${NC}"
echo -e "${BLUE}   Image: ${FULL_IMAGE}${NC}"
echo -e "${BLUE}   Port: ${HOST_PORT}:${CONTAINER_PORT}${NC}"
echo ""

docker run -d \
    --name "${CONTAINER_NAME}" \
    --env-file .env.docker \
    -p "${HOST_PORT}:${CONTAINER_PORT}" \
    -v "${DATA_DIR}:/app/data" \
    -v "${LOGS_DIR}:/app/logs" \
    --health-cmd="node server/healthcheck.js" \
    --health-interval=30s \
    --health-timeout=10s \
    --health-retries=3 \
    --health-start-period=60s \
    "${FULL_IMAGE}"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to start container${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Container started${NC}"
echo ""

# ============================================================================
# Step 5: Wait for container to be healthy
# ============================================================================
echo -e "${YELLOW}[5/7] Waiting for container to be healthy...${NC}"
echo -e "${BLUE}   This may take up to 60 seconds...${NC}"
echo ""

# Wait for container to start
sleep 5

# Check container status
CONTAINER_STATUS=$(docker inspect -f '{{.State.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "not found")

if [ "${CONTAINER_STATUS}" != "running" ]; then
    echo -e "${RED}❌ Container is not running (status: ${CONTAINER_STATUS})${NC}"
    echo -e "${YELLOW}💡 Check logs: docker logs ${CONTAINER_NAME}${NC}"
    exit 1
fi

# Wait for health check (max 90 seconds)
echo -e "${BLUE}   Waiting for health check...${NC}"
TIMEOUT=90
ELAPSED=0

while [ $ELAPSED -lt $TIMEOUT ]; do
    HEALTH_STATUS=$(docker inspect -f '{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "none")
    
    if [ "${HEALTH_STATUS}" = "healthy" ]; then
        echo -e "${GREEN}✅ Container is healthy${NC}"
        break
    elif [ "${HEALTH_STATUS}" = "unhealthy" ]; then
        echo -e "${RED}❌ Container is unhealthy${NC}"
        echo -e "${YELLOW}💡 Check logs: docker logs ${CONTAINER_NAME}${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}   Health status: ${HEALTH_STATUS} (${ELAPSED}s elapsed)${NC}"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo -e "${YELLOW}⚠️  Health check timeout (container may still be starting)${NC}"
fi

echo ""

# ============================================================================
# Step 6: Verify health endpoint
# ============================================================================
echo -e "${YELLOW}[6/7] Verifying health endpoint...${NC}"

# Wait a bit more for the server to be ready
sleep 3

# Test health endpoint
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "http://localhost:${HOST_PORT}/health" 2>/dev/null || echo "000")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "${HTTP_CODE}" = "200" ]; then
    echo -e "${GREEN}✅ Health endpoint responding (HTTP ${HTTP_CODE})${NC}"
    
    # Parse health response
    STATUS=$(echo "$HEALTH_BODY" | jq -r '.status' 2>/dev/null || echo "unknown")
    DB_STATUS=$(echo "$HEALTH_BODY" | jq -r '.database.status' 2>/dev/null || echo "unknown")
    WUZAPI_STATUS=$(echo "$HEALTH_BODY" | jq -r '.wuzapi.status' 2>/dev/null || echo "unknown")
    CONFIG_VALID=$(echo "$HEALTH_BODY" | jq -r '.configuration.valid' 2>/dev/null || echo "unknown")
    
    echo -e "${BLUE}   Overall status: ${STATUS}${NC}"
    echo -e "${BLUE}   Database: ${DB_STATUS}${NC}"
    echo -e "${BLUE}   WUZAPI: ${WUZAPI_STATUS}${NC}"
    echo -e "${BLUE}   Configuration: ${CONFIG_VALID}${NC}"
    
    if [ "${CONFIG_VALID}" != "true" ]; then
        echo -e "${YELLOW}⚠️  Configuration validation failed${NC}"
        CONFIG_ERRORS=$(echo "$HEALTH_BODY" | jq -r '.configuration.errors[]' 2>/dev/null || echo "")
        if [ -n "${CONFIG_ERRORS}" ]; then
            echo -e "${RED}   Errors:${NC}"
            echo "$CONFIG_ERRORS" | while read -r error; do
                echo -e "${RED}   - ${error}${NC}"
            done
        fi
    fi
else
    echo -e "${RED}❌ Health endpoint not responding (HTTP ${HTTP_CODE})${NC}"
    echo -e "${YELLOW}💡 Container may still be starting, check logs${NC}"
fi

echo ""

# ============================================================================
# Step 7: Display container info and next steps
# ============================================================================
echo -e "${YELLOW}[7/7] Container running!${NC}"
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}✅ Docker container is running: ${CONTAINER_NAME}${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Container Information:${NC}"
echo -e "${BLUE}  Name: ${CONTAINER_NAME}${NC}"
echo -e "${BLUE}  Image: ${FULL_IMAGE}${NC}"
echo -e "${BLUE}  Port: http://localhost:${HOST_PORT}${NC}"
echo -e "${BLUE}  Data: ${DATA_DIR}${NC}"
echo -e "${BLUE}  Logs: ${LOGS_DIR}${NC}"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo ""
echo -e "${BLUE}1. View logs:${NC}"
echo -e "   ${YELLOW}docker logs -f ${CONTAINER_NAME}${NC}"
echo ""
echo -e "${BLUE}2. Check health:${NC}"
echo -e "   ${YELLOW}curl http://localhost:${HOST_PORT}/health | jq .${NC}"
echo ""
echo -e "${BLUE}3. Test authentication (admin):${NC}"
echo -e "   ${YELLOW}curl -X POST http://localhost:${HOST_PORT}/api/auth/login \\${NC}"
echo -e "   ${YELLOW}  -H 'Content-Type: application/json' \\${NC}"
echo -e "   ${YELLOW}  -d '{\"token\": \"YOUR_ADMIN_TOKEN\", \"role\": \"admin\"}' | jq .${NC}"
echo ""
echo -e "${BLUE}4. Enter container:${NC}"
echo -e "   ${YELLOW}docker exec -it ${CONTAINER_NAME} sh${NC}"
echo ""
echo -e "${BLUE}5. View environment:${NC}"
echo -e "   ${YELLOW}docker exec ${CONTAINER_NAME} env | grep -E 'WUZAPI|SESSION|CORS'${NC}"
echo ""
echo -e "${BLUE}6. Stop container:${NC}"
echo -e "   ${YELLOW}docker stop ${CONTAINER_NAME}${NC}"
echo ""
echo -e "${BLUE}7. Remove container:${NC}"
echo -e "   ${YELLOW}docker rm ${CONTAINER_NAME}${NC}"
echo ""
echo -e "${BLUE}8. View container stats:${NC}"
echo -e "   ${YELLOW}docker stats ${CONTAINER_NAME}${NC}"
echo ""

# Show initial logs
echo -e "${BLUE}Initial logs (last 20 lines):${NC}"
echo -e "${BLUE}============================================================================${NC}"
docker logs --tail 20 "${CONTAINER_NAME}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

echo -e "${GREEN}🎉 Container is ready for testing!${NC}"
echo ""
