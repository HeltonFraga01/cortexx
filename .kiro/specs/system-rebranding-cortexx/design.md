# Design Document: System Rebranding to Cortexx

## Overview

This document describes the design for rebranding the system from "wuzapi-manager" to "cortexx". The rebranding is a straightforward find-and-replace operation across configuration files, documentation, and CI/CD workflows. The system functionality remains unchanged; only naming references are updated.

## Architecture

The rebranding affects the following layers of the system:

```
┌─────────────────────────────────────────────────────────────┐
│                    Files to Update                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Docker Configuration                                       │
│  ├── docker-compose-swarm.yaml (production)                │
│  ├── docker-compose.yml (development)                       │
│  ├── docker-compose.local.yml (local testing)              │
│  └── monitoring/prometheus.yml                              │
│                                                             │
│  CI/CD Workflows                                            │
│  ├── .github/workflows/docker-multiarch.yml                │
│  ├── .github/workflows/docker-multi-arch.yml               │
│  ├── .github/workflows/deploy.yml                          │
│  └── .github/workflows/release.yml                         │
│                                                             │
│  Documentation                                              │
│  ├── QUICK_REFERENCE.md                                    │
│  ├── IMPLEMENTATION_SUMMARY.md                             │
│  ├── VERIFICACOES_ADICIONAIS.md                            │
│  ├── CHANGELOG.md                                          │
│  └── .kiro/steering/docker-deployment.md                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Component 1: Docker Swarm Configuration

**File:** `docker-compose-swarm.yaml`

**Changes:**
| Old Value | New Value |
|-----------|-----------|
| `wuzapi-manager` (service name) | `cortexx` |
| `heltonfraga/wuzapi-manager:v1.5.47` | `heltonfraga/cortexx:v1.5.47` |
| `wuzapi-manager.db` | `cortexx.db` |
| `traefik.http.routers.wuzapi-manager.*` | `traefik.http.routers.cortexx.*` |
| `traefik.http.services.wuzapi-manager.*` | `traefik.http.services.cortexx.*` |
| `wuzapi-manager_session` (cookie) | `cortexx_session` |
| `wuzapi-manager-data` (volume) | `cortexx-data` |
| `wuzapi-manager-logs` (volume) | `cortexx-logs` |

### Component 2: Development Docker Configuration

**File:** `docker-compose.yml`

**Changes:**
| Old Value | New Value |
|-----------|-----------|
| `wuzapi-manager-dev` (service/container) | `cortexx-dev` |

### Component 3: Local Testing Configuration

**File:** `docker-compose.local.yml`

**Changes:**
| Old Value | New Value |
|-----------|-----------|
| `wuzapi-manager` (service name) | `cortexx` |
| `wuzapi-manager-local` (container) | `cortexx-local` |
| `wuzapi-local` (network) | `cortexx-local` |

### Component 4: Prometheus Monitoring

**File:** `monitoring/prometheus.yml`

**Changes:**
| Old Value | New Value |
|-----------|-----------|
| `wuzapi-manager` (job_name) | `cortexx` |
| `wuzapi-manager-dev:3001` (target) | `cortexx-dev:3001` |

### Component 5: GitHub Actions Workflows

**Files:** `.github/workflows/*.yml`

**Changes:**
| Old Value | New Value |
|-----------|-----------|
| `IMAGE_NAME: wuzapi-manager` | `IMAGE_NAME: cortexx` |
| `IMAGE_NAME: heltonfraga/wuzapi-manager` | `IMAGE_NAME: heltonfraga/cortexx` |

### Component 6: Documentation Files

**Files:** Multiple markdown files

**Pattern Replacements:**
- `wuzapi-manager_wuzapi-manager` → `cortexx_cortexx`
- `name=wuzapi-manager` → `name=cortexx`
- `heltonfraga/wuzapi-manager` → `heltonfraga/cortexx`
- `wuzapi-manager-dev` → `cortexx-dev`

## Data Models

No data model changes are required. The SQLite database file will be renamed from `wuzapi-manager.db` to `cortexx.db` in configuration only. Existing data remains unchanged.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the acceptance criteria analysis:

**Property 1: Service name consistency**
*For any* Docker compose file in the project, all service names, container names, and volume names SHALL use "cortexx" prefix instead of "wuzapi-manager"
**Validates: Requirements 1.1, 1.2, 2.1, 2.2, 2.3**

**Property 2: Image reference consistency**
*For any* Docker configuration or CI/CD workflow file, all image references SHALL use "heltonfraga/cortexx" as the repository name
**Validates: Requirements 1.4, 4.1, 4.2**

**Property 3: Traefik label consistency**
*For any* Traefik label in Docker configurations, all router and service names SHALL use "cortexx" instead of "wuzapi-manager"
**Validates: Requirements 1.3**

**Property 4: Documentation command consistency**
*For any* documentation file containing Docker commands, all service and container name references SHALL use "cortexx" naming
**Validates: Requirements 3.1, 3.2, 5.1, 5.2, 5.3**

## Error Handling

This is a configuration-only change. Error scenarios:

1. **Missing file**: If a file to be updated doesn't exist, skip it and log a warning
2. **Partial replacement**: Verify all expected replacements were made by counting occurrences before and after
3. **Deployment failure**: After changes, test Docker compose file validity with `docker-compose config`

## Testing Strategy

### Manual Verification

Since this is a text replacement task, testing involves:

1. **Pre-change count**: Count all occurrences of "wuzapi-manager" in target files
2. **Post-change verification**: Verify zero occurrences of "wuzapi-manager" remain
3. **Syntax validation**: Run `docker-compose -f <file> config` on all compose files

### Property-Based Testing

Property-based testing is not applicable for this task as it involves static configuration file updates rather than runtime behavior. The correctness properties defined above serve as verification criteria for manual review.

### Validation Commands

```bash
# Verify no old references remain
grep -r "wuzapi-manager" --include="*.yaml" --include="*.yml" --include="*.md" .

# Validate Docker compose syntax
docker-compose -f docker-compose-swarm.yaml config
docker-compose -f docker-compose.yml config
docker-compose -f docker-compose.local.yml config
```
