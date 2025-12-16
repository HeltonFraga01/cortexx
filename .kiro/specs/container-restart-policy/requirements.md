# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir a política de reinício do container Docker do WUZAPI Manager. O problema atual é que o container está sendo finalizado (SIGTERM) e não reinicia automaticamente, causando indisponibilidade do serviço em produção.

## Glossary

- **SIGTERM**: Sinal de terminação enviado ao processo para solicitar shutdown gracioso
- **Docker Swarm**: Orquestrador de containers Docker para deploy em produção
- **Restart Policy**: Política que define quando e como um container deve ser reiniciado
- **Healthcheck**: Verificação periódica de saúde do container
- **Traefik**: Reverse proxy que roteia tráfego para os containers

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the container to automatically restart after any termination, so that the service remains available without manual intervention.

#### Acceptance Criteria

1. WHEN the container receives SIGTERM signal THEN the system SHALL restart the container automatically after graceful shutdown completes
2. WHEN the container crashes or fails THEN the system SHALL restart the container with exponential backoff delay
3. WHEN the container is manually stopped via `docker service scale` THEN the system SHALL NOT restart the container
4. WHEN the restart policy is configured THEN the system SHALL use `condition: any` instead of `condition: on-failure`

### Requirement 2

**User Story:** As a system administrator, I want the container to have unlimited restart attempts, so that transient failures do not cause permanent service unavailability.

#### Acceptance Criteria

1. WHEN the container fails multiple times THEN the system SHALL continue attempting restarts indefinitely
2. WHEN configuring restart policy THEN the system SHALL remove the `max_attempts` limit or set it to a very high value
3. WHEN the container restarts THEN the system SHALL apply a delay between restart attempts to prevent rapid cycling

### Requirement 3

**User Story:** As a system administrator, I want the healthcheck to be resilient to temporary issues, so that brief hiccups do not trigger unnecessary container restarts.

#### Acceptance Criteria

1. WHEN the healthcheck fails THEN the system SHALL retry at least 5 times before marking container as unhealthy
2. WHEN the container starts THEN the system SHALL allow a start period of at least 90 seconds before healthchecks begin
3. WHEN the healthcheck times out THEN the system SHALL log the timeout and retry rather than immediately failing

### Requirement 4

**User Story:** As a developer, I want to understand why the container is being terminated, so that I can diagnose and prevent unexpected shutdowns.

#### Acceptance Criteria

1. WHEN the container receives a termination signal THEN the system SHALL log the signal type and source
2. WHEN the container shuts down THEN the system SHALL log the shutdown reason and duration
3. WHEN the container restarts THEN the system SHALL log the restart count and previous exit code
