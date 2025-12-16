# Requirements Document - Release v1.5.2

## Introduction

This document outlines the requirements for preparing and publishing version 1.5.2 of the WUZAPI Manager to Docker Hub. This is a maintenance release that includes bug fixes, documentation updates, and minor improvements since v1.5.1.

## Glossary

- **WUZAPI Manager**: The WhatsApp Business API management platform
- **Docker Hub**: The container registry where Docker images are published
- **Multi-arch Build**: Building Docker images for multiple CPU architectures (amd64, arm64)
- **Semantic Versioning**: Version numbering scheme (MAJOR.MINOR.PATCH)
- **Release Tag**: Git tag marking a specific release version
- **Changelog**: Document tracking all changes between versions

## Requirements

### Requirement 1: Version Management

**User Story:** As a release manager, I want to update all version numbers to 1.5.2, so that the release is properly identified across all components.

#### Acceptance Criteria

1. WHEN updating version numbers, THE System SHALL update the version field in package.json to "1.5.2"
2. WHEN updating version numbers, THE System SHALL update the version field in server/package.json to "1.5.2"
3. WHEN updating version numbers, THE System SHALL ensure version consistency across all package files
4. WHEN updating version numbers, THE System SHALL validate that no other version references need updating
5. WHEN version update is complete, THE System SHALL confirm all files are modified correctly

### Requirement 2: Release Documentation

**User Story:** As a developer, I want comprehensive release notes, so that I can understand what changed in v1.5.2.

#### Acceptance Criteria

1. WHEN creating release notes, THE System SHALL create a file at docs/releases/RELEASE_NOTES_v1.5.2.md
2. WHEN documenting changes, THE System SHALL list all bug fixes included in this release
3. WHEN documenting changes, THE System SHALL list all improvements and enhancements
4. WHEN documenting changes, THE System SHALL list all documentation updates
5. WHEN documenting changes, THE System SHALL include migration information from v1.5.1
6. WHEN documenting changes, THE System SHALL follow the established release notes format from previous versions
7. WHEN release notes are complete, THE System SHALL include a summary section at the top

### Requirement 3: Deployment Documentation

**User Story:** As a DevOps engineer, I want a deployment guide for v1.5.2, so that I can deploy the release correctly.

#### Acceptance Criteria

1. WHEN creating deployment guide, THE System SHALL create a file at DEPLOY_v1.5.2.md in the project root
2. WHEN documenting deployment, THE System SHALL include a pre-deployment checklist
3. WHEN documenting deployment, THE System SHALL include multi-architecture build commands
4. WHEN documenting deployment, THE System SHALL include Docker Hub push verification steps
5. WHEN documenting deployment, THE System SHALL include post-deployment verification commands
6. WHEN documenting deployment, THE System SHALL include a troubleshooting section
7. WHEN deployment guide is complete, THE System SHALL follow the format from DEPLOY_v1.5.1.md

### Requirement 4: Version Control

**User Story:** As a release manager, I want to tag the release in Git, so that the version is tracked in version control.

#### Acceptance Criteria

1. WHEN preparing for release, THE System SHALL commit all version and documentation changes
2. WHEN committing changes, THE System SHALL use a conventional commit message format
3. WHEN changes are committed, THE System SHALL create a Git tag named "v1.5.2"
4. WHEN creating the tag, THE System SHALL include a descriptive release message
5. WHEN tag is created, THE System SHALL push commits and tags to the remote repository

### Requirement 5: Docker Image Build

**User Story:** As a DevOps engineer, I want multi-architecture Docker images built, so that the application runs on different platforms.

#### Acceptance Criteria

1. WHEN building Docker images, THE System SHALL execute the deploy-multiarch.sh script with version "v1.5.2"
2. WHEN building images, THE System SHALL build for linux/amd64 architecture
3. WHEN building images, THE System SHALL build for linux/arm64 architecture
4. WHEN building images, THE System SHALL tag images with "v1.5.2"
5. WHEN building images, THE System SHALL tag images with "latest"
6. WHEN build is complete, THE System SHALL push images to Docker Hub
7. WHEN images are pushed, THE System SHALL verify images are available in the registry

### Requirement 6: Release Verification

**User Story:** As a QA engineer, I want to verify the published images work correctly, so that we ensure quality before announcing the release.

#### Acceptance Criteria

1. WHEN verifying the release, THE System SHALL pull the image heltonfraga/wuzapi-manager:v1.5.2 from Docker Hub
2. WHEN testing the image, THE System SHALL run a test container with required environment variables
3. WHEN container is running, THE System SHALL verify the health check endpoint returns HTTP 200
4. WHEN verifying version, THE System SHALL confirm the reported version is "1.5.2"
5. WHEN testing functionality, THE System SHALL verify authentication works correctly
6. WHEN verification is complete, THE System SHALL clean up all test resources

### Requirement 7: Changelog Update

**User Story:** As a developer, I want the changelog updated, so that all changes are tracked in one place.

#### Acceptance Criteria

1. WHEN updating changelog, THE System SHALL add a new section for version [1.5.2]
2. WHEN documenting changes, THE System SHALL list changes under appropriate categories (Added, Changed, Fixed, etc.)
3. WHEN updating changelog, THE System SHALL include the release date
4. WHEN updating changelog, THE System SHALL follow the Keep a Changelog format
5. WHEN changelog is updated, THE System SHALL add a comparison link at the bottom
