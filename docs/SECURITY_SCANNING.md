# Security Scanning Guide

This document describes the automated security analysis tools configured for the WuzAPI Dashboard project.

## Overview

The project includes comprehensive security scanning tools that analyze both frontend and backend code for:
- Security vulnerabilities in dependencies
- Hardcoded secrets and credentials
- Insecure coding patterns
- Configuration security issues
- Docker security concerns

## Tools Installed

### ESLint Security Plugins

1. **eslint-plugin-security**: Detects common security issues in JavaScript/TypeScript code
   - Object injection vulnerabilities
   - Unsafe regular expressions
   - Eval usage
   - Child process execution
   - Non-literal file system operations
   - Timing attack vulnerabilities

2. **eslint-plugin-no-secrets**: Scans for hardcoded secrets, API keys, and credentials
   - High entropy string detection
   - Pattern matching for common secret formats
   - Configurable tolerance levels

### NPM Audit

Configured to check for known vulnerabilities in dependencies with appropriate severity thresholds.

## Available Commands

### Frontend Security

```bash
# Run ESLint security checks on frontend
npm run lint:security

# Run npm audit on frontend dependencies
npm run audit:security
```

### Backend Security

```bash
# Run ESLint security checks on backend
cd server && npm run lint:security

# Run npm audit on backend dependencies
cd server && npm run audit:security
```

### Comprehensive Security Scan

```bash
# Run full security scan (frontend + backend + configuration)
npm run security:scan

# This generates detailed reports in security-reports/ directory
```

### Quick Security Check

```bash
# Run quick security audit (no detailed reports)
npm run security:quick

# Useful for pre-commit checks or CI/CD pipelines
```

## Security Scan Script

The `scripts/security-scan.sh` script performs:

1. **Frontend Security Analysis**
   - ESLint security rules check
   - npm audit for vulnerable dependencies
   
2. **Backend Security Analysis**
   - ESLint security rules check
   - npm audit for vulnerable dependencies

3. **Secrets Detection**
   - Scans for hardcoded passwords, tokens, API keys
   - Pattern matching for common secret formats

4. **Configuration Security Check**
   - Permissive CORS configuration
   - Disabled security features
   - Weak bcrypt salt rounds

5. **Docker Security Check**
   - Containers running as root
   - Exposed sensitive ports

6. **Environment Variables Security**
   - .env files in .gitignore
   - .env files tracked in git

### Report Generation

All scans generate timestamped reports in `security-reports/`:
- `frontend-eslint-TIMESTAMP.log` - Frontend ESLint results
- `frontend-audit-TIMESTAMP.json` - Frontend npm audit results
- `backend-eslint-TIMESTAMP.log` - Backend ESLint results
- `backend-audit-TIMESTAMP.json` - Backend npm audit results
- `secrets-scan-TIMESTAMP.log` - Hardcoded secrets scan
- `summary-TIMESTAMP.txt` - Overall summary

## Configuration

### Severity Thresholds

Default severity threshold is `moderate`. You can customize it:

```bash
# Run with high severity threshold only
SEVERITY_THRESHOLD=high npm run security:scan

# Run with all severities
SEVERITY_THRESHOLD=low npm run security:scan
```

### ESLint Security Rules

Frontend configuration (`eslint.config.js`):
```javascript
"security/detect-object-injection": "warn",
"security/detect-unsafe-regex": "error",
"security/detect-eval-with-expression": "error",
"no-secrets/no-secrets": ["error", { "tolerance": 4.5 }],
// ... more rules
```

Backend configuration (`server/eslint.config.js`):
- Same security rules applied to Node.js backend code

### Customizing Rules

To adjust security rules:

1. Edit `eslint.config.js` (frontend) or `server/eslint.config.js` (backend)
2. Change rule severity: `"error"`, `"warn"`, or `"off"`
3. Adjust no-secrets tolerance (higher = less sensitive)

## Integration with CI/CD

### Pre-commit Hook

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/bash
npm run security:quick
```

### GitHub Actions

```yaml
- name: Security Scan
  run: npm run security:scan
  
- name: Upload Security Reports
  uses: actions/upload-artifact@v2
  with:
    name: security-reports
    path: security-reports/
```

### Docker Build

Add to Dockerfile:
```dockerfile
RUN npm run security:quick
```

## Common Issues and Fixes

### False Positives

If ESLint reports false positives:

```javascript
// Disable specific rule for one line
// eslint-disable-next-line security/detect-object-injection
const value = obj[key];

// Disable for entire file (use sparingly)
/* eslint-disable security/detect-object-injection */
```

### Dependency Vulnerabilities

```bash
# Try automatic fix
npm audit fix

# Force update (may break compatibility)
npm audit fix --force

# Manual update
npm update <package-name>
```

### Secrets Detection

If legitimate code triggers secrets detection:

1. Ensure it's not actually a secret
2. Use environment variables instead
3. Add exception comment if necessary:
```javascript
// eslint-disable-next-line no-secrets/no-secrets
const exampleToken = "this-is-just-an-example-not-real";
```

## Best Practices

1. **Run security scans regularly**
   - Before each deployment
   - After adding new dependencies
   - Weekly scheduled scans

2. **Address critical and high severity issues immediately**
   - Review security-reports/ after each scan
   - Prioritize fixes based on severity

3. **Keep dependencies updated**
   - Regular `npm update` runs
   - Monitor security advisories

4. **Never commit secrets**
   - Use environment variables
   - Use secret management tools
   - Review .gitignore regularly

5. **Review security warnings**
   - Not all warnings are false positives
   - Understand the risk before disabling rules

## Troubleshooting

### Script Permission Denied

```bash
chmod +x scripts/security-scan.sh
chmod +x scripts/security-audit-quick.sh
```

### ESLint Plugin Errors

```bash
# Reinstall plugins
npm install --save-dev eslint-plugin-security eslint-plugin-no-secrets
cd server && npm install --save-dev eslint-plugin-security eslint-plugin-no-secrets
```

### Reports Directory Not Created

The script automatically creates `security-reports/` directory. If issues persist:
```bash
mkdir -p security-reports
```

## Additional Resources

- [ESLint Security Plugin](https://github.com/eslint-community/eslint-plugin-security)
- [ESLint No Secrets Plugin](https://github.com/nickdeis/eslint-plugin-no-secrets)
- [NPM Audit Documentation](https://docs.npmjs.com/cli/v8/commands/npm-audit)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## Support

For security concerns or questions:
1. Review this documentation
2. Check security-reports/ for details
3. Consult the development team
4. Follow responsible disclosure for vulnerabilities
