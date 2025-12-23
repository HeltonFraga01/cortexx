# Archived Documentation

This folder contains documentation that is no longer current but kept for historical reference.

## Why Archived?

These documents reference outdated architecture, specifically the SQLite database that was replaced by Supabase (PostgreSQL) in December 2025.

## Archived Files

### Database/Architecture
- `database-sqlite.js.bak` - Old SQLite database abstraction layer
- `BACKEND_DATA_INTEGRATIONS_GUIDE.md` - Old data layer documentation (SQLite-based)
- `DOCKER_DATABASE_CONFIG.md` - Docker SQLite configuration
- `DYNAMIC_SIDEBAR_ARCHITECTURE.md` - Architecture with SQLite references
- `DYNAMIC_SIDEBAR_QUICK_REFERENCE.md` - Quick reference with SQLite commands
- `BACKEND_ENDPOINT_TEMPLATES_GUIDE.md` - Endpoint templates with SQLite health checks
- `ManualdeEngenharia.md` - Engineering manual with SQLite architecture
- `custom-home-page-editor-technical.md` - Technical doc with SQLite references
- `DEVELOPMENT_VS_DOCKER.md` - Development vs Docker comparison with SQLite paths

### Security/Audit
- `SECURITY_AUDIT.md` - Security audit with SQLite-specific recommendations

### Guides/Tutorials
- `MODERNIZATION_SUMMARY.md` - Modernization decisions (pre-Supabase)
- `tutorial-grupos.md` - Tutorial with SQLite examples
- `ESPECIFICACAO_PRODUTO.md` - Product spec with SQLite architecture
- `QUICK_REFERENCE.md` - Quick reference with SQLite commands
- `FAQ.md` - FAQ with SQLite references
- `DEPLOY.md` - Deploy guide with SQLite configuration
- `TROUBLESHOOTING.md` - Troubleshooting with SQLite issues

### Changelogs/Releases
- `CHANGELOG_USER_DASHBOARD.md` - Dashboard changelog with SQLite references
- `CHANGELOG_MESSAGES_MODERNIZATION.md` - Messages changelog with SQLite references
- `RELEASE_NOTES_v1.5.1.md` - Release notes with SQLite configuration

## Current Architecture

The project now uses:
- **Supabase (PostgreSQL)** as the database
- **SupabaseService** (`server/services/SupabaseService.js`) as the database abstraction layer

For current documentation, see:
- `server/README.md` - Backend documentation
- `.kiro/steering/backend-guidelines.md` - Backend development guidelines
- `.kiro/steering/project-overview.md` - Project overview
