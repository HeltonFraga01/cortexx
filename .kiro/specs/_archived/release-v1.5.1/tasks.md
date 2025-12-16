# Implementation Plan - Release v1.5.1

## Overview
This implementation plan covers the preparation and publication of v1.5.1 to Docker Hub. The version is already updated in the root package.json (1.5.1), but the server package.json needs updating. All documentation and deployment steps need to be completed.

---

## Tasks

- [x] 1. Update version numbers
  - Root package.json is already at v1.5.1
  - Server package.json needs update from 1.5.0 to 1.5.1
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Create release notes documentation
  - Create `docs/releases/RELEASE_NOTES_v1.5.1.md` following the format from v1.4.9
  - Document Docker authentication fixes as main changes
  - Include technical improvements (environment validation, logging, health checks)
  - Document new files created (environmentValidator.js, wuzapiConnectivityChecker.js, etc.)
  - Include migration information (100% compatible with v1.5.0)
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3. Create deployment guide
  - Create `DEPLOY_v1.5.1.md` in project root following the format from DEPLOY_v1.4.9.md
  - Include pre-requisites checklist
  - Include multi-arch build commands using existing deploy-multiarch.sh script
  - Include Docker Hub push verification steps
  - Include post-deploy verification commands
  - Include troubleshooting section
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Commit and tag the release
  - Commit all changes with conventional commit message
  - Create git tag v1.5.1 with release description
  - Push commits and tags to remote repository
  - _Requirements: Prerequisite for 4.1-4.5_

- [x] 5. Build and push Docker images
  - Execute `./deploy-multiarch.sh v1.5.1` to build multi-arch images
  - Script will automatically build for linux/amd64 and linux/arm64
  - Script will automatically push to Docker Hub with tags v1.5.1 and latest
  - Script will verify images are available in registry
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_

- [x] 6. Verify published images
  - Pull the published image from Docker Hub
  - Run a test container with required environment variables
  - Verify health check endpoint returns 200 OK
  - Verify reported version is 1.5.1
  - Verify authentication works correctly
  - Clean up test resources
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

---

## Notes

- The deploy-multiarch.sh script already exists and is fully functional - no modifications needed
- All Docker authentication fixes from the docker-authentication-proxy-fix spec are already implemented
- The build process takes approximately 5-10 minutes for multi-arch builds
- Zero downtime deployment is possible with Docker Swarm rolling updates
- This release is 100% compatible with v1.5.0 - no breaking changes

---

## Verification Commands

### After Task 5 (Build and Push):
```bash
# Verify manifest
docker manifest inspect heltonfraga/wuzapi-manager:v1.5.1

# Check both architectures are present
docker manifest inspect heltonfraga/wuzapi-manager:v1.5.1 | grep -E "architecture|os"
```

### After Task 6 (Verification):
```bash
# Pull and test
docker pull heltonfraga/wuzapi-manager:v1.5.1
docker run -d --name wuzapi-test \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -e WUZAPI_BASE_URL=http://wuzapi:8080 \
  -e WUZAPI_ADMIN_TOKEN=test-token \
  -e SESSION_SECRET=test-secret \
  heltonfraga/wuzapi-manager:v1.5.1

# Wait for startup
sleep 30

# Test health check
curl http://localhost:3001/health

# Verify version
docker exec wuzapi-test node -e "console.log(require('./server/package.json').version)"

# Cleanup
docker stop wuzapi-test && docker rm wuzapi-test
```

---

## Success Criteria

- ✅ All version numbers updated to 1.5.1
- ✅ Release notes document all changes from v1.5.0 to v1.5.1
- ✅ Deploy guide provides complete step-by-step instructions
- ✅ Git tag v1.5.1 created and pushed
- ✅ Docker images built for both amd64 and arm64
- ✅ Images published to Docker Hub with correct tags
- ✅ Published images verified to work correctly
- ✅ Health check passes
- ✅ Version reported correctly as 1.5.1
