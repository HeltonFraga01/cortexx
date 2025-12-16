#!/bin/bash
# Alias for Docker Swarm deployment script
# Calls the main script in scripts/ directory

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/scripts/deploy-swarm.sh" "$@"
