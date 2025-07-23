# Multi-stage build for production optimization
FROM oven/bun:1-alpine as builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build the application (optional for Bun, but good practice)
RUN bun run build 2>/dev/null || echo "Build step skipped"

# Production stage
FROM oven/bun:1-alpine as production

# Install curl for health checks and dumb-init for signal handling
RUN apk add --no-cache curl dumb-init

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install only production dependencies
RUN bun install --production --frozen-lockfile

# Copy source code
COPY --from=builder /app/src ./src

# Change ownership to non-root user
RUN chown -R bunuser:nodejs /app
USER bunuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["bun", "src/index.ts"]