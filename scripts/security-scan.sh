#!/bin/bash

# Security Scan Script for WuzAPI Dashboard
# This script runs comprehensive security analysis across frontend and backend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SEVERITY_THRESHOLD="${SEVERITY_THRESHOLD:-moderate}"
REPORT_DIR="security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create report directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WuzAPI Dashboard Security Scan${NC}"
echo -e "${BLUE}  Started: $(date)${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Track overall status
OVERALL_STATUS=0

# Function to print section header
print_header() {
    echo -e "\n${BLUE}>>> $1${NC}\n"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. Frontend Security Scan
print_header "1. Frontend Security Analysis"

echo "Running ESLint security checks on frontend..."
if npm run lint:security > "$REPORT_DIR/frontend-eslint-$TIMESTAMP.log" 2>&1; then
    print_success "Frontend ESLint security scan passed"
else
    print_warning "Frontend ESLint found issues (see $REPORT_DIR/frontend-eslint-$TIMESTAMP.log)"
    OVERALL_STATUS=1
fi

echo "Running npm audit on frontend dependencies..."
if npm audit --audit-level="$SEVERITY_THRESHOLD" --json > "$REPORT_DIR/frontend-audit-$TIMESTAMP.json" 2>&1; then
    print_success "Frontend npm audit passed"
else
    print_error "Frontend npm audit found vulnerabilities (see $REPORT_DIR/frontend-audit-$TIMESTAMP.json)"
    OVERALL_STATUS=1
fi

# 2. Backend Security Scan
print_header "2. Backend Security Analysis"

echo "Running ESLint security checks on backend..."
if (cd server && npm run lint:security > "../$REPORT_DIR/backend-eslint-$TIMESTAMP.log" 2>&1); then
    print_success "Backend ESLint security scan passed"
else
    print_warning "Backend ESLint found issues (see $REPORT_DIR/backend-eslint-$TIMESTAMP.log)"
    OVERALL_STATUS=1
fi

echo "Running npm audit on backend dependencies..."
if (cd server && npm audit --audit-level="$SEVERITY_THRESHOLD" --json > "../$REPORT_DIR/backend-audit-$TIMESTAMP.json" 2>&1); then
    print_success "Backend npm audit passed"
else
    print_error "Backend npm audit found vulnerabilities (see $REPORT_DIR/backend-audit-$TIMESTAMP.json)"
    OVERALL_STATUS=1
fi

# 3. Secrets Detection
print_header "3. Secrets Detection"

echo "Scanning for hardcoded secrets in codebase..."
SECRETS_FOUND=0

# Scan for common secret patterns
if grep -r -n -E "(password|passwd|pwd|secret|token|api[_-]?key|private[_-]?key|access[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}" \
    --include="*.js" --include="*.ts" --include="*.tsx" --include="*.jsx" \
    --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git \
    src/ server/ > "$REPORT_DIR/secrets-scan-$TIMESTAMP.log" 2>&1; then
    print_error "Potential hardcoded secrets found (see $REPORT_DIR/secrets-scan-$TIMESTAMP.log)"
    SECRETS_FOUND=1
    OVERALL_STATUS=1
else
    print_success "No obvious hardcoded secrets detected"
fi

# 4. Configuration Security Check
print_header "4. Configuration Security Check"

echo "Checking for insecure configurations..."
CONFIG_ISSUES=0

# Check for permissive CORS
if grep -r "origin.*\*" server/ --include="*.js" > /dev/null 2>&1; then
    print_warning "Permissive CORS configuration detected (origin: '*')"
    CONFIG_ISSUES=1
fi

# Check for disabled security features
if grep -r "helmet.*false\|csrf.*false" server/ --include="*.js" > /dev/null 2>&1; then
    print_warning "Disabled security features detected"
    CONFIG_ISSUES=1
fi

# Check for weak bcrypt rounds
if grep -r "bcrypt.*hash.*[0-9]" server/ --include="*.js" | grep -E "bcrypt.*hash.*[0-9]" | grep -v -E "1[0-9]|[2-9][0-9]" > /dev/null 2>&1; then
    print_warning "Potentially weak bcrypt salt rounds detected"
    CONFIG_ISSUES=1
fi

if [ $CONFIG_ISSUES -eq 0 ]; then
    print_success "Configuration security checks passed"
else
    print_warning "Configuration security issues detected"
    OVERALL_STATUS=1
fi

# 5. Docker Security Check
print_header "5. Docker Security Check"

echo "Checking Docker configurations..."
DOCKER_ISSUES=0

# Check if containers run as root
if grep -E "^USER root|^USER 0" Dockerfile* > /dev/null 2>&1; then
    print_warning "Containers may be running as root user"
    DOCKER_ISSUES=1
fi

# Check for exposed sensitive ports
if grep -E "EXPOSE.*(22|3306|5432|27017|6379)" Dockerfile* > /dev/null 2>&1; then
    print_warning "Sensitive ports may be exposed in Docker configuration"
    DOCKER_ISSUES=1
fi

if [ $DOCKER_ISSUES -eq 0 ]; then
    print_success "Docker security checks passed"
else
    print_warning "Docker security issues detected"
fi

# 6. Environment Variables Check
print_header "6. Environment Variables Security"

echo "Checking environment variable handling..."
ENV_ISSUES=0

# Check if .env files are in .gitignore
if ! grep -q "^\.env$" .gitignore 2>/dev/null; then
    print_error ".env file not properly ignored in .gitignore"
    ENV_ISSUES=1
    OVERALL_STATUS=1
fi

# Check for .env files with sensitive data in git
if git ls-files | grep -E "\.env$" > /dev/null 2>&1; then
    print_error ".env files are tracked in git"
    ENV_ISSUES=1
    OVERALL_STATUS=1
fi

if [ $ENV_ISSUES -eq 0 ]; then
    print_success "Environment variable security checks passed"
fi

# Generate Summary Report
print_header "Security Scan Summary"

cat > "$REPORT_DIR/summary-$TIMESTAMP.txt" << EOF
WuzAPI Dashboard Security Scan Summary
Generated: $(date)
Severity Threshold: $SEVERITY_THRESHOLD

Reports Generated:
- Frontend ESLint: $REPORT_DIR/frontend-eslint-$TIMESTAMP.log
- Frontend Audit: $REPORT_DIR/frontend-audit-$TIMESTAMP.json
- Backend ESLint: $REPORT_DIR/backend-eslint-$TIMESTAMP.log
- Backend Audit: $REPORT_DIR/backend-audit-$TIMESTAMP.json
- Secrets Scan: $REPORT_DIR/secrets-scan-$TIMESTAMP.log

Overall Status: $([ $OVERALL_STATUS -eq 0 ] && echo "PASSED" || echo "ISSUES FOUND")
EOF

echo -e "\n${BLUE}========================================${NC}"
if [ $OVERALL_STATUS -eq 0 ]; then
    print_success "Security scan completed successfully!"
    echo -e "${GREEN}No critical security issues detected.${NC}"
else
    print_warning "Security scan completed with issues"
    echo -e "${YELLOW}Please review the reports in $REPORT_DIR/${NC}"
fi
echo -e "${BLUE}========================================${NC}\n"

echo "Summary report: $REPORT_DIR/summary-$TIMESTAMP.txt"

exit $OVERALL_STATUS
