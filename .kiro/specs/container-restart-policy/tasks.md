# Implementation Plan

- [x] 1. Update Docker Compose Swarm restart policy
  - [x] 1.1 Change restart_policy condition from on-failure to any
    - Modify `docker-compose.swarm.yml`
    - Change `condition: on-failure` to `condition: any`
    - _Requirements: 1.1, 1.4_
  - [x] 1.2 Remove max_attempts limit
    - Remove `max_attempts: 3` from restart_policy
    - Keep `delay: 5s` and `window: 120s`
    - _Requirements: 2.1, 2.2_

- [x] 2. Update healthcheck configuration for resilience
  - [x] 2.1 Increase healthcheck retries
    - Change `retries: 3` to `retries: 5`
    - _Requirements: 3.1_
  - [x] 2.2 Increase healthcheck start_period
    - Change `start_period: 60s` to `start_period: 90s`
    - _Requirements: 3.2_

- [x] 3. Enhance shutdown logging in server/index.js
  - [x] 3.1 Add signal type logging
    - Log which signal was received (SIGTERM, SIGINT, etc.)
    - Include timestamp and process info
    - _Requirements: 4.1_
  - [x] 3.2 Add shutdown duration logging
    - Track shutdown start time
    - Log total shutdown duration on completion
    - _Requirements: 4.2_

- [x] 4. Add startup restart information logging
  - [x] 4.1 Log restart information on startup
    - Check for RESTART_COUNT environment variable (if set by orchestrator)
    - Log startup with restart context
    - _Requirements: 4.3_

- [ ]* 5. Add configuration validation tests
  - [ ]* 5.1 Write property test for restart policy configuration
    - **Property 1: Restart Policy Configuration Validity**
    - **Validates: Requirements 1.4, 2.1, 2.2**
  - [ ]* 5.2 Write property test for healthcheck configuration
    - **Property 2: Healthcheck Resilience Configuration**
    - **Validates: Requirements 3.1, 3.2**

- [x] 6. Update docker-compose.yml (development) for consistency
  - [x] 6.1 Apply same restart policy changes to development compose
    - Ensure development environment mirrors production behavior
    - _Requirements: 1.1, 1.4, 2.1, 2.2_

- [x] 7. Checkpoint - Verify all changes
  - Ensure all tests pass, ask the user if questions arise.
