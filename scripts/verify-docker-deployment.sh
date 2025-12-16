#!/bin/bash

# ============================================================================
# Docker Deployment Verification Script
# ============================================================================
# Verifies Docker deployment health and functionality
# Usage: ./scripts/verify-docker-deployment.sh [host]
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
HOST="${1:-localhost:3001}"
ADMIN_TOKEN="${WUZAPI_ADMIN_TOKEN:-UeH7cZ2c1K3zVUBFi7SginSC}"

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Docker Deployment Verification${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}Host: ${HOST}${NC}"
echo ""

# Test 1: Health Check
echo -e "${YELLOW}[1/5] Testing health endpoint...${NC}"
HEALTH_RESPONSE=$(curl -s "http://${HOST}/health")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.status' 2>/dev/null || echo "error")

if [ "$HEALTH_STATUS" = "ok" ]; then
    echo -e "${GREEN}✅ Health check passed${NC}"
    echo "$HEALTH_RESPONSE" | jq '{status, configuration: .configuration.valid, database: .database.status, wuzapi: .wuzapi.status}'
else
    echo -e "${RED}❌ Health check failed${NC}"
    echo "$HEALTH_RESPONSE"
    exit 1
fi
echo ""

# Test 2: Authentication
echo -e "${YELLOW}[2/5] Testing authentication...${NC}"
AUTH_RESPONSE=$(curl -s -X POST "http://${HOST}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"token\": \"${ADMIN_TOKEN}\", \"role\": \"admin\"}")
AUTH_SUCCESS=$(echo "$AUTH_RESPONSE" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$AUTH_SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Authentication working${NC}"
else
    echo -e "${RED}❌ Authentication failed${NC}"
    echo "$AUTH_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Database
echo -e "${YELLOW}[3/5] Testing database...${NC}"
DB_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.database.status')
if [ "$DB_STATUS" = "connected" ]; then
    echo -e "${GREEN}✅ Database connected${NC}"
else
    echo -e "${RED}❌ Database not connected${NC}"
    exit 1
fi
echo ""

# Test 4: WUZAPI Connectivity
echo -e "${YELLOW}[4/5] Testing WUZAPI connectivity...${NC}"
WUZAPI_STATUS=$(echo "$HEALTH_RESPONSE" | jq -r '.wuzapi.status')
if [ "$WUZAPI_STATUS" = "connected" ]; then
    echo -e "${GREEN}✅ WUZAPI connected${NC}"
else
    echo -e "${YELLOW}⚠️  WUZAPI not connected${NC}"
fi
echo ""

# Test 5: Configuration
echo -e "${YELLOW}[5/5] Testing configuration...${NC}"
CONFIG_VALID=$(echo "$HEALTH_RESPONSE" | jq -r '.configuration.valid')
if [ "$CONFIG_VALID" = "true" ]; then
    echo -e "${GREEN}✅ Configuration valid${NC}"
else
    echo -e "${RED}❌ Configuration invalid${NC}"
    echo "$HEALTH_RESPONSE" | jq '.configuration.errors'
    exit 1
fi
echo ""

# Summary
echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}✅ All verification tests passed!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}Deployment is healthy and ready for use.${NC}"
