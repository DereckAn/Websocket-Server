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

# Set production environment (can be overridden by Railway)
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy source code from builder
COPY --from=builder /app/src ./src

# Change ownership to non-root user
RUN chown -R bunuser:nodejs /app
USER bunuser

# Expose port (Railway will override with $PORT env var)
EXPOSE 3000

# Note: HEALTHCHECK removed for Railway compatibility
# Railway uses its own health check system by making HTTP requests
# to your service. The hardcoded port in HEALTHCHECK was causing
# failures since Railway assigns dynamic ports via $PORT env var.

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the Gomoku server
CMD ["bun", "src/index.ts"]