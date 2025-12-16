#!/bin/bash

# Quick Security Audit Script
# Runs essential security checks without generating detailed reports

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Running Quick Security Audit...${NC}\n"

ISSUES=0

# 1. Quick ESLint check
echo -n "Frontend security lint... "
if npm run lint:security --silent 2>&1 | grep -q "error\|warning"; then
    echo -e "${YELLOW}WARNINGS${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 2. Quick npm audit
echo -n "Frontend dependencies... "
AUDIT_OUTPUT=$(npm audit --audit-level=high --json 2>&1 || true)
VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
if [ -z "$VULN_COUNT" ]; then
    VULN_COUNT=0
fi
if [ "$VULN_COUNT" -gt 0 ]; then
    echo -e "${RED}$VULN_COUNT HIGH+ VULNERABILITIES${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 3. Backend ESLint
echo -n "Backend security lint... "
if (cd server && npm run lint:security --silent 2>&1) | grep -q "error\|warning"; then
    echo -e "${YELLOW}WARNINGS${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 4. Backend npm audit
echo -n "Backend dependencies... "
BACKEND_AUDIT=$(cd server && npm audit --audit-level=high --json 2>&1 || true)
BACKEND_VULN=$(echo "$BACKEND_AUDIT" | grep -o '"high":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0")
if [ -z "$BACKEND_VULN" ]; then
    BACKEND_VULN=0
fi
if [ "$BACKEND_VULN" -gt 0 ]; then
    echo -e "${RED}$BACKEND_VULN HIGH+ VULNERABILITIES${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# 5. Quick secrets check
echo -n "Hardcoded secrets... "
if grep -r -E "(password|secret|token|api[_-]?key)\s*[:=]\s*['\"][^'\"]{10,}" \
    --include="*.js" --include="*.ts" \
    --exclude-dir=node_modules --exclude-dir=dist \
    src/ server/ > /dev/null 2>&1; then
    echo -e "${RED}FOUND${NC}"
    ISSUES=$((ISSUES + 1))
else
    echo -e "${GREEN}OK${NC}"
fi

# Summary
echo ""
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✓ Quick security audit passed${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Found $ISSUES issue(s) - run 'npm run security:scan' for details${NC}"
    exit 1
fi
