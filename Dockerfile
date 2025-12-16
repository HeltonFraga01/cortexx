# Dockerfile otimizado para WUZAPI Manager
# Build: docker build -t wuzapi-manager .
# Run: docker run -p 3001:3001 --env-file server/.env wuzapi-manager

# ============================================================================
# Stage 1: Base image com dependências do sistema
# ============================================================================
FROM node:20-alpine AS base

# Instalar dependências do sistema necessárias para build e runtime
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Configurar npm para otimizar cache
RUN npm config set cache /tmp/.npm --global

# ============================================================================
# Stage 2: Dependências do frontend
# ============================================================================
FROM base AS frontend-deps

WORKDIR /app

# Copiar apenas package.json para aproveitar cache do Docker
COPY package*.json ./

# Instalar dependências do frontend (incluindo devDependencies para build)
# Skip Cypress binary install para evitar problemas em ARM64
ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci --include=dev && npm cache clean --force

# ============================================================================
# Stage 3: Dependências do backend
# ============================================================================
FROM base AS backend-deps

WORKDIR /app

# Copiar package.json do servidor
COPY server/package*.json ./server/

# Instalar dependências do backend
RUN cd server && npm ci && npm cache clean --force

# ============================================================================
# Stage 4: Build do frontend
# ============================================================================
FROM frontend-deps AS frontend-builder

# Copiar código fonte do frontend
COPY . .

# Build otimizado do frontend
RUN npm run build:production

# ============================================================================
# Stage 5: Preparar dependências de produção do backend
# ============================================================================
FROM base AS backend-prod-deps

WORKDIR /app

# Copiar package.json do servidor
COPY server/package*.json ./server/

# Instalar apenas dependências de produção
RUN cd server && npm ci --only=production && npm cache clean --force

# ============================================================================
# Stage 6: Imagem final de produção
# ============================================================================
FROM node:20-alpine AS production

# Instalar apenas dependências de runtime essenciais
# FFmpeg é necessário para conversão de áudio para formato OGG/Opus (WhatsApp)
RUN apk add --no-cache \
    sqlite \
    curl \
    dumb-init \
    tini \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root com UID/GID específicos
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Criar diretório da aplicação
WORKDIR /app

# Copiar dependências de produção do backend
COPY --from=backend-prod-deps --chown=nodejs:nodejs /app/server/node_modules ./server/node_modules

# Copiar arquivos built do frontend
COPY --from=frontend-builder --chown=nodejs:nodejs /app/dist ./dist

# Copiar código do servidor
COPY --chown=nodejs:nodejs server/ ./server/

# Criar diretórios necessários com permissões corretas
RUN mkdir -p /app/data /app/logs /app/tmp && \
    chown -R nodejs:nodejs /app && \
    chmod -R 755 /app

# Expor porta
EXPOSE 3001

# Variáveis de ambiente otimizadas
ENV NODE_ENV=production \
    PORT=3001 \
    SQLITE_DB_PATH=/app/data/wuzapi.db \
    SQLITE_WAL_MODE=true \
    SQLITE_TIMEOUT=10000 \
    SQLITE_CACHE_SIZE=8000 \
    SQLITE_SYNCHRONOUS=NORMAL \
    SQLITE_JOURNAL_MODE=WAL \
    NODE_OPTIONS="--max-old-space-size=512" \
    UV_THREADPOOL_SIZE=4

# Health check robusto com múltiplas verificações
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node server/healthcheck.js || exit 1

# Mudar para usuário não-root
USER nodejs

# Usar tini como init system para melhor handling de sinais
ENTRYPOINT ["/sbin/tini", "--"]

# Comando otimizado para produção
CMD ["dumb-init", "node", "server/index.js"]

# ============================================================================
# Metadata
# ============================================================================
LABEL maintainer="WUZAPI Team" \
      version="1.5.6" \
      description="WUZAPI Manager - Optimized Docker Image with Scheduled Messages" \
      org.opencontainers.image.source="https://github.com/heltonfraga/wuzapi-manager" \
      org.opencontainers.image.documentation="https://github.com/heltonfraga/wuzapi-manager/blob/main/README.md"
