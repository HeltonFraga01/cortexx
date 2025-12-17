# AI Context & Architecture Guide

This document serves as a high-level map for AI agents working on the WUZAPI Manager project. It consolidates architectural decisions, directory structures, and key documentation links to facilitate accurate and context-aware code generation.

## 1. Project Overview

*   **Name:** WUZAPI Manager
*   **Purpose:** Management system for WhatsApp Business instances via WUZAPI.
*   **Architecture:** Monolithic repository with separated Frontend and Backend.
    *   **Frontend:** React 18, Vite, TypeScript, Tailwind CSS.
    *   **Backend:** Node.js, Express, Supabase (PostgreSQL).
    *   **Deployment:** Docker Swarm + Traefik.

## 2. Directory Structure

### Root
*   `docs/`: **CRITICAL**. Contains all technical specifications and API docs.
*   `server/`: Backend application.
*   `src/`: Frontend application.

### Backend (`server/`)
*   **Entry Point:** `index.js` (Main server setup, middleware, route mounting).
*   **Database:** `services/SupabaseService.js` (Supabase abstraction layer).
*   **Routes:** `routes/` (Modular route definitions).
*   **Services:** `services/` (Business logic).
*   **Middleware:** `middleware/` (Auth, logging, validation).

### Frontend (`src/`)
*   **Entry Point:** `main.tsx`.
*   **Components:** `components/` (UI building blocks).
*   **Pages:** `pages/` (Route views).
*   **Services:** `services/` (API clients).
*   **Contexts:** `contexts/` (Global state).

## 3. Key Documentation Resources

Always reference these files before proposing changes:

*   **API Specification:** [`docs/api/openapi.yaml`](../docs/api/openapi.yaml) & [`docs/api/examples.md`](../docs/api/examples.md)
*   **Product Spec:** [`docs/guides/ESPECIFICACAO_PRODUTO.md`](../docs/guides/ESPECIFICACAO_PRODUTO.md)
*   **Database Navigation:** [`docs/DYNAMIC_SIDEBAR_NAVIGATION_TECHNICAL.md`](../docs/DYNAMIC_SIDEBAR_NAVIGATION_TECHNICAL.md)
*   **NocoDB Integration:** [`docs/nocodb/integration-guide.md`](../docs/nocodb/integration-guide.md)

## 4. Coding Standards & Patterns

### Backend
*   **Language:** JavaScript (CommonJS).
*   **Database:** Supabase via `services/SupabaseService.js`. **Always use SupabaseService methods.**
*   **Auth:** Token-based (Admin Token & User Token).
*   **Logging:** Use `utils/logger.js`.

### Frontend
*   **Language:** TypeScript.
*   **Styling:** Tailwind CSS.
*   **State:** React Context API.
*   **Data Fetching:** Axios (via services).

## 5. AI Workflow Tips

1.  **Check Docs First:** Before implementing a feature, check `docs/` for existing specs.
2.  **Respect Architecture:** Do not add logic to `index.js` if it fits in a route or service.
3.  **Update Docs:** If you change an API endpoint, update `docs/api/examples.md`.
4.  **Context Limits:** `server/database.js` and `server/index.js` are large. Read only relevant sections if possible.
