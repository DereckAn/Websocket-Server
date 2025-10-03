# =================================================================
# Multi-stage Dockerfile for Bun.js Gomoku Game Server
# =================================================================

# Stage 1: Builder - Install all dependencies including dev
FROM oven/bun:1-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install all dependencies (including dev for type checking)
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Optional: Type check (uncomment for stricter builds)
# RUN bun run type-check

# Build the application (optional for Bun, but good practice)
RUN bun run build 2>/dev/null || echo "Build step skipped"

# Stage 2: Production - Minimal runtime image
FROM oven/bun:1-alpine as production

# Install curl for health checks and dumb-init for signal handling
RUN apk add --no-cache curl dumb-init

# Create app user for security (non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy source code from builder
COPY --from=builder /app/src ./src

# Change ownership to non-root user
RUN chown -R bunuser:nodejs /app
USER bunuser

# Expose port (default 3000)
EXPOSE 3000

# Health check for Gomoku server
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the Gomoku server
CMD ["bun", "src/index.ts"]